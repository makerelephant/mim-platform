/**
 * Unified memory search — Knowledge index + Messages index
 *
 * In Motion persists searchable vector memory in two PostgreSQL indexes:
 *
 * - **Knowledge index** — `brain.knowledge_chunks` keyed by `knowledge_base.id`
 *   (Canvas uploads, Canvas text ingest, API documents). Queried via
 *   `search_knowledge` and `search_knowledge_for_kb`.
 *
 * - **Messages index** — `brain.correspondence_chunks` keyed by `correspondence.id`
 *   (Gmail, Slack, etc.). Queried via `search_correspondence`.
 *
 * Chat transcripts live in `brain.clearing_messages` (session UI); durable RAG
 * copies of substantive Canvas text go through the Knowledge index via ingest.
 *
 * This module is the single internal API for **vector recall** across both indexes
 * so route handlers do not duplicate RPC wiring and thresholds.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Which vector indexes to query in a global recall pass */
export type MemoryVectorScope = "all" | "knowledge" | "correspondence";

/** Logical name for instrumentation and docs */
export type MemoryIndexName = "knowledge" | "messages";

export const GLOBAL_KNOWLEDGE_MATCH_COUNT = 48;
export const GLOBAL_CORRESPONDENCE_MATCH_COUNT = 20;
export const KNOWLEDGE_VECTOR_THRESHOLD = 0.18;
export const CORRESPONDENCE_VECTOR_THRESHOLD = 0.18;

export const SCOPED_KB_MATCH_COUNT_SESSION = 40;
export const SCOPED_KB_MATCH_COUNT_RECENT = 36;
export const SCOPED_KB_THRESHOLD = 0.12;

/** Row shape from brain.search_knowledge / brain.search_knowledge_for_kb */
export type KnowledgeChunkRow = {
  id: string;
  kb_id: string;
  chunk_index: number;
  content: string | null;
  token_count: number | null;
  metadata: Record<string, unknown> | null;
  similarity?: number;
};

/** Loose row from brain.search_correspondence RPC */
type CorrespondenceVectorRow = {
  subject?: string;
  metadata?: { subject?: string };
  similarity?: number;
  direction?: string;
  sent_at?: string;
  channel?: string;
  content?: string;
};

export function chunkDedupeKey(row: { kb_id: string; chunk_index: number }): string {
  return `${row.kb_id}:${row.chunk_index}`;
}

export async function searchKnowledgeForKb(
  sb: SupabaseClient,
  kbId: string,
  embeddingStr: string,
  matchCount: number,
  matchThreshold: number,
): Promise<KnowledgeChunkRow[]> {
  const { data, error } = await sb.schema("brain").rpc("search_knowledge_for_kb", {
    target_kb_id: kbId,
    query_embedding: embeddingStr,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });
  if (error) {
    console.warn("[search-memory] search_knowledge_for_kb failed:", error.message);
    return [];
  }
  return (data as KnowledgeChunkRow[]) ?? [];
}

export function appendKnowledgeChunksToContext(
  contextParts: string[],
  sourceNotes: string[],
  title: string,
  rows: KnowledgeChunkRow[],
  filledVectorChunkKeys: Set<string>,
  sectionHeader: string,
) {
  const fresh: KnowledgeChunkRow[] = [];
  for (const r of rows) {
    const k = chunkDedupeKey(r);
    if (filledVectorChunkKeys.has(k)) continue;
    filledVectorChunkKeys.add(k);
    fresh.push(r);
  }
  if (fresh.length === 0) return;

  contextParts.push(sectionHeader);
  for (const r of fresh) {
    const sim = r.similarity != null ? ` (similarity ${(r.similarity * 100).toFixed(0)}%)` : "";
    contextParts.push(`[Chunk ${r.chunk_index}]${sim}`);
    contextParts.push((r.content || "").trim());
    contextParts.push("");
  }
  sourceNotes.push(`${fresh.length} vector chunk(s) from «${title}»`);
}

/**
 * Query both vector indexes (or a subset), append formatted evidence to the ask context.
 */
