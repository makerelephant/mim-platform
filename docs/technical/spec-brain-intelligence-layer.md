# MiM Brain Intelligence Layer — Architecture Spec

> **Status:** Draft
> **Author:** Mark Slater / Claude
> **Date:** March 10, 2026
> **Purpose:** Define what the brain can and cannot do today, what it needs to do, and the architecture to get there.

---

## 1. Problem Statement

The CEO needs to feed strategic documents into the MiM Brain and interact with it conversationally:

- *"Summarize this document and include it in the next weekly report"*
- *"What's the status of our Adidas partnership based on everything you know?"*
- *"Flag any emails about term sheets as critical and draft a response template"*

**Today, none of this is possible.** The brain is reactive (processes incoming emails/Slack) but has no conversational interface, no semantic retrieval over stored knowledge, and no way to accept or retain instructions.

---

## 2. Current State — What Exists

### 2.1 Ingestion Pipeline

| Component | Status | Location |
|---|---|---|
| File upload endpoint | Working | `/api/brain/ingest` |
| Document processor (PDF, DOCX, PPTX, TXT, MD, HTML, CSV) | Working | `src/lib/document-processor.ts` |
| Text chunking (~500 tokens per chunk) | Working | `document-processor.ts` → `content_chunks` JSONB |
| Claude classification (summary, tags, taxonomy, entities) | Working | `/api/brain/ingest` |
| Entity resolution (match mentioned names to orgs/contacts) | Working | `/api/brain/ingest` |
| Taxonomy category matching | Working | `src/lib/taxonomy-loader.ts` |

**Storage schema** (`knowledge_base` table):

```
id, title, source_type, source_ref, file_type, file_url,
content_text (full extracted text),
content_chunks (JSONB array of {chunk_index, text, token_count}),
summary (AI-generated),
taxonomy_categories (TEXT[]),
entity_ids (UUID[]),
tags (TEXT[]),
metadata (JSONB),
processed, processed_at, error
```

### 2.2 Classification Pipeline

| Component | Status | Location |
|---|---|---|
| Email scanner (Gmail) | Working | `src/lib/gmail-scanner.ts` |
| Slack scanner | Working | `src/lib/slack-scanner.ts` |
| Pre-filter (skip newsletters, auto-replies, bulk) | Working | `src/lib/scanner-prefilter.ts` |
| Claude classifier (summary, sentiment, priority, actions, draft_reply) | Working | Scanner files |
| Taxonomy injection into classifier prompt | Working | `taxonomy-loader.ts` |
| Priority enforcement rules | Working | `taxonomy-loader.ts` → `enforcePriorityRules()` |
| Content-aware brain card routing | Working | Dashboard via `taxonomy_card_key` |
| Approval queue (pending_review → approve/dismiss) | Working | `src/components/ApprovalQueue.tsx` |
| Feedback engine (learns from CEO signals) | Working | `src/lib/feedback-engine.ts` |
| Entity dossier builder | Working | `src/lib/entity-dossier.ts` |

### 2.3 Report Generation

| Component | Status | Location |
|---|---|---|
| Weekly/daily/monthly report generator | Working | `src/lib/weekly-report-generator.ts` |
| Pre-scan (email, Slack, Sheets) before report | Working | Report generator |
| Claude synthesis with strict attribution | Working | Report generator |
| PDF export | Working | Dashboard |

**What the report generator pulls from today:**
- `brain.tasks` — created, completed, open (within period)
- `brain.correspondence` — email/Slack messages (within period)
- `core.contacts` — new contacts
- `core.organizations` — org updates
- `brain.activity` — operation logs

**What the report generator does NOT pull from:**
- `knowledge_base` — strategic documents, uploaded files
- Any CEO instructions or standing orders
- Any semantic search over stored knowledge

### 2.4 Classification Audit Trail

The `classification_log` table stores every classifier call:
- Full classification result (JSONB)
- Pre-filter result
- Dossier + feedback injected into prompt
- Token usage, model used

The `entity_feedback` table aggregates CEO signals per entity:
- Tasks created, starred, completed, ignored, manually edited
- Average goal relevance, usefulness score
- Common tags, typical priority

---

## 3. Gap Analysis

