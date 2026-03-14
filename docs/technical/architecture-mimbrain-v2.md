# MiM Brain — Architecture v2

> **Status:** Active north star document
> **Author:** Mark Slater / Claude
> **Date:** March 11, 2026
> **Supersedes:** `docs/spec-brain-intelligence-layer.md` (March 10, 2026)
> **Purpose:** Define the complete architecture for MiM Brain as an autonomous, learning business intelligence system.

---

## 0. The Conviction

Within 12 months, AI will be 1,000 times smarter than any human. Entire layers of business operations will cease to require human management. Organizations that still depend on humans for operational tasks will be at a structural disadvantage.

MiM Brain is the instantiation of this conviction: an autonomous business intelligence system that becomes the de facto Chief Operating Officer of Made in Motion. It processes every type of business data, learns from every interaction, and compounds its intelligence over time.

**Success criteria:** MiM Brain performs operational tasks 1,000x better than a human — not because it's "smarter" in the general sense, but because it has perfect recall, tireless attention, and compounding institutional knowledge that no employee could replicate.

---

## 1. What Exists Today — Honest Assessment

### 1.1 What We've Built

The current system is a **communication processing pipeline with query capability**:

| Layer | What It Does | Status |
|-------|-------------|--------|
| **Scanners** | Gmail + Slack ingestion, pre-filtering, entity resolution, Claude classification, task creation | Production |
| **Taxonomy** | 14 categories loaded from DB, injected into classifier prompts, priority enforcement | Production |
| **Approval Queue** | CEO review flow — pending_review → approve/dismiss, draft replies | Built (orphaned from UI) |
| **Feedback Engine** | Tracks CEO signals (starred, completed, ignored), computes usefulness scores per entity | Production |
| **Entity Dossier** | 10 parallel queries across 4 schemas, ~400 token context block per entity | Production |
| **Document Ingestion** | Upload → extract text → chunk → Claude classify → entity resolve → store | Production |
| **Report Generator** | Pre-scan → 8 data streams → Claude synthesis → PDF export, with instruction injection | Production |
| **MCP Server** | 28 tools across 9 domains, stdio transport, ask_brain synthesis | Built, untested in production |
| **Instruction Engine** | Standing orders, report inclusions, entity watches — loaded into scanner + report prompts | Built |
| **RAG Foundation** | Embeddings lib, vector search RPCs, backfill script | Built, DB tables may not exist yet |

### 1.2 What's Missing

The system **stores and retrieves** but does not **learn, adapt, or act autonomously**:

- **No entity intelligence model.** Organizations and contacts are flat CRM records. No confidence scoring, no provenance tracking, no enrichment gap awareness. The system doesn't know what it doesn't know.
- **No derived intelligence.** After processing 10,000 emails, the system has no accumulated insights beyond raw classification logs. It doesn't extract patterns, trends, or predictions.
- **No behavioral adaptation.** The classifier uses the same prompt template and taxonomy on its first email and its ten-thousandth. CEO corrections don't change future behavior. The system doesn't improve with use.
- **No autonomous action.** Every scanner runs on a trigger (API call or cron). The system never decides on its own that an entity needs enrichment, a follow-up is overdue, or a pattern deserves attention.
- **No asset processing.** Images (logos), videos, and non-text media cannot be ingested, understood, or mapped to entities.
- **No harness.** The brain's operating model (how it processes data, what it prioritizes, how it resolves conflicts) lives in hardcoded prompt templates, not in structured documents the system can read and reason against.

### 1.3 The Gap

The current architecture is a **tooling layer** (scanners, classifiers, MCP tools) sitting on top of a **storage layer** (Supabase tables). What's missing between them is the **knowledge layer** (entity intelligence, derived insights, behavioral memory) and the **autonomy layer** (self-directed enrichment, proactive intelligence, compounding learning).

