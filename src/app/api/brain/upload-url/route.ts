import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

/**
 * POST /api/brain/upload-url
 *
 * Returns a signed upload URL for Supabase Storage so the browser can
 * upload large files (> 4.5MB) directly — bypassing Vercel's request body limit.
 *
 * Flow:
 *   1. Browser calls this to get { signed_url, storage_path }
 *   2. Browser PUTs the file to signed_url directly (no size limit)
 *   3. Browser calls /api/brain/ingest with { storage_path } to trigger processing
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const body = await request.json();
    const filename = body.filename || "upload";

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const storagePath = `uploads/${crypto.randomUUID()}/${filename}`;

    const { data, error } = await sb.storage
      .from("knowledge")
      .createSignedUploadUrl(storagePath);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      signed_url: data.signedUrl,
      storage_path: storagePath,
      token: data.token,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
