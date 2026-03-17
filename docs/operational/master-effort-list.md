# MiM Platform — Master Effort List

> Living document. Captures all major efforts/epics at summary level. Add new items as they emerge — unpack in separate sessions.
>
> **UI paradigm shift (March 2026):** All static CRM pages are being replaced by a feed-first architecture (Your Motion + Your Clearing + Engine Room). Efforts below reflect this. See `docs/product/ui-requirements.md` for the governing architecture document.

---

## Complete / Operational

1. **Core Data Layer** — Contacts, organizations, pipeline, tasks, support issues, activity log. CRUD complete, entity linking, multi-schema DB architecture. Operational. *(The old static CRM UI exists but is being deprecated — data layer remains.)*

2. **Communication Intelligence Pipeline** — Gmail scanner classifies inbound messages using Acumen categories, resolves entities, creates tasks, logs correspondence, and emits feed cards with full email metadata (from, to, subject). Classifier uses 11 business categories with importance levels and reasoning. Contact quality gate prevents junk creation. Operational.

3. **Brain Chat Interface** — Chat-first interface with ask_brain API endpoint (entity resolution → dossiers → knowledge search → Claude synthesis). Working. Used by Your Clearing for brain-assisted prep.

4. **Decision Logging & CEO Review** — Acumen classifier writes category, importance, and reasoning to `brain.classification_log`. CEO now reviews via feed card actions (Do/Hold/No) in Your Motion instead of the legacy `/decisions` page. Operational.

5. **Data Ontology Migration** — Multi-schema architecture (core/crm/intel/platform/brain), DB hardening, RLS, indexes, TypeScript types, route consolidation. Complete.

6. **MCP Server** — 28 tools across 9 domains (knowledge, instructions, intelligence, tasks, contacts, organizations, pipeline, correspondence, system). Built, not yet deployed to a host.

7. **Acumen Classifier System** — 11 email categories with harness rules, department docs, harness loader, classification pipeline. Complete and classifying live email.

8. **Your Motion — Feed Architecture** — ✅ COMPLETE. Single scrollable feed of interactive cards at root route. Card types: Decision, Action, Signal, Briefing, Snapshot, Intelligence, Reflection. Cards show email context (from/to/subject), priority-based title styling (high=black, medium=slate-500, low=slate-400), Do/Hold/No actions, "More about this" expansion. `brain.feed_cards` table with visibility_scope, ingestion_log for audit.

9. **Snapshotting Engine** — ✅ COMPLETE. `/api/brain/snapshot` accepts natural language queries, uses Claude to determine which tables to query, executes against Supabase, formats results into markdown snapshot cards in the feed. Replaces static pages.

10. **Your Clearing** — ✅ COMPLETE. `/clearing` route. Thought capture (absorbed into brain memory via ingestion), brain-assisted Q&A, drag-and-drop file ingestion. Multiple sessions, dissolve when done. Gate for deeper work — not a creation tool.

11. **Engine Room + Motion Map** — ✅ COMPLETE. `/engine` route. Four tabs: Motion Map (renders harness classifier markdown files), Brain Accuracy (per-category stats from CEO actions), Autonomy (category progress toward self-governance), Integrations (connection status).

12. **Classifier Training at Scale** — ✅ COMPLETE (infrastructure). `/api/brain/accuracy` computes per-category accuracy from CEO feed actions (Do=correct, No=incorrect). Daily cron scheduling via Vercel (scanner at 6am EST, briefing at 7am EST). Training velocity depends on CEO daily review cadence.

13. **Daily Synthesis Loop** — ✅ COMPLETE. `/api/agents/daily-briefing` reads all feed cards from last 24 hours, sends to Claude for synthesis, emits a briefing card with: top line, needs attention, decisions made, patterns, heads up. Runs automatically via Vercel cron.

14. **Behavioral Adaptation / Autonomy Engine** — ✅ COMPLETE (infrastructure). `/api/brain/autonomy` evaluates which categories have earned autonomous operation (20+ reviews, 90%+ accuracy). POST auto-acts on qualifying cards and emits reflection cards. Runs after each daily briefing. Autonomy tab in Engine Room shows progress.

