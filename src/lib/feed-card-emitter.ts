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

// ─── Emit Card ──────────────────────────────────────────────────────────────

/**
 * Create a feed card in brain.feed_cards.
 * Returns the created card or null on error.
 */
export async function emitFeedCard(
  sb: SupabaseClient,
  input: FeedCardInput,
  log?: (msg: string) => void,
): Promise<FeedCard | null> {
  const addLog = log || (() => {});

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
    })
    .select()
    .single();

  if (error) {
    addLog(`  ❌ Feed card emission failed: ${error.message}`);
    return null;
  }

  addLog(`  ✅ Feed card emitted: [${input.card_type}] ${input.title.slice(0, 60)}`);
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
