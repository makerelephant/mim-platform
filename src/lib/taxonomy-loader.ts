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
  {
    id: "default-youth-sports",
    category: "Youth Sports",
    slug: "youth-sports",
    description: "Youth sports industry news, trends, leagues, clubs, tournaments, and sub-sport categories",
    signal_keywords: [
      "youth-sports", "youth-soccer", "youth-hockey", "youth-basketball", "youth-lacrosse",
      "youth-volleyball", "club-sports", "travel-sports", "tournament", "aau", "usys",
      "ecnl", "ga-league", "mlsnext", "usclub", "little-league", "pop-warner",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "Youth sports industry: any news about youth soccer, hockey, basketball, lacrosse, volleyball, or other youth athletics. Includes leagues (ECNL, GA, MLS NEXT, USYS, AAU), clubs, tournaments, travel sports, and youth development programs.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Trophy",
    color: "text-orange-600",
    active: true,
    sort_order: 4,
  },
  {
    id: "default-generative-commerce",
    category: "Generative Commerce",
    slug: "generative-commerce",
    description: "AI-powered commerce models, generative product design, on-demand manufacturing, personalized merchandise",
    signal_keywords: [
      "generative-commerce", "ai-commerce", "on-demand", "print-on-demand", "personalization",
      "custom-merch", "ai-design", "generative-design", "dynamic-pricing", "ai-retail",
      "commerce-ai", "product-generation", "mass-customization",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "Generative commerce and new commerce models leveraging AI: on-demand manufacturing, AI-powered product design, personalized merchandise, dynamic pricing, AI retail innovations.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Sparkles",
    color: "text-pink-600",
    active: true,
    sort_order: 5,
  },
  {
    id: "default-ai-innovation",
    category: "AI Innovation",
    slug: "ai-innovation",
    description: "Major AI announcements, model releases, breakthroughs, benchmarks, and industry shifts",
    signal_keywords: [
      "ai-innovation", "ai-announcement", "llm", "foundation-model", "gpt", "claude",
      "gemini", "llama", "mistral", "openai", "anthropic", "deepmind", "meta-ai",
      "ai-breakthrough", "benchmark", "ai-safety", "reasoning-model",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "AI innovation announcements: new model releases, capability breakthroughs, benchmark results, research papers, safety developments from OpenAI, Anthropic, Google DeepMind, Meta, Mistral, and others.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Zap",
    color: "text-violet-600",
    active: true,
    sort_order: 6,
  },
  {
    id: "default-ai-thought-leaders",
    category: "AI Thought Leaders",
    slug: "ai-thought-leaders",
    description: "Opinions, interviews, and updates from key AI leaders: Dario Amodei, Sam Altman, and others",
    signal_keywords: [
      "dario-amodei", "sam-altman", "demis-hassabis", "yann-lecun", "ilya-sutskever",
      "jensen-huang", "satya-nadella", "thought-leader", "ai-leadership", "ai-policy",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "AI thought leaders: commentary, interviews, and announcements from Dario Amodei (Anthropic), Sam Altman (OpenAI), Demis Hassabis (DeepMind), Jensen Huang (NVIDIA), and other influential AI voices.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Mic",
    color: "text-amber-600",
    active: true,
    sort_order: 7,
  },
  {
    id: "default-agentic-commerce",
    category: "Agentic Commerce",
    slug: "agentic-commerce",
    description: "AI agents in commerce: autonomous shopping, agent-to-agent transactions, agentic workflows in retail",
    signal_keywords: [
      "agentic-commerce", "ai-agent", "autonomous-shopping", "agent-workflow",
      "agent-to-agent", "commerce-agent", "agentic-workflow", "agentic-ai",
      "autonomous-commerce", "agent-framework", "tool-use",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "Agentic commerce: AI agents that autonomously browse, compare, purchase, and transact. Agent-to-agent commerce, agentic workflows in retail, and the emerging agent economy.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Bot",
    color: "text-cyan-600",
    active: true,
    sort_order: 8,
  },
  {
    id: "default-openclaw",
    category: "OpenClaw",
    slug: "openclaw",
    description: "OpenClaw project news, updates, and related open-source AI initiatives",
    signal_keywords: ["openclaw", "open-claw", "open-source-ai", "oss-ai"],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "OpenClaw: any news, updates, releases, or discussions related to the OpenClaw project.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Cog",
    color: "text-red-600",
    active: true,
    sort_order: 9,
  },
  {
    id: "default-mit",
    category: "MIT",
    slug: "mit",
    description: "MIT research, alumni news, CSAIL, Media Lab, and MIT-affiliated AI/tech developments",
    signal_keywords: [
      "mit", "massachusetts-institute-of-technology", "csail", "mit-media-lab",
      "mit-sloan", "mit-research", "mit-alumni", "mit-technology-review",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "MIT (Massachusetts Institute of Technology): research publications, alumni news, CSAIL and Media Lab developments, MIT Sloan, MIT Technology Review articles, and MIT-affiliated AI or tech breakthroughs.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "GraduationCap",
    color: "text-red-700",
    active: true,
    sort_order: 10,
  },
  {
    id: "default-ai-ui-ux",
    category: "AI + UI/UX",
    slug: "ai-ui-ux",
    description: "The intersection of AI with user interfaces and user experience design",
    signal_keywords: [
      "ai-ux", "ai-ui", "ai-interface", "generative-ui", "conversational-ui",
      "ai-design-system", "copilot-ux", "ai-assistant-ui", "natural-language-ui",
      "adaptive-interface", "human-ai-interaction", "prompt-ui",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "The intersection of AI and UI/UX: generative user interfaces, conversational UI, AI copilot experiences, adaptive interfaces, human-AI interaction design, and how AI is transforming frontend and user experience.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Palette",
    color: "text-indigo-600",
    active: true,
    sort_order: 11,
  },
  {
    id: "default-local-models",
    category: "Local Models",
    slug: "local-models",
    description: "On-device AI, local inference, edge models, and self-hosted LLM developments",
    signal_keywords: [
      "local-model", "on-device-ai", "edge-ai", "ollama", "llama-cpp", "gguf",
      "quantization", "mlx", "local-inference", "self-hosted-llm", "private-ai",
      "small-language-model", "slm",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "Local and on-device AI models: Ollama, llama.cpp, MLX, quantized models, GGUF, edge deployment, self-hosted LLMs, small language models (SLMs), and the movement toward private, local AI inference.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "HardDrive",
    color: "text-slate-600",
    active: true,
    sort_order: 12,
  },
  {
    id: "default-mcp",
    category: "MCP",
    slug: "mcp",
    description: "Model Context Protocol news, server implementations, integrations, and ecosystem developments",
    signal_keywords: [
      "mcp", "model-context-protocol", "mcp-server", "mcp-client", "mcp-tool",
      "claude-mcp", "mcp-integration", "mcp-ecosystem", "context-protocol",
    ],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "MCP (Model Context Protocol): news about the standard, new MCP server implementations, client integrations, ecosystem growth, and how MCP enables AI agents to interact with external systems.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Plug",
    color: "text-purple-600",
    active: true,
    sort_order: 13,
  },
  {
    id: "default-crawl4ai",
    category: "Crawl4AI",
    slug: "crawl4ai",
    description: "Crawl4AI project updates, web scraping for AI, and structured data extraction",
    signal_keywords: ["crawl4ai", "crawl-4-ai", "web-scraping-ai", "ai-crawler", "structured-extraction"],
    org_type_match: null,
    dashboard_card_key: "sentiment",
    prompt_fragment: "Crawl4AI: updates, releases, and discussions about the Crawl4AI project for web scraping and structured data extraction for AI applications.",
    priority_rules: [],
    actions: { create_task: false, route_to_card: true, send_alert: false },
    icon: "Globe",
    color: "text-teal-600",
    active: true,
    sort_order: 14,
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
