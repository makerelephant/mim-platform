import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/clearing/sessions — List active clearing sessions with their messages
 * POST /api/clearing/sessions — Create a new session
 * PATCH /api/clearing/sessions — Update session (dissolve, rename)
 */

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const sb = getSb();
  if (!sb) {
    return NextResponse.json({ success: false, error: "Missing Supabase config" }, { status: 500 });
  }

  const { data: sessions, error } = await sb
    .schema("brain")
    .from("clearing_sessions")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Load messages for each session
  const sessionIds = (sessions || []).map((s: { id: string }) => s.id);
  let messages: Array<Record<string, unknown>> = [];
  if (sessionIds.length > 0) {
    const { data: msgs } = await sb
      .schema("brain")
      .from("clearing_messages")
      .select("*")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });
    messages = msgs || [];
  }

  // Group messages by session
  const messagesBySession: Record<string, Array<Record<string, unknown>>> = {};
  for (const msg of messages) {
    const sid = msg.session_id as string;
    if (!messagesBySession[sid]) messagesBySession[sid] = [];
    messagesBySession[sid].push(msg);
  }

  const result = (sessions || []).map((s: Record<string, unknown>) => ({
    ...s,
    messages: messagesBySession[s.id as string] || [],
  }));

  return NextResponse.json({ success: true, sessions: result });
}

export async function POST(request: NextRequest) {
  const sb = getSb();
  if (!sb) {
    return NextResponse.json({ success: false, error: "Missing Supabase config" }, { status: 500 });
  }

  const body = await request.json();
  const title = body.title || "Thought Stream";

  const { data, error } = await sb
    .schema("brain")
    .from("clearing_sessions")
    .insert({ title, status: "active" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, session: { ...data, messages: [] } });
}

export async function PATCH(request: NextRequest) {
  const sb = getSb();
  if (!sb) {
    return NextResponse.json({ success: false, error: "Missing Supabase config" }, { status: 500 });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });
  }

  const { data, error } = await sb
    .schema("brain")
    .from("clearing_sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, session: data });
}
