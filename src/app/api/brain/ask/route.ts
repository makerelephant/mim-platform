import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { embedText } from "@/lib/embeddings";
import { emitFeedCard } from "@/lib/feed-card-emitter";
import { getBrainAskPrompt } from "@/lib/prompts";

export const maxDuration = 120;

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

              // If content was truncated, search document chunks for question-relevant content
              // This ensures the brain can find data on later sheets / deeper in large files
              if (doc.content_text && doc.content_text.length > 50000) {
                try {
                  // Extract key search terms from the question
                  const searchTerms = question.split(/\s+/).filter((w: string) => w.length > 2);
                  if (searchTerms.length > 0) {
                    const { data: matchingChunks } = await sb
                      .schema("brain")
                      .from("knowledge_chunks")
                      .select("content, chunk_index")
                      .eq("knowledge_base_id", doc.id)
                      .or(searchTerms.slice(0, 4).map((w: string) => `content.ilike.%${w}%`).join(","))
                      .order("chunk_index")
                      .limit(10);

                    if (matchingChunks && matchingChunks.length > 0) {
                      contextParts.push(`## Additional matching sections from ${doc.title} (chunks beyond truncation point):\n`);
                      for (const chunk of matchingChunks) {
                        contextParts.push(chunk.content);
                        contextParts.push("");
                      }
                      sourceNotes.push(`${matchingChunks.length} targeted chunks from ${doc.title}`);
                    }
                  }
                } catch (chunkErr) {
                  console.warn("Chunk search for session doc failed (non-fatal):", chunkErr);
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
                    contextParts.push(`... [Content truncated — searching chunks for remaining data]\n`);
                    // Search document chunks for question-relevant content
                    try {
                      const searchTerms = question.split(/\s+/).filter((w: string) => w.length > 2);
                      if (searchTerms.length > 0) {
                        const { data: matchingChunks } = await sb
                          .schema("brain")
                          .from("knowledge_chunks")
                          .select("content, chunk_index")
                          .eq("knowledge_base_id", doc.id)
                          .or(searchTerms.slice(0, 4).map((w: string) => `content.ilike.%${w}%`).join(","))
                          .order("chunk_index")
                          .limit(10);

                        if (matchingChunks && matchingChunks.length > 0) {
                          contextParts.push(`## Additional matching sections:\n`);
                          for (const chunk of matchingChunks) {
                            contextParts.push(chunk.content);
                            contextParts.push("");
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
                contextParts.push(`... [Showing first ${maxChars} chars of ${doc.content_text.length} total]`);
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

    // ── 2b. Vector search (RAG) ──
    const vectorKbTitles = new Set<string>();
    const vectorCorrSubjects = new Set<string>();
    try {
      const questionEmbedding = await embedText(question);
      if (questionEmbedding) {
        // Search knowledge chunks via RPC
        // Pass embedding as a JSON string — pgvector text input function parses [n1,n2,...] format
        const embeddingStr = `[${questionEmbedding.join(",")}]`;
        const [kbResult, corrResult] = await Promise.all([
          sb.schema("brain").rpc("search_knowledge", {
            query_embedding: embeddingStr,
            match_threshold: 0.18,
            match_count: 15,
          }),
          sb.schema("brain").rpc("search_correspondence", {
            query_embedding: embeddingStr,
            match_threshold: 0.18,
            match_count: 12,
          }),
        ]);

        if (kbResult.error) {
          console.error("search_knowledge RPC error:", kbResult.error.message, kbResult.error.details);
        }
        if (corrResult.error) {
          console.error("search_correspondence RPC error:", corrResult.error.message, corrResult.error.details);
        }

        const kbVectorResults = kbResult.data;
        const corrVectorResults = corrResult.data;

        if (kbVectorResults && kbVectorResults.length > 0) {
          contextParts.push("## Knowledge Base (Vector Search)\n");
          for (const r of kbVectorResults) {
            const title = r.metadata?.title || r.title || "Untitled";
            vectorKbTitles.add(title);
            const similarity = r.similarity ? ` (${(r.similarity * 100).toFixed(0)}% match)` : "";
            contextParts.push(`**${title}**${similarity}`);
            contextParts.push(r.content?.slice(0, 1000) || "");
            contextParts.push("");
          }
          sourceNotes.push(`${kbVectorResults.length} vector knowledge matches`);
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
            if (r.content) contextParts.push(`  ${r.content.slice(0, 200)}`);
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

async function resolveEntities(
  sb: SB,
  question: string,
): Promise<Array<{ type: string; id: string; name: string }>> {
  const entities: Array<{ type: string; id: string; name: string }> = [];
  const questionLower = question.toLowerCase();

  const [{ data: orgs }, { data: contacts }] = await Promise.all([
    sb.schema("core").from("organizations").select("id, name").limit(200),
    sb.schema("core").from("contacts").select("id, first_name, last_name").limit(200),
  ]);

  for (const org of orgs ?? []) {
    if (org.name && org.name.length > 2 && questionLower.includes(org.name.toLowerCase())) {
      entities.push({ type: "organizations", id: org.id, name: org.name });
    }
  }

  for (const c of contacts ?? []) {
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ");
    if (fullName.length > 2 && questionLower.includes(fullName.toLowerCase())) {
      entities.push({ type: "contacts", id: c.id, name: fullName });
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
    ] = await Promise.all([
      sb.schema("core").from("organizations").select("*").eq("id", entity.id).single(),
      sb.schema("core").from("org_types").select("type").eq("org_id", entity.id),
      sb.schema("crm").from("pipeline").select("status, stage, amount, next_action").eq("organization_id", entity.id).limit(3),
      sb.schema("brain").from("tasks").select("title, status, priority").eq("entity_id", entity.id).neq("status", "done").limit(5),
    ]);

    if (!org) return null;

    parts.push(`## ${org.name}`);
    if (types?.length) parts.push(`Types: ${types.map((t: { type: string }) => t.type).join(", ")}`);
    if (org.description) parts.push(org.description.slice(0, 200));
    if (org.website) parts.push(`Website: ${org.website}`);

    if (pipeline?.length) {
      parts.push("\n**Pipeline:**");
      for (const p of pipeline) {
        parts.push(`- ${p.status} / ${p.stage} — $${p.amount || "TBD"}`);
        if (p.next_action) parts.push(`  Next: ${p.next_action}`);
      }
    }

    if (tasks?.length) {
      parts.push("\n**Open Tasks:**");
      for (const t of tasks) {
        parts.push(`- [${t.priority}] ${t.title} (${t.status})`);
      }
    }
  } else if (entity.type === "contacts") {
    const { data: contact } = await sb.schema("core").from("contacts")
      .select("*")
      .eq("id", entity.id)
      .single();

    if (!contact) return null;

    parts.push(`## ${contact.first_name} ${contact.last_name}`);
    if (contact.email) parts.push(`Email: ${contact.email}`);
    if (contact.title) parts.push(`Title: ${contact.title}`);
    if (contact.notes) parts.push(contact.notes.slice(0, 200));
  }

  parts.push("");
  return parts.join("\n");
}
