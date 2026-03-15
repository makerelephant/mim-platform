import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chunkText, embedBatch, estimateTokens } from "@/lib/embeddings";

export const maxDuration = 300;

/**
 * POST /api/brain/embed-backfill
 * GET  /api/brain/embed-backfill (for Vercel cron compatibility)
 *
 * Backfills embeddings for existing knowledge_base entries that have
 * content_text but no matching knowledge_chunks rows.
 *
 * Processes in batches of 10 to stay within serverless limits.
 * Returns { processed, skipped, errors }
 */
async function handleBackfill(_request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase env vars" },
      { status: 500 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY not set — cannot generate embeddings" },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = createClient(supabaseUrl, supabaseServiceKey);

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Find knowledge_base rows that are processed but have no knowledge_chunks
    // Step 1: Get all kb_ids that already have chunks
    const { data: existingChunks } = await sb
      .schema("brain")
      .from("knowledge_chunks")
      .select("kb_id");

    const chunkedKbIds = new Set(
      (existingChunks || []).map((r: { kb_id: string }) => r.kb_id)
    );

    // Step 2: Get processed knowledge_base rows with content
    const { data: kbRows, error: fetchError } = await sb
      .from("knowledge_base")
      .select("id, title, content_text, source_type, taxonomy_categories")
      .eq("processed", true)
      .not("content_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(50); // Fetch more than we need, filter in code

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch knowledge_base: ${fetchError.message}` },
        { status: 500 },
      );
    }

    if (!kbRows || kbRows.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        skipped: 0,
        errors: [],
        message: "No knowledge_base rows to backfill",
      });
    }

    // Filter to only rows that don't have chunks yet
    const toProcess = kbRows
      .filter((row: { id: string }) => !chunkedKbIds.has(row.id))
      .slice(0, 10); // Process max 10 per call

    skipped = kbRows.length - toProcess.length;

    for (const row of toProcess) {
      try {
        const contentText = row.content_text;
        if (!contentText || contentText.trim().length === 0) {
          skipped++;
          continue;
        }

        // Chunk the content
        const textChunks = chunkText(contentText, 500);
        if (textChunks.length === 0) {
          skipped++;
          continue;
        }

        // Generate embeddings
        const embeddings = await embedBatch(textChunks);
        if (embeddings.length === 0) {
          errors.push(`${row.id}: embedding generation returned empty`);
          continue;
        }

        // Build chunk rows
        const chunkRows = textChunks.map((chunk: string, idx: number) => ({
          kb_id: row.id,
          chunk_index: idx,
          content: chunk,
          token_count: estimateTokens(chunk),
          embedding: JSON.stringify(embeddings[idx]),
          metadata: {
            title: row.title,
            source_type: row.source_type,
            categories: row.taxonomy_categories || [],
          },
        }));

        // Insert into knowledge_chunks
        const { error: insertError } = await sb
          .schema("brain")
          .from("knowledge_chunks")
          .insert(chunkRows);

        if (insertError) {
          errors.push(`${row.id}: insert failed — ${insertError.message}`);
        } else {
          processed++;
        }
      } catch (rowErr) {
        errors.push(`${row.id}: ${String(rowErr)}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      skipped,
      errors,
      remaining: Math.max(0, kbRows.length - toProcess.length - skipped),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err), processed, skipped, errors },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return handleBackfill(request);
}

export async function GET(request: NextRequest) {
  return handleBackfill(request);
}