```
TARGET ARCHITECTURE:

  ┌─────────────────────────────────────────────┐
  │             AUTONOMY LAYER                   │
  │  Self-directed enrichment, proactive alerts, │
  │  scheduled synthesis, reflection loops       │
  │  Orchestration: decides what to do next      │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │             KNOWLEDGE LAYER                  │
  │  Entity graph with confidence + provenance   │
  │  Derived insights, pattern library           │
  │  Behavioral memory, decision history         │
  │  Knowledge Completeness Scores               │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │             TOOLING LAYER (exists)           │
  │  Scanners, classifiers, MCP server,          │
  │  report generator, instruction engine        │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │             STORAGE LAYER (exists)           │
  │  Supabase multi-schema, pgvector,            │
  │  S3/R2 asset storage, knowledge_base         │
  └─────────────────────────────────────────────┘
```

---

## 2. Data Ontology — Entity-Centric Architecture

### 2.1 Core Principle

Every piece of data MiM Brain ingests maps to or creates an **entity node**. The brain is not organized around documents or communications — it's organized around the entities those things refer to. The entity graph is the brain's world model.

### 2.2 Entity Types

```
Organization    Club, League, School, Team, Investor, Partner, Vendor, Customer
Person          Coach, Parent, Player, Admin, Contact, Founder, Investor Contact
Product         Item, Design, Drop, Order, Collection
Asset           Logo, Photo, Document, Video, Spreadsheet
Event           Season, Tournament, Purchase, Interaction, Meeting
Signal          Web scrape, social post, registration, news article, market data
```

**Current state:** Only Organization and Person (as Contact) exist as first-class entities. Products, Assets, Events, and Signals are either untracked or stored as flat records without entity-level intelligence.

### 2.3 Entity Intelligence Model

Every entity carries its own **epistemic state** — what the system knows, how confident it is, where it learned it, and what it still needs to find out.

```
ENTITY INTELLIGENCE PROFILE:

  Identity
    canonical_name, aliases[], type, sub_types[]
    verified: bool
    confidence_score: 0.0 - 1.0 (aggregate)

  Attributes
    [field_name]:
      value: <the data>
      confidence: 0.0 - 1.0
      source: <provenance reference>
      source_trust: high | medium | low
      last_updated: timestamp
      last_verified: timestamp

  Enrichment State
    knowledge_completeness_score: 0.0 - 1.0
    enrichment_gaps[]: fields we don't have data for
    scanner_queue[]: pending enrichment jobs
    last_enriched_at: timestamp
    enrichment_priority: high | medium | low | none

  Relationships
    parent_org, child_orgs[], contacts[], products[]
    relationship_type, relationship_confidence

  Commercial Intelligence
    mim_relationship_stage: cold | warm | customer | champion
    estimated_value, lifetime_value
    product_history[], drop_history[]
    engagement_signals[]

  Behavioral Memory
    usefulness_score (from feedback engine)
    ceo_interaction_count
    last_ceo_interaction
    common_tags[], typical_priority
    pattern_notes[] (derived by synthesis agents)
```

**Knowledge Completeness Score (KCS):**

```
KCS = Sum(field_weight * field_populated * field_confidence) / Sum(field_weight)

Example:
  Before logo batch ingestion:  avg org KCS = 0.23
  After enrichment pipeline:    avg org KCS = 0.61
  Delta = 0.38 → measurable intelligence gain
```

### 2.4 Provenance Tracking

Every fact the brain stores traces back to its origin:

```
PROVENANCE RECORD:
  source_type: scanner | upload | enrichment | derived | manual | correction
  source_id: reference to the specific event/document/scan
  source_trust: high (CEO input) | medium (verified scanner) | low (unverified web scrape)
  captured_at: timestamp
  supersedes: previous_provenance_id (if updated)
```

This is what makes MiM Brain better than a fine-tuned model — you can audit it, correct it, and explain why it believes what it believes.

---

## 3. The Three Types of Memory

### 3.1 Accumulated Knowledge (Storage)

**What it is:** Raw facts stored in the entity graph and knowledge base. More data = more to retrieve.

**Where it lives:** `knowledge_base`, `brain.correspondence`, `brain.tasks`, entity attribute tables.

**Current state:** Partially implemented. Documents and emails are stored. Entity records exist but without confidence, provenance, or completeness tracking.

**How it gets smarter:** Every ingestion event adds facts. But this alone is a filing cabinet, not intelligence.

### 3.2 Derived Intelligence (Synthesis)

**What it is:** New knowledge that didn't exist in any single input — patterns, correlations, predictions, and insights generated by analyzing data in aggregate.

