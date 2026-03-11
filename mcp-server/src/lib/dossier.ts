/**
 * Entity Dossier Builder — Port from src/lib/entity-dossier.ts
 *
 * Builds a compact context block about an entity (organization or contact)
 * by aggregating correspondence history, open tasks, entity details, and
 * feedback signals. Same logic as the app's dossier builder, adapted for
 * the MCP server's Supabase client.
 *
 * Target: ~400 tokens per dossier.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Types ── */

interface CorrespondenceItem {
  direction: string;
  subject: string;
  email_date: string;
  source: string;
}

interface OpenTask {
  title: string;
  priority: string;
  status: string;
  created_at: string;
}

interface OrgDetails {
  name: string;
  org_types: { type: string; status: string }[];
  pipeline: { status: string | null; pipeline_type: string; connection_status: string | null; lifecycle_status: string | null }[];
  partner_status: string | null;
  notes: string | null;
}

interface ContactDetails {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
}

interface ContactRole {
  relationship_type: string | null;
  org_name: string | null;
  org_types: string[];
}

interface KnowledgeItem {
  title: string;
  source_type: string;
  file_type: string | null;
  summary: string | null;
  created_at: string;
}

export interface EntityDossier {
  entityType: string;
  entityId: string;
  entityName: string;
  orgDetails: OrgDetails | null;
  contactDetails: ContactDetails | null;
  contactRoles: ContactRole[];
  recentCorrespondence: CorrespondenceItem[];
  openTasks: OpenTask[];
  knowledgeItems: KnowledgeItem[];
  stats: {
    totalEmails: number;
    lastContactDate: string | null;
    daysSinceLastContact: number | null;
  };
  feedbackSummary: string | null;
  rendered: string;
}

