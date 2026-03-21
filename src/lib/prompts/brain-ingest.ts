/**
 * Brain Ingest Classification Prompt
 *
 * Used by: /api/brain/ingest
 * Classifies and summarizes ingested documents using taxonomy categories.
 */

export const PROMPT_ID = "brain-ingest";
export const PROMPT_NAME = "Ingestion Classifier";
export const PROMPT_DESCRIPTION =
  "Document ingestion classifier — analyzes uploaded documents to extract summary, taxonomy categories, tags, and mentioned entities for knowledge base storage.";
export const PROMPT_AGENT = "/api/brain/ingest";

export function getBrainIngestPrompt(
  taxonomyContext: string,
  title: string,
  contentPreview: string,
): string {
  return `Analyze this document COMPLETELY and provide:
1. A thorough 3-5 sentence summary that captures ALL key points, not just the beginning
2. Which taxonomy categories it relates to (from the list below)
3. Relevant tags (lowercase, hyphenated) — be comprehensive
4. ALL organization, company, and entity names mentioned anywhere in the document
5. ALL person names mentioned anywhere in the document

TAXONOMY CATEGORIES:
${taxonomyContext}

DOCUMENT TITLE: ${title}
FULL DOCUMENT TEXT:
${contentPreview}

IMPORTANT: Read the ENTIRE document above. Your summary must reflect content from ALL sections, not just the beginning. If this is a financial model, capture key metrics. If this is meeting notes, capture all action items. If this is a contract, capture all parties and key terms.

Respond with ONLY a JSON object:
{
  "summary": "3-5 sentence comprehensive summary covering ALL key points",
  "categories": ["slug1", "slug2"],
  "tags": ["tag1", "tag2"],
  "mentioned_entities": ["Entity Name 1", "Entity Name 2"]
}`;
}

/**
 * Prompt for analyzing a single chunk of a large document.
 * Used in the multi-pass comprehension pipeline.
 */
export function getBrainIngestChunkPrompt(
  title: string,
  chunkIndex: number,
  totalChunks: number,
  chunkContent: string,
): string {
  return `You are analyzing chunk ${chunkIndex + 1} of ${totalChunks} from a document titled "${title}".

Extract ALL of the following from this section:
1. Key facts, data points, and insights
2. Any entity names (organizations, companies, people)
3. Action items, decisions, or commitments
4. Financial figures, dates, or metrics
5. Tags/topics this section covers

DOCUMENT SECTION (chunk ${chunkIndex + 1}/${totalChunks}):
${chunkContent}

Respond with ONLY a JSON object:
{
  "key_points": ["point 1", "point 2"],
  "entities": ["Entity 1", "Entity 2"],
  "action_items": ["action 1"],
  "metrics": ["metric 1"],
  "tags": ["tag1", "tag2"]
}`;
}

/**
 * Prompt for synthesizing multiple chunk analyses into a unified classification.
 * Used after all chunks have been individually analyzed.
 */
export function getBrainIngestSynthesisPrompt(
  taxonomyContext: string,
  title: string,
  chunkAnalyses: string,
): string {
  return `You are synthesizing the complete analysis of a document titled "${title}".

Below are the analyses of every section of this document. Your job is to create a UNIFIED, COMPREHENSIVE classification that captures EVERYTHING from ALL sections.

TAXONOMY CATEGORIES:
${taxonomyContext}

SECTION ANALYSES:
${chunkAnalyses}

Create a unified classification that:
1. Summarizes the ENTIRE document (not just one section) in 3-5 sentences
2. Lists ALL taxonomy categories that apply
3. Combines ALL tags from all sections (deduplicated)
4. Lists ALL entity names mentioned anywhere (deduplicated)

Respond with ONLY a JSON object:
{
  "summary": "3-5 sentence comprehensive summary of the ENTIRE document",
  "categories": ["slug1", "slug2"],
  "tags": ["tag1", "tag2"],
  "mentioned_entities": ["Entity Name 1", "Entity Name 2"]
}`;
}
