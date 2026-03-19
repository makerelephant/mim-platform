-- Step 26: brain.classification_log
-- Classification audit log for every scanner classifier call.
-- Previously defined in scanner-memory-phase1.sql (public schema) and
-- extended by acumen-decision-log.sql. This migration creates it properly
-- in the brain schema with all columns the codebase expects.
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

BEGIN;

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain.classification_log (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source tracking
  source                text        NOT NULL,              -- 'gmail', 'slack'
  source_message_id     text        NOT NULL,              -- gmail message_id or slack_channelId_ts
  thread_id             text,                              -- gmail thread_id or slack thread_ts

  -- Entity resolution
  entity_type           text,                              -- 'contacts', 'organizations'
  entity_id             uuid,
  entity_name           text,

  -- Message metadata
  from_email            text,
  subject               text,

  -- Classification output
  classification_result jsonb,                             -- full JSON from Claude (null if pre-filtered)
  pre_filter_result     text,                              -- 'passed', 'newsletter', 'auto_reply', 'marketing', 'noreply', 'thread_update', 'thread_skip'

  -- Debug / enrichment context
  dossier_summary       text,                              -- entity dossier injected (for debugging)
  feedback_summary      text,                              -- feedback injected (for debugging)

  -- Token usage
  prompt_tokens         integer,
  completion_tokens     integer,
  model                 text,

  -- Acumen classification (decision logging)
  acumen_category       text,                              -- e.g. 'legal', 'fundraising', 'product-engineering'
  importance_level      text,                              -- 'high', 'medium', 'low'
  acumen_reasoning      text,                              -- Claude's reasoning for classification

  -- CEO review workflow
  ceo_review_status     text        DEFAULT 'pending',     -- 'pending', 'correct', 'incorrect', 'partial'
  ceo_correct_category  text,                              -- CEO's corrected category
  ceo_correct_importance text,                             -- CEO's corrected importance
  ceo_reviewed_at       timestamptz,

  -- Audit
  agent_run_id          uuid,
  created_at            timestamptz DEFAULT now()
);

-- ─── Constraints ──────────────────────────────────────────────────────────────

ALTER TABLE brain.classification_log
  ADD CONSTRAINT chk_cl_acumen_category CHECK (
    acumen_category IS NULL OR acumen_category IN (
      'legal', 'customer-partner-ops', 'accounting-finance',
      'scheduling', 'fundraising', 'product-engineering',
      'ux-design', 'marketing', 'ai', 'family', 'administration'
    )
  );

ALTER TABLE brain.classification_log
  ADD CONSTRAINT chk_cl_importance_level CHECK (
    importance_level IS NULL OR importance_level IN ('high', 'medium', 'low')
  );

ALTER TABLE brain.classification_log
  ADD CONSTRAINT chk_cl_ceo_review_status CHECK (
    ceo_review_status IS NULL OR ceo_review_status IN ('pending', 'correct', 'incorrect', 'partial')
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cl_source
  ON brain.classification_log(source, source_message_id);

CREATE INDEX IF NOT EXISTS idx_cl_entity
  ON brain.classification_log(entity_id) WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cl_prefilter
  ON brain.classification_log(pre_filter_result);

CREATE INDEX IF NOT EXISTS idx_cl_created
  ON brain.classification_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cl_acumen_category
  ON brain.classification_log(acumen_category) WHERE acumen_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cl_review_status
  ON brain.classification_log(ceo_review_status) WHERE ceo_review_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cl_review_pending
  ON brain.classification_log(created_at DESC)
  WHERE ceo_review_status = 'pending' AND pre_filter_result = 'passed';

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE brain.classification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_classification_log" ON brain.classification_log
  FOR SELECT TO anon USING (true);

CREATE POLICY "service_all_classification_log" ON brain.classification_log
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- After running this, execute:
-- NOTIFY pgrst, 'reload schema';
