-- Step 8: Migrate Data
-- All INSERTs use ON CONFLICT DO NOTHING — safe to re-run
-- Column names CORRECTED to match actual public schema (verified 2026-03-09)

-- ===== 8a. organizations → core.organizations =====
INSERT INTO core.organizations (
  id, name, website, address, location, geography,
  avatar_url, description, notes, corporate_structure,
  parent_org_id, owner_user_id, source, created_at, updated_at
)
SELECT
  id,
  COALESCE(name, org_name),
  website,
  address,
  location,
  geography,
  avatar_url,
  description,
  notes,
  corporate_structure,
  parent_org_id,
  owner_user_id,
  source,
  created_at,
  updated_at
FROM public.organizations
ON CONFLICT (id) DO NOTHING;

-- ===== 8a-ii. Derive org_types from signals =====
-- Investors
INSERT INTO core.org_types (org_id, type)
SELECT id, 'investor'
FROM public.organizations
WHERE fund_type IS NOT NULL OR investor_type IS NOT NULL
ON CONFLICT (org_id, type) DO NOTHING;

-- Partners
INSERT INTO core.org_types (org_id, type)
SELECT id, 'partner'
FROM public.organizations
WHERE partner_status IS NOT NULL
ON CONFLICT (org_id, type) DO NOTHING;

-- Customers (has a store or merch link)
INSERT INTO core.org_types (org_id, type)
SELECT id, 'customer'
FROM public.organizations
WHERE store_status IS NOT NULL OR merch_link IS NOT NULL
ON CONFLICT (org_id, type) DO NOTHING;

-- ===== 8a-iii. Map org_categories to taxonomy =====
INSERT INTO core.org_classifications (org_id, taxonomy_id)
SELECT o.id, t.id
FROM public.organizations o
JOIN core.taxonomy t ON t.slug = CASE
  WHEN lower(o.org_category) LIKE '%soccer%'     THEN 'youth-sports-soccer'
  WHEN lower(o.org_category) LIKE '%hockey%'     THEN 'youth-sports-hockey'
  WHEN lower(o.org_category) LIKE '%lacrosse%'   THEN 'youth-sports-lacrosse'
  WHEN lower(o.org_category) LIKE '%basketball%' THEN 'youth-sports-basketball'
  WHEN lower(o.org_category) LIKE '%venture%'    THEN 'finance-vc'
  WHEN lower(o.org_category) LIKE '%angel%'      THEN 'finance-angel'
  WHEN lower(o.org_category) LIKE '%church%'     THEN 'faith-church'
  ELSE NULL
END
WHERE o.org_category IS NOT NULL
ON CONFLICT (org_id, taxonomy_id) DO NOTHING;

-- ===== 8b. contacts → core.contacts =====
-- CORRECTED: source table has `name` (single), `title` (not `role`), no `owner_user_id`
INSERT INTO core.contacts (
  id, first_name, last_name, email, phone, role,
  notes, avatar_url, source, owner_user_id, created_at, updated_at
)
SELECT
  id,
  split_part(name, ' ', 1),
  CASE WHEN position(' ' in COALESCE(name, '')) > 0
       THEN substring(name from position(' ' in name) + 1)
       ELSE NULL
  END,
  email,
  phone,
  title,        -- mapped to `role` in new schema
  notes,
  avatar_url,
  source,
  NULL,          -- owner_user_id does not exist in source
  created_at,
  updated_at
FROM public.contacts
ON CONFLICT (id) DO NOTHING;

-- ===== 8c. organization_contacts → core.relationships =====
-- CORRECTED: source has `organization_id` not `org_id`, and has `role` column
INSERT INTO core.relationships (org_id, contact_id, relationship_type, created_at)
SELECT organization_id, contact_id, COALESCE(role, 'member'), created_at
FROM public.organization_contacts
ON CONFLICT (org_id, contact_id, relationship_type) DO NOTHING;

-- ===== 8d. investor profiles → intel.investor_profile =====
INSERT INTO intel.investor_profile (
  org_id, fund_type, investor_type, check_size, sector_focus,
  portfolio_url, notable_investments, primary_contact, firm_name
)
SELECT
  id,
  fund_type,
  investor_type,
  check_size,
  sector_focus,
  portfolio_url,
  notable_investments,
  primary_contact,
  firm_name
FROM public.organizations
WHERE fund_type IS NOT NULL OR investor_type IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;

-- ===== 8e. partner profiles → intel.partner_profile =====
INSERT INTO intel.partner_profile (org_id, partner_status, partner_since, revenue_share)
SELECT id, partner_status, partner_since, NULL AS revenue_share
FROM public.organizations
WHERE partner_status IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;

-- ===== 8f. financials → intel.org_financials =====
INSERT INTO intel.org_financials (
  org_id, players, travel_teams, dues_per_season, dues_revenue,
  uniform_cost, total_revenue, gross_revenue, total_costs, yearly_cost_player
)
SELECT
  id, players, travel_teams, dues_per_season, dues_revenue,
  uniform_cost, total_revenue, gross_revenue, total_costs, yearly_cost_player
FROM public.organizations
WHERE players IS NOT NULL OR dues_revenue IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;

-- ===== 8g. store data → platform.store =====
INSERT INTO platform.store (org_id, store_status, store_provider, merch_link)
SELECT id, store_status, store_provider, merch_link
FROM public.organizations
WHERE store_status IS NOT NULL OR merch_link IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;

