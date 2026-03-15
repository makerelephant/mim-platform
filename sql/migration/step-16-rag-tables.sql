-- ============================================================================
-- Step 16: RAG Tables & Functions
-- ============================================================================
-- Creates the vector-indexed chunk tables and similarity-search RPC functions
-- needed to activate Retrieval-Augmented Generation (RAG) in MiMBrain.
--
-- What this migration does:
--   1. brain.knowledge_chunks   — chunked + embedded documents from knowledge_base
--   2. brain.correspondence_chunks — chunked + embedded email/message threads
--   3. brain.search_knowledge()       — cosine-similarity search over knowledge chunks
--   4. brain.search_correspondence()  — cosine-similarity search over correspondence chunks
--   5. Adds resurface_at column to brain.feed_cards (hold/resurface feature)
--   6. Adds ceo_correction JSONB column to brain.feed_cards (structured corrections)
--
-- Prerequisites:
--   - pgvector extension already enabled
--   - brain schema already exists
--   - brain.feed_cards table already exists (step-15)
--   - public.knowledge_base table already exists
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. brain.knowledge_chunks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brain.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID NOT NULL,  -- references public.knowledge_base(id)
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_kb_id
  ON brain.knowledge_chunks(kb_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON brain.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- --------------------------------------------------------------------------
-- 2. brain.correspondence_chunks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brain.correspondence_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_correspondence_chunks_corr_id
  ON brain.correspondence_chunks(correspondence_id);

CREATE INDEX IF NOT EXISTS idx_correspondence_chunks_embedding
  ON brain.correspondence_chunks USING hnsw (embedding vector_cosine_ops);

-- --------------------------------------------------------------------------
-- 3. search_knowledge RPC
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION brain.search_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  id UUID,
  kb_id UUID,
  chunk_index INTEGER,
  content TEXT,
  token_count INTEGER,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.kb_id,
    kc.chunk_index,
    kc.content,
    kc.token_count,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  FROM brain.knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- --------------------------------------------------------------------------
-- 4. search_correspondence RPC
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION brain.search_correspondence(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  id UUID,
  correspondence_id UUID,
  chunk_index INTEGER,
  content TEXT,
  token_count INTEGER,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cc.id,
    cc.correspondence_id,
    cc.chunk_index,
    cc.content,
    cc.token_count,
    1 - (cc.embedding <=> query_embedding) as similarity
  FROM brain.correspondence_chunks cc
  WHERE 1 - (cc.embedding <=> query_embedding) > match_threshold
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- --------------------------------------------------------------------------
-- 5. feed_cards: resurface_at for hold/resurface feature
-- --------------------------------------------------------------------------
ALTER TABLE brain.feed_cards ADD COLUMN IF NOT EXISTS resurface_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_feed_cards_resurface
  ON brain.feed_cards(resurface_at)
  WHERE status = 'acted' AND ceo_action = 'not_now';

-- --------------------------------------------------------------------------
-- 6. feed_cards: ceo_correction for structured correction data
-- --------------------------------------------------------------------------
ALTER TABLE brain.feed_cards ADD COLUMN IF NOT EXISTS ceo_correction JSONB;

-- --------------------------------------------------------------------------
-- Reload PostgREST schema cache
-- --------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
