# Stack Glossary
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document.
> **Last updated:** 2026-03-20

---

## In Motion

**The platform.** In Motion is the working title for the autonomous business intelligence platform built by Made in Motion. It processes every type of business data, classifies it, prioritises it, recommends actions, and compounds its intelligence over time. The goal: become the de facto Chief Operating Officer of Made in Motion. Previously referred to internally as "MiMBrain."

---

## Your Motion

**The feed.** The CEO's entire operational life in a single scrollable stream of interactive cards. Decisions, signals, tasks, intelligence, snapshots — everything flows through one surface. Your Motion replaces all traditional CRM pages. There are no static views — only the river.

---

## Your Canvas

**The thinking space.** Where the CEO steps away from the execution flow to think, prepare, and capture thoughts. UI label: **Canvas** (route: `/clearing`). Freeform notes, file ingestion, brain-assisted reflection. NOT a creation tool — the CEO uses whatever external tools they prefer (Keynote, Google Slides, Excel). The Canvas is the gate for deeper work, not a workshop. Everything dragged or typed here passes through the single ingestion point.

---

## Engine Room

**The configuration layer.** Where integrations, permissions, and system settings live. At its centre is the Motion Map. Visited during setup and occasional tuning — does not compete for attention with Motion or Canvas.

---

## Motion Map

**The brain's operating logic, made visible.** The CEO's readable view of how the brain classifies, prioritises, and routes information. Shows the 11 business categories, importance tiers, and routing rules. This is the user-facing name for what engineers call the harness.

---

## Gopher

**The intake workers.** Gophers are automated workers that continuously monitor external data sources (Gmail, Slack, etc.), pull in new data, and feed it to Acumen for classification. Think of them as the brain's eyes and ears — they watch everything so the CEO doesn't have to. Each Gopher specialises in one data source.

**Current Gophers:**
- Gmail Gopher — scans inbound email, classifies, emits feed cards
- Slack Gopher — scans Slack channels and threads, classifies, emits feed cards
- Daily Briefing Gopher — synthesises last 24h into a briefing card (7am EST)
- Bulk Data Import Gopher — historical email ingestion at `/engine/import`

Previously referred to as "Scanners."

---

## Acumen

**The decision engine.** Acumen is how In Motion thinks. It takes in raw data (emails, messages, documents), figures out what it's looking at, decides how important it is, and recommends what to do about it. Acumen is what turns a general-purpose AI into a personalised business operator.

Acumen has three parts:

- **Classifiers** — The "what is this?" layer. Classifiers read incoming data and sort it into business categories (e.g., Fundraising, Legal, Marketing). They answer the question: what type of thing just arrived?

- **Harness** — The "how much do I care and what do I do?" layer. The harness contains the rules, importance weights, and playbooks that tell the brain how to prioritise and act on classified data. It's what makes the brain opinionated — it knows that a term sheet matters more than a newsletter.

- **Decision Log** — The "was I right?" layer. Every decision the brain makes gets recorded with its reasoning. The CEO reviews and scores decisions. Over time, this data proves whether the brain is accurate enough to act autonomously — or whether it still needs supervision.

---

## Attention Class

**The CEO-relevance tier.** Every classified communication receives an attention class that determines whether it surfaces, when, and at what weight.

| Label | Channel | Meaning |
|-------|---------|---------|
| `P0_ceo_now` | Email | Interrupt-level. CEO-specific consequence or decision. Surface immediately. |
| `P1_ceo_soon` | Email | Strategic awareness. Review within the day. |
| `P2_delegate_or_batch` | Email | Company-relevant but not CEO-specific. Low-weight signal card. |
| `P3_low_value_noise` | Email | Suppressed. Promotional, cold outreach, automation. |
| `S0_interrupt_now` | Slack | Crisis, escalation, urgent executive decision. Decision card immediately. |
| `S1_review_soon` | Slack | Strategic signal, important opportunity. Action card. |
| `S2_batch_or_delegate` | Slack | Company-relevant, not CEO-specific. Low-weight signal. |
| `S3_suppress_noise` | Slack | Suppressed. Social chatter, reactions, repetitive updates. |

The attention class drives card type, visual weight, and whether tasks are created.

---

## Signal-to-Noise Ratio (SNR)

**The trust metric.** The percentage of surfaced cards that actually deserve the CEO's attention. Measured as `(Do + Hold) / (Do + Hold + No + Dismiss + Should Not Exist)` across all cards, tracked as a rolling 30-day rate.

**Target:** >80%. Below 60% the feed is functionally broken — it trains the CEO to distrust it.

SNR is the single most important quality metric. Category accuracy (is the brain labelling things correctly?) is the prerequisite floor. SNR is the ceiling that determines whether the CEO relies on the feed.

---

## Snapshotting

**On-demand data views.** When the CEO asks "show me all pipeline deals" or "give me a company KPI report," the brain compiles a visual data card and drops it into the feed. Snapshots replace all static CRM pages — no permanent views, just generated-on-demand visual depictions of data.

---

## Cards

**The interactive unit of the feed.** Every item in Your Motion is a card. Cards have four zones: header (category + entity + importance), body (what happened), expand trigger (reasoning + source + entities), and actions (what you can do). Card types include: Decision, Action/Spawn, Signal, Briefing, Snapshot, Intelligence, and Reflection.

