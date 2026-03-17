import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getKCSStats, recomputeAndStoreKCS } from "@/lib/entity-intelligence";

/**
 * Brain KCS (Knowledge Completeness Score) API
 *
 * GET  /api/brain/kcs
 *   Returns aggregate KCS stats: average KCS for orgs and contacts,
 *   enrichment priority distribution.
 *
 * POST /api/brain/kcs
 *   Body: { entity_type: 'organizations' | 'contacts', entity_id: string }
 *   Recomputes KCS for a specific entity and returns the new score.
 */

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET() {
  try {
    const sb = createServiceClient();
    if (!sb) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase env vars" },
        { status: 500 },
      );
    }

    const stats = await getKCSStats(sb);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error("[api/brain/kcs] GET error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sb = createServiceClient();
    if (!sb) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase env vars" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { entity_type, entity_id } = body;

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { success: false, error: "entity_type and entity_id are required" },
        { status: 400 },
      );
    }

    if (entity_type !== "organizations" && entity_type !== "contacts") {
      return NextResponse.json(
        { success: false, error: "entity_type must be 'organizations' or 'contacts'" },
        { status: 400 },
      );
    }

    const kcs = await recomputeAndStoreKCS(sb, entity_type, entity_id);

    return NextResponse.json({
      success: true,
      data: {
        entity_type,
        entity_id,
        knowledge_completeness_score: kcs,
      },
    });
  } catch (err) {
    console.error("[api/brain/kcs] POST error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
