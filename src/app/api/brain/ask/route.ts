import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { embedText } from "@/lib/embeddings";
import { emitFeedCard } from "@/lib/feed-card-emitter";

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
            match_threshold: 0.3,
            match_count: 8,
          }),
          sb.schema("brain").rpc("search_correspondence", {
            query_embedding: embeddingStr,
            match_threshold: 0.3,
            match_count: 8,
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
            contextParts.push(r.content?.slice(0, 400) || "");
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

    // ── 3. Knowledge keyword search ──
    const words = question.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
    if (words.length > 0) {
      const { data: kbResults } = await sb
        .from("knowledge_base")
        .select("title, summary, source_type, taxonomy_categories")
        .eq("processed", true)
        .or(words.map((w: string) => `title.ilike.%${w}%`).join(","))
        .limit(5);

      if (kbResults && kbResults.length > 0) {
        // Deduplicate: skip results already found via vector search
        const filtered = kbResults.filter((kb: any) => !vectorKbTitles.has(kb.title));
        if (filtered.length > 0) {
          contextParts.push("## Knowledge Base (Keyword)\n");
          for (const kb of filtered) {
            contextParts.push(`**${kb.title}** [${kb.source_type}]`);
            if (kb.summary) contextParts.push(kb.summary.slice(0, 300));
            contextParts.push("");
          }
          sourceNotes.push(`${filtered.length} keyword knowledge docs`);
        }
      }
    }

    // ── 4. Recent correspondence ──
    if (words.length > 0) {
      const { data: corr } = await sb
        .schema("brain")
        .from("correspondence")
        .select("subject, direction, channel, sent_at, from_address, summary")
        .or(words.map((w: string) => `subject.ilike.%${w}%`).join(","))
        .order("sent_at", { ascending: false })
        .limit(8);

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

    // ── 4b. Derived insights ──
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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1500,
      system: `You are MiM Brain, the intelligence system for Made in Motion (MiM), a sports merchandise company.
CEO Mark Slater is asking you a question. Use ONLY the provided context to answer.

Guidelines:
- Be concise and direct — executive briefing style
- Use bullet points and bold text for readability
- Cite sources when making claims
- If the context doesn't fully answer the question, say so clearly
- Never make up information not in the context`,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nContext:\n${context}`,
        },
      ],
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
