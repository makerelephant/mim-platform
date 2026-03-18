# MiMBrain Business Execution Platform — Onboarding Guide

> **Audience:** New agents, engineers, or contributors picking up this project for the first time.
>
> **Goal:** Understand what MiMBrain is, what's changed, and where to find everything — in under 10 minutes.

---

## What is MiMBrain?

MiMBrain is an autonomous business intelligence platform built for Made in Motion, a a company engaged in building innovation for the generative commerce era.  

The in Motion Platform processes business data (emails, messages, documents), classifies it, prioritizes it, and recommends actions — with the goal of becoming an autonomous Chief Operating Officer to the individual, an execution vehicle for its founding team (phase 2) - and finally a semi-autonomous commercial acquisition, engagement and retention platform for its customers (Stage 3)

---

## Start Here: context-Primer.md

Read `context-primer.md' at the project root first. It has the critical instructional framework for new agent onboarding.lets go wit your 

## Then Read These (In This Order)

1. **`docs/product/ui-requirements.md`** — Governing architecture document. Defines the three surfaces (Your Motion, Your Clearing, Engine Room), card types, emotional design principles, snapshotting.
2. **`docs/product/design-brief.md`** — Figma-actionable specs. Card anatomy, screen layouts, visual language, interaction inventory.
3. **`docs/technical/architecture-mimbrain-v2.md`** — Backend architecture. Entity-centric design, three memory types, harness operating model, autonomy layer. Still the north star.
4. **`docs/operational/master-effort-list.md`** — All planned efforts/epics with status.
5. **`docs/product/stack-glossary.md`** — Plain-English definitions of every named component.

---

## The Paradigm Shift (March 2026)

The platform is moving from a traditional CRM with 34 static pages to a **feed-first architecture**:

- **Your Motion** — A scrollable feed of interactive cards. The CEO's entire operational life streams here. No permanent pages — data views are "snapshots" generated on demand.
- **Your Clearing** — A thinking/prep space. Freeform notes, file ingestion, brain-assisted reflection. NOT a creation tool.
- **Engine Room** — Configuration layer. Motion Map (the brain's operating logic made visible), integrations, data connections.

The backend architecture (architecture-mimbrain-v2.md) is unchanged. Only the UI presentation layer changed.

---

## Folder Structure

```
CLAUDE.md               — Read this first (agent/contributor guide)
src/                    — Application source code (Next.js)
brain/
  departments/          — Domain expertise docs (11 business departments)
  pipelines/
    email-classification/  — Classifier rules per category
docs/
  product/              — UI requirements, design brief, glossary
  technical/            — Architecture, integrations
  operational/          — Harness scope, effort tracking
  strategic/            — (placeholder — CEO/investor docs)
public/                 — Static assets (icons, images)
supabase/               — Database migrations and functions
sql/                    — SQL scripts (acumen decision log)
```

---

## The Decision Engine: Acumen

Acumen is how MiMBrain thinks. It has three parts:

1. **Classifiers** (`brain/pipelines/email-classification/`) — Sort incoming data into 11 business categories
2. **Harness** (`brain/departments/`) — Rules, importance weights, and domain knowledge per category
3. **Decision Log** — Records every classification decision for CEO review and accuracy scoring. Built and operational via `/decisions` page.

---

## Current State

- **Backend:** CRM data layer complete, Gmail scanner classifying with Acumen categories, decision logging operational, brain chat working
- **Frontend:** Old CRM UI exists (34 pages) but is being replaced by feed architecture. Decision review page built.
- **Training:** Acumen classifier running on live emails. CEO reviews classifications via `/decisions`. Accuracy not yet measured at scale.

---

## Key Decisions Already Made

- **Feed-first architecture** — No static CRM pages. Everything flows through Your Motion as interactive cards.
- **Burning Man principle** — Celebrate impermanence. No permanent pages.
- **Gate, not workshop** — The platform doesn't compete with creation tools (Google Slides, Excel, etc.)
- **Acumen** is the name for the decision engine (classifiers + harness + decision log)
- **11 email categories** defined: Legal, Customer/Partner Ops, Accounting & Finance, Scheduling, Fundraising, Product/Engineering, UX & Design, Marketing, AI, Family, Administration
- **Harness docs are markdown** — loaded at runtime, not hardcoded into prompts
- **Decision logging before automation** — the brain must prove accuracy before earning autonomy
- **SVG icons use `<img>` tags** — not Next.js `<Image>` component (SVG compatibility issue)
- **Geist font** applied globally via `font-sans` in Tailwind

---

## What's Not Built Yet

Check `docs/operational/master-effort-list.md` for the full list. Critical gaps:

- **Feed UI (Your Motion)** — The new feed architecture is designed but not yet built
- **Your Clearing** — Thinking space not yet built
- **Engine Room / Motion Map** — Configuration layer not yet built
- **Snapshotting** — On-demand data views not yet built
- **Behavioral adaptation** — Brain learning from corrections
- **Autonomous action execution** — Playbooks
- **Multi-user auth / Teams**

---

*Last updated: 2026-03-14*
