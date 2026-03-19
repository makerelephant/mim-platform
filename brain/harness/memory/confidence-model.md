# Confidence & Accuracy Model

## Overview

The brain's accuracy is measured by CEO feedback on feed cards. Every card the CEO acts on (Do/Hold/No) becomes a data point. The accuracy system tracks performance at multiple levels: overall, per-category, per-card-type, and per-priority level.

## Accuracy Computation

Accuracy is computed by the `/api/brain/accuracy` endpoint, which queries all `brain.feed_cards` with `status = 'acted'` and a non-null `ceo_action`.

### Per-Category Accuracy

For each `acumen_category`:
- **Approved** = count of cards where `ceo_action = 'do'`
- **Rejected** = count of cards where `ceo_action = 'no'`
- **Held** = count of cards where `ceo_action = 'not_now'`
- **Accuracy** = `approved / (approved + rejected) * 100`

A category is flagged as `needs_attention` when `rejected > approved` and `total >= 3`.

### Overall Accuracy

Same formula applied across all categories combined.

### Per-Card-Type Accuracy

Broken down by the 7 card types (decision, action, signal, briefing, snapshot, intelligence, reflection), using the same approved/(approved+rejected) formula.

## Signal-to-Noise Ratio (SNR)

Measures what percentage of surfaced cards deserved the CEO's attention:

- **Worth seeing** = `approved (do) + held (not_now)` — held cards had value, just bad timing
- **Noise** = `rejected (no) + dismissed + should_not_exist corrections`
- **SNR** = `worth_seeing / (worth_seeing + noise) * 100`

Thresholds displayed in the UI:
- 80%+ = "Clean feed" (green)
- 60-79% = "Noise building" (amber)
- Below 60% = "Too much noise" (red)

## Priority Calibration

Measures whether the brain's priority assignments match reality:

For each priority level (critical, high, medium, low):
- **Justified rate** = `(do + not_now) / (do + not_now + no) * 100`
- Compared against targets:
  - **Critical:** Target >= 90% justified
  - **High:** Target >= 65% justified
  - **Medium:** Target >= 35% justified
  - **Low:** Target <= 20% justified (inverted — low-priority cards SHOULD be low value)

## Correction Tracking

When the CEO marks a card "No" with corrections (via the Train button), the system tracks:
- **Wrong category corrections** — Original category and what CEO corrected it to
- **Wrong priority corrections** — Original priority and what CEO corrected it to
- **Should not exist** — Cards that should never have been created
- **Notes** — Free-text CEO feedback

These corrections are stored in the `ceo_correction` JSON field on `brain.feed_cards` and processed by `/api/brain/learn`.

## Learning Pipeline

When corrections are submitted to `/api/brain/learn`:

1. **Decision log entry** — Every correction is logged to `brain.decision_log` with `ceo_override: true`
2. **Card update** — The card's category/priority is updated to the corrected value
3. **Institutional memory** — A knowledge_base entry is created tagged with `["correction", "learning", "institutional-memory"]`
4. **Behavioral rule synthesis** — Every 5th correction triggers `synthesizeRules()` from `behavioral-rules.ts`, which analyzes recent correction patterns and generates behavioral rules in `brain.behavioral_rules`
5. **Prompt injection** — Behavioral rules are loaded by scanners and injected into the classifier prompt, so the brain learns from its mistakes

## Milestone Tracking

The accuracy endpoint includes an M3 milestone check:
- **Daily volume target:** 100 cards per day
- **Accuracy target:** 85% overall
- **Categories above 90%:** Count of categories with 90%+ accuracy on 20+ reviews
