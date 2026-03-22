# Master Effort List
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document.
> **Last updated:** 2026-03-21

---

## Complete / Operational

1. **Core Data Layer** — Contacts, organisations, pipeline, tasks, support issues, activity log. CRUD complete, entity linking, multi-schema DB architecture. Operational. *(The old static CRM UI exists but is being deprecated — data layer remains.)*

2. **Communication Intelligence Pipeline (Gmail Gopher)** — Gmail Gopher classifies inbound messages using Acumen categories, resolves entities, creates tasks, logs correspondence, and emits feed cards with full email metadata (from, to, subject). Classifier uses 11 business categories with importance levels and reasoning. Contact quality gate prevents junk creation. Assistant prefill technique enforces JSON output. Thread consolidation via `source_ref` deduplication. Operational.

3. **Brain Chat Interface** — Chat-first interface with `/api/brain/ask` endpoint (entity resolution → dossiers → knowledge search → Claude synthesis). Working. Used by Your Canvas for brain-assisted prep. All inputs route to brain/ask (isQuery detection removed — everything gets a real answer).

4. **Decision Logging & CEO Review** — Acumen classifier writes category, importance, and reasoning to `brain.classification_log`. CEO reviews via feed card actions (Do/Hold/No) in Your Motion. Operational.

5. **Data Ontology Migration** — Multi-schema architecture (core/crm/intel/platform/brain), DB hardening, RLS, indexes, TypeScript types, route consolidation. Complete.

6. **MCP Server** — 28 tools across 9 domains (knowledge, instructions, intelligence, tasks, contacts, organisations, pipeline, correspondence, system). Built, not yet deployed to a host.

7. **Acumen Classifier System** — 11 email categories with harness rules, department docs, harness loader, classification pipeline. Complete and classifying live email.

8. **Your Motion — Feed Architecture** — ✅ COMPLETE. Single scrollable feed of interactive cards at root route. Card types: Decision, Action, Signal, Briefing, Snapshot, Intelligence, Reflection. Cards show email context (from/to/subject), priority-based title styling (high=black, medium=slate-500, low=slate-400), Do/Hold/No actions, "More about this" expansion. `brain.feed_cards` table with visibility_scope, ingestion_log for audit. Filter pills: All, Decisions, Actions, Signals, Intel, Briefings, Old.

9. **Snapshotting Engine** — ✅ COMPLETE. `/api/brain/snapshot` accepts natural language queries, uses Claude to determine which tables to query, executes against Supabase, formats results into markdown snapshot cards in the feed. Replaces static pages. Motion search bar wired to snapshotting.

10. **Your Canvas** — ✅ COMPLETE. `/clearing` route (UI label: Canvas). Thought capture and brain-assisted Q&A routed entirely to `/api/brain/ask`. File ingestion via drag-and-drop. Multiple sessions, dissolve when done. Gate for deeper work — not a creation tool.

11. **Engine Room + Motion Map** — ✅ COMPLETE. `/engine` route. Four tabs: Motion Map (renders harness classifier markdown files), Brain Accuracy (per-category stats from CEO actions), Autonomy (category progress toward self-governance), Integrations (connection status). Signal Quality and Priority Calibration panels added.

12. **Classifier Training at Scale** — ✅ COMPLETE (infrastructure). `/api/brain/accuracy` computes per-category accuracy from CEO feed actions (Do=correct, No=incorrect). Daily cron scheduling via Vercel (Gopher at 6am EST, briefing at 7am EST). Training velocity depends on CEO daily review cadence.

13. **Daily Synthesis Loop** — ✅ COMPLETE. `/api/agents/daily-briefing` runs 7 parallel queries (feed_cards, correspondence, tasks created/completed, open tasks, activity, CEO actions) from last 24h. Skips generation when genuinely nothing to report. Claude synthesises into concise briefing card. Runs automatically via Vercel cron at 7am EST.

