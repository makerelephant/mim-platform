# Autonomy Qualification Rules

## Overview

The autonomy engine allows the brain to self-govern categories where it has proven reliable. When a category earns autonomous status, the brain auto-approves cards in that category without requiring CEO review. This reduces the CEO's review burden while maintaining quality through ongoing accuracy monitoring.

## Qualification Criteria

A category earns autonomous operation when both conditions are met:

- **20+ CEO reviews** — The total count of Do + No actions on cards in that category
- **90%+ accuracy** — Calculated as `approved / (approved + rejected) * 100`

Hold (not_now) actions are counted toward the review total but don't affect the accuracy numerator or denominator — they indicate timing issues, not classification errors.

## How Autonomy Works

### During Email Scanning

The Gmail scanner (`gmail-scanner.ts`) calls `getAutonomousCategories()` from `autonomy.ts` at the start of each scan run. This returns a list of category slugs that have passed the threshold.

When a classified email falls into an autonomous category, the emitted feed card is immediately marked:
- `status: 'acted'`
- `ceo_action: 'do'`
- `ceo_action_note: 'Auto-approved: {category} has 90%+ accuracy'`

The card never appears in the active feed.

### Catch-Up Endpoint

`POST /api/brain/autonomy` runs the autonomy check across all existing unread cards. Any unread decision or action cards in autonomous categories are auto-acted. This catches cards created before inline autonomy was active.

When cards are auto-acted, a reflection card is emitted to inform the CEO what was auto-approved.

## Losing Autonomy

Autonomy is not permanent. If a category's accuracy drops below 90% (because the CEO marks auto-approved cards as "No"), the category loses autonomous status immediately. The next scanner run will see it's no longer in the autonomous list.

This creates a self-correcting loop:
1. Category earns autonomy at 90%+ accuracy
2. Brain auto-approves cards in that category
3. If any auto-approved card was wrong, CEO marks it "No"
4. Accuracy drops below threshold
5. Category loses autonomous status
6. Cards go back to manual review until accuracy recovers

## Reporting

The `/api/brain/autonomy` GET endpoint returns:
- **autonomous_categories** — Categories that currently qualify
- **approaching_categories** — Categories with 10+ reviews and 80%+ accuracy (close to qualifying)
- **all_categories** — Full list with stats sorted by review count

The Engine Room's Autonomy tab visualizes this data with progress bars and threshold indicators.

## Constants

Defined in `src/lib/autonomy.ts`:
- `AUTONOMY_THRESHOLD_REVIEWS = 20`
- `AUTONOMY_THRESHOLD_ACCURACY = 90`

## Current State

Autonomy infrastructure is fully built and operational. The blocking factor is training volume — categories need 20+ CEO reviews to qualify, which requires consistent daily use of the Do/Hold/No actions in Your Motion.
