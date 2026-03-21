/**
 * News Scanner — RSS-powered news ingestion with sentiment analysis.
 *
 * Fetches RSS feeds from configured news sources, extracts article content,
 * analyzes sentiment/relevance via Claude, and stores in knowledge_base.
 * Deduplicates by article URL so repeated runs are safe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { extractHtml } from "@/lib/document-processor";
import { loadTaxonomy } from "@/lib/taxonomy-loader";

/* ── Types ── */

interface NewsSource {
  name: string;
  feed_url: string;
  site_url: string;
}

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  categories: string[];
  sourceName: string;
  thumbnail: string | null;
}

interface ArticleAnalysis {
  summary: string;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  sentiment_score: number;
  relevance_to_mim: "high" | "medium" | "low";
  relevance_reasoning: string;
  key_entities: string[];
  categories: string[];
  tags: string[];
}

export interface NewsScanResult {
  success: boolean;
  articlesFound: number;
  newArticles: number;
  processed: number;
  tasksCreated: number;
  log: string[];
  error?: string;
}

/* ── Default config ── */

const DEFAULT_NEWS_SOURCES: NewsSource[] = [
  {
    name: "Youth Sports Business Report",
    feed_url: "https://youthsportsbusinessreport.com/feed/",
    site_url: "https://youthsportsbusinessreport.com",
  },
];

const MAX_ARTICLES_PER_RUN = 5; // Stay within Vercel 120s timeout

/* ── RSS Parser ── */

function parseRssXml(xml: string, sourceName: string): RssItem[] {
  const items: RssItem[] = [];

  // Match each <item>...</item> block
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    const description = extractTag(block, "description");

    // Extract all <category> tags
    const categories: string[] = [];
    const catRegex = /<category[^>]*>([\s\S]*?)<\/category>/gi;
    let catMatch;
    while ((catMatch = catRegex.exec(block)) !== null) {
      const cat = catMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      if (cat) categories.push(cat);
    }

    // Extract thumbnail from <media:content>, <enclosure>, or <media:thumbnail>
    let thumbnail: string | null = null;
    const mediaMatch = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
    if (mediaMatch) {
      thumbnail = mediaMatch[1];
    } else {
      const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      if (enclosureMatch && /image/i.test(block.match(/<enclosure[^>]+type=["']([^"']+)["']/i)?.[1] || "")) {
        thumbnail = enclosureMatch[1];
      } else {
        const thumbMatch = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
        if (thumbMatch) thumbnail = thumbMatch[1];
      }
    }

    if (title && link) {
      items.push({
        title: cleanCdata(title),
        link: cleanCdata(link).trim(),
        pubDate: cleanCdata(pubDate || ""),
        description: cleanCdata(description || ""),
        categories,
        sourceName,
        thumbnail,
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1] : null;
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

/* ── Article Fetcher ── */

interface ArticleFetchResult {
  text: string;
  ogImage: string | null;
}

async function fetchArticleContent(url: string): Promise<ArticleFetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MiM-Brain/1.0 (news-scanner)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout per article
    });

    if (!response.ok) {
      return { text: `[Failed to fetch article: HTTP ${response.status}]`, ogImage: null };
    }

    const html = await response.text();

    // Extract OG image for thumbnail fallback
    const ogImageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    );
    const ogImage = ogImageMatch ? ogImageMatch[1] : null;

    // Try to extract just the article content area (WordPress common patterns)
    // Look for <article> tag, .entry-content, or .post-content
    const articleMatch = html.match(
      /<article[^>]*>([\s\S]*?)<\/article>/i
    ) ||
      html.match(
        /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
      ) ||
      html.match(
        /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
      );

    const contentHtml = articleMatch ? articleMatch[1] : html;
    return { text: extractHtml(contentHtml), ogImage };
  } catch (e) {
    return { text: `[Article fetch error: ${String(e).slice(0, 100)}]`, ogImage: null };
  }
}

/* ── Claude Sentiment Analyzer ── */

