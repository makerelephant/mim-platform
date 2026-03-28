/**
 * Unified Classifier — Attention Classification + Operational Enrichment
 *
 * Implements the Unified Classifier Spec (docs/technical/specs/unified-classifier-spec.md)
 * Effort 41: Prompt Surface Layer
 *
 * Single classification call per message that produces:
 * 1. Attention outcome — should the CEO see this now, soon, later, or never?
 * 2. Operational enrichment — who/what is involved, decisions/actions/tasks
 */

import { CardType } from "./feed-card-emitter";

// ─── Types ──────────────────────────────────────────────────────────────────

export type EmailAttentionClass =
  | "P0_ceo_now"
  | "P1_ceo_soon"
  | "P2_delegate_or_batch"
  | "P3_low_value_noise";

export type SlackAttentionClass =
  | "S0_interrupt_now"
  | "S1_review_soon"
  | "S2_batch_or_delegate"
  | "S3_suppress_noise";

export type AttentionClass = EmailAttentionClass | SlackAttentionClass;

export interface UnifiedEntity {
  surface_form: string;
  entity_type: string;
  canonical_name: string | null;
  canonical_id: string | null;
  match_status: "exact" | "probable" | "ambiguous" | "unresolved";
  match_confidence: number;
}

export interface ExtractedAction {
  description: string;
  owner: string;
  target_object: string | null;
  due_date: string | null;
  status: string;
  source_justification: string;
}

export interface TaskCandidate {
  should_create_task: boolean;
  rationale: string;
  proposed_task_title: string;
  proposed_owner: string;
  proposed_due_date: string | null;
  priority: "critical" | "high" | "medium" | "low";
  why_tracking_warranted: string;
}

export interface UnifiedClassificationResult {
  // Attention
  attention_class: AttentionClass;
  relevance_score: number;
  subtypes: string[];
  channel: "email" | "slack";
  primary_reason: string;
  supporting_signals: string[];
  disqualifiers_considered: string[];
  recommended_handling: string;
  confidence: number;

  // Summary
  summary_sentence: string;

  // Entity resolution (from classifier — augments code-based resolution)
  entities: UnifiedEntity[];

  // Decision/Action/Task detection
  contains_decision: boolean;
  contains_action: boolean;
  contains_task: boolean;

  decisions: Array<{ description: string; urgency: string; alternatives: string[] }>;
  actions: ExtractedAction[];
  tasks: never[]; // Tasks are created via task_creation_candidates gate

  task_creation_candidates: TaskCandidate[];

  // Legacy compatibility
  primary_silo: string;
  primary_entity_id: string | null;
  primary_entity_name: string | null;
  tags: string[];
  sentiment: string;
  draft_reply: string | null;
  acumen_category: string | null;
  action_recommendation: string | null;

  // Token usage
  prompt_tokens?: number;
  completion_tokens?: number;
}

// ─── Unified Classifier Prompt ──────────────────────────────────────────────