**Examples:**
- "Clubs affiliated with AYSO in the Southwest have 3x higher conversion rates"
- "Entities discovered through Instagram have higher engagement but lower purchasing volume"
- "When the CEO ignores newsletter-type tasks 80%+ of the time, stop creating them"
- "Partnership deal velocity correlates with coach involvement in the design process"

**Where it lives:** A dedicated `brain.derived_insights` store, embedded for RAG retrieval, tagged with entity references and taxonomy categories so they surface in relevant future contexts.

**Current state:** Does not exist. No synthesis process runs. No derived insight storage.

**How it works:**

```
SYNTHESIS LOOP (runs on schedule + after significant batches):

  1. OBSERVE
     Read recent activity, classifications, CEO actions, enrichment results

  2. EXTRACT
     Identify patterns across entities, time periods, categories
     Compare expected vs actual outcomes (e.g., CEO approval rate by category)

  3. WRITE
     Author new derived insight entries:
       - Pattern description (natural language)
       - Supporting evidence (entity IDs, activity IDs)
       - Confidence level
       - Applicable scope (which entity types, categories, contexts)
       - Expiry/review date

  4. EMBED
     Vector-embed the insight so it surfaces in future RAG queries

  5. INTEGRATE
     Tag relevant entities with the insight reference
     Update behavioral memory if the insight implies a process change
```

### 3.3 Behavioral Adaptation (Learning)

**What it is:** The system changes how it operates based on what it has learned. Not just "more data" — fundamentally different behavior on future inputs.

**Examples:**
- Scanner accuracy for partnership emails is 95% but for investor emails only 70% → system adds richer context for investor classification, lowers confidence threshold, routes more to CEO review
- CEO consistently upgrades priority on emails from .edu domains → system writes a standing order to auto-elevate .edu priority
- Enrichment via web scraping works well for Texas clubs but fails for Minnesota → system adjusts scanner strategy by region

**Where it lives:** `brain.behavioral_rules` — a structured store of learned rules that get injected into prompts, scanner configs, and enrichment strategies.

**Current state:** The feedback engine is an embryo of this — it tracks CEO signals and computes usefulness scores. But scores don't modify behavior. The instruction engine accepts human-authored rules but the system never authors its own.

**How it works:**

```
ADAPTATION LOOP:

  1. MEASURE
     Track outcomes: classification accuracy, CEO override rate,
     enrichment success rate, scanner yield per entity type

  2. DIAGNOSE
     Identify systematic patterns in failures/corrections
     Compare performance across categories, entity types, sources

  3. PROPOSE
     Generate candidate behavioral rules:
       "Elevate priority for emails from domains matching existing investors"
       "Skip enrichment via social scanner for entities with KCS > 0.8"
       "Add regional context to classifier prompt for Midwest entities"

  4. VALIDATE
     High-confidence rules (based on large sample + clear pattern) → auto-apply
     Lower-confidence rules → surface to CEO for approval
     All rules include rollback conditions

  5. APPLY
     Write rule to brain.behavioral_rules
     Rule gets loaded into relevant prompts/configs on next execution
     Track rule's impact on subsequent outcomes
```

### 3.4 The Compounding Effect

Each memory layer feeds the next:

**Month 1:** Brain processes 2,000 emails. Raw classification. CEO corrects ~30%. System writes 15 behavioral rules. KCS across entities: 0.15 avg.

**Month 3:** 15 rules in every scanner prompt. CEO corrections drop to ~10%. 40+ derived entity patterns. Report generator includes insights CEO didn't request. KCS: 0.35 avg.

**Month 6:** System predicts which new orgs are high-value before human interaction. Scanner queues self-prioritize. Brain proactively flags churn risk. KCS: 0.55 avg.

**Month 12:** Brain knows the business better than any single employee. Perfect recall across every interaction, every correction, every pattern. Applies all context to every decision. KCS: 0.75+ avg.

**Without these layers, every interaction is a cold start with a bigger database. With them, every interaction benefits from every previous interaction.**

---

## 4. The Harness — Brain Operating Model

### 4.1 What It Is

The harness is a set of structured documents that define how MiM Brain operates. These are **behavioral contracts** — both humans and the AI runtime read them. The AI uses these docs to reason about edge cases, resolve conflicts, and make decisions.

