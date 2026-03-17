/**
 * Feed Card Emitter
 *
 * Creates cards in brain.feed_cards from classification results.
 * Used by the gmail scanner, slack scanner, and ingestion endpoint.
 *
 * This is the OUTPUT side of the single ingestion point.
 * Every classified piece of data may produce a card in Your Motion.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { chunkText, embedBatch, estimateTokens } from "./embeddings";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CardType =
  | "decision"
  | "action"
  | "signal"
  | "briefing"
  | "snapshot"
  | "intelligence"
  | "reflection";

export type VisibilityScope = "personal" | "team" | "regiment";

export type CardPriority = "critical" | "high" | "medium" | "low";

export type CardStatus = "unread" | "read" | "acted" | "dismissed" | "archived";

export interface FeedCardInput {
  card_type: CardType;
  title: string;
  body?: string | null;
  reasoning?: string | null;
  source_type: string;
  source_ref?: string | null;
  acumen_family?: string | null;
  acumen_category?: string | null;
  priority?: CardPriority | null;
  confidence?: number | null;
  visibility_scope?: VisibilityScope | null;
  entity_id?: string | null;
  entity_type?: string | null;
  entity_name?: string | null;
  related_entities?: Array<{ id: string; type: string; name: string }>;
  metadata?: Record<string, unknown>;
  expires_at?: string | null;
  classification_log_id?: string | null;
  agent_run_id?: string | null;
}

export interface FeedCard extends FeedCardInput {
  id: string;
  status: CardStatus;
  created_at: string;
  updated_at: string;
}

// ─── Card Type Inference ────────────────────────────────────────────────────

/**
 * Infer card type from classification data.
 * The harness/acumen classification drives what type of card appears in Motion.
 */
export function inferCardType(classification: {
  acumen_family?: string | null;
  acumen_category?: string | null;
  priority?: string | null;
  action_items?: Array<{ title: string }>;
  summary?: string | null;
}): CardType {
  const family = (classification.acumen_family || "").toLowerCase();
  const priority = (classification.priority || "").toLowerCase();

  // High/critical priority items that need CEO action → decision
  if (priority === "critical" || priority === "high") {
    return "decision";
  }

  // If there are action items → action
  if (classification.action_items && classification.action_items.length > 0) {
    return "action";
  }

  // Families that typically need decisions
  if (["partnership", "fundraising", "legal", "finance"].includes(family)) {
    return "decision";
  }

  // Everything else is a signal
  return "signal";
}

// ─── Thread Consolidation ───────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Find an existing feed card for a Gmail thread.
 * Returns the card if found, null otherwise.
 */
export async function findExistingThreadCard(
  sb: SupabaseClient,
  threadId: string,
  log?: (msg: string) => void,
): Promise<FeedCard | null> {
  const addLog = log || (() => {});

  // Check by thread_id column
  const { data } = await sb
    .schema("brain")
    .from("feed_cards")
    .select("*")
    .eq("thread_id", threadId)
    .eq("source_type", "email")
    .order("created_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    addLog(`  Found existing thread card: ${data[0].id}`);
    return data[0] as FeedCard;
  }

  return null;
}

/**
 * Update an existing thread card with new message data.
 * Upgrades priority if new message is higher, resurfaces as unread.
 */
export async function updateThreadCard(
  sb: SupabaseClient,
  existingCard: FeedCard,
  input: FeedCardInput,
  log?: (msg: string) => void,
): Promise<FeedCard | null> {
  const addLog = log || (() => {});

  const existing = existingCard as unknown as Record<string, unknown>;
  const existingRank = PRIORITY_RANK[existing.priority as string || "medium"] || 2;
  const newRank = PRIORITY_RANK[input.priority || "medium"] || 2;
  const currentCount = (existing.message_count as number) || 1;
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    body: input.body || existing.body,
    reasoning: input.reasoning || existing.reasoning,
    // Upgrade priority if new message is higher
    priority: newRank > existingRank ? input.priority : existing.priority,
    // Resurface as unread
    status: "unread",
    // Thread tracking
    message_count: currentCount + 1,
    thread_updated_at: now,
    metadata: {
      ...(existing.metadata as Record<string, unknown> || {}),
      ...(input.metadata || {}),
      message_count: currentCount + 1,
    },
    updated_at: now,
  };

  // If previously acted on, clear the action so it resurfaces fresh
  if (existing.status === "acted" || existing.status === "dismissed") {
    updates.ceo_action = null;
    updates.ceo_action_at = null;
  }

  const { data, error } = await sb
    .schema("brain")
    .from("feed_cards")
    .update(updates)
    .eq("id", existingCard.id)
    .select()
    .single();

  if (error) {
    addLog(`  Failed to update thread card: ${error.message}`);
    return null;
  }

  addLog(`  Updated thread card ${existingCard.id} (${currentCount + 1} messages)`);
  return data as FeedCard;
}

// ─── Emit Card ──────────────────────────────────────────────────────────────

