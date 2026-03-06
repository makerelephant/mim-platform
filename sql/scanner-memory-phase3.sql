-- ============================================================
-- Gopher Memory & Intelligence — Phase 3
-- Entity feedback table + task tracking columns
-- Run this in Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Entity feedback summary: aggregated user signals per entity
CREATE TABLE IF NOT EXISTS entity_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  -- Aggregated signals
  total_tasks_created INTEGER DEFAULT 0,
  tasks_starred INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_ignored INTEGER DEFAULT 0,
  tasks_manually_edited INTEGER DEFAULT 0,
  avg_goal_relevance NUMERIC(3,1),
  -- Derived signal
  usefulness_score NUMERIC(3,2),            -- 0.0 to 1.0
  -- Patterns
  common_tags TEXT[],
  typical_priority TEXT,
  -- Timestamps
  computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_feedback_entity
  ON entity_feedback(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_feedback_usefulness
  ON entity_feedback(usefulness_score);

-- 2. RLS policies
ALTER TABLE entity_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to entity_feedback"
  ON entity_feedback FOR SELECT
  USING (true);

CREATE POLICY "Allow service_role full access to entity_feedback"
  ON entity_feedback FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Add tracking column to tasks for feedback signal
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN DEFAULT false;

COMMIT;

-- Verify
SELECT 'entity_feedback' as table_name, count(*) as rows FROM entity_feedback;