/** Stats from global vector pass — used to trigger keyword hybrid fallback */
export type GlobalVectorMemoryStats = {
  kbChunksAdded: number;
  maxKbSimilarity: number;
};

export async function appendGlobalVectorMemoryToContext(
  sb: SupabaseClient,
  params: {
    embeddingStr: string | null;
    filledVectorChunkKeys: Set<string>;
    contextParts: string[];
    sourceNotes: string[];
    vectorKbTitles: Set<string>;
    vectorCorrSubjects: Set<string>;
    scope?: MemoryVectorScope;
  },
): Promise<GlobalVectorMemoryStats> {
  const {
    embeddingStr,
    filledVectorChunkKeys,
    contextParts,
    sourceNotes,
    vectorKbTitles,
    vectorCorrSubjects,
    scope = "all",
  } = params;

  if (!embeddingStr) return { kbChunksAdded: 0, maxKbSimilarity: 0 };

  const runKnowledge = scope === "all" || scope === "knowledge";
  const runCorrespondence = scope === "all" || scope === "correspondence";

  try {
    const kbPromise = runKnowledge
      ? sb.schema("brain").rpc("search_knowledge", {
          query_embedding: embeddingStr,
          match_threshold: KNOWLEDGE_VECTOR_THRESHOLD,
          match_count: GLOBAL_KNOWLEDGE_MATCH_COUNT,
        })
      : Promise.resolve({ data: null, error: null });

    const corrPromise = runCorrespondence
      ? sb.schema("brain").rpc("search_correspondence", {
          query_embedding: embeddingStr,
          match_threshold: CORRESPONDENCE_VECTOR_THRESHOLD,
          match_count: GLOBAL_CORRESPONDENCE_MATCH_COUNT,
        })
      : Promise.resolve({ data: null, error: null });

    const [kbResult, corrResult] = await Promise.all([kbPromise, corrPromise]);

    if (kbResult.error) {
      console.error(
        "[search-memory] search_knowledge RPC error:",
        kbResult.error.message,
        kbResult.error.details,
      );
    }
    if (corrResult.error) {
      console.error(
        "[search-memory] search_correspondence RPC error:",
        corrResult.error.message,
        corrResult.error.details,
      );
    }

    const kbVectorResults = kbResult.data as KnowledgeChunkRow[] | null;

    let kbChunksAdded = 0;
    let maxKbSimilarity = 0;

    if (kbVectorResults && kbVectorResults.length > 0) {
      contextParts.push("## Knowledge index (vector search — full chunks)\n");
      for (const r of kbVectorResults) {
        if (r.kb_id == null) continue;
        const key = chunkDedupeKey(r);
        if (filledVectorChunkKeys.has(key)) continue;
        filledVectorChunkKeys.add(key);

        if (r.similarity != null && r.similarity > maxKbSimilarity) {
          maxKbSimilarity = r.similarity;
        }

        const title = (r.metadata?.title as string) || "Untitled";
        vectorKbTitles.add(title);
        const similarity = r.similarity != null ? ` (${(r.similarity * 100).toFixed(0)}% match)` : "";
        contextParts.push(`**${title}** · chunk ${r.chunk_index}${similarity}`);
        contextParts.push((r.content || "").trim());
        contextParts.push("");
        kbChunksAdded++;
      }
      if (kbChunksAdded > 0) {
        sourceNotes.push(`${kbChunksAdded} Knowledge index chunk(s)`);
      }
    }

    const corrVectorResults = corrResult.data as CorrespondenceVectorRow[] | null;

    if (corrVectorResults && corrVectorResults.length > 0) {
      contextParts.push("## Messages index (email/Slack — vector search)\n");
      for (const r of corrVectorResults) {
        const subject = r.subject || r.metadata?.subject || "No subject";
        vectorCorrSubjects.add(subject);
        const similarity = r.similarity ? ` (${(r.similarity * 100).toFixed(0)}% match)` : "";
        const dir = r.direction === "outbound" ? "SENT" : "RECEIVED";
        const date = r.sent_at ? new Date(r.sent_at).toLocaleDateString() : "";
        contextParts.push(`- [${r.channel || "email"}/${dir}] "${subject}" (${date})${similarity}`);
        if (r.content) contextParts.push(`  ${r.content.trim()}`);
      }
      contextParts.push("");
      sourceNotes.push(`${corrVectorResults.length} Messages index match(es)`);
    }

    return { kbChunksAdded, maxKbSimilarity };
  } catch (vecErr) {
    console.error("[search-memory] global vector search exception:", vecErr);
    return { kbChunksAdded: 0, maxKbSimilarity: 0 };
  }
}

