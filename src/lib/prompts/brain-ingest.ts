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
  return `Analyze this document and provide:
1. A concise 2-3 sentence summary
2. Which taxonomy categories it relates to (from the list below)
3. Relevant tags (lowercase, hyphenated)
4. Any organization or entity names mentioned

TAXONOMY CATEGORIES:
${taxonomyContext}

DOCUMENT TITLE: ${title}
DOCUMENT TEXT (first 3000 chars):
${contentPreview}

Respond with ONLY a JSON object:
{
  "summary": "2-3 sentence summary",
  "categories": ["slug1", "slug2"],
  "tags": ["tag1", "tag2"],
  "mentioned_entities": ["Entity Name 1", "Entity Name 2"]
}`;
}
