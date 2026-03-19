import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  computeAutonomyReport,
  AUTONOMY_THRESHOLD_REVIEWS,
  AUTONOMY_THRESHOLD_ACCURACY,
} from "@/lib/autonomy";

/**
 * GET /api/brain/autonomy
 *
 * Evaluates which categories have earned autonomous operation.
 * A category qualifies when:
 * - 20+ CEO reviews
 * - 90%+ accuracy (do / (do + no))
 *
 * POST /api/brain/autonomy
 *
 * Runs the autonomy check and auto-acts on qualifying unread cards.
 * This is a catch-up mechanism for cards that were created before
 * the gmail scanner's inline autonomy was active.
 * Emits reflection cards when categories cross the autonomy threshold.
 */

export async function GET() {
  try {
    const sb = getClient();
    if (!sb) return envError();

    const report = await computeAutonomyReport(sb);
    return NextResponse.json({ success: true, ...report });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const sb = getClient();
    if (!sb) return envError();

    const report = await computeAutonomyReport(sb);

    if (report.autonomous_categories.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No categories have reached autonomous threshold yet.",
        ...report,
        auto_acted: 0,
      });
    }

    // ── Auto-act on unread cards in autonomous categories ──
    // This catches any cards that slipped through before inline autonomy was active
    const autonomousSlugs = report.autonomous_categories.map((c) => c.category);

    const { data: eligibleCards, error: fetchErr } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id, title, acumen_category, card_type")
      .in("acumen_category", autonomousSlugs)
      .eq("status", "unread")
      .in("card_type", ["decision", "action"]);

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    let autoActed = 0;
    for (const card of eligibleCards || []) {
      const { error: updateErr } = await sb
        .schema("brain")
        .from("feed_cards")
        .update({
          status: "acted",
          ceo_action: "do",
          ceo_action_at: new Date().toISOString(),
          ceo_action_note: `Auto-approved: ${card.acumen_category} has ${AUTONOMY_THRESHOLD_ACCURACY}%+ accuracy`,
        })
        .eq("id", card.id);

      if (!updateErr) autoActed++;
    }

    // ── Emit reflection card if we auto-acted ──
    if (autoActed > 0) {
      await sb.schema("brain").from("feed_cards").insert({
        card_type: "reflection",
        title: `Brain auto-acted on ${autoActed} card${autoActed > 1 ? "s" : ""}`,
        body: `Categories with autonomous authority: ${autonomousSlugs.join(", ")}.\n\n${autoActed} card${autoActed > 1 ? "s were" : " was"} auto-approved because these categories have reached ${AUTONOMY_THRESHOLD_ACCURACY}%+ accuracy on ${AUTONOMY_THRESHOLD_REVIEWS}+ reviews.\n\nIf any of these actions were wrong, mark them "No" and the category will lose autonomous status until accuracy recovers.`,
        source_type: "autonomy",
        source_ref: `autonomy-${new Date().toISOString().slice(0, 10)}`,
        priority: "medium",
        visibility_scope: "personal",
        metadata: {
          autonomous_categories: autonomousSlugs,
          cards_auto_acted: autoActed,
          threshold_reviews: AUTONOMY_THRESHOLD_REVIEWS,
          threshold_accuracy: AUTONOMY_THRESHOLD_ACCURACY,
        },
      });
    }

    return NextResponse.json({
      success: true,
      auto_acted: autoActed,
      auto_acted_categories: autonomousSlugs,
      ...report,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function envError() {
  return NextResponse.json({ success: false, error: "Missing env vars" }, { status: 500 });
}
