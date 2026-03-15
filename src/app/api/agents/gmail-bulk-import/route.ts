import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runGmailScanner } from "@/lib/gmail-scanner";

export const maxDuration = 120; // Vercel serverless limit

/**
 * POST /api/agents/gmail-bulk-import
 *
 * Bulk imports historical Gmail messages one time-window at a time.
 * The client drives pagination by passing the cursor back on each call.
 *
 * Body:
 *   days:       number  — total days to import (default 30)
 *   chunkHours: number  — size of each time window in hours (default 8)
 *   cursor:     number  — hours-offset already processed (default 0, i.e. start from now)
 *
 * Returns:
 *   success, cursor (next offset), totalHours, done (boolean),
 *   batch results (processed, skipped, tasks, etc.), and cumulative progress.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const days: number = body.days ?? 30;
    const chunkHours: number = body.chunkHours ?? 8;
    const cursor: number = body.cursor ?? 0;
    const totalHours = days * 24;

    // ── Validate env vars ──
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars" },
        { status: 500 },
      );
    }
    if (!process.env.GOOGLE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing GOOGLE_TOKEN env var" },
        { status: 500 },
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing ANTHROPIC_API_KEY env var" },
        { status: 500 },
      );
    }

    if (cursor >= totalHours) {
      return NextResponse.json({
        success: true,
        done: true,
        cursor,
        totalHours,
        message: "Import complete — all time windows processed.",
      });
    }

    // ── Determine the time window for this batch ──
    // We work backwards from "now". The scanner uses `scanHours` to look back
    // from the current moment. To simulate a window [cursor, cursor+chunkHours]
    // hours ago, we call the scanner with scanHours = cursor + chunkHours (the
    // far edge). The scanner's deduplication will skip anything already imported
    // from overlapping windows, so earlier batches (cursor=0 = most recent)
    // won't be re-processed.
    //
    // This means each call scans from (now - scanHours) to now, but because
    // dedup skips already-seen messages, only the new chunk's emails get
    // classified. The first call (cursor=0) covers 0-8h ago, the second
    // covers 0-16h ago but dedup skips the first 8h, etc.
    const scanHours = Math.min(cursor + chunkHours, totalHours);

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const result = await runGmailScanner(sb, scanHours);

    const nextCursor = Math.min(cursor + chunkHours, totalHours);
    const done = nextCursor >= totalHours;

    return NextResponse.json({
      success: result.success,
      done,
      cursor: nextCursor,
      totalHours,
      batchScanHours: scanHours,
      batch: {
        messagesFound: result.messagesFound,
        processed: result.processed,
        tasksCreated: result.tasksCreated,
        skippedDupes: result.skippedDupes,
        contactsCreated: result.contactsCreated,
        preFiltered: result.preFiltered,
        threadSkipped: result.threadSkipped,
      },
      logTail: result.log.slice(-10), // last 10 log lines for debugging
      error: result.error,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
