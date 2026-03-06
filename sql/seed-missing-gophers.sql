-- ============================================================
-- Seed missing gophers: fundraising-scanner, partnership-scanner, sentiment-scanner
-- These 3 have API routes but no records in the agents table.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Fundraising Scanner
-- Orchestrator that triggers gmail + slack scanners, then surfaces
-- investor-related activity. No system_prompt needed (it's an orchestrator).
INSERT INTO agents (name, slug, description, agent_type, config, status)
VALUES (
  'Fundraising Scanner',
  'fundraising-scanner',
  'Orchestrates email and Slack scanning for investor-related activity. Triggers the Gmail and Slack gophers, then surfaces correspondence and activity tied to investor organizations.',
  'scheduled',
  '{"goals_90day": ["$76K in gross revenue", "Average order value of $35", "Additional $250K in investment raised"]}'::jsonb,
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Partnership Scanner
-- Orchestrator that triggers gmail + slack scanners, then surfaces
-- partner-org-related activity. No system_prompt needed (it's an orchestrator).
INSERT INTO agents (name, slug, description, agent_type, config, status)
VALUES (
  'Partnership Scanner',
  'partnership-scanner',
  'Orchestrates email and Slack scanning for partnership-related activity. Triggers the Gmail and Slack gophers, then surfaces correspondence and activity tied to partner organizations.',
  'scheduled',
  '{"goals_90day": ["$76K in gross revenue", "Average order value of $35", "Additional $250K in investment raised"]}'::jsonb,
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Sentiment Scanner
-- Placeholder: will eventually crawl news sources and analyze sentiment.
-- Currently returns hardcoded sample articles.
INSERT INTO agents (name, slug, description, agent_type, config, status)
VALUES (
  'Sentiment Scanner',
  'sentiment-scanner',
  'Crawls news sources and analyzes sentiment for community-related topics. Identifies trends in youth sports, recreation, education, and gaming that may affect partnerships and community engagement.',
  'scheduled',
  '{"goals_90day": ["$76K in gross revenue", "Average order value of $35", "Additional $250K in investment raised"]}'::jsonb,
  'draft'
)
ON CONFLICT (slug) DO NOTHING;

-- Verify all 7 gophers exist
SELECT slug, name, status, agent_type,
       config->'goals_90day' as goals
FROM agents
ORDER BY created_at;