### 3.1 No Prompt Interface

The brain has no surface for receiving natural language instructions. It processes incoming data streams (email, Slack) but cannot be asked questions or given commands.

**Impact:** CEO cannot interact with the brain's knowledge. Cannot request summaries, set standing orders, or query across stored information.

### 3.2 No Semantic Retrieval (RAG)

Documents are ingested and chunked, but chunks are not embedded as vectors. There is no way to find "the chunks most relevant to this query." The `content_chunks` JSONB field stores text and token counts but no embeddings.

**Impact:** Even if a prompt interface existed, the brain couldn't find relevant information to answer questions. It would have to brute-force read every document.

### 3.3 No Instruction Persistence

There is no concept of "standing orders" — instructions that persist across sessions and get executed at the right time. Examples:
- "Include the Adidas partnership summary in the next weekly report"
- "Always flag emails from investors mentioning valuation as critical"
- "When you process the next email from Nike, remind me about the pending contract"

**Impact:** CEO cannot delegate forward-looking work to the brain. Every interaction is fire-and-forget.

### 3.4 Report Generator Is Activity-Only

The weekly report pulls from tasks, correspondence, contacts, and activity — all operational data. It has no connection to the knowledge_base. Strategic documents uploaded to the brain are invisible to the report generator.

**Impact:** CEO uploads a strategic partnership document but it never appears in reports. The brain "knows" about it (it's stored and classified) but can't use it.

### 3.5 No Cross-Source Intelligence

The brain processes each data stream independently. Email scanner → tasks. Slack scanner → tasks. Document ingestion → knowledge_base. There's no layer that connects signals across sources.

**Impact:** CEO sends an email about Adidas, uploads an Adidas partnership doc, and has a Slack thread about Adidas — but the brain can't synthesize "here's everything we know about Adidas."

---

## 4. Target Architecture

### 4.1 Overview

```
                          ┌─────────────────────┐
                          │    CEO Interface     │
                          │  (MCP Server +       │
                          │   Dashboard Chat)    │
                          └─────────┬───────────┘
                                    │
                          ┌─────────▼───────────┐
                          │  Instruction Engine  │
                          │  (brain.instructions │
                          │   table — standing   │
                          │   orders + one-time  │
                          │   prompts)           │
                          └─────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────▼──────┐   ┌─────────▼──────┐   ┌─────────▼──────┐
    │  RAG Retrieval  │   │  Report Engine  │   │  Task Engine   │
    │  (pgvector +    │   │  (enhanced to   │   │  (current      │
    │   semantic      │   │   pull from KB  │   │   pipeline)    │
    │   search)       │   │   + follow      │   │                │
    │                 │   │   instructions) │   │                │
    └─────────┬──────┘   └─────────┬──────┘   └────────────────┘
              │                     │
    ┌─────────▼─────────────────────▼──────────────────────────┐
    │                    Knowledge Store                        │
    │  knowledge_base (docs, emails, Slack, uploads)           │
    │  + pgvector embeddings on content_chunks                 │
    │  + brain.tasks, brain.correspondence, brain.activity     │
    └──────────────────────────────────────────────────────────┘
```

### 4.2 Component Specifications

#### 4.2.1 RAG Layer — Vector Embeddings + Semantic Search

**Purpose:** Make stored knowledge searchable by meaning, not just keywords.

**Implementation:**

```sql
-- Enable pgvector extension in Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to knowledge_base
ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create a dedicated chunks table for granular retrieval
CREATE TABLE brain.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),  -- OpenAI text-embedding-3-small or similar
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity index (IVFFlat for speed, or HNSW for accuracy)
CREATE INDEX ON brain.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Document-level embedding for coarse search
CREATE INDEX ON knowledge_base
  USING hnsw (embedding vector_cosine_ops);
```

**Embedding pipeline:**
1. On ingestion: after chunking, embed each chunk via OpenAI `text-embedding-3-small` (or Anthropic's embedding API when available)
2. Store chunk embeddings in `knowledge_chunks` table
3. Store document-level embedding (summary text) on `knowledge_base` row
4. Search function:

```sql
-- Find top N chunks semantically similar to a query
CREATE OR REPLACE FUNCTION brain.search_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  kb_id UUID,
  chunk_id UUID,
  chunk_index INTEGER,
  content TEXT,
  title TEXT,
  source_type TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.kb_id,
    kc.id as chunk_id,
    kc.chunk_index,
    kc.content,
    kb.title,
    kb.source_type,
    1 - (kc.embedding <=> query_embedding) as similarity
  FROM brain.knowledge_chunks kc
  JOIN knowledge_base kb ON kb.id = kc.kb_id
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Embedding model options:**
| Model | Dimensions | Cost | Notes |
|---|---|---|---|
| OpenAI `text-embedding-3-small` | 1536 | $0.02/1M tokens | Best cost/performance ratio |
| OpenAI `text-embedding-3-large` | 3072 | $0.13/1M tokens | Higher accuracy |
| Voyage AI `voyage-3` | 1024 | $0.06/1M tokens | Strong for code + text |
| Cohere `embed-v4.0` | 1024 | $0.10/1M tokens | Good multilingual support |

**Recommendation:** Start with `text-embedding-3-small` (1536d). Supabase pgvector supports it natively. Cost is negligible at MiM's scale.

#### 4.2.2 Instruction Engine — `brain.instructions` Table

**Purpose:** Persistent memory for CEO commands that the brain executes at the right time.

```sql
CREATE TABLE brain.instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What type of instruction
  type TEXT NOT NULL CHECK (type IN (
    'report_inclusion',    -- "Include X in next report"
    'standing_order',      -- "Always flag emails about Y as critical"
    'one_time_query',      -- "Summarize everything about Z"
    'scheduled_action',    -- "Remind me about X next Monday"
    'entity_watch'         -- "Track all activity related to Adidas"
  )),

  -- The instruction itself
  prompt TEXT NOT NULL,           -- Natural language instruction from CEO

  -- Context linking
  source_kb_ids UUID[],           -- Knowledge base docs this relates to
  source_entity_ids UUID[],       -- Orgs/contacts this relates to
  taxonomy_categories TEXT[],     -- Categories this applies to

  -- Execution state
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',       -- Ready to be executed
    'fulfilled',    -- One-time instruction completed
    'paused',       -- Temporarily disabled
    'expired',      -- Past its deadline
    'cancelled'     -- User cancelled
  )),

  -- Scheduling
  execute_at TIMESTAMPTZ,         -- For scheduled actions
  expires_at TIMESTAMPTZ,         -- Auto-expire standing orders
  recurrence TEXT,                -- 'once', 'weekly', 'on_report', 'on_scan'

  -- Results
  last_executed_at TIMESTAMPTZ,
  execution_result JSONB,         -- What happened when it ran
  execution_count INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON brain.instructions (status, type);
