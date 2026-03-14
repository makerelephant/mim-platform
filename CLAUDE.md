# CLAUDE.md — Read This First

## What is this project?

MiMBrain is an autonomous business intelligence platform for Made in Motion, a youth sports technology company. It processes business data (emails, messages, documents), classifies it, prioritizes it, and recommends actions — with the goal of becoming an autonomous Chief Operating Officer.

## Guardrails — Non-Negotiable Beliefs

These five beliefs govern every product, hiring, and architecture decision. They are not aspirational — they are operational constraints.

1. **AI will be 1000x smarter than humans within 12 months.** Build for that world, not this one.
2. **Probabilistic products like ours will be reimagined on AI stacks in their entirety.** Nothing we build should be inherited from the era of deterministic software.
3. **Every hire must be 1 of 10 people total to get us to a billion-dollar company.** No filler. No "nice to have" roles.
4. **Everyone must be in motion.** Us. Our customers. Our users. Everyone.
5. **Don't design for a deterministic architecture that will no longer exist.** If it assumes static schemas, fixed workflows, or human-in-the-loop by default — rethink it.

## Company Cadence: 1 → 10 → 1,000

The entire company moves in three phases. Every feature, every hire, every sprint maps to one of these:

1. **The 1** — Build Your Motion for the CEO. One person, fully orchestrated. This is what we're doing now.
2. **The 10** — The team of 10 share parts of their motion that underpin the internal operations and execution of the company. This is teams.
3. **The 1,000** — The regiment of efforts that go out into the market. The product at scale.

We do not skip phases. We do not build for the 1,000 before the 1 is in motion.

## Critical Context: UI Paradigm Shift (March 2026)

The platform is undergoing a radical UI redesign. **All 34 static CRM-style pages are being replaced** with a feed-first architecture. The root route (`/`) becomes the Motion feed. Existing pages are kept as dormant routes (not deleted) — we may cannibalize components later. Do not build new static pages.

### Three Surfaces

1. **Your Motion** — A scrollable feed of interactive cards. The CEO's entire operational life streams through here. Everything is ephemeral (Burning Man principle). No permanent pages.
2. **Your Clearing** — A thinking/prep space. Freeform notes, file ingestion, brain-assisted reflection. NOT a creation tool — the platform is a gate, not a workshop.
3. **Engine Room** — Configuration layer. Motion Map (the brain's operating logic made visible), integrations, data connections.

### Key Principles

- **No Pages** — Data views are "snapshots" generated on demand into the feed, not static routes
- **Burning Man** — Celebrate impermanence. Nothing persists as a permanent page.
- **Gate, Not Workshop** — We don't compete with Google Slides, Excel, etc. We're the gate everything passes through.
- **No notification badges** — The feed IS the notification system

## Doc Reading Order

1. `docs/product/ui-requirements.md` — Governing architecture document (Motion, Clearing, Engine Room, card types, emotional design)
2. `docs/product/design-brief.md` — Figma-actionable specs (card anatomy, screen layouts, visual language)
3. `docs/technical/architecture-mimbrain-v2.md` — Backend architecture (entity-centric, three memory types, harness, autonomy layer) — still fully valid
4. `docs/operational/master-effort-list.md` — All planned efforts/epics with status
5. `docs/product/stack-glossary.md` — Vocabulary definitions

## Tech Stack

- **Frontend:** Next.js 16 + Turbopack, Tailwind CSS, Geist font
- **Backend:** Supabase (Postgres, multi-schema: core/crm/intel/platform/brain)
- **Deployment:** Vercel (`npx vercel --prod --yes`)
- **AI:** Claude API for classification, synthesis, chat
- **MCP Server:** 28 tools across 9 domains (built, not yet deployed to host)

## How to Run

```bash
npm install
npm run dev   # http://localhost:3000
```

Requires `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Terminology

| Term | Meaning |
|------|---------|
| Your Motion | The feed — CEO's operational life stream |
| Your Clearing | Thinking/prep space — NOT a creation tool |
| Engine Room | Configuration layer (was "Settings") |
| Motion Map | CEO's readable view of the brain's operating logic |
| Harness | Technical implementation underneath the Motion Map (markdown classifier files) |
| Acumen | Decision engine (classifiers + harness + decision log) |
| Snapshotting | Brain compiles visual data on demand into the feed |
| Card | Interactive unit in the feed (Decision, Action, Signal, Briefing, Snapshot, Intelligence, Reflection) |

## Current State

- **Backend:** CRM data layer complete, Gmail scanner classifying with Acumen categories, decision logging operational, brain chat working
- **Frontend:** Old CRM UI exists but is being replaced. Decision review page built. Feed architecture not yet built.
- **Training:** Acumen classifier running, CEO review via `/decisions` page captures corrections

## Do Not

- Build new static CRM pages or add sidebar navigation items (old pages are dormant, not deleted)
- Build creation tools inside Your Clearing (it's a gate, not a workshop)
- Add notification badges or counts
- Use `<Image>` for SVGs — use `<img>` tags
- Change the backend architecture (architecture-mimbrain-v2.md is the north star)
