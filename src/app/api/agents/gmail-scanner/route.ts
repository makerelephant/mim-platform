import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runGmailScanner } from "@/lib/gmail-scanner";

export const maxDuration = 300; // Allow up to 5 minutes for scanner (Pro plan)

// GET handler for Vercel cron jobs
export async function GET() {
  return runScanner(4); // Cron scans last 4 hours
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return runScanner(body.scanHours || 24, { skipDupeCheck: !!body.rescan });
}

async function runScanner(scanHours: number, options?: { skipDupeCheck?: boolean }) {
  try {

    // Validate required env vars
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

    // Create a service-role Supabase client for this request
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Run the scanner
    const result = await runGmailScanner(sb, scanHours, options);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
