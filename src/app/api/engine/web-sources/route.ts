import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiAuth } from "@/lib/auth";
import { DEFAULT_WEB_SOURCES, type WebMonitorSource } from "@/lib/web-intelligence-scanner";

/**
 * GET /api/engine/web-sources
 * Returns all configured web intelligence sources.
 * Sources come from brain.instructions (type='web_monitor') or defaults.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, supabaseKey);

  // Check for custom sources in brain.instructions
  const { data: instructions } = await sb
    .schema("brain")
    .from("instructions")
    .select("id, content, created_at, updated_at")
    .eq("type", "web_monitor")
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (instructions && instructions.length > 0) {
    // Parse sources from instructions
    const sources: Array<WebMonitorSource & { instruction_id: string }> = [];
    for (const instr of instructions) {
      try {
        const parsed = typeof instr.content === "string"
          ? JSON.parse(instr.content)
          : instr.content;
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            sources.push({ ...s, instruction_id: instr.id });
          }
        } else if (parsed.url) {
          sources.push({ ...parsed, instruction_id: instr.id });
        }
      } catch {
        // Skip malformed
      }
    }
    return NextResponse.json({ sources, using_defaults: false });
  }

  // Return defaults
  return NextResponse.json({
    sources: DEFAULT_WEB_SOURCES.map(s => ({ ...s, instruction_id: null })),
    using_defaults: true,
  });
}

/**
 * POST /api/engine/web-sources
 * Adds a new web monitor source. Stores in brain.instructions.
 * Body: { url, label, type: "rss"|"webpage", category }
 */
export async function POST(request: NextRequest) {
  const authError = validateApiAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = await request.json();
  const { url, label, type, category } = body;

  if (!url || !label) {
    return NextResponse.json({ error: "url and label are required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, supabaseKey);

  // If currently using defaults, first migrate defaults to instructions
  const { data: existing } = await sb
    .schema("brain")
    .from("instructions")
    .select("id")
    .eq("type", "web_monitor")
    .eq("active", true)
    .limit(1);

  if (!existing || existing.length === 0) {
    // Migrate defaults: store each default source as an instruction
    for (const src of DEFAULT_WEB_SOURCES) {
      await sb.schema("brain").from("instructions").insert({
        type: "web_monitor",
        content: JSON.stringify(src),
        active: true,
        metadata: { source: "default_migration" },
      });
    }
  }

  // Add new source
  const newSource: WebMonitorSource = {
    url,
    label,
    type: type || "webpage",
    category: category || "custom",
  };

  const { data: inserted, error } = await sb
    .schema("brain")
    .from("instructions")
    .insert({
      type: "web_monitor",
      content: JSON.stringify(newSource),
      active: true,
      metadata: { source: "engine_room" },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, source: { ...newSource, instruction_id: inserted.id } });
}

/**
 * DELETE /api/engine/web-sources
 * Removes a web monitor source by instruction_id.
 * Body: { instruction_id }
 */
export async function DELETE(request: NextRequest) {
  const authError = validateApiAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = await request.json();
  const { instruction_id } = body;

  if (!instruction_id) {
    return NextResponse.json({ error: "instruction_id required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, supabaseKey);

  // Soft-delete by setting active=false
  const { error } = await sb
    .schema("brain")
    .from("instructions")
    .update({ active: false })
    .eq("id", instruction_id)
    .eq("type", "web_monitor");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
