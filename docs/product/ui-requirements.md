# MiMBrain Platform — UI Requirements

> **Purpose:** Define the interaction architecture for MiMBrain — a feed-first orchestration platform built on impermanence, snapshotting, and the rejection of static pages.
>
> **Companion docs:**
> - `design-brief.md` — Figma-actionable specs, component definitions, screen inventory
> - `architecture-mimbrain-v2.md` — backend intelligence stack (entity intelligence, harness, memory, autonomy)
> - `master-effort-list.md` — all planned efforts/epics
>
> **Status:** Working draft. Reflects design sessions through 2026-03-14.

---

## 0. Guardrails

Five beliefs that govern every decision — product, architecture, and hiring. See `CLAUDE.md` for the full list. The short version:

1. AI will be 1000x smarter than humans within 12 months. Build for that world.
2. Nothing we build should be inherited from the era of deterministic software.
3. Every hire must be 1 of 10 people to reach a billion-dollar company.
4. Everyone must be in motion — us, our customers, our users.
5. Don't design for a deterministic architecture that will no longer exist.

**Design implication:** Every screen, component, and interaction must pass the test: *"Does this assume a static, human-driven, deterministic world that won't exist in 12 months?"* If yes, rethink it.

### Company Cadence: 1 → 10 → 1,000

1. **The 1** — Build Your Motion for the CEO. One person, fully orchestrated. ← **We are here.**
2. **The 10** — The team of 10 share parts of their motion (internal ops, execution). This is teams.
3. **The 1,000** — The regiment of efforts going to market. The product at scale.

**Design implication:** Everything we design right now is for the 1. Do not generalize for multi-tenant, do not build admin dashboards, do not design onboarding flows. Nail the single-user orchestration experience first.

---

## 1. Platform Architecture

The platform has three elements. Two are where the CEO lives. One is where they visit.

### Your Motion

The execution flow. A single, scrollable, interactive feed — the CEO's operational life in motion. Decisions, signals, tasks, intelligence, snapshots — everything flows through one surface. This is where life comes TO you.

### Your Clearing

The thinking space. Where the CEO steps away from the flow to think, prepare, capture thoughts, and review. Not a creation tool — the CEO uses whatever tools they're already comfortable with (Keynote, Notion, Google Docs). The clearing is for thought work and ingestion, not artifact production.

### Engine Room

The configuration layer. Integrations, gophers, users, permissions, and — at its center — the Motion Map, which is the CEO's readable view of the brain's operating logic (the harness). Visited during setup and occasional tuning. Does not compete for attention with Motion or Clearing.

---

## 2. Foundational Principles

### 2a. The Burning Man Principle — Celebrate Impermanence

The platform rejects the 20-year SaaS instinct to save, store, and retrieve through permanent pages. When the brain is 1,000 times smarter than you, why would you ever think that what you need, it can't get — and instantly?

There is no "saving to search later." There is only "expressing to retrieving now."

Data lives somewhere and has permanence — but that's the brain's problem and choice, not the CEO's. No static pages. No filing cabinets. No permanent views. Everything is generated on demand, consumed in context, and either promoted to something recurring or allowed to dissolve back into the stream.

### 2b. The Gate Principle

We are not a productivity suite. We don't compete with the tools the CEO already uses to create things. We are the gate everything passes through on the way in and out.

- **Motion** is the gate for operational flow — decisions, signals, actions flowing through
- **The Clearing** is the gate for deeper work — context going out to inform creation, artifacts coming back in to become institutional memory

The brain's value isn't helping you make the deck. It's knowing, six months later, that the deck exists, what it contained, who saw it, and surfacing it when relevant.

### 2c. No Pages

There are no static pages. No `/orgs` table. No `/contacts` list. No `/pipeline` kanban. No `/reports` dashboard. These are all prompts, not destinations:

- "Show me my organizations" → the brain decides the best visual rendering
- "Who have I talked to most this month?" → better than a contacts table
- "Show me the fundraising pipeline" → snapshotted on demand
- "What do we know about the Massachusetts youth sports market?" → intelligence cards

If the CEO wants any of these regularly, they tell the brain. It becomes scheduled. The view was never a page. It was a moment.

