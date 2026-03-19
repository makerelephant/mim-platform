/**
 * Autonomy Engine — Shared utilities
 *
 * Determines which acumen categories have earned autonomous operation.
 * A category qualifies when:
 *   - 20+ CEO reviews (do + no actions)
 *   - 90%+ accuracy (do / (do + no))
 *
 * Used by:
 *   - gmail-scanner.ts (auto-act at classification time)
 *   - api/brain/autonomy/route.ts (reporting endpoint)
 */

import { SupabaseClient } from "@supabase/supabase-js";

export const AUTONOMY_THRESHOLD_REVIEWS = 20;
export const AUTONOMY_THRESHOLD_ACCURACY = 90;

export interface AutonomyCategoryStats {
  category: string;
  accuracy: number;
  reviews: number;
  approved: number;
  rejected: number;
}

/**
 * Query brain.feed_cards for CEO review history and return
 * the list of acumen_category slugs that have earned autonomous status.
 *
 * This is a single DB query — safe to call once per scanner run.
 */
export async function getAutonomousCategories(
  sb: SupabaseClient,
  log?: (msg: string) => void,
): Promise<string[]> {
  const addLog = log || (() => {});

  const { data: actedCards, error } = await sb
    .schema("brain")
    .from("feed_cards")
    .select("acumen_category, ceo_action")
    .eq("status", "acted")
    .not("ceo_action", "is", null)
    .not("acumen_category", "is", null);

  if (error) {
    addLog(`Autonomy check failed: ${error.message}`);
    return [];
  }

  const categoryMap = new Map<string, { approved: number; rejected: number }>();

  for (const card of actedCards || []) {
    const cat = card.acumen_category;
    if (!cat) continue;
    if (!categoryMap.has(cat)) categoryMap.set(cat, { approved: 0, rejected: 0 });
    const entry = categoryMap.get(cat)!;
    if (card.ceo_action === "do") entry.approved++;
    else if (card.ceo_action === "no") entry.rejected++;
  }

  const autonomous: string[] = [];

  for (const [category, stats] of categoryMap) {
    const totalReviews = stats.approved + stats.rejected;
    if (totalReviews < AUTONOMY_THRESHOLD_REVIEWS) continue;

    const accuracy = Math.round((stats.approved / totalReviews) * 100);
    if (accuracy >= AUTONOMY_THRESHOLD_ACCURACY) {
      autonomous.push(category);
      addLog(`Autonomy: ${category} qualifies (${accuracy}% accuracy, ${totalReviews} reviews)`);
    }
  }

  if (autonomous.length === 0) {
    addLog("Autonomy: no categories have reached autonomous threshold yet");
  }

  return autonomous;
}

/**
 * Full autonomy report — used by the /api/brain/autonomy endpoint.
 * Returns detailed stats for all categories plus qualification status.
 */
export async function computeAutonomyReport(sb: SupabaseClient) {
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
