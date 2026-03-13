import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_CATEGORIES = [
  "legal", "customer-partner-ops", "accounting-finance",
  "scheduling", "fundraising", "product-engineering",
  "ux-design", "marketing", "ai", "family", "administration",
];

const VALID_IMPORTANCE = ["high", "medium", "low"];
const VALID_STATUSES = ["correct", "incorrect", "partial"];

/**
 * POST /api/decisions/review
 *
 * CEO reviews a classification decision.
 * Body: {
 *   classification_log_id: string (UUID),
 *   review_status: "correct" | "incorrect" | "partial",
 *   correct_category?: string,      // required if incorrect/partial
 *   correct_importance?: string,     // optional correction
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { classification_log_id, review_status, correct_category, correct_importance } = body;

    // Validate required fields
    if (!classification_log_id) {
      return NextResponse.json(
        { success: false, error: "classification_log_id is required" },
        { status: 400 },
      );
    }

    if (!review_status || !VALID_STATUSES.includes(review_status)) {
      return NextResponse.json(
        { success: false, error: `review_status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    // Validate corrections
    if (correct_category && !VALID_CATEGORIES.includes(correct_category)) {
      return NextResponse.json(
        { success: false, error: `correct_category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 },
      );
    }

    if (correct_importance && !VALID_IMPORTANCE.includes(correct_importance)) {
      return NextResponse.json(
        { success: false, error: `correct_importance must be one of: ${VALID_IMPORTANCE.join(", ")}` },
        { status: 400 },
      );
    }

    // Require correction details for incorrect/partial
    if ((review_status === "incorrect" || review_status === "partial") && !correct_category) {
      return NextResponse.json(
        { success: false, error: "correct_category is required when review_status is incorrect or partial" },
        { status: 400 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const updateData: Record<string, unknown> = {
      ceo_review_status: review_status,
      ceo_reviewed_at: new Date().toISOString(),
    };

    if (correct_category) updateData.ceo_correct_category = correct_category;
    if (correct_importance) updateData.ceo_correct_importance = correct_importance;

    const { data, error } = await sb
      .from("classification_log")
      .update(updateData)
      .eq("id", classification_log_id)
      .select("id, acumen_category, importance_level, ceo_review_status, ceo_correct_category, ceo_correct_importance, ceo_reviewed_at")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Classification log entry not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      decision: data,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
