# CLAUDE.md — Read This First
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active session instructions. Must be read before any work begins.
> **Last updated:** 2026-03-20

---

## What is this project?

**In Motion** is an autonomous business intelligence platform for Made in Motion PBC, a business engaged in creating innovative new methods and products for the Generative or Agentic Commerce future. The In Motion platform processes business data (emails, messages, documents), classifies it, prioritises it, and recommends actions — with the goal of becoming an autonomous or semi autonomous execution asset to the Chief Operating Officer in phase 1, to the founding team in phase 2, and then finally to the market that the company is seeking to participate in in phase 3.

**We are in Phase 1 (The 1):** One user — the CEO — operating entirely through the feed. Everything else is horizon planning.

---

## Three Surfaces (All Built and Live)

1. **Your Motion** (`/`) — A scrollable feed of interactive cards. The CEO's entire operational life streams here. Everything is ephemeral. No permanent pages.
2. **Your Canvas** (`/clearing`) — A thinking/prep space. UI label: **Canvas**. Freeform notes, file ingestion, brain-assisted reflection. NOT a creation tool — the platform is a gate, not a workshop.
3. **Engine Room** (`/engine`) — Configuration layer. Motion Map (brain's operating logic made visible), integrations, health dashboard, autonomy progress.

There is also a **Me page** (`/me`) showing brain accuracy stats, manual scan triggers, and quick access links including Bulk Data Import Gopher.

---

## Architecture Principles

- **No Pages** — Data views are "snapshots" generated on demand into the feed, not static routes
- **Burning Man** — Celebrate impermanence. Nothing persists as a permanent page.
- **Gate, Not Workshop** — We don't compete with Google Slides, Excel, etc. We're the gate everything passes through.
- **No notification badges** — The feed IS the notification system
- **Single Ingestion Point** — All data enters through one endpoint. Brain classifies, decides, acts, emits cards. No UI writes directly to the database.

---

## Doc Reading Order

1. `docs/strategic/platform-pivot-march-2026.md` — **START HERE.** Strategic pivot from correctness to contextual suggestions. Foundation excellence requirements. Build order.
2. `docs/product/ui-requirements.md` — Governing architecture (Motion, Canvas/Clearing, Engine Room, card types, emotional design)
3. `docs/product/design-brief.md` — Figma-actionable specs (card anatomy, screen layouts, visual language)
4. `docs/technical/architecture-mimbrain-v2.md` — Backend architecture (entity-centric, three memory types, harness, autonomy layer) — north star
5. `docs/operational/master-effort-list.md` — All efforts/epics with status
6. `docs/product/stack-glossary.md` — Vocabulary definitions
7. `docs/technical/specs/unified-classifier-spec.md` — Attention classification, signal quality, Decision/Action/Task ontology
8. `docs/technical/specs/brain-intelligence-layer-spec.md` — RAG architecture, instruction persistence, MCP integration

---

## Tech Stack

- **Frontend:** Next.js 16 + Turbopack, Tailwind CSS, Geist font
- **Backend:** Supabase (Postgres, multi-schema: core/crm/intel/platform/brain), pgvector
- **Deployment:** Vercel — always deploy with `npx vercel --prod --yes` from `/Users/markslater/Desktop/mim-platform`
- **Production URL:** `mim-platform.vercel.app`
- **AI:** Claude API for classification, synthesis, chat; OpenAI for embeddings (`OPENAI_API_KEY` set in Vercel)
- **MCP Server:** 28 tools across 9 domains (built, not yet deployed to host)

---

## Terminology

| Term | Meaning |
|------|---------|
| In Motion | Platform working title (replaces MiMBrain) |
| Your Motion | The feed — CEO's operational life stream |
| Your Canvas | Thinking/prep space — UI label for the `/clearing` route (NOT a creation tool) |
| Engine Room | Configuration layer (was "Settings") |
| Motion Map | CEO's readable view of the brain's operating logic |
| Harness | Technical implementation underneath the Motion Map (markdown classifier files) |
| Acumen | Decision engine (classifiers + harness + decision log) |
| Gopher | Autonomous worker that scans a data source (replaces "Scanner") |
| Snapshotting | Brain compiles visual data on demand into the feed |
| Card | Interactive unit in the feed (Decision, Action, Signal, Briefing, Snapshot, Intelligence, Reflection) |
| Attention Class | P0/P1/P2/P3 (email) or S0/S1/S2/S3 (Slack) — CEO-relevance tier |

---

## Strategic Direction (March 20, 2026)

> **Full decision document:** `docs/strategic/platform-pivot-march-2026.md`

The platform is pivoting from **zero-tolerance correctness** (Do/Hold/No) to **contextual intent suggestions** (Read/Respond/Write/Schedule). The backend intelligence (Acumen categories, embeddings, classification log, behavioral rules, autonomy engine) continues unchanged — the shift is in how suggestions are presented to the CEO.

**Before building the intent suggestion UI, the foundation must be bulletproof:**
1. Full-body comprehension (read entire documents, not just first 3K chars) — 🔴 IN PROGRESS
2. Bulletproof recall (anything submitted in last 7 days instantly recallable) — 🔴 IN PROGRESS
3. Entity resolution depth (fuzzy matching, alias resolution, relationship inference) — 🟡 PLANNED
4. Intent suggestion UI (Read/Respond/Write/Schedule) — 🟡 AFTER FOUNDATION

**Key principle:** The death of this product is when data is submitted and it cannot be recalled, or is incomplete in its recollection. All or nothing — partial comprehension has zero value.

---

## Current State (March 20, 2026)

### What Is Built and Working

- **Gmail Gopher** — Classifying live email with 11 Acumen categories, emitting feed cards with full email metadata (from/to/subject), thread consolidation, deduplication via `source_ref`
- **Slack Gopher** — Scanning Slack with the same Acumen classifier, assistant prefill for reliable JSON output, noise filter (P3/S3 cards suppressed), action extraction rules
- **Feed cards** (`brain.feed_cards`) — 7 card types, priority-based styling, Do/Hold/No/Noted/Dismiss actions (transitioning to Read/Respond/Write/Schedule), More About This expansion, action recommendations, training mode framing, Train button on all cards
- **Your Motion** — Feed-first architecture complete at `/`. Filter pills (All, Decisions, Actions, Signals, Intel, Briefings, Old). Actioned cards disappear immediately from active view.
- **Your Canvas** — Persistent sessions/messages at `/clearing`. Brain Q&A with multi-turn conversation history. File ingestion via drag-and-drop (pdf-parse, Claude Vision, Supabase Storage). Auto-embedding of all substantive messages into permanent knowledge base. Cross-session memory retrieval.
- **Engine Room** — Motion Map (harness classifier MDs), Brain Accuracy (per-category stats), Autonomy progress, Integrations status, Platform Health, Signal Quality metrics
- **Decision logging** — `brain.classification_log` records every classification. Every CEO action (Do/No/Hold) logged to `brain.decision_log` as training data.
- **Correction learning** — `/api/brain/learn` stores corrections as institutional memory with vector embeddings for RAG retrieval. Feed card PATCH auto-fires learning.
- **Daily briefing** — Vercel cron at 7am EST synthesises last 24h into briefing card
- **Gmail Gopher cron** — Vercel cron at 6am EST scans last 4 hours
- **Autonomy engine** — Categories earn self-governance at 20+ reviews / 90%+ accuracy
- **Behavioral rules engine** — `brain.behavioral_rules` table with adaptation agent
- **Instruction loader** — `src/lib/instruction-loader.ts` loads CEO standing orders into scanner prompts
- **Snapshotting** — Natural language → data query → snapshot card in feed. Visual charts (bar, line, area, pie) via Recharts when data supports visualization.
- **Visual chart rendering** — `src/components/FeedChart.tsx` + Recharts. Claude generates ` ```chart` JSON blocks in snapshots, briefings, and reports. Supports bar, line, area, pie, horizontal bar, multi-series. Dynamic import (no SSR).
- **Web Intelligence source configuration** — Engine Room Integrations tab has source manager UI. Add/remove RSS feeds and webpage URLs. `/api/engine/web-sources` CRUD API. Auto-migrates defaults on first custom add.
- **Bulk Data Import Gopher** — `/engine/import` for historical email ingestion. Also accessible as a row on the Me page.
- **Embedding/RAG pipeline** — `brain.knowledge_chunks` table with pgvector. `search_knowledge` and `search_correspondence` RPC functions. OpenAI `text-embedding-3-small` embeddings generating on ingestion. Semantic search active. Canvas messages auto-embedded.
- **Document ingestion** — pdf-parse (text PDFs), Claude Vision fallback (image-based PDFs < 5MB), direct Supabase Storage signed upload (files > 4MB), XLSX/PPTX/DOCX/TXT/CSV support

### Active Gaps (Foundation Excellence)

- **Full-body comprehension** — Classifier reads only first 3,000 chars of documents. Must process entire content. This is the #1 priority.
- **Recall reliability** — Vector search can miss recent submissions. Must guarantee recall of anything from last 7 days.
- **Entity resolution depth** — Contacts are name + email only. No fuzzy matching, no alias resolution, no relationship inference.
- **MCP Server deployment** — 28 tools built, not yet deployed to a host.

---

## Critical Rules for Any Agent

- **Work ONLY from `/Users/markslater/Desktop/mim-platform` on the `main` branch.** Never create git worktrees. Never deploy from any subdirectory.
- **Deploy ONLY with** `cd /Users/markslater/Desktop/mim-platform && npx vercel --prod --yes` — targets `mim-platform.vercel.app`
- **Never use `<Image>` for SVGs** — use `<img>` tags (SVG compatibility issue with Next.js Image)
- **Never build static CRM pages** or add sidebar navigation items
- **Never build creation tools** inside Your Canvas (it's a gate, not a workshop)
- **Never add notification badges or counts**
- **Never change the backend architecture** — `architecture-mimbrain-v2.md` is the north star
- **Use "In Motion"** as the platform name (not MiMBrain)
- **Use "Gopher"** for automated workers (not Scanner)
- **Use "Canvas"** as the UI label for the `/clearing` route
- **All document headers** must follow the standard format:
  ```
  # Document Title
  > **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
  > **Status:** [status description]
  > **Last updated:** YYYY-MM-DD
  ```
