-- =====================================================================
-- Step 14: Entity Intelligence — Phase 1
-- Adds confidence/KCS/provenance tracking to core entities
-- Creates brain.entity_provenance and brain.enrichment_queue tables
-- =====================================================================

-- ===== 14A: ENTITY INTELLIGENCE COLUMNS ON ORGANIZATIONS =====

ALTER TABLE core.organizations
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS knowledge_completeness_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_priority TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_gaps TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_source TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- ===== 14B: ENTITY INTELLIGENCE COLUMNS ON CONTACTS =====

ALTER TABLE core.contacts
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS knowledge_completeness_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_priority TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_gaps TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_source TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- ===== 14C: ENTITY PROVENANCE TABLE =====

CREATE TABLE IF NOT EXISTS brain.entity_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,              -- 'organizations' or 'contacts'
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,               -- which field this provenance covers
  field_value TEXT,                       -- the value at time of recording
  source_type TEXT NOT NULL,              -- scanner, upload, enrichment, derived, manual, correction
  source_ref TEXT,                        -- reference to specific event/document/scan
  source_trust TEXT DEFAULT 'medium',     -- high, medium, low
  confidence FLOAT DEFAULT 0.5,
  captured_at TIMESTAMPTZ DEFAULT now(),
  supersedes UUID REFERENCES brain.entity_provenance(id)
);

CREATE INDEX IF NOT EXISTS idx_provenance_entity
  ON brain.entity_provenance(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_provenance_field
  ON brain.entity_provenance(entity_type, entity_id, field_name);

CREATE INDEX IF NOT EXISTS idx_provenance_captured
  ON brain.entity_provenance(captured_at DESC);

-- ===== 14D: ENRICHMENT QUEUE TABLE =====

CREATE TABLE IF NOT EXISTS brain.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  scanner_type TEXT NOT NULL,             -- web, social, registry, news
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',          -- pending, running, completed, failed
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  result JSONB,
  fields_updated TEXT[],
  kcs_before FLOAT,
  kcs_after FLOAT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status
  ON brain.enrichment_queue(status, priority);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_entity
  ON brain.enrichment_queue(entity_type, entity_id);

-- ===== 14E: RLS POLICIES =====

ALTER TABLE brain.entity_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_provenance" ON brain.entity_provenance
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_provenance" ON brain.entity_provenance
  FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE brain.enrichment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_enrichment_queue" ON brain.enrichment_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_enrichment_queue" ON brain.enrichment_queue
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_enrichment_queue" ON brain.enrichment_queue
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ===== 14F: BACKFILL created_source FROM EXISTING source COLUMN =====

UPDATE core.organizations
  SET created_source = COALESCE(source, 'manual')
  WHERE created_source IS NULL;

UPDATE core.contacts
  SET created_source = COALESCE(source, 'manual')
  WHERE created_source IS NULL;