### 4.2 Structure

```
/brain/
  ontology/
    entities.md              # canonical entity types and relationships
    org-schema.md            # Organization entity full spec
    contact-schema.md        # Person/Contact entity full spec
    product-schema.md        # Product entity full spec
    asset-schema.md          # Asset entity full spec
    relationships.md         # how entities connect to each other

  pipelines/
    logo-ingestion.md        # what happens when a logo arrives
    document-ingestion.md    # what happens when a document arrives
    email-processing.md      # how emails get classified and routed
    org-enrichment.md        # scanner activation logic and sequence
    knowledge-merge.md       # how conflicting data gets resolved

  scanners/
    web-scanner.md           # how to find/validate org website
    social-scanner.md        # Instagram/FB discovery rules
    registry-scanner.md      # SportsEngine/TeamSnap lookup
    news-scanner.md          # RSS/news monitoring rules

  memory/
    confidence-model.md      # how certainty scores are calculated
    provenance-rules.md      # source trust hierarchy
    gap-detection.md         # what triggers "we need to know more"
    synthesis-rules.md       # how derived insights are generated
    adaptation-rules.md      # how behavioral rules are proposed and applied

  departments/
    fundraising.md           # how the brain handles fundraising operations
    partnerships.md          # partnership pipeline logic
    commerce.md              # product/drop/order operations
    community.md             # community org management
```

### 4.3 How It's Used at Runtime

When the scanner processes an email, it doesn't just use a hardcoded prompt template. It loads the relevant harness documents:

```
1. Load email-processing.md → general classification rules
2. Load department/{matched_category}.md → category-specific rules
3. Load confidence-model.md → how to set confidence on extracted facts
4. Load provenance-rules.md → how to weight this source
5. Load any applicable behavioral_rules → learned adaptations
6. Load standing orders → CEO instructions
7. Build prompt from all of the above + entity dossier + taxonomy
```

### 4.4 Living Documents

The harness starts as human-authored. Over time, the brain co-maintains it:

- Synthesis agents can **propose amendments** to harness documents based on observed patterns
- CEO reviews and approves significant changes
- Minor optimizations (threshold adjustments, keyword additions) can auto-apply
- Every harness change is versioned and traceable

---

## 5. Autonomy — Self-Directed Operations

### 5.1 Current State

Everything triggers on external events: an API call starts a scanner, a CEO query triggers ask_brain, a cron job generates a report. The brain never decides to act on its own.

### 5.2 Target State

The brain has an **autonomy loop** that runs continuously:

```
AUTONOMY LOOP:

  1. CHECK QUEUE
     Are there pending enrichment jobs? Scanner tasks? Scheduled instructions?

  2. CHECK ALERTS
     Any entities with sudden activity changes? Overdue follow-ups?
     Any behavioral rules triggered? Any KCS drops?

  3. CHECK SYNTHESIS
     Is it time for a synthesis cycle? (daily, or after N new events)
     Are there enough new data points to derive new insights?

  4. PRIORITIZE
     Rank all pending work by: CEO instruction priority > enrichment gaps
     on high-value entities > scheduled tasks > background enrichment

  5. EXECUTE
     Run highest-priority action using available tools
     Log results, update entity intelligence profiles

  6. REFLECT
     Did the action produce expected results?
     Update confidence scores, enrichment state
     If pattern detected → feed into adaptation loop
```

### 5.3 Enrichment Pipeline Example

When a new entity enters the system (e.g., a logo is uploaded and OCR extracts "FC Dallas U12 Blue"):

```
1. IDENTIFY
   OCR → "FC Dallas U12 Blue"
   Entity resolution: no exact match
   Create Organization stub: confidence=0.3, KCS=0.05
   Queue: web_enrichment, social_enrichment, registry_enrichment

2. ENRICH (autonomous, queue-driven)
   Web scanner: "[FC Dallas U12 Blue] soccer Texas"
     → found website → confidence bumps to 0.5
     → extracted: location, age group, parent org "FC Dallas"
     → KCS: 0.25

   Registry scanner: SportsEngine lookup
     → found registration page → roster size ~85
     → KCS: 0.40

   Social scanner: Instagram pattern search
     → found @fcdallasu12blue → 340 followers
     → KCS: 0.50

3. CONNECT
   Resolve parent org: FC Dallas → existing entity, confidence=0.9
   Create relationship: FC Dallas U12 Blue → child_of → FC Dallas
   Inherit some attributes from parent (region, league affiliation)
   KCS: 0.60

4. ASSESS
   Commercial potential: medium (roster size 85, active social)
   Similar entities in system: 47 other FC Dallas age-group teams
   Derived insight: "FC Dallas has 47 age-group sub-teams —
     bulk deal opportunity at club level"
```

