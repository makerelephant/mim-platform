import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
 * Emits reflection cards when categories cross the autonomy threshold.
 */

const AUTONOMY_THRESHOLD_REVIEWS = 20;
const AUTONOMY_THRESHOLD_ACCURACY = 90;

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
      autonomous_categories: autonomousSlugs,
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

async function computeAutonomyReport(sb: ReturnType<typeof createClient>) {
  const { data: actedCards } = await sb
    .schema("brain")
    .from("feed_cards")
    .select("acumen_category, ceo_action")
    .eq("status", "acted")
    .not("ceo_action", "is", null)
    .not("acumen_category", "is", null);

  const categoryMap = new Map<string, { approved: number; rejected: number; total: number }>();

  for (const card of actedCards || []) {
    const cat = card.acumen_category;
    if (!cat) continue;
    if (!categoryMap.has(cat)) categoryMap.set(cat, { approved: 0, rejected: 0, total: 0 });
    const entry = categoryMap.get(cat)!;
    entry.total++;
    if (card.ceo_action === "do") entry.approved++;
    else if (card.ceo_action === "no") entry.rejected++;
  }

  const categories = Array.from(categoryMap.entries()).map(([category, stats]) => {
    const accuracy = stats.approved + stats.rejected > 0
      ? Math.round((stats.approved / (stats.approved + stats.rejected)) * 100)
      : 0;
    return {
      category,
      accuracy,
      reviews: stats.total,
      approved: stats.approved,
      rejected: stats.rejected,
      qualifies: stats.total >= AUTONOMY_THRESHOLD_REVIEWS && accuracy >= AUTONOMY_THRESHOLD_ACCURACY,
    };
  });

  return {
    autonomous_categories: categories.filter((c) => c.qualifies),
    approaching_categories: categories.filter(
      (c) => !c.qualifies && c.reviews >= 10 && c.accuracy >= 80
    ),
    all_categories: categories.sort((a, b) => b.reviews - a.reviews),
    thresholds: {
      reviews: AUTONOMY_THRESHOLD_REVIEWS,
      accuracy: AUTONOMY_THRESHOLD_ACCURACY,
    },
  };
}
