# CLAUDE.md — Read This First
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active session instructions. Must be read before any work begins. Claims below have been tightened to match recovery findings.
> **Last updated:** 2026-03-27

---

## What is this project?

**In Motion** is an autonomous business intelligence platform for Made in Motion PBC, a business engaged in creating innovative new methods and products for the Generative or Agentic Commerce future. 

The In Motion platform processes business data (emails, messages, documents), classifies it, prioritises it, and recommends actions — with the goal of becoming an autonomous or semi autonomous execution asset to the Chief Operating Officer in phase 1, to the founding team in phase 2, and then finally to the market that the company is seeking to participate in in phase 3.

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
- **No notification badges** — The feed IS the notification system. where possible, avoid noisy UI elements that complicate the UI and distract the User. 
- **Single Ingestion Point** — All data enters through one endpoint. Brain classifies, decides, acts, emits cards. No UI writes directly to the database.

---

## Doc Reading Order

1. `docs/strategic/platform-pivot-march-2026.md` — **START HERE.** Strategic pivot from correctness to contextual suggestions. Foundation excellence requirements. Build order.
2. `docs/operational/agent-recovery-rules.md` — Required operating posture for agents working on product recovery. Read before proposing fixes.
3. `docs/product/ui-requirements.md` — Governing architecture (Motion, Canvas, Engine Room, card types, emotional design)
4. `docs/product/design-brief.md` — Figma-actionable specs (card anatomy, screen layouts, visual language)
5. `docs/technical/architecture-mimbrain-v2.md` — Backend architecture (entity-centric, three memory types, harness, autonomy layer) — north star
6. `docs/master-effort-list.md` — All efforts/epics with status
7. `docs/product/stack-glossary.md` — Vocabulary definitions
8. `docs/technical/specs/unified-classifier-spec.md` — Attention classification, signal quality, Decision/Action/Task ontology
9. `docs/technical/specs/brain-intelligence-layer-spec.md` — RAG architecture, instruction persistence, MCP integration

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
| In Motion | Platform working title (working title for the platform) |
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

## Strategic Direction (March 22, 2026)

> **Full decision document:** `docs/strategic/platform-pivot-march-2026.md`

The platform is pivoting from **zero-tolerance correctness** (Do/Hold/No) to **contextual intent suggestions** (Read/Respond/Write/Schedule).

That said, do not assume the underlying intelligence layer is currently trustworthy just because it is broad. The immediate phase-1 problem is feed usefulness, not UI polish.

**What exists in code is broader than what is proven in operation.**

Do not use “foundation excellence complete” as an operating assumption. Live recovery findings have shown:

1. the feed is not yet trustworthy
2. measurement and training claims are partially overstated
3. schema/runtime drift has existed
4. subsystem existence is not proof of phase-1 value

**Next up:**
1. feed trust recovery
2. reliable instrumentation
3. only then: training redesign and intent-suggestion evolution

**Key principle:** The death of this product is when data is submitted and it cannot be recalled, or is incomplete in its recollection. All or nothing — partial comprehension has zero value.

---

## Current State (March 22, 2026)

### What Exists

- Gmail/Slack scanners, Gmail actions, feed rendering, canvas, engine room, import paths, note-taking, embedding/RAG, reporting, and autonomy logic all exist in the repo.
- Many of these systems can execute.
- Their existence should not be mistaken for reliable phase-1 product performance.

### What Is Not Yet Proven Or Is Known To Be Weak

- **Feed usefulness** — This is the main product failure. Low-value cards surface and important items are plausibly missed.
- **Measurement reliability** — Parts of the claimed measurement/training layer are not dependable enough to use as ground truth. Live recovery checks found expected tables such as `brain.events` and `brain.classification_log` unavailable in the schema cache.
- **Training claims** — The platform stores corrections and interaction data, but “every interaction trains the brain” is not yet an honest operating assumption.
- **Schema/runtime conformity** — Agents should verify database shape and live behavior before trusting repo claims about storage, source types, or metrics.
- **Notes and other secondary workflows** — Treat as unproven until verified against the live system and the current schema.

- **Training redesign (Effort #77)** — Current training UX confuses three concepts: (1) classifier correction via FeedCard "Correct?" dropdown panel, (2) knowledge ingestion via notes "Add to Knowledge", (3) MessageCard has NO training at all — trash just dismisses without logging. The fix: make every interaction a training signal — dismissals = negative, tap-throughs = positive, simple ✓/✗ replaces category dropdowns. Gmail action buttons already removed from card face (actions happen in Gmail, status reflected via chips).
- **Intent suggestion UI (Effort #78)** — Cards still show Do/Hold/No alongside natural language layout. Formal Read/Respond/Write/Schedule intent buttons are the next major effort after training redesign.
- **MCP Server deployment** — 28 tools built, not yet deployed to a host.

### Recovery Posture

- Treat this project as a product recovery effort, not a feature-delivery effort.
- Prioritize feed trust, evaluation quality, and instrumentation over new capability.
- Do not assume the architecture is sound just because it is sophisticated.

---

## Critical Rules for Any Agent

- **Work ONLY from `/Users/markslater/Desktop/mim-platform` on the `main` branch.** Never create git worktrees. Never deploy from any subdirectory.
- **Deploy ONLY with** `cd /Users/markslater/Desktop/mim-platform && npx vercel --prod --yes` — targets `mim-platform.vercel.app`
- **Never use `<Image>` for SVGs** — use `<img>` tags (SVG compatibility issue with Next.js Image)
- **Never build static CRM pages** or add sidebar navigation items
- **Never build creation tools** inside Your Canvas (it's a gate, not a workshop)
- **Never add notification badges or counts**
- **Never change the backend architecture casually** — `architecture-mimbrain-v2.md` is the north star, but do not assume current implementation fully conforms to it
- **Use "In Motion"** as the platform name (not MiMBrain)
- **Use "Gopher"** for automated workers (not Scanner)
- **Use "Canvas"** as the UI label for the `/clearing` route
- **Never remove the background from `<main>` in AppShell.tsx** — AppShell owns the ONLY background for the entire app. The sidebar is `position: fixed` with semi-transparent glass. The `padding-left` on `<main>` clears content past it, and the background on `<main>` shows through the glass. **NEVER add backgroundColor or backgroundImage to any page-level root div** (page.tsx, clearing/page.tsx, engine/page.tsx, me/page.tsx). Page-level backgrounds create a visible seam at the 250px sidebar boundary because they only cover the content area, not the padding area behind the sidebar. This has been a recurring bug — fixed 8 times. The rule is: **AppShell = background. Pages = transparent.**
- **All document headers** must follow the standard format:
  ```
  # Document Title
  > **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
  > **Status:** [status description]
  > **Last updated:** YYYY-MM-DD
  ```
