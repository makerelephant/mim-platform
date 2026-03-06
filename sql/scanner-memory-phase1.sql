-- ============================================================
-- Gopher Memory & Intelligence — Phase 1
-- Pre-filtering, thread awareness, classification audit log
-- Run this in Supabase SQL Editor
-- ============================================================

BEGIN;

-- 1. Add thread tracking columns to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS thread_id TEXT,
  ADD COLUMN IF NOT EXISTS source_message_id TEXT;

-- Index for thread-based dedup lookups
CREATE INDEX IF NOT EXISTS idx_tasks_thread_id
  ON tasks(thread_id) WHERE thread_id IS NOT NULL;

-- Index for entity+status lookups (dossier open task queries)
CREATE INDEX IF NOT EXISTS idx_tasks_entity_status
  ON tasks(entity_id, status) WHERE entity_id IS NOT NULL;

-- 2. Classification audit log — every classifier call gets recorded
CREATE TABLE IF NOT EXISTS classification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                    -- 'gmail', 'slack'
  source_message_id TEXT NOT NULL,         -- gmail message_id or slack_channelId_ts
  thread_id TEXT,                          -- gmail thread_id or slack thread_ts
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  from_email TEXT,
  subject TEXT,
  classification_result JSONB,             -- full JSON from Claude (null if pre-filtered)
  pre_filter_result TEXT,                  -- 'passed', 'newsletter', 'auto_reply', 'marketing', 'noreply', 'thread_update'
  dossier_summary TEXT,                    -- entity dossier injected (for debugging)
  feedback_summary TEXT,                   -- feedback injected (for debugging)
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  model TEXT,
  agent_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_log_source
  ON classification_log(source, source_message_id);

CREATE INDEX IF NOT EXISTS idx_classification_log_entity
  ON classification_log(entity_id) WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_classification_log_prefilter
  ON classification_log(pre_filter_result);

CREATE INDEX IF NOT EXISTS idx_classification_log_created
  ON classification_log(created_at);

-- 3. RLS policies
ALTER TABLE classification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to classification_log"
  ON classification_log FOR SELECT
  USING (true);

CREATE POLICY "Allow service_role full access to classification_log"
  ON classification_log FOR ALL
  USING (true)
  WITH CHECK (true);

COMMIT;

-- Verify
SELECT 'classification_log' as table_name, count(*) as rows FROM classification_log
UNION ALL
SELECT 'tasks with thread_id', count(*) FROM tasks WHERE thread_id IS NOT NULL;
