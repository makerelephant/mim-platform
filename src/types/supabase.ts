// src/types/supabase.ts
// Generated from database schema (core, crm, intel, platform, brain)
// Based on sql/migration/step-02-07-tables.sql definitions

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─────────────────────────────────────────────────────────────────
// CORE SCHEMA — What things ARE
// ─────────────────────────────────────────────────────────────────

export interface CoreOrganization {
  id: string
  name: string
  website: string | null
  address: string | null
  location: string | null
  geography: string | null
  avatar_url: string | null
  description: string | null
  notes: string | null
  corporate_structure: string | null
  parent_org_id: string | null
  owner_user_id: string | null
  source: string | null
  created_at: string
  updated_at: string
}

export interface CoreOrgType {
  id: string
  org_id: string
  type: string // 'customer' | 'partner' | 'investor' | 'vendor'
  status: string | null
  since: string | null
  created_at: string
}

export interface CoreTaxonomy {
  id: string
  name: string
  slug: string
  parent_id: string | null
  depth: number
  sort_order: number
  metadata: Json | null
  created_at: string
}

export interface CoreOrgClassification {
  id: string
  org_id: string
  taxonomy_id: string
  created_at: string
}

export interface CoreContact {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  role: string | null
  notes: string | null
  avatar_url: string | null
  source: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export interface CoreRelationship {
  id: string
  org_id: string
  contact_id: string
  relationship_type: string | null
  since: string | null
  created_at: string
}

export interface CoreTeamMember {
  id: string
  auth_user_id: string
  name: string
  email: string
  role: string // 'ceo' | 'product' | 'engineering' | 'bd' | 'operations'
  permissions: Json
  status: string
  joined_at: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────
// CRM SCHEMA — Pipeline and outreach
// ─────────────────────────────────────────────────────────────────

export interface CrmPipeline {
  id: string
  org_id: string
  pipeline_type: string // 'investor' | 'partner' | 'customer'
  status: string | null
  likelihood_score: number | null
  connection_status: string | null
  lifecycle_status: string | null
  next_action: string | null
  next_action_date: string | null
  last_contact_date: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export interface CrmOutreach {
  id: string
  org_id: string
  contact_id: string | null
  channel: string | null
  status: string | null
  outreach_date: string | null
  notes: string | null
  created_at: string
}

export interface CrmOpportunity {
  id: string
  org_id: string
  contact_id: string | null
  opportunity_type: string | null
  value: number | null
  stage: string | null
  probability: number | null
  close_date: string | null
  notes: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────
// INTEL SCHEMA — Deep profiles
// ─────────────────────────────────────────────────────────────────

export interface IntelInvestorProfile {
  id: string
  org_id: string
  fund_type: string | null
  investor_type: string | null
  check_size: string | null
  sector_focus: string | null
  portfolio_url: string | null
  notable_investments: string | null
  primary_contact: string | null
  firm_name: string | null
  created_at: string
  updated_at: string
}

export interface IntelPartnerProfile {
  id: string
  org_id: string
  partner_status: string | null
  partner_since: string | null
  revenue_share: number | null
  created_at: string
  updated_at: string
}

export interface IntelOrgFinancials {
  id: string
  org_id: string
  players: number | null
  travel_teams: number | null
  dues_per_season: number | null
  dues_revenue: number | null
  uniform_cost: number | null
  total_revenue: number | null
  gross_revenue: number | null
  total_costs: number | null
  yearly_cost_player: number | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────
// PLATFORM SCHEMA — Product layer
// ─────────────────────────────────────────────────────────────────

export interface PlatformStore {
  id: string
  org_id: string
  store_status: string | null
  store_provider: string | null
  merch_link: string | null
  created_at: string
  updated_at: string
}

export interface PlatformMembership {
  id: string
  org_id: string
  league_id: string
  joined_date: string | null
  status: string
  created_at: string
}

export interface PlatformUserContext {
  id: string
  auth_user_id: string
  display_name: string | null
  avatar_url: string | null
  community_id: string | null
  onboarding_status: string
  drops_created: number
  drops_purchased: number
  referral_source: string | null
  metadata: Json | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────
// BRAIN SCHEMA — Intelligence layer
// ─────────────────────────────────────────────────────────────────

export interface BrainCeoContext {
  id: string
  source: string
  source_id: string | null
  context_type: string // 'action_item' | 'signal' | 'briefing' | 'summary'
  title: string | null
  content: string
  priority: string // 'critical' | 'high' | 'medium' | 'low'
  status: string // 'unread' | 'read' | 'archived'
  entity_id: string | null
  entity_type: string | null
  metadata: Json | null
  // embedding: vector(1536) — not exposed to TypeScript
  created_at: string
  updated_at: string
}

export interface BrainTask {
  id: string
  title: string
  description: string | null
  entity_id: string | null
  entity_type: string | null
  status: string // 'open' | 'in_progress' | 'done' | 'cancelled'
  priority: string // 'critical' | 'high' | 'medium' | 'low'
  due_date: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
}

export interface BrainActivity {
  id: string
  entity_id: string
  entity_type: string
  action: string
  actor: string | null
  metadata: Json | null
  created_at: string
}

export interface BrainKnowledge {
  id: string
  entity_id: string | null
  entity_type: string | null
  content: string
  source: string | null
  tags: string[] | null
  // embedding: vector(1536) — not exposed to TypeScript
  created_at: string
  updated_at: string
}

export interface BrainAgentRun {
  id: string
  agent_id: string | null
  agent_name: string | null
  status: string
  input: Json | null
  output: Json | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface BrainCorrespondence {
  id: string
  entity_id: string | null
  entity_type: string | null
  channel: string | null
  direction: string | null
  subject: string | null
  body: string | null
  from_address: string | null
  to_address: string | null
  sent_at: string | null
  metadata: Json | null
  created_at: string
}

export interface BrainInstruction {
  id: string
  type: string // 'report_inclusion' | 'standing_order' | 'one_time_query' | 'scheduled_action' | 'entity_watch'
  prompt: string
  source_kb_ids: string[] | null
  source_entity_ids: string[] | null
  taxonomy_categories: string[] | null
  status: string // 'active' | 'fulfilled' | 'paused' | 'expired' | 'cancelled'
  execute_at: string | null
  expires_at: string | null
  recurrence: string | null
  last_executed_at: string | null
  execution_result: Json | null
  execution_count: number
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────
// ENRICHED TYPES — Assembled from multiple tables (Option B pattern)
// ─────────────────────────────────────────────────────────────────

/** Organization with its types and taxonomy classifications */
export interface OrgWithDetails extends CoreOrganization {
  org_types: Pick<CoreOrgType, 'type' | 'status' | 'since'>[]
  classifications: { taxonomy: Pick<CoreTaxonomy, 'id' | 'name' | 'slug' | 'parent_id' | 'depth'> | null }[]
}

/** Pipeline row with org name attached (cross-schema assembly) */
export interface PipelineWithOrg extends CrmPipeline {
  org: Pick<CoreOrganization, 'id' | 'name' | 'avatar_url' | 'website'> | null
}

/** Contact with relationship info from an org query */
export interface ContactWithRelationship extends CoreContact {
  relationship_type?: string
}

// ─────────────────────────────────────────────────────────────────
// ORG TYPE CONSTANTS
// ─────────────────────────────────────────────────────────────────

export const ORG_TYPES = ['customer', 'partner', 'investor', 'vendor'] as const
export type OrgType = typeof ORG_TYPES[number]

export const PIPELINE_TYPES = ['investor', 'partner', 'customer'] as const
export type PipelineType = typeof PIPELINE_TYPES[number]

export const CEO_CONTEXT_TYPES = ['action_item', 'signal', 'briefing', 'summary'] as const
export type CeoContextType = typeof CEO_CONTEXT_TYPES[number]

export const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
export type Priority = typeof PRIORITIES[number]

export const TEAM_ROLES = ['ceo', 'product', 'engineering', 'bd', 'operations'] as const
export type TeamRole = typeof TEAM_ROLES[number]
