/**
 * Shared types for the MiM MCP server tools.
 */

export interface OrgWithContext {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  types: string[];
  pipeline: PipelineEntry[];
}

export interface PipelineEntry {
  id: string;
  org_id: string;
  pipeline_type: string;
  status: string | null;
  likelihood_score: number | null;
  connection_status: string | null;
  lifecycle_status: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_date: string | null;
}

export interface ContactWithContext {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
  created_at: string;
  org_links: {
    org_id: string;
    org_name: string;
    relationship_type: string | null;
  }[];
}

export interface TaskEntry {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  due_date: string | null;
  is_starred: boolean;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  source_type: string;
  file_type: string | null;
  summary: string | null;
  tags: string[] | null;
  taxonomy_categories: string[] | null;
  entity_ids: string[] | null;
  processed: boolean;
  created_at: string;
}

/** Format a tool result as readable text for Claude */
export function formatToolResult(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}
