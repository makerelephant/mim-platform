# Feed Card Types

## Overview

The feed (Your Motion) displays 7 card types. Each card is a row in `brain.feed_cards` with a `card_type` field. Cards are the primary interface between the brain and the CEO — everything the brain wants to surface appears as a card.

## The 7 Card Types

### Decision

**When used:** The brain has identified something that requires CEO judgment — a choice between options, an approval, or a strategic call.

**Typical sources:** Investor communications, partnership proposals, large financial decisions, hiring decisions.

**CEO actions:** Do (approve/proceed), Hold (defer for later), No (reject).

### Action

**When used:** Something specific needs to be done. The brain has identified a concrete task with a clear next step.

**Typical sources:** Email follow-ups, meeting scheduling requests, document requests, deadline reminders.

**CEO actions:** Do (acknowledge and act), Hold (defer), No (not needed).

### Signal

**When used:** Information worth knowing about but not necessarily requiring action. Market intelligence, relationship updates, status changes.

**Typical sources:** News mentions, industry updates, relationship re-engagement opportunities (30+ days since last contact), sentiment shifts.

**CEO actions:** Noted (acknowledged), Dismiss (not relevant).

### Briefing

**When used:** Synthesized summary of activity over a time period. Generated automatically by the daily briefing cron job.

**Typical sources:** Daily briefing cron (7am EST) — synthesizes last 24 hours of classified emails and activity into a single narrative card.

**CEO actions:** Noted (acknowledged).

### Snapshot

**When used:** On-demand data visualization. When the CEO asks a question in Canvas that requires data, the brain queries the database and compiles results into a snapshot card in the feed.

**Typical sources:** CEO requests via Canvas ("Show me all fundraising activity this month", "What's the pipeline look like?").

**CEO actions:** Noted (acknowledged), Dismiss.

### Intelligence

**When used:** Deep analysis or insight that the brain has derived from ingested knowledge. Document summaries, competitive analysis, research findings.

**Typical sources:** Document ingestion via `/api/brain/ingest`, knowledge base processing, file uploads in Canvas.

**CEO actions:** Noted (acknowledged), Dismiss.

### Reflection

**When used:** The brain reflecting on its own performance or the state of the system. Autonomy milestone announcements, weekly synthesis, self-assessment.

**Typical sources:** Autonomy engine (when a category earns autonomous status), weekly synthesis agent, adaptation agent.

**CEO actions:** Noted (acknowledged).

## Card Type Selection Logic

Card types are determined by the Unified Classifier (`unified-classifier.ts`). The attention class drives the initial card type:

- **P0 (CEO Now)** / **S0 (Interrupt Now)** — Maps to `decision` or `action` depending on content
- **P1 (CEO Soon)** / **S1 (Review Soon)** — Maps to `action` or `signal`
- **P2 (Delegate/Batch)** / **S2 (Batch/Delegate)** — Maps to `signal` or `intelligence`
- **P3 (Low Value)** / **S3 (Suppress)** — Suppressed entirely (no card created)

The `inferCardType()` function in `feed-card-emitter.ts` makes the final determination based on attention class, presence of decisions/actions in the content, and the acumen category.

## Card Lifecycle

1. **Created** — Status: `unread`. Appears in the active feed.
2. **Read** — Status: `read`. CEO has seen it.
3. **Acted** — Status: `acted`. CEO has taken an action (Do/Hold/No/Noted). Card disappears from active feed.
4. **Dismissed** — Status: `dismissed`. CEO swiped away without acting. Counts as noise in signal-to-noise ratio.
5. **Archived** — Status: `archived`. System cleanup.

## Training Mode

Every card displays a Train button. When the CEO acts on a card (Do/Hold/No), the action is recorded as a CEO review. These reviews feed the accuracy tracking system and the autonomy engine. The brain learns from every interaction.
