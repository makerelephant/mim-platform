import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/brain/track
 *
 * Lightweight event tracking endpoint for the measurement layer.
 * Accepts: { event: string, card_id?: string, metadata?: object }
 * Events: "card_expanded", "card_action", "filter_changed"
 *
 * Stored in brain.events table.
 */

const VALID_EVENTS = ["card_expanded", "card_action", "filter_changed"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, card_id, metadata } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'event' field" },
        { status: 400 },
      );
    }

    if (!VALID_EVENTS.includes(event as typeof VALID_EVENTS[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid event type. Must be one of: ${VALID_EVENTS.join(", ")}` },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase env vars" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await sb
      .schema("brain")
      .from("events")
      .insert({
        event,
        card_id: card_id || null,
        metadata: metadata || {},
      });

    if (error) {
      console.error("[track] insert error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[track] error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
