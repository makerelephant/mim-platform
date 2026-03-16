-- Step 17: Thread consolidation for feed cards

-- Add thread_id column to feed_cards
ALTER TABLE brain.feed_cards ADD COLUMN IF NOT EXISTS thread_id TEXT;
CREATE INDEX IF NOT EXISTS idx_feed_cards_thread_id ON brain.feed_cards(thread_id) WHERE thread_id IS NOT NULL;

-- Add message_count to track how many messages are in the thread
ALTER TABLE brain.feed_cards ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 1;

-- Add thread_updated_at to track when the thread last had a new message
ALTER TABLE brain.feed_cards ADD COLUMN IF NOT EXISTS thread_updated_at TIMESTAMPTZ DEFAULT now();

NOTIFY pgrst, 'reload schema';
