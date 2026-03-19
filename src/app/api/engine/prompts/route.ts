import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PROMPT_REGISTRY } from "@/lib/prompts";

/**
 * GET /api/engine/prompts
 *
 * Returns all registered prompts with their metadata and current text.
 * If a prompt has a CEO override stored in brain.instructions, the override
 * text is returned; otherwise the default text is shown.
 *
 * PATCH /api/engine/prompts
 *
 * Updates a prompt override. Body: { promptId: string, text: string }
 * Stores/updates the override in brain.instructions with type='prompt_override'.
 * Send text as empty string or null to remove the override (revert to default).
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all prompt overrides from brain.instructions
    const { data: overrides } = await sb
      .schema("brain")
      .from("instructions")
      .select("id, prompt, metadata, created_at, updated_at")
      .eq("type", "prompt_override")
      .eq("status", "active");

    // Build a map of overrides by promptId
    const overrideMap = new Map<
      string,
      { id: string; text: string; updated_at: string }
    >();
    for (const o of overrides ?? []) {
      const promptId = (o.metadata as Record<string, unknown>)
        ?.prompt_id as string;
      if (promptId) {
        overrideMap.set(promptId, {
          id: o.id,
          text: o.prompt,
          updated_at: o.updated_at || o.created_at,
        });
      }
    }

    // Build response
    const prompts = PROMPT_REGISTRY.map((p) => {
      const override = overrideMap.get(p.id);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        agent: p.agent,
        default_text: p.getDefaultText(),
        override_text: override?.text ?? null,
        override_id: override?.id ?? null,
        override_updated_at: override?.updated_at ?? null,
        is_overridden: !!override,
      };
    });

    return NextResponse.json({ success: true, prompts });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { promptId, text } = body;

    if (!promptId) {
      return NextResponse.json(
        { success: false, error: "promptId is required" },
        { status: 400 },
      );
    }

    // Validate that the prompt exists in the registry
    const promptDef = PROMPT_REGISTRY.find((p) => p.id === promptId);
    if (!promptDef) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown prompt: ${promptId}. Valid IDs: ${PROMPT_REGISTRY.map((p) => p.id).join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Check for existing override
    const { data: existing } = await sb
      .schema("brain")
      .from("instructions")
      .select("id")
      .eq("type", "prompt_override")
      .eq("status", "active")
      .eq("metadata->>prompt_id", promptId)
      .limit(1);

    const existingId = existing?.[0]?.id;

    // If text is empty/null, remove the override (revert to default)
    if (!text || text.trim() === "") {
      if (existingId) {
        await sb
          .schema("brain")
          .from("instructions")
          .update({ status: "inactive", updated_at: new Date().toISOString() })
          .eq("id", existingId);

        return NextResponse.json({
          success: true,
          action: "reverted",
          promptId,
          message: `Override for "${promptDef.name}" removed — reverted to default.`,
        });
      }
      return NextResponse.json({
        success: true,
        action: "no_change",
        promptId,
        message: `No override existed for "${promptDef.name}".`,
      });
    }

    // Upsert the override
    if (existingId) {
      const { error } = await sb
        .schema("brain")
        .from("instructions")
        .update({
          prompt: text.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId);

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        action: "updated",
        promptId,
        override_id: existingId,
        message: `Override for "${promptDef.name}" updated.`,
      });
    } else {
      const { data: inserted, error } = await sb
        .schema("brain")
        .from("instructions")
        .insert({
          type: "prompt_override",
          prompt: text.trim(),
          status: "active",
          metadata: {
            prompt_id: promptId,
            prompt_name: promptDef.name,
            agent: promptDef.agent,
          },
        })
        .select("id")
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        action: "created",
        promptId,
        override_id: inserted?.id,
        message: `Override for "${promptDef.name}" created.`,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
