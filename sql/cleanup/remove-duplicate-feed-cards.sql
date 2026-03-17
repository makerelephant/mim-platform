-- Remove duplicate feed cards created by the legacy second emission.
--
-- The old scanner emitted two cards per email:
--   1. source_ref = 'gmail_<msgId>' (correct, from emitFeedCard)
--   2. source_ref = '<msgId>' (legacy direct insert, no gmail_ prefix)
--
-- This keeps the gmail_-prefixed cards and deletes the duplicates.
-- Also deduplicates any cards with identical source_ref (exact duplicates).

-- Step 1: Delete legacy cards (no gmail_ prefix) where a gmail_-prefixed version exists
DELETE FROM brain.feed_cards
WHERE source_type = 'email'
  AND source_ref NOT LIKE 'gmail_%'
  AND EXISTS (
    SELECT 1 FROM brain.feed_cards AS other
    WHERE other.source_ref = 'gmail_' || brain.feed_cards.source_ref
      AND other.source_type = 'email'
  );

-- Step 2: For any remaining exact-duplicate source_refs, keep the newest
DELETE FROM brain.feed_cards a
USING brain.feed_cards b
WHERE a.source_type = 'email'
  AND a.source_ref = b.source_ref
  AND a.source_type = b.source_type
  AND a.id < b.id;
