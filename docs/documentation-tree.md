# MiMBrain — Documentation Tree

> **Purpose:** Master index of every active document. Archived docs are in `docs/archive/` — they are historical record only, not reading material.
>
> **Last updated:** 2026-03-17

---

## Project Root

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | **Read first.** Agent/contributor guide — current state, critical rules, session history |
| `docs/context-primer.md` | **Bedrock onboarding prompt** — what is built, what isn't, working rules, task framing |

---

## Product — `docs/product/`

| Document | Purpose |
|----------|---------|
| `ui-requirements.md` | Governing architecture — Motion, Clearing, Engine Room, card types, emotional design |
| `design-brief.md` | Figma-actionable specs — card anatomy, screen layouts, visual language |
| `stack-glossary.md` | Plain-English definitions of every named component and term |

---

## Technical — `docs/technical/`

| Document | Purpose |
|----------|---------|
| `architecture-mimbrain-v2.md` | **Backend north star** — entity-centric design, three memory types, harness, autonomy layer |
| `mim-brain-stripe-integration.md` | Stripe integration spec (planned, not yet built) |

---

## Operational — `docs/operational/`

| Document | Purpose |
|----------|---------|
| `master-effort-list.md` | All efforts/epics with live status — the most current snapshot of what's built |
| `harness-scope-email-categories.md` | 11 email category definitions for the Acumen classifier |
| `training-plan.md` | Classifier training phases T1–T4 and how categories earn autonomy |

---

## Brain Harness — `brain/`

| Location | Purpose |
|----------|---------|
| `brain/departments/` | 11 domain expertise markdown docs — loaded at runtime by harness loader |
| `brain/pipelines/email-classification/` | 11 email classifier rule markdown docs |

---

## Archive — `docs/archive/`

These documents are **historical record only**. Do not use them as reference — they describe a state of the project that no longer exists.

| Document | Why Archived |
|----------|-------------|
| `README.md` | Create-next-app boilerplate + outdated Figma build notes from early UI |
| `ONBOARDING.md` | Says "Feed UI not yet built" — entirely stale |
| `technical/technical-roadmap.md` | All build tasks complete — now historical record |
| `technical/firebase-integration-spec.md` | Empty placeholder, never scoped |
| `operational/progress-report.md` | March 15 snapshot — superseded by CLAUDE.md current state |
| `operational/project-plan.md` | Phase 1 build tasks all complete — superseded by master-effort-list.md |
| `print/` | HTML print versions of old documentation |

---

## Summary

| Category | Active Documents |
|----------|-----------------|
| Root | 2 |
| Product | 3 |
| Technical | 2 |
| Operational | 3 |
| Brain harness | 22 (11 dept + 11 pipeline) |
| **Active total** | **32** |
| Archived | 8 |
