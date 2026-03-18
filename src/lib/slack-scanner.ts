/**
 * Slack Scanner — reads messages from configured Slack channels,
 * classifies them, resolves entities, and creates tasks.
 * Follows the same pattern as gmail-scanner.ts.
 */

import { WebClient } from "@slack/web-api";
import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { preFilterSlack } from "./scanner-prefilter";
import { buildEntityDossier } from "./entity-dossier";
import { computeFeedbackForEntities } from "./feedback-engine";
import { loadTaxonomy, matchTaxonomyCategory, buildTaxonomyPromptSection, enforcePriorityRules } from "./taxonomy-loader";
import { loadStandingOrders, buildStandingOrdersPromptSection } from "./instruction-loader";
import { recomputeKCSForEntities } from "./entity-intelligence";
import { emitFeedCard } from "./feed-card-emitter";
import {
  buildUnifiedClassifierPrompt,
  parseUnifiedClassification,
  attentionClassToCardType,
  attentionClassToPriority,
  shouldSuppressCard,
  qualifiesForTaskCreation,
  UnifiedClassificationResult,
} from "./unified-classifier";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EntityMatch {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  match_method: string;
  confidence: number;
}

interface ActionItem {
  title: string;
  summary?: string;
  recommended_action?: string;
  priority: string;
  due_date?: string;
  goal_relevance_score?: number;
}

// ClassificationResult now uses UnifiedClassificationResult from unified-classifier.ts

export interface SlackScannerResult {
  success: boolean;
  messagesFound: number;
  processed: number;
  tasksCreated: number;
  skippedDupes: number;
  channelsScanned: number;
  preFiltered: number;
  threadSkipped: number;
  log: string[];
  error?: string;
}

