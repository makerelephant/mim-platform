/**
 * Backfill Embeddings Script
 *
 * Embeds all existing knowledge_base entries and correspondence
 * that don't yet have vector embeddings.
 *
 * Usage: cd mcp-server && npx tsx src/scripts/backfill-embeddings.ts
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { embedBatch, chunkText, estimateTokens } from "../lib/embeddings.js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const sb = createClient(supabaseUrl, supabaseKey);

async function backfillKnowledge() {
  console.log("═══ Backfilling Knowledge Base Embeddings ═══\n");

  const { data: entries, error } = await sb.from("knowledge_base")
    .select("id, title, content_text, content_chunks")
    .eq("processed", true);

  if (error) {
    console.error("Error loading knowledge_base:", error.message);
    return;
  }

  console.log(`Found ${entries?.length ?? 0} processed knowledge entries`);

  let totalEmbedded = 0;
  let totalSkipped = 0;

  for (const entry of entries ?? []) {
    // Check if already embedded
    const { count } = await sb.schema("brain").from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("kb_id", entry.id);

    if (count && count > 0) {
      console.log(`  ✓ ${entry.title} — already embedded (${count} chunks)`);
      totalSkipped++;
      continue;
    }

    // Get text chunks
    let textChunks: string[] = [];
    if (entry.content_chunks && Array.isArray(entry.content_chunks) && entry.content_chunks.length > 0) {
      textChunks = entry.content_chunks.map((c: { text: string }) => c.text).filter(Boolean);
    } else if (entry.content_text) {
      textChunks = chunkText(entry.content_text, 500);
    }

    if (textChunks.length === 0) {
      console.log(`  ⊘ ${entry.title} — no content`);
      totalSkipped++;
      continue;
    }

    try {
      const embeddings = await embedBatch(textChunks);

      const rows = textChunks.map((text, idx) => ({
        kb_id: entry.id,
        chunk_index: idx,
        content: text,
        token_count: estimateTokens(text),
        embedding: `[${embeddings[idx].join(",")}]`,
        metadata: { title: entry.title },
      }));

      const { error: insertErr } = await sb.schema("brain")
        .from("knowledge_chunks")
        .insert(rows);

      if (insertErr) {
        console.error(`  ✗ ${entry.title} — ${insertErr.message}`);
      } else {
        console.log(`  ✓ ${entry.title} — embedded ${textChunks.length} chunk(s)`);
        totalEmbedded += textChunks.length;
      }
    } catch (err) {
      console.error(`  ✗ ${entry.title} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nKnowledge: ${totalEmbedded} chunks embedded, ${totalSkipped} entries skipped\n`);
}

async function backfillCorrespondence() {
  console.log("═══ Backfilling Correspondence Embeddings ═══\n");

  // Get all correspondence with body text
  const { data: messages, error } = await sb.schema("brain").from("correspondence")
    .select("id, subject, body, channel, direction")
    .not("body", "is", null)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("Error loading correspondence:", error.message);
    return;
  }

  console.log(`Found ${messages?.length ?? 0} correspondence entries with body text`);

  // Get already embedded IDs
  const { data: existing } = await sb.schema("brain")
    .from("correspondence_chunks")
    .select("correspondence_id");
  const existingSet = new Set((existing ?? []).map((c: { correspondence_id: string }) => c.correspondence_id));

  const toEmbed = (messages ?? []).filter((m: { id: string }) => !existingSet.has(m.id));
  console.log(`${toEmbed.length} need embedding, ${existingSet.size} already done\n`);

  let totalEmbedded = 0;

  // Process in batches of 20
  for (let i = 0; i < toEmbed.length; i += 20) {
    const batch = toEmbed.slice(i, i + 20);

    const allChunks: Array<{ corrId: string; chunkIndex: number; text: string }> = [];
    for (const msg of batch) {
      const text = `Subject: ${(msg as { subject: string }).subject}\nChannel: ${(msg as { channel: string }).channel}\n\n${(msg as { body: string }).body}`;
      const chunks = chunkText(text, 500);
      for (let k = 0; k < chunks.length; k++) {
        allChunks.push({ corrId: (msg as { id: string }).id, chunkIndex: k, text: chunks[k] });
      }
    }

    if (allChunks.length === 0) continue;

    try {
      const embeddings = await embedBatch(allChunks.map((c) => c.text));

      const rows = allChunks.map((chunk, idx) => ({
        correspondence_id: chunk.corrId,
        chunk_index: chunk.chunkIndex,
        content: chunk.text,
        token_count: estimateTokens(chunk.text),
        embedding: `[${embeddings[idx].join(",")}]`,
      }));

      const { error: insertErr } = await sb.schema("brain")
        .from("correspondence_chunks")
        .insert(rows);

      if (insertErr) {
        console.error(`  ✗ Batch ${i / 20 + 1} — ${insertErr.message}`);
      } else {
        totalEmbedded += batch.length;
        console.log(`  ✓ Batch ${i / 20 + 1}: embedded ${batch.length} messages (${allChunks.length} chunks)`);
      }
    } catch (err) {
      console.error(`  ✗ Batch ${i / 20 + 1} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nCorrespondence: ${totalEmbedded} messages embedded\n`);
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  MiM Brain — Embedding Backfill      ║");
  console.log("╚══════════════════════════════════════╝\n");

  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY not set in mcp-server/.env");
    console.error("Add it and try again.");
    process.exit(1);
  }

  await backfillKnowledge();
  await backfillCorrespondence();

  console.log("═══ Backfill Complete ═══");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
