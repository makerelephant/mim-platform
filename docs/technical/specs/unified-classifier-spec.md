# Unified Classifier Spec — In Motion Attention & Enrichment Engine
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic document. Solutions for deficits 1 and 2 in progress.
> **Last updated:** 2026-03-18

**Scope:** Gmail Gopher + Slack Gopher (unified pipeline)

> **Note on provenance:** This document consolidates and supersedes `docs/intel/intelligence-deficit-analysis.md`. The 10 intelligence quality metrics from that document are now fully incorporated in Section 2 of this spec. The deficit analysis should be treated as archived reference material. This document is the governing spec.

---

## 1. The Problem We Are Actually Solving

The current classifier does one thing: it decides whether an email or Slack message is worth processing. It passes or fails a pre-filter, then sends everything that passes to Claude for summarisation and task extraction.

The result is a feed that is technically functional and practically noisy.

The pre-filter removes newsletters and auto-replies. Everything else becomes a card. A thank-you message from a team member becomes a card. A scheduling confirmation becomes a card. A cold sales email that slipped through becomes a card. These are not failures of the pre-filter — they are failures of classification. The system has no model of CEO-specific relevance. It has no model of what a decision is versus an action versus a task. It has no model of when a task should actually be created.

Category accuracy — which the brain is currently being trained on — measures whether fundraising emails get labelled as fundraising. That is the floor metric. The ceiling is whether the feed feels like it is working. Those are different problems and only one of them is being solved.

**The cost of not solving this:**

If 20 cards surface per day and 40% are not worth the CEO's attention, that is 8 wasted attention units daily. Compounded across a week, the CEO is spending meaningful time processing noise the brain should have suppressed. More critically: if the brain is surfacing noise at volume, the CEO learns to treat the feed as a low-trust source. They start skimming. They start missing things. The trust problem is harder to recover from than the noise problem.

---

## 2. What Success Looks Like

These are the ten measurable properties of a working feed. Currently, only the first two are partially measured.

### 2.1 Signal-to-Noise Ratio
**Question:** What percentage of cards I see actually deserve my attention?

**Measurement:** `(Do + Hold) / (Do + Hold + No + Dismiss + Should Not Exist)` across all cards surfaced, tracked over time as a rolling 30-day rate.

**Current state:** Unmeasured. The `should_not_exist` checkbox exists in the Train panel but is never aggregated into this ratio.

**Target:** >80% of surfaced cards deserve attention. Below 60% the feed is broken.

**Why it matters most right now:** This is the single metric that determines whether the CEO trusts the feed. Everything else is downstream of this.

---

### 2.2 Priority Calibration
**Question:** When the brain says critical, is it actually critical?

**Measurement:** Do-rate by priority level. A well-calibrated brain would show critical cards at ~95%+ Do-rate, high at ~70%+, medium at ~40%+, low at ~20% or below. Override rate per priority level tracked via Train corrections.

**Current state:** Partially measured in the Engine Room Brain Accuracy tab. Priority correction rate is not yet captured.

**Target:** Critical cards wrong less than 10% of the time. Medium cards wrong less than 30% of the time.

---

### 2.3 Summary Quality
**Question:** Did the title and body actually tell me what I needed to know without having to expand?

**Measurement:** Card expansion rate — how often does the CEO open "More About This" to understand a card? A good summary makes expansion optional, not necessary.

**Current state:** Unmeasured. Expansion clicks are not tracked.

**Target:** Expansion rate below 25% for P0/S0 cards. If the CEO needs to expand more than 1 in 4 critical cards, the summary is failing.

---

### 2.4 Action Recommendation Quality
**Question:** Is the recommended action actually what I should do?

**Measurement:** Recommendation adoption rate — when the brain says "call them" and the CEO hits Do, did they actually follow the recommendation? Proxied by Do-rate per recommendation type. Direct measurement requires tracking post-action behaviour.

**Current state:** The `action_recommendation` field populates an amber banner. Never measured.

