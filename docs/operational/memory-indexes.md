# Memory indexes — Knowledge vs Messages
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC  
> **Status:** Operational reference for how durable recall is stored and queried.  
> **Last updated:** 2026-03-22

---

## Why two indexes?

In Motion does **not** use one physical table for every kind of text. There are two **vector indexes** (chunk + embedding) because the **source data** is shaped differently:

| Index (operator name) | Tables | Typical sources |
|----------------------|--------|-----------------|
| **Knowledge index** | `knowledge_base` + `brain.knowledge_chunks` | Canvas file uploads, Canvas text sent through ingest, API documents |
| **Messages index** | `brain.correspondence` + `brain.correspondence_chunks` | Gmail, Slack, and similar message pipelines |

**Chat UI state** (ordered threads) is separate: `brain.clearing_messages`. Substantive Canvas text is also copied into the **Knowledge index** via `/api/brain/ingest` so it can be found in Q&A.

---

## How recall works in one place

`/api/brain/ask` combines:

- Session and recent-document shortcuts (inline `content_text` where applicable)
- **Knowledge index** — RPC `search_knowledge`, plus `search_knowledge_for_kb` for large single documents
- **Messages index** — RPC `search_correspondence`

Shared vector logic for the two global RPCs lives in **`src/lib/search-memory.ts`** (`appendGlobalVectorMemoryToContext`) so thresholds and pairing stay in one module.

---

## Instrumentation

- **Knowledge:** `knowledge_ingested` activity rows include `memory_index`, `vector_chunks_expected`, `vector_chunks_embedded`, `embed_ok`.
- **Messages:** successful or failed embedding writes emit `memory_index_write` with `memory_index: "messages"`, `chunk_count`, `embed_ok`.

Server logs also print `[memory-index] …` for quick grepping.

**High-volume Messages index:** By default, successful `memory_index_write` activity rows are **not** inserted for every Gmail/Slack embed (to avoid spamming `brain.activity`). Failures still log. Set environment variable `MEMORY_INDEX_ACTIVITY_SUCCESS=1` to record successful message embeds to activity as well.

---

## Related code

- `src/lib/search-memory.ts` — unified vector recall API + logging helper  
- `src/app/api/brain/ask/route.ts` — builds Q&A context from both indexes  
- `src/app/api/brain/ingest/route.ts` — writes Knowledge index chunks  
- `src/lib/feed-card-emitter.ts` — `embedCorrespondence` writes Messages index chunks  
