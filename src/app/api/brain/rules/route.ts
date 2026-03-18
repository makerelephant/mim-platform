import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/brain/rules
 *
 * List behavioral rules with optional status filter.
 * Query params: ?status=active|proposed|suspended|retired (default: all active + proposed)
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const status = request.nextUrl.searchParams.get("status");

    let query = sb
      .schema("brain")
      .from("behavioral_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.in("status", ["active", "proposed"]);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rules: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/brain/rules
 *
 * CEO approves, rejects, or retires a behavioral rule.
 * Body: { id: string, action: "approve" | "reject" | "retire" | "suspend" }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, error: "Missing id or action" }, { status: 400 });
    }

    const now = new Date().toISOString();
    let updates: Record<string, unknown>;

    switch (action) {
      case "approve":
        updates = { status: "active", activated_at: now, auto_applied: false };
        break;
      case "reject":
        updates = { status: "retired", retired_at: now };
        break;
      case "retire":
        updates = { status: "retired", retired_at: now };
        break;
      case "suspend":
        updates = { status: "suspended" };
        break;
      default:
        return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
    }

    const { data, error } = await sb
      .schema("brain")
      .from("behavioral_rules")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rule: data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
