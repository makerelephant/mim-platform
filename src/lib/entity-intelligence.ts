// src/lib/entity-intelligence.ts
// Entity Intelligence Module — KCS calculator, provenance writer, batch recompute
// Used by scanners (service role) and API routes. NOT for client components.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Field Weight Maps ──────────────────────────────────────────────────────
// Weights as fractions that sum to ~1.0 per entity type.
// "relation:" prefix means the field is checked via a related table query,
// not a column on the entity row itself.

interface FieldWeight {
  weight: number;
  /** If set, check this related table instead of entity column */
  relation?: {
    schema: string;
    table: string;
    foreignKey: string;     // column in related table that references entity id
    entityKey?: string;     // column name on the related table for entity_type (if polymorphic)
    entityTypeValue?: string; // value to match for entityKey
  };
}

const ORG_FIELD_WEIGHTS: Record<string, FieldWeight> = {
  name:          { weight: 0.10 },
  website:       { weight: 0.10 },
  description:   { weight: 0.10 },
  types:         { weight: 0.10, relation: { schema: 'core', table: 'org_types', foreignKey: 'org_id' } },
  contacts:      { weight: 0.15, relation: { schema: 'core', table: 'relationships', foreignKey: 'org_id' } },
  correspondence:{ weight: 0.15, relation: { schema: 'brain', table: 'correspondence', foreignKey: 'entity_id', entityKey: 'entity_type', entityTypeValue: 'organizations' } },
  tasks:         { weight: 0.10, relation: { schema: 'brain', table: 'tasks', foreignKey: 'entity_id', entityKey: 'entity_type', entityTypeValue: 'organizations' } },
  pipeline:      { weight: 0.10, relation: { schema: 'crm', table: 'pipeline', foreignKey: 'org_id' } },
  notes:         { weight: 0.10 },
};

const CONTACT_FIELD_WEIGHTS: Record<string, FieldWeight> = {
  name:          { weight: 0.15 },   // checks first_name
  email:         { weight: 0.15 },
  phone:         { weight: 0.10 },
  title:         { weight: 0.10 },   // checks role column
  org_relationship: { weight: 0.15, relation: { schema: 'core', table: 'relationships', foreignKey: 'contact_id' } },
  correspondence:   { weight: 0.15, relation: { schema: 'brain', table: 'correspondence', foreignKey: 'entity_id', entityKey: 'entity_type', entityTypeValue: 'contacts' } },
  tasks:            { weight: 0.10, relation: { schema: 'brain', table: 'tasks', foreignKey: 'entity_id', entityKey: 'entity_type', entityTypeValue: 'contacts' } },
  notes:            { weight: 0.10 },
};

/** Map virtual field names to actual entity column names for direct-column checks */
const COLUMN_ALIASES: Record<string, string> = {
  name: 'first_name',   // contacts: check first_name; orgs: check name
  title: 'role',
};

function getFieldWeights(entityType: string): Record<string, FieldWeight> {
  return entityType === 'organizations' ? ORG_FIELD_WEIGHTS : CONTACT_FIELD_WEIGHTS;
}

function resolveColumnName(field: string, entityType: string): string {
  if (field === 'name' && entityType === 'organizations') return 'name';
  return COLUMN_ALIASES[field] ?? field;
}

// ─── KCS Calculation ────────────────────────────────────────────────────────

/**
 * Compute Knowledge Completeness Score for an entity.
 * KCS = Sum(field_weight * field_populated * field_confidence) / Sum(field_weight)
 *
 * Checks both direct columns and related tables (contacts, correspondence,
 * tasks, pipeline, org_types, relationships).
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

  // Check related tables in parallel for relation-based fields
  const relationFields = Object.entries(fieldWeights).filter(([, fw]) => fw.relation);
  const relationResults: Record<string, boolean> = {};

  if (relationFields.length > 0) {
    const checks = relationFields.map(async ([field, fw]) => {
      const rel = fw.relation!;
      try {
        let query = sb.schema(rel.schema).from(rel.table)
          .select('id', { count: 'exact', head: true })
          .eq(rel.foreignKey, entityId);

        if (rel.entityKey && rel.entityTypeValue) {
          query = query.eq(rel.entityKey, rel.entityTypeValue);
        }

        const { count } = await query;
        relationResults[field] = (count ?? 0) > 0;
      } catch {
        relationResults[field] = false;
      }
    });
    await Promise.all(checks);
  }

  let weightedSum = 0;
  let totalWeight = 0;
  const gaps: string[] = [];

  for (const [field, fw] of Object.entries(fieldWeights)) {
    totalWeight += fw.weight;

    let populated = false;

    if (fw.relation) {
      // Relation-based field — already checked above
      populated = relationResults[field] ?? false;
    } else {
      // Direct column check
      const col = resolveColumnName(field, entityType);
      const value = entity[col];
      populated = value !== null && value !== undefined && value !== '';
    }

    if (populated) {
      const confidence = confidenceMap[field] ?? 0.5; // default confidence if no provenance
      weightedSum += fw.weight * confidence;
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
 * Also sets enrichment_priority based on KCS level and updates confidence_score.
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

  // Compute aggregate confidence_score from provenance records
  const { data: provRecords } = await sb
    .schema('brain').from('entity_provenance')
    .select('confidence')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  let confidenceScore = 0;
  if (provRecords && provRecords.length > 0) {
    const sum = provRecords.reduce((acc: number, r: { confidence: number }) => acc + (r.confidence ?? 0), 0);
    confidenceScore = Math.round((sum / provRecords.length) * 1000) / 1000;
  }

  const { error } = await sb
    .schema('core').from(table)
    .update({
      knowledge_completeness_score: kcs,
      confidence_score: confidenceScore,
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

// ─── Aggregate KCS Stats ────────────────────────────────────────────────────

/**
 * Returns aggregate KCS statistics across all organizations and contacts.
 * Used by the /api/brain/kcs GET endpoint.
 */
export async function getKCSStats(sb: SupabaseClient): Promise<{
  organizations: { count: number; avg_kcs: number; distribution: Record<string, number> };
  contacts: { count: number; avg_kcs: number; distribution: Record<string, number> };
}> {
  const buildStats = async (entityType: 'organizations' | 'contacts') => {
    const table = entityType === 'organizations' ? 'organizations' : 'contacts';
    const { data, error } = await sb
      .schema('core').from(table)
      .select('knowledge_completeness_score, enrichment_priority');

    if (error || !data) {
      return { count: 0, avg_kcs: 0, distribution: { high: 0, medium: 0, low: 0, none: 0 } };
    }

    const count = data.length;
    const sum = data.reduce((acc: number, r) => acc + (r.knowledge_completeness_score ?? 0), 0);
    const avg_kcs = count > 0 ? Math.round((sum / count) * 1000) / 1000 : 0;

    const distribution: Record<string, number> = { high: 0, medium: 0, low: 0, none: 0 };
    for (const r of data) {
      const priority = r.enrichment_priority ?? 'none';
      distribution[priority] = (distribution[priority] ?? 0) + 1;
    }

    return { count, avg_kcs, distribution };
  };

  const [organizations, contacts] = await Promise.all([
    buildStats('organizations'),
    buildStats('contacts'),
  ]);

  return { organizations, contacts };
}
