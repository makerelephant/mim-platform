-- ============================================================
-- Update scanner agent configs with goals + clear stale prompts
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Gmail Scanner: clear outdated system_prompt (code now has enhanced
--    version with few-shot examples, org context matching, goal scoring).
--    Also update config to add goals_90day and fix monitored_emails.
UPDATE agents
SET
  system_prompt = NULL,   -- NULL = use the enhanced default from code
  config = jsonb_build_object(
    'scan_hours', 24,
    'model', 'claude-sonnet-4-5-20250929',
    'max_tokens', 1200,
    'monitored_emails', '["mark@madeinmotion.co", "mark@mim.co", "markslater9@gmail.com"]'::jsonb,
    'goals_90day', '["$76K in gross revenue", "Average order value of $35", "Additional $250K in investment raised"]'::jsonb
  ),
  updated_at = now()
WHERE slug = 'gmail-scanner';

-- 2. Slack Scanner: clear outdated system_prompt, add goals_90day to config.
UPDATE agents
SET
  system_prompt = NULL,   -- NULL = use the enhanced default from code
  config = jsonb_build_object(
    'scan_hours', 24,
    'model', 'claude-sonnet-4-5-20250929',
    'max_tokens', 1200,
    'channels', '[]'::jsonb,
    'goals_90day', '["$76K in gross revenue", "Average order value of $35", "Additional $250K in investment raised"]'::jsonb
  ),
  updated_at = now()
WHERE slug = 'slack-scanner';

-- 3. Weekly Report: add goals_90day (keep existing config)
UPDATE agents
SET
  config = config || '{"goals_90day": ["$76K in gross revenue", "Average order value of $35", "Additional $250K in investment raised"]}'::jsonb,
  updated_at = now()
WHERE slug = 'weekly-report';

-- Verify
SELECT slug, status, config->'goals_90day' as goals, system_prompt IS NULL as using_code_default
FROM agents
WHERE slug IN ('gmail-scanner', 'slack-scanner', 'weekly-report');
