// src/lib/entity-intelligence.ts
// Entity Intelligence Module — KCS calculator, provenance writer, batch recompute
// Used by scanners (service role) and API routes. NOT for client components.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Field Weight Maps ──────────────────────────────────────────────────────
// Higher weight = more important for completeness. Scale: 1-10.

const ORG_FIELD_WEIGHTS: Record<string, number> = {
  name: 10,
  website: 8,
  location: 6,
  description: 5,
  geography: 4,
  avatar_url: 3,
  address: 3,
  notes: 2,
  corporate_structure: 2,
  parent_org_id: 2,
};

const CONTACT_FIELD_WEIGHTS: Record<string, number> = {
  first_name: 10,
  email: 9,
  last_name: 8,
  role: 6,
  phone: 4,
  avatar_url: 3,
  notes: 2,
};

function getFieldWeights(entityType: string): Record<string, number> {
  return entityType === 'organizations' ? ORG_FIELD_WEIGHTS : CONTACT_FIELD_WEIGHTS;
}

// ─── KCS Calculation ────────────────────────────────────────────────────────

/**
 * Compute Knowledge Completeness Score for an entity.
 * KCS = Sum(field_weight * field_populated * field_confidence) / Sum(field_weight)
 *
 * Returns { kcs: 0.0-1.0, gaps: string[] of unpopulated field names }
 */
export async function computeKCS(
  sb: SupabaseClient,
  entityType: 'organizations' | 'contacts',
  entityId: string,
): Promise<{ kcs: number; gaps: string[] }> {
  const fieldWeights = getFieldWeights(entityType);
  const table = entityType === 'organizations' ? 'organizations' : 'contacts';

  // Fetch entity row
  const { data: entity, error: entityError } = await sb
    .schema('core').from(table)
    .select('*')
    .eq('id', entityId)
    .maybeSingle();

  if (entityError || !entity) {
    return { kcs: 0, gaps: Object.keys(fieldWeights) };
  }

  // Fetch latest provenance per field for confidence values
  const { data: provenance } = await sb
    .schema('brain').from('entity_provenance')
    .select('field_name, confidence')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('captured_at', { ascending: false });

  // Build confidence map — latest provenance record per field wins
  const confidenceMap: Record<string, number> = {};
  for (const p of (provenance ?? [])) {
    if (!(p.field_name in confidenceMap)) {
      confidenceMap[p.field_name] = p.confidence;
    }
  }

  let weightedSum = 0;
  let totalWeight = 0;
  const gaps: string[] = [];

  for (const [field, weight] of Object.entries(fieldWeights)) {
    totalWeight += weight;

    const value = entity[field];
    const populated = value !== null && value !== undefined && value !== '';

    if (populated) {
      const confidence = confidenceMap[field] ?? 0.5; // default confidence if no provenance
      weightedSum += weight * confidence;
    } else {
      gaps.push(field);
    }
  }

  const kcs = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return { kcs: Math.round(kcs * 1000) / 1000, gaps }; // round to 3 decimals
}

// ─── Provenance Writing ─────────────────────────────────────────────────────

/**
 * Write provenance records for changed fields on an entity.
 * Only writes records where the value has actually changed from the last provenance entry.
 */
export async function writeProvenance(
  sb: SupabaseClient,
  entityType: string,
  entityId: string,
  fields: Record<string, string | null>,
  sourceType: string,
  sourceRef: string | null,
  sourceTrust: string = 'medium',
  confidence: number = 0.5,
): Promise<number> {
  // Fetch existing latest provenance for this entity
  const { data: existing } = await sb
    .schema('brain').from('entity_provenance')
    .select('id, field_name, field_value')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('captured_at', { ascending: false });

  // Build map of latest provenance per field
  const latestByField: Record<string, { id: string; field_value: string | null }> = {};
  for (const p of (existing ?? [])) {
    if (!(p.field_name in latestByField)) {
      latestByField[p.field_name] = { id: p.id, field_value: p.field_value };
    }
  }

  // Insert provenance for changed fields
  const rows: Array<{
    entity_type: string;
    entity_id: string;
    field_name: string;
    field_value: string | null;
    source_type: string;
    source_ref: string | null;
    source_trust: string;
    confidence: number;
    supersedes: string | null;
  }> = [];

  for (const [field, value] of Object.entries(fields)) {
    const stringValue = value !== null && value !== undefined ? String(value) : null;
    const prev = latestByField[field];

    // Skip if value unchanged
    if (prev && prev.field_value === stringValue) continue;

    rows.push({
      entity_type: entityType,
      entity_id: entityId,
      field_name: field,
      field_value: stringValue,
      source_type: sourceType,
      source_ref: sourceRef,
      source_trust: sourceTrust,
      confidence,
      supersedes: prev?.id ?? null,
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await sb
    .schema('brain').from('entity_provenance')
    .insert(rows);

  if (error) {
    console.error('[entity-intelligence] provenance write failed:', error.message);
    return 0;
  }

  return rows.length;
}

// ─── KCS Recompute + Store ──────────────────────────────────────────────────

/**
 * Compute KCS for an entity and update its row with the result.
 * Also sets enrichment_priority based on KCS level.
 */
export async function recomputeAndStoreKCS(
  sb: SupabaseClient,
  entityType: 'organizations' | 'contacts',
  entityId: string,
): Promise<number> {
  const { kcs, gaps } = await computeKCS(sb, entityType, entityId);
  const table = entityType === 'organizations' ? 'organizations' : 'contacts';

  // Determine enrichment priority from KCS
  let enrichmentPriority = 'none';
  if (kcs < 0.2) enrichmentPriority = 'high';
  else if (kcs < 0.4) enrichmentPriority = 'medium';
  else if (kcs < 0.6) enrichmentPriority = 'low';

  const { error } = await sb
    .schema('core').from(table)
    .update({
      knowledge_completeness_score: kcs,
      enrichment_gaps: gaps,
      enrichment_priority: enrichmentPriority,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entityId);

  if (error) {
    console.error(`[entity-intelligence] KCS store failed for ${entityType}/${entityId}:`, error.message);
  }

  return kcs;
}

// ─── Batch KCS Recompute ────────────────────────────────────────────────────

/**
 * Recompute KCS for a list of entities. Deduplicates by entity_id.
 * Designed to be called at the end of scanner runs, mirroring computeFeedbackForEntities().
 */
export async function recomputeKCSForEntities(
  sb: SupabaseClient,
  entities: Array<{ entity_type: string; entity_id: string }>,
): Promise<number> {
  // Deduplicate
  const seen = new Set<string>();
  const unique: Array<{ entity_type: string; entity_id: string }> = [];
  for (const e of entities) {
    const key = `${e.entity_type}:${e.entity_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }

  let count = 0;
  for (const e of unique) {
    if (e.entity_type !== 'organizations' && e.entity_type !== 'contacts') continue;
    try {
      await recomputeAndStoreKCS(sb, e.entity_type as 'organizations' | 'contacts', e.entity_id);
      count++;
    } catch (err) {
      console.error(`[entity-intelligence] KCS recompute failed for ${e.entity_type}/${e.entity_id}:`,
        err instanceof Error ? err.message : String(err));
    }
  }

  return count;
}
