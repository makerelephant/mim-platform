# Documentation Tree
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active reference document. Updated as documents are added or archived.
> **Last updated:** 2026-03-18

---

## How to Navigate

Read documents in this order when onboarding to the project:

1. `/CLAUDE.md` — Session instructions, critical rules, current state, terminology
2. `product/ui-requirements.md` — Governing UI architecture (the three surfaces)
3. `product/design-brief.md` — Figma-actionable specs
4. `technical/architecture-mimbrain-v2.md` — Backend north star
5. `operational/master-effort-list.md` — What's built and what's next
6. `product/stack-glossary.md` — Vocabulary

Specialised reading:
- `technical/specs/unified-classifier-spec.md` — Before touching any Gopher/classification code
- `technical/specs/brain-intelligence-layer-spec.md` — Before touching RAG, Canvas chat, or memory
- `technical/memory-approach.md` — Three-layer memory architecture
- `technical/rag-spec.md` — RAG implementation and retrieval details
- `technical/mcp-functional-spec.md` — MCP server tools and deployment

---

## Root

| File | Purpose |
|------|---------|
| `/CLAUDE.md` | Session instructions, architecture principles, current state, critical rules. **Read first.** |

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
| `unified-classifier-spec.md` | **Governing spec for all classification work.** Attention classification (P0–P3, S0–S3), Decision/Action/Task ontology, 10 signal quality metrics, unified output schema, task creation gate. Supersedes `intelligence-deficit-analysis.md`. |
| `brain-intelligence-layer-spec.md` | RAG architecture, instruction persistence, MCP integration, cross-source intelligence. Companion to unified-classifier-spec.md. |

---

## docs/operational/

| File | Purpose |
|------|---------|
| `master-effort-list.md` | All efforts and epics with status. Single source of truth for what's built, what's in progress, and what's planned. Updated with every significant change. |
| `harness-scope-email-categories.md` | 11 email classification categories with definitions, keywords, and routing rules. |
| `training-plan.md` | Classifier training phases T1–T4. Cadence, volume targets, accuracy thresholds. |

---

## docs/brain/

22 harness documents defining the brain's operating model:

### departments/ (11 files)
Domain expertise docs. Classifiers decide the category; department docs give the brain the expertise to reason within that category.

`fundraising.md`, `partnerships.md`, `legal.md`, `marketing.md`, `operations.md`, `product.md`, `community.md`, `commerce.md`, `people.md`, `technology.md`, `executive.md`

### pipelines/email-classification/ (11 files)
Classifier rules per category. Loaded by the harness loader into Gopher prompts.

`fundraising.md`, `partnerships.md`, `legal.md`, `marketing.md`, `operations.md`, `product.md`, `community.md`, `commerce.md`, `people.md`, `technology.md`, `executive.md`

---

## docs/intel/

| File | Purpose |
|------|---------|
| `intelligence-deficit-analysis.md` | **Archived — superseded.** The 10 intelligence measurement gaps that drove the unified classifier spec. Retained for reference. The unified-classifier-spec.md is now the authoritative home for this thinking. |

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
