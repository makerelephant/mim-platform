import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { embedText } from "@/lib/embeddings";
import { emitFeedCard } from "@/lib/feed-card-emitter";
import { getBrainAskPrompt } from "@/lib/prompts";

export const maxDuration = 120;

/** Row shape from brain.search_knowledge / brain.search_knowledge_for_kb */
type KnowledgeChunkRow = {
  id: string;
  kb_id: string;
  chunk_index: number;
  content: string | null;
  token_count: number | null;
  metadata: Record<string, unknown> | null;
  similarity?: number;
};

function chunkDedupeKey(row: { kb_id: string; chunk_index: number }): string {
  return `${row.kb_id}:${row.chunk_index}`;
}

async function searchKnowledgeForKb(
  sb: SupabaseClient,
  kbId: string,
  embeddingStr: string,
  matchCount: number,
  matchThreshold: number,
): Promise<KnowledgeChunkRow[]> {
  const { data, error } = await sb.schema("brain").rpc("search_knowledge_for_kb", {
    target_kb_id: kbId,
    query_embedding: embeddingStr,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });
  if (error) {
    console.warn("[brain/ask] search_knowledge_for_kb failed:", error.message);
    return [];
  }
  return (data as KnowledgeChunkRow[]) ?? [];
}

function appendKnowledgeChunksToContext(
  contextParts: string[],
  sourceNotes: string[],
  title: string,
  rows: KnowledgeChunkRow[],
  filledVectorChunkKeys: Set<string>,
  sectionHeader: string,
) {
  const fresh: KnowledgeChunkRow[] = [];
  for (const r of rows) {
    const k = chunkDedupeKey(r);
    if (filledVectorChunkKeys.has(k)) continue;
    filledVectorChunkKeys.add(k);
    fresh.push(r);
  }
  if (fresh.length === 0) return;

  contextParts.push(sectionHeader);
  for (const r of fresh) {
    const sim = r.similarity != null ? ` (similarity ${(r.similarity * 100).toFixed(0)}%)` : "";
    contextParts.push(`[Chunk ${r.chunk_index}]${sim}`);
    contextParts.push((r.content || "").trim());
    contextParts.push("");
  }
  sourceNotes.push(`${fresh.length} vector chunk(s) from «${title}»`);
}

const GLOBAL_KNOWLEDGE_MATCH_COUNT = 48;
const SCOPED_KB_MATCH_COUNT_SESSION = 40;
const SCOPED_KB_MATCH_COUNT_RECENT = 36;
const SCOPED_KB_THRESHOLD = 0.12;

