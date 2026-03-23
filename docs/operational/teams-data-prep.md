# Teams / multi-user data prep (design note)
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC  
> **Status:** Design-only — no migration applied in this batch.  
> **Last updated:** 2026-03-22

Before adding team members and “walled” data:

1. **`workspace_id`** (UUID) on `knowledge_base`, `brain.knowledge_chunks`, `brain.correspondence`, `brain.correspondence_chunks`, `brain.feed_cards`, and `brain.clearing_messages` (nullable at first = default workspace).
2. **`visibility_scope`** already exists on feed cards — extend the same vocabulary to chunk rows or parent rows where recall must differ by user.
3. **`workspace_members`** (`workspace_id`, `user_id`, `role`) for RLS policies.
4. **Postgres RLS** on read paths; avoid relying on service-role routes without explicit filters for user-scoped queries.

Unifying **Knowledge** and **Messages** chunk tables is optional; RLS on both is mandatory for hard walls.
