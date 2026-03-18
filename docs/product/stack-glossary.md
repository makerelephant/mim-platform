# MiM Brain — Stack Glossary
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document.
> **Last updated:** 2026-03-18

---

## Your Motion

**The feed.** The CEO's entire operational life in a single scrollable stream of interactive cards. Decisions, signals, tasks, intelligence, snapshots — everything flows through one surface. Your Motion replaces all traditional CRM pages. There are no static views — only the river.

---

## Your Clearing

**The thinking space.** Where the CEO steps away from the execution flow to think, prepare, and capture thoughts. Freeform notes, file ingestion, brain-assisted reflection. NOT a creation tool — the CEO uses whatever external tools they prefer (Keynote, Google Slides, Excel). The Clearing is the gate for deeper work, not a workshop.

---

## Engine Room

**The configuration layer.** Where integrations, permissions, and system settings live. At its center is the Motion Map. Visited during setup and occasional tuning — does not compete for attention with Motion or Clearing.

---

## Motion Map

**The brain's operating logic, made visible.** The CEO's readable view of how the brain classifies, prioritizes, and routes information. Shows the 11 business categories, importance tiers, and routing rules. This is the user-facing name for what engineers call the harness.

---

## Snapshotting

**On-demand data views.** When the CEO asks "show me all pipeline deals" or "give me a company KPI report," the brain compiles a visual data card and drops it into the feed. Snapshots replace all static CRM pages — no permanent views, just generated-on-demand visual depictions of data.

---

## Cards

**The interactive unit of the feed.** Every item in Your Motion is a card. Cards have four zones: header (category + entity + importance), body (what happened), expand trigger (reasoning + source + entities), and actions (what you can do). Card types include: Decision, Action/Spawn, Signal, Briefing, Snapshot, Intelligence, and Reflection.

---

## Acumen

**The decision engine.** Acumen is how MiM Brain thinks. It takes in raw data (emails, messages, documents), figures out what it's looking at, decides how important it is, and recommends what to do about it. Acumen is what turns a general-purpose AI into a personalized business operator.

Acumen has three parts:

- **Classifiers** — The "what is this?" layer. Classifiers read incoming data and sort it into business categories (e.g., Fundraising, Legal, Marketing). They answer the question: what type of thing just arrived?

- **Harness** — The "how much do I care and what do I do?" layer. The harness contains the rules, importance weights, and playbooks that tell the brain how to prioritize and act on classified data. It's what makes the brain opinionated — it knows that a term sheet matters more than a newsletter.

- **Decision Log** — The "was I right?" layer. Every decision the brain makes gets recorded with its reasoning. The CEO reviews and scores decisions. Over time, this data proves whether the brain is accurate enough to act autonomously — or whether it still needs supervision.

---

## Scanners

**The intake layer.** Scanners are automated workers that continuously monitor external data sources (Gmail, Slack, etc.), pull in new data, and feed it to Acumen for classification. Think of them as the brain's eyes and ears — they watch everything so the CEO doesn't have to.

---

## MCP Server

**The tool belt.** MCP (Model Context Protocol) is how the brain interacts with the platform's data. It exposes 28 tools across 9 domains — contacts, organizations, tasks, knowledge, correspondence, and more. When the brain needs to look something up, create a task, or update a record, it uses an MCP tool.

---

## Entity Dossier

**The memory file.** When the brain encounters a person or organization, it pulls together everything it knows — emails, tasks, pipeline deals, notes, correspondence history — into a single context block. This is the brain's institutional memory about a specific entity.

---

## Approval Queue

**The trust gate.** Before the brain acts autonomously, every recommendation goes through a review queue where the CEO approves, dismisses, or corrects it. The approval queue is how the brain earns trust — each approved decision feeds the Decision Log and moves the system closer to autonomy.

---

## Knowledge Base

**The long-term memory.** Documents, research, ingested files, and accumulated insights stored with embeddings for semantic search. When the brain answers a question or generates a report, it searches the knowledge base for relevant context.

---

## Instruction Engine

**The standing orders.** Persistent directives the CEO gives the brain — things like "always flag emails from this investor" or "include this data in every weekly report." Instructions are loaded into scanner and report prompts so the brain remembers preferences across sessions.

---

## Department Docs

**The domain expertise.** Deep reference documents that give the brain specialized knowledge about a business area — like a fundraising scoring model or a design system spec. Classifiers decide the category; department docs give the brain the expertise to reason within that category.

---

## Playbooks

**The action plans.** Step-by-step instructions for what the brain should do once it classifies and prioritizes something. Playbooks are the eventual replacement for human decision-making on routine operations. Not yet built — currently represented as a single `default_action` per classifier rule.

---

## Autonomy Engine

**The trust meter.** The system that evaluates whether the brain has earned the right to act without asking. It tracks per-category accuracy from CEO actions (Do = correct, No = incorrect). When a category reaches 90%+ accuracy on 20+ reviews, the brain earns autonomous operation for that category — it auto-acts on new cards and emits a Reflection card to tell the CEO what it did. If the CEO disagrees, the category loses autonomy until accuracy recovers. Visible in the Engine Room → Autonomy tab.

---

## Daily Briefing

**The morning summary.** An automated agent that runs every morning, reads all feed cards from the last 24 hours, and synthesizes them into a single Briefing card. Covers: top line (most important thing), items needing attention, decisions made, patterns, and heads up. Generated by Claude, delivered into Motion.

---

## Feed Cards

**The atoms of Motion.** Every item in Your Motion is a feed card stored in `brain.feed_cards`. Each card has a type, priority, visibility scope, entity association, and status. The CEO acts on cards (Do/Hold/No), and those actions feed the accuracy engine. Cards are ephemeral — they can be dismissed or expired. The brain emits cards; the CEO consumes and acts on them.

---

## Single Ingestion Point

**One door in.** Core architectural principle: all data enters through one endpoint (`/api/brain/ingest`). Brain classifies, decides, acts, emits cards. No UI writes directly to the database. This ensures every piece of data passes through classification, entity resolution, and card emission. The Clearing uses this for thought capture and file ingestion.

---

## Visibility Scope

**Who sees what.** Every feed card has a `visibility_scope`: `personal` (Phase 1 — CEO only), `team` (Phase 2 — shared with team of 10), or `regiment` (Phase 3 — visible to the organization at scale). This is how the publish/subscribe model works — no RBAC, just scope.

---

*Last updated: 2026-03-15*

*Add new entries as components are named and built.*
