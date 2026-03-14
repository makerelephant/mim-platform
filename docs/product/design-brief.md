# MiMBrain — Design Brief

> **Purpose:** Everything a designer needs to build the MiMBrain UI in Figma. Concrete specs, component definitions, screen inventory, and interaction details.
>
> **Companion doc:** `ui-requirements.md` — the philosophy, principles, and architecture. This brief is the actionable translation.
>
> **Status:** First draft. 2026-03-14.

---

## 1. Platform Summary

MiMBrain is a feed-first orchestration platform for CEOs. It has three surfaces:

| Surface | Purpose | Metaphor |
|---|---|---|
| **Your Motion** | Execution flow — decisions, signals, tasks, intelligence | The river |
| **Your Clearing** | Thinking space — notes, prep, ingestion | The campfire |
| **Engine Room** | Configuration — integrations, motion map, gophers | The plumbing |

There are no other pages. No CRM tables. No dashboards. No static views. Everything that would traditionally be a page is instead a **snapshot** — generated on demand into the feed.

---

## 2. Screens to Design

### Overview

| Screen | Priority | Notes |
|---|---|---|
| Your Motion (the feed) | P0 | The entire product. Multiple states needed. |
| Card anatomy system | P0 | Shared structure + type-specific variants |
| CEO input bar | P0 | Top of feed, always visible |
| Calm state (empty Motion) | P0 | The success state |
| Snapshot card (visual data) | P0 | Charts, pipelines, tables in-feed |
| Your Clearing | P1 | Notepad + prep + ingestion |
| Entity context (slide-over) | P2 | Opens from any entity link in a card |
| Sidebar (minimal) | P2 | 4 items + user profile |
| Engine Room: Motion Map | P3 | The brain's operating logic |
| Engine Room: Integrations | P3 | Connected services status |
| Engine Room: Gophers | P3 | Active automations |
| Engine Room: Users & Permissions | P4 | Standard admin |
| Engine Room: Account | P4 | Standard settings |
| Training-phase decision cards | P2 | Internal calibration — rough is fine |

---

## 3. Your Motion — The Feed

### Layout

- Full-width content area (no sidebar dominance — sidebar is minimal and can collapse)
- CEO input bar pinned to top
- Cards flow vertically, newest at top
- Scroll is infinite — resolved cards settle below, never disappear
- No pagination, no "load more" — continuous stream

### States to Design

1. **Active Motion** — mixed cards in the feed. Some pending, some resolved. A typical day.
2. **Dense Motion** — many cards, training phase or busy day. Demonstrates visual hierarchy when volume is high.
3. **Calm Motion** — no pending items. The success state. The feed is quiet.
4. **Query Response** — CEO has typed a question. Multiple intelligence cards are populating in response.
5. **Snapshot in Motion** — a visual data card (chart/pipeline/table) sitting in the feed alongside text cards.

### CEO Input Bar

- Position: pinned top of feed, always visible
- Appearance: single-line text input, expands on focus if needed
- Placeholder text: suggestive but not prescriptive (e.g., "Ask the brain anything...")
- No buttons needed — Enter to submit
- The input should feel inviting but not demanding. It's an open door, not a command prompt.

---

## 4. Card Anatomy System

### Common Structure (All Card Types)

Every card shares this skeleton. Type-specific content fills the middle.

**Card layout — top to bottom:**

| Zone | Content | Notes |
|---|---|---|
| **HEADER** | Type indicator (icon + label) on the left. Entity or source name in the middle. Urgency indicator on the right. | Single row. Compact. |
| **BODY** | Brain's summary or recommendation. 2-3 lines of text in collapsed state. | This is the primary content. Should be the most readable element. |
| **EXPAND TRIGGER** | Small chevron or "Show more" text link below the body. | Subtle. The card body itself should also be tappable to expand. |
| **ACTIONS** | Row of action buttons aligned at the bottom of the card. | Type-specific. See each card type for specific buttons. |

**Example — Decision Card (collapsed):**

> **HEADER:** `[brain icon] PARTNERSHIP` ... `FoundersEdge` ... `MED`
>
> **BODY:** Walt confirmed receipt of Jane's rev-share edits. Recommend confirming Walt accepted changes before sending final to Greg Raiz.
>
> **EXPAND:** *Show more v*
>
> **ACTIONS:** `[ Do ]` `[ No ]` `[ Not Now ]`

**Example — Decision Card (expanded):**

