-- ============================================================
-- Create reports table for storing periodic update reports
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT,
  period_type TEXT NOT NULL DEFAULT 'week',  -- 'day', 'week', 'month'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  markdown_content TEXT NOT NULL,
  agent_slug TEXT DEFAULT 'weekly-report',
  status TEXT DEFAULT 'completed',  -- 'generating', 'completed', 'failed'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to reports"
  ON reports FOR SELECT USING (true);

CREATE POLICY "Allow service_role full access to reports"
  ON reports FOR ALL USING (true) WITH CHECK (true);
