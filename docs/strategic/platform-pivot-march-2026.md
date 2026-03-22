# Platform Pivot: From Correctness to Contextual Suggestion
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Active strategic decision. Governs all near-term development.
> **Last updated:** 2026-03-21

---

## The Decision

The In Motion platform is pivoting from a **zero-tolerance correctness model** to a **highly contextual suggestion model**. This is a fundamental shift in how the brain presents itself to the CEO.

### What's Changing

**Before (current):** The brain classifies every email/message into 11 Acumen categories, assigns P0-P3 priority, determines a card type (Decision/Action/Signal), and presents Do/Hold/No action buttons. Every wrong classification erodes trust. The bar is impossibly high for a system with insufficient training data.

**After (target):** The brain suggests an **intent** — what the CEO should do next with this information:

| Intent | Meaning |
|--------|---------|
| **Read** | This needs your attention — review it |
| **Respond** | This requires a reply or acknowledgment |
| **Write** | This needs you to draft or create something |
| **Schedule** | This needs a meeting, call, or calendar action |

These four intents are:
1. **Much easier for the model to infer correctly** — intent from an email is far more reliable than business-context classification
2. **Much less damaging when wrong** — suggesting "Read" when it should be "Respond" has near-zero cost
3. **Still useful at low accuracy** — a 70% accurate suggestion system is helpful; a 70% accurate autonomous action system is dangerous

### What's NOT Changing

The backend intelligence continues to mature:
- **Acumen categories** — still tagged on every card, still feeding the harness
- **Embedding/RAG pipeline** — still learning, still building permanent memory
- **Classification log** — still recording every classification for training
- **Behavioral rules** — still adapting from CEO corrections
- **Autonomy engine** — still earning trust (20+ reviews, 90%+ accuracy per category)
- **Decision log** — every CEO action logged for institutional learning

The intent suggestions are **additive, not destructive**. The classifier still does its full job behind the scenes. The user-facing experience simply changes from "I know what this is" to "Here's what I think you should do next."

---

## The Prerequisite: Foundation Excellence

Before shipping the intent suggestion UI, the platform foundation must be bulletproof. **The suggestion model only works if the brain actually knows everything.** Suggesting actions on incomplete understanding is worse than the current system.

### Six Requirements for Foundation Excellence

1. **Zero-breakage ingestion** — Every format (PDF, DOCX, PPTX, XLSX, TXT, CSV, images) must ingest reliably with retry logic. No silent failures. No partial processing. If something breaks, the user must know immediately.

2. **Full-body comprehension** — The brain must read, classify, and understand the **entirety** of every document submitted. Not the first 3,000 characters. Not a summary of the first page. The WHOLE BODY OF DATA. A 50-page financial model must be understood end-to-end.

3. **Complete storage — all or nothing** — The brain either processes and stores everything, or nothing at all. Anything in between has zero value. Partial comprehension is worse than no comprehension because it creates false confidence.

4. **Permanent memory** — Knowledge persists beyond sessions, permanently. The brain may take 10-15 seconds to load context at session start if needed. That is acceptable. Forgetting something submitted 10 minutes ago is not. Ever.

5. **Impeccable recall** — If the user says "I submitted X last session," the brain must recall it — from chat history, from embeddings, from knowledge base, from any source. This must work naturally and completely. Binary: it either works or it's a zero.

6. **Entity resolution depth** — All inbound data must be classified with excellent entity, contact, and object linking. Fuzzy matching, alias resolution, relationship inference. Even probability-based linking is acceptable. No linking is not.

---

## Build Order

The implementation sequence:

### Phase A: Foundation ✅ COMPLETE (March 21, 2026)
1. **Full-body comprehension pipeline** — ✅ Scanner reads full email bodies (8K chars), web intelligence expanded similarly
2. **Bulletproof recall** — ✅ 7-day guaranteed recall, lower vector thresholds (0.18), wider result nets (15/12), keyword fallbacks across title+summary+tags, feed card search
3. **Entity resolution depth** — ✅ Fuzzy Levenshtein matching, first/last name partials, email prefix/domain matching, acronym detection, rich dossiers with relationship context

### Phase A.5: Natural Language UI ✅ COMPLETE (March 21, 2026)
4. **MessageCard — clean natural language cards** — ✅ No classification chrome, gopher icons, intent icons (respond/read/write/schedule), entity highlighting, tappable to source
5. **Gmail bidirectional integration** — ✅ Auto-resolve on CEO reply, Actions API (Reply/Draft/Archive/Star), Figma-accurate thread status chips (Replied/Forwarded/Archived/Draft/Starred with icons + semantic colors), brain-generated draft replies
6. **Note-taking feature** — ✅ Write button → NotePanel, save to knowledge with embeddings, feed card emission
7. **Sidebar + feed refresh** — ✅ Redesigned per Figma 94:4010, accurate refresh timer

### Phase B: Training Redesign + Intent Suggestion UI (Next)
8. **Implicit training from every interaction** — Dismissals → negative signal, tap-throughs → positive signal, simple Yes/No replaces category dropdowns
9. **Card action pivot** — Replace Do/Hold/No with Read/Respond/Write/Schedule intent buttons
10. **Card layout update** — Redesign card actions to present intent suggestions prominently
11. **Feed PATCH handler update** — Record intent selections as training data

### Phase C: Continuous Improvement
11. **Intent accuracy tracking** — Measure how often CEO follows the suggested intent
12. **Intent refinement** — As accuracy improves, allow more specific sub-intents
13. **Gradual autonomy** — Proven intents execute automatically (e.g., auto-scheduling obvious meeting requests)

---

## What This Means for Development

- **No more optimizing card type inference logic** — the current Decision/Action/Signal taxonomy stays but becomes a backend classification, not a user-facing promise
- **No more agonizing over Acumen category accuracy** — categories are training data, not user-facing labels
- **Priority shifts to data pipeline quality** — ingestion, comprehension, storage, and recall are the entire product now
- **The brain's value proposition changes** — from "I decided for you" to "I understand everything and here's what I suggest"

---

## Key Principle

> The death of this product is when data is submitted and it cannot be recalled, or is incomplete in its recollection. This is binary — you either process and store it all or none at all. Anything in between has zero value.

— Mark Slater, March 20, 2026
