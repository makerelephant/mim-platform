# In Motion — Context Primer Prompt
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document. Use with caution: product claims below are constrained by live-system recovery findings.
> **Last updated:** 2026-03-28

---

You are being onboarded to the current state of In Motion — an autonomous business intelligence platform for Made in Motion, a youth sports technology company. Read this entire document before doing anything.

---

## === WHAT EXISTS IN CODE ===

**Three surfaces — all live in production at `mim-platform.vercel.app`:**

- **Your Motion** (`/`) — Scrollable feed of interactive cards. The CEO's operational inbox. Two card types: MessageCard (email/Slack sources — natural-language card layout with gopher/source header, thread-state chips, participant line, recommendation band, and contextual action area now in active implementation) and FeedCard (briefings/snapshots/reflections). Filter pills: All, Decisions, Actions, Signals, Intel, Briefings, Old. Action bar with Write/Plan/Add buttons. Note-taking panel accessible via Write button.
- **Your Canvas** (`/clearing`) — Persistent brain-assisted thinking space. Sessions and messages stored in DB. File ingestion, brain Q&A, Launch a Gopher agents. NOT a creation tool.
- **Engine Room** (`/engine`) — Motion Map (harness classifier markdown), Brain Accuracy, Autonomy progress, Integrations status, Platform Health, Gophers tab.

**Backend infrastructure present in the codebase:**

- Gmail Gopher, Gmail Actions API, Slack Gopher, bulk import, snapshotting, note-taking, and multiple reporting/measurement routes all exist in the repo.
- Embedding and retrieval infrastructure exists (`knowledge_base`, `brain.knowledge_chunks`, pgvector, OpenAI embeddings).
- Thread consolidation and Gmail status polling exist in code.
- Decision logging, correction routes, autonomy logic, and reporting logic exist in code.
- Recent email recovery work materially improved Gmail coverage, classifier robustness, thread refresh behavior, and priority handling on known-important threads.

Do not read the list above as proof that these systems are reliable in production. It means they exist, not that they are trustworthy.

---

## === WHAT IS TRUE ON THE GROUND ===

- The core phase-1 product goal is a trustworthy CEO operational inbox. The current feed does not yet meet that bar.
- The feed currently suffers from both false positives and likely false negatives:
  - low-value cards are surfacing
  - some important correspondence is plausibly not surfacing or not surfacing usefully
- Measurement is not decision-grade yet. During live audit, expected measurement tables such as `brain.events` and `brain.classification_log` were not available in the live schema cache, so parts of the reported training/accuracy story cannot be treated as proven.
- Schema/code drift has been real. Parts of the repo previously referenced table shapes and source types that did not match the live database.
- The architecture is ambitious, but phase-1 trustworthiness is not yet proven. Treat the platform as a recovery effort, not as a stable intelligence asset.
- Email is the clearest area of progress so far: several previously broken important threads now surface correctly or much more credibly. That is progress, not final proof of feed trust.

---

## === WHAT IS NOT WORKING YET ===

- **Feed trust is not established** — The main failure is still not missing features. It is that the feed is not yet reliably useful as an executive inbox. Signal-to-noise, broader missed-item coverage, summary quality, and priority calibration are not fully under control.
- **Training is overstated relative to reality** — The system stores corrections and some interaction data, but the claim that “every interaction trains the brain” is not yet true in an operationally trustworthy sense.
- **Measurement layer is incomplete or unreliable** — Several of the product’s claimed quality loops are not yet backed by dependable live instrumentation.
- **Schema and runtime drift have existed** — Future agents should assume schema claims must be verified against the live database before relying on them.
- **MCP Server not deployed** — 28 tools built, not yet on a host for external access.
- **Email card UI is mid-implementation, not finished** — the email card now has visible thread-state chips and a more intentional structure, but contextual action behavior, thread expansion, and trust at a glance are not yet finished.

---

## === WHAT THIS MEANS ===

The system is not best understood as “working but unfinished.” It is better understood as “architecturally broad, operationally under-proven.”

It can ingest, classify, store, retrieve, and execute some actions. But the key question for phase 1 is not whether these subsystems exist. It is whether the feed reduces cognitive load and surfaces the right things at the right time. That remains unproven and is currently the main recovery problem.

**What unlocks the next phase:**
1. **Recovery of feed trust** — establish a working evaluation loop for surfacing quality, false negatives, summary quality, and priority calibration
2. **Measurement that can be trusted** — ensure the live system actually captures the data the product claims to use
3. **Then:** finish email card trust and state-aware behavior
4. **Only then:** training redesign and broader intent-suggestion evolution

