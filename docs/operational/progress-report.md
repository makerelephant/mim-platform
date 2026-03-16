# MiMBrain — Progress Report

> **Date:** March 15, 2026 (evening update)
> **Purpose:** Context when resuming on another machine

---

## Where We Are

All Phase 1 infrastructure is built and deployed. The platform has three working surfaces (Motion, Clearing, Engine Room), a Gmail scanner classifying live email, daily briefing synthesis, an autonomy engine, correction learning, and bulk email import.

**In one sentence:** The skeleton is built. The brain can ingest, classify, surface, and learn from corrections. But it hasn't been trained yet and the semantic memory layer needs an embeddings API key to activate.

---

## What Works

| Capability | Status |
|-----------|--------|
| Gmail scanning + classification (11 categories) | ✅ Live daily cron |
| Feed cards with email context (from/to/subject) | ✅ Live |
| Thread consolidation (same Gmail thread → one card) | ✅ Built, needs step-17 SQL + re-import |
| CEO card actions (Do/Hold/No on decisions, Noted/Dismiss on signals) | ✅ Live |
| Train button + correction modal on every card | ✅ Built |
| Training mode framing ("Brain classified this as X. Correct?") | ✅ Built |
| Correction learning pipeline (corrections → institutional memory) | ✅ Built |
| Action recommendations on decision cards | ✅ Built (new emails only) |
| Card type inference (conservative — only critical → decision) | ✅ Built |
| Daily briefing synthesis | ✅ Built |
| Bulk email import (/engine/import) | ✅ Built |
| Snapshotting (NL queries → data cards) | ✅ Built |
| Your Clearing (thoughts, brain Q&A, file ingestion) | ✅ Built |
| Engine Room (Motion Map, accuracy, autonomy, integrations) | ✅ Built |
| Autonomy engine (categories earn self-governance) | ✅ Built |
| RAG tables + embedding code | ✅ Built but NOT ACTIVE |

---

## Key Deficits — In Priority Order

### 1. Memory / RAG Is Not Active (blocks the brain from being intelligent)

The brain can store knowledge but cannot semantically retrieve it. "What do we know about Adidas?" returns keyword matches only — misses anything without the literal word.

Vector embeddings are needed. The code and tables exist but require an API to generate vectors. **Claude does not offer an embeddings API.** This is not optional — without it, the brain has no semantic memory, which is foundational to the architecture (three memory types: episodic, semantic, procedural).

**Options:**
1. **OpenAI embeddings** — $0.02/1M tokens, code already written, utility-only (all reasoning stays on Claude)
2. **Voyage AI** — Anthropic's recommended partner, would need code changes
3. **Skip** — Keyword search only. Significantly weaker. Not recommended for this project scope.

**This is a decision point for the CEO.**

### 2. Training Volume Is Zero (blocks autonomy)

Autonomy requires 20+ reviewed cards per category at 90%+ accuracy. Currently: 0 reviews. The tools are all built — Train button, correction modal, learning pipeline, accuracy tracking. They just haven't been used.

**Sequence:** Step-17 SQL → re-import with threading → review cards → train → accuracy accumulates → categories earn autonomy.

### 3. Only One Data Source (limits brain's knowledge)

Gmail is the only connected input. Slack, calendar, Stripe, documents — all planned, architecturally supported, but not connected. The brain sees the world through one eye.

### 4. Entity Intelligence Is Shallow

Contacts are name + email. No enrichment, no derived insights, no profile building from accumulated interactions. The brain knows *about* people but doesn't *understand* them yet.

### 5. Hold/Resurface Not Wired

The `resurface_at` column exists but nothing reads it. Cards put on Hold disappear.

---

## What To Do Next (In Order)

1. **Run step-17 SQL** in Supabase (thread consolidation columns) — it's in clipboard or `sql/migration/step-17-thread-consolidation.sql`
2. **Decide on embeddings API** — OpenAI key? Voyage AI? Skip for now?
3. **Deploy latest** (push is happening now)
4. **Run bulk import** at `/engine/import` — 30 days of email
5. **Train** — Review cards, correct classifications
6. **Watch accuracy** at `/engine` → Brain Accuracy tab

---

## New Files This Session

| File | Purpose |
|------|---------|
| `src/lib/feed-card-emitter.ts` | Shared card emission + thread lookup + update functions |
| `src/lib/embeddings.ts` | OpenAI embedding client with chunking and batching |
| `src/app/api/brain/learn/route.ts` | Processes CEO corrections → institutional memory |
| `src/app/api/brain/learn/stats/route.ts` | Correction analytics |
| `src/app/api/brain/embed-backfill/route.ts` | Backfills embeddings for existing knowledge |
| `src/app/engine/import/page.tsx` | Bulk email import UI |
| `src/app/api/agents/gmail-bulk-import/route.ts` | Bulk import API |
| `sql/migration/step-16-rag-tables.sql` | knowledge_chunks, search RPCs, feed_cards correction columns |
| `sql/migration/step-17-thread-consolidation.sql` | thread_id, message_count, thread_updated_at columns |

---

## Architecture Note

The architecture document (v2) remains the north star. Nothing contradicts it. The feed-first UI, single ingestion point, harness classifier, and autonomy engine all align. The gap is depth — infrastructure exists but hasn't been exercised with volume.

*The brain can now learn. It needs reps and a decision on embeddings.*
