/**
 * Behavioral Rules — Permanent Memory from CEO Corrections
 *
 * When the CEO corrects classifications 3+ times with the same pattern,
 * this module synthesizes a permanent behavioral rule and stores it in
 * brain.instructions so the brain never forgets.
 *
 * Corrections are ephemeral (sliding window of 30). Rules are permanent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Instruction } from "./instruction-loader";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CorrectionRow {
  id: string;
  ceo_correction: string;
  decision: string;
  input_summary: string;
  outcome: string;
  created_at: string;
}

interface CorrectionPattern {
  key: string;
  rule_type: "category_change" | "priority_change" | "suppress";
  occurrences: number;
  from_value: string;
  to_value: string;
  sample_corrections: string[];
}

// Minimum number of matching corrections before a permanent rule is created
const PATTERN_THRESHOLD = 3;

// ─── Pattern Detection ──────────────────────────────────────────────────────

/**
 * Parse a ceo_correction string to extract the pattern type and values.
 * Returns null if the string doesn't match a known pattern.
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
      from_value: suppMatch[1], // source_type
      to_value: suppMatch[2], // category
      pattern_key: `suppress:${suppMatch[1]}+${suppMatch[2]}`,
    };
  }

  return null;
}

/**
 * Group corrections by pattern and return patterns that meet the threshold.
 */
function detectPatterns(corrections: CorrectionRow[]): CorrectionPattern[] {
  const groups = new Map<string, CorrectionPattern>();

  for (const c of corrections) {
    const parsed = parseCorrection(c.ceo_correction);
    if (!parsed) continue;

    const existing = groups.get(parsed.pattern_key);
    if (existing) {
      existing.occurrences += 1;
      if (existing.sample_corrections.length < 5) {
        existing.sample_corrections.push(c.ceo_correction);
      }
    } else {
      groups.set(parsed.pattern_key, {
        key: parsed.pattern_key,
        rule_type: parsed.rule_type,
        occurrences: 1,
        from_value: parsed.from_value,
        to_value: parsed.to_value,
        sample_corrections: [c.ceo_correction],
      });
    }
  }

  // Only return patterns that meet the threshold
  return Array.from(groups.values()).filter(
    (p) => p.occurrences >= PATTERN_THRESHOLD
  );
}

/**
 * Generate a natural language rule prompt from a pattern.
 */