---

## Attention Classification → Card Type Mapping

| Attention Class | Card Type | Visual Weight |
|-----------------|-----------|---------------|
| P0 / S0 | Decision | High — black title, drop shadow |
| P1 / S1 | Action | Standard |
| P2 / S2 | Signal | Low — muted styling |
| P3 / S3 | — | Suppressed, no card |

---

## Entity Dossier

**The memory file.** When the brain encounters a person or organisation, it pulls together everything it knows — emails, tasks, pipeline deals, notes, correspondence history — into a single context block. This is the brain's institutional memory about a specific entity.

---

## Knowledge Base

**The long-term memory.** Documents, research, ingested files, and accumulated insights stored with embeddings for semantic search. When the brain answers a question or generates a report, it searches the knowledge base for relevant context using vector similarity (RAG).

---

## RAG

**Retrieval-Augmented Generation.** The technique that gives the brain semantic memory. When a question is asked, the question is embedded as a vector, then the most similar stored knowledge chunks are retrieved and injected into the Claude prompt. The brain answers using its stored knowledge — not just its training.

**In Motion's RAG stack:** OpenAI `text-embedding-3-small` → `brain.knowledge_chunks` (pgvector) → `search_knowledge` RPC → Claude synthesis.

---

## Instruction Engine

**The standing orders.** Persistent directives the CEO gives the brain — things like "always flag emails from this investor" or "include this data in every weekly report." Instructions are loaded into Gopher and report prompts so the brain remembers preferences across sessions.

---

## Autonomy Engine

**The trust meter.** The system that evaluates whether the brain has earned the right to act without asking. It tracks per-category accuracy from CEO actions (Do = correct, No = incorrect). When a category reaches 90%+ accuracy on 20+ reviews, the brain earns autonomous operation for that category — it auto-acts on new cards and emits a Reflection card to tell the CEO what it did. Visible in the Engine Room → Autonomy tab.

---

## Behavioral Rules Engine

**The learning memory.** `brain.behavioral_rules` — a structured store of rules learned from CEO corrections and patterns that get injected into prompts, Gopher configs, and enrichment strategies. The adaptation agent proposes new rules when systematic patterns are detected. High-confidence rules auto-apply; lower-confidence rules surface to CEO for approval.

---

## Department Docs

**The domain expertise.** Deep reference documents that give the brain specialised knowledge about a business area — like a fundraising scoring model or a design system spec. Classifiers decide the category; department docs give the brain the expertise to reason within that category.

---

## Playbooks

**The action plans.** Step-by-step instructions for what the brain should do once it classifies and prioritises something. Playbooks are the eventual replacement for human decision-making on routine operations. Currently represented as a single `default_action` per classifier rule.

---

## Single Ingestion Point

**One door in.** Core architectural principle: all data enters through one endpoint (`/api/brain/ingest`). Brain classifies, decides, acts, emits cards. No UI writes directly to the database. This ensures every piece of data passes through classification, entity resolution, and card emission.

---

## Visibility Scope

**Who sees what.** Every feed card has a `visibility_scope`: `personal` (Phase 1 — CEO only), `team` (Phase 2 — shared with team of 10), or `regiment` (Phase 3 — visible to the organisation at scale). This is how the publish/subscribe model works — no RBAC, just scope.

---

## MCP Server

**The tool belt.** MCP (Model Context Protocol) is how the brain interacts with the platform's data. It exposes 28 tools across 9 domains — contacts, organisations, tasks, knowledge, correspondence, and more. When the brain needs to look something up, create a task, or update a record, it uses an MCP tool. Built, not yet deployed to a host.

---

## Intent Suggestions (Planned)

**The action layer pivot.** Instead of presenting Do/Hold/No action buttons (which demand the brain be perfectly correct), feed cards will suggest an **intent** — what the CEO should do next with this information. Four intent verbs:

| Intent | Meaning |
|--------|---------|
| **Read** | This needs your attention — review it |
| **Respond** | This requires a reply or acknowledgment |
| **Write** | This needs you to draft or create something |
| **Schedule** | This needs a meeting, call, or calendar action |

Intent suggestions are additive — the backend classification (Acumen categories, attention class, priority) continues unchanged. The intent is the user-facing action recommendation. The cost of a wrong intent suggestion is near zero compared to a wrong autonomous action.

> **See:** `docs/strategic/platform-pivot-march-2026.md` for full decision context.

---

## Foundation Excellence

**The prerequisite.** Six requirements that must be met before the intent suggestion UI ships:

1. **Zero-breakage ingestion** — every format, every time, no silent failures
2. **Full-body comprehension** — read the ENTIRE document, not just the first page
3. **Complete storage** — all or nothing; partial comprehension = zero value
4. **Permanent memory** — knowledge persists beyond sessions, permanently
5. **Impeccable recall** — anything submitted must be recallable naturally
6. **Entity resolution depth** — fuzzy matching, alias resolution, relationship inference

> "The death of this product is when data is submitted and it cannot be recalled." — Mark Slater

---

*Add new entries as components are named and built.*
