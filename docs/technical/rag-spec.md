# RAG Spec & Tools
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active technical document. Foundation operational. Reliability verification in progress.
> **Last updated:** 2026-03-18

---

## 1. What RAG Is and Why It Matters Here

RAG (Retrieval-Augmented Generation) is the technique that gives In Motion semantic memory. Without it, the brain answers questions from its training data alone — it cannot access documents the CEO uploaded, emails that were processed, or knowledge that was accumulated. With RAG, every question is answered using the brain's actual stored knowledge.

**The gap RAG closes:** Claude is stateless and has a finite context window. The platform has accumulated thousands of emails, documents, and data points. RAG is the bridge — it retrieves the most relevant stored knowledge and injects it into Claude's context before answering.

---

## 2. How It Works — The Full Pipeline

```
INGEST PATH:
  Document/text received at /api/brain/ingest
    → Text extraction (pdf-parse, PPTX/DOCX parsers, Claude Vision fallback)
    → Chunking: ~500 tokens per chunk, overlapping where beneficial
    → Embedding: OpenAI text-embedding-3-small → 1536-dimension float vector
    → Storage: brain.knowledge_chunks (chunk text + embedding + metadata)
    → Also: document-level embedding on knowledge_base row for coarse search

QUERY PATH:
  Question arrives at /api/brain/ask
    → Embed question: same model, same dimensions
    → Vector similarity search: brain.search_knowledge RPC
        - Cosine similarity: 1 - (embedding <=> query_embedding)
        - Threshold: 0.4 (returns chunks above this similarity score)
        - Match count: up to 10 chunks
    → Deduplication: remove chunks with identical content
    → Context injection: retrieved chunks → Claude prompt
    → Synthesis: Claude answers using retrieved context + entity dossiers
    → Fallback: if vector search returns nothing → keyword search by title

CORRESPONDENCE PATH:
  Same pattern, separate table:
    → brain.correspondence_chunks
    → brain.search_correspondence RPC
    → Used for email/Slack history retrieval in ask_brain
```

---

## 3. Current Implementation

### 3.1 Embedding Model

| Property | Value |
|----------|-------|
| Provider | OpenAI |
| Model | text-embedding-3-small |
| Dimensions | 1536 |
| API key | Set as `OPENAI_API_KEY` in Vercel env |
| Cost | ~$0.02 / 1M tokens (negligible at current volume) |
| Library | `src/lib/embeddings.ts` |

The embedding library (`embedBatch`) accepts an array of strings and returns an array of 1536-dimension float arrays. Returns empty array if `OPENAI_API_KEY` is missing — fails gracefully.

### 3.2 Database Tables

```sql
-- Primary knowledge chunks table
brain.knowledge_chunks (
  id          UUID PRIMARY KEY,
  kb_id       UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  token_count INTEGER,
  embedding   vector(1536),    -- pgvector type
  metadata    JSONB,           -- { title, source_type, categories }
  created_at  TIMESTAMPTZ
)

-- Correspondence chunks (email/Slack)
brain.correspondence_chunks (
  id                UUID PRIMARY KEY,
  correspondence_id UUID NOT NULL,
  chunk_index       INTEGER NOT NULL,
  content           TEXT NOT NULL,
  token_count       INTEGER,
  embedding         vector(1536),
  created_at        TIMESTAMPTZ
)
```

Both tables have HNSW vector indexes for fast approximate nearest-neighbour search:
```sql
CREATE INDEX ON brain.knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON brain.correspondence_chunks USING hnsw (embedding vector_cosine_ops);
```

### 3.3 Search RPC Functions

```sql
-- Knowledge search
CREATE OR REPLACE FUNCTION brain.search_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.4
) RETURNS TABLE (
  kb_id UUID, chunk_id UUID, chunk_index INTEGER,
  content TEXT, title TEXT, source_type TEXT, similarity FLOAT
)

-- Correspondence search
CREATE OR REPLACE FUNCTION brain.search_correspondence(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.4
) RETURNS TABLE (
  correspondence_id UUID, chunk_id UUID, content TEXT,
  subject TEXT, from_address TEXT, similarity FLOAT
)
```

Both functions use cosine similarity via pgvector's `<=>` operator.

### 3.4 Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/brain/ingest` | POST | Single ingestion point — text, file (multipart), or storage path (JSON) |
| `/api/brain/ask` | POST | Brain Q&A with RAG retrieval |
| `/api/brain/upload-url` | POST | Get signed Supabase Storage URL for large files (> 4MB) |
| `/api/brain/embed-backfill` | POST | Re-embed existing knowledge_base rows that have no chunks |

---

## 4. Document Ingestion — File Type Support

| Format | Extraction Method | Notes |
|--------|------------------|-------|
| `.pdf` (text layer) | pdf-parse | Works for reports, articles, typed docs |
| `.pdf` (image-based) | Claude Vision (< 5MB) | Keynote/PowerPoint exports, scanned docs |
| `.pdf` (image-based, large) | 422 error with PPTX guidance | > 5MB image PDFs — advise PPTX export |
| `.pptx` | jszip + XML parsing | Keynote → Export As → PowerPoint first |
| `.docx` | mammoth | Full text extraction including tables |
| `.txt` / `.md` | Direct read | No extraction needed |
| `.html` / `.htm` | Cheerio parser | Strips tags, extracts text content |
| `.csv` | Papa Parse | Converts to readable text format |