**Exception:** Settings pages exist because configuring infrastructure requires a stable interface.

---

## 3. Your Motion — The Feed

### What Motion Is

- A chronological stream of cards, newest at top
- The brain's outbound: classifications, signals, briefings, action confirmations, snapshots
- The CEO's inbound: queries, instructions, redirections
- The operational record: tasks created, decisions made, actions taken
- The living timeline of the CEO's day — scroll down to see it unfold in reverse

### What Motion Is Not

- An inbox (nothing demands action; everything invites it)
- A dashboard (no static widgets; everything flows)
- A chat window (responses arrive as cards, not chat bubbles)
- A page you navigate to (it IS the app)

### Core Interaction Pattern

```
Ask or Receive → Scan → Expand if interested → Act if needed → Next
```

This applies to every feature. Decisions, reports, intelligence, tasks, enrichment, briefings, knowledge — all card types in the same feed following the same pattern.

### Motion Is Generative

Cards spawn cards. The brain says "I created a task for this" and the task card materializes above it — connected, contextualized, interactive. The CEO adjusts the task due date, and the brain responds: "This conflicts with your board prep — want me to shift that?" Another card. Another one-tap decision. The feed makes the operational graph visible — cause and effect, in sequence, in one place.

### CEO Input

A single text input lives at the top of Motion. The CEO types naturally:

- "get me up to speed on youth sports in mass — I have a meeting next week"
- "give me an update on company KPIs over the last week"
- "show me a pipeline view of our customer efforts from prospect to closed"
- "create a task to follow up with Greg by Friday"

The brain responds by inserting cards into Motion — discrete, scannable, expandable, actionable. Each one self-contained, each one interactive.

### Resolution States

Cards arrive, get addressed, and settle. Resolved cards don't disappear (that creates anxiety). They go visually muted — a quiet record of what happened.

---

## 4. Snapshotting

Snapshotting is the brain's ability to compile visual depictions of data on demand — charts, pipelines, tables, graphs, timelines — in response to a CEO prompt. Snapshots are cards in Motion, not pages.

### Snapshot Lifecycle

```
PROMPT → SNAPSHOT (ephemeral card) → INTERACT → maybe PROMOTE

  "show me the pipeline"
       ↓
  [visual card appears in Motion]
       ↓
  CEO: "break this out by revenue stage"
       ↓
  [updated snapshot jumps to top of Motion]
       ↓
  CEO: "good — send me this every Monday"
       ↓
  [brain schedules it, confirms with action card]
       ↓
  snapshot settles into the stream like everything else
```

### Snapshot Properties

- **Ephemeral by default.** No URL, no page, no permanent home. Exists because it was needed.
- **Interactive.** The CEO can ask for corrections, additions, different views. The card keeps jumping back to the top as iterations progress.
- **Promotable.** The CEO can schedule regular creation/delivery, share it, add it to a draft report, or pin it.
- **Visual-primary.** Unlike text-based cards, snapshots render data as the visual form that best communicates the answer — chart, pipeline, table, graph, timeline.

### What Snapshotting Replaces

| Old Static Page | New Snapshot Prompt |
|---|---|
| `/orgs` — All Organizations | "Show me my organizations" |
| `/orgs?type=Investor` — Investors | "Show me our investor relationships" |
| `/contacts` — All Contacts | "Who are my key contacts this quarter?" |
| `/pipeline` — Fundraising | "Show me the fundraising pipeline" |
| `/intelligence` — Intelligence | "What signals should I be aware of?" |
| `/activity` — Activity Log | Scroll down in Motion |
| `/news-sentiment` — Sentiment | "What's the market sentiment on [topic]?" |

---

## 5. Your Clearing

### What the Clearing Is

The deliberate pause from motion. The campfire in the middle of the campsite where things are gathered, spread out, and planned. The CEO steps into the clearing when they need to stop, think, and prepare — then steps back into motion.

### What the Clearing Supports

