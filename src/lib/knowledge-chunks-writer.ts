/**
 * Shared path: chunk text → OpenAI embeddings → brain.knowledge_chunks
 * Used by /api/brain/ingest and server-side Canvas turn persistence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText, embedBatch, estimateTokens } from "@/lib/embeddings";

export type KnowledgeChunkMetadata = {
  title: string;
  source_type: string;
  categories?: string[] | null;
};

export type EmbedKnowledgeChunksResult = {
  vectorChunksExpected: number;
  embeddingChunkCount: number;
  embedOk: boolean;
};

/**
 * Insert vectorized chunks for an existing knowledge_base row.
 */
export async function embedKnowledgeContentIntoChunks(
  sb: SupabaseClient,
  kbId: string,
  contentText: string,
  meta: KnowledgeChunkMetadata,
): Promise<EmbedKnowledgeChunksResult> {
  let embeddingChunkCount = 0;
  let vectorChunksExpected = 0;

  try {
    const embeddingChunks = chunkText(contentText, 500);
    vectorChunksExpected = embeddingChunks.length;
    if (embeddingChunks.length === 0) {
      return { vectorChunksExpected: 0, embeddingChunkCount: 0, embedOk: true };
    }

    const embeddings = await embedBatch(embeddingChunks);
    if (embeddings.length === 0) {
      return { vectorChunksExpected, embeddingChunkCount: 0, embedOk: false };
    }

    const chunkRows = embeddingChunks.map((chunk, idx) => ({
      kb_id: kbId,
      chunk_index: idx,
      content: chunk,
      token_count: estimateTokens(chunk),
      embedding: `[${embeddings[idx].join(",")}]`,
      metadata: {
        title: meta.title,
        source_type: meta.source_type,
        categories: meta.categories ?? [],
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: chunkError } = await (sb as any)
      .schema("brain")
      .from("knowledge_chunks")
      .insert(chunkRows);

    if (chunkError) {
      console.warn("[knowledge-chunks-writer] insert failed:", chunkError.message);
      return { vectorChunksExpected, embeddingChunkCount: 0, embedOk: false };
    }

    embeddingChunkCount = chunkRows.length;
    return {
      vectorChunksExpected,
      embeddingChunkCount,
      embedOk: true,
    };
  } catch (e) {
    console.warn("[knowledge-chunks-writer] exception:", e);
    return { vectorChunksExpected, embeddingChunkCount: 0, embedOk: false };
  }
}
