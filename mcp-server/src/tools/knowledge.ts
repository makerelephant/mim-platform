/**
 * Knowledge tools for MiM MCP Server
 *
 * search_knowledge    — Search knowledge base by title, tags, source type
 * get_knowledge_entry — Full KB entry with content and chunks
 * semantic_search     — RAG vector search across knowledge + correspondence
 * embed_knowledge     — Embed/re-embed a knowledge base entry's chunks
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { embedText, embedBatch, chunkText, estimateTokens } from "../lib/embeddings.js";

export function registerKnowledgeTools(server: McpServer) {

  // ── search_knowledge ──
  server.tool(
    "search_knowledge",
    "Search the knowledge base by title, tags, or source type. Returns documents with summaries. Use this to find uploaded docs, meeting notes, articles, and other stored knowledge.",
    {
      query: z.string().optional().describe("Search by title (partial, case-insensitive)"),
      source_type: z.string().optional().describe("Filter by source: upload, note, article, news, email, slack"),
      tag: z.string().optional().describe("Filter by tag"),
      entity_id: z.string().optional().describe("Filter by linked entity UUID"),
      limit: z.number().optional().default(20).describe("Max results (default 20)"),
    },
    async ({ query, source_type, tag, entity_id, limit }) => {
      let kbQuery = supabase.from("knowledge_base")
        .select("id, title, source_type, file_type, summary, tags, taxonomy_categories, entity_ids, processed, created_at")
        .eq("processed", true)
        .order("created_at", { ascending: false })
        .limit(limit ?? 20);

      if (query) kbQuery = kbQuery.ilike("title", `%${query}%`);
      if (source_type) kbQuery = kbQuery.eq("source_type", source_type);
      if (tag) kbQuery = kbQuery.contains("tags", [tag]);
      if (entity_id) kbQuery = kbQuery.contains("entity_ids", [entity_id]);

      const { data: entries, error } = await kbQuery;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!entries || entries.length === 0) return { content: [{ type: "text" as const, text: "No knowledge entries found." }] };

      const lines = entries.map((e: { id: string; title: string; source_type: string; file_type: string | null; summary: string | null; tags: string[] | null; created_at: string }) => {
        const typeLabel = e.file_type ? `[${e.file_type}]` : `[${e.source_type}]`;
        const tags = e.tags && e.tags.length > 0 ? ` tags: ${e.tags.join(", ")}` : "";
        const summaryPreview = e.summary ? `\n  ${e.summary.slice(0, 150)}${e.summary.length > 150 ? "..." : ""}` : "";
        return `• ${typeLabel} ${e.title} — ${e.created_at}${tags}${summaryPreview} (id: ${e.id})`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${entries.length} knowledge entry(ies):\n\n${lines.join("\n\n")}`,
        }],
      };
    }
  );

  // ── get_knowledge_entry ──
  server.tool(
    "get_knowledge_entry",
    "Get a knowledge base entry with its full content text and metadata. Use this to read uploaded documents, meeting notes, or articles.",
    {
      kb_id: z.string().describe("Knowledge base entry UUID"),
      include_content: z.boolean().optional().default(false).describe("Include full content_text (can be very long)"),
    },
    async ({ kb_id, include_content }) => {
      const { data: entry, error } = await supabase.from("knowledge_base")
        .select("*")
        .eq("id", kb_id)
        .single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!entry) return { content: [{ type: "text" as const, text: `Knowledge entry ${kb_id} not found.` }] };

      const sections: string[] = [];
      sections.push(`# ${entry.title}`);
      sections.push(`**ID:** ${entry.id}`);
      sections.push(`**Source:** ${entry.source_type}${entry.file_type ? ` (${entry.file_type})` : ""}`);
      if (entry.source_ref) sections.push(`**Reference:** ${entry.source_ref}`);
      sections.push(`**Created:** ${entry.created_at}`);

      if (entry.summary) sections.push(`\n## Summary\n${entry.summary}`);

      if (entry.tags && entry.tags.length > 0) sections.push(`**Tags:** ${entry.tags.join(", ")}`);
      if (entry.taxonomy_categories && entry.taxonomy_categories.length > 0) sections.push(`**Categories:** ${entry.taxonomy_categories.join(", ")}`);

      // Resolve entity names
      if (entry.entity_ids && entry.entity_ids.length > 0) {
        const { data: orgs } = await supabase.schema("core").from("organizations").select("id, name").in("id", entry.entity_ids);
        const { data: contacts } = await supabase.schema("core").from("contacts").select("id, first_name, last_name").in("id", entry.entity_ids);
        const names: string[] = [];
        for (const o of orgs ?? []) names.push(o.name);
        for (const c of contacts ?? []) names.push([c.first_name, c.last_name].filter(Boolean).join(" "));
        if (names.length > 0) sections.push(`**Linked entities:** ${names.join(", ")}`);
      }

      // Content chunks summary
      if (entry.content_chunks && Array.isArray(entry.content_chunks)) {
        const totalTokens = entry.content_chunks.reduce((sum: number, c: { token_count: number }) => sum + (c.token_count || 0), 0);
        sections.push(`\n**Chunks:** ${entry.content_chunks.length} chunks, ~${totalTokens} tokens total`);
      }

      // Check vector embedding status
      const { count } = await supabase.schema("brain").from("knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("kb_id", kb_id);
      sections.push(`**Embedded chunks:** ${count ?? 0}`);

      // Full content (optionally)
      if (include_content && entry.content_text) {
        const content = entry.content_text.length > 10000
          ? entry.content_text.slice(0, 10000) + "\n\n... [truncated — full content is " + entry.content_text.length + " chars]"
          : entry.content_text;
        sections.push(`\n## Full Content\n${content}`);
      }

      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    }
  );

  // ── semantic_search ──
  server.tool(
    "semantic_search",
    `Search the brain's knowledge using semantic/meaning-based vector search (RAG). Searches across:
- Knowledge base documents (uploaded docs, articles, meeting notes)
- Email/Slack correspondence

Returns the most relevant text chunks ranked by semantic similarity. Use this when you need to find information by meaning rather than exact keywords.`,
    {
      query: z.string().describe("Natural language search query"),
      source: z.enum(["all", "knowledge", "correspondence"]).optional().default("all").describe("Which sources to search: all, knowledge, or correspondence"),
      limit: z.number().optional().default(10).describe("Max results per source (default 10)"),
      threshold: z.number().optional().default(0.4).describe("Minimum similarity threshold 0-1 (default 0.4)"),
    },
    async ({ query, source, limit, threshold }) => {
      try {
        // Generate embedding for the query
        const queryEmbedding = await embedText(query);
        const embeddingStr = `[${queryEmbedding.join(",")}]`;
        const sections: string[] = [];
        const matchLimit = limit ?? 10;
        const matchThreshold = threshold ?? 0.4;

        // Search knowledge chunks
        if (source === "all" || source === "knowledge") {
          const { data: kbResults, error: kbErr } = await supabase.schema("brain")
            .rpc("search_knowledge", {
              query_embedding: embeddingStr,
              match_count: matchLimit,
              match_threshold: matchThreshold,
            });

          if (kbErr) {
            sections.push(`Knowledge search error: ${kbErr.message}`);
          } else if (kbResults && kbResults.length > 0) {
            sections.push(`## KNOWLEDGE BASE RESULTS (${kbResults.length} matches)\n`);
            for (const r of kbResults as Array<{ kb_id: string; title: string; source_type: string; file_type: string | null; content: string; similarity: number }>) {
              const typeLabel = r.file_type ? `[${r.file_type}]` : `[${r.source_type}]`;
              const sim = (r.similarity * 100).toFixed(1);
              const preview = r.content.length > 300 ? r.content.slice(0, 300) + "..." : r.content;
              sections.push(`### ${typeLabel} ${r.title} (${sim}% match)`);
              sections.push(`${preview}\n`);
              sections.push(`_Source: ${r.kb_id}_\n`);
            }
          } else {
            sections.push("No knowledge base matches found.\n");
          }
        }

        // Search correspondence chunks
        if (source === "all" || source === "correspondence") {
          const { data: corrResults, error: corrErr } = await supabase.schema("brain")
            .rpc("search_correspondence", {
              query_embedding: embeddingStr,
              match_count: matchLimit,
              match_threshold: matchThreshold,
            });

          if (corrErr) {
            sections.push(`Correspondence search error: ${corrErr.message}`);
          } else if (corrResults && corrResults.length > 0) {
            sections.push(`## CORRESPONDENCE RESULTS (${corrResults.length} matches)\n`);
            for (const r of corrResults as Array<{ correspondence_id: string; subject: string; channel: string; direction: string; entity_type: string | null; sent_at: string | null; content: string; similarity: number }>) {
              const sim = (r.similarity * 100).toFixed(1);
              const dir = r.direction === "outbound" ? "→ SENT" : "← RECEIVED";
              const preview = r.content.length > 300 ? r.content.slice(0, 300) + "..." : r.content;
              const date = r.sent_at ? new Date(r.sent_at).toLocaleDateString() : "unknown";
              sections.push(`### [${r.channel}] ${dir} "${r.subject}" (${sim}% match, ${date})`);
              sections.push(`${preview}\n`);
            }
          } else {
            sections.push("No correspondence matches found.\n");
          }
        }

        if (sections.length === 0) {
          return { content: [{ type: "text" as const, text: "No results found. Try a broader query or lower the similarity threshold." }] };
        }

        return { content: [{ type: "text" as const, text: sections.join("\n") }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Semantic search error: ${msg}` }] };
      }
    }
  );

  // ── embed_knowledge ──
  server.tool(
    "embed_knowledge",
    "Embed (or re-embed) a knowledge base entry's text chunks into vector space for semantic search. Run this after uploading new documents or to refresh embeddings.",
    {
      kb_id: z.string().optional().describe("Specific KB entry UUID to embed. If omitted, embeds all unembedded entries."),
      force: z.boolean().optional().default(false).describe("Force re-embed even if already embedded"),
    },
    async ({ kb_id, force }) => {
      try {
        // Build query for entries to embed
        let query = supabase.from("knowledge_base")
          .select("id, title, content_text, content_chunks")
          .eq("processed", true);

        if (kb_id) {
          query = query.eq("id", kb_id);
        }

        const { data: entries, error } = await query;
        if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
        if (!entries || entries.length === 0) return { content: [{ type: "text" as const, text: "No knowledge entries to embed." }] };

        let totalChunks = 0;
        let totalEmbedded = 0;
        const results: string[] = [];

        for (const entry of entries) {
          // Check if already embedded
          if (!force) {
            const { count } = await supabase.schema("brain").from("knowledge_chunks")
              .select("id", { count: "exact", head: true })
              .eq("kb_id", entry.id);
            if (count && count > 0) {
              results.push(`• ${entry.title} — already embedded (${count} chunks), skipped`);
              continue;
            }
          }

          // Get text chunks — prefer existing content_chunks JSONB, fallback to chunking content_text
          let textChunks: string[] = [];
          if (entry.content_chunks && Array.isArray(entry.content_chunks) && entry.content_chunks.length > 0) {
            textChunks = entry.content_chunks.map((c: { text: string }) => c.text).filter(Boolean);
          } else if (entry.content_text) {
            textChunks = chunkText(entry.content_text, 500);
          }

          if (textChunks.length === 0) {
            results.push(`• ${entry.title} — no content to embed, skipped`);
            continue;
          }

          totalChunks += textChunks.length;

          // If force re-embed, delete existing chunks first
          if (force) {
            await supabase.schema("brain").from("knowledge_chunks")
              .delete()
              .eq("kb_id", entry.id);
          }

          // Generate embeddings in batch
          const embeddings = await embedBatch(textChunks);

          // Insert chunks with embeddings
          const rows = textChunks.map((text, idx) => ({
            kb_id: entry.id,
            chunk_index: idx,
            content: text,
            token_count: estimateTokens(text),
            embedding: `[${embeddings[idx].join(",")}]`,
            metadata: { title: entry.title },
          }));

          const { error: insertErr } = await supabase.schema("brain")
            .from("knowledge_chunks")
            .insert(rows);

          if (insertErr) {
            results.push(`• ${entry.title} — ERROR: ${insertErr.message}`);
          } else {
            totalEmbedded += textChunks.length;
            results.push(`• ${entry.title} — embedded ${textChunks.length} chunk(s)`);
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: `Embedding complete: ${totalEmbedded}/${totalChunks} chunks embedded across ${entries.length} entries.\n\n${results.join("\n")}`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Embedding error: ${msg}` }] };
      }
    }
  );

  // ── embed_correspondence ──
  server.tool(
    "embed_correspondence",
    "Embed email/Slack correspondence into vector space for semantic search. Processes unembedded correspondence entries.",
    {
      entity_id: z.string().optional().describe("Only embed correspondence for this entity"),
      days: z.number().optional().default(90).describe("How many days back to embed (default 90)"),
      force: z.boolean().optional().default(false).describe("Force re-embed even if already embedded"),
    },
    async ({ entity_id, days, force }) => {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (days ?? 90));

        let query = supabase.schema("brain").from("correspondence")
          .select("id, subject, body, channel, direction, entity_id, entity_type, sent_at")
          .gte("sent_at", cutoff.toISOString())
          .order("sent_at", { ascending: false });

        if (entity_id) {
          query = query.eq("entity_id", entity_id);
        }

        const { data: messages, error } = await query;
        if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
        if (!messages || messages.length === 0) return { content: [{ type: "text" as const, text: "No correspondence to embed." }] };

        let totalEmbedded = 0;
        let skipped = 0;

        // Check which are already embedded
        const msgIds = messages.map((m: { id: string }) => m.id);
        const { data: existingChunks } = await supabase.schema("brain")
          .from("correspondence_chunks")
          .select("correspondence_id")
          .in("correspondence_id", msgIds);

        const existingSet = new Set((existingChunks ?? []).map((c: { correspondence_id: string }) => c.correspondence_id));

        // Process messages in batches
        const toEmbed: Array<{ id: string; subject: string; body: string; channel: string }> = [];
        for (const msg of messages as Array<{ id: string; subject: string; body: string | null; channel: string }>) {
          if (!force && existingSet.has(msg.id)) {
            skipped++;
            continue;
          }
          if (!msg.body || msg.body.trim().length === 0) {
            skipped++;
            continue;
          }
          toEmbed.push(msg as { id: string; subject: string; body: string; channel: string });
        }

        if (toEmbed.length === 0) {
          return { content: [{ type: "text" as const, text: `All ${messages.length} messages already embedded (${skipped} skipped).` }] };
        }

        // Process in batches of 20
        for (let i = 0; i < toEmbed.length; i += 20) {
          const batch = toEmbed.slice(i, i + 20);

          // Prepare text for each message (subject + body)
          const texts = batch.map((m) => {
            const header = `Subject: ${m.subject}\nChannel: ${m.channel}\n\n`;
            return header + m.body;
          });

          // Chunk each message and flatten for batch embedding
          const allChunks: Array<{ corrId: string; chunkIndex: number; text: string }> = [];
          for (let j = 0; j < texts.length; j++) {
            const chunks = chunkText(texts[j], 500);
            for (let k = 0; k < chunks.length; k++) {
              allChunks.push({ corrId: batch[j].id, chunkIndex: k, text: chunks[k] });
            }
          }

          if (allChunks.length === 0) continue;

          // Batch embed
          const embeddings = await embedBatch(allChunks.map((c) => c.text));

          // If force, delete existing
          if (force) {
            const corrIds = [...new Set(allChunks.map((c) => c.corrId))];
            await supabase.schema("brain").from("correspondence_chunks")
              .delete()
              .in("correspondence_id", corrIds);
          }

          // Insert
          const rows = allChunks.map((chunk, idx) => ({
            correspondence_id: chunk.corrId,
            chunk_index: chunk.chunkIndex,
            content: chunk.text,
            token_count: estimateTokens(chunk.text),
            embedding: `[${embeddings[idx].join(",")}]`,
          }));

          const { error: insertErr } = await supabase.schema("brain")
            .from("correspondence_chunks")
            .insert(rows);

          if (insertErr) {
            return { content: [{ type: "text" as const, text: `Error inserting batch: ${insertErr.message}` }] };
          }

          totalEmbedded += batch.length;
        }

        return {
          content: [{
            type: "text" as const,
            text: `Embedded ${totalEmbedded} correspondence messages (${skipped} skipped, already embedded or empty). Total messages checked: ${messages.length}.`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Embedding error: ${msg}` }] };
      }
    }
  );
}