CREATE INDEX ON brain.instructions USING GIN (source_entity_ids);
CREATE INDEX ON brain.instructions (execute_at) WHERE status = 'active';
```

**Instruction lifecycle examples:**

```
CEO: "Summarize the Adidas partnership doc and include it in the next weekly report"

→ brain.instructions row:
  type: 'report_inclusion'
  prompt: 'Summarize the Adidas partnership document for the weekly report.
           Focus on deal terms, timeline, and next steps.'
  source_kb_ids: ['uuid-of-adidas-doc']
  status: 'active'
  recurrence: 'once'

→ When weekly report runs:
  1. Query: SELECT * FROM brain.instructions WHERE status='active' AND type='report_inclusion'
  2. For each instruction:
     a. RAG search: retrieve relevant chunks from source_kb_ids
     b. Feed to Claude alongside normal report context
     c. Claude generates a section for the report
  3. Mark instruction as 'fulfilled'
```

```
CEO: "Always flag emails mentioning valuation or term sheet from investors as critical"

→ brain.instructions row:
  type: 'standing_order'
  prompt: 'Escalate to critical priority any email from investors that
           mentions valuation, term sheet, or funding round.'
  taxonomy_categories: ['fundraising']
  status: 'active'
  recurrence: 'on_scan'

→ When email scanner runs:
  1. Query: SELECT * FROM brain.instructions WHERE status='active' AND type='standing_order' AND recurrence='on_scan'
  2. Inject matching instructions into classifier prompt context
  3. Classifier sees the standing order and adjusts priority accordingly
