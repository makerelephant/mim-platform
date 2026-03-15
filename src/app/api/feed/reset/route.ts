/**
 * GET /api/feed/reset
 * Resets all acted/dismissed cards back to unread.
 * For design preview purposes only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await sb
      .schema("brain")
      .from("feed_cards")
      .update({ status: "unread", ceo_action: null, ceo_action_at: null, ceo_action_note: null })
      .in("status", ["acted", "dismissed"])
      .select("id, title, status");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Reset ${data.length} cards back to unread`,
      cards: data,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
