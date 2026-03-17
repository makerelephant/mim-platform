import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chunkText, embedBatch, estimateTokens } from "@/lib/embeddings";

export const maxDuration = 300;

/**
 * POST /api/brain/embed-correspondence
 * GET  /api/brain/embed-correspondence
 *
 * Backfills embeddings for existing brain.correspondence rows that have
 * no matching correspondence_chunks rows.
 *
 * Processes in batches of 20 to stay within serverless limits.
 * Returns { processed, skipped, errors, remaining }
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

  const sb = createClient(supabaseUrl, supabaseServiceKey);

  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Get correspondence IDs that already have chunks
    const { data: existingChunks } = await sb
      .schema("brain")
      .from("correspondence_chunks")
      .select("correspondence_id");

    const embeddedIds = new Set(
      (existingChunks || []).map((r: { correspondence_id: string }) => r.correspondence_id)
    );

    // Get correspondence rows with content
    const { data: corrRows, error: fetchError } = await sb
      .schema("brain")
      .from("correspondence")
      .select("id, subject, body, from_address, direction, channel")
      .order("sent_at", { ascending: false })
      .limit(200);

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch correspondence: ${fetchError.message}` },
        { status: 500 },
      );
    }

    if (!corrRows || corrRows.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        skipped: 0,
        errors: [],
        remaining: 0,
        message: "No correspondence rows to backfill",
      });
    }

    // Filter to rows without chunks, process max 20 per call
    const toProcess = corrRows
      .filter((row: { id: string }) => !embeddedIds.has(row.id))
      .slice(0, 20);

    const totalUnembedded = corrRows.filter(
      (row: { id: string }) => !embeddedIds.has(row.id)
    ).length;

    skipped = corrRows.length - totalUnembedded;

    for (const row of toProcess) {
      try {
        // Build embeddable text from subject + body
        const parts: string[] = [];
        if (row.subject) parts.push(`Subject: ${row.subject}`);
        if (row.from_address) parts.push(`From: ${row.from_address}`);
        if (row.body) parts.push(row.body);

        const content = parts.join("\n");
        if (content.trim().length < 20) {
          skipped++;
          continue;
        }

        const chunks = chunkText(content, 500);
        if (chunks.length === 0) {
          skipped++;
          continue;
        }

        const embeddings = await embedBatch(chunks);
        if (embeddings.length === 0) {
          errors.push(`${row.id}: embedding generation returned empty`);
          continue;
        }

        const chunkRows = chunks.map((chunk: string, idx: number) => ({
          correspondence_id: row.id,
          chunk_index: idx,
          content: chunk,
          token_count: estimateTokens(chunk),
          embedding: JSON.stringify(embeddings[idx]),
        }));

        const { error: insertError } = await sb
          .schema("brain")
          .from("correspondence_chunks")
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
      remaining: Math.max(0, totalUnembedded - toProcess.length),
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
