# Intelligence Deficit Analysis
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active recovery document. Deficits remain largely uninstrumented in the live system.
> **Last updated:** 2026-03-28

---

## What We Measure Today

This document describes the correct measurement frame for the product. It should not be read as evidence that these measures are already implemented or trustworthy in production.

Email recovery work during March 28 materially improved the platform's ability to surface known-important correspondence and render it more credibly. That progress matters. It does **not** remove the need for the measurement frame below. The reason is simple: proving that several anchor threads now surface is not the same thing as proving that the feed is broadly trustworthy.

One thing: Did the brain put this email in the right bucket? (fundraising, partnership, product, etc.)

That's it. When you hit Do, we record "approved." When you hit No, we record "rejected." We compute approved / (approved + rejected) per category and call it "Brain Accuracy." When a category hits 90% with 20+ reviews, it earns autonomy.

This is like grading a newspaper by whether articles land in the right section — Sports, Business, Opinion — while ignoring whether the articles are any good.

---

## Dependency Structure

The 10 deficits below aren't a flat list. They have a layered structure that matters for sequencing fixes:

| Layer | Deficits | What it governs |
|-------|----------|----------------|
| **Engagement** | #1, #2 | Whether the CEO keeps using the feed at all |
| **Quality** | #3, #4, #6 | Whether what the CEO sees is actually useful |
| **Structural** | #5, #8, #9 | Whether the underlying data is clean |
| **Completeness** | #7, #10 | Whether the brain's coverage can be trusted |

Fix the engagement layer first. If noise is high or priority is miscalibrated, the habit breaks — and no amount of quality or structural improvement matters.

---

## The 10 Deficits

### 1. Signal-to-Noise Ratio
**"What percentage of cards I see actually deserve my attention?"**

Right now, every email that passes the pre-filter (not a newsletter, not an auto-reply) becomes a card. There's no measurement of whether the card was worth creating. The "should not exist" checkbox in the Train panel captures this — but we never aggregate it.

**Metric:** Cards worth seeing / total cards surfaced — measured through Do+Hold vs No+Dismiss rates, tracked over time.

**Proposed fix:** See Solutions section below.

---

### 2. Priority Calibration
**"When the brain says critical, is it actually critical?"**

The brain assigns critical/high/medium/low. We track whether the category was right but never whether the priority was right. A fundraising email correctly categorized but marked "critical" when it's actually low-priority is a failure we don't catch unless the CEO explicitly corrects it via Train.

