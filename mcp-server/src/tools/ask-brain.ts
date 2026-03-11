/**
 * ask_brain — Cross-source intelligence synthesis tool
 *
 * The CEO asks a question → the brain gathers context from all sources:
 *   1. Vector search (knowledge_base + correspondence)
 *   2. Entity resolution → build dossiers for mentioned orgs/contacts
 *   3. Active instructions related to entities
 *   4. Recent activity feed
 *   5. Claude synthesizes everything into a comprehensive answer
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildEntityDossier } from "../lib/dossier.js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Try to embed text for vector search. Returns null if OpenAI key not configured.
 */
async function tryEmbed(text: string): Promise<number[] | null> {
  try {
    const { embedText } = await import("../lib/embeddings.js");
    return await embedText(text);
  } catch {
    // OpenAI key not set — skip vector search
    return null;
  }
}

/**
 * Resolve entity names mentioned in the question.
 * Does a fuzzy search across organizations and contacts.
 */
async function resolveEntities(question: string): Promise<Array<{ type: string; id: string; name: string }>> {
  const entities: Array<{ type: string; id: string; name: string }> = [];

  // Search organizations by name (ilike)
  const { data: orgs } = await supabase.schema("core").from("organizations")
    .select("id, name")
    .limit(200);

  // Search contacts
  const { data: contacts } = await supabase.schema("core").from("contacts")
    .select("id, first_name, last_name")
    .limit(200);

  const questionLower = question.toLowerCase();

  // Match org names that appear in the question
  for (const org of orgs ?? []) {
    if (org.name && org.name.length > 2 && questionLower.includes(org.name.toLowerCase())) {
      entities.push({ type: "organizations", id: org.id, name: org.name });
    }
  }

  // Match contact names that appear in the question
  for (const c of contacts ?? []) {
    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ");
    if (fullName.length > 2 && questionLower.includes(fullName.toLowerCase())) {
      entities.push({ type: "contacts", id: c.id, name: fullName });
    }
    // Also try last name only (if 4+ chars)
    if (c.last_name && c.last_name.length >= 4 && questionLower.includes(c.last_name.toLowerCase())) {
      if (!entities.find((e) => e.id === c.id)) {
        entities.push({ type: "contacts", id: c.id, name: fullName });
      }
    }
  }

  return entities;
}

