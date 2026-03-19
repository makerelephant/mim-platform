import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { getSnapshotPlanPrompt, getSnapshotFormatPrompt } from "@/lib/prompts";

export const maxDuration = 120;

/**
 * POST /api/brain/snapshot
 *
 * CEO asks a question → brain queries data → emits a snapshot card into the feed.
 * This replaces navigating to static CRM pages.
 *
 * Body: { query: "show me the pipeline", context?: "..." }
 *
 * The brain determines which data to pull, queries Supabase, formats it,
 * and emits a "snapshot" card into the feed.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !anthropicKey) {
      return NextResponse.json({ success: false, error: "Missing env vars" }, { status: 500 });
    }

    const { query, context } = await request.json();
    if (!query) {
      return NextResponse.json({ success: false, error: "query is required" }, { status: 400 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const claude = new Anthropic({ apiKey: anthropicKey });

    // ── Step 1: Determine what data to query ──
    const planPrompt = getSnapshotPlanPrompt(query, context);

    const planResponse = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: planPrompt }],
    });

    let planText = planResponse.content[0].type === "text" ? planResponse.content[0].text : "";
    if (planText.includes("```")) {
      planText = planText.split("```")[1];
      if (planText.startsWith("json")) planText = planText.slice(4);
      planText = planText.trim();
    }

    const plan = JSON.parse(planText);

    // ── Step 2: Execute queries ──
    const queryResults: Array<{ table: string; data: unknown[]; error?: string }> = [];

    for (const q of plan.queries) {
      try {
        // Use dynamic query building to avoid TypeScript deep instantiation issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let queryBuilder: any = sb
          .schema(q.schema || "brain")
          .from(q.table)
          .select(q.select || "*");

        // Apply filters
        if (q.filters) {
          for (const f of q.filters) {
            switch (f.op) {
              case "eq": queryBuilder = queryBuilder.eq(f.column, f.value); break;
              case "neq": queryBuilder = queryBuilder.neq(f.column, f.value); break;
              case "gt": queryBuilder = queryBuilder.gt(f.column, f.value); break;
              case "lt": queryBuilder = queryBuilder.lt(f.column, f.value); break;
              case "gte": queryBuilder = queryBuilder.gte(f.column, f.value); break;
              case "lte": queryBuilder = queryBuilder.lte(f.column, f.value); break;
              case "like": queryBuilder = queryBuilder.like(f.column, f.value); break;
              case "ilike": queryBuilder = queryBuilder.ilike(f.column, f.value); break;
              case "in": queryBuilder = queryBuilder.in(f.column, f.value); break;
            }
          }
        }

        // Apply ordering
        if (q.order) {
          queryBuilder = queryBuilder.order(q.order.column, { ascending: q.order.ascending ?? false });
        }

        // Apply limit
        queryBuilder = queryBuilder.limit(q.limit || 20);

        const { data, error } = await queryBuilder;
        queryResults.push({ table: q.table, data: data || [], error: error?.message });
      } catch (e) {
        queryResults.push({ table: q.table, data: [], error: String(e) });
      }
    }

    // ── Step 3: Format results into a readable snapshot ──
    const queryResultsText = queryResults.map(r => `\n### ${r.table} (${r.data.length} results${r.error ? `, error: ${r.error}` : ""})\n${JSON.stringify(r.data, null, 2)}`).join("\n");
    const formatPrompt = getSnapshotFormatPrompt(query, queryResultsText, plan.format_instructions);

    const formatResponse = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{ role: "user", content: formatPrompt }],
    });

    const snapshotBody = formatResponse.content[0].type === "text"
      ? formatResponse.content[0].text
      : "Snapshot generation failed.";

    // ── Step 4: Emit snapshot card ──
    const { data: card, error: insertErr } = await sb
      .schema("brain")
      .from("feed_cards")
      .insert({
        card_type: "snapshot",
        title: plan.title || `Snapshot: ${query.slice(0, 60)}`,
        body: snapshotBody,
        source_type: "snapshot",
        source_ref: `snapshot-${Date.now()}`,
        priority: "medium",
        visibility_scope: "personal",
        metadata: {
          query,
          context: context || null,
          tables_queried: queryResults.map(r => r.table),
          result_counts: queryResults.map(r => ({ table: r.table, count: r.data.length })),
          prompt_tokens: (planResponse.usage?.input_tokens || 0) + (formatResponse.usage?.input_tokens || 0),
          completion_tokens: (planResponse.usage?.output_tokens || 0) + (formatResponse.usage?.output_tokens || 0),
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      card_id: card?.id,
      title: plan.title,
      tables_queried: queryResults.map(r => r.table),
      result_counts: queryResults.map(r => ({ table: r.table, count: r.data.length })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
