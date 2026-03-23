-- ============================================================================
-- Step 30: Scoped vector search per knowledge_base document
-- ============================================================================
-- Lets /api/brain/ask retrieve the top-matching chunks within ONE kb row
-- (e.g. a large uploaded file) instead of only a global top-N across all docs.
-- Apply in Supabase SQL editor or your migration runner.
-- ============================================================================

CREATE OR REPLACE FUNCTION brain.search_knowledge_for_kb(
  target_kb_id UUID,
  query_embedding vector(1536),
  match_count INT DEFAULT 32,
  match_threshold FLOAT DEFAULT 0.12
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
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM brain.knowledge_chunks kc
  WHERE kc.kb_id = target_kb_id
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION brain.search_knowledge_for_kb IS
  'Cosine similarity search limited to chunks of a single knowledge_base row; use for large docs when global top-N misses relevant sections.';
