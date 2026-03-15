-- Step 15: Feed Cards + Ingestion Log
-- Run in Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

-- ─── Feed Cards ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain.feed_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_type     text NOT NULL CHECK (card_type IN ('decision','action','signal','briefing','snapshot','intelligence','reflection')),
  title         text NOT NULL,
  body          text,
  reasoning     text,

  -- Source
  source_type   text NOT NULL,          -- 'email', 'slack', 'document', 'webhook', 'synthesis', 'manual'
  source_ref    text,                   -- message_id, thread_ts, doc_id, etc.

  -- Acumen classification
  acumen_family   text,
  acumen_category text,
  priority        text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  confidence      numeric(4,3),

  -- Visibility
  visibility_scope text DEFAULT 'personal' CHECK (visibility_scope IN ('personal','team','regiment')),

  -- Entity association
  entity_id     uuid,
  entity_type   text,                   -- 'contact', 'organization'
  entity_name   text,
  related_entities jsonb DEFAULT '[]'::jsonb,

  -- CEO action
  status        text DEFAULT 'unread' CHECK (status IN ('unread','read','acted','dismissed','expired')),
  ceo_action    text CHECK (ceo_action IN ('do','no','not_now')),
  ceo_action_at timestamptz,
  ceo_action_note text,

  -- Audit
  classification_log_id uuid,
  agent_run_id  uuid,
  metadata      jsonb DEFAULT '{}'::jsonb,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feed_cards_status ON brain.feed_cards(status);
CREATE INDEX IF NOT EXISTS idx_feed_cards_type ON brain.feed_cards(card_type);
CREATE INDEX IF NOT EXISTS idx_feed_cards_priority ON brain.feed_cards(priority);
CREATE INDEX IF NOT EXISTS idx_feed_cards_created ON brain.feed_cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_cards_entity ON brain.feed_cards(entity_id);
CREATE INDEX IF NOT EXISTS idx_feed_cards_scope ON brain.feed_cards(visibility_scope);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION brain.update_feed_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feed_cards_updated_at ON brain.feed_cards;
CREATE TRIGGER trg_feed_cards_updated_at
  BEFORE UPDATE ON brain.feed_cards
  FOR EACH ROW EXECUTE FUNCTION brain.update_feed_cards_updated_at();

-- RLS
ALTER TABLE brain.feed_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_feed_cards" ON brain.feed_cards
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_update_feed_cards" ON brain.feed_cards
  FOR UPDATE TO anon USING (true);

CREATE POLICY "anon_insert_feed_cards" ON brain.feed_cards
  FOR INSERT TO anon WITH CHECK (true);

-- ─── Ingestion Log ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brain.ingestion_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type   text NOT NULL,
  source_ref    text,
  card_id       uuid REFERENCES brain.feed_cards(id),
  raw_payload   jsonb,
  classification jsonb,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE brain.ingestion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_ingestion_log" ON brain.ingestion_log
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- After running this, execute:
-- NOTIFY pgrst, 'reload schema';