interface SlackMessage {
  channel_id: string;
  channel_name: string;
  ts: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  text: string;
  thread_ts?: string;
  reply_count?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_SCAN_HOURS = 24;

const DEFAULT_GOALS_90DAY = [
  "$76K in gross revenue",
  "Average order value of $35",
  "Additional $250K in investment raised",
];

const CLASSIFIER_SYSTEM_PROMPT = buildUnifiedClassifierPrompt("slack");

const _LEGACY_CLASSIFIER_SYSTEM_PROMPT = `You are an AI assistant that classifies Slack messages for a sports merchandise company called Made in Motion (MiM).

MiM is a platform that enables youth sports organizations and community groups to create and sell custom branded merchandise through "Drop" links — on-demand, zero-inventory storefronts.

MiM works with these entity types:
1. **Organizations** — classified by the business taxonomy below
2. **Contacts** — general contacts, networking, personal relationships that don't clearly fit an organization.

{{TAXONOMY_SECTION}}

You will receive:
- The Slack message content (channel name, sender, text)
- A list of resolved entities that the sender matches to in our database
- A reference list of known organizations in our CRM (use this to identify name mentions in the message even if the sender wasn't matched)
- Optionally, an ENTITY DOSSIER with relationship history for the primary entity
- Optionally, a FEEDBACK HISTORY showing how the user has interacted with past tasks from this entity

When you receive an ENTITY DOSSIER, use it to:
- Avoid creating duplicate tasks if similar open tasks already exist for this entity
- Adjust priority based on relationship stage (e.g., investor in "Engaged" stage gets higher priority than "Prospect")
- Reference prior correspondence context in your task summaries
- Flag re-engagement opportunities when last contact was 30+ days ago
- When feedback shows the user ignores tasks from this entity, reduce task creation (only create for genuinely important items)

Your job:
1. **Classify** which silo this message primarily belongs to (organizations or contacts)
2. **Pick the primary entity** from the resolved list OR from the known org reference list if you find a name match in the message content. Use the exact entity ID from the list.
3. **Summarize** the message in one concise line
4. **Extract action items** with appropriate priorities:
   - critical: urgent deadlines, legal issues, compliance, time-sensitive investor requests, expiring term sheets
   - high: meeting requests, term sheet discussions, partnership proposals, investor follow-ups, deal updates, large order inquiries
   - medium: general follow-ups, status updates, introductions, scheduling, product questions
   - low: casual mentions, FYI messages, trivial chatter
5. **Tag** the message with relevant categories
6. **Score goal relevance** — how directly this impacts MiM's 90-day strategic goals

Respond with ONLY a JSON object in this exact format:
{
  "primary_silo": "organizations" | "contacts",
  "primary_entity_id": "uuid-string" | null,
  "primary_entity_name": "Entity Name" | null,
  "summary": "One-line summary",
  "sentiment": "positive" | "neutral" | "negative" | "urgent",
  "action_items": [
    {
      "title": "Clear, actionable task title",
      "summary": "Context about what is happening — the situation, background, or trigger",
      "recommended_action": "Specific recommended next step — what the user should do",
      "priority": "low" | "medium" | "high" | "critical",
      "due_date": "YYYY-MM-DD" | null,
      "goal_relevance_score": 1-10 | null
    }
  ],
  "tags": ["follow-up", "meeting-request", "deal-update", "partnership", "intro-request", "merch", "newsletter", "fundraising", "order", "team-store", etc.],
  "draft_reply": "A ready-to-send 2-3 sentence reply to this message, or null if no reply is needed"
}

IMPORTANT:
- Task titles should be actionable and specific (e.g., "Follow up with Sequoia on term sheet" not "Follow up")
- Only extract genuine action items that require the user to do something
- Skip bot messages, automated notifications, and trivial chatter
- For threaded conversations, focus on the latest actionable content
- When you find an org name mentioned in the message that matches the known org list, use that org as the primary entity even if the sender wasn't matched
- Generate a "draft_reply" — a ready-to-send 2-3 sentence Slack reply when the message warrants a response. Write it as if Mark (the CEO) is replying. Set to null for bot messages, automated notifications, or messages that don't need a reply.

ACTION ITEM EXTRACTION RULES — always extract an action item when:
- The message @mentions or tags Mark Slater (he was personally addressed — he must respond)
- A link, document, or resource was shared for Mark to review
- A question was asked that expects a reply
- An update was shared that requires acknowledgement or follow-up
- A new contact, partnership, or opportunity was introduced
- Someone shared access/credentials that Mark needs to use
- The message contains a decision that needs input from Mark

For these cases, the minimum action item is "Review and respond to [sender]'s message in #[channel]" at medium priority. Do not return an empty action_items array for any message that was directed at or is relevant to Mark.

For each action item, separate CONTEXT from ACTION:
- "summary" = the background/situation
- "recommended_action" = what to do about it
- "goal_relevance_score" = how relevant this is to the company's 90-day strategic goals (scoring guide below)

GOAL RELEVANCE SCORING:
- 9-10: Directly advances a 90-day goal (e.g., investor ready to wire funds, large merch order closing)
- 7-8: Strongly related (e.g., new investor meeting, partnership that drives revenue)
- 4-6: Moderately related (e.g., intro to potential investor, community org interested in merch)
- 1-3: Tangentially related or unrelated (e.g., networking, general inquiry)

EXAMPLES:

Example 1 — Investor update in Slack:
{
  "primary_silo": "organizations",
  "primary_entity_id": "abc-123",
  "primary_entity_name": "Sequoia Capital",
  "summary": "Team discussion about Sequoia's request for updated financial projections",
  "sentiment": "positive",
  "action_items": [
    {
      "title": "Prepare updated financials for Sequoia Capital",
      "summary": "Team flagged that Sequoia partner is requesting Q1 projections ahead of their partner meeting",
      "recommended_action": "Compile P&L, revenue forecast, and cap table — send by Friday EOD",
      "priority": "critical",
      "due_date": "2026-03-07",
      "goal_relevance_score": 10
    }
  ],
  "tags": ["fundraising", "deal-update", "follow-up"],
  "draft_reply": "On it — I'll have the updated financials ready by Friday EOD."
}

Example 2 — Partner discussion:
{
  "primary_silo": "organizations",
  "primary_entity_id": "def-456",
  "primary_entity_name": "Bay State FC",
  "summary": "Team discussing Bay State FC's interest in a team store for spring season",
  "sentiment": "positive",
  "action_items": [
    {
      "title": "Schedule demo call with Bay State FC for team store setup",
      "summary": "Bay State FC program director reached out about launching a team store for 200+ players",
      "recommended_action": "Reply to schedule 30-min demo call this week, prepare sample Drop link with their logo",
      "priority": "high",
      "due_date": null,
      "goal_relevance_score": 8
    }
  ],
  "tags": ["partnership", "team-store", "merch", "meeting-request"],
  "draft_reply": "Great lead — I'll reach out to Bay State FC today to set up a demo call."
}

Example 3 — Bot/trivial (skip):
{
  "primary_silo": "contacts",
  "primary_entity_id": null,
  "primary_entity_name": null,
  "summary": "Automated deployment notification",
  "sentiment": "neutral",
  "action_items": [],
  "tags": ["automated"],
  "draft_reply": null
}`;

// ─── Org Context Loader ──────────────────────────────────────────────────────

async function loadOrgContext(sb: SupabaseClient): Promise<string> {
  const [orgResult, typesResult, pipelineResult] = await Promise.all([
    sb.schema('core').from("organizations").select("id, name").order("name"),
    sb.schema('core').from("org_types").select("org_id, type"),
    sb.schema('crm').from("pipeline").select("org_id, status, lifecycle_status"),
  ]);

  const orgs = orgResult.data;
  if (!orgs || orgs.length === 0) return "";

  // Build lookup maps
  const orgTypeMap = new Map<string, string[]>();
  for (const t of typesResult.data ?? []) {
    const arr = orgTypeMap.get(t.org_id) ?? [];
    arr.push(t.type);
    orgTypeMap.set(t.org_id, arr);
  }
  const pipelineMap = new Map<string, string>();
  for (const p of pipelineResult.data ?? []) {
    pipelineMap.set(p.org_id, p.status || p.lifecycle_status || "");
  }

  const investors: string[] = [];
  const partners: string[] = [];
  const communities: string[] = [];

  for (const org of orgs) {
    const types = orgTypeMap.get(org.id) ?? [];
    const status = pipelineMap.get(org.id) ?? "";
    const label = status ? `${org.name} (${status}) [id:${org.id}]` : `${org.name} [id:${org.id}]`;

    const lowerTypes = types.map((t: string) => t.toLowerCase());
    if (lowerTypes.includes("investor")) investors.push(label);
    if (lowerTypes.includes("partner")) partners.push(label);
    if (lowerTypes.includes("customer") || types.length === 0) communities.push(label);
  }

  let ctx = "KNOWN ORGANIZATIONS IN OUR CRM (use these IDs when you find a name match):\n\n";
  if (investors.length > 0) ctx += `Investors (${investors.length}): ${investors.join(", ")}\n\n`;
  if (partners.length > 0) ctx += `Partners (${partners.length}): ${partners.join(", ")}\n\n`;
  if (communities.length > 0) ctx += `Communities/Customers (${communities.length}): ${communities.join(", ")}\n\n`;

  return ctx;
}

// ─── Entity Resolver (simplified — reuses name/email matching) ──────────

class SlackEntityResolver {
  private emailToContacts: Map<string, { id: string; name: string }> = new Map();
  private nameToContacts: Map<string, { id: string; name: string }> = new Map();

