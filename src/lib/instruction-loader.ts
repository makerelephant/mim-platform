/**
 * Instruction Loader
 *
 * Loads active instructions from brain.instructions table and formats them
 * for injection into scanner classifier prompts and report generation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Instruction {
  id: string;
  type: string;
  prompt: string;
  source_kb_ids: string[] | null;
  source_entity_ids: string[] | null;
  taxonomy_categories: string[] | null;
  recurrence: string | null;
  status: string;
  execution_count: number;
}

/**
 * Load active standing orders for scanner injection.
 * These get injected into the classifier prompt so Claude considers
 * the CEO's persistent instructions when classifying messages.
 */
export async function loadStandingOrders(sb: SupabaseClient): Promise<Instruction[]> {
  const { data, error } = await sb.schema("brain").from("instructions")
    .select("id, type, prompt, source_kb_ids, source_entity_ids, taxonomy_categories, recurrence, status, execution_count")
    .eq("status", "active")
    .eq("type", "standing_order")
    .eq("recurrence", "on_scan");

  if (error) {
    console.error("[instruction-loader] Error loading standing orders:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Load active report instructions (report_inclusion + entity_watch).
 * These get pulled by the report generator to add strategic context
 * and entity watch sections.
 */
export async function loadReportInstructions(sb: SupabaseClient): Promise<Instruction[]> {
  const { data, error } = await sb.schema("brain").from("instructions")
    .select("id, type, prompt, source_kb_ids, source_entity_ids, taxonomy_categories, recurrence, status, execution_count")
    .eq("status", "active")
    .in("type", ["report_inclusion", "entity_watch"]);

  if (error) {
    console.error("[instruction-loader] Error loading report instructions:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Build a prompt section from standing orders for injection into
 * the classifier system prompt.
 */
export function buildStandingOrdersPromptSection(orders: Instruction[]): string {
  if (orders.length === 0) return "";

  const lines: string[] = [];
  lines.push("\n## CEO STANDING ORDERS");
  lines.push("The following are persistent instructions from the CEO. Apply these rules when classifying messages:\n");

  for (const order of orders) {
    lines.push(`• ${order.prompt}`);
  }

  lines.push("\nThese standing orders override default classification behavior where applicable. If a standing order conflicts with normal priority rules, the standing order takes precedence.\n");

  return lines.join("\n");
}

/**
 * Mark an instruction as executed (increment count, set last_executed_at).
 * For one-time instructions (recurrence='once'), also mark as 'fulfilled'.
 */
export async function markInstructionExecuted(
  sb: SupabaseClient,
  instructionId: string,
  recurrence: string | null,
  result?: Record<string, unknown>,
): Promise<void> {
  const updates: Record<string, unknown> = {
    last_executed_at: new Date().toISOString(),
    execution_count: undefined, // will use raw SQL increment
  };

  if (recurrence === "once") {
    updates.status = "fulfilled";
  }

  if (result) {
    updates.execution_result = result;
  }

  // Increment execution_count
  // Supabase doesn't support atomic increment easily, so we do two steps
  const { data: current } = await sb.schema("brain").from("instructions")
    .select("execution_count")
    .eq("id", instructionId)
    .single();

  const newCount = (current?.execution_count ?? 0) + 1;

  await sb.schema("brain").from("instructions").update({
    last_executed_at: new Date().toISOString(),
    execution_count: newCount,
    ...(recurrence === "once" ? { status: "fulfilled" } : {}),
    ...(result ? { execution_result: result } : {}),
  }).eq("id", instructionId);
}
