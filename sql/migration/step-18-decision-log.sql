-- Step 18: Decision log for tracking brain decisions and CEO corrections
--
-- Records every classification decision the brain makes and every CEO override.
-- This is the foundation for the feedback loop — the scanner will read recent
-- corrections from this table to improve future classifications.

CREATE TABLE IF NOT EXISTS brain.decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL,              -- classification, enrichment, alert, recommendation
  entity_id UUID,
  entity_type TEXT,
  input_summary TEXT,                       -- what the brain was looking at
  decision TEXT NOT NULL,                   -- what it decided
  reasoning TEXT,                           -- why (from Claude response)
  rules_applied UUID[],                     -- behavioral_rules that influenced this (future)
  outcome TEXT,                             -- what actually happened (updated later)
  ceo_override BOOLEAN DEFAULT false,       -- did CEO change the decision
  ceo_correction TEXT,                      -- what CEO changed it to
  created_at TIMESTAMPTZ DEFAULT now(),
  outcome_recorded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_decision_log_type
  ON brain.decision_log(decision_type);

CREATE INDEX IF NOT EXISTS idx_decision_log_entity
  ON brain.decision_log(entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_log_override
  ON brain.decision_log(ceo_override)
  WHERE ceo_override = true;

CREATE INDEX IF NOT EXISTS idx_decision_log_created
  ON brain.decision_log(created_at DESC);

NOTIFY pgrst, 'reload schema';
