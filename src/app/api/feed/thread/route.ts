import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/feed/thread?thread_id=xxx
 *
 * Returns correspondence records for a Gmail thread, ordered newest first.
 * Used by the MessageCard thread expansion UI.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("thread_id");

  if (!threadId) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await sb
    .schema("brain")
    .from("correspondence")
    .select("id, subject, summary, from_email, direction, email_date, metadata")
    .eq("thread_id", threadId)
    .order("email_date", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = (data || []).map((msg) => {
    const meta = (msg.metadata || {}) as Record<string, unknown>;
    let senderName = meta.from_name as string | null;
    if (!senderName && msg.from_email) {
      if (msg.from_email.includes("<")) {
        senderName = msg.from_email.split("<")[0].trim().replace(/"/g, "") || null;
      }
      if (!senderName) {
        senderName = msg.from_email.split("@")[0];
      }
    }

    return {
      id: msg.id,
      sender_name: senderName || "Unknown",
      summary: msg.summary || msg.subject || "",
      email_date: msg.email_date,
      direction: msg.direction,
    };
  });

  return NextResponse.json({ success: true, messages, thread_id: threadId });
}