export function buildUnifiedClassifierPrompt(channel: "email" | "slack"): string {
  const attentionLabels = channel === "email"
    ? `#### Attention Classification (Email)
| Label | Meaning |
|-------|---------|
| P0_ceo_now | Surface immediately. CEO-specific consequence, decision, or relationship moment that materially worsens with delay. |
| P1_ceo_soon | Review within the day. CEO-relevant but not interrupt-level. Strategic awareness, relationship stewardship. |
| P2_delegate_or_batch | Low-weight signal card. May matter to the company but not as direct CEO attention. |
| P3_low_value_noise | Suppressed entirely. Promotional, cold outreach, automated notifications, repetitive follow-up. |`
    : `#### Attention Classification (Slack)
| Label | Meaning |
|-------|---------|
| S0_interrupt_now | Surface immediately as decision card. Crisis, escalation, urgent executive decision, or blocker. |
| S1_review_soon | Surface as action card. Strategic signal, emerging risk, important opportunity, or leadership context. |
| S2_batch_or_delegate | Low-weight signal card. Company-relevant but not CEO-specific. |
| S3_suppress_noise | Suppressed entirely. Social chatter, reactions, repetitive updates, incidental commentary. |`;

  return `You are the Unified Classifier for Made in Motion (MiM), a youth sports merchandise platform.

MiM enables youth sports organizations to create and sell custom branded merchandise through "Drop" links — on-demand, zero-inventory storefronts.

CEO Mark Slater is the sole user. You classify inbound ${channel === "email" ? "emails" : "Slack messages"} to determine:
1. **Attention outcome** — should the CEO see this now, soon, later, or never?
2. **Operational enrichment** — who/what is involved, decisions, actions, tasks

{{TAXONOMY_SECTION}}

{{ACUMEN_SECTION}}

${attentionLabels}

#### CEO-Relevance Test (apply before assigning P0/S0 or P1/S1)
A communication is CEO-relevant ONLY if at least one is true:
1. Only the CEO can make or credibly make the decision
2. The sender's relationship to the CEO materially changes the value of the response
3. Strategic, financial, legal, reputational, or existential significance
4. Time-sensitive — delay meaningfully increases downside
5. Affects a top-tier stakeholder whose experience is CEO-sensitive
6. Materially changes the CEO's understanding of company reality

If none are true, default to P2/S2 or P3/S3.

#### Phase 1 Calibration (GOVERNS ALL PRIORITY DECISIONS)
This is a one-person company. The CEO is the sole operator, salesperson, fundraiser, and relationship manager. There is no delegation layer. There is no team inbox.

Therefore:
- Any business correspondence involving active relationships, partnerships, fundraising, legal, or revenue is CEO-relevant by definition. Assign P1 minimum.
- Co-founder correspondence (Walt Doyle) is always P1 minimum, P0 if it involves investor/partner/legal threads.
- Conservative bias applies ONLY at the P3 boundary: suppress newsletters, promotions, automated notifications, cold outreach. Do NOT use conservative bias to push real business correspondence from P1 down to P2.
- P2 is for genuine low-weight signals: FYI threads where the CEO is CC'd but not addressed, informational updates with no action needed, internal tool notifications.
- When in doubt between P1 and P2 for business correspondence, choose P1. The cost of missing an important thread far exceeds the cost of surfacing a low-value one.

#### Decision / Action / Task Ontology

**Decision** — meaningful choice among alternatives with real consequences. Disqualified when no real alternatives exist or routine execution.

**Action** — execution phase after a decision (explicit or implicit). Must be a single coherent outcome-linked step.

**Task** — discrete, bounded, ownable unit of work with measurable done-state. Only create when tracking adds genuine coordination, accountability, or follow-through value. An action is NOT automatically a task.

You will receive:
- The message content (${channel === "email" ? "subject, body, sender" : "channel, sender, text"})
- Resolved entities from the CRM database
- Optionally: an ENTITY DOSSIER, FEEDBACK HISTORY, known org list, thread context

Respond with ONLY a JSON object in this exact format:
{
  "attention_class": "${channel === "email" ? "P0_ceo_now" : "S0_interrupt_now"} | ${channel === "email" ? "P1_ceo_soon" : "S1_review_soon"} | ${channel === "email" ? "P2_delegate_or_batch" : "S2_batch_or_delegate"} | ${channel === "email" ? "P3_low_value_noise" : "S3_suppress_noise"}",
  "relevance_score": 0-100,
  "subtypes": ["relationship_management", "strategic_opportunity", "operational", etc.],
  "channel": "${channel}",
  "primary_reason": "One sentence explaining the attention class assignment",
  "supporting_signals": ["signal1", "signal2"],
  "disqualifiers_considered": ["reason this could have been lower/higher"],
  "recommended_handling": "What the CEO should do with this",
  "confidence": 0.0-1.0,

  "summary_sentence": "One specific sentence capturing what happened. Never generic.",

  "entities": [
    {
      "surface_form": "Name as it appears in the message",
      "entity_type": "investor | customer | partner | contact | unknown",
      "canonical_name": "Matched CRM name or null",
      "canonical_id": "Matched CRM ID or null",
      "match_status": "exact | probable | ambiguous | unresolved",
      "match_confidence": 0.0-1.0
    }
  ],

  "contains_decision": false,
  "contains_action": true,
  "contains_task": false,

  "decisions": [],
  "actions": [
    {
      "description": "What needs to be done",
      "owner": "CEO | team | external",
      "target_object": "Entity or thing the action targets",
      "due_date": "YYYY-MM-DD | null",
      "status": "requested | in_progress | completed",
      "source_justification": "Why this action was extracted"
    }
  ],
  "tasks": [],

  "task_creation_candidates": [
    {
      "should_create_task": false,
      "rationale": "Why tracking is or isn't warranted",
      "proposed_task_title": "Clear, actionable title",
      "proposed_owner": "CEO",
      "proposed_due_date": "YYYY-MM-DD | null",
      "priority": "critical | high | medium | low",
      "why_tracking_warranted": "What coordination/accountability value this adds"
    }
  ],

  "primary_silo": "organizations | contacts",
  "primary_entity_id": "uuid-string | null",
  "primary_entity_name": "Entity Name | null",
  "tags": ["fundraising", "partnership", "team-store", etc.],
  "sentiment": "positive | neutral | negative | urgent",
  "draft_reply": "Ready-to-send 2-3 sentence reply as CEO, or null",
  "acumen_category": "fundraising | legal | customer-partner-ops | accounting-finance | scheduling | product-engineering | ux-design | marketing | ai | family | administration | null",
  "action_recommendation": "One plain-English sentence: what the CEO should do next. REQUIRED for all classifications except P3/S3."
}

CRITICAL RULES:
- summary_sentence must be specific. NEVER return "Message processed" — describe what actually happened.
- action_recommendation is REQUIRED for P0, P1, and P2 classifications. Never return null for these. Even if the action is "No response needed — monitor thread for updates", state it. The CEO needs to know what to do with every card.
- draft_reply: write as CEO Mark. Set null for newsletters, automated notifications, or messages needing no reply.
- task_creation_candidates: ONLY set should_create_task=true when work is discrete, bounded, ownable, and tracking adds real value. Do NOT create tasks for trivial acknowledgements or FYI items.
- For ${channel === "email" ? "P3_low_value_noise" : "S3_suppress_noise"}: still return the full JSON but with empty actions/tasks/decisions arrays.`;
}