> *...same header and body as above, plus:*
>
> **REASONING:** The brain classified this as Partnership/Medium because Walt's "TY!" appears to be acknowledging Jane's edits on the FoundersEdge revenue share terms. Greg Raiz is waiting for the final version.
>
> **KEY FACTS:**
> - Jane sent 2 comments on the rev-share clause (Mar 10)
> - Walt has not confirmed he accepted Jane's changes
> - Greg Raiz last contacted: Mar 6
>
> **SOURCE:** *(collapsed by default — tap to show)*
> From: wd47west@gmail.com | Subject: Re: 2 quick things | Body: "TY!"
>
> **ENTITIES:** `[FoundersEdge]` `[Greg Raiz]` `[Walt Doyle]` *(tappable pills)*
>
> **ACTIONS:** `[ Do ]` `[ No ]` `[ Not Now ]`

### Three Visual States

| State | Appearance | When |
|---|---|---|
| **Active** | Full contrast, clear borders, actionable buttons visible | Card needs attention or is newly arrived |
| **Expanded** | Card grows to show full context, reasoning, source, entity links | CEO tapped expand |
| **Resolved** | Muted opacity, actions hidden or grayed, still readable | CEO acted on it or acknowledged it |

### Visual Urgency Tiers

| Tier | Visual Treatment |
|---|---|
| **High** | Accent color left border (warm — amber or red). Slightly larger card. Brain summary is bolder. |
| **Medium** | Standard card presentation. No special treatment. |
| **Low** | Starts collapsed to a single line. Muted by default. One-tap to confirm without expanding. |

### Card Connections

When a card spawned from another card (e.g., a task created from a decision), there should be a subtle visual connection. Not a literal line between cards — but when the spawn card is tapped or hovered, the parent card gets a subtle highlight. Consider:

- A small "spawned from" reference line in the card header
- A shared thread indicator (subtle vertical line or dot pattern on the left margin)
- When expanded, a "Related: [parent card summary]" link

---

## 5. Card Types — Specific Designs

### 5a. Decision Card

The most important card type. The brain classified something and needs the CEO's input.

**Header:** Category badge (e.g., "Partnership") + Entity name (e.g., "FoundersEdge") + Urgency indicator (High/Med/Low)

**Body (collapsed):** Brain's one-sentence recommendation. Pre-researched — includes the key context the CEO needs to decide. Examples:

- "Walt confirmed receipt of Jane's rev-share edits. Recommend confirming Walt accepted changes before sending final to Greg Raiz."
- "Newsletter from Chamath — no action needed. Auto-dismiss recommended."
- "New partnership inquiry from Wellesley Academy. Matches expansion criteria. Recommend creating evaluation task."

**Body (expanded):** Full context:

- Brain's reasoning (2-3 sentences on why this classification and recommendation)
- Key facts the brain checked (bullet points: "Jane sent 2 comments Mar 10", "Walt has not confirmed acceptance", "Greg last contacted Mar 6")
- Source content (the actual email, collapsed by default)
- Entity links (tappable: FoundersEdge, Greg Raiz, Walt Doyle)

**Actions — three buttons in a row:**

| Button | Label | What it does |
|---|---|---|
| Primary | **Do** | Accept the brain's recommendation. Brain executes. Card resolves. |
| Secondary | **No** | Reject. Reveals correction panel inline (see below). |
| Tertiary | **Not Now** | Card recedes visually (drops lower, goes muted). Returns tomorrow. No calendar UI. Just "later." |

**Correction panel (appears inline when "No" is tapped):**

The card expands to show a small correction form directly below the actions:

| Element | Type | Purpose |
|---|---|---|
| "Dismiss — not important" | Radio option | Quick dismissal |
| "Different category" | Radio option + dropdown | Override the brain's category |
| "Different action" | Radio option + single-line text input | Tell the brain what should happen instead |
| Submit button | Button | Confirms the correction, card resolves |

This correction panel is structured — radio buttons, not open text. The "different action" input is one line, not a text area. Quick, constrained, not a conversation.

### 5b. Action Card (Spawn Card)

Brain did something. This is a receipt + edit surface.

**Header:** Action type icon + "Created" / "Updated" / "Scheduled" + timestamp

**Body:** What happened. One line.

- "Created task: Confirm Walt accepted Jane's edits — due Mar 15"
- "Scheduled pipeline snapshot for every Monday 8 AM"
- "Drafted reply to Greg — review below"

