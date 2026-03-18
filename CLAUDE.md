# CLAUDE.md — Read This First

## What is this project?

MiMBrain is an autonomous business intelligence platform for Made in Motion, a youth sports technology company. It processes business data (emails, messages, documents), classifies it, prioritises it, and recommends actions — with the goal of becoming an autonomous Chief Operating Officer.

**We are in Phase 1 (The 1):** One user — the CEO — operating entirely through the feed. Everything else is horizon planning.

---

## Three Surfaces (All Built and Live)

1. **Your Motion** (`/`) — A scrollable feed of interactive cards. The CEO's entire operational life streams here. Everything is ephemeral. No permanent pages.
2. **Your Clearing** (`/clearing`) — A thinking/prep space. Freeform notes, file ingestion, brain-assisted reflection. NOT a creation tool — the platform is a gate, not a workshop.
3. **Engine Room** (`/engine`) — Configuration layer. Motion Map (brain's operating logic made visible), integrations, health dashboard, autonomy progress.

There is also a **Me page** (`/me`) showing brain accuracy stats and manual scan triggers.

---

## Architecture Principles

- **No Pages** — Data views are "snapshots" generated on demand into the feed, not static routes
- **Burning Man** — Celebrate impermanence. Nothing persists as a permanent page.
- **Gate, Not Workshop** — We don't compete with Google Slides, Excel, etc. We're the gate everything passes through.
- **No notification badges** — The feed IS the notification system
- **Single Ingestion Point** — All data enters through one endpoint. Brain classifies, decides, acts, emits cards. No UI writes directly to the database.

---

## Doc Reading Order

1. `docs/context-primer.md` — Bedrock onboarding prompt for any new agent
2. `docs/product/ui-requirements.md` — Governing architecture (Motion, Clearing, Engine Room, card types, emotional design)
3. `docs/product/design-brief.md` — Figma-actionable specs (card anatomy, screen layouts, visual language)
4. `docs/technical/architecture-mimbrain-v2.md` — Backend architecture (entity-centric, three memory types, harness, autonomy layer) — north star
5. `docs/operational/master-effort-list.md` — All efforts/epics with status
6. `docs/product/stack-glossary.md` — Vocabulary definitions

---

## Tech Stack

- **Frontend:** Next.js 16 + Turbopack, Tailwind CSS, Geist font
- **Backend:** Supabase (Postgres, multi-schema: core/crm/intel/platform/brain)
- **Deployment:** Vercel — always deploy with `npx vercel --prod --yes` from `/Users/markslater/Desktop/mim-platform`
- **Production URL:** `mim-platform.vercel.app`
- **AI:** Claude API for classification, synthesis, chat; OpenAI for embeddings (key needed)
- **MCP Server:** 28 tools across 9 domains (built, not yet deployed to host)

---

## Terminology

| Term | Meaning |
|------|---------|
| Your Motion | The feed — CEO's operational life stream |
| Your Clearing | Thinking/prep space — NOT a creation tool |
| Engine Room | Configuration layer (was "Settings") |
| Motion Map | CEO's readable view of the brain's operating logic |
| Harness | Technical implementation underneath the Motion Map (markdown classifier files) |
| Acumen | Decision engine (classifiers + harness + decision log) |
| Snapshotting | Brain compiles visual data on demand into the feed |
| Card | Interactive unit in the feed (Decision, Action, Signal, Briefing, Snapshot, Intelligence, Reflection) |

---

## Current State (March 17, 2026)

### What Is Built and Working

- **Gmail scanner** classifying live email with 11 Acumen categories, emitting feed cards with full email metadata (from/to/subject), thread consolidation
- **Feed cards** (`brain.feed_cards`) with 7 card types, priority-based styling, Do/Hold/No/Noted/Dismiss actions, More About This expansion, action recommendations, training mode framing
- **Your Motion** — Feed-first architecture complete at `/`. Filter pills (All, Decisions, Actions, Signals, Intel, Briefings, Old). Active cards = `status=unread,read`. Old cards (acted) visible via "Old" filter. Actioned cards disappear immediately from active view.
- **Your Clearing** — Persistent sessions/messages at `/clearing`. Brain Q&A, file ingestion, Launch a Gopher popup, Add To Knowledge. Sessions persist to `brain.clearing_sessions` / `brain.clearing_messages`.
- **Engine Room** — Motion Map (harness classifier MDs), Brain Accuracy (per-category stats), Autonomy progress, Integrations status, Platform Health
- **Decision logging** — `brain.classification_log` records every classification. CEO review via feed actions.
- **Correction learning** — `/api/brain/learn` stores corrections as institutional memory. Feed card PATCH auto-fires learning.
- **Daily briefing** — Vercel cron at 7am EST synthesises last 24h into briefing card
- **Gmail scanner cron** — Vercel cron at 6am EST scans last 4 hours
- **Autonomy engine** — Categories earn self-governance at 20+ reviews / 90%+ accuracy
- **Snapshotting** — Natural language → data query → snapshot card in feed
- **Bulk email import** — `/engine/import` for historical email ingestion
- **Embedding/RAG pipeline** — Code and tables built (`brain.knowledge_chunks`). NOT active — requires `OPENAI_API_KEY` in Vercel env vars.

### What Is Not Working Yet

- **Semantic memory (embeddings)** — RAG pipeline exists but no OpenAI API key means no vector search. Brain relies on keyword search only. This is a pending CEO decision.
- **Training volume** — Autonomy requires 20+ reviewed cards per category at 90%+ accuracy. Currently near zero reviews. Infrastructure built, needs consistent daily use.
- **Only one data source** — Gmail connected only. Slack, Calendar, Stripe, documents planned but not connected.
- **Entity intelligence is shallow** — Contacts are name + email only. No enrichment, no derived profile building.

### What This Means

The system can operate — it ingests, classifies, surfaces, and learns from corrections. But it cannot yet think reliably or autonomously. Volume and an embeddings decision are the next critical steps.

---

## Session History (March 17, 2026)

Changes made in this session:

- **SQL Step 24** — Fixed `brain.search_correspondence` RPC to JOIN with `intel.correspondence` table for full email metadata (from/to/subject/body). Ran DROP then CREATE separately in Supabase editor.
- **Feed filter pills** — Added "Old" filter pill. Active filters (All/type) query `status=unread,read`. Old filter queries `status=acted` only. Actioned cards removed immediately via `filter()`.
- **Clearing layout** — Fixed overlapping conversations panel. Converted hardcoded pixel widths to responsive `max-width` + `w-full`. Replaced absolute-positioned conversations panel with a toggle button + floating dropdown that doesn't overlap the sidebar.
- **Scan animation** — Half-width progress bar, visible blue gradient (`#3b82f6 → #2563eb`), dots removed, stage text only.
- **Category chip height** — Forced to exactly 26px on all card badge types.
- **Actioned cards** — `handleAction` changed from `map()` (inline resolved state) to `filter()` (immediate removal). Feed query changed to `unread,read` for active view; acted cards visible only via "Old" filter.
- **knowledge/page.tsx SSG fix** — `createClient()` moved to lazy `getSupabase()` function to prevent build crash.
- **Gmail scanner merge conflict** — Resolved in `gmail-scanner.ts`, kept `embedCorrespondence` helper approach.
- **Worktree cleanup** — Eliminated all worktree-based work. All changes made directly on `main` at `/Users/markslater/Desktop/mim-platform`.

---

## Critical Rules for Any Agent

- **Work ONLY from `/Users/markslater/Desktop/mim-platform` on the `main` branch.** Never create git worktrees. Never deploy from any subdirectory.
- **Deploy ONLY with** `cd /Users/markslater/Desktop/mim-platform && npx vercel --prod --yes` — targets `mim-platform.vercel.app`
- **Never use `<Image>` for SVGs** — use `<img>` tags (SVG compatibility issue with Next.js Image)
- **Never build static CRM pages** or add sidebar navigation items
- **Never build creation tools** inside Your Clearing (it's a gate, not a workshop)
- **Never add notification badges or counts**
- **Never change the backend architecture** — `architecture-mimbrain-v2.md` is the north star
