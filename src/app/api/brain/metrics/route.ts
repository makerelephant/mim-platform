import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/brain/metrics
 *
 * Computes the full measurement layer for the In Motion feed:
 * - Signal-to-Noise Ratio (SNR) with weekly trend
 * - Priority Calibration per priority level
 * - Category Accuracy with per-category 4-week trend
 * - Card Expansion Rate (from brain.events)
 * - Volume Stats (cards/day, cards/category/day, review rate)
 * - Autonomy Readiness per category
 */

const PRIORITY_LEVELS = ["critical", "high", "medium", "low"] as const;
const AUTONOMY_THRESHOLDS = { reviews: 20, accuracy: 90 };

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // ── Fetch all cards (last 30 days for volume, all for accuracy) ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: allCards, error: cardsErr },
      { data: actedCards, error: actedErr },
      { data: dismissedCards, error: dismissedErr },
      { data: recentCards, error: recentErr },
      { data: expansionEvents, error: eventsErr },
    ] = await Promise.all([
      // All cards for overall stats
      sb.schema("brain")
        .from("feed_cards")
        .select("id, card_type, acumen_category, priority, ceo_action, ceo_correction, status, source_type, created_at")
        .not("card_type", "in", '("briefing","reflection","snapshot")')
        .in("source_type", ["gmail_scanner", "slack_scanner", "sheets_scanner", "news_scanner", "ingestion"]),

      // Acted cards
      sb.schema("brain")
        .from("feed_cards")
        .select("id, card_type, acumen_category, priority, ceo_action, ceo_correction, created_at")
        .eq("status", "acted")
        .not("ceo_action", "is", null)
        .order("created_at", { ascending: false }),

      // Dismissed cards (external sources)
      sb.schema("brain")
        .from("feed_cards")
        .select("id, created_at")
        .eq("status", "dismissed")
        .in("source_type", ["gmail_scanner", "slack_scanner", "sheets_scanner", "news_scanner", "ingestion"])
        .not("card_type", "in", '("briefing","reflection","snapshot")'),

      // Recent cards (last 30 days) for volume stats
      sb.schema("brain")
        .from("feed_cards")
        .select("id, card_type, acumen_category, priority, ceo_action, status, created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false }),

      // Expansion events (last 30 days)
      sb.schema("brain")
        .from("events")
        .select("id, card_id, created_at")
        .eq("event", "card_expanded")
        .gte("created_at", thirtyDaysAgo),
    ]);

    if (cardsErr || actedErr) {
      return NextResponse.json(
        { success: false, error: (cardsErr || actedErr)!.message },
        { status: 500 },
      );
    }

    const cards = allCards || [];
    const acted = actedCards || [];
    const dismissed = dismissedCards || [];
    const recent = recentCards || [];
    const expansions = expansionEvents || [];

    // ─────────────────────────────────────────────────────────────────────────
    // 1. SIGNAL-TO-NOISE RATIO with weekly trend
    // ─────────────────────────────────────────────────────────────────────────

    // Count should_not_exist corrections
    let shouldNotExistCount = 0;
    for (const card of acted) {
      const corr = card.ceo_correction as Record<string, unknown> | null;
      if (corr?.should_not_exist) shouldNotExistCount++;
    }

    const totalApproved = acted.filter(c => c.ceo_action === "do").length;
    const totalHeld = acted.filter(c => c.ceo_action === "not_now").length;
    const totalRejected = acted.filter(c => c.ceo_action === "no").length;

    const worthSeeing = totalApproved + totalHeld;
    const noiseCount = totalRejected + dismissed.length + shouldNotExistCount;
    const snrTotal = worthSeeing + noiseCount;
    const snrOverall = snrTotal > 0 ? Math.round((worthSeeing / snrTotal) * 100) : null;

    // Weekly trend (last 4 weeks)
    const snrWeekly: Array<{ week: string; snr: number | null; total: number }> = [];
    for (let w = 0; w < 4; w++) {
      const weekEnd = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

      const weekActed = acted.filter(c => {
        const d = new Date(c.created_at);
        return d >= weekStart && d < weekEnd;
      });
      const weekDismissed = dismissed.filter(c => {
        const d = new Date(c.created_at);
        return d >= weekStart && d < weekEnd;
      });

      let weekSNE = 0;
      for (const c of weekActed) {
        const corr = c.ceo_correction as Record<string, unknown> | null;
        if (corr?.should_not_exist) weekSNE++;
      }

      const wApproved = weekActed.filter(c => c.ceo_action === "do").length;
      const wHeld = weekActed.filter(c => c.ceo_action === "not_now").length;
      const wRejected = weekActed.filter(c => c.ceo_action === "no").length;
      const wWorth = wApproved + wHeld;
      const wNoise = wRejected + weekDismissed.length + weekSNE;
      const wTotal = wWorth + wNoise;

      snrWeekly.push({
        week: weekLabel,
        snr: wTotal > 0 ? Math.round((wWorth / wTotal) * 100) : null,
        total: wTotal,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. PRIORITY CALIBRATION
    // ─────────────────────────────────────────────────────────────────────────

    const priorityBuckets: Record<string, { do: number; not_now: number; no: number; total: number }> = {};
    for (const p of PRIORITY_LEVELS) {
      priorityBuckets[p] = { do: 0, not_now: 0, no: 0, total: 0 };
    }

    for (const card of acted) {
      const p = (card.priority || "medium") as string;
      if (!priorityBuckets[p]) priorityBuckets[p] = { do: 0, not_now: 0, no: 0, total: 0 };
      priorityBuckets[p].total++;
      if (card.ceo_action === "do") priorityBuckets[p].do++;
      else if (card.ceo_action === "not_now") priorityBuckets[p].not_now++;
      else if (card.ceo_action === "no") priorityBuckets[p].no++;
    }

    const PRIORITY_TARGETS: Record<string, number> = { critical: 90, high: 65, medium: 35, low: 20 };
    const priorityCalibration = PRIORITY_LEVELS.map((p) => {
      const b = priorityBuckets[p];
      const justified = b.do + b.not_now;
      const rated = justified + b.no;
      const doRate = rated > 0 ? Math.round((b.do / rated) * 100) : null;
      const justifiedRate = rated > 0 ? Math.round((justified / rated) * 100) : null;
      const target = PRIORITY_TARGETS[p];
      const calibrated = justifiedRate !== null ? (p === "low" ? justifiedRate <= target : justifiedRate >= target) : null;
      return {
        priority: p,
        do_rate: doRate,
        justified_rate: justifiedRate,
        target,
        do_count: b.do,
        no_count: b.no,
        hold_count: b.not_now,
        total: b.total,
        calibrated,
      };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CATEGORY ACCURACY with 4-week trend
    // ─────────────────────────────────────────────────────────────────────────

    const categoryMap = new Map<string, { approved: number; rejected: number; held: number; total: number }>();
    for (const card of acted) {
      const cat = card.acumen_category || "uncategorized";
      if (!categoryMap.has(cat)) categoryMap.set(cat, { approved: 0, rejected: 0, held: 0, total: 0 });
      const entry = categoryMap.get(cat)!;
      entry.total++;
      if (card.ceo_action === "do") entry.approved++;
      else if (card.ceo_action === "no") entry.rejected++;
      else if (card.ceo_action === "not_now") entry.held++;
    }

    // Per-category 4-week trend
    const categoryTrend: Record<string, Array<{ week: string; accuracy: number | null; total: number }>> = {};
    for (const cat of categoryMap.keys()) {
      categoryTrend[cat] = [];
      for (let w = 0; w < 4; w++) {
        const weekEnd = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
        const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

        const weekCards = acted.filter(c => {
          const d = new Date(c.created_at);
          return (c.acumen_category || "uncategorized") === cat && d >= weekStart && d < weekEnd;
        });

        const wApproved = weekCards.filter(c => c.ceo_action === "do").length;
        const wRejected = weekCards.filter(c => c.ceo_action === "no").length;
        const wRated = wApproved + wRejected;

        categoryTrend[cat].push({
          week: weekLabel,
          accuracy: wRated > 0 ? Math.round((wApproved / wRated) * 100) : null,
          total: weekCards.length,
        });
      }
    }

    const categories = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        accuracy: stats.approved + stats.rejected > 0
          ? Math.round((stats.approved / (stats.approved + stats.rejected)) * 100)
          : null,
        ...stats,
        trend: categoryTrend[category] || [],
      }))
      .sort((a, b) => b.total - a.total);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CARD EXPANSION RATE
    // ─────────────────────────────────────────────────────────────────────────

    const totalRecentCards = recent.length;
    const uniqueExpandedCards = new Set(expansions.map(e => e.card_id).filter(Boolean)).size;
    const expansionRate = totalRecentCards > 0
      ? Math.round((uniqueExpandedCards / totalRecentCards) * 100)
      : null;
    const totalExpansions = expansions.length;

    // Expansion rate weekly trend
    const expansionWeekly: Array<{ week: string; rate: number | null; expansions: number }> = [];
    for (let w = 0; w < 4; w++) {
      const weekEnd = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

      const weekCards = recent.filter(c => {
        const d = new Date(c.created_at);
        return d >= weekStart && d < weekEnd;
      });
      const weekExpansions = expansions.filter(e => {
        const d = new Date(e.created_at);
        return d >= weekStart && d < weekEnd;
      });

      const weekUniqueExpanded = new Set(weekExpansions.map(e => e.card_id).filter(Boolean)).size;

      expansionWeekly.push({
        week: weekLabel,
        rate: weekCards.length > 0 ? Math.round((weekUniqueExpanded / weekCards.length) * 100) : null,
        expansions: weekExpansions.length,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. VOLUME STATS
    // ─────────────────────────────────────────────────────────────────────────

    // Cards per day (last 30 days)
    const dayMap = new Map<string, number>();
    const dayCategoryMap = new Map<string, Map<string, number>>();

    for (const card of recent) {
      const day = new Date(card.created_at).toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) || 0) + 1);

      const cat = card.acumen_category || "uncategorized";
      if (!dayCategoryMap.has(day)) dayCategoryMap.set(day, new Map());
      const catMap = dayCategoryMap.get(day)!;
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    }

    const daysWithCards = dayMap.size;
    const totalRecentVolume = recent.length;
    const avgCardsPerDay = daysWithCards > 0 ? Math.round(totalRecentVolume / daysWithCards) : 0;

    // Review rate
    const reviewedCount = recent.filter(c => c.status === "acted").length;
    const reviewRate = totalRecentVolume > 0
      ? Math.round((reviewedCount / totalRecentVolume) * 100)
      : null;

    // Daily volume for chart (last 14 days)
    const dailyVolume: Array<{ date: string; count: number }> = [];
    for (let d = 13; d >= 0; d--) {
      const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      dailyVolume.push({ date: key, count: dayMap.get(key) || 0 });
    }

    // Category volume breakdown (last 30 days)
    const categoryVolume: Record<string, number> = {};
    for (const card of recent) {
      const cat = card.acumen_category || "uncategorized";
      categoryVolume[cat] = (categoryVolume[cat] || 0) + 1;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. AUTONOMY READINESS
    // ─────────────────────────────────────────────────────────────────────────

    const autonomyReadiness = Array.from(categoryMap.entries())
      .map(([category, stats]) => {
        const accuracy = stats.approved + stats.rejected > 0
          ? Math.round((stats.approved / (stats.approved + stats.rejected)) * 100)
          : 0;
        const reviewsNeeded = Math.max(0, AUTONOMY_THRESHOLDS.reviews - stats.total);
        const accuracyGap = Math.max(0, AUTONOMY_THRESHOLDS.accuracy - accuracy);
        const qualifies = stats.total >= AUTONOMY_THRESHOLDS.reviews && accuracy >= AUTONOMY_THRESHOLDS.accuracy;

        return {
          category,
          reviews: stats.total,
          accuracy,
          reviews_needed: reviewsNeeded,
          accuracy_gap: accuracyGap,
          qualifies,
          threshold_reviews: AUTONOMY_THRESHOLDS.reviews,
          threshold_accuracy: AUTONOMY_THRESHOLDS.accuracy,
        };
      })
      .sort((a, b) => {
        // Qualifying first, then by closest to qualifying
        if (a.qualifies !== b.qualifies) return a.qualifies ? -1 : 1;
        return (a.reviews_needed + a.accuracy_gap) - (b.reviews_needed + b.accuracy_gap);
      });

    // ─────────────────────────────────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      success: true,
      computed_at: new Date().toISOString(),

      snr: {
        current: snrOverall,
        should_not_exist: shouldNotExistCount,
        worth_seeing: worthSeeing,
        noise: noiseCount,
        total: snrTotal,
        weekly: snrWeekly,
        target: 80,
        status: snrOverall === null ? "no_data" : snrOverall >= 80 ? "clean" : snrOverall >= 60 ? "noisy" : "broken",
      },

      priority_calibration: priorityCalibration,

      category_accuracy: categories,

      expansion: {
        rate: expansionRate,
        unique_expanded: uniqueExpandedCards,
        total_expansions: totalExpansions,
        total_cards: totalRecentCards,
        target: 25,
        status: expansionRate === null ? "no_data" : expansionRate <= 25 ? "good" : "needs_improvement",
        weekly: expansionWeekly,
      },

      volume: {
        total_30d: totalRecentVolume,
        avg_per_day: avgCardsPerDay,
        review_rate: reviewRate,
        reviewed: reviewedCount,
        daily: dailyVolume,
        by_category: categoryVolume,
      },

      autonomy_readiness: autonomyReadiness,
    });
  } catch (err) {
    console.error("[metrics] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
