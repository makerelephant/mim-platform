# MiMBrain — Project Plan

> **Purpose:** Unified project plan tying together the 1 → 10 → 1,000 cadence, build phases, milestones, and success criteria. This is the single document that answers "what are we doing, in what order, and how do we know it's working."
>
> **Companion docs:**
> - `docs/technical/technical-roadmap.md` — detailed build tasks (B0-B5, F1-F5)
> - `docs/operational/master-effort-list.md` — all efforts/epics
> - `docs/operational/training-plan.md` — classifier training phases
> - `docs/product/ui-requirements.md` — interaction architecture
> - `docs/product/design-brief.md` — visual specs
>
> **Last updated:** 2026-03-14

---

## Company Cadence: 1 → 10 → 1,000

Everything we build maps to three numbers:

| Phase | What | Who | Success Looks Like |
|-------|------|-----|-------------------|
| **The 1** | Build Your Motion for the CEO | Mark (sole user) | CEO runs his entire operational life through the feed |
| **The 10** | Team of 10 shares parts of their Motion | Internal team | Shared brain underpins internal ops and execution |
| **The 1,000** | Regiment of efforts goes to market | Customers/users | Product in market, revenue, scaling |

**We are in Phase 1.** Everything else is horizon planning.

---

## Phase 1: The 1 (Current)

### Objective
One person — the CEO — operating entirely through Your Motion. The feed replaces email triage, CRM browsing, status checking, and decision-making workflows.

### Workstreams

#### Backend (Can start now)

| Step | What | Status | Depends On |
|------|------|--------|------------|
| B0 | Verify foundation (entity intelligence tables) | ✅ COMPLETE | — |
| B1 | Feed cards table + scanner integration | ✅ COMPLETE | B0 |
| B2 | Classifier training at scale | ✅ COMPLETE (accuracy endpoint + crons) | B1 |
| B3 | Daily synthesis loop | ✅ COMPLETE | B1 |
| B4 | Behavioral adaptation | ✅ COMPLETE (autonomy engine + reflection cards) | B2 + B3 |
| B5 | Knowledge ingestion enhancement | ✅ COMPLETE (emits feed cards) | B1 |

#### Frontend (Blocked on design)

| Step | What | Status | Depends On |
|------|------|--------|------------|
| F1 | Card system + Motion feed | ✅ COMPLETE | B1 (data) |
| F2 | Snapshotting | ✅ COMPLETE | F1 |
| F3 | Your Clearing | ✅ COMPLETE | F1 |
| F4 | Engine Room + Motion Map | ✅ COMPLETE | F1 |
| F5 | Page retirement | ✅ COMPLETE (old pages preserved, snapshots replace views) | F2 (verify coverage) |

#### Training (Parallel)

| Step | What | Status |
|------|------|--------|
| T1 | Volume ramp (100+ classifications/day) | 🔲 |
| T2 | CEO review cadence (daily 5-min review) | 🔲 |
| T3 | Harness refinement (rewrite dept MDs from corrections) | 🔲 |
| T4 | Confidence gating (auto-act on high-confidence categories) | 🔲 |

### Phase 1 Milestones

| Milestone | Definition of Done |
|-----------|-------------------|
| **M1: Feed exists** | `brain.feed_cards` table populated by scanners. API serves cards. |
| **M2: Feed is visible** | Motion feed renders cards in browser. CEO can act on decisions. |
| **M3: Training velocity** | 100+ items classified/day, CEO reviewing daily, per-category accuracy tracked |
| **M4: Brain is learning** | At least 3 categories hit 90%+ accuracy on 20+ reviews |
| **M5: Brain is autonomous** | High-confidence categories auto-acted without CEO review |
| **M6: Feed is life** | CEO's daily workflow runs through Motion. Static pages unused. |

### Phase 1 Exit Criteria
- CEO uses Motion as primary operational interface for 2+ weeks
- Classifier accuracy >85% across all active categories
- At least 2 categories operating autonomously
- Daily synthesis briefing running automatically
- Snapshotting replaces at least 3 former static page views

---

## Phase 2: The 10 (Horizon)

### Objective
Team of 10 shares parts of their Motion through the shared brain. Internal operations and execution powered by the platform.

### Prerequisites (from Phase 1)
- Motion feed stable and proven with single user
- Classifier confident across all categories
- Brain chat reliable for ad-hoc queries

### Key Builds
- **Multi-user auth** — team members get accounts
- **Publish/subscribe model** — each member has private Motion, publishes selected signals to shared brain (no RBAC — the feed IS the access control)
- **Shared brain context** — team signals feed into CEO's Motion
- **Role-based card routing** — brain routes cards to the right person

### Phase 2 Exit Criteria
- 10 users active on the platform
- Internal operations (tasks, decisions, signals) flowing through Motion
- CEO sees team activity as published signals in his feed
- No separate project management tool needed

---

## Phase 3: The 1,000 (Horizon)

### Objective
Product goes to market. The regiment of efforts that serves customers and users.

### Prerequisites (from Phase 2)
- Teams model proven internally
- Platform stable under multi-user load
- Brain reliable enough to serve external users

### Key Builds
- External onboarding flow
- Multi-tenant brain isolation
- Billing/subscription (Stripe integration)
- Person feed protocol (AI-native identity — see architecture v2, section 10)
- Customer support and success workflows

### Phase 3 Exit Criteria
- Paying customers
- Revenue
- Platform serving multiple independent organizations

---

## Guardrails

These apply to every decision at every phase:

1. **AI will be 1,000x smarter within 12 months.** Build for that world, not this one.
2. **Probabilistic, not deterministic.** Nothing we build should be inherited from the era of deterministic software.
3. **Every hire is 1 of 10.** Every person must be someone who gets us to a billion dollar company.
4. **Everyone must be in motion.** Us, our customers, our users — everyone.
5. **Don't design for a deterministic architecture that will no longer exist.**

---

## What We Are NOT Building (Phase 1)

- Multi-user / teams features (Phase 2)
- External-facing product (Phase 3)
- Creation tools (we're a gate, not a workshop)
- Static CRM pages (feed replaces everything)
- Mobile app (browser-first)
- Person feed protocol (design constraint only — don't build, don't block)

---

*Last updated: 2026-03-15*
