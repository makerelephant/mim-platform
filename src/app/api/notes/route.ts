export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { emitFeedCard } from "@/lib/feed-card-emitter";

function getSb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

// ─── GET /api/notes — List CEO notes ────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const sb = getSb();
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || "all";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = sb
      .schema("brain")
      .from("knowledge_chunks")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "draft") {
      query = query.eq("source_type", "ceo_note_draft");
    } else if (status === "published") {
      query = query.eq("source_type", "ceo_note");
    } else {
      // all — both published and draft notes
      query = query.in("source_type", ["ceo_note", "ceo_note_draft"]);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Notes GET error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data || [], total: count || 0 });
  } catch (err) {
    console.error("Notes GET exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ─── POST /api/notes — Create/save a note ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const sb = getSb();
    const body = await req.json();
    const { title, content, save_as } = body as {
      title: string;
      content: string;
      save_as: "knowledge" | "draft";
    };

    if (!title || !content) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 },
      );
    }

    if (!save_as || !["knowledge", "draft"].includes(save_as)) {
      return NextResponse.json(
        { error: "save_as must be 'knowledge' or 'draft'" },
        { status: 400 },
      );
    }

    const sourceRef = `note_${Date.now()}`;

    if (save_as === "knowledge") {
      // Generate embedding via OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const embeddingRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: `${title}\n\n${content}`.slice(0, 8000),
      });
      const embedding = embeddingRes.data[0].embedding;

      // Insert into knowledge_chunks with embedding
      const { data: noteData, error: noteError } = await sb
        .schema("brain")
        .from("knowledge_chunks")
        .insert({
          title,
          content,
          source_type: "ceo_note",
          source_ref: sourceRef,
          embedding: `[${embedding.join(",")}]`,
          metadata: { created_by: "ceo", save_type: "knowledge" },
        })
        .select("id")
        .single();

      if (noteError) {
        console.error("Note insert error:", noteError.message);
        return NextResponse.json({ error: noteError.message }, { status: 500 });
      }

      // Emit a feed card of type 'signal'
      const feedCard = await emitFeedCard(sb, {
        card_type: "signal",
        title: title,
        body: `You created a note called \u201c${title}\u201d. It was added to Knowledge on the platform.`,
        source_type: "note",
        source_ref: sourceRef,
        priority: "low",
        visibility_scope: "personal",
        metadata: { note_id: noteData.id, created_by: "ceo" },
      });

      return NextResponse.json({
        success: true,
        note_id: noteData.id,
        feed_card_id: feedCard?.id || null,
      });
    } else {
      // Draft — no embedding, no feed card
      const { data: noteData, error: noteError } = await sb
        .schema("brain")
        .from("knowledge_chunks")
        .insert({
          title,
          content,
          source_type: "ceo_note_draft",
          source_ref: sourceRef,
          metadata: { created_by: "ceo", save_type: "draft" },
        })
        .select("id")
        .single();

      if (noteError) {
        console.error("Draft note insert error:", noteError.message);
        return NextResponse.json({ error: noteError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        note_id: noteData.id,
      });
    }
  } catch (err) {
    console.error("Notes POST exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/notes — Delete a note ───────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const sb = getSb();
    const body = await req.json();
    const { note_id } = body as { note_id: string };

    if (!note_id) {
      return NextResponse.json(
        { error: "note_id is required" },
        { status: 400 },
      );
    }

    const { error } = await sb
      .schema("brain")
      .from("knowledge_chunks")
      .delete()
      .eq("id", note_id);

    if (error) {
      console.error("Note delete error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Notes DELETE exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
