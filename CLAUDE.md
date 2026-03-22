# CLAUDE.md — Read This First
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active session instructions. Must be read before any work begins.
> **Last updated:** 2026-03-21

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

**Foundation excellence is COMPLETE (March 21, 2026):**
1. Full-body comprehension (8K char windows, full email bodies) — ✅ COMPLETE
2. Bulletproof recall (7-day guaranteed window, lowered thresholds, expanded results) — ✅ COMPLETE
3. Entity resolution depth (fuzzy Levenshtein matching, alias resolution, rich dossiers) — ✅ COMPLETE
4. Natural language card UI (MessageCard, gopher icons, intent icons, entity highlighting) — ✅ COMPLETE
5. Gmail bidirectional integration (auto-resolve, Reply/Draft/Archive/Star actions) — ✅ COMPLETE
6. Note-taking feature (knowledge embedding, drafts, feed card emission) — ✅ COMPLETE
7. Intent suggestion UI (Read/Respond/Write/Schedule formal pivot) — 🟡 NEXT

**Key principle:** The death of this product is when data is submitted and it cannot be recalled, or is incomplete in its recollection. All or nothing — partial comprehension has zero value.

---

## Current State (March 21, 2026)

### What Is Built and Working

- **Gmail Gopher** — Classifying live email with 11 Acumen categories, full-body comprehension (8K chars), thread consolidation, deduplication via `source_ref`, auto-resolve on CEO reply detection
- **Gmail Actions API** — `/api/gmail/actions` for Reply (threaded with headers), Draft (brain-generated via Claude), Archive, Star. Thread status polling (replied/forwarded/drafted/starred/archived). Every action creates a status.
- **Slack Gopher** — Scanning Slack with the same Acumen classifier, assistant prefill for reliable JSON output, noise filter (P3/S3 cards suppressed), action extraction rules
- **Feed cards** (`brain.feed_cards`) — Two card components: MessageCard (email/Slack — natural language, gopher icons, intent icons, entity highlighting, Figma-accurate thread status chips with icons) and FeedCard (briefings/snapshots/reflections — badge styles, Do/Hold/No actions, Train modal)
- **Your Motion** — Feed-first architecture complete at `/`. Filter pills. Action bar with Write/Plan/Add buttons. Note-taking panel. Refresh button with accurate timer. Actioned cards disappear immediately from active view.
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

- **Note-taking** — Write button → NotePanel. Title + rich text editor with formatting toolbar. Save = feed + knowledge simultaneously (generates OpenAI embedding, emits signal feed card, shows green checkmark success). Feed note cards tappable to reopen NotePanel in edit mode. Save Draft available. `/api/notes` CRUD. Notes stored in `brain.knowledge_chunks` as `ceo_note`/`ceo_note_draft`.

### Active Gaps

- **Training redesign** — Current training UX confuses three concepts: classifier correction (FeedCard "Correct?" dropdowns), knowledge ingestion (notes "Add to Knowledge"), and card feedback (MessageCard has no training at all). Needs simplification: implicit learning from every interaction (dismissals = negative signal, tap-throughs = positive signal), simple Yes/No replacing category dropdowns.
- **Intent suggestion UI** — Cards still show Do/Hold/No alongside natural language layout. Formal Read/Respond/Write/Schedule intent buttons are the next major effort.
- **MCP Server deployment** — 28 tools built, not yet deployed to a host.
- **Thread status polling** — ✅ COMPLETE. MessageCard polls Gmail every 60s. Status chips update live when CEO acts in Gmail. Batch endpoint supports up to 20 concurrent checks.

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
- **Never remove `backgroundColor: "#f6f5f5"` from `<main>` in AppShell.tsx** — The sidebar is `position: fixed`. The `padding-left` on `<main>` clears content past the sidebar, but without a background color on `<main>`, an empty column is visible behind the semi-transparent sidebar. This has been a recurring bug. The background MUST stay on `<main>`.
- **All document headers** must follow the standard format:
  ```
  # Document Title
  > **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
  > **Status:** [status description]
  > **Last updated:** YYYY-MM-DD
  ```
