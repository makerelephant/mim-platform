import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Feed Resurface Cron
 *
 * Runs periodically (configured in vercel.json as daily at 14:00 UTC).
 * Finds cards with status="acted", ceo_action="not_now", and resurface_at <= now.
 * Sets them back to "unread" so they reappear in the feed.
 */

async function resurface() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseKey);
  const now = new Date().toISOString();

  const { data: dueCards, error: fetchError } = await sb
    .schema("brain")
    .from("feed_cards")
    .select("id, title, resurface_at")
    .eq("status", "acted")
    .eq("ceo_action", "not_now")
    .not("resurface_at", "is", null)
    .lte("resurface_at", now);

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  if (!dueCards || dueCards.length === 0) {
    return NextResponse.json({ success: true, resurfaced: 0, message: "No cards due for resurfacing" });
  }

  const cardIds = dueCards.map((c) => c.id);
  const { error: updateError } = await sb
    .schema("brain")
    .from("feed_cards")
    .update({
      status: "unread",
      ceo_action: null,
      ceo_action_at: null,
      resurface_at: null,
    })
    .in("id", cardIds);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  console.log("[resurface] Resurfaced " + cardIds.length + " cards");

  return NextResponse.json({
    success: true,
    resurfaced: cardIds.length,
    cards: dueCards.map((c) => ({ id: c.id, title: c.title })),
  });
}

export async function GET() {
  return resurface();
}

export async function POST() {
  return resurface();
}
