# Master Effort List
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document. Use as a historical inventory, not as proof that listed capabilities are trustworthy in production.
> **Last updated:** 2026-03-28

---

## Read This First

This document has historically mixed together:

- things that exist in code
- things that shipped at some point
- things that are truly reliable in live operation

Those are not the same thing.

As of the current recovery effort:

- the main phase-1 problem is feed trust
- the feed is not yet a reliable operational inbox
- measurement and training claims are only partially trustworthy
- schema/runtime drift has existed

Use this file as an inventory of efforts and implementation work, not as the source of truth for what is currently working well.

For current operating posture, read first:

1. `CLAUDE.md`
2. `docs/operational/agent-recovery-rules.md`
3. `docs/context-primer.md`
4. `docs/intelligence-deficit-analysis.md`

---

## Exists In Code / Historically Delivered

1. **Core Data Layer** — Contacts, organisations, pipeline, tasks, support issues, activity log. CRUD complete, entity linking, multi-schema DB architecture. Operational. *(The old static CRM UI exists but is being deprecated — data layer remains.)*

2. **Communication Intelligence Pipeline (Gmail Gopher)** — Gmail Gopher classifies inbound messages using Acumen categories, resolves entities, creates tasks, logs correspondence, and emits feed cards with full email metadata (from, to, subject). Recovery work materially improved recent-window throughput, classifier robustness on legal/fundraising threads, title fallback, thread refresh, and post-classification priority handling. Do not read this as “email solved”; longer-window backlog coverage and full feed trust remain open.

3. **Brain Chat Interface** — Chat-first interface with `/api/brain/ask` endpoint (entity resolution → dossiers → knowledge search → Claude synthesis). Working. Used by Your Canvas for brain-assisted prep. All inputs route to brain/ask (isQuery detection removed — everything gets a real answer).

4. **Decision Logging & CEO Review** — Acumen classifier writes category, importance, and reasoning to `brain.classification_log`. CEO reviews via feed card actions (Do/Hold/No) in Your Motion. Operational.

5. **Data Ontology Migration** — Multi-schema architecture (core/crm/intel/platform/brain), DB hardening, RLS, indexes, TypeScript types, route consolidation. Complete.

6. **MCP Server** — 28 tools across 9 domains (knowledge, instructions, intelligence, tasks, contacts, organisations, pipeline, correspondence, system). Built, not yet deployed to a host.

7. **Acumen Classifier System** — 11 email categories with harness rules, department docs, harness loader, classification pipeline. Complete and classifying live email.

8. **Your Motion — Feed Architecture** — Implemented. This should not be read as proof that the feed is currently useful, quiet, or trustworthy.

9. **Snapshotting Engine** — ✅ COMPLETE. `/api/brain/snapshot` accepts natural language queries, uses Claude to determine which tables to query, executes against Supabase, formats results into markdown snapshot cards in the feed. Replaces static pages. Motion search bar wired to snapshotting.

10. **Your Canvas** — ✅ COMPLETE. `/clearing` route (UI label: Canvas). Thought capture and brain-assisted Q&A routed entirely to `/api/brain/ask`. File ingestion via drag-and-drop. Multiple sessions, dissolve when done. Gate for deeper work — not a creation tool.

11. **Engine Room + Motion Map** — Implemented. Metrics and dashboards should be treated cautiously until live instrumentation is verified.

12. **Classifier Training at Scale** — Infrastructure exists. Do not interpret this as proof of a healthy learning loop.

13. **Daily Synthesis Loop** — ✅ COMPLETE. `/api/agents/daily-briefing` runs 7 parallel queries (feed_cards, correspondence, tasks created/completed, open tasks, activity, CEO actions) from last 24h. Skips generation when genuinely nothing to report. Claude synthesises into concise briefing card. Runs automatically via Vercel cron at 7am EST.

14. **Behavioral Adaptation / Autonomy Engine** — Implemented in code. This is not a current phase-1 proof point and should not be treated as operationally validated.

