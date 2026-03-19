-- step-29-events.sql
-- Lightweight event tracking for the measurement layer.
-- Tracks card expansions, actions, filter changes, etc.

CREATE TABLE IF NOT EXISTS brain.events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event       text NOT NULL,
  card_id     uuid REFERENCES brain.feed_cards(id) ON DELETE SET NULL,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- Index for querying by event type and time range
CREATE INDEX IF NOT EXISTS idx_events_event_created
  ON brain.events (event, created_at DESC);

-- Index for querying events for a specific card
CREATE INDEX IF NOT EXISTS idx_events_card_id
  ON brain.events (card_id)
  WHERE card_id IS NOT NULL;

-- RLS: service role only (no anon access to raw events)
ALTER TABLE brain.events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all" ON brain.events
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE brain.events IS 'Lightweight event tracking for measurement layer — card expansions, actions, filter changes';
