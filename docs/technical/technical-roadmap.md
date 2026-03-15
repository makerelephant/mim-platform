# MiMBrain — Technical Roadmap

> **Purpose:** Actionable build plan. Two parallel tracks: frontend (build the feed) and backend (continue architecture v2 phases). Neither blocks the other — but backend work feeds the feed.
>
> **Companion docs:**
> - `docs/product/ui-requirements.md` — what we're building (interaction architecture)
> - `docs/product/design-brief.md` — what it looks like (Figma specs)
> - `docs/technical/architecture-mimbrain-v2.md` — backend north star
> - `docs/operational/master-effort-list.md` — all efforts
>
> **Last updated:** 2026-03-15

---

## Current State: All Phase 1 Build Tasks Complete

As of 2026-03-15, all B0-B5 (backend) and F1-F5 (frontend) build tasks are deployed and operational. The platform is in **operational phase** — the CEO uses Motion daily, accuracy accumulates, and categories earn autonomy.

---

## Honest Inventory: What Exists

### Fully Operational

| Module | Files | Status |
|--------|-------|--------|
| Gmail scanner | `gmail-scanner.ts` (~1500 lines) | Classifying live email with Acumen, emitting feed cards with full email metadata |
| Slack scanner | `slack-scanner.ts` (923 lines) | Classifying live messages |
| Sheets scanner | `sheets-scanner.ts` (333 lines) | Reading Google Sheets |
| News scanner | `news-scanner.ts` (537 lines) | Entity news monitoring |
| Pre-filter | `scanner-prefilter.ts` (261 lines) | Skips newsletters/noreply before Claude |
| Harness loader | `harness-loader.ts` (148 lines) | Reads 11 department MDs at runtime |
| Taxonomy loader | `taxonomy-loader.ts` (502 lines) | 11 categories from DB + hardcoded fallback |
| Entity dossier | `entity-dossier.ts` (435 lines) | ~400-token context per entity for classifier |
| Feedback engine | `feedback-engine.ts` (225 lines) | Usefulness scoring from task signals |
| Instruction engine | `instruction-loader.ts` (116 lines) | Standing orders + report inclusions |
| Entity resolution | `db-scanner.ts` (160 lines) | Email direct + domain fallback |
| Knowledge ingestion | `document-processor.ts` (275 lines) | PDF/DOCX/PPTX/CSV → chunks → classify → store → emit feed card |
| Brain chat | `/api/brain/ask` | Entity resolution → dossiers → knowledge search → Claude synthesis |
| Weekly report | `weekly-report-generator.ts` (535 lines) | 7/30-day data → Claude summary |
| Decision review | `/api/feed` | CEO reviews via feed card actions (Do/Hold/No) — replaces old `/decisions` page |
| Data layer | `db.ts` (417 lines) | Queries across all 5 schemas |
| MCP server | `mcp-server/` (28 tools) | Built, not deployed to host |
| Feed cards table | `brain.feed_cards` | 7 card types, visibility_scope, CEO actions, entity association, priority |
| Feed card emitter | `feed-card-emitter.ts` | Shared lib for emitting cards from any source |
| Feed API | `/api/feed` | GET (paginated, filtered), PATCH (CEO actions) |
| Daily briefing | `/api/agents/daily-briefing` | Synthesizes last 24h into briefing card, runs via Vercel cron |
| Accuracy tracking | `/api/brain/accuracy` | Per-category accuracy from CEO feed actions |
| Autonomy engine | `/api/brain/autonomy` | Categories earn self-governance at 90%+ accuracy on 20+ reviews |
| Snapshotting | `/api/brain/snapshot` | Natural language → data queries → snapshot card in feed |
| Harness API | `/api/brain/harness` | Serves classifier markdown files for Motion Map |
| Contact quality gate | In `gmail-scanner.ts` | Blocks junk email patterns from auto-creating contacts |

### Frontend — All Three Surfaces Live

| Surface | Route | What It Does |
|---------|-------|-------------|
| **Your Motion** | `/` | Scrollable feed of interactive cards. Do/Hold/No actions. Priority-based styling. Email context. Markdown rendering for briefings/snapshots. |
| **Your Clearing** | `/clearing` | Thought capture → brain memory. Brain Q&A. File drop ingestion. Multiple sessions, dissolve when done. |
| **Engine Room** | `/engine` | Motion Map (harness classifiers), Brain Accuracy (per-category stats), Autonomy (category progress), Integrations. |

### Legacy Pages — Preserved, Not Active

