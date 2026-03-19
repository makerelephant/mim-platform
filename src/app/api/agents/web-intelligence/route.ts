import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  runWebIntelligenceScan,
  type WebMonitorSource,
} from "@/lib/web-intelligence-scanner";

export const maxDuration = 120;

/**
 * Web Intelligence Gopher — Market intelligence from external sources.
 *
 * GET  /api/agents/web-intelligence  → Returns last scan results (for cron)
 * POST /api/agents/web-intelligence  → Triggers a new scan
 *
 * POST body (optional):
 *   { "urls": [{ "url": "...", "label": "...", "type": "rss"|"webpage", "category": "..." }] }
 */

// GET: Return last scan results + trigger cron scan
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase env vars" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // For cron: run the scan
    const result = await runWebIntelligenceScan(sb);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}

// POST: Trigger scan with optional URL overrides
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase env vars" },
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

    // Parse optional URL overrides
    const body = await request.json().catch(() => ({}));
    let overrideUrls: WebMonitorSource[] | undefined;

    if (body.urls && Array.isArray(body.urls)) {
      overrideUrls = body.urls.map((u: Partial<WebMonitorSource>) => ({
        url: u.url || "",
        label: u.label || u.url || "Unknown",
        type: u.type || "rss",
        category: u.category || "custom",
      }));
    }

    const result = await runWebIntelligenceScan(sb, overrideUrls);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
