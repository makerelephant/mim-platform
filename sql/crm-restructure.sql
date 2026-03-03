-- ============================================================
-- CRM Schema Restructure: org_type[], dimensions, opportunities
-- Run in Supabase SQL Editor as a single script
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- STEP 1: Add new CRM columns to organizations
-- ──────────────────────────────────────────────────────────────

-- Handle org_type: if it already exists as TEXT (from prior migration),
-- convert it to TEXT[]; otherwise add it fresh as TEXT[].
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'org_type' AND data_type = 'text'
  ) THEN
    -- Column exists as plain TEXT — convert to TEXT[]
    ALTER TABLE organizations
      ALTER COLUMN org_type TYPE TEXT[]
      USING CASE WHEN org_type IS NOT NULL AND org_type <> '' THEN ARRAY[org_type] ELSE '{}' END;
    ALTER TABLE organizations ALTER COLUMN org_type SET DEFAULT '{}';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'org_type'
  ) THEN
    -- Column doesn't exist at all — add it
    ALTER TABLE organizations ADD COLUMN org_type TEXT[] DEFAULT '{}';
  END IF;
  -- If it already exists as TEXT[] (ARRAY), do nothing
END $$;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;

-- ──────────────────────────────────────────────────────────────
-- STEP 2: Migrate source_table → org_type
-- ──────────────────────────────────────────────────────────────

-- Investors → org_type = ['Investor']
UPDATE organizations
SET org_type = '{Investor}'::text[]
WHERE source_table = 'investors';

-- Soccer orgs WITHOUT partner_status → org_type = ['Customer']
UPDATE organizations
SET org_type = '{Customer}'::text[]
WHERE source_table = 'soccer_orgs' AND partner_status IS NULL;

-- Soccer orgs WITH partner_status → org_type = ['Customer', 'Partner']
UPDATE organizations
SET org_type = '{Customer,Partner}'::text[]
WHERE source_table = 'soccer_orgs' AND partner_status IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- STEP 3: Map lifecycle_status from existing status fields
-- ──────────────────────────────────────────────────────────────

UPDATE organizations
SET lifecycle_status = CASE
  WHEN pipeline_status IN ('Closed') THEN 'active'
  WHEN pipeline_status IN ('Passed', 'Not a Fit') THEN 'inactive'
  WHEN pipeline_status IS NOT NULL THEN 'pipeline'
  WHEN partner_status = 'Active Partner' THEN 'active'
  WHEN partner_status IN ('Prospect', 'Inactive', 'Churned') THEN 'pipeline'
  ELSE 'target'
END;

-- ──────────────────────────────────────────────────────────────
-- STEP 4: Create dimension tables
-- ──────────────────────────────────────────────────────────────

-- Community categories (lookup table)
CREATE TABLE IF NOT EXISTS community_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO community_categories (name) VALUES
  ('Youth Soccer'), ('Retail'), ('Church Group'), ('School'),
  ('Recreation Center'), ('League'), ('Other')
ON CONFLICT (name) DO NOTHING;

-- Geography (tree structure)
CREATE TABLE IF NOT EXISTS geographies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES geographies(id),
  geo_type TEXT,  -- 'country', 'state', 'region', 'city'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed top-level geographies
INSERT INTO geographies (name, geo_type) VALUES
  ('United States', 'country')
ON CONFLICT DO NOTHING;

INSERT INTO geographies (name, parent_id, geo_type)
SELECT 'Massachusetts', id, 'state' FROM geographies WHERE name = 'United States'
ON CONFLICT DO NOTHING;

-- Leagues table (replaces boolean in_* columns)
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT UNIQUE,
  geography_id UUID REFERENCES geographies(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO leagues (name, abbreviation) VALUES
  ('BAYS', 'BAYS'),
  ('CMYSL', 'CMYSL'),
  ('CYSL', 'CYSL'),
  ('ECNL', 'ECNL'),
  ('ECYSA', 'ECYSA'),
  ('MYSL', 'MYSL'),
  ('Nashoba', 'Nashoba'),
  ('NECSL', 'NECSL'),
  ('Roots', 'Roots'),
  ('South Coast', 'South Coast'),
  ('South Shore', 'South Shore')
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- STEP 5: Create junction tables
-- ──────────────────────────────────────────────────────────────

-- Org-league junction (replaces 11 boolean columns)
CREATE TABLE IF NOT EXISTS org_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  joined_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, league_id)
);

-- Org-community-relationship (rich junction with category + geo dimensions)
CREATE TABLE IF NOT EXISTS org_community_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES community_categories(id) ON DELETE CASCADE,
  geography_id UUID REFERENCES geographies(id),
  status TEXT DEFAULT 'target',  -- target, active, inactive
  tier TEXT,
  owner TEXT,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, category_id)
);

-- ──────────────────────────────────────────────────────────────
-- STEP 6: Create opportunities table
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT DEFAULT 'Prospect',  -- Prospect, Qualified, Engaged, First Meeting, In Closing, Closed Won, Closed Lost
  deal_type TEXT,                  -- 'fundraising', 'partnership'
  value NUMERIC,
  currency TEXT DEFAULT 'USD',
  probability INTEGER,             -- 0-100
  expected_close_date DATE,
  actual_close_date DATE,
  owner TEXT,
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- STEP 7: Migrate investor pipeline_status → opportunities
-- ──────────────────────────────────────────────────────────────