async function analyzeArticle(
  anthropic: Anthropic,
  article: RssItem,
  articleText: string,
  taxonomyContext: string,
): Promise<ArticleAnalysis> {
  const prompt = `Analyze this youth sports industry news article for a company called MiM (Made in Motion) that builds merchandise and technology platforms for youth sports organizations, clubs, leagues, and community groups.

ARTICLE TITLE: ${article.title}
SOURCE: ${article.sourceName}
RSS CATEGORIES: ${article.categories.join(", ") || "none"}
PUBLISHED: ${article.pubDate}

FULL ARTICLE TEXT:
${articleText.slice(0, 12000)}

TAXONOMY CATEGORIES FOR CONTEXT:
${taxonomyContext}

Analyze and return ONLY a JSON object:
{
  "summary": "2-3 sentence summary of the article",
  "sentiment": "positive|negative|neutral|mixed",
  "sentiment_score": 0.0 to 1.0 (0=very negative, 0.5=neutral, 1.0=very positive),
  "relevance_to_mim": "high|medium|low",
  "relevance_reasoning": "1 sentence explaining why this matters (or doesn't) to MiM's youth sports merchandise/technology business",
  "key_entities": ["Organization Name 1", "Person Name 2"],
  "categories": ["category-slug-1"],
  "tags": ["tag1", "tag2", "tag3"]
}

RELEVANCE GUIDE:
- HIGH: Directly about youth sports merchandise, team stores, club technology platforms, youth sports operators, or competitors
- MEDIUM: About youth sports trends, funding, facilities, or organizations that could be MiM customers/partners
- LOW: Tangentially related to youth sports but not actionable for MiM`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  let responseText = (
    response.content[0] as { type: "text"; text: string }
  ).text.trim();

  // Strip markdown code fences if present
  if (responseText.startsWith("```")) {
    responseText = responseText.split("```")[1];
    if (responseText.startsWith("json")) responseText = responseText.slice(4);
    responseText = responseText.trim();
  }

  return JSON.parse(responseText);
}

/* ── Main Scanner ── */

