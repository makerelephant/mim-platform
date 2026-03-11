/**
 * Task tools for MiM MCP Server
 *
 * list_tasks  — Filter by status, priority, entity
 * create_task — Create action item with entity linking
 * update_task — Update status, priority, star
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTaskTools(server: McpServer) {

  // ── list_tasks ──
  server.tool(
    "list_tasks",
    "List tasks with optional filters. Status values: todo, pending_review, in_progress, done, dismissed. Priority: critical, high, medium, low.",
    {
      status: z.string().optional().describe("Filter by status: todo, pending_review, in_progress, done, dismissed"),
      priority: z.string().optional().describe("Filter by priority: critical, high, medium, low"),
      entity_id: z.string().optional().describe("Filter by linked entity (org or contact UUID)"),
      is_starred: z.boolean().optional().describe("Filter by starred status"),
      limit: z.number().optional().default(25).describe("Max results (default 25)"),
    },
    async ({ status, priority, entity_id, is_starred, limit }) => {
      let query = supabase.schema("brain").from("tasks")
        .select("id, title, summary, status, priority, entity_type, entity_id, due_date, is_starred, created_at, taxonomy_category, recommended_action")
        .order("created_at", { ascending: false })
        .limit(limit ?? 25);

      if (status) query = query.eq("status", status);
      if (priority) query = query.eq("priority", priority);
      if (entity_id) query = query.eq("entity_id", entity_id);
      if (is_starred !== undefined) query = query.eq("is_starred", is_starred);

      const { data: tasks, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!tasks || tasks.length === 0) return { content: [{ type: "text" as const, text: "No tasks found matching criteria." }] };

      // Resolve entity names
      const entityIds = [...new Set(tasks.filter((t: { entity_id: string | null }) => t.entity_id).map((t: { entity_id: string }) => t.entity_id))];
      let entityNameMap = new Map<string, string>();
      if (entityIds.length > 0) {
        const { data: orgs } = await supabase.schema("core").from("organizations").select("id, name").in("id", entityIds);
        const { data: contacts } = await supabase.schema("core").from("contacts").select("id, first_name, last_name").in("id", entityIds);
        for (const o of orgs ?? []) entityNameMap.set(o.id, o.name);
        for (const c of contacts ?? []) entityNameMap.set(c.id, [c.first_name, c.last_name].filter(Boolean).join(" "));
      }

      const lines = tasks.map((t: { id: string; title: string; status: string; priority: string; is_starred: boolean; entity_id: string | null; due_date: string | null; created_at: string; recommended_action?: string }) => {
        const star = t.is_starred ? "⭐ " : "";
        const entity = t.entity_id ? ` — ${entityNameMap.get(t.entity_id) || t.entity_id}` : "";
        const due = t.due_date ? ` (due: ${t.due_date})` : "";
        const action = t.recommended_action ? ` [${t.recommended_action}]` : "";
        return `• ${star}[${t.priority}/${t.status}] ${t.title}${entity}${due}${action} (id: ${t.id})`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${tasks.length} task(s):\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // ── create_task ──
  server.tool(
    "create_task",
    "Create a new task/action item. Optionally link to an entity (org or contact). The CEO can use this to manually create follow-up tasks.",
    {
      title: z.string().describe("Task title"),
      summary: z.string().optional().describe("Detailed description"),
      priority: z.enum(["critical", "high", "medium", "low"]).optional().default("medium").describe("Priority level"),
      entity_type: z.enum(["organizations", "contacts"]).optional().describe("Entity type to link"),
      entity_id: z.string().optional().describe("Entity UUID to link"),
      due_date: z.string().optional().describe("Due date (ISO format)"),
      recommended_action: z.string().optional().describe("Suggested action (e.g., follow_up, schedule_meeting, review)"),
    },
    async ({ title, summary, priority, entity_type, entity_id, due_date, recommended_action }) => {
      const { data: task, error } = await supabase.schema("brain").from("tasks").insert({
        title,
        summary: summary ?? null,
        priority: priority ?? "medium",
        status: "todo",
        entity_type: entity_type ?? null,
        entity_id: entity_id ?? null,
        due_date: due_date ?? null,
        recommended_action: recommended_action ?? null,
        source: "mcp",
        is_starred: false,
      }).select("id").single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      // Log activity
      await supabase.schema("brain").from("activity").insert({
        actor: "mcp-server",
        action: "task_created",
        entity_type: entity_type ?? null,
        entity_id: entity_id ?? null,
        metadata: { title, priority, source: "mcp" },
      });

      return { content: [{ type: "text" as const, text: `Created task: "${title}" [${priority}] (id: ${task.id})` }] };
    }
  );

  // ── update_task ──
  server.tool(
    "update_task",
    "Update a task's status, priority, or star. Use this to approve pending tasks, mark done, dismiss, or change priority.",
    {
      task_id: z.string().describe("Task UUID"),
      status: z.enum(["todo", "pending_review", "in_progress", "done", "dismissed"]).optional(),
      priority: z.enum(["critical", "high", "medium", "low"]).optional(),
      is_starred: z.boolean().optional(),
      title: z.string().optional(),
      summary: z.string().optional(),
      due_date: z.string().optional(),
    },
    async ({ task_id, status, priority, is_starred, title, summary, due_date }) => {
      const updates: Record<string, unknown> = {};
      if (status !== undefined) updates.status = status;
      if (priority !== undefined) updates.priority = priority;
      if (is_starred !== undefined) updates.is_starred = is_starred;
      if (title !== undefined) updates.title = title;
      if (summary !== undefined) updates.summary = summary;
      if (due_date !== undefined) updates.due_date = due_date;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update." }] };
      }

      const { error } = await supabase.schema("brain").from("tasks").update(updates).eq("id", task_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return { content: [{ type: "text" as const, text: `Updated task ${task_id}: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(", ")}` }] };
    }
  );
}
