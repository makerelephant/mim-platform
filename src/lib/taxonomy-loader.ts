/**
 * Taxonomy Loader
 *
 * Shared module used by scanners, dashboard, and API routes to load
 * the inference taxonomy from the database. Falls back to hardcoded
 * defaults if the table is empty or doesn't exist yet.
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PriorityRule {
  condition: string;
  priority: "low" | "medium" | "high" | "critical";
}

export interface TaxonomyActions {
  create_task: boolean;
  route_to_card: boolean;
  send_alert: boolean;
}

export interface TaxonomyCategory {
  id: string;
  category: string;
  slug: string;
  description: string | null;
  signal_keywords: string[];
  org_type_match: string | null;
  dashboard_card_key: string | null;
  prompt_fragment: string | null;
  priority_rules: PriorityRule[];
  actions: TaxonomyActions;
  icon: string | null;
  color: string | null;
  active: boolean;
  sort_order: number;
}

// ─── Hardcoded Defaults (backward compatibility) ────────────────────────────

export const DEFAULT_TAXONOMY: TaxonomyCategory[] = [
  {
    id: "default-fundraising",
    category: "Fundraising",
    slug: "fundraising",
    description: "Investor communications: fundraising rounds, term sheets, due diligence",
    signal_keywords: [
      "fundraising", "investment", "investor", "deal-update", "term-sheet",
      "due-diligence", "funding", "capital", "seed-round", "series-a", "valuation",
    ],
    org_type_match: "Investor",
    dashboard_card_key: "investors",
    prompt_fragment: "Investors: venture capital firms, angel investors, seed funds. Communications about fundraising, cap tables, term sheets, due diligence, pitch decks, portfolio updates, financial projections.",
    priority_rules: [
      { condition: "term-sheet", priority: "critical" },
      { condition: "due-diligence", priority: "high" },
    ],
    actions: { create_task: true, route_to_card: true, send_alert: false },
    icon: "TrendingUp",
    color: "text-green-600",
    active: true,
    sort_order: 1,
  },
  {
    id: "default-partnership",
    category: "Partnerships",
    slug: "partnership",
    description: "Partner communications: distribution, integration, co-marketing, team stores",
    signal_keywords: [
      "partnership", "partner", "team-store", "merch", "co-brand",
      "distribution", "reseller", "channel-partner", "sponsorship",
    ],
    org_type_match: "Partner",
    dashboard_card_key: "partners",
    prompt_fragment: "Partners (Channel Partners): distribution partners, resellers, platform integrators, affiliates. Communications about partnership agreements, revenue sharing, integration, co-marketing, referrals.",
    priority_rules: [
      { condition: "partnership-agreement", priority: "high" },
      { condition: "integration", priority: "medium" },
    ],
    actions: { create_task: true, route_to_card: true, send_alert: false },
    icon: "Handshake",
    color: "text-emerald-600",
    active: true,
    sort_order: 2,
  },
  {
    id: "default-community",
    category: "Communities",
    slug: "community",
    description: "Customer communications: merchandise, team stores, onboarding, support",
    signal_keywords: [
      "customer", "support", "onboarding", "renewal", "subscription",
      "churn", "upsell", "client", "account-management",
    ],
    org_type_match: "Customer",
    dashboard_card_key: "customers",
    prompt_fragment: "Communities (Customers): youth sports organizations, clubs, leagues, schools, recreation centers. Communications about merchandise, tournaments, player registrations, outreach, uniforms, team stores, Drop links.",
    priority_rules: [
      { condition: "churn", priority: "critical" },
      { condition: "large-order", priority: "high" },
    ],
    actions: { create_task: true, route_to_card: true, send_alert: false },
    icon: "Users",
    color: "text-blue-600",
    active: true,
    sort_order: 3,
  },
];

// ─── Load Taxonomy from Database ────────────────────────────────────────────

/**
 * Fetch active taxonomy categories from the database.
 * Falls back to DEFAULT_TAXONOMY if the table is empty or query fails.
 */
