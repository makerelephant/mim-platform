import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/engine/health — Platform health check
 *
 * Returns status of all automated systems:
 * - Last scanner run time
 * - Last briefing time
 * - Last synthesis time
 * - Feed card counts
 * - Database connectivity
 */
export async function GET() {
  const started = Date.now();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      success: false,
      status: "unhealthy",
      error: "Missing Supabase config",
      checks: {},
    });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const checks: Record<string, unknown> = {};

  // ── Database connectivity ──
  try {
    const { count } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id", { count: "exact", head: true });
    checks.database = { status: "ok", feed_cards_total: count };
  } catch (err) {
    checks.database = { status: "error", error: String(err) };
  }

  // ── Last scanner run ──
  try {
    const { data } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("created_at")
      .eq("source_type", "gmail")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    checks.gmail_scanner = {
      status: "ok",
      last_card_at: data?.created_at || null,
      age_hours: data?.created_at
        ? Math.round((Date.now() - new Date(data.created_at).getTime()) / 3600000)
        : null,
    };
  } catch {
    checks.gmail_scanner = { status: "no_data", last_card_at: null };
  }

  // ── Last briefing ──
  try {
    const { data } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("created_at, title")
      .eq("card_type", "briefing")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    checks.daily_briefing = {
      status: "ok",
      last_briefing_at: data?.created_at || null,
      title: data?.title || null,
      age_hours: data?.created_at
        ? Math.round((Date.now() - new Date(data.created_at).getTime()) / 3600000)
        : null,
    };
  } catch {
    checks.daily_briefing = { status: "no_data", last_briefing_at: null };
  }

  // ── Last synthesis / reflection ──
  try {
    const { data } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("created_at, title")
      .eq("card_type", "reflection")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    checks.synthesis = {
      status: "ok",
      last_reflection_at: data?.created_at || null,
      title: data?.title || null,
    };
  } catch {
    checks.synthesis = { status: "no_data" };
  }

  // ── Feed card status breakdown ──
  try {
    const statusCounts: Record<string, number> = {};
    for (const status of ["unread", "read", "acted", "dismissed"]) {
      const { count } = await sb
        .schema("brain")
        .from("feed_cards")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      statusCounts[status] = count || 0;
    }
    checks.feed_status = statusCounts;
  } catch {
    checks.feed_status = { error: "failed" };
  }

  // ── Pending resurface cards ──
  try {
    const { count } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id", { count: "exact", head: true })
      .eq("ceo_action", "not_now")
      .not("resurface_at", "is", null);
    checks.pending_resurface = count || 0;
  } catch {
    checks.pending_resurface = 0;
  }

  // ── Env vars present ──
  checks.env = {
    supabase: !!supabaseUrl,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gmail: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN),
    slack: !!process.env.SLACK_BOT_TOKEN,
    openai: !!process.env.OPENAI_API_KEY,
  };

  const isHealthy = checks.database && (checks.database as Record<string, unknown>).status === "ok";

  return NextResponse.json({
    success: true,
    status: isHealthy ? "healthy" : "degraded",
    checks,
    duration_ms: Date.now() - started,
  });
}
