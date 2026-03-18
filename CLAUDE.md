# CLAUDE.md — Read This First
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active session instructions. Must be read before any work begins.
> **Last updated:** 2026-03-18

---

## What is this project?

**In Motion** is an autonomous business intelligence platform for Made in Motion, a youth sports technology company. It processes business data (emails, messages, documents), classifies it, prioritises it, and recommends actions — with the goal of becoming an autonomous Chief Operating Officer.

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

1. `docs/product/ui-requirements.md` — Governing architecture (Motion, Canvas/Clearing, Engine Room, card types, emotional design)
2. `docs/product/design-brief.md` — Figma-actionable specs (card anatomy, screen layouts, visual language)
3. `docs/technical/architecture-mimbrain-v2.md` — Backend architecture (entity-centric, three memory types, harness, autonomy layer) — north star
4. `docs/operational/master-effort-list.md` — All efforts/epics with status
5. `docs/product/stack-glossary.md` — Vocabulary definitions
6. `docs/technical/specs/unified-classifier-spec.md` — Attention classification, signal quality, Decision/Action/Task ontology
7. `docs/technical/specs/brain-intelligence-layer-spec.md` — RAG architecture, instruction persistence, MCP integration

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

## Current State (March 18, 2026)

### What Is Built and Working

- **Gmail Gopher** — Classifying live email with 11 Acumen categories, emitting feed cards with full email metadata (from/to/subject), thread consolidation, deduplication via `source_ref`
- **Slack Gopher** — Scanning Slack with the same Acumen classifier, assistant prefill for reliable JSON output, noise filter (P3/S3 cards suppressed), action extraction rules
- **Feed cards** (`brain.feed_cards`) — 7 card types, priority-based styling, Do/Hold/No/Noted/Dismiss actions, More About This expansion, action recommendations, training mode framing, Train button on all cards
- **Your Motion** — Feed-first architecture complete at `/`. Filter pills (All, Decisions, Actions, Signals, Intel, Briefings, Old). Actioned cards disappear immediately from active view.
- **Your Canvas** — Persistent sessions/messages at `/clearing`. Brain Q&A routed to `/api/brain/ask` for all inputs. File ingestion via drag-and-drop (pdf-parse for text PDFs, Claude Vision for image-based PDFs < 5MB, direct Supabase Storage upload bypass for files > 4MB). Sessions persist to `brain.clearing_sessions` / `brain.clearing_messages`. Prior Conversations panel.
- **Engine Room** — Motion Map (harness classifier MDs), Brain Accuracy (per-category stats), Autonomy progress, Integrations status, Platform Health, Signal Quality metrics
- **Decision logging** — `brain.classification_log` records every classification. CEO review via feed actions.
- **Correction learning** — `/api/brain/learn` stores corrections as institutional memory. Feed card PATCH auto-fires learning.
- **Daily briefing** — Vercel cron at 7am EST synthesises last 24h into briefing card
- **Gmail Gopher cron** — Vercel cron at 6am EST scans last 4 hours
- **Autonomy engine** — Categories earn self-governance at 20+ reviews / 90%+ accuracy
- **Behavioral rules engine** — `brain.behavioral_rules` table with adaptation agent
- **Instruction loader** — `src/lib/instruction-loader.ts` loads CEO standing orders into scanner prompts
- **Snapshotting** — Natural language → data query → snapshot card in feed
- **Bulk Data Import Gopher** — `/engine/import` for historical email ingestion. Also accessible as a row on the Me page.
- **Embedding/RAG pipeline** — `brain.knowledge_chunks` table with pgvector. `search_knowledge` and `search_correspondence` RPC functions. OpenAI `text-embedding-3-small` embeddings generating on ingestion. Semantic search active.
- **Document ingestion** — pdf-parse (text PDFs), Claude Vision fallback (image-based PDFs < 5MB), direct Supabase Storage signed upload (files > 4MB), PPTX/DOCX/TXT support

### What Is Not Working Yet

- **Training volume** — Autonomy requires 20+ reviewed cards per category at 90%+ accuracy. Currently near zero reviews. Infrastructure built, needs consistent daily use.
- **Unified Classifier** — Current classifier measures category accuracy only. The Unified Classifier spec (docs/technical/specs/unified-classifier-spec.md) defines the attention classification + operational enrichment architecture. Not yet built into the scanner prompts.
- **Measurement Layer** — Signal-to-noise, priority calibration, expansion rate not yet tracked or surfaced. Metrics dashboard defined in spec, not built.
- **MCP Server deployment** — 28 tools built, not yet deployed to a host.
- **Entity intelligence depth** — Contacts are name + email only. No enrichment, no derived profile building.

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