```

#### 4.2.3 MCP Server — Conversational Interface

**Purpose:** Let the CEO talk to the brain through Claude (Desktop, Code, or any MCP client) using natural language.

**Why MCP over a custom chat UI:**
1. Claude already understands natural language — no need to build NLU
2. MCP tools give structured access to brain data
3. Works from Claude Desktop, Claude Code, or any future MCP client
4. The brain becomes an API that any AI can call

**Tool inventory** (from existing `docs/mcp-server-plan.md`, extended):

| Domain | Tool | Description |
|---|---|---|
| **Knowledge** | `search_knowledge` | Semantic search over knowledge_base via RAG |
| **Knowledge** | `ingest_document` | Upload/ingest text or file into knowledge_base |
| **Knowledge** | `get_document` | Retrieve a specific document with chunks |
| **Instructions** | `create_instruction` | CEO gives brain a command (report inclusion, standing order, etc.) |
| **Instructions** | `list_instructions` | Show active/pending instructions |
| **Instructions** | `update_instruction` | Modify or cancel an instruction |
| **Reports** | `generate_report` | Trigger report generation (with instruction fulfillment) |
| **Reports** | `get_report` | Retrieve a specific report |
| **Tasks** | `list_tasks` | Query tasks with filters |
| **Tasks** | `create_task` | Create a task manually |
| **Tasks** | `update_task` | Approve, dismiss, edit a task |
| **Entities** | `search_orgs` | Search organizations |
| **Entities** | `get_entity_dossier` | Full intelligence profile for an org/contact |
| **Entities** | `search_contacts` | Search contacts |
| **Intelligence** | `ask_brain` | General-purpose Q&A (RAG + instructions + entity context) |
| **Intelligence** | `get_activity_feed` | Recent brain activity |
| **Intelligence** | `get_business_summary` | Cross-source synthesis for an entity or topic |
| **Scanners** | `trigger_scan` | Run email/Slack/sentiment scanner |
| **Pipeline** | `list_pipeline` | Pipeline deals with status |
| **Pipeline** | `update_pipeline` | Move deals through stages |

**The `ask_brain` tool** is the key differentiator — it's the general-purpose query tool:

```typescript
// Pseudocode for ask_brain
async function ask_brain(question: string) {
  // 1. Embed the question
  const queryEmbedding = await embed(question);

  // 2. RAG retrieval — find relevant knowledge chunks
  const relevantChunks = await supabase.rpc('search_knowledge', {
    query_embedding: queryEmbedding,
    match_count: 15,
    match_threshold: 0.65
  });

  // 3. Find relevant entities mentioned in the question
  const entities = await resolveEntities(question);

  // 4. Get entity dossiers for context
  const dossiers = await Promise.all(
    entities.map(e => buildEntityDossier(e.id))
  );

  // 5. Check for active instructions related to this query
  const instructions = await getRelevantInstructions(question, entities);

  // 6. Get recent activity for mentioned entities
  const recentActivity = await getEntityActivity(entities, { days: 30 });

  // 7. Synthesize with Claude
  const answer = await claude.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    system: `You are the MiM Brain — the intelligence layer for Made in Motion.
             Answer the CEO's question using ONLY the provided context.
             Cite your sources. If you don't have enough information, say so.`,
    messages: [{
      role: 'user',
      content: `
        ## Question
        ${question}

        ## Knowledge Base Context
        ${relevantChunks.map(c => `[${c.title}] ${c.content}`).join('\n\n')}

        ## Entity Dossiers
        ${dossiers.map(d => formatDossier(d)).join('\n\n')}

        ## Recent Activity
        ${recentActivity.map(a => formatActivity(a)).join('\n')}

        ## Active Instructions
        ${instructions.map(i => i.prompt).join('\n')}
      `
    }]
  });

  return answer;
}
```

#### 4.2.4 Enhanced Report Generator

**Purpose:** Reports that draw from strategic documents and fulfill CEO instructions.

**Changes to `weekly-report-generator.ts`:**

```
Current flow:
  Scan emails/Slack → Gather tasks/correspondence/contacts → Claude synthesis