### Large File Upload Path (> 4MB)

Files larger than Vercel's 4.5MB serverless limit bypass the API route entirely:

```
Browser → POST /api/brain/upload-url → { signed_url, storage_path }
Browser → PUT signed_url (direct to Supabase Storage, no Vercel)
Browser → POST /api/brain/ingest { storage_path }
Server  → download from Supabase Storage → extract → chunk → embed → store
```

This allows files up to Supabase Storage limits (50GB) to be ingested.

---

## 5. Chunking Strategy

**Current:** ~500 tokens per chunk, sequential, no overlap.

**Why 500 tokens:** Balance between retrieval precision (smaller = more targeted) and context richness (larger = more surrounding context). Each chunk should represent one coherent idea or section.

**Known limitation:** No overlap between chunks means a sentence at the boundary of two chunks may lose its context. For dense technical documents, this can reduce retrieval quality.

**Future improvement:** Sliding window chunking with 50-100 token overlap at chunk boundaries. Not yet implemented.

---

## 6. Retrieval Quality

### Current Thresholds

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `match_threshold` | 0.4 | Cosine similarity minimum — returns anything above 40% similar |
| `match_count` | 10 | Maximum chunks returned per search |

### Known Issues

1. **Embedding storage format:** Embeddings stored as `[n1,n2,...n1536]` string format in pgvector column. If this is not being parsed correctly by pgvector, vector search will silently fail and fall back to keyword search.

2. **Silent failure:** The `search_knowledge` call is wrapped in try/catch. If the RPC fails (e.g., function doesn't exist, wrong embedding format), the error is swallowed and keyword search is used instead. This means failures are invisible without log inspection.

3. **Keyword search fallback:** Keyword search only matches on `title.ilike.%word%` — it cannot search document bodies. This means if vector search fails, questions about document content return nothing.

**Verification needed:** Confirm that vector search is returning results for known-good queries (e.g., ingest a document, immediately ask about its content, verify vector match in Supabase logs).

---

## 7. Improving Retrieval Quality Over Time

### 7.1 Query Expansion

Before embedding the question, expand it with synonyms or rephrasing:
```
"what are our 90 day goals"
→ also embed: "quarterly objectives", "Q1 priorities", "near-term targets"
→ run all three searches, merge and deduplicate results
```

Not yet implemented.

### 7.2 Hybrid Search

Combine vector search (semantic) with keyword search (exact) and re-rank:
```
results = vector_search(query) + keyword_search(query)
re_ranked = reciprocal_rank_fusion(results)
return top_k(re_ranked)
```

Supabase supports this natively via the `full_text` search alongside vector search. Not yet implemented.

### 7.3 Metadata Filtering

Currently searches across all chunks. Adding filters would improve precision:
- `WHERE source_type = 'clearing'` — only search CEO-uploaded docs
- `WHERE metadata->>'categories' @> '["fundraising"]'` — only search fundraising-tagged docs

This is supported by pgvector and can be added to the RPC function.

### 7.4 Re-ranking

After initial retrieval, pass the top 20 chunks through a cross-encoder re-ranker to improve ordering before injecting into context. Not yet implemented.

---

## 8. Operational Tools

### Embed Backfill

`POST /api/brain/embed-backfill`

Finds all `knowledge_base` rows with no corresponding `knowledge_chunks` and re-processes them. Run this after:
- Setting `OPENAI_API_KEY` for the first time
- Any bulk import of historical documents
- Upgrading the embedding model

### Verification Query

To confirm vector search is working in Supabase:

```sql
-- Check that chunks exist with non-null embeddings
SELECT count(*), count(embedding) as with_embedding
FROM brain.knowledge_chunks;

-- Test a similarity search directly
SELECT content, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as sim
FROM brain.knowledge_chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

---

## 9. Open Questions

1. **Embedding model upgrade path:** When Anthropic releases its own embedding API, does it make sense to migrate from OpenAI? What is the re-embedding cost for existing chunks?

2. **Correspondence volume:** Once Gmail bulk import runs and embeds correspondence, how many chunks will exist? Will the HNSW index need tuning for retrieval speed?

3. **Chunk size for different document types:** Are 500-token chunks optimal for Slack messages (short) vs. strategy documents (long)? Should chunk size be document-type-aware?

4. **Freshness weighting:** Should more recent documents get higher retrieval weight? Currently purely similarity-based with no temporal component.

5. **Multi-query retrieval:** For complex questions that span multiple topics, should we run multiple sub-queries and merge results?

---

## 10. Success Criteria

RAG is working correctly when:

- [ ] Ingest a document → immediately ask a question about its content → get a correct sourced answer
- [ ] Ask about a topic covered in 3 different documents → response synthesises all three with citations
- [ ] Ask a question with no relevant stored knowledge → response says "I don't have information on this" rather than hallucinating
- [ ] Vector search is confirmed working (not silently falling back to keyword)
- [ ] Embed backfill runs cleanly on all existing knowledge_base rows
- [ ] Correspondence chunks populated for last 90 days of email history
