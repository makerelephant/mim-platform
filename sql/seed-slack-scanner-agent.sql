-- Seed the Slack Scanner agent
-- Run this in Supabase SQL Editor after create-agents-table.sql

INSERT INTO agents (name, slug, description, agent_type, config, status)
VALUES (
  'Slack',
  'slack-scanner',
  'Scans Slack channels for messages, classifies them using AI, resolves entities, and generates actionable tasks. Reads from all channels the bot is a member of, or specific configured channels.',
  'messaging',
  '{"scan_hours": 24, "model": "claude-sonnet-4-5-20250929", "max_tokens": 1200, "channels": []}',
  'active'
)
ON CONFLICT (slug) DO NOTHING;
