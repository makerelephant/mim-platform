# Session Notes — March 10, 2026: Brain Pipeline Rebuild

## What Was Done

Three-phase rebuild of the MiM Brain intelligence pipeline. All work is on branch `claude/gifted-curran`.

### Phase 1: Wire Up Intelligence Pipeline (commit `d3f3eb4`)

**1A — Taxonomy injection into classifier prompts**
- Both `gmail-scanner.ts` and `slack-scanner.ts` now call `loadTaxonomy()` and inject a `{{TAXONOMY_SECTION}}` placeholder into `CLASSIFIER_SYSTEM_PROMPT`
- `buildTaxonomyPromptSection()` in `taxonomy-loader.ts` generates the section dynamically from the `inference_taxonomy` DB table
- Includes category names, descriptions, signal keywords, and priority rules

**1B — Fixed loadOrgContext casing bug**
- Both scanners had `types.includes("investor")` but DB stores `"Investor"` (capitalized)
- Fix: `const lowerTypes = types.map((t: string) => t.toLowerCase())` then compare against lowercase

**1C — Wired `enforcePriorityRules` into both scanners**
- After classification, runs `matchTaxonomyCategory()` to find the best taxonomy match from tags
- Then `enforcePriorityRules()` checks if any priority_rules conditions are met (e.g., "term-sheet" → critical)
- Only escalates priority, never downgrades

**1D — Content-aware brain card routing**
- Activity metadata now includes: `taxonomy_slug`, `taxonomy_card_key`, `priority`, `goal_relevance`, `recommended_action`
- Dashboard routing logic checks `metadata.taxonomy_card_key` FIRST, falls back to org_type
- This means an Anthropic payment email routes to "customer" card even though Anthropic's org_type is "investor"

**1E — Added pending_review and dismissed statuses**
- `tasks/page.tsx` and `tasks/[id]/page.tsx` — new status icons, filter buttons, toggle cycles
- `feedback-engine.ts` — `dismissed` counted as "ignored" signal
- `labels.ts` — new status labels added

**1F — Taxonomy category on tasks**
- Both scanners now set `taxonomy_category` on created tasks
- Requires adding `taxonomy_category TEXT` column to `brain.tasks` in Supabase

### Phase 2: Approval Queue with Draft Replies (commit `53f1e53`)

**2A — Classifier generates draft_reply**
- `ClassificationResult` interface in both scanners extended with `draft_reply: string | null`
- `CLASSIFIER_SYSTEM_PROMPT` updated with instructions and examples for generating ready-to-send 2-3 sentence replies
- Null for newsletters, internal notifications, etc.
- Stored on tasks via `draft_reply` field (requires adding `draft_reply TEXT` column to `brain.tasks`)

**2B — ApprovalQueue component** (`src/components/ApprovalQueue.tsx`)
- Sorted by priority → goal_relevance → date
- Each item shows: priority dot, sentiment indicator, entity name, taxonomy category badge, summary, time
- Expandable details: recommended_action (editable), draft_reply (editable, blue box), tags
- Actions: Approve (→ todo), Edit (inline save), Dismiss (→ dismissed), Save & Approve
- Amber-themed card with `border-amber-200 bg-amber-50/30`

**2C — Dashboard integration**
- Loads `pending_review` tasks, resolves entity names from org map
- Enriches with tags/sentiment from `classification_log`
- ApprovalQueue appears between KPI rows and brain cards

**2D — Feedback engine updated** (done in 1E)
- `dismissed` = ignored signal, `pending_review` included in 7-day stale check

### Phase 3: Intelligent Presentation (commit `d6c39aa`)

**3A — BrainCard component** (`src/components/BrainCard.tsx`)
- `BrainCardRow` — priority dots (critical=red, high=orange, medium=blue, low=gray), sentiment indicators (+/-/!), goal relevance badges (7+), compact tag display
- `sortBrainItems()` — sorts by priority tier → goal_relevance → date
- Replaces inline rendering in all 3 dashboard brain cards