**Actions:** Edit inline (change due date, assignee, content) / Undo / Acknowledge

**Expanded:** Shows the full item (task details, draft text, schedule config) editable in place.

### 5c. Signal Card

Ambient intelligence. The brain noticed something unprompted.

**Header:** Signal icon + Entity or topic + timestamp

**Body:** The observation. One to two lines.

- "Greg Raiz hasn't responded in 5 days. Last email: Mar 9."
- "3 partnership emails this week — up from 0 last month."
- "Revenue hit $40K this month — up 22% from February."

**Actions:** Expand for detail / Create task / Dismiss

**Note:** Signal cards should feel lighter than decision cards. They're informational, not demanding. Consider slightly smaller card size or a distinct visual treatment that says "FYI" not "act now."

### 5d. Briefing Card

Brain-authored synthesis. Daily, weekly, or monthly.

**Header:** Briefing icon + "Daily Briefing" / "Weekly Summary" + date

**Body (collapsed):** Top-line summary. 2-3 sentences.

- "This week: 14 decisions resolved, 3 new partnerships identified, revenue up 8%. 2 items need attention."

**Body (expanded):** Full report with sections, data, charts. This is where snapshot-style visual content may appear inside a card.

**Actions:** Share with team / Schedule meeting / Ask deeper questions — each spawns a new card.

### 5e. Snapshot Card

Visual data compilation. Charts, pipelines, tables, graphs — generated on demand from a CEO query.

**Header:** Snapshot icon + description of what was compiled + timestamp

**Body:** The visual. A chart, pipeline view, table, or graph rendered directly in the card. This is the key differentiator — snapshot cards are visual-primary, not text-primary.

**Expanded:** Larger/interactive version of the visual. Data tables behind the chart. Filters or breakdowns.

**Actions:**

| Button | What it does |
|---|---|
| **Iterate** | Opens the input bar pre-filled with the snapshot context, so the CEO can refine ("break this out by revenue stage") |
| **Schedule** | Set recurring generation ("every Monday at 8 AM") |
| **Share** | Spawns a share/draft card |
| **Pin** | Keeps this snapshot visible at the top of Motion (rare — most things are impermanent) |

### 5f. Intelligence Card (Query Response)

Generated when the CEO asks a question. Each piece of intelligence is its own card.

**Header:** Brain icon + topic reference + "In response to your query"

**Body:** One discrete fact or insight. 2-3 lines. Scannable.

**Expanded:** Full detail — sources, related entities, supporting data.

**Design note:** When the CEO asks a question, multiple intelligence cards arrive in sequence. They should feel like a set — maybe a subtle grouping indicator (shared left-border color or "1 of 4" indicator). But each card is independent and individually interactive.

**Example — CEO types: "get me up to speed on youth sports in mass"**

Four cards arrive in sequence:

> **Card 1:** You have a meeting with Alex Haney Thursday at 11:30 AM. He runs a multi-sport academy in Wellesley. `[Alex Haney]` `[v expand]`

> **Card 2:** Massachusetts youth soccer registrations up 14% YoY. Lacrosse flat. Hockey declining. `[v expand]`

> **Card 3:** You spoke with Walt about CityKids two days ago — community engagement play. Could be relevant to Alex's model. `[CityKids]` `[Walt Doyle]` `[v expand]`

> **Card 4:** FoundersEdge has a portfolio company in youth fitness. Greg Raiz mentioned it in January. Potential overlap with Alex's academy. `[FoundersEdge]` `[Greg Raiz]` `[v expand]`

Each card has entity pills that are tappable. Each expands independently for deeper detail.

### 5g. Reflection Card

Brain showing its own learning.

**Header:** Brain icon + "Learning Update" + timestamp

**Body:** What the brain learned and changed.

- "You've corrected me on partnership classifications 4 times this week. I've updated my category boundaries. Here's what changed."

**Actions:** Acknowledge / Review rule changes / Revert

**Design note:** These should feel warm and transparent. The brain is showing vulnerability — "I was wrong, I learned." The visual tone should reinforce trust.

---

## 6. Your Clearing

### Layout

The Clearing should feel visually distinct from Motion. Motion has energy, flow, cards arriving. The Clearing should feel still. Spacious. Like you walked away from the river and sat down.

**Core elements:**

