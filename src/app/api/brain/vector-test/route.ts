import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/embeddings";

export const maxDuration = 30;

/**
 * GET /api/brain/vector-test?q=your+question
 *
 * Diagnostic endpoint to test vector search directly.
 * Returns raw results from search_knowledge and search_correspondence RPCs
 * with detailed error information so we can see exactly what's failing.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "90 day goals";
  const threshold = parseFloat(request.nextUrl.searchParams.get("threshold") || "0.5");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);

  // Step 1: Check how many chunks exist
  const { data: chunkCount, error: countError } = await sb
    .schema("brain")
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true });

  const { data: corrChunkCount, error: corrCountError } = await sb
    .schema("brain")
    .from("correspondence_chunks")
    .select("id", { count: "exact", head: true });

  // Step 2: Sample a chunk to see what an embedding looks like
  const { data: sampleChunk } = await sb
    .schema("brain")
    .from("knowledge_chunks")
    .select("id, content, embedding")
    .limit(1)
    .single();

  // Step 3: Generate embedding for the query
  const questionEmbedding = await embedText(query);
  if (!questionEmbedding) {
    return NextResponse.json({
      error: "embedText returned null — check OPENAI_API_KEY",
      chunk_count: (chunkCount as unknown as { count: number })?.count ?? "error",
      count_error: countError?.message,
    });
  }

  const embeddingStr = `[${questionEmbedding.join(",")}]`;

  // Step 4: Run the search_knowledge RPC
  const kbResult = await sb.schema("brain").rpc("search_knowledge", {
    query_embedding: embeddingStr,
    match_threshold: threshold,
    match_count: 10,
  });

  const corrResult = await sb.schema("brain").rpc("search_correspondence", {
    query_embedding: embeddingStr,
    match_threshold: threshold,
    match_count: 10,
  });

  // Step 5: Try a lower threshold to see if anything matches at all
  const kbResultLow = await sb.schema("brain").rpc("search_knowledge", {
    query_embedding: embeddingStr,
    match_threshold: 0.1,
    match_count: 5,
  });

  return NextResponse.json({
    query,
    threshold,
    embedding_dimensions: questionEmbedding.length,
    embedding_sample: questionEmbedding.slice(0, 5),

    knowledge_chunks: {
      total_count_error: countError?.message ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total_count: (chunkCount as any)?.length ?? "see error",
      sample_chunk_id: sampleChunk?.id ?? null,
      sample_chunk_content: sampleChunk?.content?.slice(0, 100) ?? null,
      // Show embedding type to verify it's stored as vector, not text
      sample_embedding_type: typeof sampleChunk?.embedding,
      sample_embedding_preview: typeof sampleChunk?.embedding === "string"
        ? (sampleChunk.embedding as string).slice(0, 50)
        : Array.isArray(sampleChunk?.embedding)
          ? `array[${(sampleChunk.embedding as number[]).length}]`
          : "null/other",
    },

    correspondence_chunks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total_count: (corrChunkCount as any)?.length ?? "see error",
      count_error: corrCountError?.message ?? null,
    },

    search_knowledge: {
      error: kbResult.error ? { message: kbResult.error.message, details: kbResult.error.details, hint: kbResult.error.hint } : null,
      result_count: kbResult.data?.length ?? 0,
      results: kbResult.data?.map((r: Record<string, unknown>) => ({
        content: (r.content as string)?.slice(0, 100),
        similarity: r.similarity,
        metadata: r.metadata,
      })) ?? [],
    },

    search_correspondence: {
      error: corrResult.error ? { message: corrResult.error.message, details: corrResult.error.details } : null,
      result_count: corrResult.data?.length ?? 0,
    },

    search_knowledge_low_threshold: {
      error: kbResultLow.error?.message ?? null,
      result_count: kbResultLow.data?.length ?? 0,
      results: kbResultLow.data?.map((r: Record<string, unknown>) => ({
        content: (r.content as string)?.slice(0, 80),
        similarity: r.similarity,
      })) ?? [],
    },
  });
}
