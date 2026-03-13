import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/decisions
 *
 * Returns pending decision reviews and accuracy stats.
 * Query params:
 *   - status: filter by ceo_review_status (default: all)
 *   - limit: max rows (default: 20)
 *   - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "pending";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch classifications with Acumen data
    let query = sb
      .from("classification_log")
      .select("id, source, source_message_id, from_email, subject, classification_result, acumen_category, importance_level, acumen_reasoning, ceo_review_status, ceo_correct_category, ceo_correct_importance, ceo_reviewed_at, created_at")
      .eq("pre_filter_result", "passed")
      .not("acumen_category", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter !== "all") {
      query = query.eq("ceo_review_status", statusFilter);
    }

    const { data: decisions, error: decisionsError } = await query;

    if (decisionsError) {
      return NextResponse.json(
        { success: false, error: decisionsError.message },
        { status: 500 },
      );
    }

    // Compute accuracy stats
    const { data: reviewed } = await sb
      .from("classification_log")
      .select("acumen_category, ceo_review_status")
      .eq("pre_filter_result", "passed")
      .not("acumen_category", "is", null)
      .neq("ceo_review_status", "pending");

    const stats: Record<string, { total: number; correct: number; incorrect: number; partial: number }> = {};
    let totalReviewed = 0;
    let totalCorrect = 0;

    if (reviewed) {
      for (const row of reviewed) {
        const cat = row.acumen_category || "unknown";
        if (!stats[cat]) stats[cat] = { total: 0, correct: 0, incorrect: 0, partial: 0 };
        stats[cat].total++;
        totalReviewed++;

        if (row.ceo_review_status === "correct") {
          stats[cat].correct++;
          totalCorrect++;
        } else if (row.ceo_review_status === "incorrect") {
          stats[cat].incorrect++;
        } else if (row.ceo_review_status === "partial") {
          stats[cat].partial++;
        }
      }
    }

    // Pending count
    const { count: pendingCount } = await sb
      .from("classification_log")
      .select("id", { count: "exact", head: true })
      .eq("pre_filter_result", "passed")
      .not("acumen_category", "is", null)
      .eq("ceo_review_status", "pending");

    return NextResponse.json({
      success: true,
      decisions: decisions || [],
      stats: {
        total_reviewed: totalReviewed,
        total_correct: totalCorrect,
        overall_accuracy: totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : null,
        pending_review: pendingCount || 0,
        by_category: stats,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
