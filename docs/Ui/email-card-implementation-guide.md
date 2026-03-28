# Email Card Implementation Guide
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active implementation guide for email cards only
> **Last updated:** 2026-03-28

---

## Scope

This document applies to **email cards only**.

It is a simple implementation guide for building the email card UI now that backend email recovery has improved enough to support interface work.

**Recovery status:** the current card implementation now has visible thread-state chips, a recommendation band, a contextual action area, and a conversation toggle. Remaining work is about trust and behavior quality, not starting from zero.

---

## Card Structure

Build the email card in this order:

### 1. Header bar

Show:

- source icon
- tool / gopher identifier when available in the UI data
- thread-state chip
- timestamp
- permanent remove-from-feed control

Do not overload this row with extra text.

---

### 2. Participant line

Show:

- `On thread: Scott Johnson, Walt Doyle, Ben Howe`

Use plain language.
Do not use hidden semantic color coding that requires interpretation.

---

### 3. Main content

Show:

- title
- summary

The summary should be readable as plain English without opening the thread.

---

### 4. Recommendation band

Show:

- one recommendation sentence
- one context-appropriate CTA

This band should be visually distinct from the summary.

Keep it tight.
Do not make it oversized or mostly empty.

---

### 5. Conversation history toggle

If earlier thread history exists, show:

- `View earlier messages`

Do not label this as `thread context`.
Use human language only.

If the toggle is shown, expanding it must reveal actual earlier-message content. A dead toggle is worse than no toggle.

---

## Permanent Control

Every email card should always include:

- remove-from-feed / seen-it control

This is the one permanent control that should always be available.

---

## State-Aware Recommendation / CTA Behavior

The recommendation and CTA must change based on thread state.

They must never contradict visible thread state.

### Unread / active thread

Use when:

- no reply has been sent
- thread is active and awaiting CEO attention

Recommendation style:

- action-oriented
- direct

CTA examples depend on the design/Figma and recommendation logic. The key rule is that they must reflect the thread's current posture and not contradict visible state.

---

### Replied

Use when:

- CEO has already replied

Recommendation style:

- monitor
- wait
- track next response

Do not show:

- `Reply`

---

### Forwarded

Use when:

- thread has already been forwarded

Recommendation style:

- wait for recipient input
- track outcome

Do not show:

- `Reply`

---

### Draft exists

Use when:

- a draft response exists

Recommendation style:

- review draft
- decide whether to send

---

### Resolved / no action needed

Use when:

- thread is effectively complete
- no further CEO action is needed right now

Recommendation style:

- explicit closure

CTA examples:

- `Open thread`
- no CTA if unnecessary

Recommendation examples:

- `No action needed unless the thread changes`
- `Monitor only if counsel replies again`

If the design includes `Reply`, `Schedule`, or `Add to Tasks`, they must be justified by the recommendation and card state. `Remove from feed` remains the only permanent universal control.

---

## Non-Negotiable Rule

Do not show a recommendation or CTA that conflicts with the visible thread state.

Bad example:

- status: `Replied`
- recommendation: `Reply today`

That must never happen.

---

## Tone and Language

Use:

- plain English
- short labels
- conversational recommendation text

Avoid:

- system language
- internal classifier terms
- anything that feels like Gmail chrome copied into the product

---

## Timestamp Rule

Use:

- `5 hours ago`

Do not use:

- `5 Hours Ago...`

No ellipsis.
No title case.

---

## Summary of Build Requirements

The email card must deliver, at a glance:

1. what this email is
2. who is on the thread
3. what state the conversation is in
4. what the next step is
5. whether earlier messages can be viewed
