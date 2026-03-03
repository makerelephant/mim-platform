-- =============================================================
-- MiM CRM: Consolidate investors + soccer_orgs → organizations
-- Run this ENTIRE script in the Supabase SQL Editor
-- =============================================================

BEGIN;

-- Step 1: Create unified organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Unified fields
  name TEXT NOT NULL,
  org_category TEXT,
  relationships TEXT[] DEFAULT '{}',
  source_table TEXT,
  description TEXT,
  website TEXT,
  address TEXT,
  location TEXT,
  avatar_url TEXT,
  notes TEXT,
  primary_contact TEXT,
  -- Investor-specific
  firm_name TEXT,
  fund_type TEXT,
  investor_type TEXT,
  geography TEXT,
  sector_focus TEXT,
  check_size TEXT,
  portfolio_url TEXT,
  notable_investments TEXT,
  connection_status TEXT,
  pipeline_status TEXT,
  likelihood_score INTEGER,
  source TEXT,
  last_contact_date DATE,
  next_action TEXT,
  next_action_date DATE,
  -- Soccer-org-specific
  org_name TEXT,
  org_type TEXT,
  corporate_structure TEXT,
  merch_link TEXT,
  store_status TEXT,
  store_provider TEXT,
  players INTEGER,
  travel_teams INTEGER,
  dues_per_season NUMERIC,
  dues_revenue NUMERIC,
  uniform_cost NUMERIC,
  total_revenue NUMERIC,
  gross_revenue NUMERIC,
  total_costs NUMERIC,
  yearly_cost_player NUMERIC,
  outreach_status TEXT,
  last_outreach_date DATE,
  outreach_notes TEXT,
  partner_status TEXT,
  partner_since DATE,
  in_bays BOOLEAN DEFAULT FALSE,
  in_cmysl BOOLEAN DEFAULT FALSE,
  in_cysl BOOLEAN DEFAULT FALSE,
  in_ecnl BOOLEAN DEFAULT FALSE,
  in_ecysa BOOLEAN DEFAULT FALSE,
  in_mysl BOOLEAN DEFAULT FALSE,
  in_nashoba BOOLEAN DEFAULT FALSE,
  in_necsl BOOLEAN DEFAULT FALSE,
  in_roots BOOLEAN DEFAULT FALSE,
  in_south_coast BOOLEAN DEFAULT FALSE,
  in_south_shore BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Migrate investor data (preserve UUIDs)
INSERT INTO organizations (
  id, name, org_category, relationships, source_table,
  description, website, location, avatar_url, notes,
  firm_name, fund_type, investor_type, geography, sector_focus,
  check_size, portfolio_url, notable_investments, connection_status,
  pipeline_status, likelihood_score, source, last_contact_date,
  next_action, next_action_date
)
SELECT
  id, firm_name, 'Investment Firm', '{"Investor"}', 'investors',
  description, website, location, avatar_url, notes,
  firm_name, fund_type, investor_type, geography, sector_focus,
  check_size, portfolio_url, notable_investments, connection_status,
  pipeline_status, likelihood_score, source, last_contact_date,
  next_action, next_action_date
FROM investors;

-- Step 3: Migrate soccer_orgs data (preserve UUIDs)
INSERT INTO organizations (
  id, name, org_category, relationships, source_table,
  description, website, address, avatar_url, notes, primary_contact,
  org_name, org_type, corporate_structure, merch_link,
  store_status, store_provider, players, travel_teams,
  dues_per_season, dues_revenue, uniform_cost, total_revenue,
  gross_revenue, total_costs, yearly_cost_player,
  outreach_status, last_outreach_date, outreach_notes,
  partner_status, partner_since,
  in_bays, in_cmysl, in_cysl, in_ecnl, in_ecysa,
  in_mysl, in_nashoba, in_necsl, in_roots,
  in_south_coast, in_south_shore
)
SELECT
  id, org_name, 'Youth Soccer',
  CASE WHEN partner_status IS NOT NULL THEN '{"Partner"}' ELSE '{}' END,
  'soccer_orgs',
  NULL, website, address, avatar_url, notes, primary_contact,
  org_name, org_type, corporate_structure, merch_link,
  store_status, store_provider, players, travel_teams,
  dues_per_season, dues_revenue, uniform_cost, total_revenue,
  gross_revenue, total_costs, yearly_cost_player,
  outreach_status, last_outreach_date, outreach_notes,
  partner_status, partner_since,
  in_bays, in_cmysl, in_cysl, in_ecnl, in_ecysa,
  in_mysl, in_nashoba, in_necsl, in_roots,
  in_south_coast, in_south_shore
FROM soccer_orgs;

-- Step 4: Create unified organization_contacts junction table
CREATE TABLE IF NOT EXISTS organization_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, contact_id)
);

INSERT INTO organization_contacts (organization_id, contact_id, role)
SELECT investor_id, contact_id, role FROM investor_contacts
ON CONFLICT (organization_id, contact_id) DO NOTHING;

INSERT INTO organization_contacts (organization_id, contact_id, role)
SELECT soccer_org_id, contact_id, role FROM soccer_org_contacts
ON CONFLICT (organization_id, contact_id) DO NOTHING;

-- Step 5: Create unified task_organizations junction table
CREATE TABLE IF NOT EXISTS task_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, organization_id)
);

INSERT INTO task_organizations (task_id, organization_id, role)
SELECT task_id, investor_id, role FROM task_investors
ON CONFLICT (task_id, organization_id) DO NOTHING;

INSERT INTO task_organizations (task_id, organization_id, role)
SELECT task_id, soccer_org_id, role FROM task_soccer_orgs
ON CONFLICT (task_id, organization_id) DO NOTHING;

-- Step 6: Update polymorphic references
UPDATE correspondence SET entity_type = 'organizations' WHERE entity_type IN ('investors', 'soccer_orgs');
UPDATE activity_log SET entity_type = 'organizations' WHERE entity_type IN ('investors', 'soccer_orgs');
UPDATE tasks SET entity_type = 'organizations' WHERE entity_type IN ('investors', 'soccer_orgs');

-- Step 7: Create indexes
CREATE INDEX idx_organizations_source ON organizations(source_table);
CREATE INDEX idx_organizations_category ON organizations(org_category);
CREATE INDEX idx_organizations_relationships ON organizations USING GIN(relationships);
CREATE INDEX idx_organizations_pipeline ON organizations(pipeline_status) WHERE pipeline_status IS NOT NULL;
CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_org_contacts_org ON organization_contacts(organization_id);
CREATE INDEX idx_org_contacts_contact ON organization_contacts(contact_id);
CREATE INDEX idx_task_orgs_task ON task_organizations(task_id);
CREATE INDEX idx_task_orgs_org ON task_organizations(organization_id);

-- Step 8: Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE organization_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON organization_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE task_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON task_organizations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Step 9: Rename old tables as backup (don't drop)
ALTER TABLE investors RENAME TO investors_backup;
ALTER TABLE soccer_orgs RENAME TO soccer_orgs_backup;
ALTER TABLE investor_contacts RENAME TO investor_contacts_backup;
ALTER TABLE soccer_org_contacts RENAME TO soccer_org_contacts_backup;
ALTER TABLE task_investors RENAME TO task_investors_backup;
ALTER TABLE task_soccer_orgs RENAME TO task_soccer_orgs_backup;

COMMIT;
