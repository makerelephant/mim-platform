-- Steps 2-7: Create all tables across all schemas
-- Safe to re-run: uses CREATE TABLE (will error if exists, but that's OK)

-- ===== STEP 2: CORE TABLES =====

CREATE TABLE core.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  address TEXT,
  location TEXT,
  geography TEXT,
  avatar_url TEXT,
  description TEXT,
  notes TEXT,
  corporate_structure TEXT,
  parent_org_id UUID REFERENCES core.organizations(id),
  owner_user_id TEXT,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE core.org_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  since DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, type)
);

CREATE TABLE core.taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES core.taxonomy(id),
  depth INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON core.taxonomy(parent_id);
CREATE INDEX ON core.taxonomy(slug);

CREATE TABLE core.org_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
  taxonomy_id UUID REFERENCES core.taxonomy(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, taxonomy_id)
);

-- Taxonomy seed data
INSERT INTO core.taxonomy (name, slug, depth, sort_order) VALUES
  ('Youth Sports',  'youth-sports',  0, 1),
  ('Faith',         'faith',         0, 2),
  ('Gaming',        'gaming',        0, 3),
  ('Music',         'music',         0, 4),
  ('Education',     'education',     0, 5),
  ('Civic',         'civic',         0, 6),
  ('Corporate',     'corporate',     0, 7),
  ('Finance',       'finance',       0, 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO core.taxonomy (name, slug, parent_id, depth, sort_order)
SELECT sub.name, sub.slug, p.id, 1, sub.sort_order
FROM (VALUES
  ('Soccer',     'youth-sports-soccer',      1),
  ('Hockey',     'youth-sports-hockey',      2),
  ('Lacrosse',   'youth-sports-lacrosse',    3),
  ('Basketball', 'youth-sports-basketball',  4),
  ('Volleyball', 'youth-sports-volleyball',  5),
  ('Baseball',   'youth-sports-baseball',    6)
) AS sub(name, slug, sort_order)
CROSS JOIN core.taxonomy p
WHERE p.slug = 'youth-sports'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO core.taxonomy (name, slug, parent_id, depth, sort_order)
SELECT sub.name, sub.slug, p.id, 1, sub.sort_order
FROM (VALUES
  ('Venture Capital', 'finance-vc',     1),
  ('Angel',           'finance-angel',  2),
  ('Family Office',   'finance-fo',     3),
  ('Private Equity',  'finance-pe',     4)
) AS sub(name, slug, sort_order)
CROSS JOIN core.taxonomy p
WHERE p.slug = 'finance'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO core.taxonomy (name, slug, parent_id, depth, sort_order)
SELECT sub.name, sub.slug, p.id, 1, sub.sort_order
FROM (VALUES
  ('Church',  'faith-church',  1),
  ('Mosque',  'faith-mosque',  2),
  ('Temple',  'faith-temple',  3)
) AS sub(name, slug, sort_order)
CROSS JOIN core.taxonomy p
WHERE p.slug = 'faith'
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE core.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  notes TEXT,
  avatar_url TEXT,
  source TEXT,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE core.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES core.contacts(id) ON DELETE CASCADE,
  relationship_type TEXT,
  since DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, contact_id, relationship_type)
);

-- ===== STEP 3: CRM TABLES =====

CREATE TABLE crm.pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
  pipeline_type TEXT NOT NULL,
  status TEXT,
  likelihood_score INTEGER,
  connection_status TEXT,
  lifecycle_status TEXT,
  next_action TEXT,
  next_action_date DATE,
  last_contact_date DATE,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, pipeline_type)
);

CREATE TABLE crm.outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES core.contacts(id),
  channel TEXT,
  status TEXT,
  outreach_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, contact_id, channel, outreach_date)
);

CREATE TABLE crm.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES core.contacts(id),
  opportunity_type TEXT,
  value NUMERIC,
  stage TEXT,
  probability INTEGER,
  close_date DATE,
  notes TEXT,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== STEP 4: INTEL TABLES =====

CREATE TABLE intel.investor_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE REFERENCES core.organizations(id) ON DELETE CASCADE,
  fund_type TEXT,
  investor_type TEXT,
  check_size TEXT,
  sector_focus TEXT,
  portfolio_url TEXT,
  notable_investments TEXT,
  primary_contact TEXT,
  firm_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE intel.partner_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE REFERENCES core.organizations(id) ON DELETE CASCADE,
  partner_status TEXT,
  partner_since DATE,
  revenue_share NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE intel.org_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE REFERENCES core.organizations(id) ON DELETE CASCADE,
  players INTEGER,
  travel_teams INTEGER,
  dues_per_season NUMERIC,
  dues_revenue NUMERIC,
  uniform_cost NUMERIC,
  total_revenue NUMERIC,
  gross_revenue NUMERIC,
  total_costs NUMERIC,
  yearly_cost_player NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== STEP 5: PLATFORM TABLES =====

CREATE TABLE platform.store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE REFERENCES core.organizations(id) ON DELETE CASCADE,
  store_status TEXT,
  store_provider TEXT,
  merch_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE platform.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES core.organizations(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  joined_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, league_id)
);

-- ===== STEP 6: IDENTITY TABLES =====

CREATE TABLE brain.ceo_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT,
  context_type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'unread',
  entity_id UUID,
  entity_type TEXT,
  metadata JSONB,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON brain.ceo_context(context_type);
CREATE INDEX ON brain.ceo_context(status);
CREATE INDEX ON brain.ceo_context(created_at DESC);
CREATE INDEX ON brain.ceo_context(entity_id);

CREATE TABLE core.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  permissions JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  joined_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON core.team_members(auth_user_id);
CREATE INDEX ON core.team_members(role);

CREATE TABLE platform.user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  community_id UUID REFERENCES core.organizations(id),
  onboarding_status TEXT DEFAULT 'pending',
  drops_created INTEGER DEFAULT 0,
  drops_purchased INTEGER DEFAULT 0,
  referral_source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON platform.user_context(auth_user_id);
CREATE INDEX ON platform.user_context(community_id);

-- ===== STEP 7: BRAIN TABLES =====

CREATE TABLE brain.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  entity_id UUID,
  entity_type TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE brain.activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE brain.knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID,
  entity_type TEXT,
  content TEXT NOT NULL,
  source TEXT,
  tags TEXT[],
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE brain.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID,
  agent_name TEXT,
  status TEXT DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE brain.correspondence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID,
  entity_type TEXT,
  channel TEXT,
  direction TEXT,
  subject TEXT,
  body TEXT,
  from_address TEXT,
  to_address TEXT,
  sent_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
