# MIMBRAIN.md (Archived)
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Archived — superseded by `/CLAUDE.md`. Retained for historical reference only.
> **Last updated:** 2026-03-22

---

## What This Project Is

**MiMbrain** is the internal intelligence and operations platform for Made in Motion (MiM) — a consumer product creation app where people describe ideas in text or upload images, and the AI generates purchasable custom products (t-shirts, caps, etc.) that can be shared and remixed by communities.

MiMbrain is **not** the consumer app. It is the internal operating system for the company behind the app. It has five planned modules:

| Module | Who Uses It | Status |
|--------|-------------|--------|
| 1. CEO Brain | Mark (CEO) only | 🔄 In progress |
| 2. Team CRM | Jim, Nathan, Walt | 🔄 Schema ready, UI in progress |
| 3. Agentic Acquisition | Automated | 🔄 Partial (scanners exist) |
| 4. Customer Portal | MiM app users | ⏳ Not started |
| 5. White Label | External orgs | ⏳ Not started — deprioritised |

**The build order is fixed: CEO brain first, then team CRM, then agentic acquisition, then customer portal.** Do not build Module 4 features while Module 1 is incomplete.

---

## Current State (March 2026)

### What exists and works
- Next.js 16 app at `github.com/makerelephant/mim-platform`
- **Data ontology migration — COMPLETE** (5-schema architecture: core, crm, intel, platform, brain)
- `src/lib/db.ts` — query helpers using Option B (separate queries, assembled client-side)
- `src/lib/db-scanner.ts` — server-only scanner query helpers (service role)
- `src/types/supabase.ts` — TypeScript interfaces for all 22 tables
- `src/middleware.ts` — route redirects from old routes to unified `/orgs`
- `src/app/orgs/` — unified org route with `?type=` filtering
- `src/app/page.tsx` — CEO Brain dashboard with chat-first UI and KPIs
- `src/app/api/brain/ask/` — cross-source intelligence synthesis API
- Gmail scanner — reads Mark's email, classifies against entity database, creates tasks
- Slack scanner — reads configured channels, same pipeline as Gmail
- Sentiment scanner — pulls RSS news feeds, classifies relevance to MiM
- Weekly report generator — synthesises scanner activity into markdown briefings
- Brain ingest API — accepts file uploads and text, classifies and stores in knowledge base
- All scanners query new multi-schema architecture (core.*, crm.*, brain.*, intel.*)
- Database hardened: RLS enabled, `updated_at` triggers, performance indexes, dead weight dropped
- Contacts, tasks, pipeline, knowledge pages — all query new schema
- MCP server (`mcp-server/`) — 28 tools for CEO brain interaction via Claude Desktop

### What is in progress
- **RLS policy refinement** — blanket `authenticated_all` policy is in place; needs per-role tightening (ceo, product, engineering, bd, operations) per access matrix
- **`brain.ceo_context` population** — table exists, RLS enabled, but no data yet (scanners write to it, needs first scan cycle)
- **Team CRM (Module 2)** — schema ready, `core.team_members` table exists but empty

### What does not exist yet
- `core.team_members` data — no team member rows inserted yet
- `platform.user_context` data — no app users yet (Module 4)
- Per-role RLS policies (currently blanket authenticated access)
- Module 4: Customer Portal
- Module 5: White Label (deprioritised)

---

## The Architecture in One Page

### Database — 5 schema namespaces

```
core.*       What things ARE
  organizations    Any external entity (club, firm, church, brand)
  org_types        How that entity relates to MiM: customer, partner, investor, vendor
  org_classifications  What the entity is in the world (links to taxonomy)
  taxonomy         Infinitely deep category tree: Youth Sports > Soccer
  contacts         People
  relationships    Links contacts to orgs
  team_members     Internal MiM staff with roles

crm.*        Pipeline and outreach
  pipeline         Deal status per org per type (investor pipeline, partner pipeline)
  outreach         Outreach log
  opportunities    Deals with value and stage

intel.*      Deep profiles
  investor_profile  Fund type, check size, sector focus
  partner_profile   Revenue share, partner since
  org_financials    Players, dues, revenue (for youth sports orgs)

platform.*   Product layer
  store            MiM store status per org
  memberships      League memberships (replaces 10 boolean columns)
  user_context     App users — thin wrapper around Supabase Auth

brain.*      Intelligence layer
  ceo_context      Mark's personal feed: action items, signals, briefings
  tasks            Tasks linked to any entity (polymorphic)
  activity         Activity log linked to any entity (polymorphic)
  correspondence   Emails/Slack linked to any entity (polymorphic)
  knowledge        Structured documents (NOT news articles — see below)
  agent_runs       Scanner execution log
```

### The three concepts that must never be conflated

