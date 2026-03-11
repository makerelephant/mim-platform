/**
 * Instruction tools for MiM MCP Server
 *
 * create_instruction — CEO gives brain a command (standing order, report inclusion, etc.)
 * list_instructions  — Show active/pending instructions
 * update_instruction — Modify, pause, or cancel an instruction
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const INSTRUCTION_TYPES = [
  "report_inclusion",  // "Include X in next report"
  "standing_order",    // "Always flag emails about Y as critical"
  "one_time_query",    // "Summarize everything about Z"
  "scheduled_action",  // "Remind me about X next Monday"
  "entity_watch",      // "Track all activity related to Adidas"
] as const;

const INSTRUCTION_STATUSES = [
  "active", "fulfilled", "paused", "expired", "cancelled",
] as const;

export function registerInstructionTools(server: McpServer) {

  // ── create_instruction ──
  server.tool(
    "create_instruction",
    `Create a persistent brain instruction. Types:
- report_inclusion: "Include X in next report" — gets pulled into report generation
- standing_order: "Always flag emails about Y as critical" — injected into scanner classifier
- one_time_query: "Summarize everything about Z" — fulfilled once then marked done
- scheduled_action: "Remind me about X next Monday" — triggered at execute_at time
- entity_watch: "Track all activity related to Adidas" — adds entity watch section to reports`,
    {
      type: z.enum(INSTRUCTION_TYPES).describe("Instruction type"),
      prompt: z.string().describe("The instruction in natural language"),
      source_kb_ids: z.array(z.string()).optional().describe("Knowledge base entry UUIDs this relates to"),
      source_entity_ids: z.array(z.string()).optional().describe("Org/contact UUIDs this relates to"),
      taxonomy_categories: z.array(z.string()).optional().describe("Taxonomy categories this applies to (e.g., fundraising, partnerships)"),
      recurrence: z.enum(["once", "weekly", "on_report", "on_scan"]).optional().describe("When to execute: once, weekly, on_report, on_scan"),
      execute_at: z.string().optional().describe("For scheduled_action: when to trigger (ISO datetime)"),
      expires_at: z.string().optional().describe("Auto-expire after this date (ISO datetime)"),
    },
    async ({ type, prompt, source_kb_ids, source_entity_ids, taxonomy_categories, recurrence, execute_at, expires_at }) => {
      const { data: instruction, error } = await supabase.schema("brain").from("instructions").insert({
        type,
        prompt,
        source_kb_ids: source_kb_ids ?? null,
        source_entity_ids: source_entity_ids ?? null,
        taxonomy_categories: taxonomy_categories ?? null,
        recurrence: recurrence ?? (type === "standing_order" ? "on_scan" : type === "report_inclusion" ? "on_report" : "once"),
        execute_at: execute_at ?? null,
        expires_at: expires_at ?? null,
        status: "active",
      }).select("id, type, prompt, status, recurrence").single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return {
        content: [{
          type: "text" as const,
          text: `Created ${instruction.type} instruction (id: ${instruction.id}):\n"${instruction.prompt}"\nStatus: ${instruction.status} | Recurrence: ${instruction.recurrence}`,
        }],
      };
    }
  );

  // ── list_instructions ──
  server.tool(
    "list_instructions",
    "List brain instructions. Filter by type or status. Shows active standing orders, pending report inclusions, entity watches, etc.",
    {
      type: z.enum(INSTRUCTION_TYPES).optional().describe("Filter by type"),
      status: z.enum(INSTRUCTION_STATUSES).optional().default("active").describe("Filter by status (default: active)"),
      limit: z.number().optional().default(25).describe("Max results"),
    },
    async ({ type, status, limit }) => {
      let query = supabase.schema("brain").from("instructions")
        .select("id, type, prompt, status, recurrence, source_entity_ids, taxonomy_categories, execution_count, last_executed_at, created_at, expires_at")
        .order("created_at", { ascending: false })
        .limit(limit ?? 25);

      if (type) query = query.eq("type", type);
      if (status) query = query.eq("status", status);

      const { data: instructions, error } = await query;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!instructions || instructions.length === 0) {
        return { content: [{ type: "text" as const, text: `No ${status || ""} instructions found.` }] };
      }

      const lines = instructions.map((i: {
        id: string; type: string; prompt: string; status: string; recurrence: string | null;
        execution_count: number; last_executed_at: string | null; created_at: string; expires_at: string | null;
      }) => {
        const parts = [
          `[${i.type}/${i.status}]`,
          `"${i.prompt.slice(0, 120)}${i.prompt.length > 120 ? "..." : ""}"`,
        ];
        if (i.recurrence) parts.push(`(${i.recurrence})`);
        if (i.execution_count > 0) parts.push(`executed ${i.execution_count}x`);
        if (i.last_executed_at) parts.push(`last: ${i.last_executed_at}`);
        if (i.expires_at) parts.push(`expires: ${i.expires_at}`);
        parts.push(`(id: ${i.id})`);
        return `• ${parts.join(" ")}`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${instructions.length} instruction(s):\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // ── update_instruction ──
  server.tool(
    "update_instruction",
    "Update an instruction: modify the prompt, pause, cancel, or reactivate it.",
    {
      instruction_id: z.string().describe("Instruction UUID"),
      prompt: z.string().optional().describe("Updated prompt text"),
      status: z.enum(INSTRUCTION_STATUSES).optional().describe("New status: active, paused, cancelled, fulfilled"),
      recurrence: z.enum(["once", "weekly", "on_report", "on_scan"]).optional(),
      expires_at: z.string().optional().describe("New expiry date (ISO datetime)"),
    },
    async ({ instruction_id, prompt, status, recurrence, expires_at }) => {
      const updates: Record<string, unknown> = {};
      if (prompt !== undefined) updates.prompt = prompt;
      if (status !== undefined) updates.status = status;
      if (recurrence !== undefined) updates.recurrence = recurrence;
      if (expires_at !== undefined) updates.expires_at = expires_at;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update." }] };
      }

      const { error } = await supabase.schema("brain").from("instructions").update(updates).eq("id", instruction_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return { content: [{ type: "text" as const, text: `Updated instruction ${instruction_id}: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(", ")}` }] };
    }
  );
}