/**
 * Create a feed card in brain.feed_cards.
 * If thread_id is in metadata and a card exists for that thread,
 * updates the existing card instead of creating a new one.
 * Returns the created/updated card or null on error.
 */
export async function emitFeedCard(
  sb: SupabaseClient,
  input: FeedCardInput,
  log?: (msg: string) => void,
): Promise<FeedCard | null> {
  const addLog = log || (() => {});

  // Thread consolidation: update existing card if same thread
  const threadId = (input.metadata as Record<string, unknown>)?.thread_id as string | undefined;
  if (threadId) {
    const existing = await findExistingThreadCard(sb, threadId, log);
    if (existing) {
      return updateThreadCard(sb, existing, input, log);
    }
  }

  const { data, error } = await sb
    .schema("brain")
    .from("feed_cards")
    .insert({
      card_type: input.card_type,
      title: input.title,
      body: input.body || null,
      reasoning: input.reasoning || null,
      source_type: input.source_type,
      source_ref: input.source_ref || null,
      acumen_family: input.acumen_family || null,
      acumen_category: input.acumen_category || null,
      priority: input.priority || "medium",
      confidence: input.confidence || null,
      visibility_scope: input.visibility_scope || "personal",
      entity_id: input.entity_id || null,
      entity_type: input.entity_type || null,
      entity_name: input.entity_name || null,
      related_entities: input.related_entities || [],
      metadata: input.metadata || {},
      expires_at: input.expires_at || null,
      classification_log_id: input.classification_log_id || null,
      agent_run_id: input.agent_run_id || null,
      thread_id: threadId || null,
      message_count: 1,
      thread_updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    addLog(`  Feed card emission failed: ${error.message}`);
    return null;
  }

  addLog(`  Feed card emitted: [${input.card_type}] ${input.title.slice(0, 60)}`);
  return data as FeedCard;
}

// ─── Log Ingestion ──────────────────────────────────────────────────────────

/**
 * Log an ingestion event to brain.ingestion_log.
 * This is the audit trail for everything that enters the single ingestion point.
 */
export async function logIngestion(
  sb: SupabaseClient,
  input: {
    source_type: string;
    source_ref?: string;
    raw_content?: string;
    normalized_content?: string;
    classification?: Record<string, unknown>;
    actions_taken?: Array<{ action: string; target: string; result: string }>;
    feed_card_id?: string;
    processing_ms?: number;
    error?: string;
  },
): Promise<string | null> {
  const { data, error } = await sb
    .schema("brain")
    .from("ingestion_log")
    .insert({
      source_type: input.source_type,
      source_ref: input.source_ref || null,
      raw_content: input.raw_content || null,
      normalized_content: input.normalized_content || null,
      classification: input.classification || null,
      actions_taken: input.actions_taken || [],
      feed_card_id: input.feed_card_id || null,
      processing_ms: input.processing_ms || null,
      error: input.error || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`Ingestion log failed: ${error.message}`);
    return null;
  }

  return data?.id || null;
}

// ─── Correspondence Embedding ────────────────────────────────────────────

/**
 * Chunk and embed correspondence content into brain.correspondence_chunks.
 * Call this after inserting a row into brain.correspondence.
 *
 * @param sb - Supabase client
 * @param correspondenceId - UUID of the correspondence row
 * @param content - Full text to embed (subject + body combined)
 * @param log - Optional logger
 * @returns Number of chunks inserted, or 0 on failure/skip
 */
export async function embedCorrespondence(
  sb: SupabaseClient,
  correspondenceId: string,
  content: string,
  log?: (msg: string) => void,
): Promise<number> {
  const addLog = log || (() => {});

  if (!content || content.trim().length < 20) {
    return 0; // Too short to be useful
  }

  try {
    // Check if already embedded
    const { data: existing } = await sb
      .schema("brain")
      .from("correspondence_chunks")
      .select("id")
      .eq("correspondence_id", correspondenceId)
      .limit(1);

    if (existing && existing.length > 0) {
      return 0; // Already embedded
    }

    const chunks = chunkText(content, 500);
    if (chunks.length === 0) return 0;

    const embeddings = await embedBatch(chunks);
    if (embeddings.length === 0) {
      addLog(`  Correspondence embedding skipped (no API key or error)`);
      return 0;
    }

    const rows = chunks.map((chunk, idx) => ({
      correspondence_id: correspondenceId,
      chunk_index: idx,
      content: chunk,
      token_count: estimateTokens(chunk),
      embedding: JSON.stringify(embeddings[idx]),
    }));

    const { error } = await sb
      .schema("brain")
      .from("correspondence_chunks")
      .insert(rows);

    if (error) {
      addLog(`  Correspondence chunk insert failed: ${error.message}`);
      return 0;
    }

    addLog(`  Embedded correspondence ${correspondenceId} (${chunks.length} chunks)`);
    return chunks.length;
  } catch (err) {
    addLog(`  Correspondence embedding error: ${err instanceof Error ? err.message : String(err)}`);
    return 0;
  }
}
