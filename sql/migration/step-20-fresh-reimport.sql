-- =============================================================================
-- Step 20: Fresh Re-import Cleanup
-- =============================================================================
-- ONE-TIME cleanup script to wipe all scanner-ingested data so we can do a
-- fresh re-import. This does NOT touch configuration, harness, knowledge_base,
-- or decision_log tables — only the transient data produced by the Gmail
-- scanner and feed pipeline.
--
-- CAUTION: This is destructive. Run only when you intend to re-import
-- everything from scratch.
-- =============================================================================

-- ---- 1. Show current counts before deletion --------------------------------

SELECT 'BEFORE CLEANUP' AS phase;

SELECT
  (SELECT count(*) FROM brain.feed_cards)            AS feed_cards_count,
  (SELECT count(*) FROM brain.correspondence)        AS correspondence_count,
  (SELECT count(*) FROM brain.correspondence_chunks) AS correspondence_chunks_count,
  (SELECT count(*) FROM brain.tasks)                 AS tasks_count,
  (SELECT count(*) FROM brain.ingestion_log)         AS ingestion_log_count;

-- ---- 2. Delete all transient data ------------------------------------------
-- ORDER MATTERS: delete child tables before parents (FK constraints)

-- Ingestion log references feed_cards — delete FIRST
DELETE FROM brain.ingestion_log;

-- Correspondence chunks references correspondence — delete FIRST
DELETE FROM brain.correspondence_chunks;

-- Now safe to delete the parent tables
DELETE FROM brain.feed_cards;
DELETE FROM brain.correspondence;
DELETE FROM brain.tasks;

-- ---- 3. Reset sequences if they exist --------------------------------------
-- These are identity/serial columns; resetting ensures IDs start fresh.
-- Using DO blocks so we don't error if a sequence doesn't exist.

DO $$
BEGIN
  -- feed_cards uses UUID primary key, so no sequence to reset.
  -- correspondence, tasks, ingestion_log may use serial ids.
  PERFORM setval(pg_get_serial_sequence('brain.correspondence', 'id'), 1, false)
    WHERE pg_get_serial_sequence('brain.correspondence', 'id') IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No sequence to reset for brain.correspondence';
END $$;

DO $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('brain.correspondence_chunks', 'id'), 1, false)
    WHERE pg_get_serial_sequence('brain.correspondence_chunks', 'id') IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No sequence to reset for brain.correspondence_chunks';
END $$;

DO $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('brain.tasks', 'id'), 1, false)
    WHERE pg_get_serial_sequence('brain.tasks', 'id') IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No sequence to reset for brain.tasks';
END $$;

DO $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('brain.ingestion_log', 'id'), 1, false)
    WHERE pg_get_serial_sequence('brain.ingestion_log', 'id') IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No sequence to reset for brain.ingestion_log';
END $$;

-- ---- 4. Confirm everything is empty ----------------------------------------

SELECT 'AFTER CLEANUP' AS phase;

SELECT
  (SELECT count(*) FROM brain.feed_cards)            AS feed_cards_count,
  (SELECT count(*) FROM brain.correspondence)        AS correspondence_count,
  (SELECT count(*) FROM brain.correspondence_chunks) AS correspondence_chunks_count,
  (SELECT count(*) FROM brain.tasks)                 AS tasks_count,
  (SELECT count(*) FROM brain.ingestion_log)         AS ingestion_log_count;
