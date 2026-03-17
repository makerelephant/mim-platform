-- step-21-entity-intelligence.sql
-- Phase 1: Entity Intelligence Layer
--
-- Adds missing intelligence columns to core.organizations and core.contacts,
-- creates brain.entity_provenance table (field-level provenance tracking),
-- and creates brain.enrichment_queue table (autonomous enrichment jobs).
--
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.
-- Run in Supabase SQL Editor.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ORGANIZATIONS — add intelligence columns
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE core.organizations
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS knowledge_completeness_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_priority TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_gaps TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_source TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

COMMENT ON COLUMN core.organizations.confidence_score IS 'Aggregate confidence in entity identity (0.0-1.0)';
COMMENT ON COLUMN core.organizations.knowledge_completeness_score IS 'KCS: 0.0-1.0, computed by entity-intelligence.ts';
COMMENT ON COLUMN core.organizations.enrichment_priority IS 'high/medium/low/none — derived from KCS';
COMMENT ON COLUMN core.organizations.last_enriched_at IS 'Last time this entity was enriched from an external source';
COMMENT ON COLUMN core.organizations.enrichment_gaps IS 'Array of field names that are empty/missing';
COMMENT ON COLUMN core.organizations.created_source IS 'How this entity entered the system (gmail-scanner, manual, import, etc)';
COMMENT ON COLUMN core.organizations.verified IS 'Whether entity identity has been CEO-verified';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CONTACTS — add same intelligence columns
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE core.contacts
  ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS knowledge_completeness_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_priority TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_gaps TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_source TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

COMMENT ON COLUMN core.contacts.confidence_score IS 'Aggregate confidence in entity identity (0.0-1.0)';
COMMENT ON COLUMN core.contacts.knowledge_completeness_score IS 'KCS: 0.0-1.0, computed by entity-intelligence.ts';
COMMENT ON COLUMN core.contacts.enrichment_priority IS 'high/medium/low/none — derived from KCS';
COMMENT ON COLUMN core.contacts.last_enriched_at IS 'Last time this entity was enriched from an external source';
COMMENT ON COLUMN core.contacts.enrichment_gaps IS 'Array of field names that are empty/missing';
COMMENT ON COLUMN core.contacts.created_source IS 'How this entity entered the system (gmail-scanner, manual, import, etc)';
COMMENT ON COLUMN core.contacts.verified IS 'Whether entity identity has been CEO-verified';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ENTITY PROVENANCE — field-level provenance tracking (architecture v2 §7.2)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brain.entity_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,                -- 'organizations', 'contacts'
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,                 -- which field this provenance covers
  field_value TEXT,                         -- the value at time of recording
  source_type TEXT NOT NULL,                -- scanner, upload, enrichment, derived, manual, correction
  source_ref TEXT,                          -- reference to specific event/document
  source_trust TEXT DEFAULT 'medium',       -- high, medium, low
  confidence FLOAT DEFAULT 0.5,
  captured_at TIMESTAMPTZ DEFAULT now(),
  supersedes UUID REFERENCES brain.entity_provenance(id)
);

-- Indexes for provenance lookups
CREATE INDEX IF NOT EXISTS idx_entity_provenance_entity
  ON brain.entity_provenance (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_provenance_field
  ON brain.entity_provenance (entity_type, entity_id, field_name);

CREATE INDEX IF NOT EXISTS idx_entity_provenance_captured
  ON brain.entity_provenance (captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_provenance_source
  ON brain.entity_provenance (source_type);

COMMENT ON TABLE brain.entity_provenance IS 'Field-level provenance: tracks where every fact came from, with confidence and audit trail';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ENRICHMENT QUEUE — autonomous enrichment jobs (architecture v2 §7.2)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brain.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,                -- 'organizations', 'contacts'
  entity_id UUID NOT NULL,
  enrichment_type TEXT NOT NULL,            -- 'web_scrape', 'domain_lookup', 'social_search', 'logo_fetch', etc.
  target_fields TEXT[] NOT NULL DEFAULT '{}', -- which fields this job aims to fill
  priority TEXT DEFAULT 'medium',           -- high, medium, low
  status TEXT DEFAULT 'pending',            -- pending, in_progress, completed, failed, skipped
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  result JSONB,                             -- outcome data from enrichment
  error TEXT,                               -- error message if failed
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_after TIMESTAMPTZ DEFAULT now() -- for retry backoff
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status
  ON brain.enrichment_queue (status, priority, scheduled_after);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_entity
  ON brain.enrichment_queue (entity_type, entity_id);

COMMENT ON TABLE brain.enrichment_queue IS 'Queue of autonomous enrichment jobs — system decides what to enrich and when';
