import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { emitFeedCard } from "@/lib/feed-card-emitter";
import {
  getMonthlyReportPrompt,
  getWeeklySynthesisPrompt,
  getCustomReportPrompt,
} from "@/lib/prompts";

export const maxDuration = 300;

/**
 * POST /api/agents/report
 *
 * Unified Report Generator — Generates weekly, monthly, or custom reports.
 *
 * Body:
 *   type: "weekly" | "monthly" | "custom"
 *   period_days?: number (default: 7 for weekly, 30 for monthly, required for custom)
 *   focus?: string (required for custom — the topic to focus on)
 *   format?: "card" | "markdown" (default: "card" — also emits a feed card)
 *
 * Returns:
 *   { success, title, report_markdown, report_plaintext, cards_analyzed, duration_ms, logs }
 *
 * TODO: PDF export (requires a rendering library like puppeteer or @react-pdf/renderer)
 * TODO: Email export (requires email sending integration)
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${msg}`);
    console.log(`[report] ${msg}`);
  };

  try {
    const body = await req.json();
    const reportType: string = body.type;
    const format: string = body.format || "card";

    if (!reportType || !["weekly", "monthly", "custom"].includes(reportType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "weekly", "monthly", or "custom".' },
        { status: 400 },
      );
    }

    if (reportType === "custom" && !body.focus) {
      return NextResponse.json(
        { success: false, error: 'Custom reports require a "focus" field.' },
        { status: 400 },
      );
    }

    // Determine period
    let periodDays: number;
    if (body.period_days) {
      periodDays = Math.max(1, Math.min(365, Number(body.period_days)));
    } else if (reportType === "monthly") {
      periodDays = 30;
    } else {
      periodDays = 7;
    }

    const focus: string | undefined = body.focus;

    addLog(`Report request: type=${reportType}, period=${periodDays}d, focus=${focus || "none"}, format=${format}`);

    // ── Validate env ──
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

    // ── Gather data ──
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - periodDays);
    const cutoffISO = cutoff.toISOString();

    addLog(`Gathering ${periodDays} days of activity data (since ${cutoffISO.slice(0, 10)})...`);

    // 1. Feed cards (external sources only)
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

    // 2. CEO action stats
    const totalActed = cards.filter((c) => c.ceo_action).length;
    const doCount = cards.filter((c) => c.ceo_action === "do").length;
    const holdCount = cards.filter((c) => c.ceo_action === "not_now").length;
    const noCount = cards.filter((c) => c.ceo_action === "no").length;
    const pendingCount = cards.filter((c) => !c.ceo_action && (c.status === "unread" || c.status === "read")).length;

    // 3. Category breakdown
    const categoryStats: Record<string, { total: number; do: number; no: number; hold: number }> = {};
    for (const c of cards) {
      const cat = c.acumen_category || "uncategorized";
      if (!categoryStats[cat]) categoryStats[cat] = { total: 0, do: 0, no: 0, hold: 0 };
      categoryStats[cat].total += 1;
      if (c.ceo_action === "do") categoryStats[cat].do += 1;
      if (c.ceo_action === "no") categoryStats[cat].no += 1;
      if (c.ceo_action === "not_now") categoryStats[cat].hold += 1;
    }

    // 4. Card type breakdown
    const cardTypeStats: Record<string, number> = {};
    for (const c of cards) {
      cardTypeStats[c.card_type] = (cardTypeStats[c.card_type] || 0) + 1;
    }

    // 5. Priority distribution
    const priorityStats: Record<string, number> = {};
    for (const c of cards) {
      priorityStats[c.priority || "unknown"] = (priorityStats[c.priority || "unknown"] || 0) + 1;
    }

    // 6. Top entities
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

    // 7. Source type breakdown
    const sourceStats: Record<string, number> = {};
    for (const c of cards) {
      sourceStats[c.source_type || "unknown"] = (sourceStats[c.source_type || "unknown"] || 0) + 1;
    }

    // 8. Derived insights
    const { data: insights } = await sb
      .schema("brain")
      .from("derived_insights")
      .select("insight_type, description, confidence, created_at")
      .eq("status", "active")
      .gte("created_at", cutoffISO)
      .order("confidence", { ascending: false })
      .limit(20);

    addLog(`Derived insights: ${(insights ?? []).length}`);

    // 9. Corrections
    const { data: corrections } = await sb
      .schema("brain")
      .from("decision_log")
      .select("id, decision_type, ceo_correction, created_at")
      .eq("ceo_override", true)
      .gte("created_at", cutoffISO)
      .limit(200);

    addLog(`CEO corrections: ${(corrections ?? []).length}`);

    // 10. Knowledge base growth
    const { count: kbTotal } = await sb
      .schema("brain")
      .from("knowledge_base")
      .select("id", { count: "exact", head: true });

    const { count: kbNew } = await sb
      .schema("brain")
      .from("knowledge_base")
      .select("id", { count: "exact", head: true })
      .gte("created_at", cutoffISO);

    addLog(`Knowledge base: ${kbTotal} total, ${kbNew} new in period`);

    // ── Build the data package ──
    const now = new Date();
    const periodLabel = periodDays <= 7
      ? "This Week"
      : periodDays <= 14
        ? "Last 2 Weeks"
        : periodDays <= 30
          ? "This Month"
          : `Last ${periodDays} Days`;

    const dataPackage = {
      period: { from: cutoffISO, to: now.toISOString(), days: periodDays, label: periodLabel },
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
      knowledge_base: { total: kbTotal || 0, new_in_period: kbNew || 0 },
    };

    addLog("Sending data to Claude for report generation...");

    // ── Generate the report ──
    let reportText: string;
    let reportTitle: string;

    if (reportType === "weekly") {
      // Weekly synthesis produces JSON insights — we generate a readable report instead
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `You are writing a weekly commercial activity report for Made in Motion, a youth sports technology company. This report covers the past ${periodDays} days of EXTERNAL business activity.

CRITICAL: Focus entirely on COMMERCIAL and EXTERNAL business activity. Do NOT mention the MiMBrain platform, AI systems, training progress, classification accuracy, autonomy metrics, or any internal technology activity.

Write a clear, professional report. Structure:

1. **Executive Summary** — 2-3 sentences on the week's most important commercial takeaways
2. **Key Activity** — Volume and nature of external interactions this week
3. **Key Relationships** — Most active contacts and organisations
4. **Signals & Trends** — Patterns worth noting
5. **Next Week** — What to watch

Data:
${JSON.stringify(dataPackage, null, 2)}

Keep it under 600 words. Use markdown formatting. Be specific — use real numbers and entity names. Write in first person plural ("we" = Made in Motion).`,
          },
        ],
      });

      reportText = response.content[0].type === "text" ? response.content[0].text : "Report generation failed.";
      const weekLabel = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      reportTitle = `Weekly Report — ${weekLabel}`;
    } else if (reportType === "monthly") {
      // Reuse existing monthly report prompt
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: getMonthlyReportPrompt(JSON.stringify(dataPackage, null, 2)),
          },
        ],
      });

      reportText = response.content[0].type === "text" ? response.content[0].text : "Report generation failed.";
      const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      reportTitle = `Monthly Report — ${monthName}`;
    } else {
      // Custom report
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: getCustomReportPrompt(focus!, periodDays, JSON.stringify(dataPackage, null, 2)),
          },
        ],
      });

      reportText = response.content[0].type === "text" ? response.content[0].text : "Report generation failed.";
      reportTitle = `Report: ${focus!.slice(0, 60)}`;
    }

    addLog(`Report generated: ${reportText.length} chars`);

    // ── Strip markdown for plain text version ──
    const reportPlaintext = reportText
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/`/g, "")
      .replace(/---/g, "")
      .trim();

    // ── Emit as a briefing card (unless format=markdown) ──
    if (format !== "markdown") {
      const sourceRef = `${reportType}-report-${now.toISOString().slice(0, 10)}-${Date.now()}`;

      await emitFeedCard(sb, {
        card_type: "briefing",
        title: reportTitle,
        body: reportText,
        reasoning: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated on demand. ${cards.length} cards analyzed over ${periodDays} days.${focus ? ` Focus: ${focus}` : ""}`,
        source_type: `${reportType}_report`,
        source_ref: sourceRef,
        priority: "medium",
        confidence: 0.9,
        metadata: {
          report_type: reportType,
          period_days: periodDays,
          focus: focus || null,
          period: dataPackage.period,
          cards_analyzed: cards.length,
          entities_analyzed: topEntities.length,
          insights_included: (insights ?? []).length,
        },
      }, addLog);
    }

    addLog(`Report complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      title: reportTitle,
      report_markdown: reportText,
      report_plaintext: reportPlaintext,
      report_type: reportType,
      period_days: periodDays,
      focus: focus || null,
      cards_analyzed: cards.length,
      duration_ms: Date.now() - started,
      logs,
    });
  } catch (err) {
    addLog(`Fatal error: ${err}`);
    return NextResponse.json({ success: false, error: String(err), logs }, { status: 500 });
  }
}