**Target:** Defined after first 100 cards with recommendations tracked.

---

### 2.5 Entity Resolution Accuracy
**Question:** Is the brain linking communications to the right people and organisations?

**Measurement:** Entity correction rate (requires a mechanism for CEO to flag wrong person or org). Entity coverage rate: what percentage of cards have a resolved entity versus orphaned.

**Current state:** No correction mechanism. Coverage tracked implicitly via classification logs.

**Target:** >95% entity accuracy on resolved cards. Coverage target: >70% of cards have a resolved entity.

---

### 2.6 Timeliness
**Question:** Am I seeing things when they matter, or after the moment has passed?

**Measurement:** Ingestion-to-surface latency. Gap between email/message timestamp and card `created_at`. Also: Hold cards that get dismissed when they resurface — a signal that the moment decayed.

**Current state:** `created_at` is stored. Source timestamp is stored. Gap is never computed.

**Target:** P0/S0 cards surface within 30 minutes of ingestion during active scan windows.

---

### 2.7 False Negative Rate
**Question:** What important things is the brain missing entirely?

**Measurement:** Periodic missed-item audit — a sample of pre-filtered messages shown to the CEO for spot-checking. Also: if the CEO manually triggers a scanner and gets cards they hadn't seen, that is a false negative signal.

**Current state:** Unmeasured. The CEO has no visibility into what the pre-filter killed.

**Target:** False negative rate below 5% for P0-equivalent items. This requires the audit mechanism to exist before it can be measured.

---

### 2.8 Card Type Accuracy
**Question:** Should this have been a Decision card or a Signal?

**Measurement:** Card type correction rate via Train panel. Currently captured as a correction but never aggregated.

**Current state:** Corrections exist. Aggregation does not.

**Target:** Card type wrong less than 15% of the time across all cards.

---

### 2.9 Deduplication Quality
**Question:** Am I seeing the same conversation as five different cards?

**Measurement:** Cards-per-thread ratio for Gmail threads. CEO "should not exist" corrections that reference duplicate content.

**Current state:** Thread consolidation exists for Gmail. Deduplication quality not measured.

**Target:** Thread produces at most one active card. Re-surfacing on new message is correct behaviour; spawning a new card is not.

---

### 2.10 Confidence Calibration
**Question:** When the brain says it is 85% confident, is it right 85% of the time?

**Measurement:** Calibration curve — bin cards by confidence decile, check Do-rate per bin. A well-calibrated system shows confidence ≈ approval rate.

**Current state:** Confidence stored. Calibration curve not computed.

**Target:** Confidence within ±15% of actual Do-rate per decile.

---

### The Compound Question

The feed is working when all of the following hold simultaneously:

| Metric | Target |
|--------|--------|
| Signal-to-noise | >80% of cards deserve attention |
| Priority calibration | Critical wrong <10%, medium wrong <30% |
| Summary quality | Expansion rate <25% on P0/S0 |
| Entity accuracy | >95% on resolved cards |
| False negative rate | <5% for P0-equivalent items |
| Timeliness | P0 surface within 30 minutes |

Category accuracy (the current training metric) is the floor. It must be >80% per category before the above metrics become meaningful to pursue. It is a prerequisite, not a destination.

---

## 3. The Unified Classifier Architecture

### 3.1 Core Principle

Every inbound communication — email or Slack — goes through one classification call that produces two distinct judgments:

1. **Attention outcome:** Should the CEO see this now, soon, later, or never?
2. **Operational enrichment:** Who and what is involved, what happened, and whether any decision, action, or task exists?

These are separate judgments. Attention relevance and task generation are related but not identical:
- A communication can be high attention without containing a task
- A communication can contain a task without being CEO-relevant
- Decisions should be extracted even when no task should be created
- Task creation should be conservative — tracking overhead is a real cost

### 3.2 Attention Classification

