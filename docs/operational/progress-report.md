# MiMBrain — Progress Report

> **Date:** 2026-03-15
> **For:** Context when resuming on another machine

---

## Where We Are

All Phase 1 infrastructure is built and deployed. The platform has three working surfaces (Motion, Clearing, Engine Room), a Gmail scanner classifying live email, daily briefing synthesis, an autonomy engine, and now — correction learning, RAG/embeddings, and bulk email import.

**The system is ready to train.** The main activity now is: import historical emails, review the cards, and let the brain learn from corrections.

---

## What Got Built Today

1. **Correction Learning Pipeline** — When the CEO hits "No" on a card, it's no longer a dead end. The system fires `/api/brain/learn` which logs the correction type (wrong category, wrong priority, shouldn't exist), updates the card, and stores a structured correction summary in `knowledge_base` as institutional memory. The brain can reference past corrections during future classifications. Stats endpoint at `/api/brain/learn/stats` shows where the brain is weakest.

2. **Embedding & RAG Pipeline** — `src/lib/embeddings.ts` uses OpenAI `text-embedding-3-small` to convert text into 1536-dim vectors. New ingestion auto-chunks and embeds documents into `brain.knowledge_chunks`. The brain Q&A (`/api/brain/ask`) now does vector similarity search before keyword search, with deduplication. Backfill endpoint at `/api/brain/embed-backfill`. **Requires `OPENAI_API_KEY` in Vercel env vars to activate.**

3. **Bulk Email Import** — `/engine/import` page with controls for days-to-import and chunk size. Calls `/api/agents/gmail-bulk-import` in batches with progress bar, stats grid, and log. Uses existing scanner deduplication so it's safe to re-run.

4. **Missing Dependencies Installed** — `@anthropic-ai/sdk`, `googleapis`, `@slack/web-api`, `jszip`, `mammoth`, `pdfjs-dist`, `md5`. Build now compiles clean.

---

## Key Deficits Remaining

### Critical (blocks training quality)

- **No correction UI on the card itself.** The learning pipeline exists in the backend, but the FeedCard component currently only sends `ceo_action` (do/not_now/no). There's no modal or form that lets the CEO specify *what* was wrong (wrong category? wrong priority? shouldn't exist?) and provide the correct value. Without this, "No" is still a primitive rejection — the brain knows it was wrong but not *how*. **This is the #1 thing to build next.**

- **Hold/Not Now has no resurface mechanism.** The `resurface_at` column exists on `feed_cards` but nothing reads it. Cards dismissed with "Not Now" disappear forever. Need a simple cron or feed filter that re-surfaces them.

### Important (blocks memory)

- **`OPENAI_API_KEY` not in Vercel env vars.** RAG pipeline is built but inactive. Without it, brain Q&A falls back to keyword search only. Add the key in Vercel dashboard → Settings → Environment Variables.

- **No embeddings backfill has run.** Existing `knowledge_base` entries have no vector representations. Once the OpenAI key is set, hit `/api/brain/embed-backfill` (or set up a cron) to embed existing knowledge.

### Moderate (quality of life)

- **Card titles may not match email content accurately.** The Gmail scanner asks Claude to generate a card title and body from the classification. Sometimes these are too abstracted from the actual email. The CEO flagged this as a trust issue ("that better be correct"). May need to use email subject as title fallback or show the raw classification reasoning more prominently.

- **UI is functional but ugly.** All surfaces work but haven't been designed. User has said this is fine for now — design iteration comes after training validates the brain works.

- **Daily cron is once per day (Hobby plan limit).** Scanner only fires at 6am EST. Bulk import partially compensates, but real-time email processing would require upgrading Vercel to Pro.

- **Derived intelligence layer not built.** `brain.derived_insights` table doesn't exist. The brain can store and retrieve knowledge but doesn't yet discover patterns on its own (e.g., "Adidas engagement is increasing based on the last 5 emails").

---

## Immediate Next Steps (when you resume)

1. **Build the correction modal on FeedCard** — When CEO taps "No", show a quick form: What's wrong? (category / priority / shouldn't exist) → correct value → optional note. Wire it to the existing `/api/brain/learn` endpoint.

2. **Add `OPENAI_API_KEY` to Vercel** — Dashboard → Settings → Environment Variables. This activates the entire RAG pipeline.

3. **Run bulk import** — Go to `/engine/import`, set 30 days, start. This populates the feed with hundreds of cards to review.

4. **Review cards** — Do/Hold/No on each. With the correction modal, every "No" teaches the brain something specific.

5. **Check `/engine` → Brain Accuracy tab** — Watch per-category accuracy accumulate.

---

## File Inventory (new this session)

| File | Purpose |
|------|---------|
| `src/app/api/brain/learn/route.ts` | Processes CEO corrections, stores as institutional memory |
| `src/app/api/brain/learn/stats/route.ts` | Correction analytics (weakest categories, trends) |
| `src/app/api/brain/embed-backfill/route.ts` | Backfills embeddings for existing knowledge_base entries |
| `src/lib/embeddings.ts` | OpenAI embedding client with chunking and batching |
| `src/app/engine/import/page.tsx` | Bulk email import UI |
| `src/app/api/agents/gmail-bulk-import/route.ts` | Bulk import API (paginated scanner calls) |
| `sql/migration/step-16-rag-tables.sql` | knowledge_chunks, correspondence_chunks, search RPCs, feed_cards columns |

---

*The brain can now learn. It just needs reps.*