-- Create one opportunity per investor that has a pipeline_status
INSERT INTO opportunities (organization_id, name, stage, deal_type, source)
SELECT
  id,
  name || ' - Investment',
  CASE pipeline_status
    WHEN 'Prospect' THEN 'Prospect'
    WHEN 'Qualified' THEN 'Qualified'
    WHEN 'Engaged' THEN 'Engaged'
    WHEN 'First Meeting' THEN 'First Meeting'
    WHEN 'In Closing' THEN 'In Closing'
    WHEN 'Closed' THEN 'Closed Won'
    WHEN 'Passed' THEN 'Closed Lost'
    WHEN 'Not a Fit' THEN 'Closed Lost'
    ELSE 'Prospect'
  END,
  'fundraising',
  'migrated-from-pipeline'
FROM organizations
WHERE pipeline_status IS NOT NULL AND source_table = 'investors';

-- Also migrate likelihood_score → probability on the created opportunities
UPDATE opportunities o
SET probability = org.likelihood_score * 10  -- scale 1-10 → 10-100
FROM organizations org
WHERE o.organization_id = org.id
  AND o.source = 'migrated-from-pipeline'
  AND org.likelihood_score IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- STEP 8: Update contacts table
-- ──────────────────────────────────────────────────────────────

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS primary_org_id UUID REFERENCES organizations(id);

-- Backfill primary_org_id from first linked org in organization_contacts
UPDATE contacts c
SET primary_org_id = sub.organization_id
FROM (
  SELECT DISTINCT ON (contact_id) contact_id, organization_id
  FROM organization_contacts
  ORDER BY contact_id, created_at ASC
) sub
WHERE c.id = sub.contact_id AND c.primary_org_id IS NULL;

-- ──────────────────────────────────────────────────────────────
-- STEP 9: Migrate league booleans → org_leagues junction
-- ──────────────────────────────────────────────────────────────

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_bays = true AND l.abbreviation = 'BAYS'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_cmysl = true AND l.abbreviation = 'CMYSL'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_cysl = true AND l.abbreviation = 'CYSL'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_ecnl = true AND l.abbreviation = 'ECNL'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_ecysa = true AND l.abbreviation = 'ECYSA'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_mysl = true AND l.abbreviation = 'MYSL'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_nashoba = true AND l.abbreviation = 'Nashoba'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_necsl = true AND l.abbreviation = 'NECSL'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_roots = true AND l.abbreviation = 'Roots'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_south_coast = true AND l.abbreviation = 'South Coast'
ON CONFLICT DO NOTHING;

INSERT INTO org_leagues (organization_id, league_id)
SELECT o.id, l.id FROM organizations o, leagues l
WHERE o.in_south_shore = true AND l.abbreviation = 'South Shore'
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- STEP 10: Create indexes
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_organizations_org_type ON organizations USING GIN(org_type);
CREATE INDEX IF NOT EXISTS idx_organizations_lifecycle ON organizations(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_org_id) WHERE parent_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_leagues_org ON org_leagues(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_leagues_league ON org_leagues(league_id);

CREATE INDEX IF NOT EXISTS idx_org_community_rel_org ON org_community_relationships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_community_rel_cat ON org_community_relationships(category_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_deal_type ON opportunities(deal_type);

CREATE INDEX IF NOT EXISTS idx_contacts_primary_org ON contacts(primary_org_id) WHERE primary_org_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- STEP 11: Enable RLS + policies on all new tables
-- ──────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  -- Tables that need RLS + anon/authenticated policies
  FOR tbl IN SELECT unnest(ARRAY[
    'community_categories','geographies','leagues',
    'org_leagues','org_community_relationships','opportunities'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- anon policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'Allow all for anon') THEN
      EXECUTE format('CREATE POLICY "Allow all for anon" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)', tbl);
    END IF;

    -- authenticated policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'Allow all for authenticated') THEN
      EXECUTE format('CREATE POLICY "Allow all for authenticated" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    END IF;
  END LOOP;
END $$;

-- Ensure organizations also has anon policy (may already exist from prior migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON organizations FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- ──────────────────────────────────────────────────────────────
-- VALIDATION QUERIES (run after migration)
-- ──────────────────────────────────────────────────────────────
-- SELECT org_type, count(*) FROM organizations GROUP BY org_type ORDER BY count DESC;
-- SELECT count(*) FROM opportunities;
-- SELECT l.abbreviation, count(ol.id) FROM org_leagues ol JOIN leagues l ON l.id = ol.league_id GROUP BY 1 ORDER BY 1;
-- SELECT count(*) FROM contacts WHERE primary_org_id IS NOT NULL;
-- SELECT * FROM pg_policies WHERE tablename IN ('opportunities','org_leagues','community_categories','geographies','leagues','org_community_relationships');
