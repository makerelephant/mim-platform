// src/lib/db-scanner.ts
import 'server-only'; // build-time enforcement — never imported client-side
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Helpers ──

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ── Entity resolution ──

export async function resolveEntityFromEmail(
  sb: SupabaseClient,
  email: string,
  senderDomain: string
) {
  // 1. Direct contact match by email
  const { data: contact } = await sb
    .schema('core').from('contacts')
    .select('id, first_name, last_name, email')
    .eq('email', email)
    .maybeSingle();

  if (contact) {
    // Fetch linked orgs separately — no cross-schema embed
    const { data: rels } = await sb
      .schema('core').from('relationships')
      .select('org_id, relationship_type')
      .eq('contact_id', contact.id);

    const orgIds = (rels ?? []).map((r) => r.org_id);
    const { data: orgs } = orgIds.length > 0
      ? await sb.schema('core').from('organizations').select('id, name, website').in('id', orgIds)
      : { data: [] };

    return { contact, orgs: orgs ?? [] };
  }

  // 2. Domain fallback — anchored match to prevent false positives
  const { data: allOrgs } = await sb
    .schema('core').from('organizations')
    .select('id, name, website')
    .not('website', 'is', null);

  const matched = (allOrgs ?? []).filter((org) => {
    const orgDomain = extractDomain(org.website ?? '');
    return orgDomain && orgDomain === senderDomain; // exact domain match, not substring
  });

  return { contact: null, orgs: matched };
}

// ── Org with types — separate queries assembled server-side ──

export async function getOrgWithTypes(sb: SupabaseClient, orgId: string) {
  const [orgResult, typesResult, pipelineResult, partnerResult] = await Promise.all([
    sb.schema('core').from('organizations')
      .select('id, name, notes, website').eq('id', orgId).maybeSingle(),
    sb.schema('core').from('org_types')
      .select('type, status').eq('org_id', orgId),
    sb.schema('crm').from('pipeline')
      .select('status, pipeline_type, likelihood_score, next_action, last_contact_date')
      .eq('org_id', orgId),
    sb.schema('intel').from('partner_profile')
      .select('partner_status, partner_since').eq('org_id', orgId).maybeSingle(),
  ]);

  if (!orgResult.data) return null;

  return {
    ...orgResult.data,
    org_types: typesResult.data ?? [],
    pipeline: pipelineResult.data ?? [],
    partner: partnerResult.data ?? null,
  };
}

// ── Provenance reads ──

export async function getEntityProvenance(
  sb: SupabaseClient,
  entityType: string,
  entityId: string,
  limit = 50,
) {
  const { data, error } = await sb
    .schema('brain').from('entity_provenance')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getLatestFieldProvenance(
  sb: SupabaseClient,
  entityType: string,
  entityId: string,
  fieldName: string,
) {
  const { data, error } = await sb
    .schema('brain').from('entity_provenance')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('field_name', fieldName)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ── Writes ──

export async function upsertActivity(
  sb: SupabaseClient,
  payload: {
    entity_id: string;
    entity_type: string;
    action: string;
    actor: string;
    metadata?: Record<string, unknown>;
  }
) {
  return sb.schema('brain').from('activity').insert({
    ...payload,
    created_at: new Date().toISOString(),
  });
}

export async function upsertCeoContext(
  sb: SupabaseClient,
  payload: {
    source: string;
    source_id?: string;
    context_type: string;
    title?: string;
    content: string;
    priority?: string;
    entity_id?: string;
    entity_type?: string;
    metadata?: Record<string, unknown>;
  }
) {
  return sb.schema('brain').from('ceo_context').insert({
    status: 'unread',
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}
