import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Feed API — serves cards for Your Motion
 *
 * GET /api/feed
 *   ?status=unread,read    (default: unread,read)
 *   ?card_type=decision    (optional filter)
 *   ?priority=critical,high (optional filter)
 *   ?limit=50              (default: 50, max: 200)
 *   ?offset=0              (pagination)
 *   ?scope=personal        (default: personal)
 *
 * PATCH /api/feed
 *   Body: { id, status, ceo_action, ceo_action_note, correction }
 *   Updates a card's status (e.g., mark as acted, dismissed)
 *   correction: { wrong_category, wrong_priority, wrong_card_type, should_not_exist, note, resurface_hours }
 */

interface CorrectionPayload {
  wrong_category?: string;
  wrong_priority?: string;
  wrong_card_type?: string;
  should_not_exist?: boolean;
  note?: string;
  resurface_hours?: number;
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const statuses = (url.searchParams.get("status") || "unread,read").split(",");
    const cardType = url.searchParams.get("card_type");
    const priorities = url.searchParams.get("priority")?.split(",");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const scope = url.searchParams.get("scope") || "personal";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    const sortMode = url.searchParams.get("sort") || "recency";
    const priorityRank: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    let query = sb
      .schema("brain")
      .from("feed_cards")
      .select("*", { count: "exact" })
      .eq("visibility_scope", scope)
      .in("status", statuses)
      .neq("status", "dismissed");

    query = query.order("created_at", { ascending: false });

    query = query.range(offset, offset + limit - 1);

    if (cardType) {
      query = query.eq("card_type", cardType);
    }

    if (priorities) {
      query = query.in("priority", priorities);
    }

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const cards = [...(data || [])];
    if (sortMode === "importance") {
      cards.sort((a, b) => {
        const priorityDelta =
          (priorityRank[b.priority || "medium"] || 0) -
          (priorityRank[a.priority || "medium"] || 0);
        if (priorityDelta !== 0) return priorityDelta;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return NextResponse.json(
      {
        cards,
        total: count || 0,
        limit,
        offset,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, ceo_action, ceo_action_note, correction } = body as {
      id?: string;
      status?: string;
      ceo_action?: string;
      ceo_action_note?: string;
      correction?: CorrectionPayload;
    };

    if (!id) {
      return NextResponse.json({ error: "Card id is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (ceo_action) {
      updates.ceo_action = ceo_action;
      updates.ceo_action_at = new Date().toISOString();
      updates.status = "acted";
    }
    if (ceo_action_note !== undefined) updates.ceo_action_note = ceo_action_note;

    // Handle correction data
    if (correction) {
      // Store structured correction in dedicated column + note
      updates.ceo_correction = correction;
      updates.ceo_action_note = JSON.stringify(correction);
    }

    // For hold (not_now), always set resurface_at so the resurface cron picks it up.
    // Default to 24 hours from now if no resurface_hours specified in the correction.
    if (ceo_action === "not_now") {
      const hours = correction?.resurface_hours || 24;
      const resurfaceAt = new Date(
        Date.now() + hours * 60 * 60 * 1000
      ).toISOString();
      updates.resurface_at = resurfaceAt;
    }

    const { data, error } = await sb
      .schema("brain")
      .from("feed_cards")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget: trigger brain learning pipeline for corrections
    if (correction && (correction.wrong_category || correction.wrong_priority || correction.should_not_exist || correction.note)) {
      const origin = request.nextUrl.origin;
      fetch(`${origin}/api/brain/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card_id: id, correction }),
      }).catch((learnErr) => {
        console.error("Brain learn fire-and-forget failed:", learnErr);
      });
    }

    // Fire-and-forget: log every CEO action as a decision in decision_log for training
    if (ceo_action && data) {
      const actionLabel = ceo_action === "do" ? "DO (approved/acted)" : ceo_action === "no" ? "NO (rejected)" : "HOLD (deferred)";
      Promise.resolve(
        sb.schema("brain")
          .from("decision_log")
          .insert({
            decision_type: "ceo_action",
            entity_id: data.entity_id || null,
            entity_type: data.entity_type || null,
            input_summary: `Feed card "${data.title || id}" (${data.card_type || "unknown"}, category: ${data.acumen_category || "uncategorized"}, priority: ${data.priority || "medium"}, source: ${data.source_type || "unknown"})`,
            decision: `CEO action: ${actionLabel}`,
            reasoning: `Card was surfaced to feed and CEO responded with "${ceo_action}"`,
            outcome: actionLabel,
            ceo_override: false,
            outcome_recorded_at: new Date().toISOString(),
          })
      ).catch((logErr) => {
        console.warn("Decision log insert failed (non-fatal):", logErr);
      });
    }

    return NextResponse.json({ card: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
