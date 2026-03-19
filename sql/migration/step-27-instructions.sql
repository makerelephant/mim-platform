-- Step 27: brain.instructions
-- CEO standing orders, report directives, entity watches, and behavioral rules.
-- Referenced by instruction-loader.ts, behavioral-rules.ts, and brain/ask route.
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

BEGIN;

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain.instructions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Instruction definition
  type                text        NOT NULL,               -- 'standing_order', 'report_inclusion', 'entity_watch', 'behavioral_rule'
  prompt              text        NOT NULL,               -- natural-language instruction injected into classifier/report prompts
  status              text        NOT NULL DEFAULT 'active', -- 'active', 'fulfilled'

  -- Scoping (all nullable — null means applies globally)
  source_kb_ids       uuid[],                             -- restrict to specific knowledge base entries
  source_entity_ids   uuid[],                             -- restrict to specific entities
  taxonomy_categories text[],                             -- restrict to specific taxonomy categories

  -- Execution tracking
  recurrence          text,                               -- 'on_scan', 'once', 'daily', etc.
  execution_count     integer     NOT NULL DEFAULT 0,
  last_executed_at    timestamptz,
  execution_result    jsonb,                              -- result payload from last execution

  -- Behavioral rule metadata (used when type = 'behavioral_rule')
  metadata            jsonb       DEFAULT '{}'::jsonb,    -- pattern_key, rule_type, from_value, to_value, occurrences, etc.

  -- Timestamps
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ─── Constraints ──────────────────────────────────────────────────────────────

ALTER TABLE brain.instructions
  ADD CONSTRAINT chk_instr_type CHECK (
    type IN ('standing_order', 'report_inclusion', 'entity_watch', 'behavioral_rule')
  );

ALTER TABLE brain.instructions
  ADD CONSTRAINT chk_instr_status CHECK (
    status IN ('active', 'fulfilled')
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Primary lookup: active instructions by type (used by loadStandingOrders, loadBehavioralRules)
CREATE INDEX IF NOT EXISTS idx_instr_active_type
  ON brain.instructions(type, status) WHERE status = 'active';

-- Recurrence filter (on_scan standing orders)
CREATE INDEX IF NOT EXISTS idx_instr_active_recurrence
  ON brain.instructions(type, recurrence) WHERE status = 'active';

-- ─── Updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION brain.update_instructions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_instructions_updated_at ON brain.instructions;
CREATE TRIGGER trg_instructions_updated_at
  BEFORE UPDATE ON brain.instructions
  FOR EACH ROW EXECUTE FUNCTION brain.update_instructions_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE brain.instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_instructions" ON brain.instructions
  FOR SELECT TO anon USING (true);

CREATE POLICY "service_all_instructions" ON brain.instructions
  FOR ALL USING (true) WITH CHECK (true);

COMMIT;

-- After running this, execute:
-- NOTIFY pgrst, 'reload schema';