**Metric:** Priority correction rate. CEO override rate per priority level. Do-rate by priority (critical cards should have near-100% Do rate — if they don't, priority is miscalibrated).

**Proposed fix:** See Solutions section below.

---

### 3. Summary Quality
**"Did the title and body actually tell me what I needed to know?"**

The card title and body are Claude-generated summaries. They could be vague, misleading, or miss the key point entirely. We have zero measurement of this. The CEO either clicks "More About This" (suggesting the summary wasn't sufficient) or doesn't.

**Metric:** Expansion rate — how often does the CEO need to expand a card to understand it? High expansion rate = poor summary quality. Also: time-to-action as a proxy (good summaries → faster decisions).

---

### 4. Action Recommendation Quality
**"Is the recommended action actually what I should do?"**

Every card has an `action_recommendation` field ("Call Walt Doyle back," "Review the term sheet," etc.). We show it in an amber banner. But we never measure whether the CEO follows the recommendation. It's decorative right now.

**Metric:** Recommendation adoption rate. When the brain says "Call them" and CEO hits Do — did they actually call? (Hard to measure directly, but we can at least track Do-rate per recommendation type.)

---

### 5. Entity Resolution Accuracy
**"Is the brain linking emails to the right people and organizations?"**

When a card says "This Fundraising conversation includes Walt Doyle" — is that correct? Wrong entity linking poisons everything downstream: the entity's dossier, the behavioral rules, the intelligence layer. We have zero measurement of entity accuracy.

**Metric:** Entity correction rate (requires a way for CEO to flag "wrong person/org"). Entity coverage (what % of cards have entities resolved vs. orphaned).

---

### 6. Timeliness / Relevance Decay
**"Am I seeing things when they matter, or after the moment has passed?"**

A critical email from 6 hours ago that surfaces after the CEO has already dealt with it is a waste of attention. We track `created_at` but never measure the gap between when something happened and when it appeared in the feed.

**Metric:** Ingestion-to-surface latency. Also: Hold cards that expire or get dismissed when they resurface (the moment passed).

**Recovery note (2026-03-28):** recent-window Gmail timeliness is materially better than it was before recovery work. Long-window backlog timeliness is still weaker and may require multiple passes, so this deficit remains open.

---

### 7. Completeness (False Negatives)
**"What important things is the brain missing entirely?"**

This is the hardest to measure and the most dangerous gap. The pre-filter kills newsletters, auto-replies, marketing. But what if it's killing something important? The CEO would never know because they never see it.

**Metric:** Periodic "missed item audit" — sample of filtered-out emails presented to CEO for spot-checking. Also: if the CEO manually triggers a Gopher and gets cards they hadn't seen, that's a false negative signal.

---

### 8. Card Type Accuracy
**"Should this have been a Decision card or a Signal?"**

We infer card type from priority and content (critical → decision, has action items → action, newsletter → signal). But the CEO might disagree. A Signal the brain thought was informational might actually require a Decision.

**Metric:** Card type correction rate via the Train panel (already captured, never aggregated).

---

### 9. Deduplication Quality
**"Is thread consolidation working — or am I seeing the same conversation as 5 different cards?"**

Thread consolidation exists but we never measure whether it's too aggressive (merging unrelated messages) or too loose (same thread spawning multiple cards).

**Metric:** Cards-per-thread ratio. CEO "should not exist" corrections that reference duplicate content.

**Recovery note (2026-03-28):** thread refresh and card updating are better than they were, but thread usefulness is still not fully proven because expanded history is incomplete and thread-state behavior can still be shallow.

---

### 10. Confidence Calibration
**"When the brain says it's 85% confident, is it right 85% of the time?"**

The classifier outputs a `goal_relevance_score` that becomes the confidence field. We store it but never check whether high-confidence cards actually get approved more often than low-confidence ones.

**Metric:** Calibration curve — bin cards by confidence, check Do-rate per bin. A well-calibrated brain would show confidence ≈ approval rate.

---

### 11. Category Drift *(added)*
**"Is the brain's understanding of a category keeping up with business context?"**

A "fundraising" email today is a very different thing at pre-seed versus Series A. The classifier knows the label but not where you are in the arc. As the business evolves, category definitions drift silently — the classifier keeps scoring against an outdated model of what matters.

**Metric:** Review corrections over time for systematic directional shift (e.g. fundraising rejection rate increasing month-on-month). Also: periodic harness doc review triggered by correction volume.

---

## The Real Question

Training volume for category accuracy is straightforward — 20 reviews per category, 11 categories, so ~220 minimum reviews to reach autonomy everywhere.

But the qualitative question is: when does the feed *feel* like it's working? That's a compound metric — and underneath it is one question: **does the feed reduce cognitive load, or add to it?**

The feed is working when:
- High signal-to-noise (>80% of cards deserve attention)
- Priority matches reality (critical things feel critical)
- Summaries are sufficient (low expansion rate)
- Entity links are correct (>95%)
- Nothing important is missed (false negative rate <5%)
- Cards appear in time to act on them

None of these are measured today. Category accuracy is the floor, not the ceiling.

---

## Solutions

### Deficit 1 — Signal-to-Noise Ratio

**The good news:** the data already exists. Do, Hold, No, Dismiss all encode the noise signal:
- `Do` or `Hold` = worth surfacing
- `No` = borderline
- `Dismiss` or "should not exist" (Train) = should not exist

**Step 1 — Compute it now.**
Create a "surfacing quality" score per card. Roll up per category per week. Show it in Engine Room alongside category accuracy. No new data collection needed — this can be built from what's already recorded.

**Step 2 — Close the loop into the Gopher.**
The Gmail Gopher prompt knows about categories but nothing about historical dismiss rates. Add a pre-prompt injection: *"In the [category] category, X% of cards have been dismissed. Err on the side of not creating a card unless the signal is clear."* The Gopher becomes less trigger-happy over time.

**Step 3 — Make the pre-filter learnable.**
Currently the pre-filter is rule-based (no-reply domains, newsletter keywords). It should accumulate Dismiss signals and expand its own exclusion set from CEO behaviour. Every Dismiss is a training signal for the pre-filter, not just the classifier.

**Key principle:** You don't need to explicitly measure SNR to improve it. You just need to make Dismiss consequential. Right now Dismiss removes a card from the UI but teaches nothing. It should teach the Gopher to be more selective.

---

### Deficit 2 — Priority Calibration

**The data already exists.** `priority` and `ceo_action` are on every card. Expected behaviour if the brain were well-calibrated:

| Priority | Expected Do+Hold rate |
|----------|-----------------------|
| Critical | ~90%+ |
| High | ~65%+ |
| Medium | ~35%+ |
| Low | <20% |

If critical cards are being dismissed at 40%, priority is broken. This is computable today.

**Step 1 — Add a Priority Calibration panel to Engine Room.**
For each priority level: (Do + Hold) / all actions. A single bar chart, four bars. The gap between expected and actual is the miscalibration signal. No new data collection needed.

**Step 2 — Feed Train corrections back into the Gopher.**
When the CEO corrects priority in the Train panel (already captured), inject that into the Gopher's next run: *"Emails of type [X] from category [Y] are typically [low priority], not [critical]."*

**Step 3 — Introduce a daily priority budget.**
This is the harder but more important fix. Right now priority is absolute — a fundraising email is always "critical" because of its category weight, regardless of what else is in the feed. Priority should be *relative to scarcity of attention*. The brain should aim to surface at most 2–3 critical cards per day. If more than that classify as critical, it should downgrade the least urgent ones. A CEO's attention has a budget. The brain should be made to manage it.

---

## Sequencing Recommendation

1. **Now:** Compute SNR and Priority Calibration from existing data — no new collection needed, just aggregation. Surface in Engine Room.
2. **Next:** Close the feedback loop — make Dismiss and Train corrections consequential inputs to the Gopher and pre-filter.
3. **Then:** Tackle the quality layer (#3 Summary, #4 Action Recs) once SNR and priority are stable.
4. **Later:** Structural (#5 Entity, #8 Card Type, #9 Dedup) and completeness (#7 False Negatives, #10 Confidence) layers.

Do not attempt to fix all 10 simultaneously. The engagement layer (#1, #2) must hold first.

---

*Document created 2026-03-17. Originated from CEO review of measurement gaps.*
