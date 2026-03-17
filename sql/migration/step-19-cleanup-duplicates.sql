-- Step 19: Clean up duplicate feed cards and add unique constraint
-- Run in Supabase SQL Editor

-- 1. See how many duplicates exist (diagnostic — run this first to check)
SELECT source_ref, COUNT(*) as dupes
FROM brain.feed_cards
WHERE source_ref IS NOT NULL
GROUP BY source_ref
HAVING COUNT(*) > 1
ORDER BY dupes DESC
LIMIT 20;

-- 2. Delete duplicates, keeping the most recently updated card per source_ref
DELETE FROM brain.feed_cards
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY source_ref
             ORDER BY thread_updated_at DESC NULLS LAST, updated_at DESC, created_at DESC
           ) as rn
    FROM brain.feed_cards
    WHERE source_ref IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 3. Also deduplicate by thread_id (keep best card per thread)
DELETE FROM brain.feed_cards
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY thread_id
             ORDER BY message_count DESC NULLS LAST, updated_at DESC, created_at DESC
           ) as rn
    FROM brain.feed_cards
    WHERE thread_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- 4. Add unique constraints to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_cards_source_ref_unique
  ON brain.feed_cards (source_ref)
  WHERE source_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_cards_thread_id_unique
  ON brain.feed_cards (thread_id)
  WHERE thread_id IS NOT NULL;

-- 5. Verify: count remaining cards
SELECT
  COUNT(*) as total_cards,
  COUNT(DISTINCT source_ref) as unique_sources,
  COUNT(DISTINCT thread_id) as unique_threads,
  COUNT(*) FILTER (WHERE status = 'unread') as unread,
  COUNT(*) FILTER (WHERE status = 'actioned') as actioned
FROM brain.feed_cards;