Enhanced flow:
  Scan emails/Slack
    → Gather tasks/correspondence/contacts (existing)
    → Query brain.instructions WHERE type='report_inclusion' AND status='active'
    → For each instruction:
        RAG search source_kb_ids → retrieve relevant chunks
        Build instruction context block
    → Query brain.instructions WHERE type='entity_watch' AND status='active'
    → For each watched entity:
        Get entity dossier + recent activity
        Build watch context block
    → Claude synthesis with additional context sections:
        - "## Strategic Context" (from report_inclusion instructions)
        - "## Entity Watch Updates" (from entity_watch instructions)
    → Mark one-time instructions as 'fulfilled'
```

#### 4.2.5 Dashboard Brain Chat (Optional — Phase 2)

A lightweight chat interface on the dashboard for quick brain interactions without leaving the app.

```
┌─────────────────────────────────────────────┐
│  🧠 Ask the Brain                       ▾  │
├─────────────────────────────────────────────┤
│                                             │
│  You: What's our current status with Nike?  │
│                                             │
│  Brain: Based on 3 emails, 1 uploaded doc,  │
│  and 2 Slack threads from the last 30 days: │
│                                             │
│  Nike is in active partnership discussions. │
│  Last email (Mar 8) from Sarah at Nike      │
│  confirmed interest in a pilot program for  │
│  youth team stores. Key next step is the    │
│  Mar 15 call to discuss terms.              │
│                                             │
│  Sources: [Nike Partnership Brief], [Email  │
│  from sarah@nike.com 3/8], [#partnerships   │
│  Slack thread 3/7]                          │
│                                             │
├─────────────────────────────────────────────┤
│  Ask the brain...                     Send  │
└─────────────────────────────────────────────┘
```

This would call the same `ask_brain` logic as the MCP server, just rendered in the dashboard UI.

---

## 5. How the Brain Retains and Evolves Intelligence

### 5.1 Knowledge Retention Model

```
              ┌─────────────┐
              │  Raw Input   │ ← emails, Slack, uploads, news
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Processed   │ ← extracted text, classified, tagged
              │  Storage     │   (knowledge_base + correspondence)
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Embedded    │ ← vector representations for search
              │  Chunks      │   (knowledge_chunks with pgvector)
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Connected   │ ← entity links, taxonomy categories,
              │  Graph       │   cross-references between docs
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Behavioral  │ ← CEO feedback signals, entity scores,
              │  Memory      │   learned priorities (entity_feedback)
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Instruction │ ← standing orders, watch lists,
              │  Memory      │   pending actions (brain.instructions)
              └─────────────┘
```

### 5.2 Verification — "Did the Brain Retain This?"

Three mechanisms to confirm the brain understood and stored information:

1. **Ingestion receipt:** After upload, the brain returns summary + categories + entity links. CEO can review on `/knowledge` page.

2. **Retrieval proof:** When generating reports or answering questions, the brain cites which `knowledge_base` entries and chunks it drew from. Every claim is linked to a source.

3. **Instruction confirmation:** When a standing order fires, the brain logs the execution in `brain.instructions.execution_result` with what it did and why.

### 5.3 Intelligence Evolution

The brain gets smarter over time through:

| Signal | Source | Effect |
|---|---|---|
| Approve/dismiss patterns | ApprovalQueue | `entity_feedback.usefulness_score` adjusts classifier behavior |
| Manual edits | Task detail page | Classifier learns preferred priority, wording, action style |
| Standing orders | `brain.instructions` | Classifier prompt includes active instructions as context |
| Taxonomy tuning | `/settings/taxonomy` | Signal keywords and priority rules update dynamically |
| Knowledge accumulation | Ingestion pipeline | RAG retrieval becomes richer as more docs are stored |
| Entity dossiers | Auto-built | More correspondence = richer entity profiles |

---

## 6. Does RAG Satisfy the Full Scope?

**No. RAG is necessary but not sufficient.**

| Capability | RAG alone | RAG + Instructions + MCP |
|---|---|---|
| "Find info about X" | Yes | Yes |
| "Summarize this doc" | Yes (one-time) | Yes |
| "Include this in next report" | No — no instruction persistence | Yes — `report_inclusion` instruction |
| "Always flag emails about Y" | No — no standing orders | Yes — `standing_order` instruction |
| "What's our status with Nike?" | Partial — no cross-source synthesis | Yes — `ask_brain` tool with dossiers |
| "Remind me about X next week" | No — no scheduling | Yes — `scheduled_action` instruction |
| Brain learns from my behavior | No | Yes — feedback engine + entity_feedback |

**RAG gives the brain a library card. Instructions give it a to-do list. MCP gives it a voice.**

---

## 7. Does an MCP Server Satisfy the Full Scope?

**Yes, when combined with RAG and the instruction engine.**

The MCP server is the **interface layer** — it's how the CEO talks to the brain. But it needs the underlying infrastructure:

```
MCP Server (interface)
  → needs RAG (retrieval)
  → needs Instructions table (memory/persistence)
  → needs Entity dossiers (cross-source intelligence)
  → needs Report generator integration (output)