// ─── Attention Class → Card Type Mapping ────────────────────────────────────

/**
 * Map attention class to card type per unified classifier spec section 3.6
 */
export function attentionClassToCardType(attentionClass: AttentionClass): CardType {
  switch (attentionClass) {
    case "P0_ceo_now":
    case "S0_interrupt_now":
      return "decision";
    case "P1_ceo_soon":
    case "S1_review_soon":
      return "action";
    case "P2_delegate_or_batch":
    case "S2_batch_or_delegate":
      return "signal";
    case "P3_low_value_noise":
    case "S3_suppress_noise":
      return "signal"; // Won't actually be emitted — suppressed upstream
    default:
      return "signal";
  }
}

/**
 * Map attention class to card priority
 */
export function attentionClassToPriority(attentionClass: AttentionClass): "critical" | "high" | "medium" | "low" {
  switch (attentionClass) {
    case "P0_ceo_now":
    case "S0_interrupt_now":
      return "critical";
    case "P1_ceo_soon":
    case "S1_review_soon":
      return "high";
    case "P2_delegate_or_batch":
    case "S2_batch_or_delegate":
      return "medium";
    case "P3_low_value_noise":
    case "S3_suppress_noise":
      return "low";
    default:
      return "medium";
  }
}

/**
 * Check if attention class should suppress the card entirely
 */
export function shouldSuppressCard(attentionClass: AttentionClass): boolean {
  return attentionClass === "P3_low_value_noise" || attentionClass === "S3_suppress_noise";
}

