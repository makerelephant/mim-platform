import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAdaptation } from "@/lib/adaptation-agent";

export const maxDuration = 120;

/**
 * POST /api/agents/adaptation
 *
 * Runs the adaptation agent to analyze CEO corrections and propose behavioral rules.
 * Callable via Vercel cron (weekly) or manually.
 *
 * Body (optional): { days?: number, auto_apply_threshold?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
    }
    if (!anthropicKey) {
      return NextResponse.json({ success: false, error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    let days = 30;
    let autoApplyThreshold = 0.85;
    try {
      const body = await request.json();
      if (body.days && typeof body.days === "number") days = body.days;
      if (body.auto_apply_threshold && typeof body.auto_apply_threshold === "number") {
        autoApplyThreshold = body.auto_apply_threshold;
      }
    } catch {
      // No body — use defaults
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const result = await runAdaptation(sb, anthropicKey, { days, autoApplyThreshold });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