15. **Knowledge Ingestion Enhancement** — ✅ COMPLETE. `/api/brain/ingest` now emits feed cards for ingested documents. Clearing uses this for file drop ingestion.

16. **Single Ingestion Point** — Core architectural principle documented. All data enters through one endpoint. Brain classifies, decides, acts, emits cards. No UI writes directly to database.

17. **Visibility Scope** — `visibility_scope` field on every feed card: `personal` (Phase 1), `team` (Phase 2), `regiment` (Phase 3). Publish/subscribe model for teams — no RBAC.

18. **Correction Learning Pipeline** — ✅ COMPLETE. `/api/brain/learn` processes CEO corrections (wrong_category, wrong_priority, should_not_exist) and stores structured corrections in `brain.knowledge_base` as institutional memory. `/api/brain/learn/stats` provides correction analytics. Feed card PATCH auto-fires learning. Brain improves from every No action.

19. **Embedding & RAG Pipeline** — ✅ COMPLETE. `src/lib/embeddings.ts` (OpenAI text-embedding-3-small), auto-embeds on ingestion into `brain.knowledge_chunks`, `/api/brain/ask` now does vector search (cosine similarity) before keyword search with deduplication. `/api/brain/embed-backfill` for backfilling existing knowledge. Requires `OPENAI_API_KEY` env var.

20. **Bulk Email Import** — ✅ COMPLETE. `/engine/import` UI page + `/api/agents/gmail-bulk-import` endpoint. Import N days of historical email in chunked batches. Progress bar, stats, abort support. Uses existing scanner with deduplication.

21. **Thread Consolidation** — ✅ COMPLETE. `src/lib/feed-card-emitter.ts` with `findExistingThreadCard` and `updateThreadCard`. Gmail scanner checks for existing thread card before creating new one. Same Gmail thread → one card that evolves. Priority upgrades if new message is higher. Card resurfaces as unread. Shows "N messages" badge. Requires step-17 SQL migration.

22. **Card Type Inference Fix** — ✅ COMPLETE. Only `critical` priority → decision. High priority → intelligence. Has action items → action. Newsletter/automated/marketing → signal. Everything else → signal. Stoplights only on decision/action cards. Signal/intelligence get Noted/Dismiss.

23. **Action Recommendations** — ✅ COMPLETE. Scanner prompt now generates `action_recommendation` field. Decision and action cards display amber banner with "Recommended action: [specific action]". Makes Do/Hold/No meaningful — you're responding to a recommendation, not just a summary.

24. **Training Mode Framing** — ✅ COMPLETE. Every card shows "Brain classified this as [category] / [priority] / [card_type]. Correct?" with a link to open the Train correction modal. Makes it obvious what you're rating.

25. **Train Button on All Cards** — ✅ COMPLETE. Pencil icon + "Train" button on every card type. Opens inline correction panel with dropdowns for category (11 options), priority (4 levels), card type (7 types), "should not exist" checkbox, and free-text note. Only sends diffs (fields that changed). Shows "Learned ✓" confirmation.

---

## Near-Term Efforts (Operational Phase)

26. **Decision Card UI (Figma Pixel-Perfect)** — ✅ COMPLETE. FeedCard.tsx rewritten to match Figma Decision Card design exactly. 500px fixed width, 12px padding, 12px border radius, drop shadow (60px blur, 6px spread). Card type badges, source pills (gopher + Gmail/Slack icon + external link), entity dotted underlines linking to detail pages, "More About This" expansion, MOTION REASONING section, natural sentence metadata ("This Fundraising conversation includes both Walt Doyle and David Brown"). Resolved states (Do/Hold/No) with opacity and background changes.

27. **Motion Page Header & Scanner Trigger** — ✅ COMPLETE. Avatar + "Mark Slater, CEO." + "Important Conversations" title + "updated X ago" timestamp + blue refresh spinner icon that triggers POST /api/agents/gmail-scanner. Search bar with placeholder icons. Scanner populates feed on demand.

28. **Cherry-Pick Backend from busy-black** — ✅ COMPLETE. SQL migrations step-19 through step-23 (cleanup duplicates, fresh reimport, entity intelligence, derived insights, clearing conversations). New API routes: synthesis agent, brain ask/KCS, clearing sessions/messages. Behavioral rules engine. Enhanced gmail-scanner with paginated fetch (up to 500) and correspondence embedding.

