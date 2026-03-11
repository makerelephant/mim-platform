/**
 * Intelligence tools for MiM MCP Server
 *
 * get_entity_dossier  — Comprehensive entity intelligence profile
 * get_activity_feed   — Recent brain activity entries
 * get_business_summary — CEO at-a-glance metrics
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import { buildEntityDossier } from "../lib/dossier.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerIntelligenceTools(server: McpServer) {

  // ── get_entity_dossier ──
  server.tool(
    "get_entity_dossier",
    "Get a comprehensive intelligence profile for an organization or contact. Includes: entity details, org types, pipeline status, recent correspondence, open tasks, knowledge items, feedback scores. This is the richest view of any entity.",
    {
      entity_type: z.enum(["organizations", "contacts"]).describe("Entity type"),
      entity_id: z.string().describe("Entity UUID"),
    },
    async ({ entity_type, entity_id }) => {
      const dossier = await buildEntityDossier(supabase, entity_type, entity_id);
      if (!dossier) {
        return { content: [{ type: "text" as const, text: `Entity not found: ${entity_type}/${entity_id}` }] };
      }
      return { content: [{ type: "text" as const, text: dossier.rendered }] };
    }
  );

  // ── get_activity_feed ──
  server.tool(
    "get_activity_feed",
    "Get recent brain activity — emails scanned, Slack messages processed, reports generated, tasks created. Filter by entity or action type.",
    {
      days: z.number().optional().default(7).describe("Look back N days (default 7)"),
      entity_id: z.string().optional().describe("Filter by entity UUID"),
      action: z.string().optional().describe("Filter by action: email_scanned, slack_scanned, knowledge_ingested, report_generated, task_created"),
      limit: z.number().optional().default(50).describe("Max results (default 50)"),
    },
    async ({ days, entity_id, action, limit }) => {
      const since = new Date();
      since.setDate(since.getDate() - (days ?? 7));

      let query = supabase.schema("brain").from("activity")
        .select("id, actor, action, entity_type, entity_id, metadata, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(limit ?? 50);

      if (entity_id) query = query.eq("entity_id", entity_id);
      if (action) query = query.eq("action", action);

      const { data: activities, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!activities || activities.length === 0) {
        return { content: [{ type: "text" as const, text: `No activity found in the last ${days} days.` }] };
      }

      // Resolve entity names
      const entityIds = [...new Set(activities.filter((a: { entity_id: string | null }) => a.entity_id).map((a: { entity_id: string }) => a.entity_id))];
      const entityNameMap = new Map<string, string>();
      if (entityIds.length > 0) {
        const [orgs, contacts] = await Promise.all([
          supabase.schema("core").from("organizations").select("id, name").in("id", entityIds),
          supabase.schema("core").from("contacts").select("id, first_name, last_name").in("id", entityIds),
        ]);
        for (const o of orgs.data ?? []) entityNameMap.set(o.id, o.name);
        for (const c of contacts.data ?? []) entityNameMap.set(c.id, [c.first_name, c.last_name].filter(Boolean).join(" "));
      }

      const lines = activities.map((a: { action: string; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string; actor: string }) => {
        const entity = a.entity_id ? entityNameMap.get(a.entity_id) || a.entity_id : "";
        const summary = (a.metadata as Record<string, string> | null)?.summary || "";
        const priority = (a.metadata as Record<string, string> | null)?.priority || "";
        const parts = [
          `[${a.action}]`,
          entity ? `${entity}` : "",
          summary ? `— ${summary.slice(0, 120)}` : "",
          priority ? `(${priority})` : "",
          `at ${a.created_at}`,
        ].filter(Boolean);
        return `• ${parts.join(" ")}`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Activity feed (last ${days} days, ${activities.length} entries):\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // ── get_business_summary ──
  server.tool(
    "get_business_summary",
    "Get a CEO at-a-glance summary: total orgs by type, pipeline metrics, open tasks, activity volume, recent correspondence stats. Use this for morning briefings.",
    {
      period_days: z.number().optional().default(7).describe("Summary period in days (default 7)"),
    },
    async ({ period_days }) => {
      const since = new Date();
      since.setDate(since.getDate() - (period_days ?? 7));
      const sinceStr = since.toISOString();

      // Run all metrics queries in parallel
      const [
        orgTypesResult,
        pipelineResult,
        openTasksResult,
        pendingReviewResult,
        doneTasksResult,
        activityCountResult,
        correspondenceResult,
        newContactsResult,
        kbResult,
      ] = await Promise.all([
        // Org counts by type
        supabase.schema("core").from("org_types").select("type"),
        // Active pipeline entries
        supabase.schema("crm").from("pipeline").select("pipeline_type, status"),
        // Open tasks
        supabase.schema("brain").from("tasks").select("id, priority", { count: "exact" }).in("status", ["todo", "in_progress"]),
        // Pending review
        supabase.schema("brain").from("tasks").select("id", { count: "exact" }).eq("status", "pending_review"),
        // Done in period
        supabase.schema("brain").from("tasks").select("id", { count: "exact" }).eq("status", "done").gte("created_at", sinceStr),
        // Activity count in period
        supabase.schema("brain").from("activity").select("action").gte("created_at", sinceStr),
        // Correspondence in period
        supabase.schema("brain").from("correspondence").select("direction, channel").gte("sent_at", sinceStr),
        // New contacts in period
        supabase.schema("core").from("contacts").select("id", { count: "exact" }).gte("created_at", sinceStr),
        // KB entries
        supabase.from("knowledge_base").select("id", { count: "exact" }).eq("processed", true),
      ]);

      // Compute org type counts
      const typeCounts = new Map<string, number>();
      for (const t of orgTypesResult.data ?? []) {
        typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
      }

      // Pipeline breakdown
      const pipelineByType = new Map<string, Map<string, number>>();
      for (const p of pipelineResult.data ?? []) {
        if (!pipelineByType.has(p.pipeline_type)) pipelineByType.set(p.pipeline_type, new Map());
        const statusMap = pipelineByType.get(p.pipeline_type)!;
        statusMap.set(p.status ?? "none", (statusMap.get(p.status ?? "none") ?? 0) + 1);
      }

      // Activity breakdown
      const activityByAction = new Map<string, number>();
      for (const a of activityCountResult.data ?? []) {
        activityByAction.set(a.action, (activityByAction.get(a.action) ?? 0) + 1);
      }

      // Correspondence breakdown
      let inboundCount = 0;
      let outboundCount = 0;
      for (const c of correspondenceResult.data ?? []) {
        if (c.direction === "inbound") inboundCount++;
        else outboundCount++;
      }

      // Open task priority breakdown
      const taskPriorities = new Map<string, number>();
      for (const t of openTasksResult.data ?? []) {
        taskPriorities.set(t.priority, (taskPriorities.get(t.priority) ?? 0) + 1);
      }

      // Build summary
      const sections: string[] = [];
      sections.push(`# MiM Business Summary (Last ${period_days} Days)`);

      sections.push("\n## Organizations");
      for (const [type, count] of typeCounts) {
        sections.push(`• ${type}: ${count}`);
      }

      sections.push("\n## Pipeline");
      for (const [type, statusMap] of pipelineByType) {
        const statusStr = [...statusMap.entries()].map(([s, c]) => `${s}: ${c}`).join(", ");
        sections.push(`• ${type}: ${statusStr}`);
      }

      sections.push("\n## Tasks");
      sections.push(`• Open: ${openTasksResult.count ?? 0} (${[...taskPriorities.entries()].map(([p, c]) => `${p}: ${c}`).join(", ")})`);
      sections.push(`• Pending review: ${pendingReviewResult.count ?? 0}`);
      sections.push(`• Completed this period: ${doneTasksResult.count ?? 0}`);

      sections.push("\n## Activity");
      for (const [action, count] of activityByAction) {
        sections.push(`• ${action}: ${count}`);
      }

      sections.push("\n## Correspondence");
      sections.push(`• Inbound: ${inboundCount}`);
      sections.push(`• Outbound: ${outboundCount}`);
      sections.push(`• Total: ${inboundCount + outboundCount}`);

      sections.push("\n## Other");
      sections.push(`• New contacts: ${newContactsResult.count ?? 0}`);
      sections.push(`• Knowledge base entries: ${kbResult.count ?? 0}`);

      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    }
  );
}