```

**What MCP adds beyond a custom chat UI:**
1. Works from Claude Desktop — CEO can ask brain questions without opening the app
2. Works from Claude Code — agents can query the brain programmatically
3. Extensible — any future AI tool can connect to the brain
4. No custom NLU needed — Claude handles natural language interpretation
5. Tool composition — Claude can chain multiple brain tools in one interaction

---

## 8. Implementation Phases

### Phase A: Foundation — Vector Embeddings (1-2 days)

**Goal:** Make stored knowledge searchable.

- [ ] Enable `pgvector` extension in Supabase
- [ ] Create `brain.knowledge_chunks` table with `embedding vector(1536)`
- [ ] Add embedding column to `knowledge_base` for document-level search
- [ ] Create `brain.search_knowledge` RPC function
- [ ] Build embedding pipeline: on ingestion, call OpenAI `text-embedding-3-small` for each chunk
- [ ] Backfill embeddings for existing `knowledge_base` entries
- [ ] Add `/api/brain/search` endpoint for testing

### Phase B: Instruction Engine (1-2 days)

**Goal:** Give the brain persistent memory for CEO commands.

- [ ] Create `brain.instructions` table (schema above)
- [ ] Build instruction CRUD API (`/api/brain/instructions`)
- [ ] Wire `report_inclusion` type into weekly report generator
- [ ] Wire `standing_order` type into email/Slack scanner classifier prompt
- [ ] Wire `entity_watch` type into report generator
- [ ] Add instruction status tracking + execution logging

### Phase C: MCP Server (2-3 days)

**Goal:** Conversational interface to the brain.

- [ ] Scaffold MCP server (TypeScript, direct Supabase connection)
- [ ] Implement core tools: `search_knowledge`, `ingest_document`, `get_document`
- [ ] Implement instruction tools: `create_instruction`, `list_instructions`, `update_instruction`
- [ ] Implement intelligence tools: `ask_brain`, `get_entity_dossier`, `get_business_summary`
- [ ] Implement report tools: `generate_report`, `get_report`
- [ ] Implement task tools: `list_tasks`, `create_task`, `update_task`
- [ ] Implement scanner tools: `trigger_scan`
- [ ] Implement pipeline tools: `list_pipeline`, `update_pipeline`
- [ ] Test from Claude Desktop

### Phase D: Enhanced Report Generator (1 day)

**Goal:** Reports that include strategic context and fulfill instructions.

- [ ] Modify report generator to query `brain.instructions` for `report_inclusion` and `entity_watch` types
- [ ] Add RAG retrieval step for instruction-linked documents
- [ ] Add "Strategic Context" and "Entity Watch" sections to report template
- [ ] Mark fulfilled instructions post-generation
- [ ] Test end-to-end: upload doc → create instruction → generate report → verify inclusion

### Phase E: Dashboard Brain Chat (1-2 days, optional)

**Goal:** Quick brain interaction without leaving the app.

- [ ] Build chat component on dashboard
- [ ] Create `/api/brain/ask` endpoint (reuses MCP `ask_brain` logic)
- [ ] Streaming response support
- [ ] Source citation display
- [ ] Chat history persistence (optional)

---

## 9. Data Flow — End-to-End Example

**Scenario:** CEO uploads an Adidas partnership strategy document and says "Summarize the key terms and include them in this week's report."

```
Step 1: Document Upload
  └─ /api/brain/ingest receives PDF
  └─ document-processor extracts text, splits into 12 chunks
  └─ Claude classifies: tags=["partnership", "adidas", "retail"],
     taxonomy=["partnerships"], entities=[adidas-org-id]
  └─ Stored in knowledge_base (id: kb-123)
  └─ Each chunk embedded → stored in knowledge_chunks