Do not assume intelligence exists where it has not been proven.

---

## === ARCHITECTURE RULES (NEVER VIOLATE) ===

- **Feed is truth.** No static pages. Data views are snapshots generated on demand.
- **Single ingestion point is a target architecture rule, not a guaranteed current reality.** Verify actual write paths before assuming conformance.
- **Gate, not workshop.** The platform doesn't compete with Google Slides, Excel, or any creation tool.
- **No notification badges.** The feed IS the notification system.
- **`architecture-mimbrain-v2.md` is the north star.** Do not change the backend architecture without explicit instruction.

---

## === WORKING RULES (NON-NEGOTIABLE) ===

- **Work ONLY from `/Users/markslater/Desktop/mim-platform` on the `main` branch.**
- **Never create git worktrees.** This has caused repeated confusion and wrong deployments.
- **Deploy ONLY with:** `cd /Users/markslater/Desktop/mim-platform && npx vercel --prod --yes`
- **Production URL is:** `mim-platform.vercel.app`
- **Never use `<Image>` for SVGs** — always use `<img>` tags
- **Never add sidebar nav items** — the three surfaces are fixed

---

## === YOUR TASK ===

Before touching code:

1. **Confirm where you are:** Run `cd /Users/markslater/Desktop/mim-platform && git branch` — you must be on `main`. If not, stop and get there.
2. **Understand what actually exists** — read `CLAUDE.md`, `docs/operational/agent-recovery-rules.md`, and `docs/master-effort-list.md` for the honest current state.
3. **Identify what must happen next** for the feed to become trustworthy — prioritise evaluation, instrumentation, and attention-quality recovery over new features.
4. **List what work is unnecessary at this stage** — do not build Phase 2/3 features (teams, multi-user auth, mobile app, external-facing product) until Phase 1 is proven.

---

## === TECH STACK REFERENCE ===

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + Turbopack, Tailwind CSS, Geist font |
| Backend | Supabase (Postgres, schemas: core / crm / intel / platform / brain) |
| Deployment | Vercel — `npx vercel --prod --yes` from project root |
| AI — reasoning | Claude API (classification, synthesis, chat) |
| AI — embeddings | OpenAI text-embedding-3-small (active, `OPENAI_API_KEY` set in Vercel) |
| MCP Server | 28 tools across 9 domains — built, not yet deployed to host |

---

## === KEY FILE LOCATIONS ===

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Your Motion feed page — filter pills, action bar, card routing (MessageCard vs FeedCard), note panel |
| `src/components/MessageCard.tsx` | Email/Slack message cards — active recovery surface for thread-state chips, participant line, recommendation band, contextual actions |
| `src/components/FeedCard.tsx` | Briefing/snapshot/reflection cards — badge styles, Do/Hold/No actions, Train modal |
| `src/app/clearing/page.tsx` | Your Canvas — sessions, messages, gopher launcher, file ingestion |
| `src/app/engine/page.tsx` | Engine Room — Motion Map, accuracy, autonomy, integrations, health |
| `src/lib/gmail-scanner.ts` | Gmail Gopher — Acumen classification, entity resolution, feed card emission |
| `src/lib/feed-card-emitter.ts` | Shared card emission + thread consolidation |
| `src/components/NotePanel.tsx` | Note-taking panel — title, editor, save to knowledge/draft, existing notes list |
| `src/lib/gmail-client.ts` | Shared Gmail auth utilities — OAuth2, thread status, email builder |
| `src/lib/gmail-scanner.ts` | Gmail Gopher — auto-resolve on CEO reply |
| `src/lib/embeddings.ts` | OpenAI embedding client — ACTIVE |
| `src/app/api/feed/route.ts` | Feed GET (paginated, filtered) + PATCH (CEO actions, auto-fires learning) |
| `src/app/api/gmail/actions/route.ts` | Gmail actions — Reply, Draft, Archive, Star + thread status polling |
| `src/app/api/notes/route.ts` | Notes CRUD — create, list, delete, embed to knowledge |
| `src/app/api/brain/` | ask, snapshot, learn, accuracy, autonomy, harness, ingest endpoints |
| `brain/departments/` | 11 domain expertise markdown docs (harness) |
| `brain/pipelines/email-classification/` | 11 email classifier rule markdown docs |
| `docs/technical/architecture-mimbrain-v2.md` | Backend architecture north star |

---

*This document is the bedrock. When in doubt, re-read it before acting.*
