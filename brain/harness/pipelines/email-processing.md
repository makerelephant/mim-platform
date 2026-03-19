# Email Processing Pipeline

## Overview

The Gmail Gopher scans the CEO's inbox on a scheduled cron (6am EST, last 4 hours) or on-demand via the Me page. Each email passes through a multi-stage pipeline that resolves entities, classifies content, and emits feed cards.

## Pipeline Stages

### 1. Email Retrieval

The scanner authenticates with Gmail using a base64-encoded OAuth token (`GOOGLE_TOKEN` env var). It queries for messages within the scan window using the Gmail API (`googleapis` library).

**Default scan:** Last 4 hours (cron) or configurable via POST body (`scanHours` parameter).

### 2. Pre-Filtering

Before classification, emails pass through `scanner-prefilter.ts` which applies cheap, rule-based filters to skip obvious noise:
- Automated notifications from known services
- Marketing/newsletter patterns
- Messages already processed (deduplication via `source_ref` matching against existing `brain.feed_cards`)

This reduces Claude API calls and processing time.

### 3. Thread Consolidation

The scanner tracks Gmail thread IDs. When multiple messages belong to the same thread, only the latest message in the thread is processed as a new card. Earlier messages in the thread are skipped to avoid duplicate cards for the same conversation.

### 4. Entity Resolution

For each email, the scanner extracts sender and recipient addresses, then resolves them against the CRM:

1. **Direct email match** — Look up `core.contacts` by email address
2. **Junction table match** — Follow contact-organization links
3. **Domain fallback** — Match sender domain against `core.organizations.domain`
4. **Auto-create** — If no match found, create a new contact record

For known entities, the scanner builds an **Entity Dossier** (`entity-dossier.ts`) containing:
- Relationship history and stage
- Recent correspondence
- Open tasks
- CEO feedback patterns (via `feedback-engine.ts`)

### 5. Classification (Unified Classifier)

The email content, entity context, and dossier are sent to Claude (`claude-sonnet-4-6`) with a system prompt built from multiple sources:

- **Unified Classifier prompt** (`unified-classifier.ts`) — Attention classification (P0-P3) and operational enrichment
- **Acumen categories** (`harness-loader.ts`) — The 11 classifier markdown files from `brain/pipelines/email-classification/`
- **Taxonomy section** (`taxonomy-loader.ts`) — Business taxonomy from the database
- **Standing orders** (`instruction-loader.ts`) — CEO's persistent instructions loaded from the database
- **Recent corrections** (`instruction-loader.ts`) — Last N CEO corrections for in-context learning
- **Behavioral rules** (`behavioral-rules.ts`) — Synthesized rules from correction patterns

The classifier returns a structured JSON response including:
- `attention_class` — P0 through P3
- `acumen_category` — One of the 11 operational categories
- `importance_level` — High/Medium/Low
- `summary_sentence` — One-line summary
- `action_items` — Extracted action items with priorities
- `entities` — Resolved entity references
- `contains_decision`, `contains_action`, `contains_task` — Content flags
- `draft_reply` — Suggested reply text (when applicable)

### 6. Priority Enforcement

After classification, `enforcePriorityRules()` from `taxonomy-loader.ts` applies hard-coded priority rules that override the classifier when specific conditions are met (e.g., legal matters always get at least "high" priority).

### 7. Autonomy Check

The scanner queries `autonomy.ts` to get the list of categories that have earned autonomous operation (20+ reviews, 90%+ accuracy). If the classified email falls into an autonomous category, the resulting card is auto-acted with `ceo_action: "do"` instead of appearing in the feed for manual review.

### 8. Card Emission

The `feed-card-emitter.ts` module creates the feed card in `brain.feed_cards` with all classification data, entity references, and metadata. Card type is inferred from the attention class and content flags.

### 9. Correspondence Embedding

The email content is chunked and embedded using OpenAI's `text-embedding-3-small` model. Embeddings are stored in `brain.knowledge_chunks` for future semantic search (RAG) via the `search_correspondence` RPC function.

### 10. Provenance & Intelligence

Entity intelligence is updated via `entity-intelligence.ts`:
- **Provenance logging** — Records the classification decision for auditability
- **KCS recomputation** — Updates entity knowledge scores based on new correspondence

### 11. Activity Logging

Every processed email is logged to `brain.activity` with metadata including the classification result, entity matches, and processing timestamps.

## Cron Schedule

- **Gmail Gopher:** Daily at 6am EST via Vercel cron, scans last 4 hours
- **Manual trigger:** Available on the Me page, configurable scan window
- **Bulk import:** Separate endpoint (`/api/agents/gmail-bulk-import`) for historical email ingestion with configurable date ranges
