import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Resurface API — finds held cards whose resurface time has passed and
 * resets them to "unread" so they reappear in the feed.
 *
 * GET /api/feed/resurface
 *   Callable by cron or manually. Returns count of resurfaced cards.
 *
 * Uses the `resurface_at` column on brain.feed_cards for efficient querying.
 * Falls back to parsing ceo_action_note JSON for cards created before the column existed.
 */

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();
    const toResurface: string[] = [];

    // Find all cards where resurface_at has passed and status is not dismissed.
    // This catches both "acted" (not_now) cards and any other held status.
    const { data: columnCards, error: colError } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id")
      .neq("status", "dismissed")
      .not("resurface_at", "is", null)
      .lte("resurface_at", now);

    if (!colError && columnCards) {
      for (const card of columnCards) {
        toResurface.push(card.id);
      }
    }

    // Fallback — parse ceo_action_note JSON for older cards without resurface_at column
    const { data: jsonCards, error: jsonError } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("id, ceo_action_note")
      .eq("status", "acted")
      .eq("ceo_action", "not_now")
      .is("resurface_at", null)
      .not("ceo_action_note", "is", null);

    if (!jsonError && jsonCards) {
      for (const card of jsonCards) {
        try {
          const noteData = JSON.parse(card.ceo_action_note);
          if (noteData.resurface_at) {
            const resurfaceAt = new Date(noteData.resurface_at);
            if (resurfaceAt <= new Date()) {
              toResurface.push(card.id);
            }
          }
        } catch {
          continue;
        }
      }
    }

    if (toResurface.length === 0) {
      return NextResponse.json({ resurfaced: 0, message: "No cards due for resurfacing" });
    }

    // Reset cards to unread so they reappear in the feed
    const { error: updateError } = await sb
      .schema("brain")
      .from("feed_cards")
      .update({
        status: "unread",
        ceo_action: null,
        ceo_action_at: null,
        ceo_action_note: null,
        ceo_correction: null,
        resurface_at: null,
      })
      .in("id", toResurface);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      resurfaced: toResurface.length,
      card_ids: toResurface,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
