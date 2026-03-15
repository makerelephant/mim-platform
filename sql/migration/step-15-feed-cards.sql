-- Step 15: Feed Cards Table + Ingestion Log
-- The output side of the single ingestion point.
-- Every piece of data the brain processes becomes a card in the feed.
--
-- Visibility scope supports the 1 → 10 → 1,000 cadence:
--   personal = only the originating user (Phase 1: everything)
--   team     = published to shared brain (Phase 2: the 10)
--   regiment = market-facing / external (Phase 3: the 1,000)

-- ── Feed Cards ──
-- Each row is one card in Your Motion.
CREATE TABLE IF NOT EXISTS brain.feed_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Card type (maps to UI card components)
  card_type TEXT NOT NULL CHECK (card_type IN (
    'decision',      -- requires CEO action (Do / No / Not Now)
    'action',        -- task spawned by brain or CEO
    'signal',        -- notable event, no action required
    'briefing',      -- daily/weekly synthesis
    'snapshot',      -- on-demand data view (replaces static pages)
    'intelligence',  -- enrichment insight about an entity
    'reflection'     -- clearing-originated, brain-assisted thinking
  )),

  -- Content
  title TEXT NOT NULL,
  body TEXT,                          -- markdown content
  reasoning TEXT,                     -- brain's classification reasoning
  source_type TEXT NOT NULL,          -- 'email', 'slack', 'document', 'webhook', 'manual', 'synthesis'
  source_ref TEXT,                    -- message ID, doc ID, etc.

  -- Classification (from acumen/harness)
  acumen_family TEXT,                 -- harness department (e.g., 'partnership', 'fundraising')
  acumen_category TEXT,               -- specific category within family
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  confidence REAL,                    -- classifier confidence 0.0-1.0

  -- Visibility (1 → 10 → 1,000)
  visibility_scope TEXT NOT NULL DEFAULT 'personal' CHECK (visibility_scope IN (
    'personal', 'team', 'regiment'
  )),

  -- Entity association
  entity_id UUID,                     -- primary associated entity (contact or org)
  entity_type TEXT,                   -- 'contact', 'organization'
  entity_name TEXT,                   -- denormalized for fast display
  related_entities JSONB DEFAULT '[]', -- additional entities [{id, type, name}]

  -- State
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN (
    'unread',        -- new, not yet seen
    'read',          -- seen but not acted on
    'acted',         -- CEO took action (Do/No/Not Now)
    'dismissed',     -- CEO dismissed / swiped away
    'archived'       -- auto-archived after TTL or action
  )),
  ceo_action TEXT,                    -- 'do', 'no', 'not_now', null
  ceo_action_note TEXT,               -- optional note from CEO on action
  ceo_action_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',        -- source-specific data (email headers, slack channel, etc.)
  expires_at TIMESTAMPTZ,             -- optional TTL (Burning Man principle)

  -- Provenance
  classification_log_id UUID,         -- link back to classification_log if from scanner
  agent_run_id UUID,                  -- which scanner/agent run created this

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for feed queries
CREATE INDEX IF NOT EXISTS idx_feed_cards_status ON brain.feed_cards(status);
CREATE INDEX IF NOT EXISTS idx_feed_cards_type ON brain.feed_cards(card_type);
CREATE INDEX IF NOT EXISTS idx_feed_cards_created ON brain.feed_cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_cards_scope ON brain.feed_cards(visibility_scope);
CREATE INDEX IF NOT EXISTS idx_feed_cards_priority ON brain.feed_cards(priority);
CREATE INDEX IF NOT EXISTS idx_feed_cards_entity ON brain.feed_cards(entity_id);
CREATE INDEX IF NOT EXISTS idx_feed_cards_acumen ON brain.feed_cards(acumen_family, acumen_category);

-- Composite index for the primary feed query: unread personal cards, newest first
CREATE INDEX IF NOT EXISTS idx_feed_cards_feed_query
  ON brain.feed_cards(visibility_scope, status, created_at DESC)
  WHERE status IN ('unread', 'read');

-- ── Ingestion Log ──
-- Every piece of data that enters the single ingestion point gets logged.
-- This is the audit trail and the training data source.
CREATE TABLE IF NOT EXISTS brain.ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,          -- 'email', 'slack', 'document', 'webhook', 'manual'
  source_ref TEXT,                    -- external ID
  raw_content TEXT,                   -- original content (for reprocessing/training)
  normalized_content TEXT,            -- parsed/cleaned version
  classification JSONB,              -- full classification result
  actions_taken JSONB DEFAULT '[]',   -- what the brain did [{action, target, result}]
  feed_card_id UUID REFERENCES brain.feed_cards(id), -- resulting card (if any)
  processing_ms INTEGER,              -- how long classification took
  error TEXT,                         -- null if successful
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_source ON brain.ingestion_log(source_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_card ON brain.ingestion_log(feed_card_id);

-- ── RLS ──
ALTER TABLE brain.feed_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain.ingestion_log ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write for now (single user, Phase 1)
CREATE POLICY "Allow all on feed_cards" ON brain.feed_cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on ingestion_log" ON brain.ingestion_log FOR ALL USING (true) WITH CHECK (true);

-- ── Updated_at trigger ──
CREATE OR REPLACE FUNCTION brain.update_feed_card_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feed_cards_updated_at
  BEFORE UPDATE ON brain.feed_cards
  FOR EACH ROW
  EXECUTE FUNCTION brain.update_feed_card_timestamp();