14. **Behavioral Adaptation / Autonomy Engine** — ✅ COMPLETE. Real learning loop: corrections cluster into rules via Claude, stored in `brain.behavioral_rules`, injected into classifier prompts. Gmail scanner checks autonomous categories at scan start, auto-acts qualifying cards (CEO never sees them). Reflection card summarises autonomous actions per scan. `getAutonomousCategories()` shared utility. Autonomy tab in Engine Room shows progress. Thresholds: 20+ reviews, 90%+ accuracy.

15. **Knowledge Ingestion Enhancement** — ✅ COMPLETE. `/api/brain/ingest` emits feed cards for ingested documents. Canvas uses this for file drop ingestion.

16. **Single Ingestion Point** — Core architectural principle documented and enforced. All data enters through one endpoint. Brain classifies, decides, acts, emits cards. No UI writes directly to database.

17. **Visibility Scope** — `visibility_scope` field on every feed card: `personal` (Phase 1), `team` (Phase 2), `regiment` (Phase 3). Publish/subscribe model for teams — no RBAC.

18. **Correction Learning Pipeline** — ✅ COMPLETE. `/api/brain/learn` processes CEO corrections (wrong_category, wrong_priority, should_not_exist) and stores structured corrections in `brain.knowledge_base` as institutional memory. Feed card PATCH auto-fires learning. Brain improves from every No action.

19. **Embedding & RAG Pipeline** — ✅ COMPLETE. `src/lib/embeddings.ts` (OpenAI text-embedding-3-small, 1536 dimensions). Auto-embeds on ingestion into `brain.knowledge_chunks` (pgvector). `/api/brain/ask` uses vector similarity search before keyword search. `search_knowledge` and `search_correspondence` RPC functions. `/api/brain/embed-backfill` for backfilling. `OPENAI_API_KEY` set in Vercel env.

20. **Bulk Data Import Gopher** — ✅ COMPLETE. `/engine/import` UI page + `/api/agents/gmail-bulk-import` endpoint. Import N days of historical email in chunked batches. Progress bar, stats, abort support. Also accessible as a direct link row on the Me page ("Bulk Data Import Gopher").

21. **Thread Consolidation** — ✅ COMPLETE. `src/lib/feed-card-emitter.ts` with fetch-then-update pattern on `source_ref` (handles partial unique index — replaces broken upsert approach). Gmail Gopher checks for existing thread card before creating new one. Same Gmail thread → one card that evolves. Priority upgrades if new message is higher. Card resurfaces as unread. Shows "N messages" badge.

22. **Card Type Inference** — ✅ COMPLETE. Only `critical` priority → decision. High priority → intelligence. Has action items → action. Newsletter/automated/marketing → signal. Has draft reply (Slack) → action. Everything else → signal. Stoplights only on decision/action cards.

23. **Action Recommendations** — ✅ COMPLETE. Scanner prompt generates `action_recommendation` field. Decision and action cards display amber banner with recommended action.

24. **Training Mode Framing** — ✅ COMPLETE. Every card shows what the brain classified and why. Train button opens correction modal.

25. **Train Button on All Cards** — ✅ COMPLETE. Pencil icon + "Train" button on every card type. Opens inline correction panel with dropdowns for category, priority, card type, "should not exist" checkbox, and free-text note. Shows "Learned ✓" confirmation.

26. **Decision Card UI (Figma Pixel-Perfect)** — ✅ COMPLETE. FeedCard.tsx rewritten to match Figma. 500px fixed width, 12px padding, 12px border radius, drop shadow. Card type badges, source pills, entity dotted underlines, "More About This" expansion, MOTION REASONING section. Resolved states with opacity and background changes.

27. **Motion Page Header & Gopher Trigger** — ✅ COMPLETE. Avatar + "Mark Slater, CEO." + "Important Conversations" title + "updated X ago" timestamp + blue refresh spinner icon that triggers POST /api/agents/gmail-scanner. Search bar wired to snapshotting.

