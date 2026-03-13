# MiMBrain Business Execution Platform — Documentation Tree

> **Purpose:** Master index of every document needed to fully describe, build, and operate the MiMBrain platform. Organized by audience so the right people read the right docs.
>
> **Rule:** Every doc gets a status. If it's not here, it doesn't exist yet. Add it before you write it.
>
> **Last updated:** 2026-03-13

---

## Folder Structure

```
docs/
  strategic/       — CEO, investors, board
  product/         — Product managers, designers
  technical/       — Engineers
  operational/     — The brain itself (Acumen, classifiers, harness)
  process/         — Session notes, decisions, onboarding
brain/
  departments/     — Domain expertise docs (11 departments)
  pipelines/       — Classifier rules (email-classification/)
```

---

## Strategic — CEO, Investors, Board

| # | Document | Status | Location |
|---|----------|--------|----------|
| 1 | Product Vision & Strategy | Not started | `docs/strategic/` |
| 2 | User Personas | Not started | `docs/strategic/` |
| 3 | Market Positioning | Not started | `docs/strategic/` |

---

## Product — Product Managers, Designers

| # | Document | Status | Location |
|---|----------|--------|----------|
| 4 | Product Requirements (PRDs) | Not started | `docs/product/` |
| 5 | Feature Catalog | Not started | `docs/product/` |
| 6 | Stack Glossary | Done | `docs/product/stack-glossary.md` |
| 7 | UI Requirements | In review | `docs/product/ui-requirements.md` |
| 8 | Design Mocks | Partial (Figma) | Figma project files |
| 9 | User Flows | Not started | `docs/product/` |

---

## Technical — Engineers

| # | Document | Status | Location |
|---|----------|--------|----------|
| 10 | Architecture | Done | `docs/technical/architecture-mimbrain-v2.md` |
| 11 | Schema Reference | Not started | `docs/technical/` |
| 12 | API Reference | Not started | `docs/technical/` |
| 13 | Infrastructure | Not started | `docs/technical/` |

---

## Operational — The Brain Itself

| # | Document | Status | Location |
|---|----------|--------|----------|
| 14 | Acumen Classifiers | Done (11 categories) | `brain/pipelines/email-classification/` |
| 15 | Harness Rules | Partial (email only) | `docs/operational/harness-scope-email-categories.md` |
| 16 | Harness Loader | Done | `src/lib/harness-loader.ts` |
| 17 | Department Docs | Done (11 departments) | `brain/departments/` |
| 18 | Decision Log SQL | Done | `sql/acumen-decision-log.sql` |
| 19 | Master Effort List | Done | `docs/operational/master-effort-list.md` |

---

## Process — Team Continuity

| # | Document | Status | Location |
|---|----------|--------|----------|
| 20 | Session Notes | Ongoing | `docs/process/session-notes-*.md` |
| 21 | Decision Register | Not started | `docs/process/` |
| 22 | Onboarding Guide | Done | `docs/ONBOARDING.md` |

---

## Summary

| Status | Count |
|--------|-------|
| Done | 11 |
| Partial | 2 |
| In review | 1 |
| Not started | 8 |
| **Total** | **22** |

---

*Add new documents to this index before writing them.*
