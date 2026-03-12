-- Steps 9-13: Database Hardening
-- Validation, cleanup, triggers, RLS, indexes
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS throughout

-- ===== STEP 9: VALIDATE MIGRATION =====
-- Run counts — new tables should have >= old table counts

SELECT 'core.organizations' AS table_name, COUNT(*) AS row_count FROM core.organizations
UNION ALL SELECT 'core.org_types', COUNT(*) FROM core.org_types
UNION ALL SELECT 'core.taxonomy', COUNT(*) FROM core.taxonomy
UNION ALL SELECT 'core.org_classifications', COUNT(*) FROM core.org_classifications
UNION ALL SELECT 'core.contacts', COUNT(*) FROM core.contacts
UNION ALL SELECT 'core.relationships', COUNT(*) FROM core.relationships

-- CRM
UNION ALL SELECT 'crm.pipeline', COUNT(*) FROM crm.pipeline
UNION ALL SELECT 'crm.outreach', COUNT(*) FROM crm.outreach
UNION ALL SELECT 'crm.opportunities', COUNT(*) FROM crm.opportunities

-- Intel
UNION ALL SELECT 'intel.investor_profile', COUNT(*) FROM intel.investor_profile
UNION ALL SELECT 'intel.org_financials', COUNT(*) FROM intel.org_financials
UNION ALL SELECT 'intel.partner_profile', COUNT(*) FROM intel.partner_profile

-- Platform
UNION ALL SELECT 'platform.store', COUNT(*) FROM platform.store
UNION ALL SELECT 'platform.memberships', COUNT(*) FROM platform.memberships

-- Brain
UNION ALL SELECT 'brain.tasks', COUNT(*) FROM brain.tasks
UNION ALL SELECT 'brain.correspondence', COUNT(*) FROM brain.correspondence
UNION ALL SELECT 'brain.knowledge', COUNT(*) FROM brain.knowledge
UNION ALL SELECT 'brain.agent_runs', COUNT(*) FROM brain.agent_runs

-- New identity tables (should exist even if empty)
UNION ALL SELECT 'brain.ceo_context', COUNT(*) FROM brain.ceo_context
UNION ALL SELECT 'core.team_members', COUNT(*) FROM core.team_members
UNION ALL SELECT 'platform.user_context', COUNT(*) FROM platform.user_context;

-- ===== STEP 10: DROP DEAD WEIGHT =====
-- Only backup tables and unused junctions

-- Backup tables (all data already in new schema or irrelevant)
DROP TABLE IF EXISTS public.investor_contacts_backup;
DROP TABLE IF EXISTS public.investors_backup;
DROP TABLE IF EXISTS public.soccer_orgs_backup;
DROP TABLE IF EXISTS public.soccer_org_contacts_backup;
DROP TABLE IF EXISTS public.task_investors_backup;
DROP TABLE IF EXISTS public.task_soccer_orgs_backup;

-- Empty junction tables (never used)
DROP TABLE IF EXISTS public.task_contacts;
DROP TABLE IF EXISTS public.task_organizations;

-- Superseded by new schema
DROP TABLE IF EXISTS public.market_map_contacts;
DROP TABLE IF EXISTS public.org_community_relationships;
DROP TABLE IF EXISTS public.org_leagues;  -- replaced by platform.memberships
DROP TABLE IF EXISTS public.organization_contacts;  -- replaced by core.relationships

-- ===== STEP 11: ADD updated_at TRIGGERS =====

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('core','crm','intel','platform','brain')
  LOOP
    -- Check if updated_at column exists on this table
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = t.schemaname
      AND table_name = t.tablename
      AND column_name = 'updated_at'
    ) THEN
      EXECUTE format('
        DROP TRIGGER IF EXISTS set_updated_at ON %I.%I;
        CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I.%I
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      ', t.schemaname, t.tablename, t.schemaname, t.tablename);
    END IF;
  END LOOP;
END $$;

-- ===== STEP 12: ENABLE RLS ON NEW SCHEMAS =====

-- Core
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.org_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.org_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.team_members ENABLE ROW LEVEL SECURITY;

-- CRM
ALTER TABLE crm.pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.opportunities ENABLE ROW LEVEL SECURITY;

-- Intel
ALTER TABLE intel.investor_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel.partner_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE intel.org_financials ENABLE ROW LEVEL SECURITY;

-- Platform
ALTER TABLE platform.store ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.user_context ENABLE ROW LEVEL SECURITY;

-- Brain
ALTER TABLE brain.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain.activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain.knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain.correspondence ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain.ceo_context ENABLE ROW LEVEL SECURITY;

-- Authenticated users get full access (tighten per-role later)
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('core','crm','intel','platform','brain')
  LOOP
    -- Drop existing policy if it exists, then create
    BEGIN
      EXECUTE format('
        DROP POLICY IF EXISTS "authenticated_all" ON %I.%I
      ', t.schemaname, t.tablename);
      EXECUTE format('
        CREATE POLICY "authenticated_all" ON %I.%I
        FOR ALL TO authenticated USING (true) WITH CHECK (true)
      ', t.schemaname, t.tablename);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping policy for %.%: %', t.schemaname, t.tablename, SQLERRM;
    END;
  END LOOP;
END $$;

-- ===== STEP 13: ADD INDEXES =====
-- Use IF NOT EXISTS where possible, wrap in exception handler otherwise

-- Core lookups
CREATE INDEX IF NOT EXISTS idx_orgs_parent ON core.organizations(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON core.contacts(email);
CREATE INDEX IF NOT EXISTS idx_rels_org ON core.relationships(org_id);
CREATE INDEX IF NOT EXISTS idx_rels_contact ON core.relationships(contact_id);
CREATE INDEX IF NOT EXISTS idx_org_types_org ON core.org_types(org_id);
CREATE INDEX IF NOT EXISTS idx_org_types_type ON core.org_types(type);
CREATE INDEX IF NOT EXISTS idx_org_class_org ON core.org_classifications(org_id);
CREATE INDEX IF NOT EXISTS idx_org_class_tax ON core.org_classifications(taxonomy_id);

-- CRM
CREATE INDEX IF NOT EXISTS idx_pipeline_org ON crm.pipeline(org_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_type ON crm.pipeline(pipeline_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_next ON crm.pipeline(next_action_date);
CREATE INDEX IF NOT EXISTS idx_opps_org ON crm.opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opps_stage ON crm.opportunities(stage);

-- Brain
CREATE INDEX IF NOT EXISTS idx_tasks_entity ON brain.tasks(entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON brain.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON brain.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON brain.activity(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON brain.activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corr_entity ON brain.correspondence(entity_id);
