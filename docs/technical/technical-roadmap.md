# MiMBrain — Technical Roadmap

> **Purpose:** Actionable build plan. Two parallel tracks: frontend (build the feed) and backend (continue architecture v2 phases). Neither blocks the other — but backend work feeds the feed.
>
> **Companion docs:**
> - `docs/product/ui-requirements.md` — what we're building (interaction architecture)
> - `docs/product/design-brief.md` — what it looks like (Figma specs)
> - `docs/technical/architecture-mimbrain-v2.md` — backend north star
> - `docs/operational/master-effort-list.md` — all efforts
>
> **Last updated:** 2026-03-14

---

## Honest Inventory: What Exists

### Fully Operational

| Module | Files | Status |
|--------|-------|--------|
| Gmail scanner | `gmail-scanner.ts` (1404 lines) | Classifying live email with Acumen |
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
| Knowledge ingestion | `document-processor.ts` (275 lines) | PDF/DOCX/PPTX/CSV → chunks → classify → store |
| Brain chat | `/api/brain/ask` | Entity resolution → dossiers → knowledge search → Claude synthesis |
| Weekly report | `weekly-report-generator.ts` (535 lines) | 7/30-day data → Claude summary |
| Decision review | `/api/decisions` + `/api/decisions/review` | CEO marks correct/incorrect/partial |
| Data layer | `db.ts` (417 lines) | Queries across all 5 schemas |
| MCP server | `mcp-server/` (28 tools) | Built, not deployed to host |

### Exists But Incomplete

| Module | What's There | What's Missing |
|--------|-------------|----------------|
| Entity intelligence | `entity-intelligence.ts` — KCS calculator, provenance writer, batch recompute | Only scanners call it. Not all entity update paths write provenance. |
| Entity provenance table | `brain.entity_provenance` — SQL migration written (`step-14`) | **Migration may not have been executed in Supabase.** Need to verify. |
| Enrichment queue table | `brain.enrichment_queue` — SQL migration written (`step-14`) | No orchestrator. Table may not exist in DB yet. |
| KCS columns | `ALTER TABLE core.organizations/contacts` — in `step-14` | May not have been applied. Need to verify. |
| Harness docs | 11 department MDs + 11 pipeline MDs (email-classification) | Missing: ontology docs, scanner strategy docs, memory docs, non-email pipeline docs |

### Does Not Exist

| Module | Arch v2 Phase | Notes |
|--------|---------------|-------|
| `brain.feed_cards` table | — | Needed for Motion feed (F1) |
| `brain.derived_insights` table | Phase 3 | No table, no synthesis agent |
| `brain.behavioral_rules` table | Phase 4 | No table, no adaptation agent |
| `brain.decision_log` table | Phase 4 | classification_log captures some but isn't the same |
| Daily synthesis loop | Phase 3 | No agent, no cron |
| Enrichment orchestrator | Phase 5 | Queue table exists, no processor |
| Web/social/registry scanners | Phase 5 | Only news scanner exists for external enrichment |
| Model abstraction layer | Phase 6 | Direct Anthropic calls everywhere |
| Feed card generation | — | Scanners create tasks, not feed cards |

---

## Backend Work Order

### B0: Verify Foundation ← START HERE

**Goal:** Confirm the entity intelligence migration has been applied. If not, apply it. This is prerequisite to everything.

- [ ] Query Supabase: `SELECT column_name FROM information_schema.columns WHERE table_schema='core' AND table_name='organizations'` — check for `confidence_score`, `knowledge_completeness_score`, `enrichment_priority`, `enrichment_gaps`
- [ ] Query Supabase: check `brain.entity_provenance` table exists
- [ ] Query Supabase: check `brain.enrichment_queue` table exists
- [ ] If missing → run `step-14-entity-intelligence.sql` via Supabase SQL editor
- [ ] Verify KCS recompute works end-to-end: trigger a scanner run, confirm KCS values update on the resolved entity
- [ ] Check classification_log has acumen fields populated (acumen_category, importance_level, acumen_reasoning, ceo_review_status)

**Files:** `sql/migration/step-14-entity-intelligence.sql`, `src/lib/entity-intelligence.ts`

### B1: Feed Cards Table + Scanner Integration

**Goal:** Create the `brain.feed_cards` table and make scanners write cards into it. This is where the backend meets the frontend — no feed without cards.