15. **Knowledge Ingestion Enhancement** — ✅ COMPLETE. `/api/brain/ingest` emits feed cards for ingested documents. Canvas uses this for file drop ingestion.

16. **Single Ingestion Point** — Core architectural principle. Verify actual write paths before assuming current implementation conforms perfectly.

17. **Visibility Scope** — `visibility_scope` field on every feed card: `personal` (Phase 1), `team` (Phase 2), `regiment` (Phase 3). Publish/subscribe model for teams — no RBAC.

18. **Correction Learning Pipeline** — Implemented. The claim that the brain meaningfully improves from every correction remains to be proven in live use.

19. **Embedding & RAG Pipeline** — Implemented. Helpful memory infrastructure, but not evidence that the feed attention layer is working.

20. **Bulk Data Import Gopher** — ✅ COMPLETE. `/engine/import` UI page + `/api/agents/gmail-bulk-import` endpoint. Import N days of historical email in chunked batches. Progress bar, stats, abort support. Also accessible as a direct link row on the Me page ("Bulk Data Import Gopher").

21. **Thread Consolidation** — Implemented in the feed layer, but thread auditability has been weak and should not be assumed correct without verification.

22. **Card Type Inference** — ✅ COMPLETE. Only `critical` priority → decision. High priority → intelligence. Has action items → action. Newsletter/automated/marketing → signal. Has draft reply (Slack) → action. Everything else → signal. Stoplights only on decision/action cards.

23. **Action Recommendations** — 🟡 PARTIALLY RECOVERED. Scanner now generates more reliable `action_recommendation` output for important email threads, and MessageCard renders a recommendation band. Still not complete: state-aware recommendation/action behavior is mid-implementation and must not be treated as fully trustworthy yet.

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

42. **Measurement Layer** — Implemented in code, but not reliable enough to call complete. Live recovery checks found expected measurement tables unavailable in the live schema cache.

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

67. **CEO Action Decision Logging** — Implemented. Do not equate logging with useful learning.

68. **Learning Pipeline Embeddings** — ✅ COMPLETE. CEO corrections via `/api/brain/learn` now write to correct `brain` schema, generate vector embeddings for RAG retrieval, use correct `kb_id` column.

---

## UI Pivot: Natural Language Cards & Gmail Integration (March 21, 2026)

69. **MessageCard — Natural Language Feed Cards** — 🟡 ACTIVE RECOVERY. `MessageCard.tsx` now has a substantially improved email-card structure: source/gopher header, visible thread-state chips, participant line, title/body cleanup, recommendation band, contextual action inference, and earlier-message toggle. Still incomplete: thread expansion does not yet render message history, contextual actions are not fully trustworthy, and some state-aware behavior is still shallow.

70. **Gmail Auto-Resolve on CEO Reply** — ✅ COMPLETE. Gmail scanner detects outbound CEO replies in threads. If an active feed card exists for that thread, auto-marks it as acted, logs to decision_log, records outbound correspondence, and logs "ceo_replied" activity. Skips normal classification for reply messages.

71. **Gmail Actions API** — 🟡 BUILT, OPERATIONALLY LIMITED. `/api/gmail/actions` route exists. GET polls thread status (replied/forwarded/drafted/starred/archived/unactioned). POST supports Reply, Draft, Archive, Star. Limitation: status polling currently reflects actions taken through the platform more reliably than actions taken directly inside Gmail.

72. **Thread Status Chips (Figma Pixel-Perfect)** — ✅ IMPLEMENTED IN CURRENT EMAIL CARD UI. Visible `Replied` / `Forwarded` / `Draft` / `Starred` / `Archived` chips now exist in the MessageCard header and are a real part of the active email card design. Remaining issue is not chip absence; it is making recommendation/action behavior actually respect those states.

