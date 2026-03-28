# Documentation Tree
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active reference document. Updated to reflect recovery-era reading order and to remove stale status assumptions.
> **Last updated:** 2026-03-28

---

## How to Navigate

Read documents in this order when onboarding to the project:

1. `docs/strategic/platform-pivot-march-2026.md` — **START HERE.** Strategic pivot, foundation excellence, build order.
2. `docs/operational/agent-recovery-rules.md` — Required operating posture for recovery work
3. `CLAUDE.md` — Current operating assumptions, recovery posture, and critical rules
4. `docs/context-primer.md` — Current state summary with recovery warnings
5. `docs/intelligence-deficit-analysis.md` — The right measurement frame for phase-1 recovery
6. `docs/product/ui-requirements.md` — Governing UI architecture (Motion, Canvas, Engine Room, card types, emotional design)
7. `docs/product/design-brief.md` — Figma-actionable specs (card anatomy, screen layouts, visual language)
8. `docs/technical/architecture-mimbrain-v2.md` — Backend architecture north star
9. `docs/master-effort-list.md` — Historical effort inventory, not proof of live reliability
10. `docs/Ui/email-card-implementation-guide.md` — Current email-card implementation guidance and state-aware behavior rules

Specialised reading:
- `docs/technical/memory-approach.md` — Three-layer memory architecture
- `docs/technical/rag-spec.md` — RAG implementation and retrieval details
- `docs/technical/mcp-functional-spec.md` — MCP server tools and deployment
- `docs/context-primer.md` — Recovery-aware onboarding prompt with key file locations

---

## Root

| File | Purpose |
|------|---------|
| `/CLAUDE.md` | Session instructions, architecture principles, current state, critical rules. **Read first every session.** |

---

## docs/strategic/

| File | Purpose |
|------|---------|
| `platform-pivot-march-2026.md` | Strategic pivot from correctness to contextual suggestions. Foundation excellence requirements. Build order. |

---

## docs/product/

| File | Purpose |
|------|---------|
| `ui-requirements.md` | Governing architecture document. Three surfaces (Motion, Canvas, Engine Room), card types, emotional design principles. Primary reference for any UI work. |
| `design-brief.md` | Figma-actionable specs. Card anatomy, screen layouts, visual language, spacing, typography. |
| `stack-glossary.md` | Vocabulary definitions for all platform terms (In Motion, Gopher, Acumen, Canvas, Attention Class, SNR, etc.). |

---

## docs/technical/

| File | Purpose |
|------|---------|
| `architecture-mimbrain-v2.md` | Backend north star. Entity-centric architecture, three memory types, harness, autonomy layer, schema evolution. **Do not deviate from this.** |
| `memory-approach.md` | How In Motion addresses Claude's statelessness. Three-layer memory: accumulated knowledge (Layer 1), derived intelligence (Layer 2), behavioral adaptation (Layer 3). |
| `rag-spec.md` | RAG implementation spec. Embedding pipeline, pgvector tables, search RPCs, document extraction formats, chunking strategy, retrieval quality. |
| `mcp-functional-spec.md` | MCP server functional spec. 28 tools across 9 domains, deployment strategy, ask_brain logic, classifier ontology as queryable resource. |
| `mim-brain-stripe-integration.md` | Stripe integration spec (planned, not yet built). |

### docs/technical/specs/

| File | Purpose |
|------|---------|
| `unified-classifier-spec.md` | **Governing spec for all classification work.** Attention classification (P0–P3, S0–S3), Decision/Action/Task ontology, 10 signal quality metrics, unified output schema, task creation gate. |
| `brain-intelligence-layer-spec.md` | RAG architecture, instruction persistence, MCP integration, cross-source intelligence. Companion to unified-classifier-spec.md. |

---

## docs/operational/

| File | Purpose |
|------|---------|
| `agent-recovery-rules.md` | Recovery operating posture for agents. Read before proposing changes. |
| `harness-scope-email-categories.md` | 11 email classification categories with definitions, keywords, and routing rules. |
| `training-plan.md` | Classifier training phases T1–T4. Cadence, volume targets, accuracy thresholds. |
| `memory-indexes.md` | Supabase table index for all memory/intelligence tables. |
| `recall-golden-checklist.md` | QA checklist for verifying recall quality. |
| `teams-data-prep.md` | Design note for future Teams data model. |

## docs/Ui/

| File | Purpose |
|------|---------|
| `email-card-implementation-guide.md` | Focused implementation guide for email cards. Covers card structure, recommendation band, permanent remove-from-feed control, and state-aware behavior expectations. |

---

## docs/ (root level)

| File | Purpose |
|------|---------|
| `master-effort-list.md` | Historical effort inventory. Do not treat as proof that listed systems are reliable in production. |
| `context-primer.md` | Quick onboarding prompt with key file locations, architecture rules, and current state summary. |
| `intelligence-deficit-analysis.md` | Recovery measurement frame for the feed. Not superseded for phase-1 diagnosis. |

---

## brain/

Harness documents defining the brain's operating model:

### brain/departments/ (11 files)
Domain expertise docs. Classifiers decide the category; department docs give the brain the expertise to reason within that category.

`accounting-finance.md`, `administration.md`, `ai.md`, `customer-partner-ops.md`, `family.md`, `fundraising.md`, `legal.md`, `marketing.md`, `product-engineering.md`, `scheduling.md`, `ux-design.md`

### brain/pipelines/email-classification/ (11 files)
Classifier rules per category. Loaded by the harness loader into Gopher prompts.

`accounting-finance.md`, `administration.md`, `ai.md`, `customer-partner-ops.md`, `family.md`, `fundraising.md`, `legal.md`, `marketing.md`, `product-engineering.md`, `scheduling.md`, `ux-design.md`

### brain/harness/ (6 files)
Operating model internals — ontology, memory models, processing pipelines.

- `ontology/card-types.md` — Feed card type definitions and lifecycle
- `ontology/entities.md` — Entity model (contacts, organizations, relationships)
- `memory/autonomy-rules.md` — Autonomy qualification and self-correcting loop
- `memory/confidence-model.md` — Accuracy computation, SNR, milestone tracking
- `pipelines/email-processing.md` — Full 11-stage email processing pipeline
- `pipelines/knowledge-ingestion.md` — Knowledge ingestion pipeline (files, notes, Canvas)

---

## docs/archive/

Superseded documents retained for historical reference:

| File | Purpose |
|------|---------|
| `MIMBRAIN.md` | Original project README — superseded by `/CLAUDE.md` |
| `ONBOARDING.md` | Original onboarding doc — superseded by `context-primer.md` |
| `README.md` | Boilerplate Next.js README with old build notes |
| `operational/progress-report.md` | March 15 progress snapshot |
| `operational/project-plan.md` | Original project plan |
| `technical/technical-roadmap.md` | Original technical roadmap |
| `technical/firebase-integration-spec.md` | Placeholder — never populated |

---

## Document Standards

All documents must use this header format:

```markdown
# Document Title
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** [Active strategic document | Draft | Archived | etc.]
> **Last updated:** YYYY-MM-DD
```

Platform name: **In Motion** (not MiMBrain)
Automated workers: **Gopher** (not Scanner)
Thinking space UI label: **Canvas** (route: `/clearing`)
Left nav epics: **Motion**, **Canvas**, **Engine**, **Me**