#### For Email
| Label | Meaning |
|-------|---------|
| `P0_ceo_now` | Surface immediately. CEO-specific consequence, decision, or relationship moment that materially worsens with delay. |
| `P1_ceo_soon` | Review within the day. CEO-relevant but not interrupt-level. Strategic awareness, relationship stewardship, important but not blocking. |
| `P2_delegate_or_batch` | Surfaces as a low-weight signal card. May matter to the company but not as direct CEO attention. |
| `P3_low_value_noise` | Suppressed entirely. Promotional, cold outreach, automated notifications, repetitive follow-up. |

#### For Slack
| Label | Meaning |
|-------|---------|
| `S0_interrupt_now` | Surfaces immediately as a decision card. Crisis, escalation, urgent executive decision, or blocker that worsens with delay. |
| `S1_review_soon` | Surfaces as an action card. Strategic signal, emerging risk, important opportunity, or leadership context. |
| `S2_batch_or_delegate` | Surfaces as a low-weight signal card. Company-relevant but not CEO-specific. |
| `S3_suppress_noise` | Suppressed entirely. Social chatter, reactions, repetitive updates, incidental commentary. |

#### CEO-Relevance Test (applied before assigning P0/S0 or P1/S1)
A communication is CEO-relevant only if at least one of the following is true:
1. Only the CEO can make or credibly make the decision
2. The sender's relationship to the CEO materially changes the value of the response
3. The topic has strategic, financial, legal, reputational, or existential significance
4. The issue is time-sensitive and delay meaningfully increases downside
5. The matter affects a top-tier stakeholder whose experience is CEO-sensitive
6. The communication materially changes the CEO's understanding of company reality

If none are true, default away from CEO priority.

#### Conservative Bias
False positives destroy executive attention. False negatives can be partially recovered via digests or delegate escalation. Therefore: do not elevate on weak evidence, require genuine CEO-specific relevance for P0/S0 and P1/S1, and use P2/S2 liberally when work belongs elsewhere.

**Early-stage calibration note:** The above conservative bias is written for a CEO with a functioning team. At the current company stage, the CEO is also often the operator, salesperson, and relationship manager. P2/S2 items should surface as signal cards rather than be routed to non-existent delegates. The P2/S2 → P3/S3 threshold should be loosened until a team exists to receive delegations.

### 3.3 Decision / Action / Task Ontology

Applied within the operational enrichment pass. These are the criteria that determine what kind of thing has been detected — not what priority it is.

**Decision** — A meaningful choice among alternatives with real consequences.
Qualifying criteria: presence of alternatives, consequence sensitivity, irreversibility, time pressure, information sufficiency, resource commitment, strategic alignment.
Disqualified when: no real alternatives exist, or the situation is routine execution dressed as a decision.

**Action** — Execution phase after a decision has been made (explicitly or implicitly).
Qualifying criteria: decision already exists, clear intent or objective, executability, causal impact, preconditions satisfied, clear owner.
Disqualified when: it cannot be executed as a single coherent outcome-linked step in reality.

**Task** — A discrete, bounded, ownable unit of work with a measurable done-state.
Qualifying criteria: discreteness, actionability without further decomposition, ownership, measurable completion, time relevance, coordination value.
Disqualified when: too granular (trivial overhead), too broad (should be a project), no owner, no urgency, no consequence if missed.

An action is not automatically a task. A task should only be created when tracking adds genuine coordination, accountability, or follow-through value.

### 3.4 Operational Enrichment

Performed in the same call as attention classification. Fields extracted:

**Entity resolution** — All entities referenced in the communication matched against the CRM database. Each entity carries: surface form, entity type, canonical name, canonical ID, match status (exact / probable / ambiguous / unresolved), match confidence score. Rules: prefer exact matches over inference, mark ambiguous rather than force resolution, return unresolved with surface form preserved rather than hallucinate a canonical ID.

**Summary sentence** — One sentence capturing what happened. Specific, not generic. Answers: what happened here, in plain English? Never returns "Message processed" or equivalent.

