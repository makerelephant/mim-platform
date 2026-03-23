/**
 * Server-side persistence of Canvas Q&A into the Knowledge index.
 * Ensures recall does not depend on the browser fire-and-forget /api/brain/ingest call.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { processTextInput } from "@/lib/document-processor";
import { embedKnowledgeContentIntoChunks } from "@/lib/knowledge-chunks-writer";

const MIN_COMBINED_CHARS = 40;

export async function persistCanvasTurnToKnowledge(
  sb: SupabaseClient,
  params: {
    sessionId: string;
    question: string;
    answer: string;
    clearingMessageIds?: { user?: string | null; brain?: string | null };
  },
): Promise<{ kbId: string | null; embedOk: boolean }> {
  const { sessionId, question, answer } = params;
  const combined = `CEO asked:\n${question}\n\nBrain answer:\n${answer}`;

  if (combined.trim().length < MIN_COMBINED_CHARS) {
    return { kbId: null, embedOk: false };
  }

  const title =
    `Canvas — ${question.slice(0, 72)}${question.length > 72 ? "…" : ""}`;

  const { chunks } = processTextInput(combined);

  const { data: row, error } = await sb
    .from("knowledge_base")
    .insert({
      title,
      source_type: "clearing_turn",
      source_ref: sessionId,
      file_type: null,
      content_text: combined,
      content_chunks: chunks,
      summary: answer.slice(0, 500),
      taxonomy_categories: null,
      entity_ids: null,
      tags: ["clearing", "server_persist"],
      metadata: {
        session_id: sessionId,
        clearing_message_user_id: params.clearingMessageIds?.user ?? null,
        clearing_message_brain_id: params.clearingMessageIds?.brain ?? null,
      },
      uploaded_by: "ceo",
      processed: true,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !row?.id) {
    console.error("[clearing-turn-knowledge] knowledge_base insert failed:", error?.message);
    return { kbId: null, embedOk: false };
  }

  const kbId = row.id as string;

  const { embedOk } = await embedKnowledgeContentIntoChunks(sb, kbId, combined, {
    title,
    source_type: "clearing_turn",
    categories: null,
  });

  try {
    await sb.schema("brain").from("activity").insert({
      entity_type: "system",
      entity_id: null,
      action: "clearing_turn_indexed",
      actor: "brain-ask",
      metadata: {
        summary: `Canvas Q&A indexed for Knowledge recall (${sessionId.slice(0, 8)}…)`,
        knowledge_base_id: kbId,
        session_id: sessionId,
        embed_ok: embedOk,
        text_length: combined.length,
      },
    });
  } catch {
    /* non-fatal */
  }

  console.log(
    `[memory-index] clearing_turn kb=${kbId} session=${sessionId.slice(0, 8)}… embed_ok=${embedOk}`,
  );

  return { kbId, embedOk };
}
