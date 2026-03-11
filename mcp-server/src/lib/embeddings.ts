/**
 * Embeddings Module
 *
 * Uses OpenAI's text-embedding-3-small model to generate 1536-dimensional
 * vector embeddings for RAG search over knowledge_base and correspondence.
 */
import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not set — required for vector embeddings");
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TOKENS_PER_CHUNK = 8000; // text-embedding-3-small max is 8191

/**
 * Generate an embedding vector for a single text string.
 */
export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const truncated = text.slice(0, MAX_TOKENS_PER_CHUNK * 4); // rough char limit

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embedding vectors for multiple text strings in a single batch call.
 * OpenAI supports batching up to 2048 inputs.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getClient();
  const truncated = texts.map((t) => t.slice(0, MAX_TOKENS_PER_CHUNK * 4));

  // Batch in groups of 100 to avoid hitting limits
  const results: number[][] = [];
  for (let i = 0; i < truncated.length; i += 100) {
    const batch = truncated.slice(i, i + 100);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    // Results are returned in the same order as inputs
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }

  return results;
}

/**
 * Rough token count estimate (~4 chars per token for English text).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks of approximately `maxTokens` tokens.
 * Splits on paragraph boundaries (double newlines) when possible,
 * falls back to sentence boundaries, then hard splits.
 */
export function chunkText(text: string, maxTokens = 500): string[] {
  if (!text || text.trim().length === 0) return [];

  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return [text.trim()];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= maxChars) {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // If a single paragraph is too long, split by sentences
      if (trimmed.length > maxChars) {
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        currentChunk = "";
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= maxChars) {
            currentChunk += (currentChunk ? " " : "") + sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            // Hard split if single sentence is too long
            if (sentence.length > maxChars) {
              for (let i = 0; i < sentence.length; i += maxChars) {
                chunks.push(sentence.slice(i, i + maxChars).trim());
              }
              currentChunk = "";
            } else {
              currentChunk = sentence;
            }
          }
        }
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
