-- Step 22: Clearing Conversations
-- Persist brain chat sessions from Your Clearing
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

-- ─── Clearing Sessions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain.clearing_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL DEFAULT 'Thought Stream',
  status      text DEFAULT 'active' CHECK (status IN ('active', 'dissolved')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearing_sessions_status ON brain.clearing_sessions(status);
CREATE INDEX IF NOT EXISTS idx_clearing_sessions_created ON brain.clearing_sessions(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION brain.update_clearing_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clearing_sessions_updated_at ON brain.clearing_sessions;
CREATE TRIGGER trg_clearing_sessions_updated_at
  BEFORE UPDATE ON brain.clearing_sessions
  FOR EACH ROW EXECUTE FUNCTION brain.update_clearing_sessions_updated_at();

-- RLS
ALTER TABLE brain.clearing_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_clearing_sessions" ON brain.clearing_sessions
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Clearing Messages ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain.clearing_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES brain.clearing_sessions(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('user', 'brain')),
  content       text NOT NULL,
  message_type  text NOT NULL CHECK (message_type IN ('thought', 'query', 'response', 'ingestion')),
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clearing_messages_session ON brain.clearing_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_clearing_messages_created ON brain.clearing_messages(created_at ASC);

-- RLS
ALTER TABLE brain.clearing_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_clearing_messages" ON brain.clearing_messages
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- After running this, execute:
-- NOTIFY pgrst, 'reload schema';
