import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/brain/accuracy
 *
 * Computes per-category accuracy from CEO actions on feed cards.
 * A card the CEO marked "do" = brain was right (positive signal).
 * A card the CEO marked "no" = brain was wrong (negative signal).
 * "not_now" = neutral (timing, not accuracy).
 *
 * Also computes overall stats and identifies categories needing attention.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Get all cards that have been acted on (include correction data)
    const { data: actedCards, error } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id, card_type, acumen_category, priority, ceo_action, ceo_action_note, ceo_correction, source_type, entity_type, created_at")
      .eq("status", "acted")
      .not("ceo_action", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!actedCards || actedCards.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No acted cards yet — need CEO feedback to compute accuracy.",
        total_acted: 0,
        categories: [],
        overall: { accuracy: null, total: 0, approved: 0, rejected: 0, held: 0 },
      });
    }

    // ── Compute per-category accuracy ──
    const categoryMap = new Map<string, { approved: number; rejected: number; held: number; total: number }>();

    for (const card of actedCards) {
      const cat = card.acumen_category || "uncategorized";
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { approved: 0, rejected: 0, held: 0, total: 0 });
      }
      const entry = categoryMap.get(cat)!;
      entry.total++;
      if (card.ceo_action === "do") entry.approved++;
      else if (card.ceo_action === "no") entry.rejected++;
      else if (card.ceo_action === "not_now") entry.held++;
    }

    const categories = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        accuracy: stats.total > 0 ? Math.round((stats.approved / (stats.approved + stats.rejected || 1)) * 100) : null,
        ...stats,
        needs_attention: stats.rejected > stats.approved && stats.total >= 3,
      }))
      .sort((a, b) => (b.total - a.total));

    // ── Overall stats ──
    const totalApproved = actedCards.filter(c => c.ceo_action === "do").length;
    const totalRejected = actedCards.filter(c => c.ceo_action === "no").length;
    const totalHeld = actedCards.filter(c => c.ceo_action === "not_now").length;
    const overallAccuracy = totalApproved + totalRejected > 0
      ? Math.round((totalApproved / (totalApproved + totalRejected)) * 100)
      : null;

    // ── Per card-type breakdown ──
    const typeMap = new Map<string, { approved: number; rejected: number; held: number; total: number }>();
    for (const card of actedCards) {
      if (!typeMap.has(card.card_type)) {
        typeMap.set(card.card_type, { approved: 0, rejected: 0, held: 0, total: 0 });
      }
      const entry = typeMap.get(card.card_type)!;
      entry.total++;
      if (card.ceo_action === "do") entry.approved++;
      else if (card.ceo_action === "no") entry.rejected++;
      else entry.held++;
    }

    const byType = Array.from(typeMap.entries()).map(([type, stats]) => ({
      type,
      accuracy: stats.approved + stats.rejected > 0
        ? Math.round((stats.approved / (stats.approved + stats.rejected)) * 100)
        : null,
      ...stats,
    }));

    // ── Priority distribution ──
    const priorityCounts: Record<string, number> = {};
    for (const card of actedCards) {
      const p = card.priority || "medium";
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    }

    // ── Correction analysis — what specifically is the brain getting wrong? ──
    interface CorrectionSummary {
      wrong_category: Record<string, { count: number; corrected_to: string[] }>;
      wrong_priority: Record<string, { count: number; corrected_to: string[] }>;
      should_not_exist: number;
      total_with_corrections: number;
      notes: string[];
    }
    const corrections: CorrectionSummary = {
      wrong_category: {},
      wrong_priority: {},
      should_not_exist: 0,
      total_with_corrections: 0,
      notes: [],
    };

    for (const card of actedCards) {
      if (card.ceo_action !== "no") continue;
      const corr = card.ceo_correction as Record<string, unknown> | null;
      if (!corr) continue;

      corrections.total_with_corrections++;

      if (corr.should_not_exist) {
        corrections.should_not_exist++;
      }

      if (corr.wrong_category) {
        const origCat = card.acumen_category || "uncategorized";
        if (!corrections.wrong_category[origCat]) {
          corrections.wrong_category[origCat] = { count: 0, corrected_to: [] };
        }
        corrections.wrong_category[origCat].count++;
        if (typeof corr.wrong_category === "string" && corr.wrong_category) {
          corrections.wrong_category[origCat].corrected_to.push(corr.wrong_category);
        }
      }

      if (corr.wrong_priority) {
        const origPri = card.priority || "medium";
        if (!corrections.wrong_priority[origPri]) {
          corrections.wrong_priority[origPri] = { count: 0, corrected_to: [] };
        }
        corrections.wrong_priority[origPri].count++;
        if (typeof corr.wrong_priority === "string" && corr.wrong_priority) {
          corrections.wrong_priority[origPri].corrected_to.push(corr.wrong_priority);
        }
      }

      if (corr.note && typeof corr.note === "string") {
        corrections.notes.push(corr.note);
      }
    }

    return NextResponse.json({
      success: true,
      total_acted: actedCards.length,
      overall: {
        accuracy: overallAccuracy,
        total: actedCards.length,
        approved: totalApproved,
        rejected: totalRejected,
        held: totalHeld,
      },
      categories,
      by_type: byType,
      priority_distribution: priorityCounts,
      corrections,
      // M3 milestone check
      milestone_m3: {
        daily_volume_target: 100,
        accuracy_target: 85,
        current_accuracy: overallAccuracy,
        categories_above_90: categories.filter(c => c.accuracy !== null && c.accuracy >= 90 && c.total >= 20).length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
