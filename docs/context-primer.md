# MiMBrain — Context Primer Prompt
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document.
> **Last updated:** 2026-03-18

---

You are being onboarded to the current state of MiMBrain — an autonomous business intelligence platform for Made in Motion, a youth sports technology company. Read this entire document before doing anything.

---

## === WHAT IS BUILT ===

**Three surfaces — all live in production at `mim-platform.vercel.app`:**

- **Your Motion** (`/`) — Scrollable feed of interactive cards. The CEO's operational inbox. Filter pills: All, Decisions, Actions, Signals, Intel, Briefings, Old. "Old" shows previously acted cards (`status=acted`). All other filters show active cards (`status=unread,read`). Actioned cards (Do/Hold/No) disappear immediately from the active feed.
- **Your Clearing** (`/clearing`) — Persistent brain-assisted thinking space. Sessions and messages stored in DB. File ingestion, brain Q&A, Launch a Gopher agents. NOT a creation tool.
- **Engine Room** (`/engine`) — Motion Map (harness classifier markdown), Brain Accuracy, Autonomy progress, Integrations status, Platform Health.

**Backend infrastructure — all built and operational:**

- Gmail scanner classifying live email into 11 Acumen categories, emitting feed cards with full email context (from/to/subject), thread consolidation
- Decision logging, correction learning pipeline (`/api/brain/learn`)
- Daily briefing cron (7am EST), Gmail scanner cron (6am EST)
- Autonomy engine — categories earn self-governance at 20+ reviews / 90%+ accuracy
- Snapshotting engine — natural language → data query → card in feed
- Bulk email import at `/engine/import`
- Embedding/RAG pipeline — code and tables exist (`brain.knowledge_chunks`) but NOT active

---

## === WHAT IS NOT WORKING YET ===

- **No semantic memory** — The RAG pipeline requires an `OPENAI_API_KEY` in Vercel env vars. Without it, brain uses keyword search only. Semantic retrieval ("What do we know about Adidas?") misses anything without the literal word. This is a pending CEO decision.
- **No training volume** — Autonomy requires 20+ reviewed cards per category at 90%+ accuracy. Currently near zero reviews. Infrastructure built, needs consistent daily use to accumulate signal.
- **No derived intelligence** — Entity profiles are name + email only. No enrichment, no pattern recognition from accumulated interactions.
- **Only one data source** — Gmail only. Slack, Calendar, Stripe, documents architecturally supported but not connected.

---

## === WHAT THIS MEANS ===

The system can operate. It ingests, classifies, surfaces, and learns from corrections. But it cannot yet think reliably or autonomously. It has no semantic memory and no training history. The brain is structurally complete but experientially empty.

**The two things that unlock progress:**
1. A decision on embeddings (OpenAI key, Voyage AI, or consciously skip)
2. Consistent daily CEO review of feed cards to accumulate accuracy data

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
2. **Understand what actually exists** — read `CLAUDE.md` and `docs/operational/master-effort-list.md` for the honest current state.
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
| AI — embeddings | OpenAI text-embedding-3-small (code built, key not yet in Vercel) |
| MCP Server | 28 tools across 9 domains — built, not yet deployed to host |

---

## === KEY FILE LOCATIONS ===

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Your Motion feed page — filter pills, scan trigger, card rendering |
| `src/components/FeedCard.tsx` | All card types, badge styles, Do/Hold/No/Noted/Dismiss actions, Train modal |
| `src/app/clearing/page.tsx` | Your Clearing — sessions, messages, gopher launcher, file ingestion |
| `src/app/engine/page.tsx` | Engine Room — Motion Map, accuracy, autonomy, integrations, health |
| `src/lib/gmail-scanner.ts` | Gmail scanner — Acumen classification, entity resolution, feed card emission |
| `src/lib/feed-card-emitter.ts` | Shared card emission + thread consolidation |
| `src/lib/embeddings.ts` | OpenAI embedding client — built but inactive |
| `src/app/api/feed/route.ts` | Feed GET (paginated, filtered) + PATCH (CEO actions, auto-fires learning) |
| `src/app/api/brain/` | ask, snapshot, learn, accuracy, autonomy, harness, ingest endpoints |
| `brain/departments/` | 11 domain expertise markdown docs (harness) |
| `brain/pipelines/email-classification/` | 11 email classifier rule markdown docs |
| `docs/technical/architecture-mimbrain-v2.md` | Backend architecture north star |

---

*This document is the bedrock. When in doubt, re-read it before acting.*