28. **Sidebar Navigation (Figma Pixel-Perfect)** — ✅ COMPLETE. Sidebar.tsx rewritten to match Figma node 30:419. 163px white card, rounded-12, nav items at 14px Geist Medium with active pill. Footer with MiM icon. Navigation: Motion, Canvas (was Clearing), Engine Room, Me.

29. **Canvas Page (Figma Pixel-Perfect)** — ✅ COMPLETE. Canvas/Clearing page rewritten to match Figma. Chat Header with "A Thinking Space" title. Prior Conversations panel (257px), chat area with right-aligned user messages and left-aligned brain responses. Bottom input bar with "Launch a Gopher" pill and "Add To Knowledge" pill. Drag-and-drop file ingestion.

30. **Document Ingestion — Large File Support** — ✅ COMPLETE. Files > 4MB bypass Vercel's 4.5MB serverless limit via signed Supabase Storage upload URL (`/api/brain/upload-url`). Browser uploads directly to Supabase Storage; ingest triggered via storage path. pdf-parse for text-layer PDFs. Claude Vision fallback for image-based PDFs (Keynote/PPT exports) < 5MB. Image-only PDFs > 5MB receive a clear export-as-PPTX guidance message.

31. **Slack Gopher** — ✅ COMPLETE. `/api/agents/slack-scanner` (GET + POST). `src/lib/slack-scanner.ts`. Assistant prefill technique enforces JSON output (eliminates "Slack message in #channel" fallback). Noise filter (drops zero-action-item cards with generic summaries). Always-on action extraction rules (direct mentions, shared links). Card type inference (has_draft_reply → action). Thread fetching before classification.

32. **Dynamic Integration Status** — ✅ COMPLETE. `/api/engine/integrations` checks env vars to report real-time connection status. Engine Room Integrations tab fetches dynamically.

33. **Me Page Dashboard** — ✅ COMPLETE. `/me` page shows brain accuracy, cards reviewed, unread count, autonomy progress bars per category, action breakdown, quick action buttons, and direct link row for Bulk Data Import Gopher.

34. **Feed Type Filters** — ✅ COMPLETE. Filter pills (All, Decisions, Actions, Signals, Intel, Briefings, Old) above the feed stream.

35. **Platform Health Dashboard** — ✅ COMPLETE. `/api/engine/health` reports database connectivity, last Gopher/briefing/synthesis times, feed status breakdown, pending resurface count, env var availability.

36. **Gopher Launcher + Add To Knowledge** — ✅ COMPLETE. Canvas "Launch a Gopher" pill opens popup with agents. "Add To Knowledge" pill ingests current input text into `brain.knowledge_base`.

37. **Resurface Frequency** — ✅ COMPLETE. Resurface cron every 4 hours.

38. **Instruction Loader** — ✅ COMPLETE. `src/lib/instruction-loader.ts` loads CEO standing orders from `brain.instructions` and injects into scanner and report prompts. Superset of previous version — supports all instruction types.

39. **Adaptation Agent + Behavioral Rules** — ✅ COMPLETE. `src/lib/adaptation-agent.ts`. Measures outcomes, diagnoses systematic failures, proposes and applies behavioral rules. High-confidence rules auto-apply; lower-confidence rules surface to CEO. `/api/agents/adaptation/route.ts` for triggered runs. `/api/brain/rules/route.ts` for rules CRUD.

40. **Clearing Conversation Fix** — ✅ COMPLETE. Removed isQuery detection pattern that only routed narrow keyword patterns to brain/ask. All Canvas inputs now route to `/api/brain/ask` with session_id and scope. No more "Absorbed." non-answers.

---

## Near-Term Efforts (Operational Phase)

41. **Unified Classifier — Prompt Surface Layer** — ✅ COMPLETE. `src/lib/unified-classifier.ts` implements P0-P3/S0-S3 attention labels. Both gmail-scanner and slack-scanner use `buildUnifiedClassifierPrompt()`. Card type mapped from attention class (P0→decision, P1→action, P2→signal, P3→suppressed). Task creation gated on `qualifiesForTaskCreation() + should_create_task`. Pre-filter still handles obvious noise; classifier handles nuanced P3/S3 judgment.

