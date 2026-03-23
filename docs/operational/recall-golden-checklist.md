# Recall golden checklist (manual regression)
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC  
> **Status:** Operational QA list until automated golden tests exist.  
> **Last updated:** 2026-03-22

Run after changes to `/api/brain/ingest`, `/api/brain/ask`, `search-memory`, or embedding configuration.

1. **Upload** — Drop a medium PDF and a `.txt` in Canvas; confirm API JSON has `embed_ok: true` and no `warnings` containing `vector_embed_failed`.
2. **Empty / bad file** — Upload an empty or clearly broken file; expect HTTP **422** with `no_extractable_content` (not silent success).
3. **Canvas Q&A** — Ask a question that depends only on prior session context; confirm a new `knowledge_base` row with `source_type: clearing_turn` and chunks in `brain.knowledge_chunks` (Supabase).
4. **Hybrid fallback** — Ask using unusual wording about a known doc; confirm answer still cites content (keyword-assisted section may appear in raw context if vector match was weak).
5. **Gmail path** — After a scan, confirm `correspondence_chunks` exist for a new message; activity should not flood when `MEMORY_INDEX_ACTIVITY_SUCCESS` is unset (failures still logged to console / activity on failure).
