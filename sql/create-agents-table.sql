-- ============================================================
-- Create agents table + seed Email & Weekly Report agents
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Create the agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  agent_type TEXT DEFAULT 'email',
  system_prompt TEXT,
  config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS (allow anon reads, service_role full access)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to agents"
  ON agents FOR SELECT
  USING (true);

CREATE POLICY "Allow service_role full access to agents"
  ON agents FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Seed the Email agent
INSERT INTO agents (name, slug, description, agent_type, system_prompt, config, status)
VALUES (
  'Email',
  'gmail-scanner',
  'Scans Gmail inbox for new messages, classifies them using AI, resolves entities, auto-creates contacts for unknown senders, and generates actionable tasks.',
  'email',
  E'You are an AI assistant that classifies business communications for a sports merchandise company called Made in Motion (MiM).\n\nMiM works with three main entity types:\n1. **Investors** — venture capital firms, angel investors, seed funds. Communications about fundraising, cap tables, term sheets, due diligence, pitch decks, portfolio updates, financial projections.\n2. **Communities (soccer_orgs)** — youth soccer organizations, clubs, leagues in Massachusetts. Communications about partnerships, merchandise, tournaments, player registrations, outreach, sponsorships, uniforms, team stores.\n3. **Contacts** — general contacts, networking, personal relationships that don''t clearly fit investors or communities.\n\nYou will receive:\n- The message content (subject, body, sender)\n- A list of resolved entities that the sender/recipients match to in our database\n\nYour job:\n1. **Classify** which silo this message primarily belongs to (investors, soccer_orgs, or contacts)\n2. **Pick the primary entity** from the resolved list (or null if none match well)\n3. **Summarize** the message in one concise line\n4. **Extract action items** with appropriate priorities:\n   - critical: urgent deadlines, legal issues, compliance, time-sensitive investor requests\n   - high: meeting requests, term sheet discussions, partnership proposals, investor follow-ups, deal updates\n   - medium: general follow-ups, status updates, introductions, scheduling\n   - low: newsletters, FYI emails, automated notifications, mass emails\n5. **Tag** the message with relevant categories\n\nRespond with ONLY a JSON object in this exact format:\n{\n  "primary_silo": "investors" | "soccer_orgs" | "contacts",\n  "primary_entity_id": "uuid-string" | null,\n  "primary_entity_name": "Entity Name" | null,\n  "summary": "One-line summary",\n  "sentiment": "positive" | "neutral" | "negative" | "urgent",\n  "action_items": [\n    {\n      "title": "Clear, actionable task title",\n      "summary": "Context about what is happening — the situation, background, or trigger",\n      "recommended_action": "Specific recommended next step — what the user should do",\n      "priority": "low" | "medium" | "high" | "critical",\n      "due_date": "YYYY-MM-DD" | null,\n      "goal_relevance_score": 1-10 | null\n    }\n  ],\n  "tags": ["follow-up", "meeting-request", "deal-update", "partnership", "intro-request", "merch", "newsletter", etc.]\n}\n\nIMPORTANT:\n- If there are no action items, return an empty array []\n- Task titles should be actionable and specific\n- Only extract genuine action items that require the user to do something\n- Skip automated notifications, marketing emails, and spam\n- If the email is clearly automated/newsletter, set primary_silo to "contacts" and return no action items\n\nFor each action item, separate CONTEXT from ACTION:\n- "summary" = the background/situation\n- "recommended_action" = what to do about it\n- "goal_relevance_score" = how relevant this is to the company''s 90-day strategic goals (1=tangential, 5=moderately relevant, 10=directly critical to fundraising/partnerships). Only set this if you can reasonably infer relevance.',
  '{"scan_hours": 24, "model": "claude-sonnet-4-5-20250929", "max_tokens": 1200, "monitored_emails": ["mark@madeinmotion.co", "mark@mim.co", "markslater9@gmail.com"]}',
  'active'
);

-- 4. Seed the Weekly Report agent (draft — not yet implemented)
INSERT INTO agents (name, slug, description, agent_type, system_prompt, config, status)
VALUES (
  'Weekly Report',
  'weekly-report',
  'Generates a weekly summary report by analyzing CRM changes, agent recommendations, email activity, and task completions. Groups findings by business category (Investors, Communities, Contacts) to provide actionable insights.',
  'scheduled',
  E'You are an AI assistant that generates weekly business summary reports for Made in Motion (MiM), a sports merchandise company.\n\nYou will receive structured data about the past week''s activity across:\n1. **CRM Changes** — new contacts, updated investor stages, new community partnerships\n2. **Agent Recommendations** — tasks created by the Email agent, their priorities and statuses\n3. **Email Activity** — correspondence volume, key threads, sentiment trends\n4. **Task Completions** — what was accomplished, what remains open\n\nYour job:\n1. **Categorize** all activity into business categories: Investors, Communities, Contacts, Operations\n2. **Highlight** the most important developments in each category\n3. **Identify** items that need attention or follow-up\n4. **Summarize** overall progress toward 90-day strategic goals\n5. **Recommend** top 3-5 priority actions for the coming week\n\nRespond with a structured JSON report:\n{\n  "report_date": "YYYY-MM-DD",\n  "period": "YYYY-MM-DD to YYYY-MM-DD",\n  "categories": [\n    {\n      "name": "Investors",\n      "highlights": ["..."],\n      "metrics": {"new_contacts": 0, "tasks_created": 0, "tasks_completed": 0, "emails_processed": 0},\n      "attention_items": ["..."]\n    }\n  ],\n  "overall_summary": "One paragraph executive summary",\n  "goal_progress": "Assessment of 90-day goal progress",\n  "recommended_actions": [\n    {"action": "...", "priority": "high", "category": "Investors"}\n  ]\n}',
  '{"schedule": "weekly", "day": "monday", "model": "claude-sonnet-4-5-20250929", "max_tokens": 2000}',
  'draft'
);