42. **Measurement Layer** — ✅ COMPLETE. `brain.events` table (step-29). `/api/brain/track` for card_expanded/card_action/filter_changed events. `/api/brain/metrics` computes SNR, priority calibration, category accuracy trends, volume stats, expansion rate, autonomy readiness. FeedCard fires expansion tracking. Engine Room Metrics tab with full dashboard.

43. **Market Intelligence Gophers** — ✅ COMPLETE. Web Intelligence Gopher: `src/lib/web-intelligence-scanner.ts` fetches configured URLs, Claude analyses for insights, emits intelligence cards. Content hash dedup. Default monitors for youth sports, generative commerce, MiM mentions. `/api/agents/web-intelligence` route. Vercel cron daily 9am EST. Source URLs now configurable from Engine Room Integrations tab — `/api/engine/web-sources` CRUD API, add/remove sources, auto-migrates defaults on first custom add.

44. **Commerce Integration** — Connect Printify/Drop data to platform. Real KPI values (revenue, items sold, AOV, conversion). Product creation event capture with design detail logging.

45. **Automated Report Generation** — ✅ COMPLETE. Unified `/api/agents/report` endpoint accepts weekly/monthly/custom types. Custom reports take focus area + period (7/14/30/90 days). All reports emit briefing cards. Me page has "Generate Report" section with quick buttons + custom input. PDF export TODO.

46. **Prompt Surface Layer — Engine Room Editing** — ✅ COMPLETE. 6 agent prompts extracted to `src/lib/prompts/` (daily-briefing, weekly-synthesis, monthly-report, brain-ask, brain-ingest, brain-snapshot). `/api/engine/prompts` GET/PATCH for reading and overriding. Overrides stored in `brain.instructions` with type='prompt_override'. All route handlers import from prompts/.