---

## 6. Model Strategy

### 6.1 Current Approach

Claude (Anthropic API) powers all reasoning: classification, synthesis, report generation, ask_brain. This is correct for the current stage — highest quality, lowest infrastructure overhead.

### 6.2 Abstraction Requirement

Every place the code calls a model must go through a clean interface:

```typescript
interface ReasoningEngine {
  classify(input: ClassificationInput): Promise<ClassificationResult>;
  synthesize(context: SynthesisContext): Promise<string>;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
  embed(text: string): Promise<number[]>;
}
```

Configuration determines which model serves which task:

```yaml
reasoning:
  classification: claude          # could be local later
  synthesis: claude               # CEO-facing, keep frontier
  extraction: claude              # could be local later
  embedding: openai               # could be local later
  reflection: claude              # internal, could be local later
```

### 6.3 Future Optionality

When volume, cost, or resilience demands it, high-volume structured tasks (classification, entity extraction, taxonomy assignment, confidence scoring) move to a local model (Qwen 2.5 72B, Llama 3.1 70B). CEO-facing synthesis stays on frontier API. No architectural changes required — just configuration.

---

## 7. Schema Evolution Plan

### 7.1 Current Schema (what exists in Supabase)

```
core.organizations          — id, name, notes (flat CRM record)
core.contacts               — id, first_name, last_name, email, role
core.org_types              — org_id, type, status
core.relationships          — contact_id, org_id, relationship_type
crm.pipeline                — org_id, status, pipeline_type
intel.partner_profile       — org_id, partner_status
brain.tasks                 — scanner-created tasks with classification data
brain.correspondence        — email/Slack message records
brain.activity              — operation log
brain.instructions          — CEO standing orders and directives
brain.agent_runs            — scanner execution logs
public.knowledge_base       — uploaded documents with chunks
public.entity_feedback      — CEO signal aggregation per entity
public.inference_taxonomy   — classification categories
public.classification_log   — every classifier call with full context
public.reports              — generated reports
```

### 7.2 Target Schema Additions

The following additions transform the CRM-with-scanners into an entity-centric intelligence system:

**Entity Intelligence (extends existing tables):**

```sql
-- Entity confidence and completeness tracking
-- Added to core.organizations and core.contacts
ALTER TABLE core.organizations ADD COLUMN
  confidence_score FLOAT DEFAULT 0,
  knowledge_completeness_score FLOAT DEFAULT 0,
  enrichment_priority TEXT DEFAULT 'none',
  last_enriched_at TIMESTAMPTZ,
  enrichment_gaps TEXT[] DEFAULT '{}',
  created_source TEXT,                    -- how this entity entered the system
  verified BOOLEAN DEFAULT false;

-- Field-level provenance (new table)
CREATE TABLE brain.entity_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,              -- 'organizations', 'contacts'
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,               -- which field this provenance covers
  field_value TEXT,                       -- the value at time of recording
  source_type TEXT NOT NULL,              -- scanner, upload, enrichment, derived, manual, correction
  source_ref TEXT,                        -- reference to specific event/document
  source_trust TEXT DEFAULT 'medium',     -- high, medium, low
  confidence FLOAT DEFAULT 0.5,
  captured_at TIMESTAMPTZ DEFAULT now(),
  supersedes UUID REFERENCES brain.entity_provenance(id)
);
```

**Derived Intelligence:**

