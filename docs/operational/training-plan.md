# MiMBrain — Acumen Training Plan

> **Purpose:** Define how we train the brain's classifier to earn autonomy. Training is internal calibration, not a product feature. Design for speed, not beauty.
>
> **Companion docs:**
> - `docs/technical/architecture-mimbrain-v2.md` — autonomy layer design
> - `docs/operational/harness-scope-email-categories.md` — the 11 categories being trained
> - `docs/product/ui-requirements.md` — Section 11 (Training Phase)
>
> **Last updated:** 2026-03-14

---

## What We're Training

The Acumen classifier reads incoming emails and assigns:
1. **Category** — one of 11 business categories (Legal, Customer/Partner Ops, Accounting & Finance, Scheduling, Fundraising, Product/Engineering, UX & Design, Marketing, AI, Family, Administration)
2. **Importance level** — high, medium, or low
3. **Reasoning** — why the brain chose this category and importance

The CEO reviews each classification and marks it correct, incorrect, or partial. If incorrect, the CEO provides the correct category and/or importance.

---

## Current State

- Gmail scanner operational, classifying with Acumen categories
- `brain.classification_log` captures category, importance, reasoning per email
- `/decisions` page allows CEO review (correct/incorrect/partial)
- `/api/decisions/review` endpoint updates review data
- Volume: low (ad hoc scanner runs, ~5-10 emails per run)

---

## Training Phases

### Phase 1: Volume Ramp (Current → 200 reviewed decisions)

**Goal:** Get enough data to measure per-category accuracy.

**Actions:**
- Run Gmail scanner daily (manual trigger or scheduled)
- CEO reviews all pending classifications via `/decisions` page
- Target: 200 reviewed decisions across all 11 categories

**Metrics to track:**
- Total decisions reviewed
- Per-category accuracy (correct / total per category)
- Per-importance-level accuracy
- Common misclassification patterns (category A mistaken for category B)

**UI needs:** The existing `/decisions` page is sufficient. Add a stats section showing per-category accuracy counts.

### Phase 2: Harness Refinement (200 → 500 reviewed decisions)

**Goal:** Fix systematic errors by updating harness rules.

**Actions:**
- Identify categories with <80% accuracy
- Review misclassified examples to find pattern
- Update classifier rules in `brain/pipelines/email-classification/` to address confusion
- Re-run scanner on previously misclassified emails to verify improvement
- Update department docs in `brain/departments/` if domain knowledge is missing

**Metrics to track:**
- Per-category accuracy trend (should improve after harness edits)
- Confusion matrix (which categories get confused for which)
- Importance accuracy separately from category accuracy

### Phase 3: Confidence Gating (500+ reviewed decisions)

**Goal:** Earn partial autonomy on high-accuracy categories.

**Actions:**
- Compute confidence score per category: rolling accuracy over last 50 decisions
- Set autonomy threshold (e.g., 90% accuracy over 50 decisions)
- Categories above threshold: brain can auto-execute low-risk actions (create tasks, log correspondence)
- Categories below threshold: continue requiring CEO review
- Decision log records whether each action was auto-executed or CEO-approved

**Graduation criteria per category:**
- ≥90% accuracy over last 50 reviewed decisions
- ≥85% importance-level accuracy
- Zero "incorrect" reviews in last 10 decisions

### Phase 4: Behavioral Adaptation (Ongoing)

**Goal:** Brain learns from corrections automatically.

**Actions:**
- System identifies repeated correction patterns (e.g., CEO always changes Marketing → Product/Engineering for emails about landing pages)
- Brain proposes harness rule updates to CEO
- CEO approves or rejects proposed changes
- Approved changes written to harness files automatically

---

## Training UI Requirements

Training is temporary — it exists to calibrate the brain, then largely disappears. Design for speed.

### During Training (Phase 1-2)

The existing `/decisions` page handles this. Enhancements needed:

- **Stats bar** at top: total reviewed, overall accuracy %, per-category breakdown
- **Speed** is critical: one-tap correct, two-tap incorrect (tap incorrect → dropdown for correct category)
- **Batch mode**: show 5-10 cards at once, keyboard shortcuts for rapid review (Y = correct, N = incorrect, S = skip)
- **Filter**: show only unreviewed, or filter by category

### During Steady State (Phase 3+)

- Training UI largely deprecated — only surfaces when brain encounters low-confidence or novel patterns
- Occasional review requests appear as Decision cards in the feed ("I classified this as Marketing/Medium — does that seem right?")
- Monthly accuracy report card in the feed as a Briefing card

---

## Data Requirements

| Metric | Where it lives | How to compute |
|--------|---------------|----------------|
| Category accuracy | `brain.classification_log` | `COUNT(ceo_review_status = 'correct') / COUNT(ceo_review_status != 'pending')` per `acumen_category` |
| Importance accuracy | `brain.classification_log` | Same but for `importance_level` vs `ceo_correct_importance` |
| Confusion pairs | `brain.classification_log` | `GROUP BY (acumen_category, ceo_correct_category) WHERE ceo_review_status = 'incorrect'` |
| Rolling confidence | `brain.classification_log` | Last 50 reviewed per category, ordered by `ceo_reviewed_at` |

---

## Success Criteria

Training is "done" when:
- All 11 categories have ≥50 reviewed decisions
- Overall accuracy ≥85%
- At least 3 categories have graduated to autonomous execution
- CEO reports that review volume has meaningfully decreased

Training is never truly finished — but it transitions from active calibration to passive monitoring.

---

*Last updated: 2026-03-14*
