/**
 * Entity Dossier Builder
 *
 * Builds a compact context block about an entity (organization or contact)
 * by aggregating correspondence history, open tasks, entity details, and
 * feedback signals. The rendered dossier is injected into the classifier
 * prompt so it can make informed decisions based on relationship context.
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
  org_type: string[] | null;
  pipeline_status: string | null;
  partner_status: string | null;
  lifecycle_status: string | null;
  notes: string | null;
  connection_status: string | null;
}

interface ContactDetails {
  name: string;
  title: string | null;
  organization: string | null;
  email: string | null;
  primary_category: string | null;
}

interface ContactRole {
  role: string | null;
  org_name: string | null;
  org_type: string[] | null;
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

/**
 * Build a rich context dossier for an entity.
 * Runs 5 parallel queries to minimize latency (~50ms total).
 */
export async function buildEntityDossier(
  sb: SupabaseClient,
  entityType: string,
  entityId: string,
): Promise<EntityDossier | null> {
  if (!entityId) return null;

  // Run all queries in parallel (7 queries)
  const [
    entityResult,
    correspondenceResult,
    tasksResult,
    statsResult,
    rolesResult,
    feedbackResult,
    knowledgeResult,
  ] = await Promise.all([
    // 1. Entity details
    entityType === "organizations"
      ? sb.from("organizations")
          .select("name, org_type, pipeline_status, partner_status, lifecycle_status, notes, connection_status")
          .eq("id", entityId)
          .single()
      : sb.from("contacts")
          .select("name, title, organization, email, primary_category")
          .eq("id", entityId)
          .single(),

    // 2. Recent correspondence (last 5)
    sb.from("correspondence")
      .select("direction, subject, email_date, source")
      .eq("entity_id", entityId)
      .order("email_date", { ascending: false })
      .limit(5),

    // 3. Open tasks for this entity
    sb.from("tasks")
      .select("title, priority, status, created_at")
      .eq("entity_id", entityId)
      .in("status", ["todo", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(5),

    // 4. Stats: total emails + last contact date
    sb.from("correspondence")
      .select("email_date")
      .eq("entity_id", entityId)
      .order("email_date", { ascending: false })
      .limit(1),

    // 5. Contact roles (if entity is a contact, get linked orgs)
    entityType === "contacts"
      ? sb.from("organization_contacts")
          .select("role, organizations(name, org_type)")
          .eq("contact_id", entityId)
          .limit(3)
      : Promise.resolve({ data: null }),

    // 6. Entity feedback (from feedback engine)
    sb.from("entity_feedback")
      .select("total_tasks_created, tasks_starred, tasks_completed, tasks_ignored, usefulness_score, computed_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .single(),

    // 7. Knowledge base entries linked to this entity
    Promise.resolve(
      sb.from("knowledge_base")
        .select("title, source_type, file_type, summary, created_at")
        .contains("entity_ids", [entityId])
        .eq("processed", true)
        .order("created_at", { ascending: false })
        .limit(5)
    ).catch(() => ({ data: null, error: null })),
  ]);

  // Parse entity details
  let orgDetails: OrgDetails | null = null;
  let contactDetails: ContactDetails | null = null;
  let entityName = "Unknown";

  if (entityType === "organizations" && entityResult.data) {
    orgDetails = entityResult.data as OrgDetails;
    entityName = orgDetails.name;
  } else if (entityType === "contacts" && entityResult.data) {
    contactDetails = entityResult.data as ContactDetails;
    entityName = contactDetails.name;
  }

  // Parse contact roles
  const contactRoles: ContactRole[] = [];
  if (rolesResult.data) {
    for (const row of rolesResult.data as unknown as Array<{ role: string | null; organizations: { name: string; org_type: string[] | null } | null }>) {
      if (row.organizations) {
        contactRoles.push({
          role: row.role,
          org_name: row.organizations.name,
          org_type: row.organizations.org_type,
        });
      }
    }
  }

  // Parse correspondence
  const recentCorrespondence = (correspondenceResult.data || []) as CorrespondenceItem[];

  // Parse tasks
  const openTasks = (tasksResult.data || []) as OpenTask[];

  // Parse stats
  const totalEmailCount = await sb.from("correspondence")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", entityId);

  const totalEmails = totalEmailCount.count || 0;
  const lastContactDate = statsResult.data?.[0]?.email_date || null;
  const daysSinceLastContact = lastContactDate ? daysAgo(lastContactDate) : null;

  // Parse feedback
  let feedbackSummary: string | null = null;
  if (feedbackResult.data && feedbackResult.data.total_tasks_created > 0) {
    const f = feedbackResult.data;
    const usefulPct = Math.round((f.usefulness_score || 0) * 100);
    feedbackSummary = `FEEDBACK: User found ${usefulPct}% of tasks from this entity useful (${f.total_tasks_created} total, ${f.tasks_starred} starred, ${f.tasks_completed} completed, ${f.tasks_ignored} ignored).`;
  }

  // Parse knowledge base items
  const knowledgeItems: KnowledgeItem[] = (knowledgeResult?.data || []) as KnowledgeItem[];

  // Render the dossier
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

  // Entity type + key status
  if (d.orgDetails) {
    const types = d.orgDetails.org_type?.join(", ") || "Unknown";
    lines.push(`Type: Organization (${types})`);

    const statusParts: string[] = [];
    if (d.orgDetails.pipeline_status) statusParts.push(`Pipeline: ${d.orgDetails.pipeline_status}`);
    if (d.orgDetails.partner_status) statusParts.push(`Partner: ${d.orgDetails.partner_status}`);
    if (d.orgDetails.connection_status) statusParts.push(`Connection: ${d.orgDetails.connection_status}`);
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
    if (d.contactDetails.title) parts.push(`Title: ${d.contactDetails.title}`);
    if (d.contactDetails.organization) parts.push(`Org: ${d.contactDetails.organization}`);
    lines.push(parts.join(" | "));

    if (d.contactRoles.length > 0) {
      const roleStrs = d.contactRoles.map((r) => {
        const orgType = r.org_type?.join("/") || "";
        return `${r.role || "member"} at ${r.org_name}${orgType ? ` (${orgType})` : ""}`;
      });
      lines.push(`Roles: ${roleStrs.join(", ")}`);
    }

    if (d.stats.daysSinceLastContact !== null) {
      lines.push(`Last contact: ${d.stats.daysSinceLastContact === 0 ? "today" : `${d.stats.daysSinceLastContact} days ago`} | Total emails: ${d.stats.totalEmails}`);
    }
  }

  // Recent correspondence
  if (d.recentCorrespondence.length > 0) {
    lines.push("Recent correspondence:");
    for (const c of d.recentCorrespondence) {
      const dir = c.direction === "outbound" ? "outbound" : "inbound";
      const date = c.email_date ? timeAgoShort(c.email_date) : "unknown";
      lines.push(`  - [${dir}] "${truncate(c.subject, 60)}" (${date})`);
    }
  }

  // Open tasks
  if (d.openTasks.length > 0) {
    lines.push("Open tasks:");
    for (const t of d.openTasks) {
      const age = t.created_at ? timeAgoShort(t.created_at) : "unknown";
      lines.push(`  - [${t.priority}] "${truncate(t.title, 60)}" (${age})`);
    }
  }

  // Knowledge base
  if (d.knowledgeItems.length > 0) {
    lines.push(`Knowledge base: ${d.knowledgeItems.length} document(s)`);
    for (const k of d.knowledgeItems) {
      const age = k.created_at ? timeAgoShort(k.created_at) : "unknown";
      const typeLabel = k.file_type ? `[${k.file_type}]` : `[${k.source_type}]`;
      lines.push(`  - ${typeLabel} "${truncate(k.title, 50)}" (${age})${k.summary ? ` — ${truncate(k.summary, 80)}` : ""}`);
    }
  }

  // Feedback summary
  if (d.feedbackSummary) {
    lines.push(d.feedbackSummary);
  }

  return lines.join("\n");
}
