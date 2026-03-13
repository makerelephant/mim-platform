-- ============================================================================
-- Acumen Decision Log — Add classification scoring & CEO review fields
-- ============================================================================
-- Extends brain.classification_log with Acumen category assignment,
-- importance scoring, reasoning capture, and CEO review workflow.
-- Run this in Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- 1. Acumen classification fields
ALTER TABLE classification_log
  ADD COLUMN IF NOT EXISTS acumen_category TEXT,
  ADD COLUMN IF NOT EXISTS importance_level TEXT,
  ADD COLUMN IF NOT EXISTS acumen_reasoning TEXT;

-- 2. CEO review fields
ALTER TABLE classification_log
  ADD COLUMN IF NOT EXISTS ceo_review_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ceo_correct_category TEXT,
  ADD COLUMN IF NOT EXISTS ceo_correct_importance TEXT,
  ADD COLUMN IF NOT EXISTS ceo_reviewed_at TIMESTAMPTZ;

-- 3. Indexes for review workflow
CREATE INDEX IF NOT EXISTS idx_classification_log_acumen_category
  ON classification_log(acumen_category) WHERE acumen_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classification_log_review_status
  ON classification_log(ceo_review_status) WHERE ceo_review_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classification_log_review_pending
  ON classification_log(created_at DESC) WHERE ceo_review_status = 'pending' AND pre_filter_result = 'passed';

-- 4. Validate allowed values via check constraints
ALTER TABLE classification_log
  ADD CONSTRAINT chk_acumen_category CHECK (
    acumen_category IS NULL OR acumen_category IN (
      'legal', 'customer-partner-ops', 'accounting-finance',
      'scheduling', 'fundraising', 'product-engineering',
      'ux-design', 'marketing', 'ai', 'family', 'administration'
    )
  );

ALTER TABLE classification_log
  ADD CONSTRAINT chk_importance_level CHECK (
    importance_level IS NULL OR importance_level IN ('high', 'medium', 'low')
  );

ALTER TABLE classification_log
  ADD CONSTRAINT chk_ceo_review_status CHECK (
    ceo_review_status IS NULL OR ceo_review_status IN ('pending', 'correct', 'incorrect', 'partial')
  );

COMMIT;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'classification_log'
  AND column_name IN ('acumen_category', 'importance_level', 'acumen_reasoning', 'ceo_review_status', 'ceo_correct_category', 'ceo_correct_importance', 'ceo_reviewed_at');