- [ ] Design `brain.feed_cards` schema:
  ```
  id, card_type (decision/signal/action/briefing/snapshot/intelligence/reflection),
  category, importance, title, body, reasoning, source_ref, source_type,
  entity_ids (UUID[]), status (active/acted/dismissed/expired),
  action_taken (do/no/not_now), action_taken_at,
  ceo_response TEXT, metadata JSONB,
  created_at, expires_at
  ```
- [ ] Write + execute SQL migration
- [ ] Modify Gmail scanner: after classification, write a feed card (Decision type for items needing CEO input, Signal for informational)
- [ ] Modify Slack scanner: same
- [ ] Create `/api/feed/route.ts` — GET cards (paginated, filtered by status), POST card action (do/no/not_now + optional ceo_response)
- [ ] Card action handler: when CEO acts on a Decision card, write to classification_log correction fields (bridges to existing training flow)

**Key insight:** The feed card IS the decision review UI. The current `/decisions` page becomes redundant once Motion exists. But the classification_log training data flow must be preserved.

**Files to create:** `sql/feed-cards.sql`, `src/app/api/feed/route.ts`
**Files to modify:** `src/lib/gmail-scanner.ts`, `src/lib/slack-scanner.ts`

### B2: Classifier Training at Scale

**Goal:** Increase volume through the classifier and measure accuracy per category. The brain can't learn if it doesn't have enough reps.

- [ ] Increase Gmail scanner scan window (currently scans last N hours — widen or increase frequency)
- [ ] Query classification_log for per-category accuracy: `SELECT acumen_category, COUNT(*), SUM(CASE WHEN ceo_review_status='correct' THEN 1 ELSE 0 END) as correct FROM classification_log WHERE ceo_review_status IS NOT NULL GROUP BY acumen_category`
- [ ] Build accuracy computation function in `src/lib/` — returns per-category accuracy rate, total reviewed, confidence score
- [ ] Define confidence threshold per category (e.g., >90% accuracy on 20+ reviews = "confident")
- [ ] Surface accuracy stats in feed (Briefing card: "Your classifier accuracy this week")
- [ ] Category-level autonomy gating: when a category hits confidence threshold, brain can auto-act without CEO review

**Depends on:** B1 (feed cards to surface accuracy briefings)

**Files to create:** `src/lib/classifier-accuracy.ts`
**Files to modify:** `src/lib/gmail-scanner.ts` (scan frequency), `src/app/api/feed/route.ts` (accuracy briefing cards)

### B3: Daily Synthesis Loop

**Goal:** An automated agent reads all recent activity, cross-references signals, writes derived insights, and produces a CEO briefing card.

- [ ] Create `brain.derived_insights` table (SQL migration):
  ```
  id, insight_type (pattern/correlation/prediction/recommendation),
  description TEXT, evidence JSONB, confidence FLOAT,
  scope JSONB, entity_ids UUID[], taxonomy_categories TEXT[],
  embedding vector(1536), status (active/superseded/expired/rejected),
  expires_at, review_needed BOOLEAN, created_at, created_by
  ```
- [ ] Build synthesis agent (`src/lib/synthesis-agent.ts`):
  1. Read last 24h of classification_log, tasks, correspondence, entity_feedback
  2. Feed to Claude with instruction: "identify patterns, anomalies, trends across today's activity"
  3. Write derived insight records
  4. Produce CEO briefing card (summary of day + insights) → insert into feed_cards
- [ ] Create API route `/api/agents/daily-synthesis/route.ts` (triggered by Vercel cron)
- [ ] Wire derived insights into ask_brain context (when CEO asks a question, include relevant insights)

**Depends on:** B1 (feed cards for briefing output)

**Files to create:** `src/lib/synthesis-agent.ts`, `src/app/api/agents/daily-synthesis/route.ts`, `sql/derived-insights.sql`
**Files to modify:** `src/app/api/brain/ask/route.ts` (include insights in context)

### B4: Behavioral Adaptation

**Goal:** The system learns from CEO corrections and changes its own behavior. This is where the brain stops being a tool and starts being a COO.

- [ ] Create `brain.behavioral_rules` table (SQL migration):
  ```
  id, rule_type (classification/enrichment/priority/routing),
  description TEXT, condition JSONB, action JSONB,
  confidence FLOAT, evidence_insight_ids UUID[],
  sample_size INT, auto_applied BOOLEAN,
  status (proposed/active/suspended/retired),
  impact_metrics JSONB, created_at, activated_at, retired_at
  ```
- [ ] Create `brain.decision_log` table:
  ```
  id, decision_type, entity_id, entity_type,
  input_summary, decision, reasoning, rules_applied UUID[],
  outcome, ceo_override BOOLEAN, ceo_correction,
  created_at, outcome_recorded_at
  ```
