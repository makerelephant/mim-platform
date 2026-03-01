/**
 * Slack Scanner — reads messages from configured Slack channels,
 * classifies them, resolves entities, and creates tasks.
 * Follows the same pattern as gmail-scanner.ts.
 */

import { WebClient } from "@slack/web-api";
import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";

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

interface ClassificationResult {
  primary_silo: string;
  primary_entity_id: string | null;
  primary_entity_name: string | null;
  summary: string;
  action_items: ActionItem[];
  tags: string[];
  sentiment: string;
}

export interface SlackScannerResult {
  success: boolean;
  messagesFound: number;
  processed: number;
  tasksCreated: number;
  skippedDupes: number;
  channelsScanned: number;
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

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_SCAN_HOURS = 24;

const CLASSIFIER_SYSTEM_PROMPT = `You are an AI assistant that classifies Slack messages for a sports merchandise company called Made in Motion (MiM).

MiM works with three main entity types:
1. **Investors** — venture capital firms, angel investors, seed funds. Messages about fundraising, cap tables, term sheets, due diligence, pitch decks, portfolio updates, financial projections.
2. **Communities (soccer_orgs)** — youth soccer organizations, clubs, leagues in Massachusetts. Messages about partnerships, merchandise, tournaments, player registrations, outreach, sponsorships, uniforms, team stores.
3. **Contacts** — general contacts, networking, personal relationships that don't clearly fit investors or communities.

You will receive:
- The Slack message content (channel name, sender, text)
- A list of resolved entities that the sender matches to in our database

Your job:
1. **Classify** which silo this message primarily belongs to (investors, soccer_orgs, or contacts)
2. **Pick the primary entity** from the resolved list (or null if none match well)
3. **Summarize** the message in one concise line
4. **Extract action items** — only genuine items that require follow-up
5. **Tag** the message with relevant categories

Respond with ONLY a JSON object:
{
  "primary_silo": "investors" | "soccer_orgs" | "contacts",
  "primary_entity_id": "uuid-string" | null,
  "primary_entity_name": "Entity Name" | null,
  "summary": "One-line summary",
  "sentiment": "positive" | "neutral" | "negative" | "urgent",
  "action_items": [
    {
      "title": "Clear, actionable task title",
      "summary": "Context about what is happening",
      "recommended_action": "Specific recommended next step",
      "priority": "low" | "medium" | "high" | "critical",
      "due_date": "YYYY-MM-DD" | null,
      "goal_relevance_score": 1-10 | null
    }
  ],
  "tags": ["follow-up", "meeting-request", "deal-update", "partnership", etc.]
}

IMPORTANT:
- If there are no action items, return an empty array []
- Skip bot messages, automated notifications, and trivial chatter
- Only extract genuine action items that require the user to do something
- For threaded conversations, focus on the latest actionable content`;

// ─── Entity Resolver (simplified — reuses name/email matching) ──────────

class SlackEntityResolver {
  private emailToContacts: Map<string, { id: string; name: string }> = new Map();
  private nameToContacts: Map<string, { id: string; name: string }> = new Map();

  constructor(private sb: SupabaseClient) {}

