-- step-14-entity-intelligence.sql
-- Adds KCS (Knowledge Completeness Score) columns to organizations and contacts.
-- The brain.entity_provenance and brain.enrichment_queue tables already exist.
-- This migration adds the missing ALTER TABLE columns.
--
-- Run in Supabase SQL Editor.

-- ─── Organizations KCS Columns ──────────────────────────────────────────────

ALTER TABLE core.organizations
  ADD COLUMN IF NOT EXISTS knowledge_completeness_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_gaps TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enrichment_priority TEXT DEFAULT 'none';

COMMENT ON COLUMN core.organizations.knowledge_completeness_score IS 'KCS: 0.0-1.0, computed by entity-intelligence.ts';
COMMENT ON COLUMN core.organizations.enrichment_gaps IS 'Array of field names that are empty/missing';
COMMENT ON COLUMN core.organizations.enrichment_priority IS 'high/medium/low/none — derived from KCS';

-- ─── Contacts KCS Columns ───────────────────────────────────────────────────

ALTER TABLE core.contacts
  ADD COLUMN IF NOT EXISTS knowledge_completeness_score FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_gaps TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS enrichment_priority TEXT DEFAULT 'none';

COMMENT ON COLUMN core.contacts.knowledge_completeness_score IS 'KCS: 0.0-1.0, computed by entity-intelligence.ts';
COMMENT ON COLUMN core.contacts.enrichment_gaps IS 'Array of field names that are empty/missing';
COMMENT ON COLUMN core.contacts.enrichment_priority IS 'high/medium/low/none — derived from KCS';
