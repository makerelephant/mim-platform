import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runGmailScanner } from "@/lib/gmail-scanner";

export const maxDuration = 300; // Allow up to 5 minutes for scanner (Pro plan)

const MAX_SCAN_HOURS = 72; // Safety cap
const DEFAULT_SCAN_HOURS = 24; // Fallback if no prior run

/** Compute hours since last successful gmail-scanner run */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hoursSinceLastScan(sb: any): Promise<number> {
  const { data } = await sb
    .schema("brain").from("agent_runs")
    .select("completed_at")
    .eq("agent_name", "gmail-scanner")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (data?.completed_at) {
    const elapsed = Date.now() - new Date(data.completed_at).getTime();
    const hours = Math.ceil(elapsed / (60 * 60 * 1000));
    return Math.min(Math.max(hours, 1), MAX_SCAN_HOURS);
  }
  return DEFAULT_SCAN_HOURS;
}

// GET handler for Vercel cron jobs — scans from last successful run
export async function GET() {
  return runScanner(null); // null = auto-compute from last run
}

// POST handler for manual refresh — accepts optional scanHours override
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const scanHoursOverride = typeof body.scanHours === "number" ? Math.min(Math.max(body.scanHours, 1), MAX_SCAN_HOURS) : null;
  return runScanner(scanHoursOverride, { skipDupeCheck: !!body.rescan });
}

async function runScanner(scanHoursOverride: number | null, options?: { skipDupeCheck?: boolean }) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars" },
        { status: 500 },
      );
    }

    if (!process.env.GOOGLE_TOKEN) {
      return NextResponse.json(
        { success: false, error: "Missing GOOGLE_TOKEN env var. Base64-encode your token.json and set it." },
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

    // Auto-compute scan window from last successful run (no gaps)
    const scanHours = scanHoursOverride ?? await hoursSinceLastScan(sb);

    const result = await runGmailScanner(sb, scanHours, options);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