Step 2: Instruction Created
  └─ Via MCP tool or chat UI: create_instruction({
       type: "report_inclusion",
       prompt: "Summarize key partnership terms from the Adidas doc",
       source_kb_ids: ["kb-123"],
       recurrence: "once"
     })
  └─ Stored in brain.instructions (id: instr-456, status: active)

Step 3: CEO Triggers Weekly Report
  └─ Report generator starts
  └─ Gathers normal data (tasks, correspondence, contacts, activity)
  └─ Queries brain.instructions → finds instr-456 (report_inclusion, active)
  └─ RAG retrieval: search knowledge_chunks WHERE kb_id = kb-123
  └─ Retrieves top 8 chunks about partnership terms
  └─ Injects into Claude prompt:
     "## CEO Instruction: Include Adidas Partnership Summary
      Based on [Adidas Partnership Strategy.pdf]:
      [chunk 1 text] [chunk 4 text] [chunk 7 text] ..."
  └─ Claude generates report with new section:
     "## Strategic Partnerships
      Adidas partnership terms outline a 12-month pilot for youth
      team stores with revenue share model..."
  └─ Report saved, instruction marked as fulfilled

Step 4: Verification
  └─ CEO opens report, sees Adidas section
  └─ Report metadata links to source: kb-123
  └─ instruction instr-456 shows: status=fulfilled,
     execution_result={report_id: "...", sections_added: 1}
```

---

## 10. Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Vector store | Supabase pgvector | Already using Supabase, native support, no new infra |
| Embedding model | OpenAI `text-embedding-3-small` | Best cost/performance, 1536d, widely supported |
| MCP server runtime | TypeScript (Node.js) | Matches existing codebase, direct Supabase client |
| MCP transport | stdio (local) → SSE (remote) | stdio for Claude Desktop, SSE for web clients |
| Instruction execution | Pull-based (checked at scan/report time) | Simpler than push-based; matches existing scan cadence |
| Chat UI | Optional Phase E | MCP server provides interface; dashboard chat is convenience |

---

## 11. Open Questions

1. **Embedding costs at scale:** At ~$0.02/1M tokens, embedding a 50-page PDF costs <$0.01. Should be negligible, but need to monitor if ingestion volume grows significantly.

2. **Chunk size tuning:** Currently ~500 tokens. May need adjustment based on retrieval quality. Larger chunks = more context per result but fewer results. Smaller chunks = more precise but may lose context.

3. **Instruction priority:** If multiple standing orders conflict (one says "flag as critical", another says "ignore newsletters from this domain"), how do we resolve? Proposal: explicit priority field on instructions, most recent wins on ties.

4. **MCP server hosting:** Run locally (stdio) for Claude Desktop, or deploy as a service? For now, local stdio is simplest. Can add SSE transport later for web/mobile access.

5. **Backfill strategy:** ~How many existing knowledge_base entries need embedding? Should we batch-process or embed on-demand when first queried?

6. **Chat history:** Should brain chat conversations be persisted? If so, where? Could be useful for the brain to remember "we discussed Adidas yesterday" but adds complexity.

---

## 12. Success Criteria

The brain intelligence layer is complete when the CEO can:

- [ ] Upload a strategic document and confirm the brain understood it (summary, tags, entity links)
- [ ] Say "include this in the next report" and see it appear in the generated report
- [ ] Ask "what do we know about Adidas?" and get a synthesized answer with citations
- [ ] Set a standing order ("always flag term sheet emails as critical") and see it enforced
- [ ] Generate a weekly report that includes strategic context alongside operational data
- [ ] Trust that the brain retains information across sessions and gets smarter over time
