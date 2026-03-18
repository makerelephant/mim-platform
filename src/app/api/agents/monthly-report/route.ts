import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { emitFeedCard } from "@/lib/feed-card-emitter";

export const maxDuration = 300;

/**
 * GET /api/agents/monthly-report
 *
 * Monthly Report Generator — Aggregates 30 days of platform activity,
 * CEO actions, entity interactions, and derived insights into a structured
 * report suitable for investor updates or internal reviews.
 *
 * Can be triggered manually or via cron (1st of each month).
 */
export async function GET() {
  const started = Date.now();
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${msg}`);
    console.log(`[monthly-report] ${msg}`);
  };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase config" }, { status: 500 });
    }
    if (!anthropicKey) {
      return NextResponse.json({ success: false, error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffISO = cutoff.toISOString();

    addLog("Gathering 30 days of activity data...");

    // ── 1. Feed cards (last 30 days) — external sources only ──
    const { data: feedCards } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id, card_type, title, priority, status, ceo_action, entity_name, entity_type, acumen_category, source_type, created_at")
      .gte("created_at", cutoffISO)
      .in("source_type", ["gmail_scanner", "slack_scanner", "sheets_scanner", "news_scanner", "ingestion"])
      .not("card_type", "in", '("briefing","reflection","snapshot")')
      .order("created_at", { ascending: false })
      .limit(2000);

    const cards = feedCards ?? [];
    addLog(`Feed cards: ${cards.length}`);

    // ── 2. CEO action stats ──
    const totalActed = cards.filter((c) => c.ceo_action).length;
    const doCount = cards.filter((c) => c.ceo_action === "do").length;
    const holdCount = cards.filter((c) => c.ceo_action === "not_now").length;
    const noCount = cards.filter((c) => c.ceo_action === "no").length;
    const pendingCount = cards.filter((c) => !c.ceo_action && (c.status === "unread" || c.status === "read")).length;

    // ── 3. Category breakdown ──
    const categoryStats: Record<string, { total: number; do: number; no: number; hold: number }> = {};
    for (const c of cards) {
      const cat = c.acumen_category || "uncategorized";
      if (!categoryStats[cat]) categoryStats[cat] = { total: 0, do: 0, no: 0, hold: 0 };
      categoryStats[cat].total += 1;
      if (c.ceo_action === "do") categoryStats[cat].do += 1;
      if (c.ceo_action === "no") categoryStats[cat].no += 1;
      if (c.ceo_action === "not_now") categoryStats[cat].hold += 1;
    }

    // ── 4. Card type breakdown ──
    const cardTypeStats: Record<string, number> = {};
    for (const c of cards) {
      cardTypeStats[c.card_type] = (cardTypeStats[c.card_type] || 0) + 1;
    }

    // ── 5. Priority distribution ──
    const priorityStats: Record<string, number> = {};
    for (const c of cards) {
      priorityStats[c.priority || "unknown"] = (priorityStats[c.priority || "unknown"] || 0) + 1;
    }

    // ── 6. Top entities ──
    const entityFreq: Record<string, { name: string; type: string; count: number }> = {};
    for (const c of cards) {
      if (c.entity_name) {
        const key = c.entity_name;
        if (!entityFreq[key]) entityFreq[key] = { name: c.entity_name, type: c.entity_type || "unknown", count: 0 };
        entityFreq[key].count += 1;
      }
    }
    const topEntities = Object.values(entityFreq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ── 7. Source type breakdown ──
    const sourceStats: Record<string, number> = {};
    for (const c of cards) {
      sourceStats[c.source_type || "unknown"] = (sourceStats[c.source_type || "unknown"] || 0) + 1;
    }

    // ── 8. Recent derived insights ──
    const { data: insights } = await sb
      .schema("brain")
      .from("derived_insights")
      .select("insight_type, description, confidence, created_at")
      .eq("status", "active")
      .gte("created_at", cutoffISO)
      .order("confidence", { ascending: false })
      .limit(20);

    addLog(`Derived insights: ${(insights ?? []).length}`);

    // ── 9. Corrections / learning events ──
    const { data: corrections } = await sb
      .schema("brain")
      .from("decision_log")
      .select("id, decision_type, ceo_correction, created_at")
      .eq("ceo_override", true)
      .gte("created_at", cutoffISO)
      .limit(200);

    addLog(`CEO corrections: ${(corrections ?? []).length}`);

    // ── 10. Knowledge base growth ──
    const { count: kbTotal } = await sb
      .schema("brain")
      .from("knowledge_base")
      .select("id", { count: "exact", head: true });

    const { count: kbNew } = await sb
      .schema("brain")
      .from("knowledge_base")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoffISO);

    addLog(`Knowledge base: ${kbTotal} total, ${kbNew} new this month`);

    // ── Build the data package for Claude ──
    const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const prevMonth = new Date(cutoff).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const dataPackage = {
      period: { from: cutoffISO, to: new Date().toISOString(), label: `${prevMonth} – ${monthName}` },
      feed: {
        total_cards: cards.length,
        by_type: cardTypeStats,
        by_priority: priorityStats,
        by_source: sourceStats,
        by_category: Object.entries(categoryStats)
          .map(([cat, stats]) => ({ category: cat, ...stats }))
          .sort((a, b) => b.total - a.total),
      },
      ceo_engagement: {
        total_acted: totalActed,
        approved: doCount,
        held: holdCount,
        rejected: noCount,
        pending: pendingCount,
        action_rate: cards.length > 0 ? Math.round((totalActed / cards.length) * 100) : 0,
      },
      top_entities: topEntities,
      insights: (insights ?? []).map((i) => ({
        type: i.insight_type,
        description: i.description,
        confidence: i.confidence,
      })),
      corrections: (corrections ?? []).length,
      knowledge_base: { total: kbTotal || 0, new_this_month: kbNew || 0 },
    };

    addLog("Sending data to Claude for report generation...");

    // ── Generate the report ──
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `You are writing a monthly commercial activity report for Made in Motion, a youth sports technology company. This report covers the past 30 days of EXTERNAL business activity — relationships, deals, partnerships, customers, legal matters, finances, product developments, and market signals.

CRITICAL: This report is for the CEO and board. It must focus entirely on COMMERCIAL and EXTERNAL business activity. Do NOT mention the MiMBrain platform, AI systems, training progress, classification accuracy, autonomy metrics, or any internal technology activity. That is invisible infrastructure — it does not appear in this report.

Write a clear, professional report. Structure:

1. **Executive Summary** — 2-3 sentences on the most important commercial takeaways
2. **Key Activity** — Volume and nature of external interactions, breakdown by business category, what the business was engaged with
3. **Key Relationships** — Most active contacts and organisations and what their activity signals for the business
4. **Commercial Signals** — Patterns, trends, or developments worth noting across deals, partnerships, customers, or market
5. **Looking Ahead** — What to watch commercially next month based on the trends observed

Data:
${JSON.stringify(dataPackage, null, 2)}

Keep it under 800 words. Use markdown formatting. Be specific — use real numbers and entity names from the data. Write in first person plural ("we" = Made in Motion).`,
        },
      ],
    });

    const reportText = response.content[0].type === "text"
      ? response.content[0].text
      : "Report generation failed.";

    addLog(`Report generated: ${reportText.length} chars`);

    // ── Extract title ──
    const execSummaryMatch = reportText.match(/\*\*Executive Summary\*\*[:\s—–-]*\n+(.+?)(?:\n|$)/);
    const reportTitle = `Monthly Report — ${monthName}`;

    // ── Emit as a briefing card ──
    await emitFeedCard(sb, {
      card_type: "briefing",
      title: reportTitle,
      body: reportText,
      reasoning: execSummaryMatch ? execSummaryMatch[1].trim() : "Monthly platform activity synthesis",
      source_type: "monthly_report",
      source_ref: `monthly-report-${new Date().toISOString().slice(0, 7)}`,
      priority: "medium",
      confidence: 0.9,
      metadata: {
        report_type: "monthly",
        period: dataPackage.period,
        cards_analyzed: cards.length,
        entities_analyzed: topEntities.length,
        insights_included: (insights ?? []).length,
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
      },
    }, addLog);

    addLog(`Report complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      title: reportTitle,
      report_length: reportText.length,
      cards_analyzed: cards.length,
      duration_ms: Date.now() - started,
      logs,
    });
  } catch (err) {
    addLog(`Fatal error: ${err}`);
    return NextResponse.json({ success: false, error: String(err), logs }, { status: 500 });
  }
}