47. **Visual Chart Rendering** — ✅ COMPLETE. Recharts integration for feed cards. `src/components/FeedChart.tsx` renders bar, line, area, pie, and horizontal bar charts inside card bodies. Charts embedded via ` ```chart` JSON blocks in markdown — Claude generates them in snapshots, briefings, and reports when data supports visualization. Dynamic import (no SSR). Supports multi-series, custom colors, branded palette. All report/snapshot/briefing prompts updated with chart generation instructions.

48. **Contact Panel Data Fix** — ✅ COMPLETE. Fixed `core.contacts` field mapping — DB uses `first_name`/`last_name`/`role`, frontend sends `name`/`title`. API now maps bidirectionally. Organization linking fixed to use `organization_contacts` junction table instead of nonexistent `organization_id` column. Proper error logging added to PATCH endpoint.

49. **Canvas Layout Fix** — ✅ COMPLETE. Removed legacy 52px marginTop from Canvas chat card (was spacing for a removed header element). Chat card now sits at 24px from top.

---

## Strategic Pivot: Foundation Excellence → Intent Suggestions (March 20, 2026)

> **See:** `docs/strategic/platform-pivot-march-2026.md` for full decision document.
>
> The platform is pivoting from zero-tolerance correctness (Do/Hold/No) to contextual intent suggestions (Read/Respond/Write/Schedule). Before the UI pivot ships, the data foundation must be bulletproof. The build order below reflects this priority.

---

## Active Efforts (Foundation Excellence — Current Priority)

63. **Full-Body Comprehension Pipeline** — ✅ COMPLETE. Gmail scanner now reads full email body content (increased from 3K to 8K chars). Web intelligence scanner content window expanded from 2K to 8K chars. Classifier receives complete document context for accurate categorization.

64. **Bulletproof Recall** — ✅ COMPLETE. 7-day guaranteed recall window with relevance ranking (title match +3, summary +2, recency bonus +5/+2). Vector search thresholds lowered (0.3→0.18). Result counts expanded (8→15 knowledge, 8→12 correspondence). Keyword search broadened to title+summary+tags. Feed card search added (last 7 days, keyword match on title+body). The brain recalls anything submitted within the last week.

65. **Canvas Auto-Embedding & Multi-Turn Context** — ✅ COMPLETE. Every substantive Canvas message (50+ chars) auto-embeds into `brain.knowledge_base` + `brain.knowledge_chunks` with OpenAI embeddings. Brain Q&A exchanges also embedded as institutional memory. Multi-turn conversation history loaded into Claude API calls. Cross-session message retrieval (last 24h). Recent document window expanded from 2h → 24h.

66. **Entity Resolution Depth** — ✅ COMPLETE. Fuzzy matching via Levenshtein distance (~20% edit distance threshold). First/last name partial matching (4+ char names). Email address and prefix matching. Domain matching. Acronym detection. Entity fetch limits raised (200→500). Rich dossiers: org contacts, pipeline notes, correspondence history, contact org relationships, feed card activity.

67. **CEO Action Decision Logging** — ✅ COMPLETE. Every Do/No/Hold action on feed cards now logs to `brain.decision_log` (not just corrections). Every CEO interaction is training data.

68. **Learning Pipeline Embeddings** — ✅ COMPLETE. CEO corrections via `/api/brain/learn` now write to correct `brain` schema, generate vector embeddings for RAG retrieval, use correct `kb_id` column.

---

## UI Pivot: Natural Language Cards & Gmail Integration (March 21, 2026)

69. **MessageCard — Natural Language Feed Cards** — ✅ COMPLETE. New `MessageCard.tsx` component replaces FeedCard for email/Slack source cards. No classification chrome (badges, chips, priority borders). Clean natural language body text. 17 deterministic gopher icons (hashed from card ID). 4 intent icons: bell=respond, glasses=read, feather=write, alarm-clock=schedule. Entity highlighting in blue (`#289bff`) with contact tap handler. Entire card tappable to source. Trash button only. Route logic: `isMessageCard()` checks source_type for email/gmail/slack.

70. **Gmail Auto-Resolve on CEO Reply** — ✅ COMPLETE. Gmail scanner detects outbound CEO replies in threads. If an active feed card exists for that thread, auto-marks it as acted, logs to decision_log, records outbound correspondence, and logs "ceo_replied" activity. Skips normal classification for reply messages.

71. **Gmail Actions API** — ✅ COMPLETE. `/api/gmail/actions` route. GET: Thread status polling (replied/forwarded/drafted/starred/archived/unactioned). POST: Execute Reply (threaded with In-Reply-To/References headers), Draft (brain-generated contextual reply via Claude), Archive (remove INBOX label), Star (toggle STARRED). Every action creates a status. Shared Gmail auth utilities in `src/lib/gmail-client.ts`.

72. **Thread Status Chips (Figma Pixel-Perfect)** — ✅ COMPLETE. Per Figma 97:985/105:3194. Status chips with 12px icons + labels, `rounded-[6px]`, `pl-[6px] pr-[8px] py-[2px]`, SF Pro Display Medium 12px. Five states: Replied (↩ icon, `#289bff` text, `#ecfaff` bg), Forwarded (→ icon, `#5ad1b3` text, `#e3fff5` bg), Archived (📋 icon, `#3e4c60` text, `#f3f3f3` bg), Draft (📝 icon, `#9c6ade` text, `#f9f3ff` bg), Starred (★ icon, `#7b7f81` text, transparent bg). Action buttons (Reply/Draft/Archive/Star) removed from card face — actions happen in Gmail, status reflected on card. Chip positioned right-side next to trash.

