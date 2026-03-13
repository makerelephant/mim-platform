// src/lib/db.ts
// No import 'client-only' — this file is used by both client components and server components.
// Do NOT import this file in API routes or scanner libs — use db-scanner.ts instead.
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────
// OPTION B — Separate queries, assembled client-side
// Cross-schema PostgREST embedding is NOT supported on this instance.
// Same-schema embeds (e.g. core.organizations → core.org_types) DO work.
// ─────────────────────────────────────────────────────────────────

// ── Core reads ──

export async function getOrg(id: string) {
  const [orgResult, typesResult, classResult] = await Promise.all([
    supabase.schema('core').from('organizations').select('*').eq('id', id).single(),
    supabase.schema('core').from('org_types').select('type, status, since').eq('org_id', id),
    supabase.schema('core').from('org_classifications').select('taxonomy_id').eq('org_id', id),
  ]);

  if (orgResult.error) throw orgResult.error;

  const taxonomyIds = (classResult.data ?? []).map((c) => c.taxonomy_id);
  const { data: taxonomy } = taxonomyIds.length > 0
    ? await supabase.schema('core').from('taxonomy').select('id, name, slug, parent_id, depth').in('id', taxonomyIds)
    : { data: [] };

  return {
    ...orgResult.data,
    org_types: typesResult.data ?? [],
    classifications: (classResult.data ?? []).map((c) => ({
      taxonomy: taxonomy?.find((t) => t.id === c.taxonomy_id) ?? null,
    })),
  };
}

export async function getOrgs(filters?: {
  type?: string;
  taxonomySlug?: string;
  search?: string;
}) {
  let orgQuery = supabase
    .schema('core')
    .from('organizations')
    .select('id, name, website, avatar_url, notes, location, geography, created_at, updated_at, knowledge_completeness_score, confidence_score, verified');

  if (filters?.search) orgQuery = orgQuery.ilike('name', `%${filters.search}%`);

  const { data: orgs, error } = await orgQuery.order('name');
  if (error) throw error;
  if (!orgs?.length) return [];

  const orgIds = orgs.map((o) => o.id);

  const [typesResult, classResult] = await Promise.all([
    supabase.schema('core').from('org_types').select('org_id, type, status').in('org_id', orgIds),
    supabase.schema('core').from('org_classifications').select('org_id, taxonomy_id').in('org_id', orgIds),
  ]);

  const taxonomyIds = [...new Set((classResult.data ?? []).map((c) => c.taxonomy_id))];
  const { data: taxonomy } = taxonomyIds.length > 0
    ? await supabase.schema('core').from('taxonomy').select('id, name, slug').in('id', taxonomyIds)
    : { data: [] };

  let result = orgs.map((org) => ({
    ...org,
    org_types: (typesResult.data ?? []).filter((t) => t.org_id === org.id),
    classifications: (classResult.data ?? [])
      .filter((c) => c.org_id === org.id)
      .map((c) => ({ taxonomy: taxonomy?.find((t) => t.id === c.taxonomy_id) ?? null })),
  }));

  if (filters?.type) {
    result = result.filter((o) => o.org_types.some((t) => t.type === filters.type));
  }
  if (filters?.taxonomySlug) {
    result = result.filter((o) =>
      o.classifications.some((c) => c.taxonomy?.slug === filters.taxonomySlug)
    );
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// SHARED — These work regardless of cross-schema embedding
// because they query within a single schema or use separate fetches
// ─────────────────────────────────────────────────────────────────

// ── CRM reads ──

export async function getPipeline(orgId: string) {
  const { data, error } = await supabase
    .schema('crm').from('pipeline')
    .select('*').eq('org_id', orgId);
  if (error) throw error;
  return data ?? [];
}

export async function getAllPipeline(pipelineType?: string) {
  // Returns pipeline rows. Org name fetched separately (no cross-schema embed)
  let query = supabase.schema('crm').from('pipeline')
    .select('*')
    .order('last_contact_date', { ascending: false });
  if (pipelineType) query = query.eq('pipeline_type', pipelineType);
  const { data: pipeline, error } = await query;
  if (error) throw error;
  if (!pipeline?.length) return [];

  // Fetch org names separately — no cross-schema embed
  const orgIds = [...new Set(pipeline.map((p) => p.org_id))];
  const { data: orgs } = await supabase
    .schema('core').from('organizations')
    .select('id, name, avatar_url, website')
    .in('id', orgIds);

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o]));
  return pipeline.map((p) => ({ ...p, org: orgMap.get(p.org_id) ?? null }));
}

