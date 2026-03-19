-- Step 28: Dedicated behavioral_rules table for the learning pipeline
-- Corrections are tracked in decision_log. This table holds the SYNTHESIZED rules
-- that actually change future classification behavior.

CREATE TABLE IF NOT EXISTS brain.behavioral_rules (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_type       text        NOT NULL CHECK (rule_type IN ('category_change', 'priority_change', 'suppress', 'custom')),
  category        text,                          -- acumen category this rule targets (nullable for cross-category rules)
  rule_text       text        NOT NULL,          -- the natural-language rule injected into classifier prompts
  source_corrections jsonb   NOT NULL DEFAULT '[]'::jsonb,  -- array of { correction_id, ceo_correction, created_at }
  confidence      numeric     NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast loading of active rules during classification
CREATE INDEX IF NOT EXISTS idx_behavioral_rules_active
  ON brain.behavioral_rules (active) WHERE active = true;

-- Index for dedup by rule_type + category
CREATE INDEX IF NOT EXISTS idx_behavioral_rules_type_cat
  ON brain.behavioral_rules (rule_type, category);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION brain.update_behavioral_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_behavioral_rules_updated ON brain.behavioral_rules;
CREATE TRIGGER trg_behavioral_rules_updated
  BEFORE UPDATE ON brain.behavioral_rules
  FOR EACH ROW EXECUTE FUNCTION brain.update_behavioral_rules_timestamp();

-- RLS: service role only (brain tables are server-side)
ALTER TABLE brain.behavioral_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY behavioral_rules_service_all ON brain.behavioral_rules
  FOR ALL USING (true) WITH CHECK (true);

-- Migrate any existing behavioral rules from brain.instructions into the new table
INSERT INTO brain.behavioral_rules (rule_type, category, rule_text, source_corrections, confidence, active)
SELECT
  COALESCE((metadata->>'rule_type')::text, 'custom') as rule_type,
  (metadata->>'from_value')::text as category,
  prompt as rule_text,
  COALESCE(
    jsonb_build_array(
      jsonb_build_object(
        'pattern_key', metadata->>'pattern_key',
        'from_value', metadata->>'from_value',
        'to_value', metadata->>'to_value',
        'occurrences', (metadata->>'occurrences')::int,
        'synthesized_at', metadata->>'synthesized_at'
      )
    ),
    '[]'::jsonb
  ) as source_corrections,
  0.8 as confidence,
  (status = 'active') as active
FROM brain.instructions
WHERE type = 'behavioral_rule'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE brain.behavioral_rules IS 'Synthesized behavioral rules from CEO corrections. Injected into classifier prompts to change future classification behavior.';
