# MiMBrain — Technical Roadmap

> **Purpose:** Actionable build plan for engineering. Two parallel tracks: frontend (build the feed, retire static pages) and backend (continue architecture v2 phases). Neither blocks the other.
>
> **Companion docs:**
> - `docs/product/ui-requirements.md` — what we're building (interaction architecture)
> - `docs/product/design-brief.md` — what it looks like (Figma specs)
> - `docs/technical/architecture-mimbrain-v2.md` — backend north star
> - `docs/operational/master-effort-list.md` — all efforts
>
> **Last updated:** 2026-03-14

---

## Current Inventory

| Layer | Count | Notes |
|-------|-------|-------|
| Pages (`src/app/`) | 35 | All being replaced by feed architecture |
| API routes (`src/app/api/`) | 14 | Most stay — they serve the brain, not the UI |
| Components (`src/components/`) | 24 | 10 shadcn/ui + 10 feature + 4 layout |
| Lib files (`src/lib/`) | 20 | Scanner, loader, intelligence — all stay |
| Sidebar nav items | 26 | Reducing to 3 (Motion, Clearing, Engine Room) |
| SQL migrations | 17+ | Schema stable, new tables for feed/cards |

---

## Track 1: Frontend — Build the Feed

### Phase F1: Card System Foundation

**Goal:** Render a feed of cards from a new `brain.feed_cards` table.

- [ ] Design `brain.feed_cards` table schema (card_type, category, importance, title, body, reasoning, source_ref, entity_ids, status, created_at, expires_at)
- [ ] SQL migration to create the table
- [ ] Build `<FeedCard>` component with four zones: header, body, expand trigger, actions
- [ ] Build `<FeedContainer>` — scrollable feed with infinite scroll / pagination
- [ ] Build 3 card variants: Decision, Signal, Briefing (minimum viable set)
- [ ] Wire card actions (Decision: Do / No / Not Now) to API endpoints
- [ ] Replace `src/app/page.tsx` home page with feed

**Key files to create:**
- `src/app/motion/page.tsx` — Your Motion page
- `src/components/FeedCard.tsx` — card component
- `src/components/FeedContainer.tsx` — feed scroll container
- `src/app/api/feed/route.ts` — GET feed cards, POST card actions

**Key files to modify:**
- `src/components/Sidebar.tsx` — reduce to 3 items
- `src/components/AppShell.tsx` — new layout for feed-first

### Phase F2: Snapshotting

**Goal:** Brain generates visual data cards on demand.

- [ ] Build `<SnapshotCard>` component — renders structured data (tables, charts, KPIs)
- [ ] API endpoint for snapshot generation (`/api/feed/snapshot`)
- [ ] Wire brain chat to generate snapshot cards into the feed
- [ ] Support snapshot types: entity list, pipeline view, KPI summary, timeline

### Phase F3: Your Clearing

**Goal:** Thinking space alongside the feed.

- [ ] Build `src/app/clearing/page.tsx`
- [ ] Freeform note capture (rich text, minimal formatting)
- [ ] File drop zone for ingestion (passes to knowledge ingestion pipeline)
- [ ] Brain chat in clearing context (reflective, not operational)
- [ ] Draft persistence (local or DB)

### Phase F4: Engine Room + Motion Map

**Goal:** Configuration layer with visible operating logic.

- [ ] Build `src/app/engine/page.tsx`
- [ ] Motion Map view — renders harness categories, importance tiers, routing rules from markdown
- [ ] Integration management (Gmail, Slack, Stripe connections)
- [ ] User/permissions placeholder (single user for now)

### Phase F5: Page Retirement

**Goal:** Remove all static CRM pages.

- [ ] Verify all data previously accessed via static pages is accessible via snapshotting
- [ ] Remove 35 page files from `src/app/`
- [ ] Remove orphaned components
- [ ] Remove sidebar sections (already reduced in F1)
- [ ] Clean up unused API routes

---

## Track 2: Backend — Architecture v2 Phases

These continue regardless of frontend progress. Reference: `architecture-mimbrain-v2.md`.

### Phase B1: Entity Intelligence (In Progress)

- [ ] Entity provenance tables (`brain.entity_provenance`)
- [ ] Derived insights storage (`brain.derived_insights`)
- [ ] Enrichment queue (`brain.enrichment_queue`)
- [ ] Entity completeness scoring

### Phase B2: Classifier Training at Scale

- [ ] Increase scanner frequency / email volume
- [ ] Per-category accuracy dashboard (data already in `classification_log`)
- [ ] Confidence score computation from CEO review history
- [ ] Category-level autonomy thresholds

### Phase B3: Daily Synthesis Loop

- [ ] Automated agent reads recent activity across all sources
- [ ] Cross-references signals, writes derived insights
- [ ] Produces CEO briefing card(s) in feed
- [ ] Scheduled execution (cron or Vercel cron)

### Phase B4: Behavioral Adaptation

- [ ] Brain writes/updates its own behavioral rules based on correction patterns
- [ ] Rule confidence tracking
- [ ] Auto-execute vs. require-approval gating
- [ ] Adaptation audit log

### Phase B5: Knowledge Ingestion Pipeline

- [ ] Accept docs, CSVs, PDFs, images
- [ ] Extract content, classify, embed
- [ ] Map to entities
- [ ] Clearing → ingestion flow

---

## Dependency Map

```
F1 (Feed) ──────────────────► F2 (Snapshots) ──► F5 (Page Retirement)
    │                              │
    ▼                              ▼
F3 (Clearing)               F4 (Engine Room)

B1 (Entity Intel) ──► B3 (Synthesis) ──► B4 (Adaptation)
                           │
B2 (Training) ─────────────┘
                           │
                      B5 (Ingestion)
```

F1 is the critical path for frontend. B1 and B2 can proceed in parallel immediately.

---

## What Stays As-Is

- All API routes (they serve the brain, not the old UI)
- All lib files (scanners, loaders, intelligence modules)
- All brain/ files (department docs, classifier rules)
- Database schema (additive changes only — new tables for feed)
- Supabase infrastructure
- MCP server

---

*Last updated: 2026-03-14*