- **Thought stream / notepad** — freeform text capture throughout the day. Fragments, reminders, observations. The brain absorbs these and may reference them later in Motion cards. "Remind me to ask Greg about the Wellesley opportunity" → later, a card appears in Motion: "You wanted to ask Greg about Wellesley. Your meeting is Thursday."
- **Brain-assisted prep** — "Help me think through the board meeting" and the brain pulls together relevant context, recent decisions, KPIs, open items. The CEO shapes their thinking, then goes to their preferred tool to build the actual deliverable.
- **Ingestion** — bring things back in. The finished deck, the signed contract, the meeting notes from Apple Notes. Drop them into the clearing and the brain absorbs them into institutional memory — linked to entities, available for future recall.
- **Planning** — not project management. More like: "Here are the 4 things I want to accomplish this quarter." The brain holds this context and references it in future cards.

### What the Clearing Is Not

- A document editor (the CEO uses Keynote, Notion, Google Docs for that)
- A project management tool (no Gantt charts, no sprint boards)
- A second feed (it's a workspace, not a stream)
- A permanent fixture (clearing sessions exist while the work is in progress, then dissolve — the artifacts survive, the workspace doesn't)

### Relationship to Motion

- A card in Motion can open a clearing session ("Board meeting in 9 days. No deck started." → tap to enter clearing with pre-assembled context)
- A clearing session produces cards back into Motion when complete ("Board deck context prepared — 12 data points compiled")
- The CEO can have multiple clearing sessions in progress
- The clearing has its own relationship with the brain — the CEO can ask questions from within the clearing without returning to Motion

---

## 6. Emotional Design Principles

These govern every design decision. Wireframes and layouts must satisfy ALL of these constraints.

### 6a. Decision License Without Anxiety

The CEO must feel confident acting quickly. Anxiety comes from uncertainty: "if I say yes, what happens? Did I miss something?"

The card eliminates uncertainty BEFORE the CEO acts — not through more information (that's clutter), but through confidence transfer. The brain does all the thinking before the card renders. The default posture is "I've got this, do you agree?" — not "here are 6 bullet points, you figure it out."

**How Motion delivers this:** Nothing in the UI creates pressure. No badge counts, no "7 pending" indicators, no separate page where problems accumulate. The feed shows what the brain wants to show, in the order it thinks matters. The CEO scrolls, engages, moves on.

### 6b. Calm as Amplified Success

Success is not a congratulations banner. Success is the absence of demand. The app should feel like a well-organized desk, not a completed to-do list. One projects accomplishment. The other projects absence of burden.

**How Motion delivers this:** When all cards are resolved, Motion is simply calm. The CEO can still scroll, still query, but the default state communicates: you're good. No stats, no activity counts, no implied "I was busy while you weren't looking."

### 6c. Attachment to Progress

Explicit metrics ("you're 12% more efficient!") feel performative. Implicit progress is powerful — the CEO notices over weeks that cards come less frequently, the brain's suggestions match their instincts more often, they almost never need to correct.

**How Motion delivers this:** The feed naturally thins over time. Cards present more minimally when brain confidence is high. The CEO feels progress through the experience, not through a scoreboard. Analytical depth exists for when the CEO goes looking for it — a mirror, not a billboard.

### 6d. Control Without Clutter

The CEO must feel they COULD override anything without the override apparatus being visible all the time. Like a car where you grab the steering wheel and it responds — not a car with a manual override switch on the dashboard.

**How Motion delivers this:** The CEO acts, the brain executes. Deeper context is available via expansion, not presented by default. The text input is always there — any card's context can be grabbed and redirected. The brain doesn't constrain; it presents.

### 6e. White Space for Individuality

The "I want to go in a different direction" moment. The CEO stepping in with their own judgment — composing, not just conducting.

**How Motion and Clearing deliver this:** The text input invites open-ended interaction. The clearing provides space for unstructured thinking. The gate principle means the CEO can go create in any tool they want and bring it back. The platform never forces behavioral change on creation workflows.

### 6f. Orchestration Fulfillment

The cumulative feeling of using the product over time. The CEO opens the app, sees their world in motion, sees the brain handling the noise, sees important things surfaced cleanly. And they feel: "This system reflects my judgment. It thinks like I do because I taught it."

**How the platform delivers this:** The brain is a mirror of the CEO's decision-making, externalized and automated. The more accurate it gets, the more the CEO sees themselves in it. This isn't a feature — it's what happens when every other principle is working.

---

## 7. Card Types

All cards share a common anatomy but have type-specific content and actions.

### Common Card Anatomy

Every card has four zones, top to bottom:

| Zone | Content |
|---|---|
| **Header** | Type indicator (icon + label) on left. Entity/source name in middle. Urgency indicator on right. |
| **Body** | Brain's summary or recommendation. 2-3 lines in collapsed state. |
| **Expand trigger** | Subtle chevron or "show more" — card body is also tappable. |
| **Actions** | Row of type-specific action buttons at bottom. |

Three visual states:

- **Collapsed:** Scannable. 2-3 lines. Enough to decide whether to engage.
- **Expanded:** Full context — brain reasoning, source content, entity context, related items, provenance.
- **Resolved:** Visually muted. Still visible in the stream as a record.

### 7a. Decision Cards

The brain classified something and needs the CEO's input. The brain has done all research before rendering — entity context, related correspondence, open items pre-loaded.

Actions:
- **✓ Do** — accept the brain's recommendation. Brain executes.
- **✕ No** — reject. Reveals structured correction (radio buttons + one-line input).
- **🕐 Not Now** — defer. Card recedes, returns later.

Visual urgency tiers:
- High: visually prominent (accent color, larger presence)
- Medium: standard
- Low: starts collapsed — brain is confident, one-tap confirm

### 7b. Action Cards (Spawn Cards)

The brain did something as a result of a decision or instruction.

Examples:
- "Created task: Confirm Walt accepted Jane's edits — due tomorrow"
- "Scheduled pipeline snapshot for every Monday 8 AM"
- "Drafted reply to Greg — review below"

Actions: Edit inline / Undo / Acknowledge

### 7c. Signal Cards

Ambient intelligence. The brain noticed something.

Examples:
- "Greg hasn't responded in 5 days"
- "Revenue hit $40K this month — up 22%"
- "3 partnership emails this week, up from 0 last month"

Actions: Expand / Create task / Dismiss

### 7d. Briefing Cards

Authored by the brain. Daily synthesis, weekly summary, monthly review.

Actions: Expand full report / Share / Schedule meeting / Ask deeper questions — each sub-action spawns its own card.

### 7e. Snapshot Cards

Visual data compilations generated on demand. Charts, pipelines, tables, graphs.

Actions: Iterate ("break this out by stage") / Schedule / Share / Pin

### 7f. Intelligence Cards (Query Responses)

Generated when the CEO asks a question. Each piece of intelligence arrives as a separate card.

### 7g. Reflection Cards

The brain showing its own learning: "You've corrected me on partnership classifications 4 times this week. I've updated my rules."

Actions: Acknowledge / Review changes / Revert

---

## 8. Navigation

### The Sidebar (Minimal)

The sidebar exists as a minimal structural element, not a navigation system. The CEO navigates by talking to the brain, not by clicking menu items.

Sidebar contains:
- MiMBrain logo
- **Your Motion** — the feed (always home)
- **Your Clearing** — thinking space
- **Engine Room** — gear icon, opens the engine room
- User profile + sign out

That's it. No section headers. No 24-item menu. No org types, contact subtypes, or pipeline variants. Those are all prompts now, not destinations.

### The Engine Room

The configuration layer that makes Motion and the Clearing work. The only part of the platform that uses traditional page-based interfaces, because infrastructure configuration needs stable, predictable surfaces.

#### The Motion Map (Centerpiece)

The Motion Map is how the CEO sees their brain's operating logic. It's the readable, visual representation of the harness — the map of the system they've built through every correction, every instruction, every decision in Motion.

The CEO opens the Motion Map and sees: **this is how my brain thinks.**

- Categories the brain sorts into (partnership, legal, family, administration, etc.)
- Rules governing classification and importance
- Standing orders ("always flag FoundersEdge as medium minimum")
- Learned behavioral patterns from CEO corrections
- Entity-level overrides and preferences

The Motion Map is alive. Every correction the CEO makes on a decision card in Motion flows back here. Every "no, this is partnership not administration" updates the map. The CEO doesn't need to visit it to make changes — changes happen naturally through Motion — but they can visit to review, audit, and understand the full picture of what they've taught the brain.

**The harness** is the technical implementation underneath the Motion Map. The markdown classifier files, the prompt engineering, the runtime loader. The CEO sees the Motion Map. The builders see the harness. Same data, different aperture.

#### Supporting Infrastructure

The remaining engine room pages are plumbing — visited during setup and occasional tuning.

| Page | Purpose | Conversational? |
|---|---|---|
| **Integrations** | Connected services — Gmail, Slack, Stripe, Calendar. Status, last sync, errors. OAuth flows. | Connect/disconnect via brain ("connect my Gmail"), but status dashboard needs visual |
| **Gophers** | Active automations and their status. What's running, what it did, errors. | Control via brain ("pause enrichment gopher"), but monitoring needs visual |
| **Users & Permissions** | Who has access, roles, what they can see. | No — traditional admin, needs stable forms |
| **Account** | Profile, billing, company info. | No — standard settings page |

#### Conversational Configuration

Many engine room changes don't require visiting the engine room at all. The CEO can configure from Motion or the Clearing:

- "Connect my Gmail" → brain walks through OAuth
- "Scan every 15 minutes instead of 30" → brain updates, confirms with card
- "Stop enriching vendors, only enrich investors and partners" → brain updates rule
- "Add a new category called Board Relations" → brain updates the Motion Map
- "Pause the enrichment gopher until next week" → brain pauses, confirms

The engine room visual pages exist for **review and audit** — seeing the full picture. Creation and modification happen naturally through interaction.

---

## 9. Entity Association

Every card that references a known entity links to it. The purpose is preparation, not surveillance.

When the brain renders a card, it already has:
- Full dossier on referenced entities
- Recent correspondence history
- Open tasks and pending items
- Relationship context (introductions, meetings, deal stage)

This context is pre-loaded into expanded card state. Entity links resolve BOTH organizations and contacts. (Current gap: org resolves but contact does not always.)

When an entity is tapped in any card, context appears inline or as a slide-over — NOT as a separate page navigation.

---

## 10. Memory & Intelligence Stack

The UI architecture (Motion, Clearing, Engine Room) is the presentation layer. Underneath it, the brain's intelligence stack is defined in `architecture-mimbrain-v2.md` and remains the backend plan. The UI changed; the intelligence architecture did not.

### Three Types of Memory

| Memory Type | What It Is | How It Surfaces in the UI |
|---|---|---|
| **Accumulated Knowledge** | Raw facts in the entity graph and knowledge base. Every scan, every ingestion adds data. | Pre-loaded into expanded card state. Entity dossiers. Intelligence card responses. |
| **Derived Intelligence** | Patterns and insights synthesized from aggregate observation. New knowledge that didn't exist in any single input. | Signal cards ("3 partnership emails this week, up from 0 last month"). Briefing cards. Snapshot context. |
| **Behavioral Adaptation** | Learned rules that modify how the brain operates. CEO corrections change future behavior. | Reflection cards ("I updated my rules"). The Motion Map (visible rule changes). Fewer decision cards over time (the feed getting quieter). |

### Backend Phases (from architecture v2)

These are unchanged and run in parallel with the frontend build:

1. **Entity Intelligence** — provenance, KCS, enrichment tracking
2. **Harness Documents** — structured operating model (already started with Acumen classifiers)
3. **Derived Intelligence** — synthesis loop, insight generation
4. **Behavioral Adaptation** — learning from corrections, writing rules
5. **Autonomous Enrichment** — self-directed entity enrichment

As each phase completes, the cards in Motion get richer and the feed gets quieter.

---

## 11. Training Phase

Training is our internal calibration — not a product feature.

### Requirements

- Higher card volume (every classified email gets a card)
- Open text input on decision cards if richer context improves training signal
- Bulk operations (batch confirm, batch correct)
- Accuracy tracking visible for calibration
- Structured correction with category + importance override

### Approach

Don't over-design. Whatever gets us through calibration fast is fine, even if rough. The steady-state card (Section 7a) is the product. Training cards can be utilitarian. They will be deprecated.

---

## 12. Platform Features Mapped

Every planned feature maps to Motion as a card type or to the Clearing as a workspace capability. No feature requires its own page.

| Feature | Expression | Notes |
|---|---|---|
| Communication Intelligence | Decision cards in Motion | Gmail/Slack classifications |
| Important Conversations | Motion IS this | The feed replaces the old component |
| Decision Logging | Decision + Reflection cards | Training signal + brain learning |
| Daily Synthesis | Briefing cards | Auto-generated, scheduled |
| Approval Queue | Decision cards (task subtype) | Pending approvals |
| Market Intelligence | Signal cards + Snapshot cards | Signals and visual data |
| Conversation History | Scroll Motion | The feed IS the history |
| Knowledge Ingestion | Clearing → Action cards | Ingest via clearing, confirmation in Motion |
| Commerce Integration | Signal cards | Revenue, conversion events |
| Behavioral Adaptation | Reflection cards | "I updated my rules" |
| Notepad / Thought Stream | Clearing | Freeform capture |
| Reports | Snapshot + Briefing cards | Generated on demand or scheduled |
| Content Publishing | Action cards | Draft and publish from Motion |
| Calendaring | Spawn cards | Events created from decisions |
| Enrichment | Action cards | Brain enriches, reports in Motion |
| CRM Data (Orgs/Contacts/Pipeline) | Snapshot cards | Compiled on demand, not static pages |

---

## 13. Next Horizon: Teams

Everything above is designed for one person — one brain, one motion, one clearing. The next horizon is a second user on the same brain.

### Why Teams Before Scale

Brigade-level orchestration (company playbooks, automated acquisition pipelines, industrial motion maps) requires proving that the brain can serve multiple people without losing coherence. Teams is not a scaling feature — it's the prerequisite that earns the right to peer around the scaling corner.

### What Teams Introduces

- **Multiple users, same brain.** Each person has their own Motion — their own feed of decisions, signals, and cards relevant to them. But the brain underneath is shared. It knows what everyone is doing.
- **Individual Motion stays individual.** Your decisions are yours. Your thought stream in the Clearing is yours. The brain doesn't broadcast your internal deliberation to the team.
- **Shared context emerges naturally.** When one person resolves a decision that affects another person's work, the brain surfaces that in the other person's Motion. Not because someone assigned it — because the brain understood the connection.
- **The Motion Map becomes shared.** The brain's operating logic isn't one person's anymore. It reflects how the company thinks. Multiple people's corrections and instructions shape it.

### Questions Teams Will Answer

These are unknowns we solve by building, not by designing upfront:

- When two people's corrections conflict, who wins? (The CEO? The most recent? The brain asks?)
- What shows up in MY motion versus what shows up in the TEAM's motion?
- Does the Clearing become a shared space, or does each person have their own?
- How does the brain decide which person should see a decision card?
- What does delegation look like in the feed? ("Brain, have Sarah handle the partnership follow-ups this week")

### Design Implications

Don't design for teams yet. Design the single-user experience so well that adding a second user is a natural extension, not a redesign. The card system, the Motion Map, the Clearing — all should be architecturally ready for multi-user without the UI needing to anticipate it.

The scaling vision — company motion maps, team clearings, industrial-scale automation — is real but earned. First: one brain, two people. See what happens.

---

## 14. Design Priority

| Priority | What to Design | Why |
|---|---|---|
| P0 | Motion layout + card anatomy system | This is the entire product |
| P0 | Decision card (steady-state) | Most common card type |
| P0 | CEO input + intelligence response flow | The conversational interaction |
| P0 | Calm state (resolved Motion) | The success state |
| P0 | Snapshot card — visual data compilation | Replaces all static pages |
| P1 | Action/spawn cards + visual connections | Generative feed behavior |
| P1 | Signal cards | Ambient intelligence |
| P1 | Briefing/report cards with actions | KPI reports, daily synthesis |
| P1 | Clearing — notepad + prep + ingestion | The thinking space |
| P2 | Minimal sidebar | Almost nothing in it |
| P2 | Training-phase decision cards | Internal calibration (rough is fine) |
| P2 | Entity context (inline/slide-over) | No separate pages |
| P2 | Reflection cards | Brain learning visibility |
| P3 | Motion Map | The brain's operating logic, CEO-facing |
| P3 | Engine Room — Integrations, Gophers | Status and monitoring |
| P4 | Engine Room — Users, Account | Traditional admin |

---

*Last updated: 2026-03-14*
