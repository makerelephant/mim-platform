export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emitFeedCard } from "@/lib/feed-card-emitter";
import { embedKnowledgeContentIntoChunks } from "@/lib/knowledge-chunks-writer";

function getSb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

async function replaceKnowledgeChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  kbId: string,
  title: string,
  content: string,
  sourceType: string,
) {
  await sb.schema("brain").from("knowledge_chunks").delete().eq("kb_id", kbId);
  await embedKnowledgeContentIntoChunks(sb, kbId, content, {
    title,
    source_type: sourceType,
  });
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
      .from("knowledge_base")
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

    const notes = (data || []).map((note: {
      id: string;
      title: string;
      content_text?: string | null;
      source_type: string;
      created_at: string;
    }) => ({
      id: note.id,
      title: note.title,
      content: note.content_text || "",
      source_type: note.source_type,
      created_at: note.created_at,
    }));

    return NextResponse.json({ notes, total: count || 0 });
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
    const { title, content, save_as, note_id } = body as {
      title: string;
      content: string;
      save_as: "knowledge" | "draft";
      note_id?: string;
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
    const sourceType = save_as === "knowledge" ? "ceo_note" : "ceo_note_draft";
    const trimmedTitle = title.trim() || "Untitled Note";
    const trimmedContent = content.trim();

    let noteId = note_id || null;

    if (noteId) {
      const { error: updateError } = await sb
        .from("knowledge_base")
        .update({
          title: trimmedTitle,
          content_text: trimmedContent,
          source_type: sourceType,
          source_ref: sourceRef,
          summary: trimmedContent.slice(0, 300),
          processed: save_as === "knowledge",
          processed_at: save_as === "knowledge" ? new Date().toISOString() : null,
          metadata: { created_by: "ceo", save_type: save_as },
        })
        .eq("id", noteId);

      if (updateError) {
        console.error("Note update error:", updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { data: noteData, error: noteError } = await sb
        .from("knowledge_base")
        .insert({
          title: trimmedTitle,
          source_type: sourceType,
          source_ref: sourceRef,
          content_text: trimmedContent,
          summary: trimmedContent.slice(0, 300),
          metadata: { created_by: "ceo", save_type: save_as },
          processed: save_as === "knowledge",
          processed_at: save_as === "knowledge" ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (noteError || !noteData) {
        console.error("Note insert error:", noteError?.message);
        return NextResponse.json({ error: noteError?.message || "Note insert failed" }, { status: 500 });
      }

      noteId = noteData.id;
    }

    if (!noteId) {
      return NextResponse.json({ error: "Note id unavailable after save" }, { status: 500 });
    }

    if (save_as === "knowledge") {
      await replaceKnowledgeChunks(sb, noteId, trimmedTitle, trimmedContent, sourceType);

      const feedCard = await emitFeedCard(sb, {
        card_type: "signal",
        title: trimmedTitle,
        body: `You created a note called \u201c${trimmedTitle}\u201d. It was added to Knowledge on the platform.`,
        source_type: "note",
        source_ref: sourceRef,
        priority: "low",
        visibility_scope: "personal",
        metadata: { note_id: noteId, created_by: "ceo" },
      });

      return NextResponse.json({
        success: true,
        note_id: noteId,
        feed_card_id: feedCard?.id || null,
      });
    }

    await sb.schema("brain").from("knowledge_chunks").delete().eq("kb_id", noteId);

    return NextResponse.json({
      success: true,
      note_id: noteId,
    });
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
      .eq("kb_id", note_id);

    if (error) {
      console.error("Note chunk delete error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: kbError } = await sb
      .from("knowledge_base")
      .delete()
      .eq("id", note_id);

    if (kbError) {
      console.error("Note delete error:", kbError.message);
      return NextResponse.json({ error: kbError.message }, { status: 500 });
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