  async load(): Promise<void> {
    const { data: contacts } = await this.sb
      .from("contacts")
      .select("id, name, email");

    for (const c of contacts || []) {
      if (c.email) {
        this.emailToContacts.set(c.email.toLowerCase().trim(), { id: c.id, name: c.name });
      }
      if (c.name) {
        this.nameToContacts.set(c.name.toLowerCase().trim(), { id: c.id, name: c.name });
      }
    }

    // Also load contact_emails junction
    const { data: contactEmails } = await this.sb
      .from("contact_emails")
      .select("contact_id, email");

    for (const ce of contactEmails || []) {
      const emailLower = ce.email.toLowerCase().trim();
      if (!this.emailToContacts.has(emailLower)) {
        const match = (contacts || []).find((c: { id: string }) => c.id === ce.contact_id);
        if (match) {
          this.emailToContacts.set(emailLower, { id: match.id, name: match.name });
        }
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
): Promise<ClassificationResult> {
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
  const userPrompt = `${entityContext}\n\n---\n\n${msgContent}`;

  try {
    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    let text = (response.content[0] as { type: "text"; text: string }).text.trim();
    if (text.startsWith("```")) {
      text = text.split("```")[1];
      if (text.startsWith("json")) text = text.slice(4);
      text = text.trim();
    }

    const data = JSON.parse(text);

    const actionItems: ActionItem[] = (data.action_items || []).map((ai: Record<string, unknown>) => {
      let grs = ai.goal_relevance_score as number | null;
      if (grs !== null && grs !== undefined) {
        grs = Math.max(1, Math.min(10, Number(grs)));
        if (isNaN(grs)) grs = null;
      }
      return {
        title: (ai.title as string) || "Untitled task",
        summary: ai.summary as string | undefined,
        recommended_action: ai.recommended_action as string | undefined,
        priority: (ai.priority as string) || "medium",
        due_date: ai.due_date as string | undefined,
        goal_relevance_score: grs ?? undefined,
      };
    });

    return {
      primary_silo: data.primary_silo || "contacts",
      primary_entity_id: data.primary_entity_id || null,
      primary_entity_name: data.primary_entity_name || null,
      summary: data.summary || "Message processed",
      action_items: actionItems,
      tags: data.tags || [],
      sentiment: data.sentiment || "neutral",
    };
  } catch {
    const primaryEntity = resolvedEntities[0];
    return {
      primary_silo: primaryEntity?.entity_type || "contacts",
      primary_entity_id: primaryEntity?.entity_id || null,
      primary_entity_name: primaryEntity?.entity_name || null,
      summary: `Slack message in #${message.channel}`,
      action_items: [],
      tags: ["unclassified"],
      sentiment: "neutral",
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
    const { data: runData } = await sb.from("agent_runs").insert({
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

    if (agentRow) {
      if (agentRow.system_prompt) agentSystemPrompt = agentRow.system_prompt;
      const cfg = agentRow.config as Record<string, unknown> | null;
      if (cfg) {
        if (typeof cfg.model === "string") agentModel = cfg.model;
        if (typeof cfg.max_tokens === "number") agentMaxTokens = cfg.max_tokens;
        if (typeof cfg.scan_hours === "number") scanHours = cfg.scan_hours;
        if (Array.isArray(cfg.channels)) channelNames = cfg.channels as string[];
      }
      addLog("Loaded config from agents table");
    } else {
      addLog("No agent record found — using defaults");
    }

    // ── Slack client ──
    const slack = new WebClient(slackToken);
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // ── Entity resolver ──
    const resolver = new SlackEntityResolver(sb);
    await resolver.load();
    addLog("Entity resolver loaded");

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
            .from("correspondence")
            .select("id")
            .eq("source_message_id", msgId)
            .limit(1);

          if (dupeCheck && dupeCheck.length > 0) {
            skippedDupes++;
            continue;
          }

          // ── Resolve user ──
          const userProfile = await resolveUser(msg.user!);
          const entityMatches = resolver.resolve(userProfile.email, userProfile.name);

          // Skip if no text content worth classifying
          if (!msg.text || msg.text.trim().length < 10) continue;

          // ── Classify ──
          const result = await classifySlackMessage(
            anthropic,
            { channel: channel.name, user: userProfile.name, text: msg.text },
            entityMatches,
            { systemPrompt: agentSystemPrompt, model: agentModel, maxTokens: agentMaxTokens },
          );

          const entityType = result.primary_silo;
          const entityId = result.primary_entity_id;

          // ── Log correspondence ──
          const messageDate = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : null;

          if (entityId) {
            await sb.from("correspondence").insert({
              entity_type: entityType,
              entity_id: entityId,
              direction: "inbound",
              subject: `Slack: #${channel.name}`,
              snippet: (msg.text || "").slice(0, 200),
              sender_email: userProfile.email,
              sender_name: userProfile.name,
              email_date: messageDate,
              source: "slack",
              source_message_id: msgId,
            });
          }

          // ── Create tasks ──
          for (const action of result.action_items) {
            const taskPayload: Record<string, unknown> = {
              title: action.title,
              priority: action.priority,
              source: "slack-scanner",
            };
            if (action.summary) taskPayload.summary = action.summary;
            if (action.recommended_action) taskPayload.recommended_action = action.recommended_action;
            if (entityType) taskPayload.entity_type = entityType;
            if (entityId) taskPayload.entity_id = entityId;
            if (action.due_date) taskPayload.due_date = action.due_date;
            if (action.goal_relevance_score != null) taskPayload.goal_relevance_score = action.goal_relevance_score;

            await sb.from("tasks").insert(taskPayload);
            tasksCreated++;
            addLog(`  Task created [${action.priority}]: ${action.title.slice(0, 80)}`);
          }

          // ── Log activity ──
          await sb.from("activity_log").insert({
            agent_name: "slack-scanner",
            action_type: "slack_scanned",
            entity_type: entityType,
            entity_id: entityId,
            summary: result.summary,
            raw_data: {
              channel: channel.name,
              user: userProfile.name,
              tags: result.tags,
              sentiment: result.sentiment,
              action_count: result.action_items.length,
            },
            source_id: msgId,
          });

          recordsProcessed++;
          const entityLabel = result.primary_entity_name
            ? ` → [${entityType}] ${result.primary_entity_name}`
            : "";
          addLog(`Processed: #${channel.name} ${userProfile.name}${entityLabel} (${result.action_items.length} tasks)`);
        }
      } catch (err) {
        addLog(`Error scanning #${channel.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Complete run ──
    if (runId) {
      await sb.from("agent_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_processed: totalMessages,
        records_updated: recordsProcessed,
      }).eq("id", runId);
    }

    addLog(`Completed — messages: ${totalMessages}, processed: ${recordsProcessed}, tasks: ${tasksCreated}, skipped: ${skippedDupes}`);

    return {
      success: true,
      messagesFound: totalMessages,
      processed: recordsProcessed,
      tasksCreated,
      skippedDupes,
      channelsScanned: channelsToScan.length,
      log,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    addLog(`FAILED: ${errMsg}`);

    if (runId) {
      try {
        await sb.from("agent_runs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errMsg,
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
      log,
      error: errMsg,
    };
  }
}
