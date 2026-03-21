/**
 * Web Intelligence Gopher — External data internalisation (Effort #43)
 *
 * Fetches content from configured URLs and RSS feeds, sends to Claude
 * for analysis of competitive signals, market trends, and key insights,
 * then emits intelligence feed cards for noteworthy findings.
 *
 * Content-change detection via SHA-256 hash stored in brain.agent_runs metadata.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { extractHtml } from "@/lib/document-processor";
import { emitFeedCard, logIngestion, type CardPriority } from "@/lib/feed-card-emitter";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebMonitorSource {
  url: string;
  label: string;
  type: "rss" | "webpage";
  category: string; // e.g. "youth_sports", "ai_commerce", "press_mentions"
}

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

interface InsightAnalysis {
  title: string;
  summary: string;
  relevance: "high" | "medium" | "low";
  relevance_reasoning: string;
  insight_type: "competitive_signal" | "market_trend" | "partnership_opportunity" | "press_mention" | "industry_news" | "technology_shift";
  priority: "critical" | "high" | "medium" | "low";
  key_entities: string[];
  action_suggestion: string | null;
}

export interface WebScanResult {
  success: boolean;
  sourcesScanned: number;
  insightsFound: number;
  cardsEmitted: number;
  skippedUnchanged: number;
  log: string[];
  error?: string;
}

// ─── Default Sources ────────────────────────────────────────────────────────

export const DEFAULT_WEB_SOURCES: WebMonitorSource[] = [
  // Youth sports industry
  {
    url: "https://youthsportsbusinessreport.com/feed/",
    label: "Youth Sports Business Report",
    type: "rss",
    category: "youth_sports",
  },
  {
    url: "https://www.sportsbusinessjournal.com/RSS.aspx",
    label: "Sports Business Journal",
    type: "rss",
    category: "youth_sports",
  },
  {
    url: "https://news.google.com/rss/search?q=%22youth+sports%22+technology&hl=en-US&gl=US&ceid=US:en",
    label: "Google News: Youth Sports Tech",
    type: "rss",
    category: "youth_sports",
  },
  // AI / Generative Commerce
  {
    url: "https://news.google.com/rss/search?q=%22generative+commerce%22+OR+%22AI+commerce%22+OR+%22agentic+commerce%22&hl=en-US&gl=US&ceid=US:en",
    label: "Google News: Generative Commerce",
    type: "rss",
    category: "ai_commerce",
  },
  // Made in Motion press mentions
  {
    url: "https://news.google.com/rss/search?q=%22Made+in+Motion%22+OR+%22MadeInMotion%22+sports&hl=en-US&gl=US&ceid=US:en",
    label: "Google News: Made in Motion mentions",
    type: "rss",
    category: "press_mentions",
  },
];

const MAX_ITEMS_PER_SOURCE = 5;
const MAX_INSIGHTS_PER_RUN = 15;

// ─── Hashing ────────────────────────────────────────────────────────────────

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── RSS Parser (lightweight, same as news-scanner) ─────────────────────────

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const description = extractTag(block, "description");

    if (title && link) {
      items.push({
        title: cleanCdata(title),
        link: cleanCdata(link).trim(),
        pubDate: cleanCdata(pubDate || ""),
        description: cleanCdata(description || ""),
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = regex.exec(xml);
  return m ? m[1] : null;
}

function cleanCdata(text: string): string {
  return text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

// ─── Content Fetchers ───────────────────────────────────────────────────────

async function fetchRssFeed(url: string): Promise<RssItem[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "InMotion/1.0 (web-intelligence-gopher)" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  return parseRssXml(xml);
}

async function fetchWebpage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "InMotion/1.0 (web-intelligence-gopher)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  return extractHtml(html).slice(0, 8000);
}

// ─── Claude Analysis ────────────────────────────────────────────────────────

async function analyzeContent(
  anthropic: Anthropic,
  items: Array<{ title: string; content: string; url: string; source: string; category: string }>,
): Promise<InsightAnalysis[]> {
  const itemsText = items
    .map(
      (item, i) =>
        `--- ITEM ${i + 1} ---\nSOURCE: ${item.source} (${item.category})\nURL: ${item.url}\nTITLE: ${item.title}\nFULL CONTENT:\n${item.content.slice(0, 12000)}`,
    )
    .join("\n\n");

  const prompt = `You are a market intelligence analyst for Made in Motion (MiM), a youth sports technology and merchandise company building generative/agentic commerce platforms.

Analyze these web content items and extract ONLY genuinely noteworthy insights. Skip routine/low-value items.

${itemsText}

For each noteworthy item, return a JSON object. Return ONLY a JSON array (no wrapping, no markdown fences):

[
  {
    "title": "Concise insight headline (max 80 chars)",
    "summary": "2-3 sentence explanation of what this means for MiM",
    "relevance": "high|medium|low",
    "relevance_reasoning": "Why this matters to MiM",
    "insight_type": "competitive_signal|market_trend|partnership_opportunity|press_mention|industry_news|technology_shift",
    "priority": "critical|high|medium|low",
    "key_entities": ["Company Name", "Person Name"],
    "action_suggestion": "What MiM should consider doing, or null if just FYI"
  }
]

RULES:
- Only include items with "high" or "medium" relevance
- If nothing is noteworthy, return an empty array: []
- "press_mention" type is for any mention of Made in Motion / MiM
- "competitive_signal" for competitor moves in youth sports merch/tech
- "market_trend" for industry-wide shifts
- "technology_shift" for AI/commerce tech developments relevant to MiM's stack
- Be selective — quality over quantity. The CEO reads these cards.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
      {
        role: "assistant",
        content: "[",
      },
    ],
  });

  let responseText = "[" + (response.content[0] as { type: "text"; text: string }).text.trim();

  // Strip markdown fences if Claude wrapped it anyway
  if (responseText.includes("```")) {
    const inner = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (inner) responseText = inner[1].trim();
  }

  try {
    const parsed = JSON.parse(responseText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try to extract JSON array from response
    const arrayMatch = responseText.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    return [];
  }
}

// ─── Main Scanner ───────────────────────────────────────────────────────────

export async function runWebIntelligenceScan(
  sb: SupabaseClient,
  overrideUrls?: WebMonitorSource[],
): Promise<WebScanResult> {
  const log: string[] = [];
  const startMs = Date.now();

  try {
    // 1. Load sources: override > brain.instructions > defaults
    let sources: WebMonitorSource[];

    if (overrideUrls && overrideUrls.length > 0) {
      sources = overrideUrls;
      log.push(`Using ${sources.length} override source(s)`);
    } else {
      // Try loading from brain.instructions
      const { data: instructions } = await sb
        .schema("brain")
        .from("instructions")
        .select("content")
        .eq("type", "web_monitor")
        .eq("active", true);

      if (instructions && instructions.length > 0) {
        sources = [];
        for (const instr of instructions) {
          try {
            const parsed = typeof instr.content === "string"
              ? JSON.parse(instr.content)
              : instr.content;
            if (Array.isArray(parsed)) {
              sources.push(...parsed);
            } else if (parsed.url) {
              sources.push(parsed as WebMonitorSource);
            }
          } catch {
            log.push(`  Skipped malformed instruction: ${String(instr.content).slice(0, 50)}`);
          }
        }
        log.push(`Loaded ${sources.length} source(s) from brain.instructions`);
      } else {
        sources = DEFAULT_WEB_SOURCES;
        log.push(`Using ${sources.length} default source(s)`);
      }
    }

    // 2. Load previous content hashes from last agent_run
    const { data: lastRun } = await sb
      .schema("brain")
      .from("agent_runs")
      .select("metadata, output")
      .eq("agent_name", "web-intelligence")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const runMeta = (lastRun?.metadata || lastRun?.output || {}) as Record<string, unknown>;
    const previousHashes: Record<string, string> =
      (runMeta.content_hashes as Record<string, string>) || {};

    // 3. Check for Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      log.push("ERROR: Missing ANTHROPIC_API_KEY");
      return {
        success: false,
        sourcesScanned: 0,
        insightsFound: 0,
        cardsEmitted: 0,
        skippedUnchanged: 0,
        log,
        error: "Missing ANTHROPIC_API_KEY",
      };
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // 4. Fetch content from all sources
    const allItems: Array<{
      title: string;
      content: string;
      url: string;
      source: string;
      category: string;
    }> = [];
    const newHashes: Record<string, string> = {};
    let skippedUnchanged = 0;

    for (const source of sources) {
      try {
        log.push(`Scanning: ${source.label} (${source.type})`);

        if (source.type === "rss") {
          const rssItems = await fetchRssFeed(source.url);
          log.push(`  Found ${rssItems.length} RSS items`);

          // Deduplicate against existing feed cards by source_ref
          const itemUrls = rssItems.slice(0, MAX_ITEMS_PER_SOURCE).map((r) => r.link);
          const { data: existing } = await sb
            .schema("brain")
            .from("feed_cards")
            .select("source_ref")
            .eq("source_type", "web_intelligence")
            .in("source_ref", itemUrls);

          const existingRefs = new Set((existing || []).map((e) => e.source_ref));

          for (const item of rssItems.slice(0, MAX_ITEMS_PER_SOURCE)) {
            if (existingRefs.has(item.link)) {
              log.push(`  Skipped (already has card): ${item.title.slice(0, 50)}`);
              continue;
            }

            const contentToHash = item.title + item.description;
            const hash = await hashContent(contentToHash);
            newHashes[item.link] = hash;

            if (previousHashes[item.link] === hash) {
              skippedUnchanged++;
              continue;
            }

            allItems.push({
              title: item.title,
              content: item.description || item.title,
              url: item.link,
              source: source.label,
              category: source.category,
            });
          }
        } else {
          // Webpage: fetch and hash
          const content = await fetchWebpage(source.url);
          const hash = await hashContent(content);
          newHashes[source.url] = hash;

          if (previousHashes[source.url] === hash) {
            skippedUnchanged++;
            log.push(`  Unchanged since last scan`);
            continue;
          }

          // Check if we already have a card for this URL
          const { data: existingCard } = await sb
            .schema("brain")
            .from("feed_cards")
            .select("id")
            .eq("source_type", "web_intelligence")
            .eq("source_ref", source.url)
            .limit(1);

          if (existingCard && existingCard.length > 0) {
            log.push(`  Skipped (already has card): ${source.label}`);
            continue;
          }

          allItems.push({
            title: source.label,
            content,
            url: source.url,
            source: source.label,
            category: source.category,
          });
        }
      } catch (e) {
        log.push(`  Error scanning ${source.label}: ${String(e).slice(0, 100)}`);
      }
    }

    log.push(`Collected ${allItems.length} items to analyze (${skippedUnchanged} unchanged)`);

    if (allItems.length === 0) {
      // Record agent run even if nothing to analyze
      await recordAgentRun(sb, startMs, newHashes, 0, 0, log);
      return {
        success: true,
        sourcesScanned: sources.length,
        insightsFound: 0,
        cardsEmitted: 0,
        skippedUnchanged,
        log,
      };
    }

    // 5. Analyze in batches (max 15 items to Claude at once)
    const batch = allItems.slice(0, MAX_INSIGHTS_PER_RUN);
    log.push(`Sending ${batch.length} items to Claude for analysis`);

    const insights = await analyzeContent(anthropic, batch);
    log.push(`Claude returned ${insights.length} noteworthy insight(s)`);

    // 6. Emit feed cards for each insight
    let cardsEmitted = 0;

    for (const insight of insights) {
      try {
        // Find the source item this insight came from
        const sourceItem = batch.find(
          (item) =>
            insight.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 20)) ||
            item.title.toLowerCase().includes(insight.title.toLowerCase().slice(0, 20)),
        ) || batch[0];

        const card = await emitFeedCard(
          sb,
          {
            card_type: "intelligence",
            title: insight.title,
            body: `${insight.summary}\n\n**Why this matters:** ${insight.relevance_reasoning}${insight.action_suggestion ? `\n\n**Suggested action:** ${insight.action_suggestion}` : ""}`,
            reasoning: `Web Intelligence Gopher — ${insight.insight_type} from ${sourceItem?.source || "web scan"}`,
            source_type: "web_intelligence",
            source_ref: sourceItem?.url || null,
            acumen_family: "market_intelligence",
            acumen_category: insight.insight_type,
            priority: insight.priority as CardPriority,
            confidence: insight.relevance === "high" ? 0.85 : 0.65,
            visibility_scope: "personal",
            metadata: {
              insight_type: insight.insight_type,
              relevance: insight.relevance,
              key_entities: insight.key_entities,
              source_category: sourceItem?.category || "unknown",
              source_label: sourceItem?.source || "unknown",
              gopher: "web-intelligence",
            },
          },
          (msg) => log.push(msg),
        );

        if (card) {
          cardsEmitted++;

          // Log ingestion
          await logIngestion(sb, {
            source_type: "web_intelligence",
            source_ref: sourceItem?.url || undefined,
            raw_content: sourceItem?.content?.slice(0, 2000) || undefined,
            normalized_content: insight.summary,
            classification: {
              insight_type: insight.insight_type,
              relevance: insight.relevance,
              priority: insight.priority,
            },
            feed_card_id: card.id,
            processing_ms: Date.now() - startMs,
          });
        }
      } catch (e) {
        log.push(`  Error emitting card: ${String(e).slice(0, 100)}`);
      }
    }

    // 7. Record agent run with content hashes
    await recordAgentRun(sb, startMs, newHashes, insights.length, cardsEmitted, log);

    log.push(
      `Scan complete: ${sources.length} sources, ${insights.length} insights, ${cardsEmitted} cards emitted`,
    );

    return {
      success: true,
      sourcesScanned: sources.length,
      insightsFound: insights.length,
      cardsEmitted,
      skippedUnchanged,
      log,
    };
  } catch (err) {
    log.push(`Fatal error: ${String(err)}`);
    return {
      success: false,
      sourcesScanned: 0,
      insightsFound: 0,
      cardsEmitted: 0,
      skippedUnchanged: 0,
      log,
      error: String(err),
    };
  }
}

// ─── Agent Run Recording ────────────────────────────────────────────────────

async function recordAgentRun(
  sb: SupabaseClient,
  startMs: number,
  contentHashes: Record<string, string>,
  insightsFound: number,
  cardsEmitted: number,
  log: string[],
): Promise<void> {
  const now = new Date().toISOString();

  await sb
    .schema("brain")
    .from("agent_runs")
    .insert({
      agent_name: "web-intelligence",
      started_at: new Date(startMs).toISOString(),
      completed_at: now,
      status: "completed",
      output: {
        records_processed: insightsFound,
        records_updated: cardsEmitted,
      },
      metadata: {
        content_hashes: contentHashes,
        insights_found: insightsFound,
        cards_emitted: cardsEmitted,
        log_summary: log.slice(-10),
      },
    });

  // Also log to brain.activity
  await sb
    .schema("brain")
    .from("activity")
    .insert({
      entity_type: "system",
      entity_id: null,
      action: "web_intelligence_scan",
      actor: "web-intelligence-gopher",
      metadata: {
        summary: `Web intelligence scan: ${insightsFound} insights, ${cardsEmitted} cards emitted`,
        duration_ms: Date.now() - startMs,
      },
    });
}