/* ── Helpers ── */

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function timeAgoShort(dateStr: string): string {
  const days = daysAgo(dateStr);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

/* ── Main Builder ── */

export async function buildEntityDossier(
  sb: SupabaseClient,
  entityType: string,
  entityId: string,
): Promise<EntityDossier | null> {
  if (!entityId) return null;

  // Run all queries in parallel — multi-schema architecture
  const [
    entityResult,
    orgTypesResult,
    pipelineResult,
    partnerResult,
    correspondenceResult,
    tasksResult,
    statsResult,
    rolesResult,
    feedbackResult,
    knowledgeResult,
  ] = await Promise.all([
    // 1. Entity details
    entityType === "organizations"
      ? sb.schema("core").from("organizations")
          .select("name, notes")
          .eq("id", entityId)
          .single()
      : sb.schema("core").from("contacts")
          .select("first_name, last_name, role, email")
          .eq("id", entityId)
          .single(),

    // 2. Org types
    entityType === "organizations"
      ? sb.schema("core").from("org_types")
          .select("type, status")
          .eq("org_id", entityId)
      : Promise.resolve({ data: null }),

    // 3. Pipeline data
    entityType === "organizations"
      ? sb.schema("crm").from("pipeline")
          .select("status, pipeline_type, connection_status, lifecycle_status")
          .eq("org_id", entityId)
      : Promise.resolve({ data: null }),

    // 4. Partner profile
    entityType === "organizations"
      ? sb.schema("intel").from("partner_profile")
          .select("partner_status")
          .eq("org_id", entityId)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // 5. Recent correspondence (last 5)
    sb.schema("brain").from("correspondence")
      .select("direction, subject, sent_at, channel")
      .eq("entity_id", entityId)
      .order("sent_at", { ascending: false })
      .limit(5),

    // 6. Open tasks
    sb.schema("brain").from("tasks")
      .select("title, priority, status, created_at")
      .eq("entity_id", entityId)
      .in("status", ["todo", "in_progress", "open"])
      .order("created_at", { ascending: false })
      .limit(5),

    // 7. Last contact date
    sb.schema("brain").from("correspondence")
      .select("sent_at")
      .eq("entity_id", entityId)
      .order("sent_at", { ascending: false })
      .limit(1),

    // 8. Contact roles
    entityType === "contacts"
      ? sb.schema("core").from("relationships")
          .select("relationship_type, org_id")
          .eq("contact_id", entityId)
          .limit(3)
      : Promise.resolve({ data: null }),

    // 9. Entity feedback
    sb.from("entity_feedback")
      .select("total_tasks_created, tasks_starred, tasks_completed, tasks_ignored, usefulness_score, computed_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .single(),

    // 10. Knowledge base entries
    sb.from("knowledge_base")
      .select("title, source_type, file_type, summary, created_at")
      .contains("entity_ids", [entityId])
      .eq("processed", true)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Parse entity details
  let orgDetails: OrgDetails | null = null;
  let contactDetails: ContactDetails | null = null;
  let entityName = "Unknown";

  if (entityType === "organizations" && entityResult.data) {
    const raw = entityResult.data as { name: string; notes: string | null };
    const pipeline = (pipelineResult.data ?? []) as { status: string | null; pipeline_type: string; connection_status: string | null; lifecycle_status: string | null }[];
    orgDetails = {
      name: raw.name,
      org_types: (orgTypesResult.data ?? []) as { type: string; status: string }[],
      pipeline,
      partner_status: (partnerResult.data as { partner_status: string | null } | null)?.partner_status ?? null,
      notes: raw.notes,
    };
    entityName = orgDetails.name;
  } else if (entityType === "contacts" && entityResult.data) {
    contactDetails = entityResult.data as ContactDetails;
    entityName = [contactDetails.first_name, contactDetails.last_name].filter(Boolean).join(" ") || "Unknown";
  }

  // Parse contact roles
  const contactRoles: ContactRole[] = [];
  if (rolesResult.data && (rolesResult.data as unknown[]).length > 0) {
    const roleRows = rolesResult.data as Array<{ relationship_type: string | null; org_id: string }>;
    const orgIds = roleRows.map(r => r.org_id);
    const [orgsForRoles, orgTypesForRoles] = await Promise.all([
      sb.schema("core").from("organizations").select("id, name").in("id", orgIds),
      sb.schema("core").from("org_types").select("org_id, type").in("org_id", orgIds),
    ]);
    const orgMap = new Map((orgsForRoles.data ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));
    const typeMap = new Map<string, string[]>();
    for (const t of (orgTypesForRoles.data ?? []) as { org_id: string; type: string }[]) {
      const existing = typeMap.get(t.org_id) ?? [];
      existing.push(t.type);
      typeMap.set(t.org_id, existing);
    }
    for (const row of roleRows) {
      contactRoles.push({
        relationship_type: row.relationship_type,
        org_name: orgMap.get(row.org_id) ?? null,
        org_types: typeMap.get(row.org_id) ?? [],
      });
    }
  }

  // Parse correspondence
  const recentCorrespondence: CorrespondenceItem[] = ((correspondenceResult.data || []) as { direction: string; subject: string; sent_at: string; channel: string }[]).map(
    (c) => ({
      direction: c.direction,
      subject: c.subject,
      email_date: c.sent_at,
      source: c.channel,
    })
  );

  // Parse tasks
  const openTasks = (tasksResult.data || []) as OpenTask[];

  // Parse stats
  const totalEmailCount = await sb.schema("brain").from("correspondence")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", entityId);

  const totalEmails = totalEmailCount.count || 0;
  const lastContactDate = (statsResult.data as { sent_at: string }[] | null)?.[0]?.sent_at || null;
  const daysSinceLastContact = lastContactDate ? daysAgo(lastContactDate) : null;

  // Parse feedback
  let feedbackSummary: string | null = null;
  if (feedbackResult.data && (feedbackResult.data as { total_tasks_created: number }).total_tasks_created > 0) {
    const f = feedbackResult.data as { usefulness_score: number; total_tasks_created: number; tasks_starred: number; tasks_completed: number; tasks_ignored: number };
    const usefulPct = Math.round((f.usefulness_score || 0) * 100);
    feedbackSummary = `FEEDBACK: User found ${usefulPct}% of tasks from this entity useful (${f.total_tasks_created} total, ${f.tasks_starred} starred, ${f.tasks_completed} completed, ${f.tasks_ignored} ignored).`;
  }

  // Parse knowledge
  const knowledgeItems: KnowledgeItem[] = (knowledgeResult?.data || []) as KnowledgeItem[];

  // Render
  const rendered = renderDossier({
    entityType,
    entityName,
    orgDetails,
    contactDetails,
    contactRoles,
    recentCorrespondence,
    openTasks,
    knowledgeItems,
    stats: { totalEmails, lastContactDate, daysSinceLastContact },
    feedbackSummary,
  });

  return {
    entityType,
    entityId,
    entityName,
    orgDetails,
    contactDetails,
    contactRoles,
    recentCorrespondence,
    openTasks,
    knowledgeItems,
    stats: { totalEmails, lastContactDate, daysSinceLastContact },
    feedbackSummary,
    rendered,
  };
}

/* ── Renderer ── */

function renderDossier(d: {
  entityType: string;
  entityName: string;
  orgDetails: OrgDetails | null;
  contactDetails: ContactDetails | null;
  contactRoles: ContactRole[];
  recentCorrespondence: CorrespondenceItem[];
  openTasks: OpenTask[];
  knowledgeItems: KnowledgeItem[];
  stats: { totalEmails: number; lastContactDate: string | null; daysSinceLastContact: number | null };
  feedbackSummary: string | null;
}): string {
  const lines: string[] = [];

  lines.push(`ENTITY DOSSIER for ${d.entityName}:`);

  if (d.orgDetails) {
    const types = d.orgDetails.org_types?.map(t => t.type).join(", ") || "Unknown";
    lines.push(`Type: Organization (${types})`);

    const statusParts: string[] = [];
    for (const p of d.orgDetails.pipeline) {
      if (p.status) statusParts.push(`Pipeline(${p.pipeline_type}): ${p.status}`);
      if (p.connection_status) statusParts.push(`Connection: ${p.connection_status}`);
    }
    if (d.orgDetails.partner_status) statusParts.push(`Partner: ${d.orgDetails.partner_status}`);
    if (d.stats.daysSinceLastContact !== null) {
      statusParts.push(`Last contact: ${d.stats.daysSinceLastContact === 0 ? "today" : `${d.stats.daysSinceLastContact} days ago`}`);
    }
    statusParts.push(`Total emails: ${d.stats.totalEmails}`);
    lines.push(statusParts.join(" | "));

    if (d.orgDetails.notes) {
      lines.push(`Notes: "${truncate(d.orgDetails.notes, 200)}"`);
    }
  } else if (d.contactDetails) {
    const parts: string[] = [`Type: Contact`];
    if (d.contactDetails.role) parts.push(`Role: ${d.contactDetails.role}`);
    lines.push(parts.join(" | "));

    if (d.contactRoles.length > 0) {
      const roleStrs = d.contactRoles.map((r) => {
        const orgType = r.org_types?.join("/") || "";
        return `${r.relationship_type || "member"} at ${r.org_name}${orgType ? ` (${orgType})` : ""}`;
      });
      lines.push(`Roles: ${roleStrs.join(", ")}`);
    }

    if (d.stats.daysSinceLastContact !== null) {
      lines.push(`Last contact: ${d.stats.daysSinceLastContact === 0 ? "today" : `${d.stats.daysSinceLastContact} days ago`} | Total emails: ${d.stats.totalEmails}`);
    }
  }

  if (d.recentCorrespondence.length > 0) {
    lines.push("Recent correspondence:");
    for (const c of d.recentCorrespondence) {
      const dir = c.direction === "outbound" ? "outbound" : "inbound";
      const date = c.email_date ? timeAgoShort(c.email_date) : "unknown";
      lines.push(`  - [${dir}] "${truncate(c.subject, 60)}" (${date})`);
    }
  }

  if (d.openTasks.length > 0) {
    lines.push("Open tasks:");
    for (const t of d.openTasks) {
      const age = t.created_at ? timeAgoShort(t.created_at) : "unknown";
      lines.push(`  - [${t.priority}] "${truncate(t.title, 60)}" (${age})`);
    }
  }

  if (d.knowledgeItems.length > 0) {
    lines.push(`Knowledge base: ${d.knowledgeItems.length} document(s)`);
    for (const k of d.knowledgeItems) {
      const age = k.created_at ? timeAgoShort(k.created_at) : "unknown";
      const typeLabel = k.file_type ? `[${k.file_type}]` : `[${k.source_type}]`;
      lines.push(`  - ${typeLabel} "${truncate(k.title, 50)}" (${age})${k.summary ? ` — ${truncate(k.summary, 80)}` : ""}`);
    }
  }

  if (d.feedbackSummary) {
    lines.push(d.feedbackSummary);
  }

  return lines.join("\n");
}