function generateRulePrompt(pattern: CorrectionPattern): string {
  switch (pattern.rule_type) {
    case "category_change":
      return (
        `PERMANENT RULE: When you encounter content that would be classified as "${pattern.from_value}", ` +
        `classify it as "${pattern.to_value}" instead. ` +
        `The CEO has corrected this ${pattern.occurrences} times. This is a definitive preference.`
      );

    case "priority_change":
      return (
        `PERMANENT RULE: Content currently assigned "${pattern.from_value}" priority should be ` +
        `"${pattern.to_value}" priority instead. ` +
        `The CEO has corrected this ${pattern.occurrences} times. This is a definitive preference.`
      );

    case "suppress":
      return (
        `PERMANENT RULE: Do NOT create feed cards for content from source "${pattern.from_value}" ` +
        `with category "${pattern.to_value}". The CEO has marked these as unwanted ${pattern.occurrences} times. ` +
        `Suppress this combination entirely.`
      );

    default:
      return `PERMANENT RULE: Correction pattern detected (${pattern.key}) with ${pattern.occurrences} occurrences.`;
  }
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Synthesize permanent behavioral rules from accumulated CEO corrections.
 *
 * 1. Reads all corrections from brain.decision_log where ceo_override = true
 * 2. Groups by pattern (same category change, priority change, or suppress)
 * 3. When a pattern has 3+ occurrences, generates a permanent rule
 * 4. Stores in brain.instructions as type 'behavioral_rule'
 *
 * Returns the number of new rules created.
 */
export async function synthesizeRulesFromCorrections(
  sb: SupabaseClient
): Promise<number> {
  // 1. Load all corrections
  const { data: corrections, error: corrError } = await sb
    .schema("brain")
    .from("decision_log")
    .select("id, ceo_correction, decision, input_summary, outcome, created_at")
    .eq("ceo_override", true)
    .order("created_at", { ascending: false });

  if (corrError) {
    console.error(
      "[behavioral-rules] Error loading corrections:",
      corrError.message
    );
    return 0;
  }

  if (!corrections || corrections.length === 0) return 0;

  // 2. Detect patterns that meet threshold
  const patterns = detectPatterns(corrections as CorrectionRow[]);
  if (patterns.length === 0) return 0;

  // 3. Load existing behavioral rules to avoid duplicates
  const { data: existingRules, error: rulesError } = await sb
    .schema("brain")
    .from("instructions")
    .select("prompt")
    .eq("type", "behavioral_rule")
    .eq("status", "active");

  if (rulesError) {
    console.error(
      "[behavioral-rules] Error loading existing rules:",
      rulesError.message
    );
    return 0;
  }

  const existingPrompts = new Set(
    (existingRules ?? []).map((r: { prompt: string }) => r.prompt)
  );

  // 4. Create new rules for patterns that don't already have one
  let created = 0;
  for (const pattern of patterns) {
    const prompt = generateRulePrompt(pattern);

    // Check if a rule with this exact prompt already exists
    if (existingPrompts.has(prompt)) continue;

    // Also check if there's already a rule for this pattern key
    // (the prompt text may differ if occurrences count changed)
    const { data: existingForKey } = await sb
      .schema("brain")
      .from("instructions")
      .select("id, prompt")
      .eq("type", "behavioral_rule")
      .eq("status", "active")
      .like("prompt", `%${pattern.from_value}%`);

    // For category/priority changes, check if we already have a rule
    // covering the same from→to transition
    let alreadyExists = false;
    if (existingForKey && existingForKey.length > 0) {
      for (const existing of existingForKey) {
        if (
          existing.prompt.includes(pattern.from_value) &&
          existing.prompt.includes(pattern.to_value)
        ) {
          // Update the occurrence count in the existing rule
          await sb
            .schema("brain")
            .from("instructions")
            .update({ prompt })
            .eq("id", existing.id);
          alreadyExists = true;
          break;
        }
      }
    }

    if (alreadyExists) continue;

    // Insert new behavioral rule
    const { error: insertError } = await sb
      .schema("brain")
      .from("instructions")
      .insert({
        type: "behavioral_rule",
        prompt,
        status: "active",
        recurrence: "on_scan",
        execution_count: 0,
        metadata: {
          pattern_key: pattern.key,
          rule_type: pattern.rule_type,
          from_value: pattern.from_value,
          to_value: pattern.to_value,
          occurrences: pattern.occurrences,
          sample_corrections: pattern.sample_corrections,
          synthesized_at: new Date().toISOString(),
        },
      });

    if (insertError) {
      console.error(
        `[behavioral-rules] Error inserting rule for pattern ${pattern.key}:`,
        insertError.message
      );
    } else {
      created += 1;
      console.log(
        `[behavioral-rules] New permanent rule created: ${pattern.key} (${pattern.occurrences} occurrences)`
      );
    }
  }

  if (created > 0) {
    console.log(
      `[behavioral-rules] Synthesized ${created} new behavioral rule(s) from ${corrections.length} corrections`
    );
  }

  return created;
}

/**
 * Load all active behavioral rules from brain.instructions.
 */
export async function loadBehavioralRules(
  sb: SupabaseClient
): Promise<Instruction[]> {
  const { data, error } = await sb
    .schema("brain")
    .from("instructions")
    .select(
      "id, type, prompt, source_kb_ids, source_entity_ids, taxonomy_categories, recurrence, status, execution_count"
    )
    .eq("status", "active")
    .eq("type", "behavioral_rule")
    .eq("recurrence", "on_scan");

  if (error) {
    console.error(
      "[behavioral-rules] Error loading behavioral rules:",
      error.message
    );
    return [];
  }
  return data ?? [];
}

/**
 * Build a prompt section from behavioral rules for injection into
 * the classifier system prompt.
 */
export function buildBehavioralRulesPromptSection(
  rules: Instruction[]
): string {
  if (rules.length === 0) return "";

  const lines: string[] = [];
  lines.push("\n## PERMANENT BEHAVIORAL RULES");
  lines.push(
    "The following rules were synthesized from repeated CEO corrections. These are PERMANENT and override all other classification logic:\n"
  );

  for (const rule of rules) {
    lines.push(`• ${rule.prompt}`);
  }

  lines.push(
    "\nThese rules are non-negotiable. They represent confirmed CEO preferences established through multiple corrections. Always apply them.\n"
  );

  return lines.join("\n");
}