```sql
-- Insights generated by synthesis agents
CREATE TABLE brain.derived_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,             -- pattern, correlation, prediction, recommendation
  description TEXT NOT NULL,              -- natural language insight
  evidence JSONB NOT NULL,                -- entity_ids, activity_ids, data points
  confidence FLOAT DEFAULT 0.5,
  scope JSONB,                            -- which entity types/categories this applies to
  entity_ids UUID[],                      -- entities this insight references
  taxonomy_categories TEXT[],
  embedding vector(1536),                 -- for RAG retrieval
  status TEXT DEFAULT 'active',           -- active, superseded, expired, rejected
  expires_at TIMESTAMPTZ,
  review_needed BOOLEAN DEFAULT false,    -- flag for CEO review
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'synthesis_agent'
);
```

**Behavioral Memory:**

```sql
-- Learned rules that modify system behavior
CREATE TABLE brain.behavioral_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,                -- classification, enrichment, priority, routing
  description TEXT NOT NULL,              -- natural language rule
  condition JSONB NOT NULL,               -- when this rule applies
  action JSONB NOT NULL,                  -- what the rule does
  confidence FLOAT DEFAULT 0.5,
  evidence_insight_ids UUID[],            -- derived insights that led to this rule
  sample_size INTEGER,                    -- how many observations support this
  auto_applied BOOLEAN DEFAULT false,     -- was this auto-applied or CEO-approved
  status TEXT DEFAULT 'proposed',         -- proposed, active, suspended, retired
  impact_metrics JSONB,                   -- tracked impact since activation
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ
);

-- Decision history — what the brain decided, why, and what happened
CREATE TABLE brain.decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL,            -- classification, enrichment, alert, recommendation
  entity_id UUID,
  entity_type TEXT,
  input_summary TEXT,                     -- what the brain was looking at
  decision TEXT NOT NULL,                 -- what it decided
  reasoning TEXT,                         -- why (from Claude response)
  rules_applied UUID[],                   -- behavioral_rules that influenced this
  outcome TEXT,                           -- what actually happened (updated later)
  ceo_override BOOLEAN DEFAULT false,     -- did CEO change the decision
  ceo_correction TEXT,                    -- what CEO changed it to
  created_at TIMESTAMPTZ DEFAULT now(),
  outcome_recorded_at TIMESTAMPTZ
);
```

**Enrichment Queue:**

```sql
-- Autonomous enrichment job queue
CREATE TABLE brain.enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  scanner_type TEXT NOT NULL,             -- web, social, registry, news
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',          -- pending, running, completed, failed
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  result JSONB,
  fields_updated TEXT[],                  -- which entity fields got new data
  kcs_before FLOAT,
  kcs_after FLOAT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

**Vector Storage (from previous spec, may already exist in Supabase):**

```sql
-- Knowledge chunks with vector embeddings
CREATE TABLE brain.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Correspondence chunks with vector embeddings
CREATE TABLE brain.correspondence_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondence_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector search RPC functions
CREATE OR REPLACE FUNCTION brain.search_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.4
) RETURNS TABLE (...);