**Decision / Action / Task detection** — Boolean flags (`contains_decision`, `contains_action`, `contains_task`) plus structured extraction of each detected item with type, text span, owner, timing, and status.

**Action items** — Generated only when a concrete executable step exists that is relevant enough to preserve. Not generated for vague intentions, broad goals, completed steps, or informational statements.

**Task creation recommendation** — Separate from action item generation. Returns `should_create_task: true/false` with rationale, proposed title, proposed owner, proposed due date, and priority. A task is recommended only when: work is discrete and bounded, ownable, completion is observable, tracking adds coordination or accountability value, and the task is not trivial or duplicative.

### 3.5 Output Schema

```json
{
  "attention_class": "S1_review_soon",
  "relevance_score": 74,
  "subtypes": ["relationship_management", "strategic_opportunity"],
  "channel": "slack",
  "primary_reason": "...",
  "supporting_signals": ["..."],
  "disqualifiers_considered": ["..."],
  "recommended_handling": "...",
  "confidence": 0.89,

  "summary_sentence": "...",

  "entities": [
    {
      "surface_form": "...",
      "entity_type": "investor",
      "canonical_name": "...",
      "canonical_id": "...",
      "match_status": "exact",
      "match_confidence": 0.98
    }
  ],

  "contains_decision": false,
  "contains_action": true,
  "contains_task": false,

  "decisions": [],
  "actions": [
    {
      "description": "...",
      "owner": "CEO",
      "target_object": "...",
      "due_date": null,
      "status": "requested",
      "source_justification": "..."
    }
  ],
  "tasks": [],

  "task_creation_candidates": [
    {
      "should_create_task": false,
      "rationale": "...",
      "proposed_task_title": "...",
      "proposed_owner": "CEO",
      "proposed_due_date": null,
      "priority": "medium",
      "why_tracking_warranted": "..."
    }
  ]
}
```

### 3.6 Card Type Mapping

| Attention Label | Card Type | Surfaces |
|-----------------|-----------|----------|
| P0 / S0 | `decision` | Immediately, high visual weight |
| P1 / S1 | `action` | Immediately, standard weight |
| P2 / S2 | `signal` | Immediately, low visual weight |
| P3 / S3 | — | Suppressed, no card created |

### 3.7 Task Creation Gate

Task creation moves from automatic to gated:

**Current:** Claude produces action item → task written to `brain.tasks` automatically.

**New:** Claude produces `task_creation_candidates[]` with `should_create_task: true/false` → code writes task only when `should_create_task: true` AND attention class is P0/P1 or S0/S1.

P2/S2 items do not generate tasks regardless of `should_create_task`. P3/S3 items generate nothing.

---

## 4. Pipeline Architecture

### 4.1 Pre-processing (before the classifier call)

**Thread summarisation (Slack):** When a Slack message belongs to a thread, fetch the full thread and produce a thread summary first. Classify the summary, not the isolated message. One extra API call per threaded message.

**Feature vector computation (code, no API call):** Before the classifier call, compute in code:
- Channel type (founders / all-hands / random / direct)
- Sender role (investor / customer / team / unknown — from entity resolver)
- Mention status (direct @mention of CEO — boolean)
- Thread heat (reply count from Slack API)
- Stakeholder class (from org_types in CRM)
- Risk language presence (keyword detection)
- Decision language presence (keyword detection)

Pass this structured feature vector as context to the classifier. Reduces Claude's inferential load and anchors relevance scores on hard signals.

### 4.2 Classifier call

Single unified call per message. Assistant prefill (`{`) enforced to prevent markdown output. Returns the full output schema above.

### 4.3 Post-processing

- P3/S3: stop. Nothing written.
- P2/S2: emit signal card. No tasks. Minimal entity processing.
- P0/P1/S0/S1: emit card with full type mapping. Create tasks only where `should_create_task: true`. Write entities to correspondence and activity logs.

---

## 5. What This Effort Justifies

**The direct business case:**