export function registerAskBrainTool(server: McpServer) {

  server.tool(
    "ask_brain",
    `Ask the MiM Brain a question and get a comprehensive, cross-source intelligence answer.

The brain gathers context from ALL available sources:
- Knowledge base documents (uploaded docs, articles, meeting notes)
- Email and Slack correspondence history
- Entity dossiers (organization/contact details, pipeline, tasks)
- Active CEO instructions
- Recent activity feed

Use this for strategic questions like:
- "What do we know about Nike's youth sports programs?"
- "Summarize our relationship with 10X Venture Partners"
- "What's the status of our fundraising pipeline?"
- "What have we discussed with Adidas in the last 30 days?"
- "Give me a brief on our partnership strategy"`,
    {
      question: z.string().describe("The question to ask the brain"),
      context_days: z.number().optional().default(30).describe("How many days of activity/correspondence to consider (default 30)"),
      include_knowledge: z.boolean().optional().default(true).describe("Search knowledge base documents"),
      include_correspondence: z.boolean().optional().default(true).describe("Search email/Slack history"),
    },
    async ({ question, context_days, include_knowledge, include_correspondence }) => {
      try {
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        if (!anthropicKey) {
          // If no Anthropic key in MCP server env, try to provide raw context without synthesis
          return gatherContextOnly(question, context_days ?? 30, include_knowledge ?? true, include_correspondence ?? true);
        }

        const contextParts: string[] = [];
        const sourceNotes: string[] = [];

        // 1. Vector search (if embeddings available)
        const embedding = await tryEmbed(question);
        if (embedding) {
          const embeddingStr = `[${embedding.join(",")}]`;

          if (include_knowledge) {
            const { data: kbResults } = await supabase.schema("brain")
              .rpc("search_knowledge", {
                query_embedding: embeddingStr,
                match_count: 15,
                match_threshold: 0.4,
              });

            if (kbResults && kbResults.length > 0) {
              contextParts.push("## RELEVANT KNOWLEDGE BASE DOCUMENTS\n");
              for (const r of kbResults as Array<{ title: string; source_type: string; content: string; similarity: number }>) {
                const sim = (r.similarity * 100).toFixed(0);
                contextParts.push(`### ${r.title} [${r.source_type}] (${sim}% match)`);
                contextParts.push(r.content.slice(0, 500));
                contextParts.push("");
              }
              sourceNotes.push(`${kbResults.length} knowledge chunks`);
            }
          }

          if (include_correspondence) {
            const { data: corrResults } = await supabase.schema("brain")
              .rpc("search_correspondence", {
                query_embedding: embeddingStr,
                match_count: 10,
                match_threshold: 0.4,
              });

            if (corrResults && corrResults.length > 0) {
              contextParts.push("## RELEVANT CORRESPONDENCE\n");
              for (const r of corrResults as Array<{ subject: string; channel: string; direction: string; sent_at: string; content: string; similarity: number }>) {
                const sim = (r.similarity * 100).toFixed(0);
                const dir = r.direction === "outbound" ? "SENT" : "RECEIVED";
                const date = r.sent_at ? new Date(r.sent_at).toLocaleDateString() : "unknown";
                contextParts.push(`### [${r.channel}/${dir}] "${r.subject}" — ${date} (${sim}% match)`);
                contextParts.push(r.content.slice(0, 400));
                contextParts.push("");
              }
              sourceNotes.push(`${corrResults.length} correspondence matches`);
            }
          }
        } else {
          sourceNotes.push("vector search unavailable (no OPENAI_API_KEY)");
        }

        // 2. Entity resolution + dossiers
        const entities = await resolveEntities(question);
        if (entities.length > 0) {
          contextParts.push("## ENTITY DOSSIERS\n");
          for (const entity of entities.slice(0, 5)) { // max 5 dossiers
            const dossier = await buildEntityDossier(supabase, entity.type, entity.id);
            if (dossier) {
              contextParts.push(dossier.rendered);
              contextParts.push("");
            }
          }
          sourceNotes.push(`${entities.length} entity dossier(s)`);
        }

        // 3. Active instructions related to entities
        const { data: instructions } = await supabase.schema("brain").from("instructions")
          .select("type, prompt, source_entity_ids, taxonomy_categories")
          .eq("status", "active");

        if (instructions && instructions.length > 0) {
          const relevant = instructions.filter((i: { source_entity_ids: string[] | null }) => {
            if (!i.source_entity_ids) return false;
            return entities.some((e) => i.source_entity_ids!.includes(e.id));
          });

          if (relevant.length > 0) {
            contextParts.push("## ACTIVE CEO INSTRUCTIONS\n");
            for (const instr of relevant) {
              contextParts.push(`• [${(instr as { type: string }).type}] ${(instr as { prompt: string }).prompt}`);
            }
            contextParts.push("");
            sourceNotes.push(`${relevant.length} active instruction(s)`);
          }
        }

        // 4. Recent activity feed
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (context_days ?? 30));

        // If entities found, get entity-specific activity
        if (entities.length > 0) {
          const entityIds = entities.map((e) => e.id);
          const { data: activity } = await supabase.schema("brain").from("activity")
            .select("action, actor, metadata, created_at, entity_type")
            .in("entity_id", entityIds)
            .gte("created_at", cutoff.toISOString())
            .order("created_at", { ascending: false })
            .limit(20);

          if (activity && activity.length > 0) {
            contextParts.push("## RECENT ACTIVITY\n");
            for (const a of activity as Array<{ action: string; actor: string; metadata: { summary?: string }; created_at: string }>) {
              const date = new Date(a.created_at).toLocaleDateString();
              const summary = a.metadata?.summary || a.action;
              contextParts.push(`• [${date}] ${summary} (by ${a.actor})`);
            }
            contextParts.push("");
            sourceNotes.push(`${activity.length} activity entries`);
          }
        }

        // 5. If no vector results but keyword search might help, do fallback text search on knowledge
        if (!embedding && include_knowledge) {
          const words = question.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
          if (words.length > 0) {
            const searchTerm = words.join(" & ");
            const { data: kbFallback } = await supabase.from("knowledge_base")
              .select("id, title, summary, source_type")
              .eq("processed", true)
              .or(words.map((w) => `title.ilike.%${w}%`).join(","))
              .limit(5);

            if (kbFallback && kbFallback.length > 0) {
              contextParts.push("## KNOWLEDGE BASE (keyword search)\n");
              for (const kb of kbFallback as Array<{ title: string; source_type: string; summary: string | null }>) {
                contextParts.push(`### ${kb.title} [${kb.source_type}]`);
                if (kb.summary) contextParts.push(kb.summary.slice(0, 300));
                contextParts.push("");
              }
              sourceNotes.push(`${kbFallback.length} knowledge entries (keyword)`);
            }
          }
        }

        // 6. Synthesize with Claude
        const context = contextParts.join("\n");

        if (context.trim().length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: `I searched the brain for "${question}" but found no relevant information.\n\nSources checked: ${sourceNotes.join(", ") || "none available"}`,
            }],
          };
        }

        const anthropic = new Anthropic({ apiKey: anthropicKey });

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: `You are MiM Brain, the intelligence system for Made in Motion (MiM), a sports merchandise company run by CEO Mark Slater.

You will be given a question from the CEO along with gathered context from multiple internal sources (knowledge base, correspondence, entity dossiers, activity feeds, CEO instructions).

Provide a comprehensive, well-organized answer that:
- Directly addresses the CEO's question
- Synthesizes information across all available sources
- Highlights key insights, risks, and recommended actions
- Cites specific sources when making claims
- Is concise but thorough — executive briefing style
- Notes any gaps in available information

Format your response in clear markdown with headers and bullet points.`,
          messages: [{
            role: "user",
            content: `## CEO Question\n${question}\n\n## Gathered Context\n${context}`,
          }],
        });

        const answer = (response.content[0] as { type: "text"; text: string }).text.trim();

        return {
          content: [{
            type: "text" as const,
            text: `${answer}\n\n---\n_Sources: ${sourceNotes.join(", ")}_`,
          }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Brain error: ${msg}` }] };
      }
    }
  );
}

/**
 * Fallback: gather context only (no Claude synthesis) when ANTHROPIC_API_KEY isn't set.
 */
async function gatherContextOnly(
  question: string,
  contextDays: number,
  includeKnowledge: boolean,
  includeCorrespondence: boolean,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const parts: string[] = [];
  parts.push(`# Brain Context for: "${question}"\n`);

  // Entity resolution
  const entities = await resolveEntities(question);
  if (entities.length > 0) {
    parts.push("## Entities Found\n");
    for (const entity of entities.slice(0, 5)) {
      const dossier = await buildEntityDossier(supabase, entity.type, entity.id);
      if (dossier) {
        parts.push(dossier.rendered);
        parts.push("");
      }
    }
  }

  // Keyword search on knowledge
  if (includeKnowledge) {
    const words = question.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
    if (words.length > 0) {
      const { data: kbResults } = await supabase.from("knowledge_base")
        .select("id, title, summary, source_type")
        .eq("processed", true)
        .or(words.map((w) => `title.ilike.%${w}%`).join(","))
        .limit(5);

      if (kbResults && kbResults.length > 0) {
        parts.push("## Knowledge Base Matches\n");
        for (const kb of kbResults as Array<{ title: string; source_type: string; summary: string | null }>) {
          parts.push(`• **${kb.title}** [${kb.source_type}]`);
          if (kb.summary) parts.push(`  ${kb.summary.slice(0, 200)}`);
        }
        parts.push("");
      }
    }
  }

  // Recent correspondence keyword search
  if (includeCorrespondence) {
    const words = question.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
    if (words.length > 0) {
      const { data: corr } = await supabase.schema("brain").from("correspondence")
        .select("subject, direction, channel, sent_at, from_address")
        .or(words.map((w) => `subject.ilike.%${w}%`).join(","))
        .order("sent_at", { ascending: false })
        .limit(10);

      if (corr && corr.length > 0) {
        parts.push("## Correspondence Matches\n");
        for (const c of corr as Array<{ subject: string; direction: string; channel: string; sent_at: string; from_address: string }>) {
          const dir = c.direction === "outbound" ? "→" : "←";
          const date = c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "unknown";
          parts.push(`• ${dir} [${c.channel}] "${c.subject}" — ${c.from_address} (${date})`);
        }
        parts.push("");
      }
    }
  }

  parts.push("\n_Note: ANTHROPIC_API_KEY not configured in MCP server. Showing raw context without AI synthesis. Add the key to mcp-server/.env for full intelligence answers._");

  return { content: [{ type: "text" as const, text: parts.join("\n") }] };
}