- [ ] Build adaptation agent (`src/lib/adaptation-agent.ts`):
  1. Analyze classification_log for systematic CEO correction patterns
  2. Propose behavioral rules (e.g., "emails from .edu domains should be elevated to high priority")
  3. High-confidence rules (large sample + clear pattern) → auto-apply
  4. Lower-confidence rules → surface as Decision card for CEO approval
- [ ] Modify harness-loader to inject active behavioral_rules into scanner prompts
- [ ] Track rule impact: after rule activation, measure whether CEO override rate drops for that category

**Depends on:** B2 (enough training data to detect patterns), B3 (synthesis insights feed adaptation)

**Files to create:** `src/lib/adaptation-agent.ts`, `src/app/api/agents/adaptation/route.ts`, `sql/behavioral-rules.sql`
**Files to modify:** `src/lib/harness-loader.ts` (load behavioral rules), `src/lib/gmail-scanner.ts` (apply rules)

### B5: Knowledge Ingestion Pipeline Enhancement

**Goal:** Accept any asset type, extract, classify, embed, map to entities. The ingest path for Your Clearing.

- [ ] Extend document-processor.ts: add image OCR (logos, screenshots), audio transcription stubs
- [ ] Add embedding generation to ingestion flow (currently chunks but doesn't embed)
- [ ] Create vector search RPC functions in Supabase (may already exist — verify)
- [ ] Wire ingestion to entity resolution: when a doc mentions an org/contact, link it
- [ ] Surface ingestion results as feed cards (Intelligence type: "I processed your document and found...")

**Depends on:** B1 (feed cards for ingestion feedback)

**Files to modify:** `src/lib/document-processor.ts`, `src/app/api/brain/ingest/route.ts`

---

## Track 1: Frontend — Build the Feed

(Blocked on design — proceeds when Figma specs are ready)

### F1: Card System Foundation
- [ ] Build `<FeedCard>` component with four zones: header, body, expand trigger, actions
- [ ] Build `<FeedContainer>` — scrollable feed with infinite scroll / pagination
- [ ] Build 3 card variants: Decision, Signal, Briefing (minimum viable set)
- [ ] Wire card actions to `/api/feed` endpoint
- [ ] Replace root route with Motion feed
- [ ] Reduce sidebar to 3 items (Motion, Clearing, Engine Room)

### F2: Snapshotting
- [ ] `<SnapshotCard>` component — renders structured data (tables, charts, KPIs)
- [ ] `/api/feed/snapshot` endpoint — brain generates visual data on demand
- [ ] Support types: entity list, pipeline view, KPI summary, timeline

### F3: Your Clearing
- [ ] `src/app/clearing/page.tsx` — freeform notes, file drop, brain chat in reflective context

### F4: Engine Room + Motion Map
- [ ] `src/app/engine/page.tsx` — Motion Map renders harness logic, integration management

### F5: Page Retirement
- [ ] Verify snapshotting covers all old page data, then remove dormant pages

---

## Dependency Map

```
BACKEND (can start now):

  B0 (Verify Foundation)
   │
   ▼
  B1 (Feed Cards + Scanner Integration) ──────────────────┐
   │                                                       │
   ├──► B2 (Training at Scale)                             │
   │         │                                             │
   │         ▼                                             │
   ├──► B3 (Daily Synthesis) ──► B4 (Behavioral Adaptation)│
   │                                                       │
   └──► B5 (Knowledge Ingestion)                           │
                                                           │
FRONTEND (blocked on design):                              │
                                                           │
  F1 (Feed UI) ◄───────────────────────────────────────────┘
   │
   ├──► F2 (Snapshots) ──► F5 (Page Retirement)
   ├──► F3 (Clearing)
   └──► F4 (Engine Room)
```

**B0 is the starting point. B1 is the critical backend deliverable — it creates the data the feed consumes.**

B2 and B3 can run in parallel after B1. B4 requires enough training data from B2 and insights from B3.

F1 is blocked on design but the backend (B1) can be fully ready before design is done.

---

## What Stays As-Is

- All existing API routes (they serve the brain, not the old UI)
- All lib files (scanners, loaders, intelligence modules) — modified, not replaced
- All brain/ harness docs (11 department + 11 pipeline MDs)
- Database schema (additive changes only — new tables, no drops)
- Supabase infrastructure
- MCP server (28 tools, deploy when ready)
- All 35 existing pages (dormant, not deleted — may cannibalize components)

---

*Last updated: 2026-03-14*
