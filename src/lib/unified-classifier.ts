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

#### Conservative Bias
False positives destroy executive attention. False negatives can be partially recovered via digests.
Do not elevate on weak evidence. Require genuine CEO-specific relevance for P0/S0 and P1/S1.

**Early-stage note:** The CEO is currently also the operator, salesperson, and relationship manager. P2/S2 items should still surface as signal cards. The conservative bias applies at the P3/S3 boundary.

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
  "action_recommendation": "Recommended action: [specific 1-2 sentence recommendation] | null"
}

CRITICAL RULES:
- summary_sentence must be specific. NEVER return "Message processed" — describe what actually happened.
- If the message requires a decision or action from the CEO, provide action_recommendation.
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

  const data = JSON.parse(text);
  const primaryEntity = fallbackEntities[0];

  // Default attention class based on channel
  const defaultAttention = channel === "email" ? "P2_delegate_or_batch" : "S2_batch_or_delegate";

  return {
    attention_class: data.attention_class || defaultAttention,
    relevance_score: typeof data.relevance_score === "number" ? data.relevance_score : 50,
    subtypes: Array.isArray(data.subtypes) ? data.subtypes : [],
    channel,
    primary_reason: data.primary_reason || "",
    supporting_signals: Array.isArray(data.supporting_signals) ? data.supporting_signals : [],
    disqualifiers_considered: Array.isArray(data.disqualifiers_considered) ? data.disqualifiers_considered : [],
    recommended_handling: data.recommended_handling || "",
    confidence: typeof data.confidence === "number" ? data.confidence : 0.5,

    summary_sentence: data.summary_sentence || data.summary || "Communication processed",

    entities: Array.isArray(data.entities) ? data.entities : [],

    contains_decision: !!data.contains_decision,
    contains_action: !!data.contains_action,
    contains_task: !!data.contains_task,

    decisions: Array.isArray(data.decisions) ? data.decisions : [],
    actions: Array.isArray(data.actions) ? data.actions.map((a: Record<string, unknown>) => ({
      description: (a.description as string) || "",
      owner: (a.owner as string) || "CEO",
      target_object: (a.target_object as string) || null,
      due_date: (a.due_date as string) || null,
      status: (a.status as string) || "requested",
      source_justification: (a.source_justification as string) || "",
    })) : [],
    tasks: [],

    task_creation_candidates: Array.isArray(data.task_creation_candidates)
      ? data.task_creation_candidates.map((t: Record<string, unknown>) => ({
          should_create_task: !!t.should_create_task,
          rationale: (t.rationale as string) || "",
          proposed_task_title: (t.proposed_task_title as string) || "Untitled task",
          proposed_owner: (t.proposed_owner as string) || "CEO",
          proposed_due_date: (t.proposed_due_date as string) || null,
          priority: (t.priority as string) || "medium",
          why_tracking_warranted: (t.why_tracking_warranted as string) || "",
        }))
      : [],

    primary_silo: data.primary_silo || primaryEntity?.entity_type || "contacts",
    primary_entity_id: data.primary_entity_id || primaryEntity?.entity_id || null,
    primary_entity_name: data.primary_entity_name || primaryEntity?.entity_name || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    sentiment: data.sentiment || "neutral",
    draft_reply: data.draft_reply || null,
    acumen_category: data.acumen_category || null,
    action_recommendation: data.action_recommendation || null,
  };
}