- A large text area for thought stream / notepad — freeform, no formatting toolbar, just text
- A drop zone for file ingestion — drag and drop files, images, documents
- A brain input — same as Motion's input but contextual to the Clearing. "Help me think through the board meeting" triggers brain responses that appear IN the Clearing, not in Motion
- Active clearing sessions — the CEO may have multiple in-progress sessions (board prep, quarterly planning, market research). These should be accessible but not cluttered.

### States to Design

1. **Empty Clearing** — first visit. Inviting, open, spacious. Suggests what you might do here.
2. **Active Clearing** — notes accumulating, a few files dropped in, brain has responded with some context cards. The war room table with things spread out on it.
3. **Clearing with brain context** — CEO asked for help with board prep. Brain has laid out related data, recent decisions, KPIs. The CEO is reviewing before going to Keynote to build the deck.

### Design Principles

- **Stillness.** The Clearing doesn't refresh, doesn't auto-update, doesn't push cards. It's static until the CEO acts.
- **Space.** Generous whitespace. This is not a dense information surface. It's a place to think.
- **Warmth.** Slightly different color temperature from Motion. Warmer — like firelight versus daylight.

---

## 7. Sidebar

### Layout Description

The sidebar is a narrow, dark column on the left. Top to bottom:

| Position | Element | Notes |
|---|---|---|
| **Top** | MiMBrain logo | Brand anchor |
| **Upper section** | "Your Motion" nav item (with icon) | Active state = filled indicator + highlight background |
| | "Your Clearing" nav item (with icon) | Inactive state = dimmed text, no background |
| **Large empty space** | Nothing | Intentionally empty. This IS the calm. |
| **Lower section** | Engine Room (gear icon) | Visually separated from the primary surfaces |
| **Bottom** | User avatar, name, role, log out button | Same style as current design |

**Key rules:**
- Active state clearly indicated (filled dot, highlight, or background change)
- Collapsible — on narrow screens or by user preference, collapses to icons only
- **No badges, no counts, no notification indicators.** This is intentional — see emotional design principle 6a (Decision License Without Anxiety).
- The large empty space between the nav items and Engine Room is deliberate. The sidebar should feel spacious, not packed.

---

## 8. Engine Room

### Motion Map

The centerpiece of the engine room. The CEO's view of how their brain thinks.

**Layout concept:** A visual representation of the brain's classification logic. Not a settings form — a map. Consider:

- Category cards arranged spatially, showing the classification taxonomy
- Each category expandable to show: rules, examples, learned patterns, accuracy
- Standing orders listed separately — these are the CEO's explicit instructions to the brain
- Entity-level overrides visible — "FoundersEdge: always medium minimum"
- Learned patterns — corrections the brain has absorbed, shown as behavioral rules

**Key design challenge:** This needs to feel like a living document, not a settings page. The Motion Map is the brain's personality made visible. It should feel organic, not mechanical.

**States:**

1. **Overview** — all categories visible, accuracy indicators, standing orders
2. **Category detail** — expanded view of one category. Rules, examples, recent corrections, accuracy trend
3. **Standing orders** — list of explicit CEO instructions. Editable.
4. **Learning history** — timeline of behavioral changes. "Mar 12: Updated partnership boundary after 4 corrections."

### Integrations

Standard status dashboard. Connected services, last sync time, error states, connect/disconnect buttons.

### Gophers

Active automations list. Each gopher shows: name, what it does, last run, status (running/paused/error), run history.

### Users & Permissions

Standard admin table. Users, roles, access levels. Add/remove/edit.

### Account

Standard settings. Profile, company info, billing.

---

## 9. Entity Context (Slide-Over)

When any entity link is tapped in any card (org name, contact name), a slide-over panel appears from the right WITHOUT leaving the current view.

**Contents:**

- Entity summary (name, type, key details)
- Relationship context (how the CEO knows them, who introduced them)
- Recent correspondence (last 5-10 interactions, with timestamps)
- Open tasks related to this entity
- KCS (Knowledge Completeness Score) — how well the brain knows this entity
- Entity-level brain rules (standing orders, importance overrides)

**Design note:** This should feel like pulling a dossier from a filing cabinet and glancing at it — quick, contextual, dismissable. Not a full page navigation.

---

## 10. Training-Phase Decision Cards

For internal calibration only. Don't over-design.

**Differences from steady-state decision cards:**

- Higher volume — every classified email gets a card
- May include open text input field for richer training signal
- Bulk operations — "Confirm all 12 low-importance dismissals" batch button
- Accuracy counter visible — "Brain accuracy this session: 78% (14/18)"
- Structured correction more prominent — category dropdown + importance radio + text input always visible, not hidden behind "No"

