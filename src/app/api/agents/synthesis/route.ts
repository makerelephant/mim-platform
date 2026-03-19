import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { emitFeedCard } from "@/lib/feed-card-emitter";
import { getWeeklySynthesisPrompt } from "@/lib/prompts";

export const maxDuration = 300;

/**
 * GET /api/agents/synthesis
 *
 * Synthesis Agent — Phase 3 from Architecture v2.
 * Gathers the last 7 days of activity data, sends it to Claude for
 * pattern/correlation/prediction analysis, and stores derived insights
 * in brain.derived_insights. Emits a reflection card into the feed.
 *
 * Can be triggered by cron (weekly) or manually.
 */
export async function GET() {
  const started = Date.now();
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${msg}`);
    console.log(`[synthesis] ${msg}`);
  };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    if (!anthropicKey) {
      return NextResponse.json(
        { success: false, error: "Missing ANTHROPIC_API_KEY" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffISO = cutoff.toISOString();

    addLog("Gathering data from the last 7 days...");

    // ── 1. Gather feed cards and CEO actions — external sources only ──
    const { data: feedCards, error: feedErr } = await sb
      .schema("brain")
      .from("feed_cards")
      .select(
        "id, card_type, title, acumen_family, acumen_category, priority, status, ceo_action, entity_id, entity_type, entity_name, created_at",
      )
      .gte("created_at", cutoffISO)
      .in("source_type", ["gmail_scanner", "slack_scanner", "sheets_scanner", "news_scanner", "ingestion"])
      .not("card_type", "in", '("briefing","reflection","snapshot")')
      .order("created_at", { ascending: false })
      .limit(500);

    if (feedErr) addLog(`Feed cards query error: ${feedErr.message}`);

    const cards = feedCards ?? [];
    addLog(`Feed cards: ${cards.length}`);

    // Aggregate CEO actions by category
    const actionsByCategory: Record<
      string,
      { do_count: number; hold_count: number; no_count: number; total: number }
    > = {};
    for (const card of cards) {
      const cat = card.acumen_category || "uncategorized";
      if (!actionsByCategory[cat]) {
        actionsByCategory[cat] = { do_count: 0, hold_count: 0, no_count: 0, total: 0 };
      }
      actionsByCategory[cat].total += 1;
      if (card.ceo_action === "do") actionsByCategory[cat].do_count += 1;
      else if (card.ceo_action === "hold") actionsByCategory[cat].hold_count += 1;
      else if (card.ceo_action === "no") actionsByCategory[cat].no_count += 1;
    }

    // ── 2. Gather corrections from decision_log ──
    const { data: corrections, error: corrErr } = await sb
      .schema("brain")
      .from("decision_log")
      .select("id, decision_type, decision, ceo_correction, input_summary, created_at")
      .eq("ceo_override", true)
      .gte("created_at", cutoffISO)
      .order("created_at", { ascending: false })
      .limit(100);

    if (corrErr) addLog(`Corrections query error: ${corrErr.message}`);
    addLog(`CEO corrections: ${(corrections ?? []).length}`);

    // ── 3. Entity interaction frequency ──
    const entityFrequency: Record<string, { name: string; type: string; count: number }> = {};
    for (const card of cards) {
      if (card.entity_id && card.entity_name) {
        const key = card.entity_id;
        if (!entityFrequency[key]) {
          entityFrequency[key] = {
            name: card.entity_name,
            type: card.entity_type || "unknown",
            count: 0,
          };
        }
        entityFrequency[key].count += 1;
      }
    }
    const topEntities = Object.entries(entityFrequency)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([id, info]) => ({ id, ...info }));

    // ── 4. Classification distribution ──
    const categoryDistribution: Record<string, number> = {};
    for (const card of cards) {
      const cat = card.acumen_category || "uncategorized";
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    }

    // ── 5. Behavioral rules created recently ──
    const { data: recentRules, error: rulesErr } = await sb
      .schema("brain")
      .from("instructions")
      .select("id, type, prompt, metadata, created_at")
      .eq("type", "behavioral_rule")
      .eq("status", "active")
      .gte("created_at", cutoffISO)
      .limit(50);

    if (rulesErr) addLog(`Rules query error: ${rulesErr.message}`);
    addLog(`Recent behavioral rules: ${(recentRules ?? []).length}`);

    // ── Build the aggregate data package ──
    const aggregateData = {
      period: {
        from: cutoffISO,
        to: new Date().toISOString(),
      },
      feed_summary: {
        total_cards: cards.length,
        by_card_type: cards.reduce(
          (acc: Record<string, number>, c) => {
            acc[c.card_type] = (acc[c.card_type] || 0) + 1;
            return acc;
          },
          {},
        ),
        ceo_actions_by_category: actionsByCategory,
      },
      corrections: (corrections ?? []).map((c) => ({
        decision: c.decision,
        correction: c.ceo_correction,
        context: c.input_summary?.slice(0, 200),
      })),
      top_entities: topEntities,
      category_distribution: categoryDistribution,
      recent_behavioral_rules: (recentRules ?? []).map((r) => ({
        prompt: r.prompt,
        metadata: r.metadata,
      })),
    };

    addLog("Sending aggregate data to Claude for synthesis...");

    // ── 6. Send to Claude for synthesis ──
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const synthesisResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: getWeeklySynthesisPrompt(),
      messages: [
        {
          role: "user",
          content: `Analyze this week's activity data and generate derived insights:\n\n${JSON.stringify(aggregateData, null, 2)}`,
        },
      ],
    });

    const rawText = (
      synthesisResponse.content[0] as { type: "text"; text: string }
    ).text.trim();

    addLog(`Claude response length: ${rawText.length} chars`);

    // ── 7. Parse insights ──
    let insights: Array<{
      type: string;
      description: string;
      confidence: number;
      entity_ids: string[];
      taxonomy_categories: string[];
      scope: Record<string, unknown>;
      review_needed: boolean;
    }>;

    try {
      // Strip markdown code fencing if present
      const cleaned = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      insights = JSON.parse(cleaned);
      if (!Array.isArray(insights)) {
        throw new Error("Response is not an array");
      }
    } catch (parseErr) {
      addLog(`Failed to parse Claude response: ${parseErr}`);
      return NextResponse.json({
        success: false,
        error: "Failed to parse synthesis response",
        raw_response: rawText.slice(0, 500),
        logs,
      });
    }

    addLog(`Parsed ${insights.length} insights`);

    // ── 8. Insert insights into brain.derived_insights ──
    let insertedCount = 0;
    const insightIds: string[] = [];

    for (const insight of insights) {
      // Validate required fields
      if (!insight.type || !insight.description) {
        addLog(`Skipping invalid insight: missing type or description`);
        continue;
      }

      const validTypes = ["pattern", "correlation", "prediction", "recommendation"];
      if (!validTypes.includes(insight.type)) {
        addLog(`Skipping insight with invalid type: ${insight.type}`);
        continue;
      }

      const { data: inserted, error: insertErr } = await sb
        .schema("brain")
        .from("derived_insights")
        .insert({
          insight_type: insight.type,
          description: insight.description,
          evidence: aggregateData,
          confidence: Math.max(0, Math.min(1, insight.confidence ?? 0.5)),
          scope: insight.scope || null,
          entity_ids: insight.entity_ids?.length ? insight.entity_ids : null,
          taxonomy_categories: insight.taxonomy_categories?.length
            ? insight.taxonomy_categories
            : null,
          status: "active",
          review_needed: insight.review_needed ?? false,
          expires_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 30 day expiry
          created_by: "synthesis_agent",
        })
        .select("id")
        .single();

      if (insertErr) {
        addLog(`Failed to insert insight: ${insertErr.message}`);
      } else {
        insertedCount += 1;
        if (inserted?.id) insightIds.push(inserted.id);
      }
    }

    addLog(`Inserted ${insertedCount} insights`);

    // ── 9. Expire old insights that have been superseded ──
    const { error: expireErr } = await sb
      .schema("brain")
      .from("derived_insights")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString());

    if (expireErr) {
      addLog(`Failed to expire old insights: ${expireErr.message}`);
    }

    // ── 10. Emit a reflection card into the feed ──
    if (insertedCount > 0) {
      const insightSummaries = insights
        .filter((i) => i.description)
        .slice(0, 5)
        .map((i) => `- **[${i.type}]** ${i.description} (${Math.round((i.confidence ?? 0.5) * 100)}% confidence)`)
        .join("\n");

      const reviewCount = insights.filter((i) => i.review_needed).length;

      await emitFeedCard(sb, {
        card_type: "reflection",
        title: `Weekly Synthesis: ${insertedCount} new insight${insertedCount === 1 ? "" : "s"} discovered`,
        body: `The brain analyzed ${cards.length} feed cards, ${(corrections ?? []).length} CEO corrections, and ${topEntities.length} active entities from the past week.\n\n**Key Insights:**\n${insightSummaries}${reviewCount > 0 ? `\n\n${reviewCount} insight${reviewCount === 1 ? "" : "s"} flagged for your review.` : ""}`,
        reasoning: `Synthesis agent ran on ${new Date().toISOString()}. Processed ${cards.length} cards across ${Object.keys(categoryDistribution).length} categories. Generated ${insertedCount} insights from aggregate patterns.`,
        source_type: "synthesis_agent",
        priority: reviewCount > 0 ? "medium" : "low",
        confidence: insights.length > 0
          ? insights.reduce((sum, i) => sum + (i.confidence ?? 0.5), 0) / insights.length
          : 0.5,
        metadata: {
          insight_ids: insightIds,
          cards_analyzed: cards.length,
          corrections_analyzed: (corrections ?? []).length,
          entities_analyzed: topEntities.length,
          categories_analyzed: Object.keys(categoryDistribution).length,
          insights_generated: insertedCount,
          review_needed_count: reviewCount,
        },
      }, addLog);
    } else {
      addLog("No insights generated — skipping reflection card");
    }

    // ── 11. Log the agent run ──
    try {
      await sb.schema("brain").from("agent_runs").insert({
        agent: "synthesis",
        status: "completed",
        metadata: {
          cards_analyzed: cards.length,
          corrections_analyzed: (corrections ?? []).length,
          entities_analyzed: topEntities.length,
          insights_generated: insertedCount,
          duration_ms: Date.now() - started,
        },
      });
    } catch {
      /* ignore logging errors */
    }

    addLog(`Synthesis complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      insights_generated: insertedCount,
      cards_analyzed: cards.length,
      corrections_analyzed: (corrections ?? []).length,
      top_entities: topEntities.length,
      duration_ms: Date.now() - started,
      logs,
    });
  } catch (err) {
    addLog(`Fatal error: ${err}`);
    console.error("[synthesis] Fatal error:", err);
    return NextResponse.json(
      { success: false, error: String(err), logs },
      { status: 500 },
    );
  }
}
