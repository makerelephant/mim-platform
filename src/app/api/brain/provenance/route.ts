import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { writeProvenance, recomputeAndStoreKCS } from "@/lib/entity-intelligence";

/**
 * Brain Provenance API
 *
 * POST /api/brain/provenance
 *
 * Writes provenance records for entity field changes and optionally
 * recomputes KCS. Uses service role internally since anon key can't
 * write to brain schema.
 *
 * Body: {
 *   entity_type: 'organizations' | 'contacts',
 *   entity_id: string,
 *   fields: Record<string, string | null>,
 *   source_type: string,
 *   source_ref?: string,
 *   source_trust?: 'high' | 'medium' | 'low',
 *   confidence?: number,
 *   recompute_kcs?: boolean
 * }
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();

    const {
      entity_type,
      entity_id,
      fields,
      source_type,
      source_ref = null,
      source_trust = "medium",
      confidence = 0.5,
      recompute_kcs = true,
    } = body;

    // Validate required fields
    if (!entity_type || !entity_id || !fields || !source_type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: entity_type, entity_id, fields, source_type" },
        { status: 400 },
      );
    }

    if (entity_type !== "organizations" && entity_type !== "contacts") {
      return NextResponse.json(
        { success: false, error: "entity_type must be 'organizations' or 'contacts'" },
        { status: 400 },
      );
    }

    // Write provenance records
    const recordsWritten = await writeProvenance(
      sb,
      entity_type,
      entity_id,
      fields,
      source_type,
      source_ref,
      source_trust,
      confidence,
    );

    // Optionally recompute KCS
    let kcs: number | null = null;
    if (recompute_kcs) {
      kcs = await recomputeAndStoreKCS(sb, entity_type, entity_id);
    }

    return NextResponse.json({
      success: true,
      records_written: recordsWritten,
      kcs,
    });
  } catch (e) {
    console.error("[provenance-api] Error:", e instanceof Error ? e.message : String(e));
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