-- ===== 8h. pipeline → crm.pipeline =====
INSERT INTO crm.pipeline (
  org_id, pipeline_type, status, likelihood_score,
  connection_status, lifecycle_status, next_action,
  next_action_date, last_contact_date
)
SELECT
  id,
  CASE
    WHEN fund_type IS NOT NULL THEN 'investor'
    WHEN partner_status IS NOT NULL THEN 'partner'
    ELSE 'customer'
  END,
  pipeline_status,
  likelihood_score,
  connection_status,
  lifecycle_status,
  next_action,
  next_action_date,
  last_contact_date
FROM public.organizations
WHERE pipeline_status IS NOT NULL OR connection_status IS NOT NULL
ON CONFLICT (org_id, pipeline_type) DO NOTHING;

-- ===== 8i. outreach → crm.outreach =====
INSERT INTO crm.outreach (org_id, channel, status, outreach_date, notes)
SELECT id, 'unknown', outreach_status, last_outreach_date, outreach_notes
FROM public.organizations
WHERE outreach_status IS NOT NULL
ON CONFLICT (org_id, contact_id, channel, outreach_date) DO NOTHING;

-- ===== 8j. league memberships → platform.memberships =====
DO $$
DECLARE
  league_map JSONB := '{
    "in_bays": "BAYS",
    "in_cmysl": "CMYSL",
    "in_cysl": "CYSL",
    "in_ecnl": "ECNL",
    "in_ecysa": "ECYSA",
    "in_mysl": "MYSL",
    "in_nashoba": "Nashoba",
    "in_necsl": "NECSL",
    "in_roots": "Roots",
    "in_south_coast": "South Coast",
    "in_south_shore": "South Shore"
  }';
  league_key TEXT;
  league_name TEXT;
  league_id UUID;
BEGIN
  FOR league_key, league_name IN SELECT * FROM jsonb_each_text(league_map)
  LOOP
    SELECT id INTO league_id FROM public.leagues WHERE name = league_name LIMIT 1;
    IF league_id IS NULL THEN
      INSERT INTO public.leagues (name) VALUES (league_name) RETURNING id INTO league_id;
    END IF;
    EXECUTE format('
      INSERT INTO platform.memberships (org_id, league_id)
      SELECT id, $1
      FROM public.organizations
      WHERE %I = true
      ON CONFLICT DO NOTHING
    ', league_key) USING league_id;
  END LOOP;
END $$;

-- ===== 8k. opportunities → crm.opportunities =====
-- CORRECTED: source has `organization_id` not `org_id`, `deal_type` not `type`, no `contact_id`
INSERT INTO crm.opportunities (
  id, org_id, contact_id, opportunity_type, value,
  stage, probability, notes, created_at, updated_at
)
SELECT
  id, organization_id, NULL, deal_type, value,
  stage, probability, notes, created_at, updated_at
FROM public.opportunities
ON CONFLICT (id) DO NOTHING;

-- ===== 8l. correspondence → brain.correspondence =====
-- CORRECTED: source already has entity_id/entity_type (polymorphic),
-- uses `source` not `channel`, `snippet` not `body`,
-- `sender_email`/`recipient_email` not `from_address`/`to_address`,
-- `email_date` not `sent_at`
INSERT INTO brain.correspondence (
  id, entity_id, entity_type, channel, direction,
  subject, body, from_address, to_address, sent_at, created_at
)
SELECT
  id, entity_id, entity_type, source, direction,
  subject, snippet, sender_email, recipient_email, email_date, created_at
FROM public.correspondence
ON CONFLICT (id) DO NOTHING;

-- ===== 8m. tasks → brain.tasks =====
-- CORRECTED: source already has entity_id/entity_type, uses `assigned_to` not `owner_user_id`
INSERT INTO brain.tasks (
  id, title, description, entity_id, entity_type,
  status, priority, due_date, owner_user_id, created_at, updated_at
)
SELECT
  id, title, description, entity_id, entity_type,
  status, priority, due_date, assigned_to, created_at, updated_at
FROM public.tasks
ON CONFLICT (id) DO NOTHING;

-- ===== 8n. knowledge_base (non-news) → brain.knowledge =====
-- CORRECTED: source uses `entity_ids` (not `entity_id`), `content_text` (not `content`),
-- `source_type` (not `source`), no `entity_type`
-- Only migrate non-news rows. News stays in public.knowledge_base permanently.
INSERT INTO brain.knowledge (
  id, entity_id, entity_type, content, source, tags, created_at, updated_at
)
SELECT
  id,
  entity_ids[1],    -- take first entity from array
  NULL,              -- entity_type not in source
  content_text,
  source_type,
  tags,
  created_at,
  updated_at
FROM public.knowledge_base
WHERE source_type != 'news'
ON CONFLICT (id) DO NOTHING;

-- ===== 8o. agent_runs → brain.agent_runs =====
-- CORRECTED: source has `agent_name` (not `agent_id`), `error_message` (not `error`),
-- no `input`/`output` columns, has `records_processed`/`records_updated` instead
INSERT INTO brain.agent_runs (
  id, agent_name, status, error, started_at, completed_at, created_at
)
SELECT
  id, agent_name, status, error_message, started_at, completed_at,
  COALESCE(started_at, now())
FROM public.agent_runs
ON CONFLICT (id) DO NOTHING;
