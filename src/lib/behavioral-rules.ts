/**
 * Behavioral Rules — Real Learning Pipeline from CEO Corrections
 *
 * This module closes the loop: corrections stored in brain.decision_log
 * are analyzed, clustered, and synthesized into permanent behavioral rules
 * stored in brain.behavioral_rules. These rules are injected into every
 * classifier prompt, actually changing how the brain classifies future content.
 *
 * Flow:
 *   CEO corrects card -> decision_log row (ceo_override=true)
 *   -> synthesizeRules() clusters corrections, calls Claude to generate rules
 *   -> brain.behavioral_rules row (active=true)
 *   -> loadActiveRules() reads them at classification time
 *   -> buildBehavioralRulesPromptSection() formats for prompt injection
 *   -> gmail-scanner/slack-scanner uses them in system prompt
 *
 * Corrections are ephemeral. Rules are permanent and change behavior.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BehavioralRule {
  id: string;
  rule_type: string;
  category: string | null;
  rule_text: string;
  source_corrections: unknown[];
  confidence: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface CorrectionRow {
  id: string;
  ceo_correction: string;
  decision: string;
  input_summary: string;
  outcome: string;
  created_at: string;
}

interface CorrectionCluster {
  key: string;
  rule_type: "category_change" | "priority_change" | "suppress" | "custom";
  corrections: Array<{
    id: string;
    ceo_correction: string;
    input_summary: string;
    created_at: string;
  }>;
  from_value: string;
  to_value: string;
}

// Minimum corrections before a rule is synthesized
const PATTERN_THRESHOLD = 3;

// ─── Pattern Detection ──────────────────────────────────────────────────────

/**
 * Parse a ceo_correction string to extract the pattern type and values.
 */
function parseCorrection(correction: string): {
  rule_type: "category_change" | "priority_change" | "suppress";
  from_value: string;
  to_value: string;
  pattern_key: string;
} | null {
  // Category change: 'Category changed from "X" to "Y"'
  const catMatch = correction.match(
    /Category changed from "([^"]+)" to "([^"]+)"/
  );
  if (catMatch) {
    return {
      rule_type: "category_change",
      from_value: catMatch[1],
      to_value: catMatch[2],
      pattern_key: `category:${catMatch[1]}→${catMatch[2]}`,
    };
  }

  // Priority change: 'Priority changed from "X" to "Y"'
  const priMatch = correction.match(
    /Priority changed from "([^"]+)" to "([^"]+)"/
  );
  if (priMatch) {
    return {
      rule_type: "priority_change",
      from_value: priMatch[1],
      to_value: priMatch[2],
      pattern_key: `priority:${priMatch[1]}→${priMatch[2]}`,
    };
  }

  // Suppress: 'Card should not have been created. Suppress: source_type="X", category="Y"'
  const suppMatch = correction.match(
    /Suppress: source_type="([^"]+)", category="([^"]+)"/
  );
  if (suppMatch) {
    return {
      rule_type: "suppress",
      from_value: suppMatch[1],
      to_value: suppMatch[2],
      pattern_key: `suppress:${suppMatch[1]}+${suppMatch[2]}`,
    };
  }

  return null;
}

/**
 * Cluster corrections by pattern. Returns clusters that meet the threshold.
 */
function clusterCorrections(corrections: CorrectionRow[]): CorrectionCluster[] {
  const groups = new Map<string, CorrectionCluster>();

  for (const c of corrections) {
    const parsed = parseCorrection(c.ceo_correction);
    if (!parsed) continue;

    const existing = groups.get(parsed.pattern_key);
    if (existing) {
      existing.corrections.push({
        id: c.id,
        ceo_correction: c.ceo_correction,
        input_summary: c.input_summary,
        created_at: c.created_at,
      });
    } else {
      groups.set(parsed.pattern_key, {
        key: parsed.pattern_key,
        rule_type: parsed.rule_type,
        corrections: [
          {
            id: c.id,
            ceo_correction: c.ceo_correction,
            input_summary: c.input_summary,
            created_at: c.created_at,
          },
        ],
        from_value: parsed.from_value,
        to_value: parsed.to_value,
      });
    }
  }

  return Array.from(groups.values()).filter(
    (c) => c.corrections.length >= PATTERN_THRESHOLD
  );
}

// ─── Claude-Powered Rule Synthesis ──────────────────────────────────────────