```
Organization  = what exists in the world (a soccer club is a soccer club)
Type          = how it relates to MiM (that club is also a customer and a partner)
Category      = where it fits in the taxonomy (Youth Sports > Soccer)
```

One org can have multiple types simultaneously. Types are a small bounded list you control. Categories are an infinite tree you extend by adding rows, never by changing schema.

### public.* — what stays in the old schema permanently

```
public.knowledge_base   News articles written by sentiment scanner — NEVER migrated
public.reports          Weekly report outputs — not migrated
public.classification_log  Scanner audit trail — not migrated
public.entity_feedback  Entity scoring — not migrated
public.activity_log     OLD activity table — still written to by scanners until UI Phase 1 completes, then replaced by brain.activity
```

`public.knowledge_base` is a special case: non-news entries (documents, agent-ingested content) are migrated to `brain.knowledge`. News articles (where `source_type = 'news'`) stay in `public.knowledge_base` forever because the sentiment scanner writes and reads them there and must not be changed.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | Tailwind + shadcn/ui + lucide-react 0.469 |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth |
| AI | Anthropic SDK 0.78 (`claude-sonnet-4-5-20250929`) |
| Email | Gmail API via googleapis 171 |
| Slack | @slack/web-api 7.14 |
| Storage | Supabase Storage (bucket: `knowledge`) |
| Deployment | Vercel (serverless, `maxDuration` set per route) |

---

## Key Files — What They Do

### Query layer (complete)
```
src/lib/db.ts              Client + server component query helpers (Option B — separate queries)
src/lib/db-scanner.ts      Server-only scanner query helpers (service role) — DO NOT import client-side
src/types/supabase.ts      TypeScript interfaces for all 22 tables across 5 schemas
```

### Intelligence layer (complete — all migrated to new schema)
```
src/lib/gmail-scanner.ts         Reads Gmail, classifies, creates tasks + activity (uses core.*, brain.*)
src/lib/slack-scanner.ts         Reads Slack channels, same pipeline (uses core.*, brain.*)
src/lib/entity-dossier.ts        Builds context summary for an org/contact (uses core.*, crm.*, intel.*, brain.*)
src/lib/weekly-report-generator  Synthesises scanner activity into markdown reports (uses brain.*, core.*)
src/lib/scanner-prefilter.ts     Filters newsletters/auto-replies before AI classification — DO NOT CHANGE
src/lib/news-scanner.ts          Pulls RSS feeds, classifies relevance — DO NOT CHANGE
src/lib/taxonomy-loader.ts       Loads taxonomy from DB for use in classification
src/lib/feedback-engine.ts       Computes entity usefulness scores from task feedback (uses brain.tasks)
src/lib/instruction-loader.ts    Loads active standing orders for scanner injection (uses brain.instructions)
src/lib/document-processor.ts   Extracts text from PDFs/docs — DO NOT CHANGE
```

### API routes (agents)
```
src/app/api/agents/gmail-scanner/      Triggers gmail-scanner.ts
src/app/api/agents/slack-scanner/      Triggers slack-scanner.ts
src/app/api/agents/fundraising-scanner/ Runs gmail+slack then returns investor activity
src/app/api/agents/partnership-scanner/ Runs gmail+slack then returns partner activity
src/app/api/agents/customer-scanner/   Runs gmail+slack then returns customer activity
src/app/api/agents/sentiment-scanner/  Triggers news-scanner.ts — DO NOT CHANGE
src/app/api/agents/weekly-report/       Triggers weekly-report-generator.ts
src/app/api/brain/ingest/              Accepts uploads, classifies, stores in knowledge_base
src/app/api/brain/ask/                 Cross-source intelligence synthesis (entity resolution + RAG + Claude)
```

### Pages (consolidated — migration complete)
```
src/app/page.tsx                CEO Brain dashboard — chat-first UI, KPIs, prior conversations
src/app/orgs/                   Unified org route — ?type=investor|partner|customer filters
src/app/contacts/               Contacts (queries core.contacts, core.relationships)
src/app/pipeline/               Pipeline (queries crm.pipeline)
src/app/tasks/                  DO NOT CHANGE
src/app/knowledge/              DO NOT CHANGE
src/app/intelligence/           Scanner health metrics
src/app/settings/taxonomy/      Manage core.taxonomy tree
src/app/people/roles/           Shows core.team_members
src/middleware.ts               Redirects old routes → /orgs?type= (308 permanent)
```

Old routes DELETED (redirected via middleware):
```
/investors         → /orgs?type=investor
/soccer-orgs       → /orgs?type=customer
/channel-partners  → /orgs?type=partner
/all-orgs          → /orgs
/investor-contacts → /contacts?type=investor
/market-map        → /orgs
```

