import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/clearing/messages — Persist a clearing message
 * Body: { session_id, role, content, message_type, metadata? }
 */
export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      return NextResponse.json({ success: false, error: "Missing Supabase config" }, { status: 500 });
    }

    const sb = createClient(url, key);
    const body = await request.json();

    const { session_id, role, content, message_type, metadata } = body;

    if (!session_id || !role || !content || !message_type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: session_id, role, content, message_type" },
        { status: 400 },
      );
    }

    const { data, error } = await sb
      .schema("brain")
      .from("clearing_messages")
      .insert({
        session_id,
        role,
        content,
        message_type,
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