function sanitizeIlikeToken(w: string): string {
  return w.replace(/[%_\\]/g, "").trim();
}

/**
 * Keyword / hybrid fallback over knowledge_chunks.content when vector scores are weak
 * or few chunks matched — improves recall for paraphrased questions.
 */
export async function appendKeywordKnowledgeChunksToContext(
  sb: SupabaseClient,
  question: string,
  filledVectorChunkKeys: Set<string>,
  contextParts: string[],
  sourceNotes: string[],
  vectorKbTitles: Set<string>,
  options?: { limit?: number },
): Promise<number> {
  const words = question
    .split(/\s+/)
    .map(sanitizeIlikeToken)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (words.length === 0) return 0;

  const limit = options?.limit ?? 18;
  const orClause = words.map((w) => `content.ilike.%${w}%`).join(",");

  const { data, error } = await sb
    .schema("brain")
    .from("knowledge_chunks")
    .select("kb_id, chunk_index, content, metadata")
    .or(orClause)
    .limit(limit);

  if (error) {
    console.warn("[search-memory] keyword chunk search failed:", error.message);
    return 0;
  }

  if (!data?.length) return 0;

  let added = 0;
  contextParts.push("## Knowledge index (keyword-assisted — weak vector match or thin results)\n");

  for (const row of data) {
    const kbId = row.kb_id as string;
    const chunkIndex = row.chunk_index as number;
    const key = `${kbId}:${chunkIndex}`;
    if (filledVectorChunkKeys.has(key)) continue;
    filledVectorChunkKeys.add(key);

    const title = ((row.metadata as Record<string, unknown>)?.title as string) || "Untitled";
    vectorKbTitles.add(title);
    contextParts.push(`**${title}** · chunk ${chunkIndex} (keyword)`);
    contextParts.push(String(row.content || "").trim());
    contextParts.push("");
    added++;
  }

  if (added > 0) {
    sourceNotes.push(`${added} Knowledge index keyword chunk(s)`);
  }
  return added;
}

export const KNOWLEDGE_VECTOR_WEAK_FALLBACK_MAX_SIM = 0.24;
export const KNOWLEDGE_VECTOR_WEAK_FALLBACK_MIN_CHUNKS = 4;

/**
 * Structured audit: a write landed in a vector index (or embedding failed).
 * Fire-and-forget; never throws.
 */
export async function logMemoryIndexWrite(
  sb: SupabaseClient,
  e: {
    index: MemoryIndexName;
    sourceId: string;
    chunkCount: number;
    embedOk: boolean;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  const logSuccessToActivity = process.env.MEMORY_INDEX_ACTIVITY_SUCCESS === "1";
  const shouldWriteActivity = !e.embedOk || logSuccessToActivity;

  if (shouldWriteActivity) {
    try {
      const label = e.index === "knowledge" ? "Knowledge" : "Messages";
      await sb.schema("brain").from("activity").insert({
        entity_type: "system",
        entity_id: null,
        action: "memory_index_write",
        actor: "brain",
        metadata: {
          summary: `${label} index: ${e.embedOk ? `${e.chunkCount} chunk(s) embedded` : "embed failed or skipped"}`,
          memory_index: e.index,
          source_id: e.sourceId,
          chunk_count: e.chunkCount,
          embed_ok: e.embedOk,
          ...e.extra,
        },
      });
    } catch {
      /* ignore */
    }
  }

  console.log(
    `[memory-index] ${e.index} source=${e.sourceId} chunks=${e.chunkCount} embed_ok=${e.embedOk}`,
  );
}