CREATE OR REPLACE FUNCTION brain.search_correspondence(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.4
) RETURNS TABLE (...);
```

---

## 8. Implementation Phases

### Phase 0: Foundation (Current — Complete)

What's built: scanners, classifiers, taxonomy, entity dossier, feedback engine, instruction engine, MCP server, RAG foundation, report generator.

**This phase is done.** Everything below is new work.

### Phase 1: Entity Intelligence

**Goal:** Entities become self-aware knowledge nodes with confidence, provenance, and completeness tracking.

- Add confidence, KCS, enrichment columns to `core.organizations` and `core.contacts`
- Create `brain.entity_provenance` table
- Create `brain.enrichment_queue` table
- Modify scanners to write provenance records when they create/update entities
- Implement KCS calculation function
- Build dashboard widget showing aggregate KCS trends

**Outcome:** You can see how much the brain knows about each entity, and the system tracks where every fact came from.

### Phase 2: Harness Documents

**Goal:** The brain's operating model is defined in structured documents that the AI runtime reads.

- Author the `/brain/` harness document tree (ontology, pipelines, scanners, memory, departments)
- Modify scanner prompts to load relevant harness docs instead of hardcoded templates
- Modify ask_brain to include relevant harness context for reasoning
- Version harness documents in git

**Outcome:** The brain's behavior is defined by readable documents, not buried in code. Changing how the brain handles partnership emails means editing `brain/departments/partnerships.md`, not rewriting scanner code.

### Phase 3: Derived Intelligence

**Goal:** The brain generates new knowledge from aggregate observation.

- Create `brain.derived_insights` table with vector embedding column
- Build synthesis agent (runs daily + after significant batches)
- Synthesis agent reads recent activity, classifications, CEO signals, enrichment results
- Synthesis agent writes derived insight entries, embeds them for RAG
- Insights surface in ask_brain queries and entity dossiers

**Outcome:** After processing enough data, the brain starts telling you things you didn't know to ask about.

### Phase 4: Behavioral Adaptation

**Goal:** The system changes how it operates based on learned patterns.

- Create `brain.behavioral_rules` and `brain.decision_log` tables
- Build adaptation agent (runs weekly + on significant CEO override patterns)
- Adaptation agent analyzes decision_log for systematic patterns in corrections
- Proposes behavioral rules (high-confidence: auto-apply; low-confidence: CEO review)
- Rules get loaded into scanner prompts, classifier configs, enrichment strategies
- Track rule impact metrics

**Outcome:** CEO corrections decrease over time because the brain learned from the first few.

### Phase 5: Autonomous Enrichment

**Goal:** The system decides on its own that entities need enrichment and executes.

- Build enrichment orchestrator (processes queue, runs scanners, updates entities)
- Web scanner, social scanner, registry scanner implementations
- Queue prioritization logic (CEO instruction > high-value entities > background)
- KCS tracking before/after enrichment to prove value

**Outcome:** New entities automatically get enriched without human intervention. The logo pipeline from the ontology conversation becomes possible.

### Phase 6: Chat Interface

**Goal:** CEO converses with the brain through the dashboard.

- Build chat UI on the My Brain dashboard page
- Wire to MCP server's ask_brain (enhanced with all new context layers)
- Chat context includes: derived insights, behavioral rules, entity intelligence, harness docs
- CEO can issue instructions conversationally ("watch Adidas for the next 30 days")

**Outcome:** The brain becomes conversational. The CEO interacts with it like a chief of staff.

---

## 9. What the Brain Looks Like at Maturity

At full implementation, a single CEO query like "What should I know about our Texas partnerships?" triggers:

1. **Entity resolution:** Identifies all organizations with type=Partner in Texas region
2. **RAG search:** Finds relevant knowledge base docs and correspondence
3. **Derived insights:** Surfaces patterns like "Texas partners have 2x conversion when coach is involved in design"
4. **Behavioral context:** Notes that the CEO has historically been most interested in deal velocity for this segment
5. **Entity intelligence:** Shows KCS scores — "We know 80% about FC Dallas but only 30% about Houston Dynamo Youth"
6. **Active instructions:** Checks if any standing orders relate to Texas partnerships
7. **Enrichment state:** Notes "Houston Dynamo Youth has 3 pending enrichment jobs in queue"
8. **Synthesis:** Claude weaves all of this into an executive briefing with recommended actions

None of this requires the CEO to know what data exists or where it lives. The brain knows what it knows, knows what it doesn't know, and is actively working to fill the gaps.

---

## 10. Design Constraint: Person Feed Compatibility

### The Insight

MiMBrain already builds structured intelligence profiles for every entity it encounters — identity, capabilities, relationships, activity, reputation. It does this internally by scraping, classifying, and inferring from signals.

In an AI-native world, entities will publish this information themselves as machine-readable feeds — structured streams of identity + intent + activity + capabilities that AI agents subscribe to. Think of it as RSS for people and organizations, but structured for AI reasoning.

The internal entity intelligence model we're building and the external person feed protocol are **the same data structure**. One is inferred privately. The other is published openly. They must be compatible.

### What This Means for Schema Design

Every entity intelligence table and field must pass this test:

> *"Could this field be populated either by our scanner inferring it, OR by the entity publishing it directly in a structured feed?"*

If yes, the schema is correct. If a field can only exist through internal inference and has no external equivalent, question whether it belongs in the entity model or in a separate internal-only table.

### The 10 Layers of a Person Feed

For reference, a complete AI-native person feed contains:

| Layer | Description | Internal Equivalent |
|-------|-------------|-------------------|
| Identity | Name, roles, verified accounts, location | Entity core fields |
| Capabilities | Skills, tools, expertise, industries | Not yet modeled — future |
| Intent | What they're seeking, available for | Not yet modeled — future |
| Activity | Projects, events, launches, commits | `brain.correspondence`, `brain.tasks`, `brain.activity` |
| Knowledge | Topics of interest, current questions | `brain.derived_insights` (about them) |
| Relationships | Collaborators, communities, affiliations | `core.relationships`, `core.org_types` |
| Availability | Contact methods, response window, open-to | Not yet modeled — future |
| Reputation | Endorsements, outcomes, citations | `entity_feedback.usefulness_score` (internal only) |
| Personal | Values, work style, hobbies | Not yet modeled — future |
| Status | Currently working on, location, availability | Not yet modeled — future |

**Layers 1, 4, 6 map to existing schema.** Layers 2, 3, 7, 8, 9, 10 are future extensions. The schema should not prevent adding them.

### How This Evolves With the Cadence

**The 1:** MiMBrain builds entity profiles internally for everyone the CEO interacts with. Scanners infer. The CEO's own Motion feed is his person feed (rendered as UI, not JSON).

**The 10:** Team members each have their own Motion (private feed). They publish selected signals into the shared brain. The CEO's brain subscribes to what's published. Visibility isn't controlled by permissions tables — it's controlled by what each person chooses to emit. The person feed IS the access control model. No RBAC, no admin dashboards, no visibility matrices. The wall between private and shared is architectural: publish/subscribe, not permit/deny.

| Feed Layer | Private (your Motion) | Published (shared brain) | Upward (CEO sees) |
|------------|----------------------|--------------------------|-------------------|
| Activity | All tasks, emails, work | Project milestones, blockers | Decisions needed, outcomes |
| Intent | Personal goals | Team-relevant asks | Resource requests, strategic flags |
| Status | Everything | Current focus, availability | Escalation-worthy signals only |
| Knowledge | Notes, thinking | Shared learnings | Derived insights affecting company |

**The 1,000:** External protocol. Entities publish feeds. Scanners become subscribers. Enrichment flips from pull (scrape) to push (subscribe). The CEO's person feed becomes publishable — attached to email footers, discoverable at a well-known endpoint.

### Near-Term Implication: Email Context Block

When MiMBrain sends or drafts email on behalf of the CEO, it could attach a machine-readable context block (in headers or footer) that any AI reading the email can parse. This is a small build with high leverage — not a protocol, just a practical step.

### Rule

**Do not build the protocol. Do not build the external publishing layer. But design every entity intelligence table so the data could be serialized as a person feed without restructuring.**

---

## 11. Open Decisions

These decisions should be made before implementation begins:

1. **Schema evolution approach:** Extend existing tables vs. create a parallel entity intelligence layer? Extending is faster. Parallel is cleaner but requires migration mapping.

2. **Harness authoring:** Who writes the initial harness documents? CEO drafts the business logic, engineering translates to structured format? Or engineering proposes and CEO reviews?

3. **Enrichment scanner priority:** Which external data sources matter most? Web scraping, social media, sports registries, news? This determines which scanners to build first.

4. **Synthesis cadence:** Daily synthesis cycles? After every N events? Both? This affects compute cost and how quickly the brain compounds.

5. **Behavioral rule approval:** What confidence threshold for auto-applying learned rules? Conservative (CEO approves everything) vs. aggressive (auto-apply high-confidence rules)?

6. **Asset processing priority:** Logo/image ingestion requires CLIP + OCR infrastructure. Is this Phase 5 priority or later?

---

## 12. Success Metrics

The brain is succeeding when:

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Average entity KCS | 0.15 | 0.55 | 0.75+ |
| CEO override rate on classifications | 30% | 10% | <5% |
| Derived insights generated (cumulative) | 0 | 200+ | 1,000+ |
| Active behavioral rules | 0 | 25+ | 100+ |
| Entities with KCS > 0.7 | <50 | 500+ | 5,000+ |
| Autonomous enrichment jobs/week | 0 | 100+ | 1,000+ |
| Time to enrich new entity to KCS 0.5 | Manual | <24h | <1h |
| Ask_brain queries with derived insight context | 0% | 40%+ | 80%+ |

The ultimate metric: **Can MiM Brain write the weekly report with zero CEO corrections?** When the answer is consistently yes, the brain is operating as a COO.