29. **Parallel Entity Intelligence Layer** — ✅ COMPLETE (schema). brain.entity_provenance, brain.enrichment_queue, brain.derived_insights tables created. Intelligence columns added to core.organizations and core.contacts (confidence_score, knowledge_completeness_score, enrichment_priority, enrichment_gaps). SQL migrations run in Supabase.

30. **Training Velocity** — T1-T4 workstream. Run scanner daily, CEO reviews cards, accuracy accumulates, categories earn autonomy. Infrastructure built — needs consistent use. Bulk import available to accelerate.

31. **Sidebar Navigation (Figma Pixel-Perfect)** — ✅ COMPLETE. Sidebar.tsx rewritten to match Figma node 30:419. 163px white card, rounded-12, shadow 200px, nav items at 14px Geist Medium with active pill (#3e4c60 at 60% opacity, rounded-tr/br-18px). Glossary + Technical Docs links with arrow-right icons. MiMbrain icon + "© 2026 Made In Motion PBC" footer.

32. **Clearing Page (Figma Pixel-Perfect)** — ✅ COMPLETE. Clearing page rewritten to match Figma node 41:3869. Chat Header with "A Thinking Space" title + blue subtitle. Two-column layout: Prior Conversations panel (257px, shadow, session list) + chat area (user messages right-aligned in white cards, brain responses left-aligned plain text). Bottom: input bar with blue border (#a9d8ff), "Launch a Gopher" pill (#ecfaff), "Add To Knowledge" pill (#f2e9fa). Drag-and-drop file ingestion.

33. **Feed Card Visibility Fix** — ✅ COMPLETE. Feed was showing only 3 of 24 cards because query filtered to unread/read status only. Updated to include "acted" cards so resolved cards remain visible in feed with per-type resolved backgrounds and 60% opacity.

---

## Medium-Term Efforts

28. **Market Intelligence Scanners** — External data internalization: competitive intelligence, content concepts, M&A/strategic, customer/partner acquisition, consumer insights. Start with one, prove the pipeline.

29. **Conversation Persistence & History** — Brain chat responses persisted to DB so prior conversations are fully reloadable. Thread continuity across sessions.

30. **Commerce Integration** — Connect Printify/Drop data to platform. Real KPI values (revenue, items sold, AOV, conversion). Product creation event capture with design detail logging.

31. **The MiMGina Notepad** — Mobile-first (iPhone) note capture. Minimal formatting, image/file attachment, voice dictation. Submits to MiM Brain with confidentiality rank, harness/category assignment, due date. First consumer of the MiMGina input door.

32. **Teams** — Add a second user acting independently on the same brain. Prerequisite to any scaling. Not multi-tenant — shared brain, separate views. Publish/subscribe visibility model already designed.

33. **Automated Report Generation** — Monthly investor updates, internal company updates, other recurring reports — generated by the brain from accumulated intelligence and delivered automatically.

34. **Long-Form Content & Research Publishing** — Brain-generated research papers, weekly industry newsletters, daily content bites. Customer-facing platform where orgs see relevant content and KPI insights.

---

## Longer-Term Efforts

35. **Harness Operating Model** — Structured MD behavioral contracts defining departments, processes, decision trees, scanner logic. Needs its own discovery/scoping session.

36. **Autonomous Enrichment** — Self-directed scanner activation where the brain identifies entities with low knowledge completeness and triggers enrichment without being asked.

37. **Asset/OCR Performance Intelligence** — Closed-loop system: capture product creation design decisions → correlate with performance data → derive actionable product insights.

38. **Model Abstraction Layer** — Abstract the LLM interface so Claude can be swapped for local models on high-volume structured tasks. Configuration not code changes.

39. **Multi-User / Auth** — Full login system, role-based access, team member permissions.

35. **Calendaring Tools** — TBD, to be unpacked.

36. **Game Event & Scheduling Tools** — TBD, to be unpacked.

37. **Team Chatting Tools** — TBD, to be unpacked.

38. **Person Feed Protocol** — AI-native identity standard (Phase 3). Design constraint only — don't build, don't block.

---

*Last updated: 2026-03-17 (v2)*
