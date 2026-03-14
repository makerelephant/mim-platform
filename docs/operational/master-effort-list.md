# MiM Platform — Master Effort List

> Living document. Captures all major efforts/epics at summary level. Add new items as they emerge — unpack in separate sessions.
>
> **UI paradigm shift (March 2026):** All static CRM pages are being replaced by a feed-first architecture (Your Motion + Your Clearing + Engine Room). Efforts below reflect this. See `docs/product/ui-requirements.md` for the governing architecture document.

---

## Currently Built / In Progress

1. **Core Data Layer** — Contacts, organizations, pipeline, tasks, support issues, activity log. CRUD complete, entity linking, multi-schema DB architecture. Operational. *(The old static CRM UI exists but is being deprecated — data layer remains.)*

2. **Communication Intelligence Pipeline** — Gmail scanner classifies inbound messages using Acumen categories, resolves entities, creates tasks, logs correspondence. Classifier now uses 11 business categories with importance levels and reasoning. Operational.

3. **Brain Chat Interface** — Chat-first interface with ask_brain API endpoint (entity resolution → dossiers → knowledge search → Claude synthesis). Working. *(Will become a core interaction mode within Your Motion and Your Clearing.)*

4. **Decision Logging & CEO Review** — Acumen classifier writes category, importance, and reasoning to `brain.classification_log`. CEO reviews via `/decisions` page (correct/incorrect/partial). Operational but low volume.

5. **Data Ontology Migration** — Multi-schema architecture (core/crm/intel/platform/brain), DB hardening, RLS, indexes, TypeScript types, route consolidation. Complete.

6. **MCP Server** — 28 tools across 9 domains (knowledge, instructions, intelligence, tasks, contacts, organizations, pipeline, correspondence, system). Built, not yet deployed to a host.

7. **Acumen Classifier System** — 11 email categories with harness rules, department docs, harness loader, classification pipeline. Complete and classifying live email.

---

## Near-Term Efforts

8. **Your Motion — Feed Architecture** — Replace all static CRM pages with a single scrollable feed of interactive cards. Card types: Decision, Action/Spawn, Signal, Briefing, Snapshot, Intelligence, Reflection. This is the primary frontend build. See `docs/product/ui-requirements.md` and `docs/product/design-brief.md`.

9. **Snapshotting Engine** — On-demand data views compiled by the brain into the feed. Replaces static pages for orgs, contacts, pipeline, KPIs. The brain generates visual data cards in response to user prompts.

10. **Your Clearing** — Thinking/prep space. Freeform notes, file ingestion, brain-assisted reflection. The gate for deeper work — not a creation tool.

11. **Engine Room + Motion Map** — Configuration layer with the Motion Map at center (CEO's readable view of the harness). Integrations, data connections, permissions.

12. **Classifier Training at Scale** — Run scanner on higher email volume, accumulate CEO review data, compute per-category accuracy scores. Prove classifier before expanding autonomy. See `docs/operational/training-plan.md`.

13. **Daily Synthesis Loop** — Automated agent that reads recent activity, cross-references signals, writes derived insights, produces CEO briefing cards in the feed. The compounding mechanism.

14. **Parallel Entity Intelligence Layer** — New brain-schema tables for entity provenance, derived insights, enrichment queue. The knowledge layer that makes entities smarter over time.

---

## Medium-Term Efforts

15. **Market Intelligence Scanners** — External data internalization: competitive intelligence, content concepts, M&A/strategic, customer/partner acquisition, consumer insights. Start with one, prove the pipeline.

16. **Conversation Persistence & History** — Brain chat responses persisted to DB so prior conversations are fully reloadable. Thread continuity across sessions.

17. **Knowledge Ingestion Pipeline** — Accept any asset type (docs, CSVs, PDFs, images), extract content, classify, embed, map to entities. The "training data" ingest path. Key input channel for Your Clearing.

18. **Commerce Integration** — Connect Printify/Drop data to platform. Real KPI values (revenue, items sold, AOV, conversion). Product creation event capture with design detail logging.

19. **Behavioral Adaptation Engine** — System learns from CEO corrections and pattern data. Writes/updates its own behavioral rules. Confidence thresholds gate which rules auto-execute vs require approval.

20. **The MiMGina Notepad** — Mobile-first (iPhone) note capture. Minimal formatting, image/file attachment, voice dictation. Submits to MiM Brain with confidentiality rank, harness/category assignment, due date. First consumer of the MiMGina input door.

21. **Teams** — Add a second user acting independently on the same brain. Prerequisite to any scaling. Not multi-tenant — shared brain, separate views.

22. **Automated Report Generation** — Monthly investor updates, internal company updates, other recurring reports — generated by the brain from accumulated intelligence and delivered automatically.

23. **Long-Form Content & Research Publishing** — Brain-generated research papers, weekly industry newsletters, daily content bites. Customer-facing platform where orgs see relevant content and KPI insights.

---

## Longer-Term Efforts

24. **Harness Operating Model** — Structured MD behavioral contracts defining departments, processes, decision trees, scanner logic. Needs its own discovery/scoping session.

25. **Autonomous Enrichment** — Self-directed scanner activation where the brain identifies entities with low knowledge completeness and triggers enrichment without being asked.

26. **Asset/OCR Performance Intelligence** — Closed-loop system: capture product creation design decisions → correlate with performance data → derive actionable product insights.

27. **Model Abstraction Layer** — Abstract the LLM interface so Claude can be swapped for local models on high-volume structured tasks. Configuration not code changes.

28. **Multi-User / Auth** — Full login system, role-based access, team member permissions.

29. **Calendaring Tools** — TBD, to be unpacked.

30. **Game Event & Scheduling Tools** — TBD, to be unpacked.

31. **Team Chatting Tools** — TBD, to be unpacked.

---

*Last updated: 2026-03-14*