**Design approach:** Utilitarian. Form-like. Optimized for speed and accuracy of training input, not for emotional experience. This UI will be deprecated.

---

## 11. Visual Language & Tone

### Overall Feel

- **Clean, not clinical.** Warm enough to feel personal, structured enough to feel professional.
- **Spacious.** Generous padding, breathing room between cards. The platform should never feel cramped.
- **Confident.** The brain's voice should feel authoritative but not arrogant. Recommendations stated clearly, not tentatively.
- **Calm.** Even when there are many cards, the visual hierarchy should create calm through clear priority signals. High-importance cards stand out; everything else recedes.

### Color Direction

- Primary surface: light, neutral (the feed is content, not the frame)
- Sidebar: dark (consistent with current design — provides anchoring)
- Urgency: warm accent (amber/orange for high, neutral for medium, no color for low)
- Brain voice: consider a subtle visual indicator that distinguishes the brain's words from source content (light background tint, subtle icon, or typography shift)
- Clearing: slightly warmer tone than Motion — different headspace, different light
- Resolved cards: reduced opacity or desaturated — present but not demanding

### Typography

- Card headers: medium weight, slightly smaller than body
- Brain recommendations: regular weight, standard size — this is the primary content
- Source content (expanded): slightly smaller, lighter color — supporting, not dominant
- Entity links: visually distinct (underline, color, or pill/chip style) — tappable
- CEO input: standard input styling, comfortable to type in

### Iconography

- Card type indicators: simple, consistent icon set. Brain icon for intelligence/reflection. Task icon for actions. Signal icon for ambient cards. Chart icon for snapshots.
- Urgency: color-based, not icon-based. Don't add warning triangles or exclamation marks — those create anxiety.
- Expand/collapse: minimal chevron or similar. Not prominent — the card body itself should invite tapping.

---

## 12. Responsive Considerations

- **Desktop-first.** This is a CEO's operational tool. Primary use is desktop/laptop.
- **Tablet:** Feed works naturally in single column. Clearing works as full-screen. Sidebar collapses.
- **Mobile:** Read-only feed is useful (scan cards on the go). Input and Clearing interactions are desktop-primary.
- **Sidebar collapse:** On narrow viewports, sidebar should collapse to icon-only rail or hamburger menu.

---

## 13. Interaction Inventory

Every interaction the CEO can take, listed for completeness:

| Interaction | Where | What Happens |
|---|---|---|
| Type a query | Motion input bar | Brain responds with cards in the feed |
| Tap Do on decision card | Motion | Brain executes recommendation, card resolves |
| Tap No on decision card | Motion | Correction panel appears inline |
| Tap Not Now on decision card | Motion | Card recedes, returns later |
| Expand a card | Motion | Card grows to show full context |
| Collapse a card | Motion | Card returns to 2-3 line summary |
| Tap entity link in any card | Motion | Entity slide-over opens from right |
| Edit an action card inline | Motion | Modify task due date, assignee, content |
| Tap Undo on action card | Motion | Reverses the brain's action |
| Iterate on a snapshot | Motion | Input bar pre-fills with snapshot context |
| Schedule a snapshot | Motion | Brain confirms with action card |
| Share a briefing/snapshot | Motion | Share draft card spawns |
| Scroll down in Motion | Motion | See resolved cards, day's history |
| Type a note | Clearing | Text captured, brain absorbs |
| Drop a file | Clearing | Brain ingests into institutional memory |
| Ask brain in Clearing | Clearing | Brain responds within Clearing context |
| Open Motion Map | Engine Room | See brain's full operating logic |
| Edit a standing order | Engine Room | Direct edit, brain acknowledges |
| Switch between Motion/Clearing | Sidebar | View changes, context preserved |

---

## 14. What NOT to Design

- No org/contacts/pipeline pages (these are snapshots now)
- No reports page (briefing and snapshot cards in Motion)
- No intelligence page (query responses in Motion)
- No activity log page (Motion IS the activity log)
- No knowledge page (ingestion happens in Clearing, recall happens via brain query)
- No sentiment page (signal cards in Motion)
- No notification system (Motion IS the notification surface)
- No search page (the input bar IS search)
- No onboarding wizard (future consideration — not for v1)

---

*Last updated: 2026-03-14*