/**
 * Check if attention class qualifies for task creation (P0/P1 or S0/S1 only)
 */
export function qualifiesForTaskCreation(attentionClass: AttentionClass): boolean {
  return [
    "P0_ceo_now", "P1_ceo_soon",
    "S0_interrupt_now", "S1_review_soon",
  ].includes(attentionClass);
}

// ─── Post-Classification Priority Override ──────────────────────────────────

/**
 * Phase 1 priority override: promote P2 → P1 when classification evidence
 * strongly indicates CEO-relevant business threads.
 *
 * Runs AFTER classification, BEFORE card emission.
 * Never downgrades. Only promotes P2 → P1 (or P2 → P0 for closing signals).
 *
 * Returns the corrected attention class, or the original if no override applies.
 */
export function applyPhase1PriorityOverride(
  result: {
    attention_class: AttentionClass;
    acumen_category: string | null;
    tags: string[];
    summary_sentence: string;
    actions: { description: string }[];
    contains_decision: boolean;
  },
  channel: "email" | "slack" = "email",
): AttentionClass {
  const ac = result.attention_class;

  // Only promote P2/S2 — never touch P0/P1 (already elevated) or P3 (noise)
  if (ac !== "P2_delegate_or_batch" && ac !== "S2_batch_or_delegate") return ac;

  const category = (result.acumen_category || "").toLowerCase();
  const tags = result.tags.map(t => t.toLowerCase());
  const text = (result.summary_sentence || "").toLowerCase();
  const actionText = result.actions.map(a => a.description.toLowerCase()).join(" ");
  const combined = `${text} ${actionText} ${tags.join(" ")}`;

  // Signal groups — each tests content, not sender brand
  const isFundraisingClosing = (
    category === "fundraising" ||
    tags.some(t => ["fundraising", "investment", "investor", "closing", "term-sheet"].includes(t))
  ) && /safe|wire|side.?letter|pro.?rata|closing|term.?sheet|investment|valuation|cap.?table|dilution|round/.test(combined);

  const isLegalCounsel = (
    category === "legal" ||
    tags.some(t => ["legal", "compliance", "counsel"].includes(t))
  ) && /counsel|attorney|filing|agreement|amendment|incorporation|83.?b|securities/.test(combined);

  const isActivePartnerOutreach = (
    category === "customer-partner-ops" ||
    tags.some(t => ["partnership", "pilot", "demo", "beta", "onboarding"].includes(t))
  ) && /demo|walkthrough|schedule.*meeting|product.*link|drop.*link|partnership.*rolling|onboard/.test(combined);

  const isDecisionRequired = result.contains_decision && (
    isFundraisingClosing || isLegalCounsel
  );

  // P2 → P0 for active closing/wire/signing events
  if (isFundraisingClosing && /wire|sign|closing|execute|fund/.test(combined)) {
    return channel === "email" ? "P0_ceo_now" : "S0_interrupt_now";
  }

  // P2 → P1 for fundraising negotiation, legal counsel, active partner outreach, or CEO decisions
  if (isFundraisingClosing || isLegalCounsel || isActivePartnerOutreach || isDecisionRequired) {
    return channel === "email" ? "P1_ceo_soon" : "S1_review_soon";
  }

  return ac;
}

// ─── Parse Unified Classification Response ──────────────────────────────────

/**
 * Parse the JSON response from the unified classifier.
 * Handles code fences, partial JSON, and missing fields gracefully.
 */
