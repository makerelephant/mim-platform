import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

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
    const planPrompt = `You are MiMBrain, an autonomous business intelligence platform for Made in Motion, a youth sports tech company.

The CEO asked: "${query}"
${context ? `Additional context: ${context}` : ""}

Based on this question, determine which database tables to query. Available tables:

CORE SCHEMA (use .schema('core')):
- organizations: id, name, type, status, industry, website, notes, knowledge_completeness_score
- contacts: id, first_name, last_name, email, phone, title, company, status, knowledge_completeness_score

BRAIN SCHEMA (use .schema('brain')):
- tasks: id, title, priority, status, entity_type, entity_id, created_at, due_date
- feed_cards: id, card_type, title, priority, status, ceo_action, entity_name, created_at
- correspondence: id, entity_type, entity_id, channel, direction, subject, from_address, sent_at
- activity: id, entity_type, entity_id, action, actor, metadata, created_at
- classification_log: id, source, entity_name, from_email, subject, classification_result, created_at

Respond with ONLY a JSON object:
{
  "title": "Snapshot title for the card (short, descriptive)",
  "queries": [
    {
      "schema": "core" or "brain",
      "table": "table_name",
      "select": "column1, column2, ...",
      "filters": [{"column": "col", "op": "eq|neq|gt|lt|gte|lte|like|ilike|in", "value": "..."}],
      "order": {"column": "col", "ascending": false},
      "limit": 20
    }
  ],
  "format_instructions": "How to format the results for the CEO"
}`;

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
        let queryBuilder = sb
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
    const formatPrompt = `You are MiMBrain. The CEO asked: "${query}"

Here are the query results:
${queryResults.map(r => `\n### ${r.table} (${r.data.length} results${r.error ? `, error: ${r.error}` : ""})\n${JSON.stringify(r.data, null, 2)}`).join("\n")}

${plan.format_instructions ? `Format instructions: ${plan.format_instructions}` : ""}

Write a clear, concise snapshot for the CEO. Use markdown formatting:
- **Bold** for names and key values
- Use bullet points or numbered lists
- Include counts and totals where relevant
- If data is empty, say so clearly
- Keep it under 600 words
- Be direct — no fluff`;

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