All 35+ old CRM pages remain at their original routes with the legacy sidebar. They are not deleted, not linked from the new nav, and available if needed. The new Motion sidebar (`/`, `/clearing`, `/engine`, `/me`) renders on Motion routes; the old dark sidebar renders on legacy routes.

### Scheduling

| Cron | Schedule | What |
|------|----------|------|
| Gmail scanner | Daily at 11:00 UTC (6am EST) | Scans last 4 hours of email |
| Daily briefing | Daily at 12:00 UTC (7am EST) | Synthesizes last 24h + runs autonomy check |

---

## Backend Build Tasks (All Complete)

| Step | What | Status | Key Files |
|------|------|--------|-----------|
| B0 | Verify foundation (entity intelligence tables) | ✅ COMPLETE | `step-14-entity-intelligence.sql` |
| B1 | Feed cards table + scanner integration | ✅ COMPLETE | `step-15-feed-cards.sql`, `feed-card-emitter.ts`, `/api/feed/route.ts` |
| B2 | Classifier training at scale | ✅ COMPLETE | `/api/brain/accuracy`, `vercel.json` crons |
| B3 | Daily synthesis loop | ✅ COMPLETE | `/api/agents/daily-briefing` |
| B4 | Behavioral adaptation | ✅ COMPLETE | `/api/brain/autonomy` |
| B5 | Knowledge ingestion enhancement | ✅ COMPLETE | `/api/brain/ingest` (now emits feed cards) |

## Frontend Build Tasks (All Complete)

| Step | What | Status | Key Files |
|------|------|--------|-----------|
| F1 | Card system + Motion feed | ✅ COMPLETE | `FeedCard.tsx`, `page.tsx` (root), `Sidebar.tsx`, `AppShell.tsx` |
| F2 | Snapshotting | ✅ COMPLETE | `/api/brain/snapshot` |
| F3 | Your Clearing | ✅ COMPLETE | `/clearing/page.tsx` |
| F4 | Engine Room + Motion Map | ✅ COMPLETE | `/engine/page.tsx`, `/api/brain/harness` |
| F5 | Page retirement | ✅ COMPLETE | Old pages preserved with `LegacySidebar.tsx`, new nav decoupled |

---

## Dependency Map (Complete)

```
BACKEND (all complete):

  B0 (Verify Foundation) ✅
   │
   ▼
  B1 (Feed Cards + Scanner Integration) ✅ ─────────────────┐
   │                                                         │
   ├──► B2 (Training at Scale) ✅                            │
   │         │                                               │
   │         ▼                                               │
   ├──► B3 (Daily Synthesis) ✅ ──► B4 (Behavioral Adapt.) ✅│
   │                                                         │
   └──► B5 (Knowledge Ingestion) ✅                          │
                                                             │
FRONTEND (all complete):                                     │
                                                             │
  F1 (Feed UI) ✅ ◄──────────────────────────────────────────┘
   │
   ├──► F2 (Snapshots) ✅ ──► F5 (Page Retirement) ✅
   ├──► F3 (Clearing) ✅
   └──► F4 (Engine Room) ✅
```

---

## What's Next: Operational Phase

The build is done. Now the system needs **use**:

1. **CEO reviews cards daily** — Do/Hold/No actions feed accuracy data
2. **Scanner runs daily** — Vercel cron fires at 6am EST
3. **Briefing runs daily** — Vercel cron fires at 7am EST, runs autonomy check
4. **Categories earn autonomy** — 20+ reviews at 90%+ accuracy = auto-act
5. **Design iteration** — UI polish based on CEO feedback (card design, sidebar, spacing)

### Training Workstream (T1-T4)

| Step | What | Status |
|------|------|--------|
| T1 | Volume ramp (100+ classifications/day) | 🔲 Needs consistent scanner runs |
| T2 | CEO review cadence (daily 5-min review) | 🔲 Needs habit formation |
| T3 | Harness refinement (rewrite dept MDs from corrections) | 🔲 Needs accuracy data |
| T4 | Confidence gating (auto-act on high-confidence categories) | ✅ Infrastructure built |

---

## What Stays As-Is

- All existing API routes (they serve the brain, not the old UI)
- All lib files (scanners, loaders, intelligence modules) — modified, not replaced
- All brain/ harness docs (11 department + 11 pipeline MDs)
- Database schema (additive changes only — new tables, no drops)
- Supabase infrastructure
- MCP server (28 tools, deploy when ready)
- All 35+ existing pages (preserved at original routes, accessible via legacy sidebar)

---

*Last updated: 2026-03-15*