73. **Sidebar Redesign** — ✅ COMPLETE. Per Figma 94:4010. "Every Step Together." tagline at top (18px bold, #e9e9e9). Icons moved left of labels (was label-left/icon-right). Font bumped to 14px (was 12px), letter-spacing -0.28px. Mark's avatar (30px rounded) + "Account Settings" (14px, #3e4c60). MiMbrain + Release at bottom.

74. **Note-Taking Feature** — ✅ COMPLETE. "Write" button in action bar opens NotePanel on right side of screen with dark overlay on feed. Title input + rich text area + bold/italic/list formatting toolbar. "All Notes" / "Drafts" tab badges with counts. Existing note previews. Save to Knowledge (generates OpenAI embedding, emits signal feed card), Save Draft, Delete actions. `/api/notes` route (GET/POST/DELETE). Notes stored in `brain.knowledge_chunks` as `ceo_note` or `ceo_note_draft` source types.

75. **Feed Refresh Button** — ✅ COMPLETE. Rotating refresh icon triggers feed data reload. Accurate "updated X ago" timer.

76. **Background Consistency Fix** — ✅ COMPLETE. Background image (`background.png`) moved to AppShell `<main>` element so it covers the full viewport including sidebar padding area. Eliminates the recurring empty-column stripe behind the semi-transparent sidebar. Page-level backgrounds removed (duplicate).

---

## Next: Training Redesign & Intent Pivot

77. **Training Redesign — Implicit Learning from Every Interaction** — 🟡 PLANNED. Current training UX is confusing: FeedCard has a "Correct?" link opening a category/priority/card-type dropdown panel. MessageCard has no training at all. Notes "Add to Knowledge" is knowledge ingestion, not classifier training. These are three different concepts muddled together. Redesign: (a) Every card dismissal (trash) should log as negative signal ("not useful"). (b) Every card tap-through to source should log as positive signal ("useful"). (c) Explicit correction panel simplified to "Was this useful? Yes/No" with optional "What should the brain have done differently?" free text. Training happens passively from every interaction — no special buttons needed.

78. **Card Action Pivot — Read/Respond/Write/Schedule** — 🟡 PLANNED. Replace Do/Hold/No action buttons with intent suggestion verbs. Additive change: backend classification (Acumen categories, P0-P3 priority) continues unchanged. Intent suggestions are the user-facing layer. Card layout update, feed PATCH handler update, intent accuracy tracking.

---

## Medium-Term Efforts

79. **MCP Server Deployment** — Deploy the 28-tool MCP server to a host. Enable CEO to query the brain from Claude Desktop or any MCP client. Test all tools against production Supabase.

80. **Teams** — Add a second user acting independently on the same brain. Prerequisite to any scaling. Not multi-tenant — shared brain, separate views.

81. **Long-Form Content & Research Publishing** — Brain-generated research papers, weekly industry newsletters, daily content bites.

---

## Longer-Term Efforts

82. **Harness Operating Model** — Structured MD behavioral contracts defining departments, processes, decision trees, Gopher logic. Needs its own discovery/scoping session.

83. **Autonomous Enrichment** — Self-directed Gopher activation where the brain identifies entities with low knowledge completeness and triggers enrichment without being asked.

84. **Asset/OCR Performance Intelligence** — Closed-loop system: capture product creation design decisions → correlate with performance data → derive actionable product insights.

85. **Model Abstraction Layer** — Abstract the LLM interface so Claude can be swapped for local models on high-volume structured tasks. Configuration not code changes.

86. **Multi-User / Auth** — Full login system, role-based access, team member permissions.

87. **Calendaring Tools** — TBD, to be unpacked.

88. **Game Event & Scheduling Tools** — TBD, to be unpacked.

89. **Team Chatting Tools** — TBD, to be unpacked.

90. **Person Feed Protocol** — AI-native identity standard (Phase 3). Design constraint only — don't build, don't block.

---

*Last updated: 2026-03-21 (v10) — Status chips pixel-perfect per Figma (Replied/Forwarded/Archived/Draft/Starred with icons + semantic colors). Gmail action buttons removed from card face (actions happen in Gmail, status reflected on card). Background consistency fix. Training redesign planned (implicit learning from every interaction). 76 efforts complete, 90 total.*
