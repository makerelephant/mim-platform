import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/brain/learn
 *
 * Processes CEO corrections on feed cards and turns them into institutional memory.
 * This is the learning pipeline — corrections aren't just stored, they teach the brain.
 *
 * Body: { card_id: string, correction: CorrectionPayload }
 *
 * Actions by correction type:
 *   wrong_category  → logs to decision_log, updates card's acumen_category, stores KB entry
 *   wrong_priority  → logs to decision_log, updates card priority, stores KB entry
 *   should_not_exist → logs suppress signal for source/category combo, stores KB entry
 *   note (any)      → stored as institutional memory in knowledge_base
 */

interface CorrectionPayload {
  wrong_category?: string;
  wrong_priority?: string;
  wrong_card_type?: string;
  should_not_exist?: boolean;
  note?: string;
  resurface_hours?: number;
}

function getSupabase(): { sb: any; error?: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { sb: null, error: "Missing Supabase config" };
  }

  return { sb: createClient(supabaseUrl, supabaseKey) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { card_id, correction } = body as {
      card_id?: string;
      correction?: CorrectionPayload;
    };

    if (!card_id) {
      return NextResponse.json({ error: "card_id is required" }, { status: 400 });
    }

    if (!correction) {
      return NextResponse.json({ error: "correction payload is required" }, { status: 400 });
    }

    const { sb, error: sbError } = getSupabase();
    if (sbError) {
      return NextResponse.json({ error: sbError }, { status: 500 });
    }

    // ── 1. Fetch the original card ──
    const { data: card, error: cardError } = await (sb as any)
      .schema("brain")
      .from("feed_cards")
      .select("*")
      .eq("id", card_id)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: `Card not found: ${cardError?.message || "no data"}` },
        { status: 404 },
      );
    }

    const learned: string[] = [];
    const now = new Date().toISOString();

    // ── 2. Process wrong_category correction ──
    if (correction.wrong_category) {
      const oldCategory = card.acumen_category || "uncategorized";
      const newCategory = correction.wrong_category;

      // Log to decision_log
      await (sb as any)
        .schema("brain")
        .from("decision_log")
        .insert({
          decision_type: "classification",
          entity_id: card.entity_id || null,
          entity_type: card.entity_type || null,
          input_summary: `Feed card "${card.title || card.id}" was classified as "${oldCategory}"`,
          decision: `Classified as category: ${oldCategory}`,
          reasoning: `Original classification from card generation pipeline`,
          outcome: `CEO corrected to: ${newCategory}`,
          ceo_override: true,
          ceo_correction: `Category changed from "${oldCategory}" to "${newCategory}"`,
          outcome_recorded_at: now,
        });

      // Update the card itself
      await (sb as any)
        .schema("brain")
        .from("feed_cards")
        .update({ acumen_category: newCategory })
        .eq("id", card_id);

      learned.push(`Category corrected: "${oldCategory}" → "${newCategory}"`);
    }

    // ── 3. Process wrong_priority correction ──
    if (correction.wrong_priority) {
      const oldPriority = card.priority || "medium";
      const newPriority = correction.wrong_priority;

      // Log to decision_log
      await (sb as any)
        .schema("brain")
        .from("decision_log")
        .insert({
          decision_type: "classification",
          entity_id: card.entity_id || null,
          entity_type: card.entity_type || null,
          input_summary: `Feed card "${card.title || card.id}" was prioritized as "${oldPriority}"`,
          decision: `Priority set to: ${oldPriority}`,
          reasoning: `Original priority assignment from card generation pipeline`,
          outcome: `CEO corrected priority to: ${newPriority}`,
          ceo_override: true,
          ceo_correction: `Priority changed from "${oldPriority}" to "${newPriority}"`,
          outcome_recorded_at: now,
        });

      // Update the card itself
      await (sb as any)
        .schema("brain")
        .from("feed_cards")
        .update({ priority: newPriority })
        .eq("id", card_id);

      learned.push(`Priority corrected: "${oldPriority}" → "${newPriority}"`);
    }

    // ── 4. Process should_not_exist (suppress signal) ──
    if (correction.should_not_exist) {
      const sourceType = card.source_type || "unknown";
      const category = card.acumen_category || "uncategorized";
      const cardType = card.card_type || "unknown";

      // Log to decision_log as a suppress signal
      await (sb as any)
        .schema("brain")
        .from("decision_log")
        .insert({
          decision_type: "classification",
          entity_id: card.entity_id || null,
          entity_type: card.entity_type || null,
          input_summary: `Feed card "${card.title || card.id}" (source: ${sourceType}, category: ${category}, type: ${cardType}) was surfaced to CEO`,
          decision: `Card was generated and shown in feed`,
          reasoning: `Pipeline determined this was worth surfacing`,
          outcome: `CEO marked as "should not exist" — suppress signal for source=${sourceType} + category=${category}`,
          ceo_override: true,
          ceo_correction: `Card should not have been created. Suppress: source_type="${sourceType}", category="${category}", card_type="${cardType}"`,
          outcome_recorded_at: now,
        });

      learned.push(`Suppress signal logged for source="${sourceType}" + category="${category}"`);
    }

    // ── 5. Build correction summary and store as institutional memory ──
    const summaryParts: string[] = [];

    if (correction.wrong_category) {
      summaryParts.push(
        `CEO corrected category from "${card.acumen_category || "uncategorized"}" to "${correction.wrong_category}" on a ${card.card_type || "unknown"} card from source "${card.source_type || "unknown"}".`
      );
    }
    if (correction.wrong_priority) {
      summaryParts.push(
        `CEO corrected priority from "${card.priority || "medium"}" to "${correction.wrong_priority}" on a ${card.card_type || "unknown"} card (category: ${card.acumen_category || "uncategorized"}).`
      );
    }
    if (correction.should_not_exist) {
      summaryParts.push(
        `CEO said this ${card.card_type || "unknown"} card should not exist. Source: "${card.source_type || "unknown"}", category: "${card.acumen_category || "uncategorized"}". This type of content should be filtered out.`
      );
    }
    if (correction.note) {
      summaryParts.push(`CEO note: "${correction.note}"`);
    }

    if (summaryParts.length > 0) {
      const title = `Correction: ${correction.wrong_category ? "category" : correction.wrong_priority ? "priority" : correction.should_not_exist ? "suppress" : "feedback"} — ${card.title || card_id}`;

      const fullSummary = [
        `## CEO Correction (${now})`,
        "",
        `**Card:** ${card.title || "Untitled"} (${card.card_type || "unknown"})`,
        `**Original category:** ${card.acumen_category || "uncategorized"}`,
        `**Original priority:** ${card.priority || "medium"}`,
        `**Source:** ${card.source_type || "unknown"}`,
        "",
        ...summaryParts,
        "",
        `This correction should inform future classification decisions for similar content.`,
      ].join("\n");

      await (sb as any)
        .from("knowledge_base")
        .insert({
          title: title.slice(0, 200),
          source_type: "ceo_correction",
          source_ref: card_id,
          content: fullSummary,
          summary: summaryParts.join(" "),
          tags: ["correction", "learning", "institutional-memory"],
          processed: true,
          metadata: {
            correction_type: correction.wrong_category
              ? "wrong_category"
              : correction.wrong_priority
                ? "wrong_priority"
                : correction.should_not_exist
                  ? "should_not_exist"
                  : "note",
            original_card_type: card.card_type,
            original_category: card.acumen_category,
            original_priority: card.priority,
            original_source: card.source_type,
            corrected_category: correction.wrong_category || null,
            corrected_priority: correction.wrong_priority || null,
            should_suppress: correction.should_not_exist || false,
            feed_card_id: card_id,
          },
        });

      learned.push("Correction stored as institutional memory in knowledge_base");
    }

    return NextResponse.json({
      success: true,
      learned: learned.length > 0
        ? learned.join("; ")
        : "Correction noted but no actionable learning extracted",
      details: learned,
    });
  } catch (err) {
    console.error("Brain learn error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