The CEO's attention is the scarcest resource in the company. Every noise card that surfaces consumes a unit of that resource without returning value. At current estimated card volume (20–40/day across email and Slack once both scanners are running), a 40% noise rate means 8–16 wasted attention interactions daily. That is not a rounding error — it is a material drag on executive throughput.

More critically: a noisy feed trains the CEO to distrust it. Once trust is lost, the feed stops being used as a primary surface. It becomes something checked occasionally rather than relied upon. Recovering that trust is harder than building it correctly the first time.

**The counter-argument:**

The system is early. Volume is low. The CEO has tolerance for noise at this stage. Over-engineering the classifier before there is enough data to calibrate it risks building something that is too conservative and misses things.

**The resolution:**

The architecture in this spec is not more conservative. It is more principled. The P2/S2 labels still surface cards — they are not suppressed. The conservative bias applies at the P3/S3 boundary, which is where it should apply (cold outreach, noise, automation). The early-stage calibration note in section 3.2 explicitly loosens the P1/P2 boundary for the current phase.

What changes is not how much surfaces, but the quality of what surfaces and whether tasks are created thoughtfully rather than automatically.

**The measurement proof point:**

Build the compound metrics dashboard alongside this spec. Measure baseline SNR, priority calibration, and expansion rate before and after. If SNR improves from whatever the baseline is toward 80%+, the effort is justified. If it does not move, the classifier needs recalibration — but at least we will know, which is more than we know now.

---

## 6. Hard Questions

**Q: Will this actually make the feed better, or just different?**
A: Measurably better is the only acceptable answer. The SNR metric will tell us within two weeks of running the new classifier whether the noise rate improved. If it does not, we have the measurement infrastructure to diagnose why.

**Q: What is the minimum viable version?**
A: Replace the classifier prompt with the unified schema (sections 3.1–3.4). Gate task creation on `should_create_task`. Map card type from attention label. Do not build thread pre-summarisation or feature vector computation yet. That gets 80% of the value with 30% of the build.

**Q: What breaks during the transition?**
A: The parser changes significantly. Old cards in the feed were created with the old schema. New cards will be richer. There will be a period of mixed quality. The upsert logic we built means re-scanning existing messages will update cards in place.

**Q: What does the Slack digest mode require?**
A: A scheduled job that compiles S1 cards accumulated since the last digest into a single briefing-type card. This is a separate effort from the classifier itself. The classifier produces the S1 labels; the digest runner consumes them. Sequence: classifier first, digest runner second.

**Q: When is the brain ready to act autonomously on P3/S3?**
A: When the false negative rate audit (section 2.7) shows fewer than 5% of suppressed items were P0/P1 equivalent. Until that audit exists and passes, the CEO should be able to spot-check what is being suppressed.

**Q: How does this relate to the autonomy engine?**
A: The autonomy engine currently measures category accuracy per category and unlocks autonomous action when a category reaches 80%+ accuracy over 20+ reviews. This spec adds a second dimension: attention accuracy. A category can have high classification accuracy but poor attention calibration. Both need to qualify before that category earns full autonomy. The autonomy thresholds should eventually incorporate SNR per category, not just classification accuracy.

---

## 7. Build Scope

### This effort (Prompt Surface Layer)
- Replace classifier prompts in Gmail scanner and Slack scanner with unified schema
- Update parsers to read new output fields
- Gate task creation on `should_create_task`
- Map card type from attention label directly
- Update noise filter to use attention class rather than summary text heuristics
- Update `inferCardType` to consume attention label

### Next effort (Measurement Layer)
- Track card expansion clicks
- Aggregate `should_not_exist` into SNR metric
- Compute priority calibration curve
- Surface compound metrics in Engine Room

### Later efforts
- Thread pre-summarisation for Slack
- Feature vector pre-computation
- Digest mode for S1 items
- False negative audit mechanism
- Confidence calibration curve

---

*This document is the governing spec for the Prompt Surface Layer effort. It should be updated as calibration data becomes available and as company context (team size, investor list, customer tiers) matures.*
