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

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // ── Gather ALL relevant data in parallel ──
    const [
      { data: recentCards, error: cardsErr },
      { data: correspondence, error: corrErr },
      { data: tasksCreated, error: tasksCreatedErr },
      { data: tasksCompleted, error: tasksCompletedErr },
      { data: openTasks, error: openTasksErr },
      { data: activity, error: activityErr },
      { data: actedCards, error: actedCardsErr },
    ] = await Promise.all([
      // Feed cards from last 24h
      sb.schema("brain")
        .from("feed_cards")
        .select("id, card_type, title, body, priority, status, ceo_action, ceo_action_at, entity_name, entity_type, acumen_category, source_type, metadata, created_at")
        .gte("created_at", since)
        .neq("card_type", "briefing")
        .order("created_at", { ascending: true }),
      // Correspondence (emails/slack) from last 24h
      sb.schema("brain")
        .from("correspondence")
        .select("id, subject, direction, from_address, to_address, entity_type, entity_id, channel, acumen_category, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      // Tasks created in last 24h
      sb.schema("brain")
        .from("tasks")
        .select("id, title, priority, status, entity_type, entity_id, source, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      // Tasks completed in last 24h
      sb.schema("brain")
        .from("tasks")
        .select("id, title, priority, entity_type, created_at")
        .eq("status", "done")
        .gte("created_at", since),
      // Open tasks (for context)
      sb.schema("brain")
        .from("tasks")
        .select("id, title, priority, status, entity_type, due_date")
        .in("status", ["todo", "in_progress", "open"])
        .order("priority", { ascending: true })
        .limit(20),
      // Brain activity log from last 24h
      sb.schema("brain")
        .from("activity")
        .select("id, actor, action, metadata, entity_type, entity_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100),
      // CEO-acted cards in last 24h (for review stats)
      sb.schema("brain")
        .from("feed_cards")
        .select("id, card_type, ceo_action, acumen_category, ceo_action_at")
        .not("ceo_action", "is", null)
        .gte("ceo_action_at", since),
    ]);

    // Check for fatal errors on primary query
    if (cardsErr) {
      return NextResponse.json({ success: false, error: cardsErr.message }, { status: 500 });
    }

    // Log non-fatal errors but continue
    const queryErrors: string[] = [];
    if (corrErr) queryErrors.push(`correspondence: ${corrErr.message}`);
    if (tasksCreatedErr) queryErrors.push(`tasks_created: ${tasksCreatedErr.message}`);
    if (tasksCompletedErr) queryErrors.push(`tasks_completed: ${tasksCompletedErr.message}`);
    if (openTasksErr) queryErrors.push(`open_tasks: ${openTasksErr.message}`);
    if (activityErr) queryErrors.push(`activity: ${activityErr.message}`);
    if (actedCardsErr) queryErrors.push(`acted_cards: ${actedCardsErr.message}`);

    // ── Compute stats ──
    const cards = recentCards || [];
    const corr = correspondence || [];
    const created = tasksCreated || [];
    const completed = tasksCompleted || [];
    const open = openTasks || [];
    const actLog = activity || [];
    const ceoActed = actedCards || [];

    // Email stats
    const emails = corr.filter((c) => !c.channel || c.channel === "gmail");
    const slackMsgs = corr.filter((c) => c.channel === "slack");
    const inboundEmails = emails.filter((e) => e.direction === "inbound");
    const outboundEmails = emails.filter((e) => e.direction === "outbound");

    // CEO action stats
    const ceoApproved = ceoActed.filter((c) => c.ceo_action === "do").length;
    const ceoRejected = ceoActed.filter((c) => c.ceo_action === "no").length;
    const ceoHeld = ceoActed.filter((c) => c.ceo_action === "not_now").length;
    const totalCeoReviews = ceoActed.length;

    // Card stats
    const decisions = cards.filter((c) => c.card_type === "decision").length;
    const actions = cards.filter((c) => c.card_type === "action").length;
    const signals = cards.filter((c) => c.card_type === "signal").length;
    const intelligence = cards.filter((c) => c.card_type === "intelligence").length;
    const reflections = cards.filter((c) => c.card_type === "reflection").length;
    const pendingCards = cards.filter((c) => c.status === "unread" || c.status === "read").length;
    const criticalCards = cards.filter((c) => c.priority === "critical" || c.priority === "high").length;

    // Entity activity — who was active
    const entityActivity = new Map<string, { name: string; type: string; count: number }>();
    for (const card of cards) {
      if (card.entity_name) {
        const key = `${card.entity_type}:${card.entity_name}`;
        const existing = entityActivity.get(key);
        if (existing) {
          existing.count++;
        } else {
          entityActivity.set(key, { name: card.entity_name, type: card.entity_type || "unknown", count: 1 });
        }
      }
    }
    for (const c of corr) {
      if (c.from_address && c.direction === "inbound") {
        const key = `email:${c.from_address}`;
        const existing = entityActivity.get(key);
        if (existing) {
          existing.count++;
        } else {
          entityActivity.set(key, { name: c.from_address, type: "email_sender", count: 1 });
        }
      }
    }
    const topEntities = Array.from(entityActivity.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Acumen category breakdown
    const categoryBreakdown = new Map<string, number>();
    for (const card of cards) {
      if (card.acumen_category) {
        categoryBreakdown.set(card.acumen_category, (categoryBreakdown.get(card.acumen_category) || 0) + 1);
      }
    }

    // ── Check if there's genuinely nothing to report ──
    const totalActivity = cards.length + corr.length + created.length + completed.length + actLog.length + totalCeoReviews;

    if (totalActivity === 0) {
      // Skip briefing — don't waste an API call on nothing
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "No activity in the last 24 hours — briefing skipped.",
      });
    }

    // ── Build rich context for Claude ──
    const sections: string[] = [];

    // Email activity
    sections.push(`## EMAIL ACTIVITY`);
    sections.push(`- ${emails.length} total emails (${inboundEmails.length} inbound, ${outboundEmails.length} outbound)`);
    if (inboundEmails.length > 0) {
      sections.push(`\nKey inbound emails:`);
      for (const e of inboundEmails.slice(0, 15)) {
        sections.push(`  - From: ${e.from_address} | Subject: ${e.subject || "(no subject)"}${e.acumen_category ? ` | Category: ${e.acumen_category}` : ""}`);
      }
    }

    // Slack activity
    if (slackMsgs.length > 0) {
      sections.push(`\n## SLACK ACTIVITY`);
      sections.push(`- ${slackMsgs.length} messages processed`);
    }

    // Task activity
    sections.push(`\n## TASKS`);
    sections.push(`- ${created.length} new tasks created`);
    sections.push(`- ${completed.length} tasks completed`);
    sections.push(`- ${open.length} tasks currently open`);
    if (created.length > 0) {
      sections.push(`\nNew tasks:`);
      for (const t of created.slice(0, 10)) {
        sections.push(`  - [${t.priority}] ${t.title} (${t.status})`);
      }
    }
    if (open.length > 0 && open.some((t) => t.priority === "critical" || t.priority === "high")) {
      sections.push(`\nHigh-priority open tasks:`);
      for (const t of open.filter((t) => t.priority === "critical" || t.priority === "high")) {
        sections.push(`  - [${t.priority}] ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ""}`);
      }
    }

    // Feed card activity
    sections.push(`\n## FEED CARDS GENERATED`);
    sections.push(`- ${cards.length} total (${decisions} decisions, ${actions} actions, ${signals} signals, ${intelligence} intelligence, ${reflections} reflections)`);
    sections.push(`- ${criticalCards} high/critical priority`);
    sections.push(`- ${pendingCards} still pending review`);

    // Show high-priority unreviewed cards
    const urgentPending = cards.filter((c) =>
      (c.priority === "critical" || c.priority === "high") &&
      (c.status === "unread" || c.status === "read")
    );
    if (urgentPending.length > 0) {
      sections.push(`\nUrgent items awaiting review:`);
      for (const c of urgentPending.slice(0, 10)) {
        sections.push(`  - [${c.card_type.toUpperCase()}/${c.priority}] ${c.title}`);
        if (c.entity_name) sections.push(`    Entity: ${c.entity_name}`);
        if (c.body) sections.push(`    ${c.body.slice(0, 150)}`);
      }
    }

    // CEO review stats
    sections.push(`\n## CEO REVIEW ACTIVITY`);
    sections.push(`- ${totalCeoReviews} cards reviewed (${ceoApproved} approved, ${ceoRejected} rejected, ${ceoHeld} held)`);
    if (totalCeoReviews > 0) {
      const accuracy = ceoApproved + ceoRejected > 0
        ? Math.round((ceoApproved / (ceoApproved + ceoRejected)) * 100)
        : 100;
      sections.push(`- Brain accuracy this period: ${accuracy}%`);
    }

    // Entity activity
    if (topEntities.length > 0) {
      sections.push(`\n## ACTIVE ENTITIES`);
      for (const entity of topEntities) {
        sections.push(`- ${entity.name} (${entity.type}) — ${entity.count} touchpoints`);
      }
    }

    // Category breakdown
    if (categoryBreakdown.size > 0) {
      sections.push(`\n## ACUMEN CATEGORIES`);
      const sorted = Array.from(categoryBreakdown.entries()).sort((a, b) => b[1] - a[1]);
      for (const [cat, count] of sorted) {
        sections.push(`- ${cat}: ${count}`);
      }
    }

    // Brain agent activity
    if (actLog.length > 0) {
      sections.push(`\n## BRAIN ACTIVITY LOG`);
      const actorCounts = new Map<string, number>();
      for (const a of actLog) {
        actorCounts.set(a.actor, (actorCounts.get(a.actor) || 0) + 1);
      }
      for (const [actor, count] of actorCounts.entries()) {
        sections.push(`- ${actor}: ${count} actions`);
      }
    }

    // Key card details (limit to most important)
    const importantCards = cards
      .filter((c) => c.priority === "critical" || c.priority === "high" || c.card_type === "decision" || c.card_type === "intelligence")
      .slice(0, 15);

    if (importantCards.length > 0) {
      sections.push(`\n## KEY CARD DETAILS`);
      for (const c of importantCards) {
        const meta = c.metadata as Record<string, unknown> | null;
        const from = meta?.from_name || meta?.from_email || "";
        const subject = meta?.subject || "";
        const lines = [
          `- [${c.card_type.toUpperCase()}/${c.priority}] ${c.title}`,
          c.entity_name ? `  Entity: ${c.entity_name} (${c.entity_type})` : null,
          from ? `  From: ${from}` : null,
          subject ? `  Subject: ${subject}` : null,
          c.body ? `  ${c.body.slice(0, 200)}` : null,
          c.ceo_action ? `  CEO action: ${c.ceo_action}` : null,
        ];
        sections.push(lines.filter(Boolean).join("\n"));
      }
    }

    const dataContext = sections.join("\n");

    const prompt = `You are the CEO's daily briefing writer for MiMBrain, an autonomous business intelligence platform for Made in Motion (youth sports tech company).

Your job: write a CONCISE, genuinely useful morning briefing based on the real data below. Write like a sharp Chief of Staff — direct, no fluff, only what matters.

CRITICAL RULES:
- Only mention things that ACTUALLY happened (data below). Never fabricate or pad.
- If a section would be empty, SKIP IT entirely. Do not write "No items" or "Nothing to report."
- Keep total length under 400 words. Shorter is better.
- Use specific names, numbers, and subjects from the data.
- If the day was quiet, say so in 2-3 sentences. Don't pad a quiet day into a long report.

## DATA FROM LAST 24 HOURS

${dataContext}

## FORMAT

Write a briefing with ONLY the sections that have real content:

1. **Top Line** — One sentence: the single most important takeaway.
2. **Needs Attention** — Unresolved high-priority items. Name and subject. Skip if none.
3. **What Happened** — Key activity: emails processed, decisions made, tasks created. Use numbers.
4. **Who Was Active** — Which entities/contacts had the most activity. Skip if not interesting.
5. **Brain Performance** — CEO review stats and accuracy. Skip if no reviews happened.
6. **Watch** — Anything the CEO should keep an eye on. Skip if nothing notable.

Omit any section that would be empty or trivial. Be direct.`;

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
        priority: criticalCards > 0 ? "high" : "medium",
        visibility_scope: "personal",
        metadata: {
          cards_analyzed: cards.length,
          emails_total: emails.length,
          emails_inbound: inboundEmails.length,
          emails_outbound: outboundEmails.length,
          slack_messages: slackMsgs.length,
          tasks_created: created.length,
          tasks_completed: completed.length,
          tasks_open: open.length,
          decisions_count: decisions,
          actions_count: actions,
          signals_count: signals,
          ceo_reviews: totalCeoReviews,
          ceo_approved: ceoApproved,
          ceo_rejected: ceoRejected,
          ceo_held: ceoHeld,
          critical_count: criticalCards,
          pending_count: pendingCards,
          active_entities: topEntities.length,
          brain_activity_count: actLog.length,
          period_start: since,
          period_end: now,
          prompt_tokens: response.usage?.input_tokens,
          completion_tokens: response.usage?.output_tokens,
          query_errors: queryErrors.length > 0 ? queryErrors : undefined,
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
      stats: {
        cards: cards.length,
        emails: { total: emails.length, inbound: inboundEmails.length, outbound: outboundEmails.length },
        slack: slackMsgs.length,
        tasks: { created: created.length, completed: completed.length, open: open.length },
        ceo_reviews: { total: totalCeoReviews, approved: ceoApproved, rejected: ceoRejected, held: ceoHeld },
        critical: criticalCards,
        pending: pendingCards,
        active_entities: topEntities.length,
        brain_activity: actLog.length,
      },
      title: briefingTitle,
      autonomy: autonomyResult,
      query_errors: queryErrors.length > 0 ? queryErrors : undefined,
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