/**
 * POST /api/brain/ask
 *
 * Ask the MiM Brain a question and get a cross-source intelligence answer.
 * Body: { question: string, context_days?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase config" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const question = body.question?.trim();
    const contextDays = body.context_days ?? 30;
    const persist = body.persist !== false; // default: persist to feed
    const scope = body.scope ?? "feed"; // "feed" or "clearing"

    if (!question) {
      return NextResponse.json(
        { success: false, error: "No question provided" },
        { status: 400 },
      );
    }

    const questionEmbedding = await embedText(question);
    const embeddingStr = questionEmbedding?.length
      ? `[${questionEmbedding.join(",")}]`
      : null;
    const filledVectorChunkKeys = new Set<string>();

    const contextParts: string[] = [];
    const sourceNotes: string[] = [];
    const sessionId = body.session_id;

    // ── 0. Session-aware: fetch recently ingested documents from this clearing session ──
    if (scope === "clearing" && sessionId) {
      try {
        // Find ingestion messages in this session to identify what was just uploaded
        const { data: sessionMessages } = await sb
          .schema("brain")
          .from("clearing_messages")
          .select("content, message_type, created_at")
          .eq("session_id", sessionId)
          .eq("message_type", "ingestion")
          .order("created_at", { ascending: false })
          .limit(10);

        // Extract document titles from ingestion messages (format: "Ingesting: filename (size)")
        const recentDocTitles: string[] = [];
        for (const msg of sessionMessages || []) {
          const match = msg.content?.match(/^Ingesting:\s*(.+?)\s*\(/);
          if (match) recentDocTitles.push(match[1].trim());
        }

        // Also check for "Absorbed" messages from brain responses
        const { data: brainMessages } = await sb
          .schema("brain")
          .from("clearing_messages")
          .select("content, message_type, created_at")
          .eq("session_id", sessionId)
          .eq("role", "brain")
          .order("created_at", { ascending: false })
          .limit(10);

        for (const msg of brainMessages || []) {
          const match = msg.content?.match(/^Absorbed\s+(.+?)\.\s/);
          if (match && !recentDocTitles.includes(match[1].trim())) {
            recentDocTitles.push(match[1].trim());
          }
        }

        // Fetch full content of recently ingested documents
        if (recentDocTitles.length > 0) {
          const { data: recentDocs } = await sb
            .schema("brain")
            .from("knowledge_base")
            .select("id, title, content_text, summary, taxonomy_categories, tags")
            .eq("processed", true)
            .in("title", recentDocTitles)
            .order("processed_at", { ascending: false })
            .limit(5);

          if (recentDocs && recentDocs.length > 0) {
            contextParts.push("## Documents Uploaded In This Session (HIGHEST PRIORITY — USE THIS DATA TO ANSWER)\n");
            contextParts.push("IMPORTANT: The user uploaded this document and is asking about it. Search through ALL the data below carefully. If the user says 'the model' or 'the file', they mean THIS document.\n");
            for (const doc of recentDocs) {
              contextParts.push(`**${doc.title}**`);
              if (doc.summary) contextParts.push(`Summary: ${doc.summary}`);
              // Include full content for session docs — up to 50000 chars
              if (doc.content_text) {
                const maxChars = 50000;
                contextParts.push(doc.content_text.slice(0, maxChars));
                if (doc.content_text.length > maxChars) {
                  contextParts.push(`... [Content truncated at ${maxChars} chars of ${doc.content_text.length} total — searching chunks for remaining data]\n`);
                }
              }
              contextParts.push("");

              // Beyond inline cap: pull top matching chunks for THIS kb via vector search (full chunk text)
              if (doc.content_text && doc.content_text.length > 50000 && embeddingStr) {
                try {
                  const scoped = await searchKnowledgeForKb(
                    sb,
                    doc.id,
                    embeddingStr,
                    SCOPED_KB_MATCH_COUNT_SESSION,
                    SCOPED_KB_THRESHOLD,
                  );
                  appendKnowledgeChunksToContext(
                    contextParts,
                    sourceNotes,
                    doc.title,
                    scoped,
                    filledVectorChunkKeys,
                    `## Additional sections from **${doc.title}** (vector retrieval — beyond first 50k chars)\n`,
                  );
                } catch (chunkErr) {
                  console.warn("Chunk search for session doc failed (non-fatal):", chunkErr);
                }
              } else if (doc.content_text && doc.content_text.length > 50000 && !embeddingStr) {
                // No OpenAI key: keyword fallback on full chunk table
                try {
                  const searchTerms = question.split(/\s+/).filter((w: string) => w.length > 2);
                  if (searchTerms.length > 0) {
                    const { data: matchingChunks } = await sb
                      .schema("brain")
                      .from("knowledge_chunks")
                      .select("content, chunk_index")
                      .eq("kb_id", doc.id)
                      .or(searchTerms.slice(0, 4).map((w: string) => `content.ilike.%${w}%`).join(","))
                      .order("chunk_index")
                      .limit(24);

                    if (matchingChunks && matchingChunks.length > 0) {
                      contextParts.push(`## Additional matching sections from ${doc.title} (keyword fallback — beyond first 50k chars)\n`);
                      for (const chunk of matchingChunks) {
                        contextParts.push(chunk.content);
                        contextParts.push("");
                      }
                      sourceNotes.push(`${matchingChunks.length} keyword chunk(s) from ${doc.title}`);
                    }
                  }
                } catch (chunkErr) {
                  console.warn("Keyword chunk search for session doc failed (non-fatal):", chunkErr);
                }
              }
            }
            sourceNotes.push(`${recentDocs.length} session document(s)`);
          }
        }

        // Also search for the document by keyword match if title parsing failed
        if (recentDocTitles.length === 0) {
          // Check if user is referencing a file by name in their question
          const fileRefMatch = question.match(/(?:file|document|spreadsheet|model|xlsx|pdf|report)\s+(?:called\s+)?["']?([^"'\n,]+?)["']?(?:\s|$|\.)/i)
            || question.match(/(?:in|from)\s+(?:this|the|my)\s+(?:file|document|spreadsheet|xlsx)\s+(.+?)(?:\s|$|\.)/i);
          if (fileRefMatch) {
            const searchTitle = fileRefMatch[1].trim();
            const { data: matchedDocs } = await sb
              .schema("brain")
              .from("knowledge_base")
              .select("id, title, content_text, summary")
              .eq("processed", true)
              .ilike("title", `%${searchTitle}%`)
              .order("processed_at", { ascending: false })
              .limit(2);

            if (matchedDocs && matchedDocs.length > 0) {
              contextParts.push("## Referenced Document (HIGHEST PRIORITY — USE THIS DATA TO ANSWER)\n");
              contextParts.push("IMPORTANT: The user is asking about THIS document. Search through ALL the data below carefully.\n");
              for (const doc of matchedDocs) {
                contextParts.push(`**${doc.title}**`);
                if (doc.summary) contextParts.push(`Summary: ${doc.summary}`);
                if (doc.content_text) {
                  const maxChars = 50000;
                  contextParts.push(doc.content_text.slice(0, maxChars));
                  if (doc.content_text.length > maxChars) {
                    contextParts.push(`... [Content truncated — vector retrieval for remaining sections]\n`);
                    try {
                      if (embeddingStr) {
                        const scoped = await searchKnowledgeForKb(
                          sb,
                          doc.id,
                          embeddingStr,
                          SCOPED_KB_MATCH_COUNT_SESSION,
                          SCOPED_KB_THRESHOLD,
                        );
                        appendKnowledgeChunksToContext(
                          contextParts,
                          sourceNotes,
                          doc.title,
                          scoped,
                          filledVectorChunkKeys,
                          `## Additional sections from **${doc.title}** (vector retrieval)\n`,
                        );
                      } else {
                        const searchTerms = question.split(/\s+/).filter((w: string) => w.length > 2);
                        if (searchTerms.length > 0) {
                          const { data: matchingChunks } = await sb
                            .schema("brain")
                            .from("knowledge_chunks")
                            .select("content, chunk_index")
                            .eq("kb_id", doc.id)
                            .or(searchTerms.slice(0, 4).map((w: string) => `content.ilike.%${w}%`).join(","))
                            .order("chunk_index")
                            .limit(24);

                          if (matchingChunks && matchingChunks.length > 0) {
                            contextParts.push(`## Additional matching sections:\n`);
                            for (const chunk of matchingChunks) {
                              contextParts.push(chunk.content);
                              contextParts.push("");
                            }
                          }
                        }
                      }
                    } catch {
                      // non-fatal
                    }
                  }
                }
                contextParts.push("");
              }
              sourceNotes.push(`${matchedDocs.length} referenced document(s)`);
            }
          }
        }
      } catch (sessionErr) {
        console.warn("Session document lookup failed (non-fatal):", sessionErr);
      }
    }

    // ── 0b. Recently ingested documents (last 7 days) — guaranteed recall window ──
    // BULLETPROOF RECALL: anything submitted in the last 7 days must be recallable
    if (contextParts.length === 0 || !contextParts.some(p => p.includes("HIGHEST PRIORITY"))) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentKb } = await sb
          .schema("brain")
          .from("knowledge_base")
          .select("id, title, content_text, summary, source_type, processed_at")
          .eq("processed", true)
          .gte("processed_at", sevenDaysAgo)
          .order("processed_at", { ascending: false })
          .limit(15);

        if (recentKb && recentKb.length > 0) {
          // Rank by relevance to question — include all but prioritize matches
          const questionLower = question.toLowerCase();
          const qWords = questionLower.split(/\s+/).filter((w: string) => w.length > 3);

          const scored = recentKb.map((doc: any) => {
            let score = 0;
            const titleLower = (doc.title || "").toLowerCase();
            const summaryLower = (doc.summary || "").toLowerCase();
            for (const w of qWords) {
              if (titleLower.includes(w)) score += 3;
              if (summaryLower.includes(w)) score += 2;
            }
            // Recency bonus: docs from last 24h get +5
            const age = Date.now() - new Date(doc.processed_at).getTime();
            if (age < 24 * 60 * 60 * 1000) score += 5;
            else if (age < 3 * 24 * 60 * 60 * 1000) score += 2;
            return { ...doc, _score: score };
          });

          scored.sort((a: any, b: any) => b._score - a._score);

          // Take top 8 by relevance
          const topDocs = scored.slice(0, 8);

          contextParts.push("## Recently Ingested Documents (last 7 days)\n");
          contextParts.push("IMPORTANT: These documents were recently submitted. If the user asks about information 'submitted earlier', 'from this week', or 'recently', this is what they mean.\n");
          for (const doc of topDocs) {
            contextParts.push(`**${doc.title}** [${doc.source_type || "unknown"}]`);
            if (doc.summary) contextParts.push(`Summary: ${doc.summary}`);
            if (doc.content_text) {
              const maxChars = 20000;
              contextParts.push(doc.content_text.slice(0, maxChars));
              if (doc.content_text.length > maxChars) {
                contextParts.push(
                  `... [Showing first ${maxChars} chars of ${doc.content_text.length} total — vector chunks below]\n`,
                );
                if (embeddingStr) {
                  const scoped = await searchKnowledgeForKb(
                    sb,
                    doc.id,
                    embeddingStr,
                    SCOPED_KB_MATCH_COUNT_RECENT,
                    SCOPED_KB_THRESHOLD,
                  );
                  appendKnowledgeChunksToContext(
                    contextParts,
                    sourceNotes,
                    doc.title,
                    scoped,
                    filledVectorChunkKeys,
                    `### Vector-retrieved sections from **${doc.title}**\n`,
                  );
                }
              }
            }
            contextParts.push("");
          }
          sourceNotes.push(`${topDocs.length} recently ingested doc(s) (7-day window)`);
        }
      } catch (recentErr) {
        console.warn("Recent document lookup failed (non-fatal):", recentErr);
      }
    }

    // ── 0c. Recent clearing session messages (last 24h) — persistent memory across sessions ──
    // If user says "I submitted X earlier", search recent clearing messages for relevant content
    if (scope === "clearing") {
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentClearing } = await sb
          .schema("brain")
          .from("clearing_messages")
          .select("content, role, created_at, session_id")
          .in("role", ["user", "brain"])
          .gte("created_at", twentyFourHoursAgo)
          .neq("session_id", sessionId || "")
          .order("created_at", { ascending: false })
          .limit(30);

        if (recentClearing && recentClearing.length > 0) {
          // Filter to only user messages that are substantial (not just short questions)
          const substantialMessages = recentClearing.filter(
            (m: any) => m.role === "user" && m.content && m.content.length > 50
          );
          if (substantialMessages.length > 0) {
            contextParts.push("## Earlier Canvas Submissions (today, other sessions)\n");
            for (const msg of substantialMessages.slice(0, 10)) {
              const time = new Date(msg.created_at).toLocaleTimeString();
              contextParts.push(`[${time}] ${msg.content.slice(0, 3000)}`);
              contextParts.push("");
            }
            sourceNotes.push(`${substantialMessages.length} earlier clearing message(s)`);
          }
        }
      } catch (clearErr) {
        console.warn("Recent clearing lookup failed (non-fatal):", clearErr);
      }
    }

    // ── 1. Entity resolution ──
    const entities = await resolveEntities(sb, question);
    if (entities.length > 0) {
      sourceNotes.push(`${entities.length} entity match(es)`);
    }

    // ── 2. Entity dossiers ──
    for (const entity of entities.slice(0, 3)) {
      const dossier = await buildMiniDossier(sb, entity);
      if (dossier) {
        contextParts.push(dossier);
      }
    }

    // ── 2b. Vector search (RAG) — full chunk text, deduped against scoped pulls above
    const vectorKbTitles = new Set<string>();
    const vectorCorrSubjects = new Set<string>();
    try {
      if (embeddingStr) {
        const [kbResult, corrResult] = await Promise.all([
          sb.schema("brain").rpc("search_knowledge", {
            query_embedding: embeddingStr,
            match_threshold: 0.18,
            match_count: GLOBAL_KNOWLEDGE_MATCH_COUNT,
          }),
          sb.schema("brain").rpc("search_correspondence", {
            query_embedding: embeddingStr,
            match_threshold: 0.18,
            match_count: 20,
          }),
        ]);

        if (kbResult.error) {
          console.error("search_knowledge RPC error:", kbResult.error.message, kbResult.error.details);
        }
        if (corrResult.error) {
          console.error("search_correspondence RPC error:", corrResult.error.message, corrResult.error.details);
        }

        const kbVectorResults = kbResult.data as KnowledgeChunkRow[] | null;
        const corrVectorResults = corrResult.data;

        if (kbVectorResults && kbVectorResults.length > 0) {
          contextParts.push("## Knowledge Base (Vector Search — full retrieved chunks)\n");
          let added = 0;
          for (const r of kbVectorResults) {
            if (r.kb_id == null) continue;
            const key = chunkDedupeKey(r);
            if (filledVectorChunkKeys.has(key)) continue;
            filledVectorChunkKeys.add(key);

            const title = (r.metadata?.title as string) || "Untitled";
            vectorKbTitles.add(title);
            const similarity = r.similarity != null ? ` (${(r.similarity * 100).toFixed(0)}% match)` : "";
            contextParts.push(`**${title}** · chunk ${r.chunk_index}${similarity}`);
            contextParts.push((r.content || "").trim());
            contextParts.push("");
            added++;
          }
          if (added > 0) {
            sourceNotes.push(`${added} global vector knowledge chunk(s) (full text)`);
          }
        }

        if (corrVectorResults && corrVectorResults.length > 0) {
          contextParts.push("## Correspondence (Vector Search)\n");
          for (const r of corrVectorResults) {
            const subject = r.subject || r.metadata?.subject || "No subject";
            vectorCorrSubjects.add(subject);
            const similarity = r.similarity ? ` (${(r.similarity * 100).toFixed(0)}% match)` : "";
            const dir = r.direction === "outbound" ? "SENT" : "RECEIVED";
            const date = r.sent_at ? new Date(r.sent_at).toLocaleDateString() : "";
            contextParts.push(`- [${r.channel || "email"}/${dir}] "${subject}" (${date})${similarity}`);
            if (r.content) contextParts.push(`  ${r.content.trim()}`);
          }
          contextParts.push("");
          sourceNotes.push(`${corrVectorResults.length} vector correspondence matches`);
        }
      }
    } catch (vecErr) {
      console.error("Vector search exception (falling back to keyword):", vecErr);
    }

    // ── 3. Knowledge keyword search (title + summary + tags) ──
    const words = question.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
    if (words.length > 0) {
      // Search across title AND summary for broader recall
      const orConditions = words.flatMap((w: string) => [
        `title.ilike.%${w}%`,
        `summary.ilike.%${w}%`,
      ]);
      const { data: kbResults } = await sb
        .schema("brain")
        .from("knowledge_base")
        .select("title, summary, source_type, taxonomy_categories, tags")
        .eq("processed", true)
        .or(orConditions.join(","))
        .limit(10);

      if (kbResults && kbResults.length > 0) {
        // Deduplicate: skip results already found via vector search
        const filtered = kbResults.filter((kb: any) => !vectorKbTitles.has(kb.title));
        if (filtered.length > 0) {
          contextParts.push("## Knowledge Base (Keyword)\n");
          for (const kb of filtered) {
            contextParts.push(`**${kb.title}** [${kb.source_type}]`);
            if (kb.summary) contextParts.push(kb.summary.slice(0, 500));
            if (kb.tags?.length) contextParts.push(`Tags: ${kb.tags.join(", ")}`);
            contextParts.push("");
          }
          sourceNotes.push(`${filtered.length} keyword knowledge docs`);
        }
      }
    }

    // ── 4. Recent correspondence (subject + summary + from_address) ──
    if (words.length > 0) {
      const corrConditions = words.flatMap((w: string) => [
        `subject.ilike.%${w}%`,
        `summary.ilike.%${w}%`,
        `from_address.ilike.%${w}%`,
      ]);
      const { data: corr } = await sb
        .schema("brain")
        .from("correspondence")
        .select("subject, direction, channel, sent_at, from_address, summary")
        .or(corrConditions.join(","))
        .order("sent_at", { ascending: false })
        .limit(12);

      if (corr && corr.length > 0) {
        // Deduplicate: skip results already found via vector search
        const filteredCorr = corr.filter((c: any) => !vectorCorrSubjects.has(c.subject));
        if (filteredCorr.length > 0) {
          contextParts.push("## Recent Correspondence (Keyword)\n");
          for (const c of filteredCorr) {
            const dir = c.direction === "outbound" ? "SENT" : "RECEIVED";
            const date = c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "";
            contextParts.push(`- [${c.channel}/${dir}] "${c.subject}" (${date})`);
            if (c.summary) contextParts.push(`  ${c.summary.slice(0, 200)}`);
          }
          contextParts.push("");
          sourceNotes.push(`${filteredCorr.length} keyword correspondence matches`);
        }
      }
    }

    // ── 4b. Recent feed cards (brain's own output — last 7 days) ──
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const feedConditions = words.length > 0
        ? words.flatMap((w: string) => [`title.ilike.%${w}%`, `body.ilike.%${w}%`]).join(",")
        : null;

      if (feedConditions) {
        const { data: feedResults } = await sb
          .schema("brain")
          .from("feed_cards")
          .select("card_type, title, body, source_type, entity_name, priority, created_at")
          .gte("created_at", sevenDaysAgo)
          .or(feedConditions)
          .order("created_at", { ascending: false })
          .limit(8);

        if (feedResults && feedResults.length > 0) {
          contextParts.push("## Recent Feed Cards (Brain Output — Last 7 Days)\n");
          for (const fc of feedResults) {
            const date = new Date(fc.created_at).toLocaleDateString();
            contextParts.push(`- [${fc.card_type}/${fc.priority || "medium"}] **${fc.title}** (${date}, from ${fc.source_type})`);
            if (fc.entity_name) contextParts.push(`  Entity: ${fc.entity_name}`);
            if (fc.body) contextParts.push(`  ${fc.body.slice(0, 300)}`);
          }
          contextParts.push("");
          sourceNotes.push(`${feedResults.length} recent feed cards`);
        }
      }
    } catch (feedErr) {
      console.warn("Feed card search failed (non-fatal):", feedErr);
    }

    // ── 4c. Derived insights ──
    try {
      // Query active insights that match the question's entities or categories
      const entityIds = entities.map((e) => e.id);
      const matchingWords = words.filter((w: string) => w.length > 3);

      const { data: allInsights } = await sb
        .schema("brain")
        .from("derived_insights")
        .select("id, insight_type, description, confidence, taxonomy_categories, entity_ids, scope, created_at")
        .eq("status", "active")
        .order("confidence", { ascending: false })
        .limit(10);

      if (allInsights && allInsights.length > 0) {
        // Filter for relevance: entity overlap, category keyword match, or high-confidence general insights
        const relevantInsights = allInsights.filter((insight: { entity_ids: string[] | null; taxonomy_categories: string[] | null; description: string; confidence: number }) => {
          // Check entity overlap
          if (insight.entity_ids && entityIds.length > 0) {
            const overlap = insight.entity_ids.filter((eid: string) => entityIds.includes(eid));
            if (overlap.length > 0) return true;
          }
          // Check category keyword match
          if (insight.taxonomy_categories && matchingWords.length > 0) {
            for (const cat of insight.taxonomy_categories) {
              for (const word of matchingWords) {
                if (cat.toLowerCase().includes(word.toLowerCase())) return true;
              }
            }
          }
          // Check description keyword match
          for (const word of matchingWords) {
            if (insight.description.toLowerCase().includes(word.toLowerCase())) return true;
          }
          // Include high-confidence general insights
          if (insight.confidence >= 0.8) return true;
          return false;
        });

        if (relevantInsights.length > 0) {
          contextParts.push("## Derived Insights (Brain Intelligence)\n");
          for (const insight of relevantInsights.slice(0, 5)) {
            const conf = Math.round(insight.confidence * 100);
            const date = new Date(insight.created_at).toLocaleDateString();
            contextParts.push(
              `- **[${insight.insight_type}]** ${insight.description} (${conf}% confidence, ${date})`,
            );
          }
          contextParts.push("");
          sourceNotes.push(`${relevantInsights.length} derived insights`);
        }
      }
    } catch (insightErr) {
      console.warn("Derived insights query failed (table may not exist yet):", insightErr);
    }

    // ── 5. Recent activity ──
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - contextDays);

    if (entities.length > 0) {
      const entityIds = entities.map((e) => e.id);
      const { data: activity } = await sb
        .schema("brain")
        .from("activity")
        .select("action, actor, metadata, created_at")
        .in("entity_id", entityIds)
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false })
        .limit(15);

      if (activity && activity.length > 0) {
        contextParts.push("## Recent Activity\n");
        for (const a of activity) {
          const date = new Date(a.created_at).toLocaleDateString();
          const summary = a.metadata?.summary || a.action;
          contextParts.push(`- [${date}] ${summary}`);
        }
        contextParts.push("");
        sourceNotes.push(`${activity.length} activity entries`);
      }
    }

    // ── 6. Active instructions ──
    const { data: instructions } = await sb
      .schema("brain")
      .from("instructions")
      .select("type, prompt")
      .eq("status", "active")
      .limit(10);

    if (instructions && instructions.length > 0) {
      contextParts.push("## Active Standing Orders\n");
      for (const instr of instructions) {
        contextParts.push(`- [${instr.type}] ${instr.prompt}`);
      }
      contextParts.push("");
    }

    // ── 7. Synthesize with Claude ──
    const context = contextParts.join("\n");

    if (!anthropicKey) {
      // No AI synthesis — return raw context
      return NextResponse.json({
        success: true,
        answer: context || "No relevant information found in the brain.",
        sources: sourceNotes,
        raw: true,
      });
    }

    if (!context.trim()) {
      return NextResponse.json({
        success: true,
        answer: `I searched the brain for your question but didn't find specific information about that topic yet. As more data is ingested (emails, documents, Slack messages), I'll be able to provide better answers.\n\nTry asking about:\n- Your organizations and pipeline status\n- Recent correspondence or meetings\n- Knowledge base documents`,
        sources: [],
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // ── Build conversation history for clearing sessions ──
    // Include prior messages so the brain maintains multi-turn context
    const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (scope === "clearing" && sessionId) {
      try {
        const { data: priorMessages } = await sb
          .schema("brain")
          .from("clearing_messages")
          .select("role, content, message_type")
          .eq("session_id", sessionId)
          .in("role", ["user", "brain"])
          .order("created_at", { ascending: true })
          .limit(40); // last 40 messages for context window management

        if (priorMessages && priorMessages.length > 0) {
          for (const msg of priorMessages) {
            // Skip ingestion system messages — they're noise
            if (msg.message_type === "ingestion") continue;
            conversationMessages.push({
              role: msg.role === "brain" ? "assistant" : "user",
              content: msg.content || "",
            });
          }
        }
      } catch (histErr) {
        console.warn("Failed to fetch session history (non-fatal):", histErr);
      }
    }

    // Add the current question with context as the final user message
    conversationMessages.push({
      role: "user",
      content: `Question: ${question}\n\nContext:\n${context}`,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: getBrainAskPrompt(),
      messages: conversationMessages,
    });

    const answer = (response.content[0] as { type: "text"; text: string }).text.trim();

    // Log the query activity (fire-and-forget)
    try {
      await sb.schema("brain").from("activity").insert({
        entity_type: "system",
        entity_id: null,
        action: "brain_query",
        actor: "ceo",
        metadata: {
          summary: `Brain query: "${question.slice(0, 80)}"`,
          question,
          sources: sourceNotes,
          context_length: context.length,
        },
      });
    } catch { /* ignore logging errors */ }

    // ── 8. Persist as feed card (if scope is "feed") ──
    let card_id: string | null = null;
    if (persist && scope === "feed") {
      try {
        const card = await emitFeedCard(sb, {
          card_type: "intelligence",
          title: question,
          body: answer,
          source_type: "brain_query",
          priority: "medium",
          metadata: {
            sources: sourceNotes,
            context_length: context.length,
            query_timestamp: new Date().toISOString(),
          },
        });
        card_id = card?.id ?? null;
      } catch (emitErr) {
        console.error("Failed to persist brain query as feed card:", emitErr);
      }
    }

    // ── 8b. Persist clearing conversation (if scope is "clearing") ──
    let clearing_message_id: string | null = null;
    if (persist && scope === "clearing") {
      const sessionId = body.session_id;
      if (sessionId) {
        try {
          // Insert question message
          await sb.schema("brain").from("clearing_messages").insert({
            session_id: sessionId,
            role: "user",
            content: question,
            message_type: "query",
          });
          // Insert brain response
          const { data: respMsg } = await sb
            .schema("brain")
            .from("clearing_messages")
            .insert({
              session_id: sessionId,
              role: "brain",
              content: answer,
              message_type: "response",
              metadata: { sources: sourceNotes },
            })
            .select("id")
            .single();
          clearing_message_id = respMsg?.id ?? null;
        } catch (clearingErr) {
          console.error("Failed to persist clearing messages:", clearingErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      answer,
      sources: sourceNotes,
      card_id,
      clearing_message_id,
    });
  } catch (err) {
    console.error("ask_brain error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}

/* ── Helpers ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Levenshtein distance for fuzzy matching.
 * Returns edit distance between two strings (case-insensitive).
 */
function levenshtein(a: string, b: string): number {
  const al = a.toLowerCase(), bl = b.toLowerCase();
  const m = al.length, n = bl.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = al[i - 1] === bl[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Check if candidate is a fuzzy match for any word/phrase in the question.
 * Allows up to ~20% edit distance for names 5+ chars.
 */
function fuzzyMatch(questionLower: string, candidate: string): boolean {
  if (!candidate || candidate.length < 3) return false;
  const candLower = candidate.toLowerCase();

  // Exact substring match (fast path)
  if (questionLower.includes(candLower)) return true;

  // Extract question words and bigrams for fuzzy comparison
  const qWords = questionLower.split(/\s+/);

  // For short names (< 5 chars), require exact word match only
  if (candLower.length < 5) {
    return qWords.some(w => w === candLower);
  }

  // Check each question word and consecutive pairs against candidate
  for (const w of qWords) {
    if (w.length >= 4) {
      const maxDist = Math.floor(Math.max(w.length, candLower.length) * 0.2);
      if (levenshtein(w, candLower) <= maxDist) return true;
    }
  }

  // Check consecutive word pairs (for multi-word names like "Nathan Eagle")
  const candParts = candLower.split(/\s+/);
  if (candParts.length > 1) {
    for (let i = 0; i < qWords.length - 1; i++) {
      const pair = qWords[i] + " " + qWords[i + 1];
      const maxDist = Math.floor(Math.max(pair.length, candLower.length) * 0.15);
      if (levenshtein(pair, candLower) <= maxDist) return true;
    }
  }

  // First name only match (for contacts) — e.g. "what did Nathan say"
  if (candParts.length > 1) {
    const firstName = candParts[0];
    if (firstName.length >= 4 && qWords.some(w => w === firstName)) return true;
    // Last name only match — e.g. "talk to Eagle"
    const lastName = candParts[candParts.length - 1];
    if (lastName.length >= 4 && qWords.some(w => w === lastName)) return true;
  }

  return false;
}

async function resolveEntities(
  sb: SB,
  question: string,
): Promise<Array<{ type: string; id: string; name: string }>> {
  const entities: Array<{ type: string; id: string; name: string }> = [];
  const questionLower = question.toLowerCase();
  const seenIds = new Set<string>();

  const [{ data: orgs }, { data: contacts }] = await Promise.all([
    sb.schema("core").from("organizations").select("id, name, website, domain").limit(500),
    sb.schema("core").from("contacts").select("id, first_name, last_name, email, title").limit(500),
  ]);

  // Organization matching: name + domain + fuzzy
  for (const org of orgs ?? []) {
    if (!org.name || org.name.length < 2) continue;

    let matched = false;

    // Exact name match
    if (questionLower.includes(org.name.toLowerCase())) {
      matched = true;
    }

    // Domain match — e.g. "nfl.com" or "the NFL"
    if (!matched && org.domain) {
      const domainBase = org.domain.replace(/^www\./, "").split(".")[0].toLowerCase();
      if (domainBase.length >= 3 && questionLower.includes(domainBase)) {
        matched = true;
      }
    }

    // Fuzzy match for org names > 4 chars
    if (!matched) {
      matched = fuzzyMatch(questionLower, org.name);
    }

    // Acronym match — e.g. "MiM" for "Made in Motion"
    if (!matched && org.name.includes(" ")) {
      const acronym = org.name
        .split(/\s+/)
        .filter((w: string) => w.length > 0 && w[0] === w[0].toUpperCase())
        .map((w: string) => w[0])
        .join("");
      if (acronym.length >= 2) {
        // Case-sensitive acronym match (acronyms are usually uppercase)
        const qWordsRaw = question.split(/\s+/);
        if (qWordsRaw.some(w => w === acronym || w === acronym.toUpperCase())) {
          matched = true;
        }
      }
    }

    if (matched && !seenIds.has(org.id)) {
      entities.push({ type: "organizations", id: org.id, name: org.name });
      seenIds.add(org.id);
    }
  }

  // Contact matching: full name + first/last name + email + fuzzy
  for (const c of contacts ?? []) {
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ");
    if (fullName.length < 2) continue;

    let matched = false;

    // Exact full name match
    if (questionLower.includes(fullName.toLowerCase())) {
      matched = true;
    }

    // Email address match
    if (!matched && c.email) {
      const emailLower = c.email.toLowerCase();
      if (questionLower.includes(emailLower)) {
        matched = true;
      }
      // Email prefix match — "mark.slater" in "mark.slater@..."
      const emailPrefix = emailLower.split("@")[0];
      if (emailPrefix.length >= 5 && questionLower.includes(emailPrefix)) {
        matched = true;
      }
    }

    // Fuzzy match
    if (!matched) {
      matched = fuzzyMatch(questionLower, fullName);
    }

    if (matched && !seenIds.has(c.id)) {
      entities.push({ type: "contacts", id: c.id, name: fullName });
      seenIds.add(c.id);
    }
  }

  return entities;
}

async function buildMiniDossier(
  sb: SB,
  entity: { type: string; id: string; name: string },
): Promise<string | null> {
  const parts: string[] = [];

  if (entity.type === "organizations") {
    const [
      { data: org },
      { data: types },
      { data: pipeline },
      { data: tasks },
      { data: recentCorr },
      { data: orgContacts },
    ] = await Promise.all([
      sb.schema("core").from("organizations").select("*").eq("id", entity.id).single(),
      sb.schema("core").from("org_types").select("type").eq("org_id", entity.id),
      sb.schema("crm").from("pipeline").select("status, stage, amount, next_action, notes").eq("organization_id", entity.id).limit(3),
      sb.schema("brain").from("tasks").select("title, status, priority").eq("entity_id", entity.id).neq("status", "done").limit(5),
      sb.schema("brain").from("correspondence")
        .select("subject, direction, channel, sent_at, from_address, summary")
        .eq("entity_id", entity.id)
        .order("sent_at", { ascending: false })
        .limit(5),
      sb.schema("core").from("contacts")
        .select("first_name, last_name, title, email")
        .eq("organization_id", entity.id)
        .limit(10),
    ]);

    if (!org) return null;

    parts.push(`## ${org.name}`);
    if (types?.length) parts.push(`Types: ${types.map((t: { type: string }) => t.type).join(", ")}`);
    if (org.description) parts.push(org.description.slice(0, 400));
    if (org.website) parts.push(`Website: ${org.website}`);

    // People at this org
    if (orgContacts?.length) {
      parts.push("\n**People:**");
      for (const c of orgContacts) {
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
        parts.push(`- ${name}${c.title ? ` (${c.title})` : ""}${c.email ? ` — ${c.email}` : ""}`);
      }
    }

    if (pipeline?.length) {
      parts.push("\n**Pipeline:**");
      for (const p of pipeline) {
        parts.push(`- ${p.status} / ${p.stage} — $${p.amount || "TBD"}`);
        if (p.next_action) parts.push(`  Next: ${p.next_action}`);
        if (p.notes) parts.push(`  Notes: ${p.notes.slice(0, 150)}`);
      }
    }

    if (tasks?.length) {
      parts.push("\n**Open Tasks:**");
      for (const t of tasks) {
        parts.push(`- [${t.priority}] ${t.title} (${t.status})`);
      }
    }

    if (recentCorr?.length) {
      parts.push("\n**Recent Correspondence:**");
      for (const c of recentCorr) {
        const dir = c.direction === "outbound" ? "SENT" : "RECEIVED";
        const date = c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "";
        parts.push(`- [${dir}] "${c.subject}" (${date})`);
        if (c.summary) parts.push(`  ${c.summary.slice(0, 150)}`);
      }
    }
  } else if (entity.type === "contacts") {
    const [
      { data: contact },
      { data: contactCorr },
      { data: contactCards },
    ] = await Promise.all([
      sb.schema("core").from("contacts").select("*").eq("id", entity.id).single(),
      sb.schema("brain").from("correspondence")
        .select("subject, direction, channel, sent_at, summary")
        .eq("entity_id", entity.id)
        .order("sent_at", { ascending: false })
        .limit(5),
      sb.schema("brain").from("feed_cards")
        .select("card_type, title, body, created_at")
        .eq("entity_id", entity.id)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    if (!contact) return null;

    parts.push(`## ${contact.first_name} ${contact.last_name}`);
    if (contact.email) parts.push(`Email: ${contact.email}`);
    if (contact.title) parts.push(`Title: ${contact.title}`);
    if (contact.phone) parts.push(`Phone: ${contact.phone}`);
    if (contact.notes) parts.push(contact.notes.slice(0, 300));

    // Organization relationship
    if (contact.organization_id) {
      const { data: org } = await sb.schema("core").from("organizations")
        .select("name")
        .eq("id", contact.organization_id)
        .single();
      if (org) parts.push(`Organization: ${org.name}`);
    }

    if (contactCorr?.length) {
      parts.push("\n**Recent Correspondence:**");
      for (const c of contactCorr) {
        const dir = c.direction === "outbound" ? "SENT" : "RECEIVED";
        const date = c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "";
        parts.push(`- [${dir}] "${c.subject}" (${date})`);
        if (c.summary) parts.push(`  ${c.summary.slice(0, 150)}`);
      }
    }

    if (contactCards?.length) {
      parts.push("\n**Recent Brain Activity:**");
      for (const fc of contactCards) {
        const date = new Date(fc.created_at).toLocaleDateString();
        parts.push(`- [${fc.card_type}] ${fc.title} (${date})`);
      }
    }
  }

  parts.push("");
  return parts.join("\n");
}