/**
 * Use Claude to synthesize a nuanced behavioral rule from a cluster of corrections.
 * Falls back to template-based rules if Claude is unavailable.
 */
async function synthesizeRuleWithClaude(
  cluster: CorrectionCluster
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    // Fallback to template-based rule generation
    return generateTemplateRule(cluster);
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const correctionExamples = cluster.corrections
      .slice(0, 8)
      .map(
        (c, i) =>
          `${i + 1}. Correction: "${c.ceo_correction}"\n   Context: ${c.input_summary || "N/A"}`
      )
      .join("\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system:
        "You are a classification rule synthesizer for a business intelligence platform. " +
        "Given a cluster of CEO corrections, write ONE concise, actionable rule that a classifier should follow. " +
        "The rule should be specific enough to prevent the same mistakes but general enough to cover similar cases. " +
        "Output ONLY the rule text, no preamble. Start with an action verb (e.g., 'Classify...', 'Never...', 'Always...').",
      messages: [
        {
          role: "user",
          content:
            `The CEO has made ${cluster.corrections.length} corrections with this pattern:\n` +
            `Type: ${cluster.rule_type}\n` +
            `Pattern: ${cluster.from_value} → ${cluster.to_value}\n\n` +
            `Corrections:\n${correctionExamples}\n\n` +
            `Synthesize one clear behavioral rule the classifier must follow going forward.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (text.length > 0) {
      return text;
    }
  } catch (err) {
    console.warn(
      "[behavioral-rules] Claude synthesis failed, using template:",
      err instanceof Error ? err.message : String(err)
    );
  }

  return generateTemplateRule(cluster);
}

/**
 * Template-based fallback for rule generation (no Claude needed).
 */
function generateTemplateRule(cluster: CorrectionCluster): string {
  const count = cluster.corrections.length;
  switch (cluster.rule_type) {
    case "category_change":
      return (
        `Classify content that would be categorized as "${cluster.from_value}" ` +
        `as "${cluster.to_value}" instead. ` +
        `The CEO has corrected this ${count} times — this is a confirmed preference.`
      );

    case "priority_change":
      return (
        `Assign "${cluster.to_value}" priority (not "${cluster.from_value}") to content of this type. ` +
        `The CEO has corrected this ${count} times — this is a confirmed preference.`
      );

    case "suppress":
      return (
        `Do NOT create feed cards for content from source "${cluster.from_value}" ` +
        `with category "${cluster.to_value}". The CEO has rejected these ${count} times. ` +
        `Suppress entirely.`
      );

    default:
      return `Apply correction pattern "${cluster.key}" (${count} CEO corrections confirm this preference).`;
  }
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Synthesize behavioral rules from accumulated CEO corrections.
 *
 * 1. Reads corrections from brain.decision_log (ceo_override = true)
 * 2. Clusters by pattern (category change, priority change, suppress)
 * 3. For new clusters meeting threshold, uses Claude to generate a nuanced rule
 * 4. Writes to brain.behavioral_rules (dedicated table)
 * 5. Returns count of new/updated rules
 *
 * Called from /api/brain/learn every 5th correction.
 */
export async function synthesizeRules(
  sb: SupabaseClient
): Promise<number> {
  console.log("[behavioral-rules] Starting rule synthesis...");

  // 1. Load all corrections
  const { data: corrections, error: corrError } = await sb
    .schema("brain")
    .from("decision_log")
    .select("id, ceo_correction, decision, input_summary, outcome, created_at")
    .eq("ceo_override", true)
    .not("ceo_correction", "is", null)
    .order("created_at", { ascending: false });

  if (corrError) {
    console.error("[behavioral-rules] Error loading corrections:", corrError.message);
    return 0;
  }

  if (!corrections || corrections.length === 0) {
    console.log("[behavioral-rules] No corrections found");
    return 0;
  }

  console.log(`[behavioral-rules] Found ${corrections.length} corrections to analyze`);

  // 2. Cluster corrections by pattern
  const clusters = clusterCorrections(corrections as CorrectionRow[]);
  if (clusters.length === 0) {
    console.log("[behavioral-rules] No clusters meeting threshold");
    return 0;
  }

  console.log(`[behavioral-rules] ${clusters.length} cluster(s) meet threshold`);

  // 3. Load existing rules to avoid duplicates
  const { data: existingRules, error: rulesError } = await sb
    .schema("brain")
    .from("behavioral_rules")
    .select("id, rule_type, category, rule_text, source_corrections, confidence, active")
    .eq("active", true);

  if (rulesError) {
    // Table might not exist yet — fall back to instructions table
    console.warn(
      "[behavioral-rules] behavioral_rules table not found, trying instructions fallback:",
      rulesError.message
    );
    return synthesizeRulesLegacy(sb, clusters);
  }

  const existingByKey = new Map<string, BehavioralRule>();
  for (const rule of (existingRules ?? []) as BehavioralRule[]) {
    // Build a key from rule_type + category for dedup
    const key = `${rule.rule_type}:${rule.category || ""}`;
    existingByKey.set(key, rule);
  }

  // 4. Process each cluster
  let created = 0;
  let updated = 0;

  for (const cluster of clusters) {
    const dedup_key = `${cluster.rule_type}:${cluster.from_value}`;
    const existing = existingByKey.get(dedup_key);

    // Build source_corrections metadata
    const sourceCorrections = cluster.corrections.slice(0, 10).map((c) => ({
      correction_id: c.id,
      ceo_correction: c.ceo_correction,
      created_at: c.created_at,
    }));

    // Calculate confidence based on correction count
    const confidence = Math.min(0.5 + cluster.corrections.length * 0.1, 1.0);

    if (existing) {
      // Update existing rule: refresh the rule text and bump confidence
      const ruleText = await synthesizeRuleWithClaude(cluster);

      const { error: updateError } = await sb
        .schema("brain")
        .from("behavioral_rules")
        .update({
          rule_text: ruleText,
          source_corrections: sourceCorrections,
          confidence,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error(
          `[behavioral-rules] Error updating rule ${existing.id}:`,
          updateError.message
        );
      } else {
        updated += 1;
        console.log(
          `[behavioral-rules] Updated rule: ${cluster.key} (${cluster.corrections.length} corrections, confidence=${confidence})`
        );
      }
    } else {
      // Create new rule
      const ruleText = await synthesizeRuleWithClaude(cluster);

      const { error: insertError } = await sb
        .schema("brain")
        .from("behavioral_rules")
        .insert({
          rule_type: cluster.rule_type,
          category: cluster.from_value,
          rule_text: ruleText,
          source_corrections: sourceCorrections,
          confidence,
          active: true,
        });

      if (insertError) {
        console.error(
          `[behavioral-rules] Error inserting rule for ${cluster.key}:`,
          insertError.message
        );
      } else {
        created += 1;
        console.log(
          `[behavioral-rules] New rule created: ${cluster.key} (${cluster.corrections.length} corrections, confidence=${confidence})`
        );
      }
    }
  }

  const total = created + updated;
  if (total > 0) {
    console.log(
      `[behavioral-rules] Synthesis complete: ${created} created, ${updated} updated from ${corrections.length} corrections`
    );
  }

  return total;
}

/**
 * Legacy fallback: write to brain.instructions if behavioral_rules table doesn't exist yet.
 * This preserves backward compatibility during migration.
 */
async function synthesizeRulesLegacy(
  sb: SupabaseClient,
  clusters: CorrectionCluster[]
): Promise<number> {
  let created = 0;

  for (const cluster of clusters) {
    const ruleText = generateTemplateRule(cluster);

    // Check for existing rule in instructions
    const { data: existing } = await sb
      .schema("brain")
      .from("instructions")
      .select("id")
      .eq("type", "behavioral_rule")
      .eq("status", "active")
      .like("prompt", `%${cluster.from_value}%`)
      .like("prompt", `%${cluster.to_value}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing
      await sb
        .schema("brain")
        .from("instructions")
        .update({ prompt: ruleText })
        .eq("id", existing[0].id);
    } else {
      // Insert new
      const { error } = await sb
        .schema("brain")
        .from("instructions")
        .insert({
          type: "behavioral_rule",
          prompt: ruleText,
          status: "active",
          recurrence: "on_scan",
          execution_count: 0,
          metadata: {
            pattern_key: cluster.key,
            rule_type: cluster.rule_type,
            from_value: cluster.from_value,
            to_value: cluster.to_value,
            occurrences: cluster.corrections.length,
            synthesized_at: new Date().toISOString(),
          },
        });

      if (!error) created += 1;
    }
  }

  return created;
}

// ─── Backward-compatible alias ──────────────────────────────────────────────

/** @deprecated Use synthesizeRules() instead */
export const synthesizeRulesFromCorrections = synthesizeRules;

// ─── Load Active Rules ──────────────────────────────────────────────────────

/**
 * Load all active behavioral rules from brain.behavioral_rules.
 * Falls back to brain.instructions if the new table doesn't exist yet.
 *
 * Returns rules in the shape expected by buildBehavioralRulesPromptSection().
 */
export async function loadActiveRules(
  sb: SupabaseClient
): Promise<BehavioralRule[]> {
  // Try the dedicated table first
  const { data, error } = await sb
    .schema("brain")
    .from("behavioral_rules")
    .select("id, rule_type, category, rule_text, source_corrections, confidence, active, created_at, updated_at")
    .eq("active", true)
    .order("confidence", { ascending: false });

  if (!error && data && data.length > 0) {
    return data as BehavioralRule[];
  }

  if (error) {
    console.warn(
      "[behavioral-rules] behavioral_rules table not available, falling back to instructions:",
      error.message
    );
  }

  // Fallback: load from instructions table (legacy)
  return loadBehavioralRulesFromInstructions(sb);
}

/**
 * Legacy loader: read behavioral rules from brain.instructions.
 * Used as fallback before the behavioral_rules table is created.
 */
async function loadBehavioralRulesFromInstructions(
  sb: SupabaseClient
): Promise<BehavioralRule[]> {
  const { data, error } = await sb
    .schema("brain")
    .from("instructions")
    .select("id, prompt, metadata, status")
    .eq("status", "active")
    .eq("type", "behavioral_rule")
    .eq("recurrence", "on_scan");

  if (error || !data) return [];

  // Map to BehavioralRule shape
  return data.map((row: { id: string; prompt: string; metadata?: Record<string, unknown>; status: string }) => ({
    id: row.id,
    rule_type: (row.metadata?.rule_type as string) || "custom",
    category: (row.metadata?.from_value as string) || null,
    rule_text: row.prompt,
    source_corrections: (row.metadata?.sample_corrections as unknown[]) || [],
    confidence: 0.7,
    active: true,
    created_at: "",
    updated_at: "",
  }));
}

/**
 * Backward-compatible loader that returns Instruction-shaped objects.
 * Used by gmail-scanner.ts which imports this function.
 */
export async function loadBehavioralRules(
  sb: SupabaseClient
): Promise<Array<{ id: string; type: string; prompt: string; source_kb_ids: string[] | null; source_entity_ids: string[] | null; taxonomy_categories: string[] | null; recurrence: string | null; status: string; execution_count: number }>> {
  const rules = await loadActiveRules(sb);

  // Map to Instruction shape for backward compat
  return rules.map((r) => ({
    id: r.id,
    type: "behavioral_rule",
    prompt: r.rule_text,
    source_kb_ids: null,
    source_entity_ids: null,
    taxonomy_categories: r.category ? [r.category] : null,
    recurrence: "on_scan",
    status: r.active ? "active" : "inactive",
    execution_count: 0,
  }));
}

// ─── Prompt Section Builder ─────────────────────────────────────────────────

/**
 * Build a prompt section from behavioral rules for injection into
 * the classifier system prompt.
 *
 * Accepts either BehavioralRule[] or Instruction-shaped objects.
 */
export function buildBehavioralRulesPromptSection(
  rules: Array<{ prompt?: string; rule_text?: string; confidence?: number }>
): string {
  if (rules.length === 0) return "";

  const lines: string[] = [];
  lines.push("\n## PERMANENT BEHAVIORAL RULES");
  lines.push(
    "The following rules were synthesized from repeated CEO corrections. " +
    "These are PERMANENT and override all other classification logic:\n"
  );

  for (const rule of rules) {
    const text = rule.rule_text || rule.prompt || "";
    const conf = rule.confidence ? ` [confidence: ${(rule.confidence * 100).toFixed(0)}%]` : "";
    lines.push(`• ${text}${conf}`);
  }

  lines.push(
    "\nThese rules are non-negotiable. They represent confirmed CEO preferences " +
    "established through multiple corrections. Always apply them.\n"
  );

  return lines.join("\n");
}