export async function loadTaxonomy(
  sb: SupabaseClient,
): Promise<TaxonomyCategory[]> {
  try {
    const { data, error } = await sb
      .from("inference_taxonomy")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("[taxonomy-loader] Query error, using defaults:", error.message);
      return DEFAULT_TAXONOMY;
    }

    if (!data || data.length === 0) {
      console.warn("[taxonomy-loader] No taxonomy rows found, using defaults");
      return DEFAULT_TAXONOMY;
    }

    return data.map((row) => ({
      id: row.id,
      category: row.category,
      slug: row.slug,
      description: row.description,
      signal_keywords: Array.isArray(row.signal_keywords) ? row.signal_keywords : [],
      org_type_match: row.org_type_match,
      dashboard_card_key: row.dashboard_card_key,
      prompt_fragment: row.prompt_fragment,
      priority_rules: Array.isArray(row.priority_rules) ? row.priority_rules : [],
      actions: row.actions ?? { create_task: true, route_to_card: true, send_alert: false },
      icon: row.icon,
      color: row.color,
      active: row.active,
      sort_order: row.sort_order,
    }));
  } catch (err) {
    console.warn("[taxonomy-loader] Exception, using defaults:", err);
    return DEFAULT_TAXONOMY;
  }
}

// ─── Helper: Get Signal Keywords for a Dashboard Card ───────────────────────

/**
 * Returns the merged signal_keywords for a given dashboard_card_key.
 * Replaces hardcoded INVESTOR_TAGS / PARTNER_TAGS / CUSTOMER_TAGS.
 */
export function getSignalKeywords(
  taxonomy: TaxonomyCategory[],
  dashboardCardKey: string,
): string[] {
  const keywords: string[] = [];
  for (const cat of taxonomy) {
    if (cat.dashboard_card_key === dashboardCardKey) {
      keywords.push(...cat.signal_keywords);
    }
  }
  return keywords;
}

// ─── Helper: Match Tags to a Taxonomy Category ─────────────────────────────

/**
 * Given a list of tags (from classifier output), find the best matching
 * taxonomy category. Returns null if no match.
 */
export function matchTaxonomyCategory(
  tags: string[],
  taxonomy: TaxonomyCategory[],
): TaxonomyCategory | null {
  if (!tags || tags.length === 0) return null;

  const lowerTags = tags.map((t) => t.toLowerCase());

  let bestMatch: TaxonomyCategory | null = null;
  let bestScore = 0;

  for (const cat of taxonomy) {
    let score = 0;
    for (const keyword of cat.signal_keywords) {
      const lk = keyword.toLowerCase();
      if (lowerTags.some((t) => t.includes(lk) || lk.includes(t))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }

  return bestMatch;
}

// ─── Helper: Check if Tags Match a Specific Category ────────────────────────

/**
 * Returns true if any of the given tags match any signal_keyword
 * for the specified list of intent keywords.
 */
export function tagsMatchKeywords(
  tags: string[],
  keywords: string[],
): boolean {
  return tags.some((t) =>
    keywords.some((k) => t.toLowerCase().includes(k.toLowerCase())),
  );
}

// ─── Build Classifier System Prompt ─────────────────────────────────────────

/**
 * Dynamically assemble the entity type section of the classifier prompt
 * from taxonomy rows. The basePrompt should contain a {{TAXONOMY_SECTION}}
 * placeholder that gets replaced.
 */
export function buildTaxonomyPromptSection(
  taxonomy: TaxonomyCategory[],
): string {
  const lines: string[] = [
    "ENTITY CATEGORIES (from the company's inference taxonomy):",
    "",
  ];

  for (const cat of taxonomy) {
    if (cat.prompt_fragment) {
      lines.push(`### ${cat.category}`);
      lines.push(cat.prompt_fragment);
      if (cat.signal_keywords.length > 0) {
        lines.push(`Common tags: ${cat.signal_keywords.slice(0, 10).join(", ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