**3C — AlertBanner component** (`src/components/AlertBanner.tsx`)
- Red banner for critical alerts, amber for high priority
- Dismissible individual items via local state
- Links to tasks page
- Renders above approval queue on dashboard

**3D — KPI layout**
- Two rows of 5 KPI cards each (commerce row + operational row)
- All currently placeholder "—" / "TBD" — will be wired to Firestore later

### Phase 3 follow-up: KPI Revert (commit `9d076fc`)
- Removed Supabase KPI queries per user request
- All KPIs are placeholders until Firestore integration

## DB Schema Changes Needed

These columns need to be added to `brain.tasks` in Supabase:

```sql
ALTER TABLE brain.tasks ADD COLUMN IF NOT EXISTS taxonomy_category TEXT;
ALTER TABLE brain.tasks ADD COLUMN IF NOT EXISTS draft_reply TEXT;
```

## Files Created

| File | Purpose |
|------|---------|
| `src/components/ApprovalQueue.tsx` | CEO review queue for pending tasks |
| `src/components/BrainCard.tsx` | Smart brain card rows with priority/sentiment/relevance |
| `src/components/AlertBanner.tsx` | Critical/high priority alert banner |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/gmail-scanner.ts` | Taxonomy injection, casing fix, priority enforcement, draft_reply, enriched metadata, pending_review status |
| `src/lib/slack-scanner.ts` | Same changes mirrored from gmail-scanner |
| `src/lib/taxonomy-loader.ts` | `buildTaxonomyPromptSection` with priority_rules, `enforcePriorityRules` function |
| `src/app/page.tsx` | Content-aware routing, approval queue, alert banner, BrainCard component, KPI layout |
| `src/app/tasks/page.tsx` | pending_review + dismissed statuses |
| `src/app/tasks/[id]/page.tsx` | pending_review + dismissed statuses |
| `src/config/labels.ts` | Task status labels |
| `src/lib/feedback-engine.ts` | Dismissed as ignored, pending_review stale check |

## Architecture Notes for Next Agent

### How the Brain Pipeline Works Now

```
Email/Slack arrives
    ↓
Pre-filter (skip newsletters, auto-replies)
    ↓
Taxonomy loaded from DB → injected into classifier prompt
    ↓
Claude classifies: summary, tags, sentiment, priority, action_items, draft_reply
    ↓
enforcePriorityRules() — escalate if taxonomy rules match
    ↓
matchTaxonomyCategory() — find best taxonomy slug from tags
    ↓
Task created with status="pending_review" + taxonomy_category + draft_reply
    ↓
Activity logged with taxonomy_card_key for content-aware routing
    ↓
Dashboard: AlertBanner → ApprovalQueue → Brain Cards (sorted, enriched)
    ↓
CEO approves/edits/dismisses → feedback engine learns
```

### Key Patterns

- **Content-aware routing**: `taxonomy_card_key` on activity metadata routes by email CONTENT, not org_type. An investor's payment email goes to "customer" card.
- **Priority enforcement**: Taxonomy `priority_rules` can escalate (never downgrade). E.g., "term-sheet" tag → critical priority.
- **Pending review flow**: All scanner-created tasks start as `pending_review`. CEO must approve before they enter work queue (`todo`).
- **Draft replies**: Classifier generates ready-to-send 2-3 sentence replies. CEO can edit before approving.

### What's NOT Built Yet

- `is_alert` boolean column on tasks (was in plan, not implemented)
- InlineTaskActions (3B) — hover action bar on brain card items
- Vector embeddings / RAG for knowledge_base chunks
- MCP server (design exists in `docs/mcp-server-plan.md`, not built)
- Conversational prompt interface to the brain
- Firestore KPI integration

### Open Questions from CEO (end of session)

The CEO wants to feed strategic documents into the brain and prompt it to do things like "summarize this and include it in the next weekly report." This requires:
1. A conversational interface / prompt layer for the brain
2. RAG or semantic retrieval over stored knowledge
3. Memory persistence so the brain "retains" and can surface information on demand
4. Integration between knowledge_base and the report generator

These questions are being addressed in a follow-up architectural discussion.
