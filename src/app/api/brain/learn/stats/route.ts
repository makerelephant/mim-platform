import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/brain/learn/stats
 *
 * Returns correction learning statistics:
 *   - Total corrections by type
 *   - Most corrected categories (brain is weakest here)
 *   - Accuracy trend over time (weekly buckets)
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const sb: any = createClient(supabaseUrl, supabaseKey);

    // ── 1. Fetch all correction knowledge_base entries ──
    const { data: corrections, error: corrError } = await sb
      .from("knowledge_base")
      .select("id, title, source_ref, metadata, created_at")
      .eq("source_type", "ceo_correction")
      .order("created_at", { ascending: false });

    if (corrError) {
      return NextResponse.json({ error: corrError.message }, { status: 500 });
    }

    const correctionList = (corrections || []) as Array<{
      id: string;
      title: string;
      source_ref: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;

    // ── 2. Total corrections by type ──
    const byType: Record<string, number> = {
      wrong_category: 0,
      wrong_priority: 0,
      should_not_exist: 0,
      note: 0,
    };

    const categoryCorrectionMap = new Map<
      string,
      { count: number; corrected_to: Map<string, number> }
    >();

    const priorityCorrectionMap = new Map<
      string,
      { count: number; corrected_to: Map<string, number> }
    >();

    const suppressedCombos: Array<{ source: string; category: string; count: number }> = [];
    const suppressMap = new Map<string, number>();

    for (const entry of correctionList) {
      const meta = entry.metadata;
      if (!meta) continue;

      const cType = (meta.correction_type as string) || "note";
      byType[cType] = (byType[cType] || 0) + 1;

      // Track category corrections
      if (cType === "wrong_category" && meta.original_category) {
        const origCat = meta.original_category as string;
        if (!categoryCorrectionMap.has(origCat)) {
          categoryCorrectionMap.set(origCat, { count: 0, corrected_to: new Map() });
        }
        const entry2 = categoryCorrectionMap.get(origCat)!;
        entry2.count++;
        if (meta.corrected_category) {
          const cc = meta.corrected_category as string;
          entry2.corrected_to.set(cc, (entry2.corrected_to.get(cc) || 0) + 1);
        }
      }

      // Track priority corrections
      if (cType === "wrong_priority" && meta.original_priority) {
        const origPri = meta.original_priority as string;
        if (!priorityCorrectionMap.has(origPri)) {
          priorityCorrectionMap.set(origPri, { count: 0, corrected_to: new Map() });
        }
        const entry2 = priorityCorrectionMap.get(origPri)!;
        entry2.count++;
        if (meta.corrected_priority) {
          const cp = meta.corrected_priority as string;
          entry2.corrected_to.set(cp, (entry2.corrected_to.get(cp) || 0) + 1);
        }
      }

      // Track suppress signals
      if (cType === "should_not_exist") {
        const key = `${meta.original_source || "unknown"}::${meta.original_category || "uncategorized"}`;
        suppressMap.set(key, (suppressMap.get(key) || 0) + 1);
      }
    }

    // Build most-corrected categories (sorted by count desc)
    const mostCorrectedCategories = Array.from(categoryCorrectionMap.entries())
      .map(([category, data]) => ({
        category,
        correction_count: data.count,
        commonly_corrected_to: Array.from(data.corrected_to.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => ({ category: cat, count })),
      }))
      .sort((a, b) => b.correction_count - a.correction_count);

    // Build most-corrected priorities
    const mostCorrectedPriorities = Array.from(priorityCorrectionMap.entries())
      .map(([priority, data]) => ({
        priority,
        correction_count: data.count,
        commonly_corrected_to: Array.from(data.corrected_to.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([pri, count]) => ({ priority: pri, count })),
      }))
      .sort((a, b) => b.correction_count - a.correction_count);

    // Build suppressed combos
    for (const [key, count] of suppressMap.entries()) {
      const [source, category] = key.split("::");
      suppressedCombos.push({ source, category, count });
    }
    suppressedCombos.sort((a, b) => b.count - a.count);

    // ── 3. Accuracy trend over time (weekly buckets) ──
    // Fetch all acted cards to compute weekly accuracy
    const { data: actedCards, error: actedError } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("ceo_action, created_at")
      .eq("status", "acted")
      .not("ceo_action", "is", null)
      .order("created_at", { ascending: true });

    if (actedError) {
      return NextResponse.json({ error: actedError.message }, { status: 500 });
    }

    const weeklyBuckets = new Map<
      string,
      { approved: number; rejected: number; held: number }
    >();

    for (const card of actedCards || []) {
      const date = new Date(card.created_at);
      // Get Monday of that week
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      const weekKey = monday.toISOString().slice(0, 10);

      if (!weeklyBuckets.has(weekKey)) {
        weeklyBuckets.set(weekKey, { approved: 0, rejected: 0, held: 0 });
      }
      const bucket = weeklyBuckets.get(weekKey)!;

      if (card.ceo_action === "do") bucket.approved++;
      else if (card.ceo_action === "no") bucket.rejected++;
      else if (card.ceo_action === "not_now") bucket.held++;
    }

    const accuracyTrend = Array.from(weeklyBuckets.entries())
      .map(([week, stats]) => {
        const total = stats.approved + stats.rejected;
        return {
          week_starting: week,
          accuracy: total > 0 ? Math.round((stats.approved / total) * 100) : null,
          ...stats,
          total_decisions: total,
        };
      })
      .sort((a, b) => a.week_starting.localeCompare(b.week_starting));

    return NextResponse.json({
      success: true,
      total_corrections: correctionList.length,
      corrections_by_type: byType,
      most_corrected_categories: mostCorrectedCategories,
      most_corrected_priorities: mostCorrectedPriorities,
      suppressed_combos: suppressedCombos,
      accuracy_trend: accuracyTrend,
      recent_corrections: correctionList.slice(0, 10).map((c) => ({
        id: c.id,
        title: c.title,
        type: (c.metadata as Record<string, unknown>)?.correction_type || "unknown",
        created_at: c.created_at,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
