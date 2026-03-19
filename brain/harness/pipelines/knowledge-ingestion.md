# Knowledge Ingestion Pipeline

## Overview

All non-email data enters the platform through a single endpoint: `POST /api/brain/ingest`. This is the universal ingestion point for documents, text, and structured data. The endpoint handles file uploads, text input, and pre-uploaded storage references.

## Supported Input Methods

### File Upload (Multipart Form Data)

Accepts file uploads with optional metadata fields:
- `file` — The file to process
- `title` — Document title (defaults to filename)
- `source_type` — Origin identifier (e.g., "upload", "canvas", "slack")
- `source_ref` — External reference ID for deduplication
- `tags` — User-provided tags (JSON array)
- `entity_ids` — Pre-linked entity IDs (JSON array)
- `metadata` — Additional metadata (JSON object)

### Text Input (JSON Body)

Accepts raw text with the same metadata fields:
- `text` or `content` — The text to process
- `storage_path` — Reference to a file already uploaded to Supabase Storage (for files > 4MB that bypass the serverless function size limit)

## Supported File Types

Defined in `document-processor.ts` via the `EXTENSION_TO_TYPE` mapping:
- **PDF** — Text extraction via `pdf-parse`; falls back to Claude Vision for image-based PDFs under 5MB
- **PPTX** — PowerPoint text extraction
- **DOCX** — Word document text extraction
- **TXT** — Plain text passthrough

## Processing Pipeline

### 1. Initial Record Creation

A row is inserted into `knowledge_base` with `processed: false`. This happens immediately so the record exists even if processing fails.

### 2. File Storage

If a file is present, it's uploaded to Supabase Storage at `knowledge/{kb_id}/{filename}`.

### 3. Text Extraction

- **Text files:** Direct passthrough
- **PDF files:** Extracted via `pdf-parse`. If text content is under 30 characters (indicating an image-based PDF), falls back to Claude Vision for visual extraction (files under 5MB only). Files over 5MB with no text layer return an error suggesting export to PPTX.
- **PPTX/DOCX:** Extracted via their respective parsers

### 4. Chunking

Text is split into chunks by `processDocument()` or `processTextInput()` from `document-processor.ts`. Chunks are stored in the `content_chunks` JSON field on the `knowledge_base` row.

### 5. Classification & Summarization (Claude)

The first 3000 characters are sent to Claude (`claude-sonnet-4-6`) with the business taxonomy context. Claude returns:
- `summary` — 2-3 sentence summary
- `categories` — Matching taxonomy category slugs
- `tags` — Extracted tags
- `mentioned_entities` — Organization and entity names found in the text

### 6. Entity Resolution

Mentioned entity names are matched against `core.organizations` and `core.contacts` using case-insensitive substring matching. Matched entity IDs are linked to the knowledge base record.

### 7. Embedding Generation

Content is re-chunked at 500 tokens per chunk by `chunkText()` from `embeddings.ts`. Each chunk is embedded using OpenAI's `text-embedding-3-small` model (1536 dimensions). Embeddings are stored in `brain.knowledge_chunks` with pgvector format for semantic search.

Batching: Embeddings are generated in batches of 100 via `embedBatch()` to stay within API limits.

### 8. Feed Card Emission

An intelligence or decision card is emitted to `brain.feed_cards`:
- **Decision card** — If the content relates to fundraising, partnerships, or deals
- **Intelligence card** — For all other content types

### 9. Activity Logging

The ingestion is logged to `brain.activity` with metadata including title, source type, file type, category matches, entity count, chunk count, and text length.

## Entry Points

- **Canvas file drag-and-drop** — Files dropped into Your Canvas are uploaded and ingested
- **Bulk Data Import Gopher** — `/engine/import` page for historical email batch ingestion
- **API direct** — Any system can POST to `/api/brain/ingest` with text or file data
- **Large file bypass** — Files over 4MB are uploaded directly to Supabase Storage via a signed URL (`/api/brain/upload-url`), then the storage path is sent to the ingest endpoint
