/**
 * Adaptation Agent — Analyzes CEO corrections to propose behavioral rules.
 *
 * Reads brain.decision_log for systematic override patterns, proposes
 * behavioral rules, and auto-applies high-confidence ones. Rules get
 * loaded into scanner prompts to improve future classifications.
 *
 * Runs weekly via cron.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { emitFeedCard } from './feed-card-emitter';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdaptationResult {
  rules_proposed: number;
  rules_auto_applied: number;
  rules_for_review: number;
  error?: string;
}

interface ProposedRule {
  rule_type: 'classification' | 'priority' | 'routing' | 'entity';
  description: string;
  condition: Record<string, unknown>;
  action: Record<string, unknown>;
  confidence: number;
  sample_size: number;
  evidence_summary: string;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export async function runAdaptation(
  sb: SupabaseClient,
  anthropicKey: string,
  options: { days?: number; autoApplyThreshold?: number } = {},
): Promise<AdaptationResult> {
  const days = options.days ?? 30;
  const autoApplyThreshold = options.autoApplyThreshold ?? 0.85;
  const claude = new Anthropic({ apiKey: anthropicKey });
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Gather correction patterns ──
  const corrections = await gatherCorrectionPatterns(sb, since);

  if (corrections.length < 3) {
    return { rules_proposed: 0, rules_auto_applied: 0, rules_for_review: 0, error: 'Not enough corrections to analyze (need 3+)' };
  }

  // ── 2. Load existing active rules to avoid duplicates ──
  const { data: existingRules } = await sb
    .schema('brain')
    .from('behavioral_rules')
    .select('description, status')
    .in('status', ['active', 'proposed'])
    .limit(100);

  const existingDescriptions = new Set(
    (existingRules ?? []).map((r: { description: string }) => r.description.toLowerCase().trim()),
  );

  // ── 3. Analyze patterns with Claude ──
  const prompt = buildAdaptationPrompt(corrections, days);

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  const proposedRules = parseProposedRules(responseText);

  if (proposedRules.length === 0) {
    return { rules_proposed: 0, rules_auto_applied: 0, rules_for_review: 0, error: 'Claude found no actionable patterns' };
  }

  // ── 4. Store rules ──
  let autoApplied = 0;
  let forReview = 0;
  let proposed = 0;

  for (const rule of proposedRules) {
    // Skip duplicates
    if (existingDescriptions.has(rule.description.toLowerCase().trim())) continue;

    const isAutoApply = rule.confidence >= autoApplyThreshold && rule.sample_size >= 5;
    const status = isAutoApply ? 'active' : 'proposed';

    const { error } = await sb.schema('brain').from('behavioral_rules').insert({
      rule_type: rule.rule_type,
      description: rule.description,
      condition: rule.condition,
      action: rule.action,
      confidence: rule.confidence,
      sample_size: rule.sample_size,
      auto_applied: isAutoApply,
      status,
      activated_at: isAutoApply ? new Date().toISOString() : null,
    });

    if (error) {
      console.error('[adaptation-agent] Rule insert failed:', error.message);
      continue;
    }

    proposed++;
    if (isAutoApply) autoApplied++;
    else forReview++;
  }

  // ── 5. Emit reflection card ──
  if (proposed > 0) {
    const ruleDescriptions = proposedRules
      .slice(0, 5)
      .map((r) => `- ${r.description} (${r.confidence >= autoApplyThreshold ? 'auto-applied' : 'needs review'})`)
      .join('\n');

    await emitFeedCard(sb, {
      card_type: 'reflection',
      title: `Brain learning: ${proposed} new behavioral rule${proposed !== 1 ? 's' : ''} proposed`,
      body: `After analyzing ${corrections.length} CEO corrections over the last ${days} days, the brain identified:\n\n${ruleDescriptions}\n\n${autoApplied > 0 ? `${autoApplied} rule(s) auto-applied (high confidence).` : ''}${forReview > 0 ? ` ${forReview} rule(s) need your review.` : ''}`,
      source_type: 'adaptation',
      source_ref: `adaptation-${new Date().toISOString().slice(0, 10)}`,
      priority: forReview > 0 ? 'medium' : 'low',
      visibility_scope: 'personal',
      metadata: {
        rules_proposed: proposed,
        rules_auto_applied: autoApplied,
        rules_for_review: forReview,
        corrections_analyzed: corrections.length,
        period_days: days,
      },
    });
  }

  return { rules_proposed: proposed, rules_auto_applied: autoApplied, rules_for_review: forReview };
}

// ─── Data Gathering ─────────────────────────────────────────────────────────

interface CorrectionPattern {
  decision: string;
  ceo_correction: string;
  entity_type: string | null;
  created_at: string;
  input_summary: string | null;
}

async function gatherCorrectionPatterns(
  sb: SupabaseClient,
  since: string,
): Promise<CorrectionPattern[]> {
  const { data } = await sb
    .schema('brain')
    .from('decision_log')
    .select('decision, ceo_correction, entity_type, input_summary, created_at')
    .eq('ceo_override', true)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  return (data ?? []) as CorrectionPattern[];
}

// ─── Prompt Building ────────────────────────────────────────────────────────

function buildAdaptationPrompt(
  corrections: CorrectionPattern[],
  days: number,
): string {
  // Group corrections by common patterns
  const byCorrection: Record<string, CorrectionPattern[]> = {};
  for (const c of corrections) {
    const key = (c.ceo_correction || '').toLowerCase().trim();
    if (!byCorrection[key]) byCorrection[key] = [];
    byCorrection[key].push(c);
  }

  const patternLines = Object.entries(byCorrection)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 20)
    .map(([correction, items]) => {
      const examples = items.slice(0, 3).map((i) =>
        `    - Brain: "${(i.decision || '').slice(0, 80)}" → CEO: "${correction.slice(0, 80)}"`,
      );
      return `  Pattern (${items.length}x): "${correction.slice(0, 100)}"\n${examples.join('\n')}`;
    });

  return `You are MiM Brain's adaptation agent. Your job is to analyze CEO corrections and propose behavioral rules that the brain should follow in the future.

## CEO Corrections (Last ${days} Days)
Total: ${corrections.length} corrections

### Grouped Patterns (most frequent first)
${patternLines.join('\n\n')}

## Instructions

Analyze these correction patterns and propose behavioral rules. Each rule should be a clear instruction that can be injected into the classifier prompt to prevent the same mistakes.

Return a JSON array:

\`\`\`json
[
  {
    "rule_type": "classification|priority|routing|entity",
    "description": "Clear instruction for the classifier (e.g., 'Emails from .edu domains should be classified as customer-partner-ops, not administration')",
    "condition": {"field": "value"},
    "action": {"change": "value"},
    "confidence": 0.0-1.0,
    "sample_size": 5,
    "evidence_summary": "What pattern supports this rule"
  }
]
\`\`\`

Rules should be:
- **Specific** — not "be better at classification" but "emails mentioning 'rev-share' should be fundraising, not customer-partner-ops"
- **Evidenced** — at least 3 supporting corrections for high confidence
- **Actionable** — something the classifier can directly apply

Confidence guide:
- 0.9+: Clear, repeated pattern with 5+ examples
- 0.7-0.9: Clear pattern with 3-4 examples
- 0.5-0.7: Possible pattern, needs more data

Return ONLY the JSON array.`;
}

// ─── Response Parsing ───────────────────────────────────────────────────────

function parseProposedRules(responseText: string): ProposedRule[] {
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item: unknown): item is ProposedRule => {
        if (!item || typeof item !== 'object') return false;
        const obj = item as Record<string, unknown>;
        return (
          typeof obj.rule_type === 'string' &&
          typeof obj.description === 'string' &&
          typeof obj.confidence === 'number'
        );
      },
    ).map((item) => ({
      ...item,
      condition: item.condition && typeof item.condition === 'object' ? item.condition : {},
      action: item.action && typeof item.action === 'object' ? item.action : {},
      sample_size: typeof item.sample_size === 'number' ? item.sample_size : 0,
      evidence_summary: typeof item.evidence_summary === 'string' ? item.evidence_summary : '',
    }));
  } catch {
    console.error('[adaptation-agent] Failed to parse rules from Claude response');
    return [];
  }
}
