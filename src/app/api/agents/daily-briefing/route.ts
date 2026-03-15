import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
    }
    if (!anthropicKey) {
      return NextResponse.json({ success: false, error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const claude = new Anthropic({ apiKey: anthropicKey });

    // ── Gather last 24 hours of feed cards ──
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentCards, error: cardsErr } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id, card_type, title, body, priority, status, ceo_action, entity_name, entity_type, acumen_category, source_type, metadata, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (cardsErr) {
      return NextResponse.json({ success: false, error: cardsErr.message }, { status: 500 });
    }

    if (!recentCards || recentCards.length === 0) {
      return NextResponse.json({ success: true, message: "No cards in the last 24 hours — nothing to synthesize." });
    }

    // ── Build summary context for Claude ──
    const cardSummaries = recentCards.map((c) => {
      const meta = c.metadata as Record<string, unknown> | null;
      const from = meta?.from_name || meta?.from_email || "";
      const subject = meta?.subject || "";
      return [
        `- [${c.card_type.toUpperCase()}] ${c.title}`,
        `  Priority: ${c.priority} | Status: ${c.status}${c.ceo_action ? ` | CEO action: ${c.ceo_action}` : ""}`,
        c.entity_name ? `  Entity: ${c.entity_name} (${c.entity_type})` : null,
        c.acumen_category ? `  Category: ${c.acumen_category}` : null,
        from ? `  From: ${from}` : null,
        subject ? `  Subject: ${subject}` : null,
        c.body ? `  Summary: ${c.body.slice(0, 200)}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    });

    // Stats
    const total = recentCards.length;
    const decisions = recentCards.filter((c) => c.card_type === "decision").length;
    const actions = recentCards.filter((c) => c.card_type === "action").length;
    const signals = recentCards.filter((c) => c.card_type === "signal").length;
    const acted = recentCards.filter((c) => c.ceo_action).length;
    const pending = recentCards.filter((c) => c.status === "unread" || c.status === "read").length;
    const critical = recentCards.filter((c) => c.priority === "critical" || c.priority === "high").length;

    const prompt = `You are the CEO's daily briefing writer for an autonomous business intelligence platform called MiMBrain, built for a youth sports technology company called Made in Motion.

Your job: synthesize the last 24 hours of activity into a concise, useful morning briefing. Write like a sharp Chief of Staff — direct, no fluff, focused on what matters.

## Activity Summary
- ${total} items processed (${decisions} decisions, ${actions} actions, ${signals} signals)
- ${acted} acted on, ${pending} still pending
- ${critical} high/critical priority items

## All Cards from Last 24 Hours
${cardSummaries.join("\n\n")}

## Instructions
Write a briefing with these sections:
1. **Top Line** — One sentence: the single most important thing from today.
2. **Needs Your Attention** — Items that are unresolved and high priority. Be specific about what and from whom.
3. **Decisions Made** — What was acted on and what was the action.
4. **Patterns** — Any trends worth noting (repeated entities, category clusters, sentiment shifts).
5. **Heads Up** — Anything the CEO should be aware of even if not urgent.

Keep it under 500 words. No corporate speak. Be direct.`;

    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const briefingText =
      response.content[0].type === "text" ? response.content[0].text : "Briefing generation failed.";

    // ── Extract top line as title ──
    const topLineMatch = briefingText.match(/\*\*Top Line\*\*[:\s—–-]*(.+?)(?:\n|$)/);
    const briefingTitle = topLineMatch
      ? topLineMatch[1].replace(/^\*\*|\*\*$/g, "").trim()
      : `Daily Briefing — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;

    // ── Emit briefing card ──
    const { data: card, error: insertErr } = await sb
      .schema("brain")
      .from("feed_cards")
      .insert({
        card_type: "briefing",
        title: briefingTitle,
        body: briefingText,
        source_type: "synthesis",
        source_ref: `daily-briefing-${new Date().toISOString().slice(0, 10)}`,
        priority: critical > 0 ? "high" : "medium",
        visibility_scope: "personal",
        metadata: {
          cards_analyzed: total,
          decisions_count: decisions,
          actions_count: actions,
          signals_count: signals,
          acted_count: acted,
          pending_count: pending,
          critical_count: critical,
          period_start: since,
          period_end: new Date().toISOString(),
          prompt_tokens: response.usage?.input_tokens,
          completion_tokens: response.usage?.output_tokens,
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    // ── Run autonomy check after briefing ──
    let autonomyResult = null;
    try {
      const autonomyRes = await fetch(new URL("/api/brain/autonomy", process.env.NEXT_PUBLIC_SITE_URL || "https://mim-platform.vercel.app"), {
        method: "POST",
      });
      autonomyResult = await autonomyRes.json();
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      card_id: card?.id,
      stats: { total, decisions, actions, signals, acted, pending, critical },
      title: briefingTitle,
      autonomy: autonomyResult,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Allow GET for easy testing
export async function GET() {
  return POST();
}
