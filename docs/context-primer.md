# In Motion — Context Primer Prompt
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document.
> **Last updated:** 2026-03-22

---

You are being onboarded to the current state of In Motion — an autonomous business intelligence platform for Made in Motion, a youth sports technology company. Read this entire document before doing anything.

---

## === WHAT IS BUILT ===

**Three surfaces — all live in production at `mim-platform.vercel.app`:**

- **Your Motion** (`/`) — Scrollable feed of interactive cards. The CEO's operational inbox. Two card types: MessageCard (email/Slack sources — clean natural language with gopher icons, intent icons, entity highlighting, Figma-accurate thread status chips) and FeedCard (briefings/snapshots/reflections). Filter pills: All, Decisions, Actions, Signals, Intel, Briefings, Old. Action bar with Write/Plan/Add buttons. Note-taking panel accessible via Write button.
- **Your Canvas** (`/clearing`) — Persistent brain-assisted thinking space. Sessions and messages stored in DB. File ingestion, brain Q&A, Launch a Gopher agents. NOT a creation tool.
- **Engine Room** (`/engine`) — Motion Map (harness classifier markdown), Brain Accuracy, Autonomy progress, Integrations status, Platform Health, Gophers tab.

**Backend infrastructure — all built and operational:**

- Gmail Gopher classifying live email into 11 Acumen categories, full-body comprehension (8K chars), thread consolidation, auto-resolve on CEO reply
- Gmail Actions API — Reply, Draft (brain-generated), Archive, Star — with thread status detection reflected as Figma-accurate chips (Replied/Forwarded/Archived/Draft/Starred)
- Slack Gopher — same Acumen classifier, noise filter, action extraction
- Decision logging, correction learning pipeline (`/api/brain/learn`)
- Daily briefing cron (7am EST), Gmail Gopher cron (6am EST)
- Autonomy engine — categories earn self-governance at 20+ reviews / 90%+ accuracy
- Snapshotting engine — natural language → data query → card in feed
- Bulk email import at `/engine/import`
- Embedding/RAG pipeline — `brain.knowledge_chunks` with pgvector, OpenAI text-embedding-3-small, semantic search ACTIVE
- Bulletproof recall — 7-day guaranteed window, lowered vector thresholds, expanded result nets, keyword fallbacks
- Entity resolution — fuzzy Levenshtein matching, alias resolution, first/last name partials, rich dossiers
- Note-taking — `/api/notes` with knowledge embedding, feed card emission, draft support. Save = feed + knowledge simultaneously. Feed note cards tappable to reopen in edit mode.
- Thread status polling — MessageCard polls Gmail every 60s, status chips update live when CEO acts in Gmail
- Web Intelligence Gopher — configurable source monitoring, daily cron

---

## === WHAT IS NOT WORKING YET ===

- **Training redesign needed (Effort #77)** — Current training UX confuses three concepts: (1) classifier correction on FeedCard via "Correct?" dropdown panel, (2) knowledge ingestion via notes "Add to Knowledge", (3) MessageCard has NO training at all — trash just dismisses without logging. Planned fix: implicit learning from every interaction — dismissals log as negative signal, tap-throughs log as positive signal, simple ✓/✗ replaces category dropdowns. Every interaction trains.
- **MCP Server not deployed** — 28 tools built, not yet on a host for external access.
- **Intent suggestion UI not yet shipped (Effort #78)** — Cards still show Do/Hold/No alongside the new natural language layout. Read/Respond/Write/Schedule intent buttons are next after training redesign.

---

## === WHAT THIS MEANS ===

The system operates end-to-end. It ingests, classifies, surfaces, learns, recalls, and can execute Gmail actions. Semantic memory is active. Entity resolution is fuzzy-matching. The brain is structurally complete and experientially growing.

**What unlocks the next phase:**
1. **Training redesign (#77)** — Make every interaction (dismiss, tap-through, checkmark) a training signal so data accumulates passively
2. **Intent suggestion pivot (#78)** — Replace Do/Hold/No with Read/Respond/Write/Schedule
3. Consistent daily CEO use of the feed to accumulate training data for autonomy

Do not assume intelligence exists where it has not been proven.

---

## === ARCHITECTURE RULES (NEVER VIOLATE) ===

- **Feed is truth.** No static pages. Data views are snapshots generated on demand.
- **Single ingestion point.** All data enters via the ingestion API. No UI writes directly to the database.
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
2. **Understand what actually exists** — read `CLAUDE.md` and `docs/master-effort-list.md` for the honest current state.
3. **Identify what must happen next** for the brain to become reliable — prioritise embeddings decision, training cadence, then additional data sources.
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
| `src/components/MessageCard.tsx` | Natural language cards for email/Slack — gopher icons, intent icons, entity highlighting, thread status chips |
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