export async function runNewsScan(
  sb: SupabaseClient,
): Promise<NewsScanResult> {
  const log: string[] = [];
  let tasksCreated = 0;

  try {
    // 1. Load agent config
    const { data: agentRow } = await sb
      .from("agents")
      .select("config")
      .eq("slug", "sentiment-scanner")
      .single();

    const newsSources: NewsSource[] =
      agentRow?.config?.news_sources || DEFAULT_NEWS_SOURCES;

    log.push(`Scanning ${newsSources.length} news source(s)`);

    // 2. Load taxonomy for classification context
    const taxonomy = await loadTaxonomy(sb);
    const taxonomyContext = taxonomy
      .map((t) => `- ${t.category} (${t.slug}): ${t.signal_keywords.join(", ")}`)
      .join("\n");

    // 3. Fetch and parse all RSS feeds
    const allItems: RssItem[] = [];

    for (const source of newsSources) {
      try {
        log.push(`Fetching RSS: ${source.name}`);
        const response = await fetch(source.feed_url, {
          headers: { "User-Agent": "MiM-Brain/1.0 (news-scanner)" },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          log.push(`  RSS fetch failed: HTTP ${response.status}`);
          continue;
        }

        const xml = await response.text();
        const items = parseRssXml(xml, source.name);
        log.push(`  Found ${items.length} articles in feed`);
        allItems.push(...items);
      } catch (e) {
        log.push(`  RSS fetch error: ${String(e).slice(0, 100)}`);
      }
    }

    if (allItems.length === 0) {
      log.push("No articles found in any feed");
      return { success: true, articlesFound: 0, newArticles: 0, processed: 0, tasksCreated: 0, log };
    }

    // 4. Deduplicate against existing knowledge_base entries
    const articleUrls = allItems.map((item) => item.link);
    const { data: existingEntries } = await sb
      .from("knowledge_base")
      .select("source_ref")
      .in("source_ref", articleUrls);

    const existingUrls = new Set(
      (existingEntries || []).map((e) => e.source_ref),
    );
    const newItems = allItems.filter((item) => !existingUrls.has(item.link));

    log.push(
      `${allItems.length} total articles, ${newItems.length} new (${existingUrls.size} already ingested)`,
    );

    if (newItems.length === 0) {
      log.push("All articles already ingested — nothing to do");

      await sb.schema('brain').from("activity").insert({
        entity_type: "system",
        entity_id: null,
        action: "news_scan",
        actor: "sentiment-scanner",
        metadata: {
          summary: `News scan: ${allItems.length} articles found, all already ingested`,
          sources: newsSources.map((s) => s.name),
          total: allItems.length,
          new: 0,
        },
      });

      return { success: true, articlesFound: allItems.length, newArticles: 0, processed: 0, tasksCreated: 0, log };
    }

    // 5. Process new articles (limit per run)
    const toProcess = newItems.slice(0, MAX_ARTICLES_PER_RUN);
    log.push(`Processing ${toProcess.length} of ${newItems.length} new articles`);

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      log.push("ERROR: Missing ANTHROPIC_API_KEY");
      return { success: false, articlesFound: allItems.length, newArticles: newItems.length, processed: 0, tasksCreated: 0, log, error: "Missing ANTHROPIC_API_KEY" };
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Load orgs for entity resolution
    const { data: orgs } = await sb
      .schema('core').from("organizations")
      .select("id, name")
      .order("name");

    let processed = 0;

    for (const article of toProcess) {
      try {
        log.push(`  Processing: "${article.title}"`);

        // 5a. Fetch full article content + OG image
        const fetched = await fetchArticleContent(article.link);
        const articleText = fetched.text;
        const thumbnailUrl = article.thumbnail || fetched.ogImage || null;
        if (articleText.startsWith("[")) {
          log.push(`    Fetch failed: ${articleText.slice(0, 80)}`);
        }

        // 5b. Analyze with Claude
        const analysis = await analyzeArticle(
          anthropic,
          article,
          articleText,
          taxonomyContext,
        );

        log.push(
          `    Sentiment: ${analysis.sentiment} (${analysis.sentiment_score}) | Relevance: ${analysis.relevance_to_mim}`,
        );

        // 5c. Entity resolution
        const entityIds: string[] = [];
        for (const mentioned of analysis.key_entities) {
          const nameLower = mentioned.toLowerCase();
          const orgMatch = (orgs || []).find(
            (o) =>
              o.name.toLowerCase().includes(nameLower) ||
              nameLower.includes(o.name.toLowerCase()),
          );
          if (orgMatch && !entityIds.includes(orgMatch.id)) {
            entityIds.push(orgMatch.id);
          }
        }

        // 5d. Store in knowledge_base
        const { error: insertError } = await sb
          .from("knowledge_base")
          .insert({
            title: article.title,
            source_type: "news",
            source_ref: article.link,
            file_type: "html",
            content_text: articleText,
            content_chunks: chunkArticle(articleText),
            summary: analysis.summary,
            taxonomy_categories:
              analysis.categories.length > 0 ? analysis.categories : null,
            entity_ids: entityIds.length > 0 ? entityIds : null,
            tags: analysis.tags.length > 0 ? analysis.tags : null,
            metadata: {
              rss_source: article.sourceName,
              rss_categories: article.categories,
              published_date: article.pubDate,
              thumbnail_url: thumbnailUrl,
              sentiment: analysis.sentiment,
              sentiment_score: analysis.sentiment_score,
              relevance_to_mim: analysis.relevance_to_mim,
              relevance_reasoning: analysis.relevance_reasoning,
              key_entities: analysis.key_entities,
            },
            uploaded_by: "sentiment-scanner",
            processed: true,
            processed_at: new Date().toISOString(),
          });

        if (insertError) {
          log.push(`    DB insert error: ${insertError.message}`);
          continue;
        }

        // 5e. Create task for high-relevance articles
        if (analysis.relevance_to_mim === "high") {
          const { error: taskError } = await sb.schema('brain').from("tasks").insert({
            title: `Review: ${article.title}`,
            description: `${analysis.summary}\n\nRelevance: ${analysis.relevance_reasoning}\nSentiment: ${analysis.sentiment} (${analysis.sentiment_score})\nSource: ${article.link}`,
            priority: "medium",
            status: "open",
            source: "sentiment-scanner",
            source_message_id: article.link,
          });

          if (!taskError) {
            tasksCreated++;
            log.push(`    Created task: "Review: ${article.title}"`);
          }
        }

        processed++;
      } catch (e) {
        log.push(`    Error processing article: ${String(e).slice(0, 100)}`);
      }
    }

    // 6. Log scan to activity_log
    await sb.schema('brain').from("activity").insert({
      entity_type: "system",
      entity_id: null,
      action: "news_scan",
      actor: "sentiment-scanner",
      metadata: {
        summary: `News scan: ${allItems.length} found, ${newItems.length} new, ${processed} processed, ${tasksCreated} tasks created`,
        sources: newsSources.map((s) => s.name),
        total: allItems.length,
        new: newItems.length,
        processed,
        tasks_created: tasksCreated,
      },
    });

    log.push(
      `Scan complete: ${processed} processed, ${tasksCreated} tasks created`,
    );

    return {
      success: true,
      articlesFound: allItems.length,
      newArticles: newItems.length,
      processed,
      tasksCreated,
      log,
    };
  } catch (err) {
    log.push(`Fatal error: ${String(err)}`);
    return {
      success: false,
      articlesFound: 0,
      newArticles: 0,
      processed: 0,
      tasksCreated: 0,
      log,
      error: String(err),
    };
  }
}

/* ── Text Chunking (lightweight, same logic as document-processor) ── */

function chunkArticle(
  text: string,
): { chunk_index: number; text: string; token_count: number }[] {
  if (!text || text.length === 0) return [];

  const CHUNK_CHARS = 2000; // ~500 tokens
  const CHARS_PER_TOKEN = 4;
  const chunks: { chunk_index: number; text: string; token_count: number }[] =
    [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";
  let idx = 0;

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para;
    if (combined.length > CHUNK_CHARS && current) {
      chunks.push({
        chunk_index: idx++,
        text: current.trim(),
        token_count: Math.ceil(current.length / CHARS_PER_TOKEN),
      });
      current = para;
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    chunks.push({
      chunk_index: idx,
      text: current.trim(),
      token_count: Math.ceil(current.length / CHARS_PER_TOKEN),
    });
  }

  return chunks;
}