  constructor(private sb: SupabaseClient) {}

  async load(): Promise<void> {
    const { data: contacts } = await this.sb
      .schema('core').from("contacts")
      .select("id, first_name, last_name, email");

    for (const c of contacts || []) {
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
      if (c.email) {
        this.emailToContacts.set(c.email.toLowerCase().trim(), { id: c.id, name: fullName });
      }
      if (fullName && fullName !== "Unknown") {
        this.nameToContacts.set(fullName.toLowerCase().trim(), { id: c.id, name: fullName });
      }
    }
  }

  resolve(email: string | null, displayName: string): EntityMatch[] {
    const matches: EntityMatch[] = [];

    // Try email match first
    if (email) {
      const contact = this.emailToContacts.get(email.toLowerCase().trim());
      if (contact) {
        matches.push({
          entity_type: "contacts",
          entity_id: contact.id,
          entity_name: contact.name,
          match_method: "email_direct",
          confidence: 0.9,
        });
        return matches;
      }
    }

    // Try name match
    if (displayName) {
      const contact = this.nameToContacts.get(displayName.toLowerCase().trim());
      if (contact) {
        matches.push({
          entity_type: "contacts",
          entity_id: contact.id,
          entity_name: contact.name,
          match_method: "name_match",
          confidence: 0.7,
        });
      }
    }

    return matches;
  }
}

// ─── Classifier ─────────────────────────────────────────────────────────────

async function classifySlackMessage(
  anthropic: Anthropic,
  message: { channel: string; user: string; text: string },
  resolvedEntities: EntityMatch[],
  opts: { systemPrompt: string; model: string; maxTokens: number },
  orgContext: string = "",
  entityDossier: string = "",
  threadContext: string = "",
  log?: (msg: string) => void,
): Promise<UnifiedClassificationResult> {
  const addLog = log || (() => {});
  let entityContext: string;
  if (resolvedEntities.length > 0) {
    const lines = resolvedEntities.map(
      (em) => `  - [${em.entity_type}] ${em.entity_name} (id: ${em.entity_id}, matched via: ${em.match_method})`
    );
    entityContext = "Resolved entities:\n" + lines.join("\n");
  } else {
    entityContext = "No matching entities found in our database for the sender.";
  }

  const msgContent = `Source: Slack\nChannel: #${message.channel}\nFrom: ${message.user}\nMessage:\n${message.text.slice(0, 1500)}`;

  let userPrompt = entityContext;
  if (entityDossier) userPrompt += `\n\n${entityDossier}`;
  if (threadContext) userPrompt += `\n\n${threadContext}`;
  if (orgContext) userPrompt += `\n\n${orgContext}`;
  userPrompt += `\n\n---\n\n${msgContent}`;

  try {
    addLog(`  Classifying with model: ${opts.model}, promptLen: ${userPrompt.length}`);
    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.systemPrompt,
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: "{" },
      ],
    });

    const rawText = "{" + (response.content[0] as { type: "text"; text: string }).text.trim();

    const result = parseUnifiedClassification(
      rawText,
      "slack",
      resolvedEntities.map((e) => ({
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        entity_name: e.entity_name,
      })),
    );

    result.prompt_tokens = response.usage?.input_tokens;
    result.completion_tokens = response.usage?.output_tokens;
    return result;
  } catch (classifyErr) {
    const errMsg = classifyErr instanceof Error ? classifyErr.message : String(classifyErr);
    addLog(`  CLASSIFICATION ERROR: ${errMsg}`);
    console.error("[slack-scanner] classifySlackMessage FAILED:", errMsg);
    const primaryEntity = resolvedEntities[0];
    return {
      attention_class: "S2_batch_or_delegate",
      relevance_score: 30,
      subtypes: [],
      channel: "slack",
      primary_reason: "Classification failed — defaulting to S2",
      supporting_signals: [],
      disqualifiers_considered: [],
      recommended_handling: "Review manually",
      confidence: 0.1,
      summary_sentence: `Slack message in #${message.channel}`,
      entities: [],
      contains_decision: false,
      contains_action: false,
      contains_task: false,
      decisions: [],
      actions: [],
      tasks: [],
      task_creation_candidates: [],
      primary_silo: primaryEntity?.entity_type || "contacts",
      primary_entity_id: primaryEntity?.entity_id || null,
      primary_entity_name: primaryEntity?.entity_name || null,
      tags: ["unclassified"],
      sentiment: "neutral",
      draft_reply: null,
      acumen_category: null,
      action_recommendation: null,
    };
  }
}

