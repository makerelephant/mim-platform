# MiMBrain Business Execution Platform — Onboarding Guide

> **Audience:** New agents, engineers, or contributors picking up this project for the first time.
>
> **Goal:** Understand what MiMBrain is, how the codebase is organized, and where to find everything you need — in under 10 minutes.

---

## What is MiMBrain?

MiMBrain is an autonomous business intelligence platform built for Made in Motion, a youth sports technology company. It processes business data (emails, messages, documents), classifies it, prioritizes it, and recommends actions — with the goal of becoming an autonomous Chief Operating Officer.

---

## Read These First (In This Order)

1. **`docs/product/stack-glossary.md`** — Plain-English definitions of every named component. Start here to learn the vocabulary.
2. **`docs/technical/architecture-mimbrain-v2.md`** — Full system architecture. How all the pieces connect.
3. **`docs/operational/master-effort-list.md`** — Every planned effort/epic with current status. Shows what's built, what's next, and what's future.
4. **`docs/documentation-tree.md`** — Master index of all documentation with status and locations.

---

## Folder Structure

```
src/                    — Application source code (Next.js)
brain/
  departments/          — Domain expertise docs (11 business departments)
  pipelines/
    email-classification/  — Classifier rules per category
docs/
  strategic/            — CEO, investor, board-facing docs
  product/              — Product management and design docs
  technical/            — Architecture, schema, API, infrastructure
  operational/          — Acumen rules, harness, effort tracking
  process/              — Session notes, decisions, onboarding
public/                 — Static assets (icons, images)
supabase/               — Database migrations and functions
```

---

## The Decision Engine: Acumen

Acumen is how MiMBrain thinks. It has three parts:

1. **Classifiers** (`brain/pipelines/email-classification/`) — Sort incoming data into 11 business categories
2. **Harness** (`brain/departments/`) — Rules, importance weights, and domain knowledge per category
3. **Decision Log** — Records every decision for accuracy scoring (not yet built)

---

## How to Contribute

### Adding a new document
1. Add an entry to `docs/documentation-tree.md` first
2. Place the file in the correct folder (`strategic/`, `product/`, `technical/`, `operational/`, or `process/`)
3. Commit with a clear message describing what was added

### Writing session notes
- File name format: `docs/process/session-notes-YYYY-MM-DD-topic.md`
- Keep them concise — what changed, what was decided, what's next
- Session notes are changelogs, not transcripts

### Modifying Acumen rules
- Classifier rules live in `brain/pipelines/email-classification/`
- Department docs live in `brain/departments/`
- One file per category in each folder
- Changes to rules should be reviewed before deployment

### Working on the codebase
- Next.js 16 with Turbopack
- Supabase backend (Postgres, multi-schema)
- Deployed on Vercel (`npx vercel --prod --yes`)
- MCP server provides 28 tools across 9 domains

---

## Key Decisions Already Made

- **Acumen** is the name for the decision engine (classifiers + harness + decision log)
- **11 email categories** defined: Legal, Customer/Partner Ops, Accounting & Finance, Scheduling, Fundraising, Product/Engineering, UX & Design, Marketing, AI, Family, Administration
- **Harness docs are markdown** — loaded at runtime, not hardcoded into prompts
- **Decision logging before automation** — the brain must prove accuracy before earning autonomy
- **SVG icons use `<img>` tags** — not Next.js `<Image>` component (SVG compatibility issue)
- **Geist font** applied globally via `font-sans` in Tailwind

---

## What's Not Built Yet

Check `docs/operational/master-effort-list.md` for the full list, but the critical gaps are:

- Decision logging and confidence scoring
- Behavioral adaptation (brain learning from corrections)
- Autonomous action execution (playbooks)
- Multi-user auth
- Knowledge base with semantic search (RAG foundation exists but not wired)

---

*Last updated: 2026-03-13*