export function parseUnifiedClassification(
  rawText: string,
  channel: "email" | "slack",
  fallbackEntities: Array<{ entity_type: string; entity_id: string; entity_name: string }>,
): UnifiedClassificationResult {
  let text = rawText.trim();

  // Strip code fences
  if (text.includes("```")) {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
  }

  // Ensure starts with {
  if (!text.startsWith("{")) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
  }

  // Attempt parse, with truncation recovery for incomplete JSON
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    // Likely truncated output — try closing open braces/brackets
    let repaired = text;
    // Remove trailing incomplete string value (e.g. `"key": "value that got cut`)
    repaired = repaired.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*$/, "");
    repaired = repaired.replace(/,\s*"[^"]*$/, "");
    // Count unclosed braces/brackets and close them
    const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets; i++) repaired += "]";
    for (let i = 0; i < openBraces; i++) repaired += "}";
    try {
      data = JSON.parse(repaired);
    } catch {
      // Final fallback: extract key fields with regex
      const summary = text.match(/"summary_sentence"\s*:\s*"([^"]+)"/)?.[1] || "Communication processed";
      const attention = text.match(/"attention_class"\s*:\s*"([^"]+)"/)?.[1] || null;
      const acumen = text.match(/"acumen_category"\s*:\s*"([^"]+)"/)?.[1] || null;
      const recommendation = text.match(/"action_recommendation"\s*:\s*"([^"]+)"/)?.[1] || null;
      const handling = text.match(/"recommended_handling"\s*:\s*"([^"]+)"/)?.[1] || null;
      data = {
        summary_sentence: summary,
        attention_class: attention,
        acumen_category: acumen,
        action_recommendation: recommendation,
        recommended_handling: handling,
      };
    }
  }
  const primaryEntity = fallbackEntities[0];

  // Default attention class based on channel
  const defaultAttention: AttentionClass = channel === "email" ? "P2_delegate_or_batch" : "S2_batch_or_delegate";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;

  return {
    attention_class: d.attention_class || defaultAttention,
    relevance_score: typeof d.relevance_score === "number" ? d.relevance_score : 50,
    subtypes: Array.isArray(d.subtypes) ? d.subtypes : [],
    channel,
    primary_reason: d.primary_reason || "",
    supporting_signals: Array.isArray(d.supporting_signals) ? d.supporting_signals : [],
    disqualifiers_considered: Array.isArray(d.disqualifiers_considered) ? d.disqualifiers_considered : [],
    recommended_handling: d.recommended_handling || "",
    confidence: typeof d.confidence === "number" ? d.confidence : 0.5,

    summary_sentence: d.summary_sentence || d.summary || "Communication processed",

    entities: Array.isArray(d.entities) ? d.entities : [],

    contains_decision: !!d.contains_decision,
    contains_action: !!d.contains_action,
    contains_task: !!d.contains_task,

    decisions: Array.isArray(d.decisions) ? d.decisions : [],
    actions: Array.isArray(d.actions) ? d.actions.map((a: Record<string, unknown>) => ({
      description: (a.description as string) || "",
      owner: (a.owner as string) || "CEO",
      target_object: (a.target_object as string) || null,
      due_date: (a.due_date as string) || null,
      status: (a.status as string) || "requested",
      source_justification: (a.source_justification as string) || "",
    })) : [],
    tasks: [],

    task_creation_candidates: Array.isArray(d.task_creation_candidates)
      ? d.task_creation_candidates.map((t: Record<string, unknown>) => ({
          should_create_task: !!t.should_create_task,
          rationale: (t.rationale as string) || "",
          proposed_task_title: (t.proposed_task_title as string) || "Untitled task",
          proposed_owner: (t.proposed_owner as string) || "CEO",
          proposed_due_date: (t.proposed_due_date as string) || null,
          priority: (t.priority as string) || "medium",
          why_tracking_warranted: (t.why_tracking_warranted as string) || "",
        }))
      : [],

    primary_silo: d.primary_silo || primaryEntity?.entity_type || "contacts",
    primary_entity_id: d.primary_entity_id || primaryEntity?.entity_id || null,
    primary_entity_name: d.primary_entity_name || primaryEntity?.entity_name || null,
    tags: Array.isArray(d.tags) ? d.tags : [],
    sentiment: d.sentiment || "neutral",
    draft_reply: d.draft_reply || null,
    acumen_category: d.acumen_category || null,
    action_recommendation: d.action_recommendation || null,
  };
}