export async function getOpportunities(orgId?: string) {
  let query = supabase.schema('crm').from('opportunities')
    .select('*').order('created_at', { ascending: false });
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── Intel reads ──

export async function getInvestorProfile(orgId: string) {
  const { data, error } = await supabase
    .schema('intel').from('investor_profile')
    .select('*').eq('org_id', orgId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function getPartnerProfile(orgId: string) {
  const { data, error } = await supabase
    .schema('intel').from('partner_profile')
    .select('*').eq('org_id', orgId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function getOrgFinancials(orgId: string) {
  const { data, error } = await supabase
    .schema('intel').from('org_financials')
    .select('*').eq('org_id', orgId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

// ── Brain reads ──

export async function getCeoContext(filters?: {
  status?: string;
  contextType?: string;
  limit?: number;
}) {
  let query = supabase.schema('brain').from('ceo_context')
    .select('*').order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.contextType) query = query.eq('context_type', filters.contextType);
  if (filters?.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getBrainTasks(filters?: {
  status?: string;
  entityId?: string;
  ownerId?: string;
}) {
  // Polymorphic entity_id — query directly, no embedding
  let query = supabase.schema('brain').from('tasks')
    .select('*').order('due_date', { ascending: true });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
  if (filters?.ownerId) query = query.eq('owner_user_id', filters.ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getCorrespondence(entityId: string) {
  // Polymorphic entity_id — query directly, no embedding
  const { data, error } = await supabase
    .schema('brain').from('correspondence')
    .select('*')
    .eq('entity_id', entityId)
    .order('sent_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function getActivity(filters?: {
  entityId?: string;
  entityType?: string;
  limit?: number;
}) {
  // Polymorphic entity_id — query directly, no embedding
  let query = supabase.schema('brain').from('activity')
    .select('*').order('created_at', { ascending: false });
  if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
  if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters?.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── Core reads (contacts) ──

export async function getContacts(orgId?: string) {
  if (orgId) {
    // Same-schema embed — relationships → contacts, bare name (not core.contacts)
    const { data, error } = await supabase
      .schema('core').from('relationships')
      .select('relationship_type, since, contact:contacts(id, first_name, last_name, email, phone, role, avatar_url)')
      .eq('org_id', orgId);
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...(r.contact as object), relationship_type: r.relationship_type }));
  }
  const { data, error } = await supabase
    .schema('core').from('contacts').select('*').order('last_name');
  if (error) throw error;
  return data ?? [];
}

// Contacts filtered by linked org type
export async function getContactsByOrgType(orgType: string) {
  // Fetch org_ids of the given type, then find contacts linked to those orgs
  const { data: types, error: typeError } = await supabase
    .schema('core').from('org_types')
    .select('org_id').eq('type', orgType);
  if (typeError) throw typeError;
  if (!types?.length) return [];

  const orgIds = types.map((t) => t.org_id);
  const { data: rels, error: relError } = await supabase
    .schema('core').from('relationships')
    .select('contact_id, org_id, relationship_type')
    .in('org_id', orgIds);
  if (relError) throw relError;
  if (!rels?.length) return [];

  const contactIds = [...new Set(rels.map((r) => r.contact_id))];
  const { data: contacts, error: contactError } = await supabase
    .schema('core').from('contacts')
    .select('*').in('id', contactIds).order('last_name');
  if (contactError) throw contactError;
  return contacts ?? [];
}

export async function getTaxonomyTree() {
  const { data, error } = await supabase
    .schema('core').from('taxonomy')
    .select('*').order('depth').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

// ── Entity Intelligence reads ──

export async function getAggregateKCS() {
  const [orgResult, contactResult] = await Promise.all([
    supabase.schema('core').from('organizations')
      .select('knowledge_completeness_score'),
    supabase.schema('core').from('contacts')
      .select('knowledge_completeness_score'),
  ]);

  const orgScores = (orgResult.data ?? []).map((o) => o.knowledge_completeness_score as number);
  const contactScores = (contactResult.data ?? []).map((c) => c.knowledge_completeness_score as number);
  const allScores = [...orgScores, ...contactScores];

  if (allScores.length === 0) return { avgKcs: 0, entityCount: 0, orgCount: 0, contactCount: 0 };

  const sum = allScores.reduce((a, b) => a + b, 0);
  const avgKcs = Math.round((sum / allScores.length) * 1000) / 1000;

  return {
    avgKcs,
    entityCount: allScores.length,
    orgCount: orgScores.length,
    contactCount: contactScores.length,
  };
}

// ── Platform reads ──

export async function getStore(orgId: string) {
  const { data, error } = await supabase
    .schema('platform').from('store')
    .select('*').eq('org_id', orgId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function getOutreach(orgId?: string) {
  let query = supabase.schema('crm').from('outreach')
    .select('*').order('outreach_date', { ascending: false });
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── Mutations ──

export async function createOrg(payload: {
  name: string;
  website?: string;
  notes?: string;
  location?: string;
  geography?: string;
  source?: string;
  orgTypes?: string[]; // e.g. ['investor', 'partner']
}) {
  const { orgTypes, ...orgData } = payload;

  const { data: org, error: orgError } = await supabase
    .schema('core').from('organizations')
    .insert({ ...orgData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single();
  if (orgError) throw orgError;

  if (orgTypes?.length) {
    const typeRows = orgTypes.map((type) => ({ org_id: org.id, type, status: 'active' }));
    const { error: typeError } = await supabase
      .schema('core').from('org_types').insert(typeRows);
    if (typeError) throw typeError;
  }

  return org;
}

export async function updateOrg(id: string, payload: Partial<{
  name: string;
  website: string;
  notes: string;
  description: string;
  location: string;
  geography: string;
  avatar_url: string;
}>) {
  const { data, error } = await supabase
    .schema('core').from('organizations')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteOrg(id: string) {
  const { error } = await supabase
    .schema('core').from('organizations').delete().eq('id', id);
  if (error) throw error;
}

export async function upsertPipeline(orgId: string, pipelineType: string, payload: Partial<{
  status: string;
  likelihood_score: number;
  connection_status: string;
  lifecycle_status: string;
  next_action: string;
  next_action_date: string;
  last_contact_date: string;
  owner_user_id: string;
}>) {
  const { data, error } = await supabase
    .schema('crm').from('pipeline')
    .upsert(
      { org_id: orgId, pipeline_type: pipelineType, ...payload, updated_at: new Date().toISOString() },
      { onConflict: 'org_id,pipeline_type' }
    ).select().single();
  if (error) throw error;
  return data;
}

export async function markCeoContextRead(id: string) {
  const { error } = await supabase
    .schema('brain').from('ceo_context')
    .update({ status: 'read', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function createContact(payload: {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  source?: string;
}) {
  const { data, error } = await supabase
    .schema('core').from('contacts')
    .insert({ ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function linkContactToOrg(contactId: string, orgId: string, relationshipType = 'member') {
  const { error } = await supabase
    .schema('core').from('relationships')
    .upsert(
      { contact_id: contactId, org_id: orgId, relationship_type: relationshipType },
      { onConflict: 'org_id,contact_id,relationship_type' }
    );
  if (error) throw error;
}
