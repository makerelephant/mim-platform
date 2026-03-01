import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSlackScanner } from "@/lib/slack-scanner";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scanHours = body.scanHours || 24;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars" },
        { status: 500 },
      );
    }

    if (!process.env.SLACK_BOT_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing SLACK_BOT_TOKEN env var. Create a Slack App and add the bot token." },
        { status: 500 },
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Missing ANTHROPIC_API_KEY env var" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const result = await runSlackScanner(sb, scanHours);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