73. **Sidebar Redesign** — ✅ COMPLETE. Per Figma 94:4010. "Every Step Together." tagline at top (18px bold, #e9e9e9). Icons moved left of labels (was label-left/icon-right). Font bumped to 14px (was 12px), letter-spacing -0.28px. Mark's avatar (30px rounded) + "Account Settings" (14px, #3e4c60). In Motion logo + Release at bottom.

74. **Note-Taking Feature** — Implemented. Agents should verify schema conformity before treating note storage claims as ground truth.

75. **Feed Refresh Button** — ✅ COMPLETE. Rotating refresh icon triggers feed data reload. Accurate "updated X ago" timer.

76. **Background Consistency Fix** — ✅ COMPLETE. Background image (`background.png`) moved to AppShell `<main>` element so it covers the full viewport including sidebar padding area. Eliminates the recurring empty-column stripe behind the semi-transparent sidebar. Page-level backgrounds removed (duplicate).

76b. **Thread Status Polling** — Implemented. Thread identity and thread usefulness still require operational verification.

76c. **Note Save Flow Redesign** — ✅ COMPLETE. Per Figma: "Save" button replaces "Add to Knowledge" — every saved note goes to feed AND knowledge simultaneously. Gray checkmark turns green on success with "Added to Knowledge" label, then auto-clears after 2s. Feed note cards are tappable to reopen NotePanel with note loaded in edit mode. `editNoteId` prop on NotePanel, `onNoteTap` callback on FeedCard.

---

## Next: Training Redesign & Intent Pivot

77. **Training Redesign — Implicit Learning from Every Interaction** — 🟡 PLANNED. Current training UX is confusing: FeedCard has a "Correct?" link opening a category/priority/card-type dropdown panel. MessageCard has no training at all. Notes "Add to Knowledge" is knowledge ingestion, not classifier training. These are three different concepts muddled together. Redesign: (a) Every card dismissal (trash) should log as negative signal ("not useful"). (b) Every card tap-through to source should log as positive signal ("useful"). (c) Explicit correction panel simplified to "Was this useful? Yes/No" with optional "What should the brain have done differently?" free text. Training happens passively from every interaction — no special buttons needed.

78. **Card Action Pivot — State-Aware Email Actions** — 🟡 ACTIVE. Email card UI now has a contextual action area and recommendation band in implementation, including `Reply`, `Schedule`, and `Add to Tasks` where inferred. Still unfinished: state-aware trustworthiness, contradiction avoidance, and final action semantics.

79. **Gmail Recovery Throughput Pass** — ✅ MATERIALLY IMPROVED. Recent-window scans now complete without the same timeout failure mode that defined the earlier recovery phase. Seven-day windows can clear in multiple passes instead of stalling indefinitely. This is good progress, not a claim that long-window coverage is elegant or final.

---

## Medium-Term Efforts

80. **MCP Server Deployment** — Deploy the 28-tool MCP server to a host. Enable CEO to query the brain from Claude Desktop or any MCP client. Test all tools against production Supabase.

81. **Teams** — Add a second user acting independently on the same brain. Prerequisite to any scaling. Not multi-tenant — shared brain, separate views.

82. **Long-Form Content & Research Publishing** — Brain-generated research papers, weekly industry newsletters, daily content bites.

---

## Longer-Term Efforts

83. **Harness Operating Model** — Structured MD behavioral contracts defining departments, processes, decision trees, Gopher logic. Needs its own discovery/scoping session.

84. **Autonomous Enrichment** — Self-directed Gopher activation where the brain identifies entities with low knowledge completeness and triggers enrichment without being asked.

85. **Asset/OCR Performance Intelligence** — Closed-loop system: capture product creation design decisions → correlate with performance data → derive actionable product insights.

86. **Model Abstraction Layer** — Abstract the LLM interface so Claude can be swapped for local models on high-volume structured tasks. Configuration not code changes.

87. **Multi-User / Auth** — Full login system, role-based access, team member permissions.

88. **Calendaring Tools** — TBD, to be unpacked.

89. **Game Event & Scheduling Tools** — TBD, to be unpacked.

90. **Team Chatting Tools** — TBD, to be unpacked.

91. **Person Feed Protocol** — AI-native identity standard (Phase 3). Design constraint only — don't build, don't block.

---

*Recovery note: this file is no longer the right place to infer what is working well in production. Use it as implementation history only.*