// ─── Main Scanner ───────────────────────────────────────────────────────────

export async function runSlackScanner(
  sb: SupabaseClient,
  scanHoursParam: number = DEFAULT_SCAN_HOURS,
): Promise<SlackScannerResult> {
  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(`[slack-scanner] ${msg}`); };

  let runId: string | null = null;
  let tasksCreated = 0;
  let scanHours = scanHoursParam;

  try {
    // ── Start agent run ──
    const { data: runData } = await sb.schema('brain').from("agent_runs").insert({
      agent_name: "slack-scanner",
      status: "running",
    }).select("id").single();
    runId = runData?.id || null;
    addLog(`Started run ${runId}`);

    // ── Validate env ──
    const slackToken = process.env.SLACK_BOT_TOKEN?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!slackToken) throw new Error("SLACK_BOT_TOKEN environment variable not set.");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY environment variable not set.");

    // ── Load agent config ──
    let agentSystemPrompt = CLASSIFIER_SYSTEM_PROMPT;
    let agentModel = DEFAULT_MODEL;
    let agentMaxTokens = DEFAULT_MAX_TOKENS;
    let channelNames: string[] = [];

    const { data: agentRow } = await sb
      .from("agents")
      .select("system_prompt, config")
      .eq("slug", "slack-scanner")
      .single();

    let brainChannel = "";

    if (agentRow) {
      if (agentRow.system_prompt) agentSystemPrompt = agentRow.system_prompt;
      const cfg = agentRow.config as Record<string, unknown> | null;
      if (cfg) {
        if (typeof cfg.model === "string") agentModel = cfg.model;
        if (typeof cfg.max_tokens === "number") agentMaxTokens = cfg.max_tokens;
        if (typeof cfg.scan_hours === "number") scanHours = cfg.scan_hours;
        if (Array.isArray(cfg.channels)) channelNames = cfg.channels as string[];
        if (typeof cfg.brain_channel === "string") brainChannel = cfg.brain_channel;
      }
      addLog("Loaded config from agents table");
    } else {
      addLog("No agent record found — using defaults");
    }

    if (brainChannel) {
      addLog(`Brain channel configured: #${brainChannel}`);
    }

    // ── Inject 90-day goals into system prompt ──
    const cfgGoals = (agentRow?.config as Record<string, unknown> | null)?.goals_90day as string[] | undefined;
    const goals = cfgGoals && cfgGoals.length > 0 ? cfgGoals : DEFAULT_GOALS_90DAY;
    const goalsBlock = `MiM's 90-DAY STRATEGIC GOALS:\n${goals.map((g) => `• ${g}`).join("\n")}\n\n`;
    agentSystemPrompt = agentSystemPrompt.replace("GOAL RELEVANCE SCORING:", goalsBlock + "GOAL RELEVANCE SCORING:");
    addLog(`Injected ${goals.length} goals into classifier prompt`);

    // ── Inject business taxonomy into system prompt ──
    const taxonomy = await loadTaxonomy(sb);
    const taxonomySection = buildTaxonomyPromptSection(taxonomy);
    agentSystemPrompt = agentSystemPrompt.replace("{{TAXONOMY_SECTION}}", taxonomySection);
    addLog(`Injected taxonomy (${taxonomy.length} categories) into classifier prompt`);

    // ── Inject CEO standing orders into system prompt ──
    const standingOrders = await loadStandingOrders(sb);
    if (standingOrders.length > 0) {
      const standingOrdersSection = buildStandingOrdersPromptSection(standingOrders);
      agentSystemPrompt += "\n" + standingOrdersSection;
      addLog(`Injected ${standingOrders.length} standing order(s) into classifier prompt`);
    }

    // ── Always-on action extraction rules (appended regardless of DB prompt override) ──
    agentSystemPrompt += `\n\nACTION EXTRACTION RULES — ALWAYS apply these regardless of other instructions:
- If the message @mentions or tags Mark Slater directly → create an action item to review and respond
- If a link, document, Google Doc, or resource is shared → create an action item to review it
- If a question is asked → create an action item to answer it
- If access/credentials were shared → create an action item to acknowledge or use them
- If a new contact, org, or opportunity is mentioned → create an action item to follow up
- Minimum action item when in doubt: "Review and respond to [sender] in #[channel]" at medium priority
- The "summary" field must be a specific one-line description of what happened. NEVER return "Message processed" as the summary. Describe the actual content.`;
    addLog("Injected action extraction rules");

    // ── Slack client ──
    const slack = new WebClient(slackToken);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // ── Entity resolver ──
    const resolver = new SlackEntityResolver(sb);
    await resolver.load();
    addLog("Entity resolver loaded");

    // ── Load org context for classifier ──
    const orgContext = await loadOrgContext(sb);
    addLog(`Loaded org context (${orgContext.length} chars)`);

    // ── Get channels ──
    const channelsToScan: Array<{ id: string; name: string }> = [];

    if (channelNames.length > 0) {
      // Use configured channels
      const { channels } = await slack.conversations.list({
        types: "public_channel,private_channel",
        limit: 200,
      });
      for (const ch of channels || []) {
        if (ch.name && ch.id && channelNames.includes(ch.name)) {
          channelsToScan.push({ id: ch.id, name: ch.name });
        }
      }
    } else {
      // Scan all channels the bot is a member of
      const { channels } = await slack.conversations.list({
        types: "public_channel,private_channel",
        limit: 50,
      });
      for (const ch of channels || []) {
        if (ch.is_member && ch.name && ch.id) {
          channelsToScan.push({ id: ch.id, name: ch.name });
        }
      }
    }

    addLog(`Found ${channelsToScan.length} channels to scan`);

    // ── User cache (Slack user ID → profile) ──
    const userCache: Map<string, { name: string; email: string | null }> = new Map();

    async function resolveUser(userId: string): Promise<{ name: string; email: string | null }> {
      if (userCache.has(userId)) return userCache.get(userId)!;
      try {
        const { user } = await slack.users.info({ user: userId });
        const profile = {
          name: user?.real_name || user?.name || userId,
          email: user?.profile?.email || null,
        };
        userCache.set(userId, profile);
        return profile;
      } catch {
        const fallback = { name: userId, email: null };
        userCache.set(userId, fallback);
        return fallback;
      }
    }

    // ── Scan messages ──
    const oldestTs = String(Math.floor((Date.now() - scanHours * 60 * 60 * 1000) / 1000));
    let totalMessages = 0;
    let recordsProcessed = 0;
    let skippedDupes = 0;
    let preFiltered = 0;
    let threadSkipped = 0;
    const processedEntities: Array<{ entity_type: string; entity_id: string }> = [];

    for (const channel of channelsToScan) {
      try {
        const { messages } = await slack.conversations.history({
          channel: channel.id,
          oldest: oldestTs,
          limit: 100,
        });

        if (!messages || messages.length === 0) continue;

        // Filter out bot messages and join/leave events
        const humanMessages = messages.filter(
          (m) => m.subtype === undefined && m.user && m.text
        );

        totalMessages += humanMessages.length;
        addLog(`#${channel.name}: ${humanMessages.length} messages`);

        for (const msg of humanMessages) {
          const msgId = `slack_${channel.id}_${msg.ts}`;

          // ── Deduplication ──
          const { data: dupeCheck } = await sb
            .schema('brain').from("correspondence")
            .select("id")
            .contains("metadata", { source_message_id: msgId })
            .limit(1);

          if (dupeCheck && dupeCheck.length > 0) {
            skippedDupes++;
            continue;
          }

          // ── Brain channel routing: route to knowledge ingestion ──
          if (brainChannel && channel.name.toLowerCase() === brainChannel.toLowerCase()) {
            addLog(`  Brain channel message in #${channel.name} — routing to ingestion`);
            try {
              const userProfile = await resolveUser(msg.user!);
              const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

              await fetch(`${baseUrl}/api/brain/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: `Slack: ${userProfile.name} in #${channel.name}`,
                  text: msg.text || "",
                  source_type: "slack",
                  source_ref: msgId,
                  uploaded_by: "slack-scanner",
                  metadata: {
                    channel: channel.name,
                    channel_id: channel.id,
                    user: userProfile.name,
                    user_email: userProfile.email,
                    ts: msg.ts,
                    thread_ts: msg.thread_ts,
                  },
                }),
              });
              addLog(`  Brain ingestion successful for Slack message in #${channel.name}`);
            } catch (e) {
              addLog(`  Brain ingestion failed: ${e instanceof Error ? e.message : String(e)}`);
            }
            continue; // Skip normal classification for brain channel messages
          }

          // ── Pre-filter: skip bot messages, system subtypes ──
          const filterResult = preFilterSlack(msg as Record<string, unknown>);
          if (filterResult.action === "skip") {
            preFiltered++;
            addLog(`  Pre-filtered [${filterResult.category}]: #${channel.name} — ${filterResult.reason}`);
            try {
              await sb.from("classification_log").insert({
                source: "slack",
                source_message_id: msgId,
                thread_id: msg.thread_ts || null,
                from_email: null,
                subject: `Slack: #${channel.name}`,
                pre_filter_result: filterResult.category,
                agent_run_id: runId,
              });
            } catch { /* ignore logging error */ }
            continue;
          }

          // ── Resolve user ──
          const userProfile = await resolveUser(msg.user!);
          const entityMatches = resolver.resolve(userProfile.email, userProfile.name);

          // Skip if no text content worth classifying
          if (!msg.text || msg.text.trim().length < 10) continue;

          // ── Thread awareness: check for existing open tasks on same Slack thread ──
          let threadContext = "";
          const slackThreadId = msg.thread_ts || msg.ts;
          if (slackThreadId) {
            const threadMsgId = `slack_${channel.id}_${slackThreadId}`;
            const { data: existingThreadTasks } = await sb
              .schema('brain').from("tasks")
              .select("id, title, status, priority, created_at")
              .eq("thread_id", threadMsgId)
              .in("status", ["todo", "in_progress", "open"])
              .order("created_at", { ascending: false })
              .limit(3);

            if (existingThreadTasks && existingThreadTasks.length > 0) {
              const newestTask = existingThreadTasks[0];
              const taskAgeMs = Date.now() - new Date(newestTask.created_at).getTime();
              const fortyEightHoursMs = 48 * 60 * 60 * 1000;

              if (taskAgeMs < fortyEightHoursMs) {
                threadSkipped++;
                addLog(`  Thread skip: "${newestTask.title.slice(0, 50)}" already open (${Math.round(taskAgeMs / 3600000)}h ago)`);
                await sb.schema('brain').from("tasks").update({ updated_at: new Date().toISOString() }).eq("id", newestTask.id);
                try {
                  await sb.from("classification_log").insert({
                    source: "slack",
                    source_message_id: msgId,
                    thread_id: slackThreadId,
                    from_email: userProfile.email,
                    subject: `Slack: #${channel.name}`,
                    pre_filter_result: "thread_skip",
                    agent_run_id: runId,
                  });
                } catch { /* ignore logging error */ }
                continue;
              }

              const taskLines = existingThreadTasks.map(
                (t) => `  - [${t.priority}] "${t.title}" (${t.status}, created ${new Date(t.created_at).toLocaleDateString()})`
              );
              threadContext = `EXISTING OPEN TASKS FOR THIS SLACK THREAD:\n${taskLines.join("\n")}\nAvoid creating duplicate tasks. Only create a new task if this message introduces a genuinely new action item.`;
            }
          }

          // ── Build entity dossier for primary entity ──
          const primaryEntity = entityMatches[0];
          let dossierRendered = "";
          if (primaryEntity?.entity_id) {
            try {
              const dossier = await buildEntityDossier(sb, primaryEntity.entity_type, primaryEntity.entity_id);
              if (dossier) {
                dossierRendered = dossier.rendered;
              }
            } catch (e) {
              addLog(`  Dossier build failed for ${primaryEntity.entity_name}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }

          // ── Classify ──
          const result = await classifySlackMessage(
            anthropic,
            { channel: channel.name, user: userProfile.name, text: msg.text },
            entityMatches,
            { systemPrompt: agentSystemPrompt, model: agentModel, maxTokens: agentMaxTokens },
            orgContext,
            dossierRendered,
            threadContext,
            addLog,
          );

          const entityType = result.primary_silo;
          const entityId = result.primary_entity_id;

          // ── Taxonomy matching & priority enforcement (Phase 1C/1D/1F) ──
          const matchedCategory = matchTaxonomyCategory(result.tags, taxonomy);
          const taxonomySlug = matchedCategory?.slug ?? null;
          const taxonomyCardKey = matchedCategory?.org_type_match?.toLowerCase() ?? null;
          const enforcedPriority = enforcePriorityRules(
            result.tags,
            attentionClassToPriority(result.attention_class),
            taxonomy,
          );

          // Track processed entities for feedback computation
          if (entityId) {
            processedEntities.push({ entity_type: entityType, entity_id: entityId });
          }

          // ── Classification logging ──
          try {
            await sb.from("classification_log").insert({
              source: "slack",
              source_message_id: msgId,
              thread_id: slackThreadId || null,
              entity_type: entityType,
              entity_id: entityId,
              entity_name: result.primary_entity_name,
              from_email: userProfile.email,
              subject: `Slack: #${channel.name}`,
              classification_result: {
                attention_class: result.attention_class,
                relevance_score: result.relevance_score,
                primary_silo: result.primary_silo,
                summary: result.summary_sentence,
                sentiment: result.sentiment,
                tags: result.tags,
                action_count: result.actions.length,
                contains_decision: result.contains_decision,
                contains_action: result.contains_action,
                task_candidates: result.task_creation_candidates.length,
              },
              pre_filter_result: "passed",
              dossier_summary: dossierRendered ? dossierRendered.slice(0, 500) : null,
              prompt_tokens: result.prompt_tokens || null,
              completion_tokens: result.completion_tokens || null,
              model: agentModel,
              agent_run_id: runId,
              acumen_category: result.acumen_category || null,
              importance_level: attentionClassToPriority(result.attention_class),
            });
          } catch { /* ignore logging error */ }

          // ── Log correspondence ──
          const messageDate = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : null;

          if (entityId) {
            await sb.schema('brain').from("correspondence").insert({
              entity_type: entityType,
              entity_id: entityId,
              channel: "slack",
              direction: "inbound",
              subject: `Slack: #${channel.name}`,
              body: (msg.text || "").slice(0, 200),
              from_address: userProfile.email,
              to_address: null,
              sent_at: messageDate,
              metadata: {
                sender_name: userProfile.name,
                source_message_id: msgId,
              },
            });
          }

          // ── Suppress S3 cards (noise) ──
          if (shouldSuppressCard(result.attention_class)) {
            addLog(`  Suppressed [${result.attention_class}]: "${result.summary_sentence.slice(0, 60)}"`);
          } else {

          // ── Emit feed card ──
          try {
            const cardType = attentionClassToCardType(result.attention_class);
            const cardPriority = attentionClassToPriority(result.attention_class);

            await emitFeedCard(sb, {
              card_type: cardType,
              title: result.summary_sentence,
              body: result.actions.length > 0
                ? result.actions[0].description || result.summary_sentence
                : result.summary_sentence,
              reasoning: result.primary_reason || undefined,
              source_type: "slack_scanner",
              source_ref: msgId,
              acumen_category: taxonomySlug || undefined,
              priority: cardPriority,
              confidence: result.confidence || undefined,
              visibility_scope: "personal",
              entity_id: entityId || undefined,
              entity_type: entityType || undefined,
              entity_name: result.primary_entity_name || undefined,
              metadata: {
                channel: channel.name,
                channel_id: channel.id,
                sender: userProfile.name,
                sender_email: userProfile.email,
                slack_ts: msg.ts,
                thread_ts: msg.thread_ts || null,
                tags: result.tags,
                sentiment: result.sentiment,
                attention_class: result.attention_class,
                relevance_score: result.relevance_score,
                action_recommendation: result.action_recommendation || null,
                draft_reply: result.draft_reply || null,
              },
              agent_run_id: runId || undefined,
            }, addLog);
          } catch (e) {
            addLog(`  Feed card emission failed: ${e instanceof Error ? e.message : String(e)}`);
          }

          // ── Create tasks (gated on should_create_task + attention class) ──
          if (qualifiesForTaskCreation(result.attention_class)) {
            for (const candidate of result.task_creation_candidates) {
              if (!candidate.should_create_task) continue;

              const taskPayload: Record<string, unknown> = {
                title: candidate.proposed_task_title,
                priority: candidate.priority,
                status: "pending_review",
                source: "slack-scanner",
              };
              if (candidate.rationale) taskPayload.summary = candidate.rationale;
              if (candidate.why_tracking_warranted) taskPayload.recommended_action = candidate.why_tracking_warranted;
              if (entityType) taskPayload.entity_type = entityType;
              if (entityId) taskPayload.entity_id = entityId;
              if (candidate.proposed_due_date) taskPayload.due_date = candidate.proposed_due_date;
              taskPayload.thread_id = slackThreadId ? `slack_${channel.id}_${slackThreadId}` : null;
              taskPayload.source_message_id = msgId;
              if (taxonomySlug) taskPayload.taxonomy_category = taxonomySlug;
              if (result.draft_reply) taskPayload.draft_reply = result.draft_reply;

              await sb.schema('brain').from("tasks").insert(taskPayload);
              tasksCreated++;
              addLog(`  Task created [${candidate.priority}]: ${candidate.proposed_task_title.slice(0, 80)}`);
            }
          }

          } // end of !shouldSuppressCard block

          // ── Log activity (always, even for suppressed) ──
          await sb.schema('brain').from("activity").insert({
            entity_type: entityType,
            entity_id: entityId,
            action: "slack_scanned",
            actor: "slack-scanner",
            metadata: {
              summary: result.summary_sentence,
              attention_class: result.attention_class,
              relevance_score: result.relevance_score,
              channel: channel.name,
              user: userProfile.name,
              tags: result.tags,
              sentiment: result.sentiment,
              action_count: result.actions.length,
              source_id: msgId,
              taxonomy_slug: taxonomySlug,
              taxonomy_card_key: taxonomyCardKey,
              priority: attentionClassToPriority(result.attention_class),
              recommended_action: result.action_recommendation ?? null,
            },
          });

          recordsProcessed++;
          const entityLabel = result.primary_entity_name
            ? ` → [${entityType}] ${result.primary_entity_name}`
            : "";
          addLog(`Processed: #${channel.name} ${userProfile.name}${entityLabel} [${result.attention_class}] (${result.actions.length} actions)`);
        }
      } catch (err) {
        addLog(`Error scanning #${channel.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Compute entity feedback for processed entities ──
    if (processedEntities.length > 0) {
      try {
        const feedbackCount = await computeFeedbackForEntities(sb, processedEntities);
        addLog(`Computed feedback for ${feedbackCount} entities`);
      } catch (e) {
        addLog(`Feedback computation failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // ── Recompute KCS for all processed entities ──
      try {
        const kcsCount = await recomputeKCSForEntities(sb, processedEntities);
        addLog(`Recomputed KCS for ${kcsCount} entities`);
      } catch (e) {
        addLog(`KCS recompute failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Complete run ──
    if (runId) {
      await sb.schema('brain').from("agent_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output: { records_processed: totalMessages, records_updated: recordsProcessed },
      }).eq("id", runId);
    }

    addLog(`Completed — messages: ${totalMessages}, processed: ${recordsProcessed}, tasks: ${tasksCreated}, skipped: ${skippedDupes}, pre-filtered: ${preFiltered}, thread-skipped: ${threadSkipped}`);

    return {
      success: true,
      messagesFound: totalMessages,
      processed: recordsProcessed,
      tasksCreated,
      skippedDupes,
      channelsScanned: channelsToScan.length,
      preFiltered,
      threadSkipped,
      log,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    addLog(`FAILED: ${errMsg}`);

    if (runId) {
      try {
        await sb.schema('brain').from("agent_runs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error: errMsg,
        }).eq("id", runId);
      } catch { /* ignore */ }
    }

    return {
      success: false,
      messagesFound: 0,
      processed: 0,
      tasksCreated: 0,
      skippedDupes: 0,
      channelsScanned: 0,
      preFiltered: 0,
      threadSkipped: 0,
      log,
      error: errMsg,
    };
  }
}