### Components (stable — do not change)
```
src/components/ui/*             shadcn/ui — never modify
src/components/Sidebar.tsx      Navigation — dark #3E4C60 theme, custom icons
src/components/EditableCell.tsx Inline editable table cells
src/components/Avatar.tsx       Gravatar-backed avatars
src/components/EntityLinker.tsx Links entities across tables
src/hooks/useResizableColumns   Resizable table column widths
```

---

## Critical Rules — Never Violate These

### 1. No cross-schema PostgREST embedding
When using `.schema('core').from('organizations')`, you cannot embed resources from `crm.*` or `intel.*` in the same select string. PostgREST only resolves FK relationships within the active schema context.

**Wrong:**
```typescript
supabase.schema('core').from('organizations')
  .select('*, pipeline:crm.pipeline(status)') // ❌ will return null
```

**Right:**
```typescript
// Two separate queries, assembled in code
const { data: orgs } = await supabase.schema('core').from('organizations').select('*');
const { data: pipeline } = await supabase.schema('crm').from('pipeline').select('*').in('org_id', orgIds);
// Assemble manually
```

Same-schema embeds work fine — use bare table names, not prefixed:
```typescript
supabase.schema('core').from('organizations')
  .select('*, org_types(type, status)') // ✅ bare name, not core.org_types
```

### 2. No embedding on polymorphic entity_id
`brain.tasks`, `brain.activity`, and `brain.correspondence` use `entity_id + entity_type` (polymorphic). There is no FK. PostgREST cannot embed across these. Always query with an explicit filter:

```typescript
supabase.schema('brain').from('tasks').select('*').eq('entity_id', orgId) // ✅
supabase.schema('brain').from('tasks').select('*, org:core.organizations(name)') // ❌
```

### 3. db.ts vs db-scanner.ts — know which to use

| File | Used by | Client | Auth |
|------|---------|--------|------|
| `src/lib/db.ts` | Pages, components, server components | `src/lib/supabase.ts` (anon key) | Supabase Auth session |
| `src/lib/db-scanner.ts` | API routes, scanner libs | `createClient(url, serviceKey)` | Service role — bypasses RLS |

Never import `db-scanner.ts` in a client component. Never use the anon key in a scanner.

### 4. Types vs taxonomy — never conflate them
- `core.org_types` — the relationship between an org and MiM. Controlled list: `customer`, `partner`, `investor`, `vendor`. Change by inserting a new row for an org.
- `core.taxonomy` — what an org is in the world. Infinite tree. Change by inserting a new taxonomy node. Never add columns.

### 5. knowledge_base split
- `public.knowledge_base` where `source_type = 'news'` → stays in public, never touched, sentiment scanner owns it
- `public.knowledge_base` where `source_type != 'news'` → migrated to `brain.knowledge`
- The sentiment scanner (`src/app/api/agents/sentiment-scanner/route.ts`) is **never modified**

### 6. brain.ceo_context is CEO-only
This table contains Mark's personal intelligence feed. RLS must restrict it to the `ceo` role in `core.team_members`. No other team member or app user should ever see rows from this table. Tighten the RLS policy immediately after the blanket `authenticated_all` policy is applied in the migration.

---

## How to Do Common Things

### Add a new org type (e.g. 'vendor')
Types are a data operation, not a schema change. Just insert a row:
```sql
INSERT INTO core.org_types (org_id, type, status)
VALUES ('<org_uuid>', 'vendor', 'active');
```
The UI at `/orgs?type=vendor` will automatically work because filtering is done by `org_types.type`.

### Add a new taxonomy category (e.g. Gaming > Minecraft)
Taxonomy is a data operation, not a schema change:
```sql
-- First get the parent id
SELECT id FROM core.taxonomy WHERE slug = 'gaming';

-- Then insert the child
INSERT INTO core.taxonomy (name, slug, parent_id, depth, sort_order)
VALUES ('Minecraft', 'gaming-minecraft', '<parent_id>', 2, 1);
```

### Add a new scanner
1. Create `src/lib/your-scanner.ts` — follow the pattern in `gmail-scanner.ts`
2. Use `upsertActivity()` and `upsertCeoContext()` from `db-scanner.ts` for writes
3. Use separate queries for cross-schema data — never PostgREST cross-schema embeds
4. Create `src/app/api/agents/your-scanner/route.ts` — set `maxDuration`, use service role client
5. Add a trigger button to the dashboard following the existing scanner button pattern

### Write a new page that lists orgs
```typescript
import { getOrgs } from '@/lib/db'; // Step 0 determines Option A vs B — see mimbrain-ui-migration.md

// Fetch with optional filters
const orgs = await getOrgs({ type: 'investor', search: query });
```

### Write a new page that shows org detail tabs
Each tab fetches its own data independently on activation. Never block the whole page on a single query. See Phase 2b in `mimbrain-ui-migration.md` for the full pattern.

---

## Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (client-side)
SUPABASE_SERVICE_KEY=            # Supabase service role key (server-side only)
ANTHROPIC_API_KEY=               # Claude API key
GOOGLE_TOKEN=                    # Base64-encoded Gmail OAuth token.json
SLACK_BOT_TOKEN=                 # Slack bot token
```

---

## Spec Documents

Three spec documents live alongside this one. Read them in this order for a new session:

| Document | Purpose | Read When |
|----------|---------|-----------|
| `MIMBRAIN.md` (this file) | Project context and conventions | Every session, first |
| `mimbrain-migration.md` | Database schema creation and data migration | Before touching Supabase |
| `mimbrain-ui-migration.md` | UI query layer migration, route consolidation, dashboard rebuild | Before touching Next.js code |

### Current migration status

**DB migration (`mimbrain-migration.md`):**
- ✅ Steps 1–13 fully executed against production database (March 2026)
- ✅ Step 9 validation: 554 orgs, 260 org_types, 322 contacts, 384 relationships, 85 pipeline, 102 opportunities, 89 investor profiles, 292 org_financials, 100 tasks, 142 correspondence, 121 agent_runs
- ✅ Step 10: Dead weight tables dropped
- ✅ Step 11: `updated_at` triggers active on all relevant tables
- ✅ Step 12: RLS enabled on all 22 tables (blanket `authenticated_all` — tighten per-role before shipping team access)
- ✅ Step 13: 19 performance indexes created
- Old `public.*` tables preserved as read-only archives; `public.knowledge_base` stays permanently for sentiment scanner

**UI migration (`mimbrain-ui-migration.md`):**
- ✅ Step 0: Cross-schema embedding tested — Option B selected (separate queries)
- ✅ Phase 0: `db.ts` and `db-scanner.ts` created
- ✅ Phase 1: All scanners migrated to new schema
- ✅ Phase 2: Unified `/orgs` route, sidebar rebuilt, old routes deleted
- ✅ Phase 3: Page queries updated across all routes
- ✅ Phase 4: CEO Brain dashboard rebuilt with chat-first UI
- ✅ Phase 5: Old routes deleted, middleware redirects in place, config files cleaned up

---

## Decisions Already Made — Do Not Re-Debate These

These were deliberated and resolved. Relitigating them wastes time.

| Decision | Reason |
|----------|--------|
| Types and taxonomy are separate tables | Types = MiM relationship (bounded). Taxonomy = world classification (infinite). Conflating them was the root cause of the original 63-column mess. |
| No cross-schema PostgREST embedding | PostgREST only resolves FKs within the active schema. Separate queries assembled in code is the correct pattern. |
| `public.knowledge_base` stays permanently | The sentiment scanner owns it. Migrating news articles would require changing the scanner which is stable and working. `brain.knowledge` handles structured documents only. |
| CEO brain is Phase 1, customer portal is Phase 4 | CEO brain has zero dependency on product scale. Customer portal requires the consumer app to have meaningful usage before it's useful. |
| White label is deprioritised | It is a second product, not a feature. Build the core first. |
| `db.ts` is not client-only | It is used by both client components and server components. `db-scanner.ts` is the server-only boundary. |
| `brain.ceo_context` is not shared | Mark's intelligence feed is private. Team CRM data lives in `crm.*` and `core.*` which team members can access per their role. |
| Old routes redirect via middleware | `next.config.ts` redirects cannot preserve `?type=` query params. Middleware handles list page redirects cleanly. |

---

## Team

| Person | Role | Owns |
|--------|------|------|
| Mark Slater | CEO | Design, UX, interim Marketing/Operations, Finance, HR, Fundraising |
| Jim Caralis | Product | Product management, Marketing |
| Nathan Eagle | CTO | Engineering |
| Walt Doyle | President | Sales, BD, Fundraising |

Mark is the primary user of Module 1 (CEO Brain). The team uses Module 2 (CRM). App users (Heather, Ian, Rosanna — sports parents, hobbyists, gamers) use the consumer app, not MiMbrain.

---

## Quick Reference

```
New session checklist:
1. Read this file
2. Check "Current State" section above
3. If schema changed, regenerate types: update src/types/supabase.ts

Before writing any query:
- Same schema? Use PostgREST embed with bare table name ✅
- Cross-schema? Separate queries + assemble in code ✅
- Polymorphic entity_id? Direct .eq() filter, never embed ✅
- Client component? Import from db.ts ✅
- API route or scanner? Import from db-scanner.ts ✅
- Need examples? See existing functions in db.ts (Option B pattern throughout)

Before adding to the schema:
- New org type → INSERT into core.org_types (not a schema change)
- New category → INSERT into core.taxonomy (not a schema change)
- Genuinely new concept → add a column or table, document the decision here

Data ontology migration: COMPLETE (all 13 steps executed, all 5 UI phases done)
```
