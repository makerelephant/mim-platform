/**
 * Pipeline tools for MiM MCP Server
 *
 * list_pipeline   — Pipeline deals with org names, status, filters
 * update_pipeline — Move deals through stages, update next action
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPipelineTools(server: McpServer) {

  // ── list_pipeline ──
  server.tool(
    "list_pipeline",
    "List pipeline deals with organization names. Filter by pipeline_type (investor/customer) or status. Shows deal status, likelihood, connection status, next action.",
    {
      pipeline_type: z.string().optional().describe("Filter: investor or customer"),
      status: z.string().optional().describe("Filter by pipeline status"),
      limit: z.number().optional().default(50).describe("Max results (default 50)"),
    },
    async ({ pipeline_type, status, limit }) => {
      let query = supabase.schema("crm").from("pipeline")
        .select("id, org_id, pipeline_type, status, likelihood_score, connection_status, lifecycle_status, next_action, next_action_date, last_contact_date, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit ?? 50);

      if (pipeline_type) query = query.eq("pipeline_type", pipeline_type);
      if (status) query = query.eq("status", status);

      const { data: pipelines, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!pipelines || pipelines.length === 0) return { content: [{ type: "text" as const, text: "No pipeline entries found." }] };

      // Fetch org names
      const orgIds = [...new Set(pipelines.map((p: { org_id: string }) => p.org_id))];
      const { data: orgs } = await supabase.schema("core").from("organizations").select("id, name").in("id", orgIds);
      const orgMap = new Map((orgs ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));

      const lines = pipelines.map((p: { id: string; org_id: string; pipeline_type: string; status: string | null; likelihood_score: number | null; connection_status: string | null; next_action: string | null; next_action_date: string | null; last_contact_date: string | null }) => {
        const orgName = orgMap.get(p.org_id) || "Unknown";
        const parts: string[] = [
          `${orgName} [${p.pipeline_type}]`,
          `Status: ${p.status ?? "none"}`,
        ];
        if (p.likelihood_score) parts.push(`Likelihood: ${p.likelihood_score}%`);
        if (p.connection_status) parts.push(`Connection: ${p.connection_status}`);
        if (p.next_action) parts.push(`Next: ${p.next_action}`);
        if (p.next_action_date) parts.push(`Due: ${p.next_action_date}`);
        if (p.last_contact_date) parts.push(`Last contact: ${p.last_contact_date}`);
        return `• ${parts.join(" | ")} (id: ${p.id})`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${pipelines.length} pipeline deal(s):\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // ── update_pipeline ──
  server.tool(
    "update_pipeline",
    "Update a pipeline deal's status, next action, likelihood score, or connection status.",
    {
      pipeline_id: z.string().describe("Pipeline entry UUID"),
      status: z.string().optional().describe("New status (e.g., First Meeting, Engaged, Due Diligence, Closed)"),
      next_action: z.string().optional().describe("Next action to take"),
      next_action_date: z.string().optional().describe("Due date for next action (ISO format)"),
      likelihood_score: z.number().optional().describe("Deal likelihood percentage (0-100)"),
      connection_status: z.string().optional().describe("Connection status"),
      lifecycle_status: z.string().optional().describe("Lifecycle status"),
      last_contact_date: z.string().optional().describe("Last contact date (ISO format)"),
    },
    async ({ pipeline_id, status, next_action, next_action_date, likelihood_score, connection_status, lifecycle_status, last_contact_date }) => {
      const updates: Record<string, unknown> = {};
      if (status !== undefined) updates.status = status;
      if (next_action !== undefined) updates.next_action = next_action;
      if (next_action_date !== undefined) updates.next_action_date = next_action_date;
      if (likelihood_score !== undefined) updates.likelihood_score = likelihood_score;
      if (connection_status !== undefined) updates.connection_status = connection_status;
      if (lifecycle_status !== undefined) updates.lifecycle_status = lifecycle_status;
      if (last_contact_date !== undefined) updates.last_contact_date = last_contact_date;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update." }] };
      }

      const { error } = await supabase.schema("crm").from("pipeline").update(updates).eq("id", pipeline_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return { content: [{ type: "text" as const, text: `Updated pipeline ${pipeline_id}: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(", ")}` }] };
    }
  );
}
