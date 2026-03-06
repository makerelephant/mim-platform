import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runNewsScan } from "@/lib/news-scanner";

export const maxDuration = 120;

/**
 * Sentiment Scanner — RSS-powered news intelligence gopher.
 *
 * POST /api/agents/sentiment-scanner
 *
 * Fetches configured RSS feeds, analyzes each article for sentiment
 * and MiM relevance via Claude, stores in knowledge_base, and
 * creates tasks for high-relevance articles.
 */
export async function POST() {
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
    const result = await runNewsScan(sb);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
