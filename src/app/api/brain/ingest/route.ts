import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { processDocument, processTextInput, validateFileSize, EXTENSION_TO_TYPE } from "@/lib/document-processor";
import { loadTaxonomy, matchTaxonomyCategory } from "@/lib/taxonomy-loader";
import { embedKnowledgeContentIntoChunks } from "@/lib/knowledge-chunks-writer";
import { getBrainIngestPrompt, getBrainIngestChunkPrompt, getBrainIngestSynthesisPrompt } from "@/lib/prompts";

export const maxDuration = 300; // Extended for full-body comprehension of large documents

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

      // ── Storage path: large file uploaded directly to Supabase Storage ──
      if (body.storage_path) {
        const { data: storageFile, error: storageError } = await sb.storage
          .from("knowledge")
          .download(body.storage_path);

        if (storageError || !storageFile) {
          return NextResponse.json(
            { success: false, error: `Storage download failed: ${storageError?.message}` },
            { status: 500 },
          );
        }

        const arrayBuffer = await storageFile.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        fileName = body.storage_path.split("/").pop() || "document";
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        fileType = (await import("@/lib/document-processor")).EXTENSION_TO_TYPE[ext] || "txt";
        if (!title) title = fileName;
        // Continue to processing below — fileBuffer is now set
      } else if (!text) {
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

        // Detect image-only / vector-graphics PDFs (Keynote/PowerPoint exports
        // and scanned documents where text is rendered as paths, not characters).
        // Fall back to Claude Vision for files under 5 MB — Claude reads the
        // visual content directly. Larger files get a clear error with guidance.
        if (fileType === "pdf" && contentText.trim().length < 30) {
          const anthropicKeyForVision = process.env.ANTHROPIC_API_KEY;
          const fileSizeMb = fileBuffer.length / 1024 / 1024;

          if (anthropicKeyForVision && fileSizeMb < 5) {
            // Use Claude Vision to extract text from image-based PDF
            try {
              const { default: AnthropicVision } = await import("@anthropic-ai/sdk");
              const anthropicVision = new AnthropicVision({ apiKey: anthropicKeyForVision });
              const visionResponse = await anthropicVision.messages.create({
                model: "claude-sonnet-4-6",
                max_tokens: 3000,
                messages: [{
                  role: "user",
                  content: [
                    {
                      type: "document",
                      source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: fileBuffer.toString("base64"),
                      },
                    } as { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } },
                    {
                      type: "text",
                      text: "Extract ALL text content from this presentation slide or document. Transcribe every visible piece of text exactly as it appears — headings, body text, bullet points, captions, labels, numbers. If it is a slide, describe its layout and purpose briefly, then list all text. Be exhaustive.",
                    },
                  ],
                }],
              });
              const visionText = (visionResponse.content[0] as { type: "text"; text: string }).text.trim();
              if (visionText.length > 50) {
                contentText = visionText;
                chunks = processTextInput(contentText).chunks;
              }
            } catch (visionErr) {
              console.error("Claude Vision PDF extraction failed:", visionErr);
            }
          }

          // If Vision also failed or file is too large, return a clear error
          if (contentText.trim().length < 30) {
            await sb.from("knowledge_base").delete().eq("id", kbId);
            return NextResponse.json({
              success: false,
              error: "no_text_layer",
              message: fileSizeMb >= 5
                ? `This PDF (${fileSizeMb.toFixed(0)} MB) is too large for visual extraction (5 MB limit). Export as a .pptx from Keynote (File → Export To → PowerPoint) and drag that in instead — the text will be fully extractable.`
                : "Could not extract content from this PDF. Try exporting as .pptx from Keynote or PowerPoint.",
            }, { status: 422 });
          }
        }
      } else if (text) {
        const processed = processTextInput(text);
        contentText = processed.text;
        chunks = processed.chunks;
      }

      // Fail loud: file provided but nothing usable extracted (non-PDF paths; PDF handled above)
      if (fileBuffer && fileName) {
        const trimmed = contentText.trim();
        const looksLikeExtractError = /extraction failed|PDF extraction failed|DOCX extraction failed|XLSX extraction failed/i.test(
          contentText,
        );
        if (trimmed.length < 20 || looksLikeExtractError) {
          await sb.from("knowledge_base").delete().eq("id", kbId);
          return NextResponse.json(
            {
              success: false,
              error: "no_extractable_content",
              message: looksLikeExtractError
                ? "The file could not be read as text. Try another format or export (e.g. .pptx or plain text)."
                : "No readable text was found in this file. It may be empty, corrupted, or an unsupported binary.",
            },
            { status: 422 },
          );
        }
      }

      // ── 4. FULL-BODY COMPREHENSION — classify the ENTIRE document ──
      // For documents ≤ 12K chars: send everything in one shot
      // For documents > 12K chars: multi-pass chunked analysis → synthesis
      let summary = "";
      let taxonomyCategories: string[] = [];
      let extractedTags: string[] = [...userTags];

      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const taxonomy = await loadTaxonomy(sb);
      const SINGLE_PASS_LIMIT = 12000; // ~3K tokens — safe for single Claude call
      const CHUNK_SIZE = 8000; // ~2K tokens per chunk for multi-pass

      if (anthropicKey && contentText.length > 20) {
        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey });

          // Build taxonomy context for the classifier
          const taxonomyContext = taxonomy
            .map((t) => `- ${t.category} (${t.slug}): ${t.signal_keywords.join(", ")}`)
            .join("\n");

          let parsed: { summary?: string; categories?: string[]; tags?: string[]; mentioned_entities?: string[] };

          if (contentText.length <= SINGLE_PASS_LIMIT) {
            // ── Single-pass: send the full document ──
            const classifyPrompt = getBrainIngestPrompt(
              taxonomyContext,
              title,
              contentText,
            );

            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 800,
              messages: [{ role: "user", content: classifyPrompt }],
            });

            let responseText = (response.content[0] as { type: "text"; text: string }).text.trim();
            if (responseText.startsWith("```")) {
              responseText = responseText.split("```")[1];
              if (responseText.startsWith("json")) responseText = responseText.slice(4);
              responseText = responseText.trim();
            }
            parsed = JSON.parse(responseText);
          } else {
            // ── Multi-pass: chunk → analyze each → synthesize ──
            console.log(`[ingest] Full-body comprehension: ${contentText.length} chars → multi-pass (${Math.ceil(contentText.length / CHUNK_SIZE)} chunks)`);

            // Split content into chunks
            const contentChunks: string[] = [];
            for (let i = 0; i < contentText.length; i += CHUNK_SIZE) {
              contentChunks.push(contentText.slice(i, i + CHUNK_SIZE));
            }

            // Analyze each chunk in parallel (max 5 concurrent)
            const chunkAnalyses: string[] = [];
            const CONCURRENCY = 5;
            for (let batch = 0; batch < contentChunks.length; batch += CONCURRENCY) {
              const batchChunks = contentChunks.slice(batch, batch + CONCURRENCY);
              const batchResults = await Promise.all(
                batchChunks.map(async (chunk, batchIdx) => {
                  const idx = batch + batchIdx;
                  const prompt = getBrainIngestChunkPrompt(title, idx, contentChunks.length, chunk);
                  try {
                    const resp = await anthropic.messages.create({
                      model: "claude-sonnet-4-6",
                      max_tokens: 600,
                      messages: [{ role: "user", content: prompt }],
                    });
                    return (resp.content[0] as { type: "text"; text: string }).text.trim();
                  } catch (chunkErr) {
                    console.warn(`[ingest] Chunk ${idx + 1} analysis failed:`, chunkErr);
                    return `{"key_points": ["Chunk ${idx + 1} analysis failed"], "entities": [], "action_items": [], "metrics": [], "tags": []}`;
                  }
                })
              );
              chunkAnalyses.push(...batchResults);
            }

            // Synthesize all chunk analyses into unified classification
            const synthesisInput = chunkAnalyses
              .map((analysis, idx) => `--- CHUNK ${idx + 1}/${contentChunks.length} ---\n${analysis}`)
              .join("\n\n");

            const synthesisPrompt = getBrainIngestSynthesisPrompt(
              taxonomyContext,
              title,
              synthesisInput,
            );

            const synthesisResponse = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 1000,
              messages: [{ role: "user", content: synthesisPrompt }],
            });

            let responseText = (synthesisResponse.content[0] as { type: "text"; text: string }).text.trim();
            if (responseText.startsWith("```")) {
              responseText = responseText.split("```")[1];
              if (responseText.startsWith("json")) responseText = responseText.slice(4);
              responseText = responseText.trim();
            }
            parsed = JSON.parse(responseText);
            console.log(`[ingest] Full-body synthesis complete: ${chunkAnalyses.length} chunks → unified classification`);
          }

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

      // ── 6b. Generate embeddings and store in knowledge_chunks ──
      const {
        vectorChunksExpected,
        embeddingChunkCount,
        embedOk: embedPipelineOk,
      } = await embedKnowledgeContentIntoChunks(sb, kbId, contentText, {
        title,
        source_type: sourceType,
        categories: taxonomyCategories,
      });

      const knowledgeEmbedOk = vectorChunksExpected === 0 || embedPipelineOk;
      console.log(
        `[memory-index] knowledge kb=${kbId} vector_expected=${vectorChunksExpected} embedded=${embeddingChunkCount} embed_ok=${knowledgeEmbedOk}`,
      );

      // ── 7. Emit feed card ──
      try {
        const cardType = taxonomyCategories.some(c =>
          c.includes("fundrais") || c.includes("partner") || c.includes("deal")
        ) ? "decision" : "intelligence";

        await sb.schema('brain').from("feed_cards").insert({
          card_type: cardType,
          title: title || summary.slice(0, 100),
          body: summary,
          source_type: sourceType,
          source_ref: sourceRef || kbId,
          acumen_category: taxonomyCategories[0] || null,
          priority: "medium",
          visibility_scope: "personal",
          entity_id: entityIds[0] || null,
          entity_type: entityIds.length > 0 ? "organizations" : null,
          metadata: {
            knowledge_base_id: kbId,
            file_type: fileType || null,
            file_name: fileName || null,
            tags: extractedTags,
            categories: taxonomyCategories,
            uploaded_by: uploadedBy,
          },
        });
      } catch {
        // Non-fatal — card emission shouldn't break ingestion
      }

      // ── 8. Log activity ──
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
          memory_index: "knowledge",
          vector_chunks_expected: vectorChunksExpected,
          vector_chunks_embedded: embeddingChunkCount,
          embed_ok: knowledgeEmbedOk,
        },
      });

      const warnings: string[] = [];
      if (vectorChunksExpected > 0 && !embedPipelineOk) {
        warnings.push("vector_embed_failed");
      }

      return NextResponse.json({
        success: true,
        id: kbId,
        title,
        summary,
        categories: taxonomyCategories,
        tags: extractedTags,
        entities: entityIds,
        chunks: chunks.length,
        embedding_chunks: embeddingChunkCount,
        text_length: contentText?.length || 0,
        vector_chunks_expected: vectorChunksExpected,
        embed_ok: knowledgeEmbedOk,
        warnings,
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
