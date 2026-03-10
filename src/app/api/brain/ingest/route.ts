import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { processDocument, processTextInput, validateFileSize, EXTENSION_TO_TYPE } from "@/lib/document-processor";
import { loadTaxonomy, matchTaxonomyCategory } from "@/lib/taxonomy-loader";

export const maxDuration = 120;

/**
 * Universal Brain Ingestion Endpoint
 *
 * POST /api/brain/ingest
 *
 * Accepts:
 *  - Multipart form data (file upload + optional metadata)
 *  - JSON body (text-based ingestion from chat, Slack, Notion)
 *
 * Processing pipeline:
 *  1. Store file (if present) → Supabase Storage
 *  2. Extract text from file or body
 *  3. Chunk content for future retrieval
 *  4. Classify via taxonomy + extract tags (Claude)
 *  5. Entity resolution — identify mentioned orgs/contacts
 *  6. Summarize
 *  7. Store in knowledge_base
 *  8. Log activity
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase env vars" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // ── Parse request ──
    const contentType = request.headers.get("content-type") || "";
    let title = "";
    let sourceType = "upload";
    let sourceRef = "";
    let text = "";
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let fileSizeBytes = 0;
    let fileType = "";
    let metadata: Record<string, unknown> = {};
    let uploadedBy = "web";
    let entityIds: string[] = [];
    let userTags: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      // ── File upload ──
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const textField = formData.get("text") as string | null;

      title = (formData.get("title") as string) || "";
      sourceType = (formData.get("source_type") as string) || "upload";
      sourceRef = (formData.get("source_ref") as string) || "";
      uploadedBy = (formData.get("uploaded_by") as string) || "web";
      const entityIdsStr = formData.get("entity_ids") as string | null;
      if (entityIdsStr) {
        try { entityIds = JSON.parse(entityIdsStr); } catch { /* ignore */ }
      }
      const tagsStr = formData.get("tags") as string | null;
      if (tagsStr) {
        try { userTags = JSON.parse(tagsStr); } catch { /* ignore */ }
      }
      const metaStr = formData.get("metadata") as string | null;
      if (metaStr) {
        try { metadata = JSON.parse(metaStr); } catch { /* ignore */ }
      }

      if (file) {
        fileSizeBytes = file.size;
        const sizeCheck = validateFileSize(fileSizeBytes);
        if (!sizeCheck.valid) {
          return NextResponse.json(
            { success: false, error: sizeCheck.error },
            { status: 400 },
          );
        }

        fileName = file.name;
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        fileType = EXTENSION_TO_TYPE[ext] || "txt";

        if (!title) title = fileName;

        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else if (textField) {
        text = textField;
        if (!title) title = text.slice(0, 80).trim() || "Text input";
      } else {
        return NextResponse.json(
          { success: false, error: "No file or text provided" },
          { status: 400 },
        );
      }
    } else {
      // ── JSON body ──
      const body = await request.json();
      title = body.title || "";
      text = body.text || body.content || "";
      sourceType = body.source_type || "api";
      sourceRef = body.source_ref || "";
      uploadedBy = body.uploaded_by || "api";
      metadata = body.metadata || {};
      entityIds = body.entity_ids || [];
      userTags = body.tags || [];

      if (!text) {
        return NextResponse.json(
          { success: false, error: "No text/content provided in body" },
          { status: 400 },
        );
      }

      if (!title) title = text.slice(0, 80).trim() || "API input";
    }

    // ── 1. Create initial knowledge_base row (status: processing) ──
    const { data: kbRow, error: insertError } = await sb
      .from("knowledge_base")
      .insert({
        title,
        source_type: sourceType,
        source_ref: sourceRef || null,
        file_type: fileType || null,
        file_size_bytes: fileSizeBytes || null,
        uploaded_by: uploadedBy,
        metadata,
        entity_ids: entityIds.length > 0 ? entityIds : null,
        tags: userTags.length > 0 ? userTags : null,
        processed: false,
      })
      .select("id")
      .single();

    if (insertError || !kbRow) {
      return NextResponse.json(
        { success: false, error: `Failed to create knowledge_base row: ${insertError?.message}` },
        { status: 500 },
      );
    }

    const kbId = kbRow.id;

    // Return immediately with the ID — processing continues in background
    // (For Vercel serverless, we process synchronously but return fast status)

    try {
      // ── 2. Upload file to Supabase Storage (if present) ──
      let fileUrl: string | null = null;
      if (fileBuffer && fileName) {
        const storagePath = `uploads/${kbId}/${fileName}`;
        const { error: uploadError } = await sb.storage
          .from("knowledge")
          .upload(storagePath, fileBuffer, {
            contentType: fileType === "pdf" ? "application/pdf" : undefined,
            upsert: true,
          });

        if (!uploadError) {
          fileUrl = storagePath;
        } else {
          console.warn(`Storage upload failed (non-fatal): ${uploadError.message}`);
        }
      }

      // ── 3. Extract text ──
      let contentText = text;
      let chunks: { chunk_index: number; text: string; token_count: number }[] = [];

      if (fileBuffer) {
        const processed = await processDocument(fileBuffer, fileName);
        contentText = processed.text;
        chunks = processed.chunks;
        fileType = processed.fileType;
      } else if (text) {
        const processed = processTextInput(text);
        contentText = processed.text;
        chunks = processed.chunks;
      }

      // ── 4. Classify via taxonomy + summarize (Claude) ──
      let summary = "";
      let taxonomyCategories: string[] = [];
      let extractedTags: string[] = [...userTags];

      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const taxonomy = await loadTaxonomy(sb);

      if (anthropicKey && contentText.length > 20) {
        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey });

          // Build taxonomy context for the classifier
          const taxonomyContext = taxonomy
            .map((t) => `- ${t.category} (${t.slug}): ${t.signal_keywords.join(", ")}`)
            .join("\n");

          const classifyPrompt = `Analyze this document and provide:
1. A concise 2-3 sentence summary
2. Which taxonomy categories it relates to (from the list below)
3. Relevant tags (lowercase, hyphenated)
4. Any organization or entity names mentioned

TAXONOMY CATEGORIES:
${taxonomyContext}

DOCUMENT TITLE: ${title}
DOCUMENT TEXT (first 3000 chars):
${contentText.slice(0, 3000)}

Respond with ONLY a JSON object:
{
  "summary": "2-3 sentence summary",
  "categories": ["slug1", "slug2"],
  "tags": ["tag1", "tag2"],
  "mentioned_entities": ["Entity Name 1", "Entity Name 2"]
}`;

          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 600,
            messages: [{ role: "user", content: classifyPrompt }],
          });

          let responseText = (response.content[0] as { type: "text"; text: string }).text.trim();
          if (responseText.startsWith("```")) {
            responseText = responseText.split("```")[1];
            if (responseText.startsWith("json")) responseText = responseText.slice(4);
            responseText = responseText.trim();
          }

          const parsed = JSON.parse(responseText);
          summary = parsed.summary || "";
          taxonomyCategories = parsed.categories || [];
          const aiTags = parsed.tags || [];
          extractedTags = [...new Set([...userTags, ...aiTags])];

          // ── 5. Entity resolution — match mentioned names to orgs/contacts ──
          const mentionedEntities = parsed.mentioned_entities || [];
          if (mentionedEntities.length > 0) {
            const { data: orgs } = await sb
              .schema('core').from("organizations")
              .select("id, name")
              .order("name");

            const { data: contacts } = await sb
              .schema('core').from("contacts")
              .select("id, first_name, last_name")
              .order("first_name");

            for (const mentioned of mentionedEntities) {
              const nameLower = (mentioned as string).toLowerCase();

              // Check orgs
              const orgMatch = (orgs || []).find((o) =>
                o.name.toLowerCase().includes(nameLower) ||
                nameLower.includes(o.name.toLowerCase())
              );
              if (orgMatch && !entityIds.includes(orgMatch.id)) {
                entityIds.push(orgMatch.id);
              }

              // Check contacts
              const contactMatch = (contacts || []).find((c) => {
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ");
                return fullName && (fullName.toLowerCase().includes(nameLower) ||
                  nameLower.includes(fullName.toLowerCase()));
              });
              if (contactMatch && !entityIds.includes(contactMatch.id)) {
                entityIds.push(contactMatch.id);
              }
            }
          }

          // Also do taxonomy category matching based on tags
          if (taxonomyCategories.length === 0 && extractedTags.length > 0) {
            const matched = matchTaxonomyCategory(extractedTags, taxonomy);
            if (matched) {
              taxonomyCategories = [matched.slug];
            }
          }
        } catch (e) {
          console.error("Classification failed (non-fatal):", e);
          summary = contentText.slice(0, 200) + "...";
        }
      } else {
        // No Claude key — basic summary
        summary = contentText.slice(0, 200) + (contentText.length > 200 ? "..." : "");
      }

      // ── 6. Update knowledge_base row with processed data ──
      await sb
        .from("knowledge_base")
        .update({
          file_url: fileUrl,
          file_type: fileType || null,
          content_text: contentText,
          content_chunks: chunks,
          summary,
          taxonomy_categories: taxonomyCategories.length > 0 ? taxonomyCategories : null,
          entity_ids: entityIds.length > 0 ? entityIds : null,
          tags: extractedTags.length > 0 ? extractedTags : null,
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", kbId);

      // ── 7. Log activity ──
      await sb.schema('brain').from("activity").insert({
        entity_type: "system",
        entity_id: null,
        action: "knowledge_ingested",
        actor: "brain-ingest",
        metadata: {
          summary: `Knowledge ingested: "${title}" (${sourceType}, ${fileType || "text"}, ${Math.round((contentText?.length || 0) / 4)} tokens)`,
          knowledge_base_id: kbId,
          source_type: sourceType,
          file_type: fileType,
          title,
          categories: taxonomyCategories,
          tags: extractedTags,
          entity_count: entityIds.length,
          chunk_count: chunks.length,
          text_length: contentText?.length || 0,
        },
      });

      return NextResponse.json({
        success: true,
        id: kbId,
        title,
        summary,
        categories: taxonomyCategories,
        tags: extractedTags,
        entities: entityIds,
        chunks: chunks.length,
        text_length: contentText?.length || 0,
      });
    } catch (processingError) {
      // Update the KB row with error status
      await sb
        .from("knowledge_base")
        .update({
          processed: false,
          error: String(processingError),
        })
        .eq("id", kbId);

      return NextResponse.json(
        {
          success: false,
          id: kbId,
          error: `Processing failed: ${String(processingError)}`,
        },
        { status: 500 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
