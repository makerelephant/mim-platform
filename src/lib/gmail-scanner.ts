/**
 * Gmail Scanner — TypeScript port of the Python agent system.
 * Runs natively on Vercel serverless functions.
 *
 * Combines: agent_base, entity_resolver, classifier, gmail-scanner
 */

import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";
import { preFilterGmail } from "./scanner-prefilter";
import { buildEntityDossier } from "./entity-dossier";
import { computeFeedbackForEntities } from "./feedback-engine";
import { loadTaxonomy, matchTaxonomyCategory, buildTaxonomyPromptSection, enforcePriorityRules } from "./taxonomy-loader";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EntityMatch {
  entity_type: string; // "contacts", "organizations"
  entity_id: string;
  entity_name: string;
  match_method: string; // "email_direct", "email_junction", "domain_fallback"
  confidence: number;
}

interface ActionItem {
  title: string;
  summary?: string;
  recommended_action?: string;
  priority: string;
  due_date?: string;
  goal_relevance_score?: number;
  description?: string;
}

interface ClassificationResult {
  primary_silo: string;
  primary_entity_id: string | null;
  primary_entity_name: string | null;
  summary: string;
  action_items: ActionItem[];
  tags: string[];
  sentiment: string;
  draft_reply: string | null;
}

interface MessageDetails {
  id: string;
  gmail_id: string;
  thread_id: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  internal_date: string;
}

export interface ScannerResult {
  success: boolean;
  messagesFound: number;
  processed: number;
  tasksCreated: number;
  skippedDupes: number;
  contactsCreated: number;
  preFiltered: number;
  threadSkipped: number;
  log: string[];
  error?: string;
}

// ─── Constants (defaults — overridden by agents table when available) ───────

const DEFAULT_USER_EMAILS = [
  "mark@madeinmotion.co",
  "mark@mim.co",
  "markslater9@gmail.com",
];

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 1200;

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "aol.com", "icloud.com", "me.com", "live.com", "msn.com",
  "protonmail.com", "mail.com", "comcast.net", "verizon.net",
]);

const DEFAULT_GOALS_90DAY = [
  "$76K in gross revenue",
  "Average order value of $35",
  "Additional $250K in investment raised",
];

const CLASSIFIER_SYSTEM_PROMPT = `You are an AI assistant that classifies business communications for a sports merchandise company called Made in Motion (MiM).

MiM is a platform that enables youth sports organizations and community groups to create and sell custom branded merchandise through "Drop" links — on-demand, zero-inventory storefronts.

MiM works with these entity types:
1. **Organizations** — classified by the business taxonomy below
2. **Contacts** — general contacts, networking, personal relationships that don't clearly fit an organization.

{{TAXONOMY_SECTION}}

You will receive:
- The message content (subject, body, sender)
- A list of resolved entities that the sender/recipients match to in our database
- A reference list of known organizations in our CRM (use this to identify name mentions in the email body/subject even if the sender wasn't matched by email)
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
2. **Pick the primary entity** from the resolved list OR from the known org reference list if you find a name match in the email content. Use the exact entity ID from the list.
3. **Summarize** the message in one concise line
4. **Extract action items** with appropriate priorities:
   - critical: urgent deadlines, legal issues, compliance, time-sensitive investor requests, expiring term sheets
   - high: meeting requests, term sheet discussions, partnership proposals, investor follow-ups, deal updates, large order inquiries
   - medium: general follow-ups, status updates, introductions, scheduling, product questions
   - low: newsletters, FYI emails, automated notifications, mass emails
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
  "draft_reply": "A ready-to-send 2-3 sentence reply to this email, or null if no reply is needed"
}

IMPORTANT:
- If there are no action items, return an empty array []
- Task titles should be actionable and specific (e.g., "Follow up with Sequoia on term sheet" not "Follow up")
- Only extract genuine action items that require the user to do something
- Skip automated notifications, marketing emails, and spam
- If the email is clearly automated/newsletter, set primary_silo to "contacts" and return no action items
- When you find an org name mentioned in the email body that matches the known org list, use that org as the primary entity even if the Entity Resolver didn't match the sender
- Generate a "draft_reply" — a ready-to-send 2-3 sentence reply when the email warrants a response. Write it as if Mark (the CEO) is replying. Set to null for newsletters, automated notifications, or emails that don't need a reply. Keep the tone professional but warm.

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

Example 1 — Investor follow-up email:
{
  "primary_silo": "organizations",
  "primary_entity_id": "abc-123",
  "primary_entity_name": "Sequoia Capital",
  "summary": "Sequoia requesting updated financial projections before next partner meeting",
  "sentiment": "positive",
  "action_items": [
    {
      "title": "Send updated financials to Sequoia Capital",
      "summary": "Sequoia partner Sarah Chen is requesting Q1 financial projections and updated cap table ahead of their Monday partner meeting",
      "recommended_action": "Prepare and send updated P&L, revenue forecast, and cap table by Friday EOD",
      "priority": "critical",
      "due_date": "2026-03-07",
      "goal_relevance_score": 10
    }
  ],
  "tags": ["fundraising", "deal-update", "follow-up"],
  "draft_reply": "Hi Sarah, thanks for the heads up on timing. I'll have the updated P&L, revenue forecast, and cap table over to you by Friday EOD. Let me know if you need anything else ahead of the partner meeting."
}

Example 2 — Partner inquiry:
{
  "primary_silo": "organizations",
  "primary_entity_id": "def-456",
  "primary_entity_name": "Bay State FC",
  "summary": "Bay State FC interested in setting up a team store for spring season",
  "sentiment": "positive",
  "action_items": [
    {
      "title": "Schedule demo call with Bay State FC for team store setup",
      "summary": "Bay State FC's program director wants to launch a team store for their spring soccer season with 200+ players",
      "recommended_action": "Reply to schedule a 30-min demo call this week, prepare sample Drop link with their logo",
      "priority": "high",
      "due_date": null,
      "goal_relevance_score": 8
    }
  ],
  "tags": ["partnership", "team-store", "merch", "meeting-request"],
  "draft_reply": "Hi! Thanks for reaching out — we'd love to help Bay State FC get set up with a team store for spring season. Are you available for a quick 30-minute call this week? I can walk you through how our Drop links work and have a sample ready with your logo."
}

Example 3 — Newsletter (skip):
{
  "primary_silo": "contacts",
  "primary_entity_id": null,
  "primary_entity_name": null,
  "summary": "Weekly SaaS newsletter from TechCrunch",
  "sentiment": "neutral",
  "action_items": [],
  "tags": ["newsletter"],
  "draft_reply": null
}`;

// ─── Entity Resolver ────────────────────────────────────────────────────────

class EntityResolver {
  private emailToContacts: Map<string, { id: string; name: string }> = new Map();
  private contactToOrganizations: Map<string, { id: string; name: string; org_types: string[] }[]> = new Map();
  private domainToOrganizations: Map<string, { id: string; name: string; org_types: string[] }> = new Map();

  constructor(private sb: SupabaseClient) {}

  async load(): Promise<void> {
    // Bulk pre-load using separate queries per schema (no cross-schema embeds)
    const [
      { data: contacts },
      { data: rels },
      { data: organizations },
    ] = await Promise.all([
      // 1. Load contacts from core schema
      this.sb.schema('core').from("contacts").select("id, first_name, last_name, email"),
      // 2. Load relationships (replaces organization_contacts) from core schema
      this.sb.schema('core').from("relationships").select("contact_id, org_id"),
      // 3. Load organizations from core schema
      this.sb.schema('core').from("organizations").select("id, name, website").not("website", "is", null),
    ]);

    // Also load org_types in bulk
    const orgIds = [...new Set([
      ...(rels ?? []).map(r => r.org_id),
      ...(organizations ?? []).map(o => o.id),
    ])];
    const { data: orgTypes } = orgIds.length > 0
      ? await this.sb.schema('core').from("org_types").select("org_id, type").in("org_id", orgIds)
      : { data: [] };

    // Build org_types lookup
    const orgTypeMap = new Map<string, string[]>();
    for (const t of (orgTypes ?? [])) {
      const existing = orgTypeMap.get(t.org_id) ?? [];
      existing.push(t.type);
      orgTypeMap.set(t.org_id, existing);
    }

    // Build org name lookup
    const orgNameMap = new Map<string, string>();
    for (const org of (organizations ?? [])) {
      orgNameMap.set(org.id, org.name);
    }
    // Also add orgs from relationships that might not have websites
    if (rels?.length) {
      const relOrgIds = [...new Set(rels.map(r => r.org_id))];
      const missingIds = relOrgIds.filter(id => !orgNameMap.has(id));
      if (missingIds.length > 0) {
        const { data: missingOrgs } = await this.sb.schema('core').from("organizations")
          .select("id, name").in("id", missingIds);
        for (const org of (missingOrgs ?? [])) {
          orgNameMap.set(org.id, org.name);
        }
      }
    }

    // 1. Populate email -> contact map
    for (const c of contacts || []) {
      if (c.email) {
        const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown';
        this.emailToContacts.set(c.email.toLowerCase().trim(), {
          id: c.id, name,
        });
      }
    }

    // 2. Populate contact -> organizations map from relationships
    for (const r of rels || []) {
      const orgName = orgNameMap.get(r.org_id);
      if (orgName) {
        const list = this.contactToOrganizations.get(r.contact_id) || [];
        list.push({ id: r.org_id, name: orgName, org_types: orgTypeMap.get(r.org_id) ?? [] });
        this.contactToOrganizations.set(r.contact_id, list);
      }
    }

    // 3. Domain -> organization mapping (anchored domain match)
    for (const org of organizations || []) {
      const domain = this.extractDomain(org.website);
      if (domain) {
        this.domainToOrganizations.set(domain, {
          id: org.id, name: org.name, org_types: orgTypeMap.get(org.id) ?? [],
        });
      }
    }
  }

  private extractDomain(url: string | null): string | null {
    if (!url) return null;
    try {
      let clean = url.trim().toLowerCase();
      if (!clean.startsWith("http")) clean = "https://" + clean;
      const parsed = new URL(clean);
      let domain = parsed.hostname;
      if (domain.startsWith("www.")) domain = domain.slice(4);
      return domain || null;
    } catch {
      return null;
    }
  }

  private extractEmailDomain(email: string): string | null {
    if (!email.includes("@")) return null;
    const domain = email.split("@")[1].toLowerCase().trim();
    if (FREE_EMAIL_DOMAINS.has(domain)) return null;
    return domain;
  }

  resolve(email: string): EntityMatch[] {
    email = email.toLowerCase().trim();
    const matches: EntityMatch[] = [];
    const seen = new Set<string>();

    // Step 1: Direct email -> contact
    const contact = this.emailToContacts.get(email);
    if (contact) {
      const key = `contacts:${contact.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({
          entity_type: "contacts", entity_id: contact.id,
          entity_name: contact.name, match_method: "email_direct", confidence: 1.0,
        });
      }

      // Step 2: Contact -> linked organizations
      for (const org of this.contactToOrganizations.get(contact.id) || []) {
        const orgKey = `organizations:${org.id}`;
        if (!seen.has(orgKey)) {
          seen.add(orgKey);
          matches.push({
            entity_type: "organizations", entity_id: org.id,
            entity_name: org.name, match_method: "email_junction", confidence: 0.9,
          });
        }
      }
    }

    // Step 3: Domain fallback
    if (matches.length === 0) {
      const domain = this.extractEmailDomain(email);
      if (domain) {
        const org = this.domainToOrganizations.get(domain);
        if (org && !seen.has(`organizations:${org.id}`)) {
          seen.add(`organizations:${org.id}`);
          matches.push({
            entity_type: "organizations", entity_id: org.id,
            entity_name: org.name, match_method: "domain_fallback", confidence: 0.6,
          });
        }
      }
    }

    return matches;
  }

  resolveMultiple(emails: string[]): EntityMatch[] {
    const all: EntityMatch[] = [];
    const seen = new Set<string>();
    for (const email of emails) {
      for (const match of this.resolve(email)) {
        const key = `${match.entity_type}:${match.entity_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(match);
        }
      }
    }
    return all;
  }
}

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

// ─── Classifier ─────────────────────────────────────────────────────────────

async function classifyMessage(
  anthropic: Anthropic,
  message: { subject: string; body: string; from: string },
  resolvedEntities: EntityMatch[],
  opts: { systemPrompt: string; model: string; maxTokens: number } = {
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    model: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
  },
  orgContext: string = "",
  entityDossier: string = "",
  threadContext: string = "",
): Promise<ClassificationResult & { prompt_tokens?: number; completion_tokens?: number }> {
  // Build entity context
  let entityContext: string;
  if (resolvedEntities.length > 0) {
    const lines = resolvedEntities.map(
      (em) => `  - [${em.entity_type}] ${em.entity_name} (id: ${em.entity_id}, matched via: ${em.match_method}, confidence: ${em.confidence})`
    );
    entityContext = "Resolved entities from our database:\n" + lines.join("\n");
  } else {
    entityContext = "No matching entities found in our database for the sender/recipients.";
  }

  const msgContent = `Source: Email\nFrom: ${message.from}\nSubject: ${message.subject}\nBody:\n${message.body.slice(0, 1500)}`;

  // Build enriched prompt with dossier, thread context, and org context
  let userPrompt = entityContext;
  if (entityDossier) userPrompt += `\n\n${entityDossier}`;
  if (threadContext) userPrompt += `\n\n${threadContext}`;
  if (orgContext) userPrompt += `\n\n${orgContext}`;
  userPrompt += `\n\n---\n\n${msgContent}`;

  try {
    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    let text = (response.content[0] as { type: "text"; text: string }).text.trim();

    // Handle markdown code fences
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
        description: ai.description as string | undefined,
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
      draft_reply: data.draft_reply || null,
      prompt_tokens: response.usage?.input_tokens,
      completion_tokens: response.usage?.output_tokens,
    };
  } catch (e) {
    // Fallback classification
    const primaryEntity = resolvedEntities[0];
    return {
      primary_silo: primaryEntity?.entity_type || "contacts",
      primary_entity_id: primaryEntity?.entity_id || null,
      primary_entity_name: primaryEntity?.entity_name || null,
      summary: `Email: ${message.subject.slice(0, 80)}`,
      action_items: [],
      tags: ["unclassified"],
      sentiment: "neutral",
      draft_reply: null,
    };
  }
}

// ─── Gmail Helpers ──────────────────────────────────────────────────────────

function extractEmailAddress(headerValue: string): string {
  if (headerValue.includes("<")) {
    return headerValue.split("<")[1].split(">")[0].toLowerCase().trim();
  }
  return headerValue.trim().toLowerCase();
}

function extractName(headerValue: string): string | null {
  if (headerValue.includes("<")) {
    const name = headerValue.split("<")[0].trim().replace(/"/g, "");
    return name || null;
  }
  return null;
}

function parseEmailList(headerValue: string): string[] {
  if (!headerValue) return [];
  return headerValue.split(",").filter((e) => e.trim()).map((e) => extractEmailAddress(e.trim()));
}

function determineDirection(fromEmail: string, userEmails: Set<string>): string {
  return userEmails.has(fromEmail) ? "outbound" : "inbound";
}

function getMessageBody(payload: Record<string, unknown>): string {
  // Direct body
  const body = payload.body as { data?: string } | undefined;
  if (body?.data) {
    return Buffer.from(body.data, "base64url").toString("utf-8");
  }

  // Multipart
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === "text/plain") {
        const partBody = part.body as { data?: string } | undefined;
        if (partBody?.data) {
          return Buffer.from(partBody.data, "base64url").toString("utf-8");
        }
      }
      // Nested parts (multipart/alternative inside multipart/mixed)
      const subParts = part.parts as Array<Record<string, unknown>> | undefined;
      if (subParts) {
        for (const sub of subParts) {
          if (sub.mimeType === "text/plain") {
            const subBody = sub.body as { data?: string } | undefined;
            if (subBody?.data) {
              return Buffer.from(subBody.data, "base64url").toString("utf-8");
            }
          }
        }
      }
    }
  }

  return "";
}

// ─── Main Scanner ───────────────────────────────────────────────────────────

export async function runGmailScanner(
  sb: SupabaseClient,
  scanHoursParam: number = 24,
): Promise<ScannerResult> {
  let scanHours = scanHoursParam;
  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(`[gmail-scanner] ${msg}`); };

  let runId: string | null = null;
  let tasksCreated = 0;
  let contactsCreated = 0;

  try {
    // ── Start agent run ──
    const { data: runData } = await sb.schema('brain').from("agent_runs").insert({
      agent_name: "gmail-scanner",
      status: "running",
      started_at: new Date().toISOString(),
    }).select("id").single();
    runId = runData?.id || null;
    addLog(`Started run ${runId}`);

    // ── Validate env vars ──
    const tokenJson = process.env.GOOGLE_TOKEN;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!tokenJson) {
      throw new Error("GOOGLE_TOKEN environment variable not set. Base64-encode your token.json and set it.");
    }
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable not set.");
    }

    // ── Gmail OAuth ──
    const tokenData = JSON.parse(Buffer.from(tokenJson, "base64").toString("utf-8"));
    const oauth2Client = new google.auth.OAuth2(
      tokenData.client_id,
      tokenData.client_secret,
      "urn:ietf:wg:oauth:2.0:oob",
    );
    oauth2Client.setCredentials({
      access_token: tokenData.token,
      refresh_token: tokenData.refresh_token,
      token_type: "Bearer",
      expiry_date: tokenData.expiry ? new Date(tokenData.expiry).getTime() : undefined,
    });

    // Force refresh if expired
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    addLog("Gmail authenticated");

    // ── Anthropic client ──
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // ── Load agent config from DB (fall back to defaults) ──
    let agentSystemPrompt = CLASSIFIER_SYSTEM_PROMPT;
    let agentModel = DEFAULT_MODEL;
    let agentMaxTokens = DEFAULT_MAX_TOKENS;
    let userEmailsList = DEFAULT_USER_EMAILS;

    const { data: agentRow } = await sb
      .from("agents")
      .select("system_prompt, config")
      .eq("slug", "gmail-scanner")
      .single();

    if (agentRow) {
      if (agentRow.system_prompt) agentSystemPrompt = agentRow.system_prompt;
      const cfg = agentRow.config as Record<string, unknown> | null;
      if (cfg) {
        if (typeof cfg.model === "string") agentModel = cfg.model;
        if (typeof cfg.max_tokens === "number") agentMaxTokens = cfg.max_tokens;
        // Only use agents table scan_hours as default; explicit parameter takes priority
        if (typeof cfg.scan_hours === "number" && scanHoursParam === 24) scanHours = cfg.scan_hours;
        if (Array.isArray(cfg.monitored_emails)) userEmailsList = cfg.monitored_emails as string[];
      }
      addLog("Loaded config from agents table");
    } else {
      addLog("No agent record found — using defaults");
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

    const userEmails = new Set(userEmailsList.map((e) => e.toLowerCase().trim()));

    // ── Brain email config (for knowledge ingestion routing) ──
    const brainEmail = ((agentRow?.config as Record<string, unknown> | null)?.brain_email as string) || "";
    const brainEmailLower = brainEmail ? brainEmail.toLowerCase().trim() : "";
    if (brainEmailLower) {
      addLog(`Brain email configured: ${brainEmailLower}`);
    }

    // ── Entity resolver ──
    const resolver = new EntityResolver(sb);
    await resolver.load();
    addLog("Entity resolver loaded");

    // ── Load org context for classifier ──
    const orgContext = await loadOrgContext(sb);
    addLog(`Loaded org context (${orgContext.length} chars)`);

    // ── Fetch recent messages ──
    const afterTs = Math.floor((Date.now() - scanHours * 60 * 60 * 1000) / 1000);
    const query = `after:${afterTs}`;
    const listResult = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
    });

    const messages = listResult.data.messages || [];
    addLog(`Found ${messages.length} messages in the last ${scanHours} hours`);

    let recordsProcessed = 0;
    let recordsUpdated = 0;
    let skippedDupes = 0;
    let preFiltered = 0;
    let threadSkipped = 0;
    const processedEntities: Array<{ entity_type: string; entity_id: string }> = [];

    for (const msgRef of messages) {
      recordsProcessed++;
      const msgId = msgRef.id!;

      // ── Deduplication check ──
      const { data: dupeCheck } = await sb
        .schema('brain').from("correspondence")
        .select("id")
        .contains("metadata", { gmail_message_id: msgId })
        .limit(1);
      if (dupeCheck && dupeCheck.length > 0) {
        skippedDupes++;
        continue;
      }

      // ── Get full message ──
      const msgResult = await gmail.users.messages.get({
        userId: "me",
        id: msgId,
        format: "full",
      });

      const msg = msgResult.data;
      const headers: Record<string, string> = {};
      for (const h of msg.payload?.headers || []) {
        if (h.name && h.value) {
          headers[h.name.toLowerCase()] = h.value;
        }
      }

      const bodyText = getMessageBody(msg.payload as Record<string, unknown>).slice(0, 2000);

      const details: MessageDetails = {
        id: msgId,
        gmail_id: msg.id || msgId,
        thread_id: msg.threadId || "",
        from: headers["from"] || "",
        to: headers["to"] || "",
        cc: headers["cc"] || "",
        subject: headers["subject"] || "",
        date: headers["date"] || "",
        body: bodyText,
        internal_date: msg.internalDate || "",
      };

      // ── Pre-filter: skip newsletters, auto-replies, marketing, noreply ──
      const filterResult = preFilterGmail(headers, bodyText, extractEmailAddress(details.from));
      if (filterResult.action === "skip") {
        preFiltered++;
        addLog(`  Pre-filtered [${filterResult.category}]: ${details.subject.slice(0, 60)} — ${filterResult.reason}`);
        // Log to classification_log for tracking
        try {
          await sb.from("classification_log").insert({
            source: "gmail",
            source_message_id: msgId,
            thread_id: details.thread_id || null,
            from_email: extractEmailAddress(details.from),
            subject: details.subject,
            pre_filter_result: filterResult.category,
            agent_run_id: runId,
          });
        } catch { /* ignore logging error */ }
        continue;
      }

      // ── Brain email routing: route to knowledge ingestion ──
      if (brainEmailLower) {
        const toEmails_ = parseEmailList(details.to);
        const ccEmails_ = parseEmailList(details.cc);
        const allRecipients = [...toEmails_, ...ccEmails_];
        const isBrainEmail = allRecipients.some((e) => e.toLowerCase().trim() === brainEmailLower);

        if (isBrainEmail) {
          addLog(`  Brain email detected: "${details.subject.slice(0, 60)}" — routing to ingestion`);
          try {
            const baseUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

            await fetch(`${baseUrl}/api/brain/ingest`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: details.subject || "Email to Brain",
                text: `From: ${details.from}\nSubject: ${details.subject}\nDate: ${details.date}\n\n${details.body}`,
                source_type: "email",
                source_ref: msgId,
                uploaded_by: "gmail-scanner",
                metadata: {
                  from: details.from,
                  to: details.to,
                  subject: details.subject,
                  gmail_message_id: msgId,
                  thread_id: details.thread_id,
                },
              }),
            });
            addLog(`  Brain ingestion successful for: "${details.subject.slice(0, 60)}"`);
          } catch (e) {
            addLog(`  Brain ingestion failed: ${e instanceof Error ? e.message : String(e)}`);
          }
          // TODO: Also process attachments if present
          continue; // Skip normal classification for brain emails
        }
      }

      // ── Parse participants ──
      const fromEmail = extractEmailAddress(details.from);
      const fromName = extractName(details.from);
      const toEmails = parseEmailList(details.to);
      const ccEmails = parseEmailList(details.cc);

      // Filter out user's own emails from entity resolution.
      // The entity of interest is the COUNTERPARTY, not the user themselves.
      // Without this, Mark/Walt's contact records absorb every email they participate in.
      const counterpartyEmails = [fromEmail, ...toEmails, ...ccEmails]
        .filter((e) => !userEmails.has(e.toLowerCase().trim()));

      // ── Resolve entities — counterparty only (never fall back to user's own email) ──
      let allMatches = resolver.resolveMultiple(counterpartyEmails);

      // Auto-create contact for unresolved sender (skip user's own emails)
      if (allMatches.length === 0 && !userEmails.has(fromEmail)) {
        // Check if contact already exists by email
        const { data: existingByEmail } = await sb
          .schema('core').from("contacts")
          .select("id")
          .eq("email", fromEmail)
          .limit(1);

        let existingContactId: string | null = null;

        if (existingByEmail && existingByEmail.length > 0) {
          existingContactId = existingByEmail[0].id;
        }

        if (!existingContactId) {
          // Create new contact
          const senderDisplayName = fromName || fromEmail.split("@")[0];
          const nameParts = senderDisplayName.split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
          const { data: newContact } = await sb.schema('core').from("contacts").insert({
            first_name: firstName,
            last_name: lastName,
            email: fromEmail,
            source: "gmail-scanner",
          }).select("id").single();

          if (newContact) {
            existingContactId = newContact.id;
            contactsCreated++;
            addLog(`  Auto-created contact: ${senderDisplayName} <${fromEmail}>`);
          }
        }

        // Add the contact as a match so classification can proceed
        if (existingContactId) {
          allMatches.push({
            entity_type: "contacts",
            entity_id: existingContactId,
            entity_name: fromName || fromEmail,
            match_method: "auto_created",
            confidence: 0.5,
          });
        } else {
          continue; // Still couldn't resolve — skip
        }
      }

      if (allMatches.length === 0) continue; // No known entities — skip

      // ── Thread awareness: check for existing open tasks on same thread ──
      let threadContext = "";
      if (details.thread_id) {
        const { data: existingThreadTasks } = await sb
          .schema('brain').from("tasks")
          .select("id, title, status, priority, created_at, entity_type, entity_id")
          .eq("gmail_thread_id", details.thread_id)
          .in("status", ["todo", "in_progress", "open"])
          .order("created_at", { ascending: false })
          .limit(3);

        if (existingThreadTasks && existingThreadTasks.length > 0) {
          const newestTask = existingThreadTasks[0];
          const taskAgeMs = Date.now() - new Date(newestTask.created_at).getTime();
          const fortyEightHoursMs = 48 * 60 * 60 * 1000;

          if (taskAgeMs < fortyEightHoursMs) {
            // Recent open task exists — skip creating new task, but still log activity
            threadSkipped++;
            addLog(`  Thread skip (task): "${newestTask.title.slice(0, 50)}" already open (${Math.round(taskAgeMs / 3600000)}h ago)`);
            await sb.schema('brain').from("tasks").update({ updated_at: new Date().toISOString() }).eq("id", newestTask.id);

            // Use the existing task's entity info for activity logging
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const bestMatch = allMatches.find((m) => m.entity_type === "organizations") || allMatches[0];
            const skipEntityType = String((newestTask as any).entity_type || (bestMatch ? bestMatch.entity_type : "contacts"));
            const skipEntityId = ((newestTask as any).entity_id || (bestMatch ? bestMatch.entity_id : null)) as string | null;
            /* eslint-enable @typescript-eslint/no-explicit-any */

            // Still create an activity_log entry so the dashboard surfaces this conversation
            const skipDirection = determineDirection(fromEmail, userEmails);
            await sb.schema('brain').from("activity").insert({
              entity_type: skipEntityType,
              entity_id: skipEntityId,
              action: "email_scanned",
              actor: "gmail-scanner",
              metadata: {
                summary: `${details.subject.slice(0, 120)} (thread update)`,
                subject: details.subject,
                from: details.from,
                direction: skipDirection,
                tags: [],
                thread_skip: true,
                source_id: `gmail_${msgId}`,
              },
            });

            // Still create correspondence entry so it's tracked
            if (skipEntityId) {
              await sb.schema('brain').from("correspondence").insert({
                entity_type: skipEntityType,
                entity_id: skipEntityId,
                channel: "gmail",
                direction: skipDirection,
                subject: details.subject,
                body: details.body?.slice(0, 200) || null,
                from_address: fromEmail,
                to_address: toEmails[0] || null,
                sent_at: null,
                metadata: {
                  sender_name: fromName,
                  gmail_message_id: msgId,
                  source_message_id: msgId,
                },
              });
            }

            recordsUpdated++;
            addLog(`Processed (thread-update): ${details.subject.slice(0, 60)} → [${skipEntityType}] (0 tasks)`);

            try {
              await sb.from("classification_log").insert({
                source: "gmail",
                source_message_id: msgId,
                thread_id: details.thread_id,
                from_email: fromEmail,
                subject: details.subject,
                pre_filter_result: "thread_skip",
                agent_run_id: runId,
              });
            } catch { /* ignore logging error */ }
            continue;
          }

          // Older open tasks exist — tell classifier about them
          const taskLines = existingThreadTasks.map(
            (t) => `  - [${t.priority}] "${t.title}" (${t.status}, created ${new Date(t.created_at).toLocaleDateString()})`
          );
          threadContext = `EXISTING OPEN TASKS FOR THIS EMAIL THREAD:\n${taskLines.join("\n")}\nAvoid creating duplicate tasks. Only create a new task if this message introduces a genuinely new action item.`;
        }
      }

      // ── Build entity dossier for primary entity ──
      const primaryEntity = allMatches.find((m) => m.entity_type === "organizations") || allMatches[0];
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
      const result = await classifyMessage(
        anthropic,
        { subject: details.subject, body: details.body, from: details.from },
        allMatches,
        { systemPrompt: agentSystemPrompt, model: agentModel, maxTokens: agentMaxTokens },
        orgContext,
        dossierRendered,
        threadContext,
      );

      // ── Direction & date ──
      const direction = determineDirection(fromEmail, userEmails);
      let emailDate: string | null = null;
      if (details.internal_date) {
        try {
          const ts = parseInt(details.internal_date) / 1000;
          emailDate = new Date(ts * 1000).toISOString();
        } catch { /* ignore */ }
      }

      let entityType = result.primary_silo;
      let entityId = result.primary_entity_id;

      // ── Taxonomy matching & priority enforcement (Phase 1C/1D/1F) ──
      const matchedCategory = matchTaxonomyCategory(result.tags, taxonomy);
      const taxonomySlug = matchedCategory?.slug ?? null;
      const taxonomyCardKey = matchedCategory?.org_type_match?.toLowerCase() ?? null;
      const enforcedPriority = enforcePriorityRules(
        result.tags,
        result.action_items[0]?.priority ?? "medium",
        taxonomy,
      );

      // ── Auto-create organization when entity is unresolved ──
      // If the classifier couldn't find a matching org, but the email has
      // meaningful tags and a non-free-email domain, create the org and
      // link the contact — so "10X Venture Partners" becomes an Investor org.
      if (!entityId && result.tags.length > 0 && !userEmails.has(fromEmail)) {
        try {
          const taxonomy = await loadTaxonomy(sb);
          const matchedCategory = matchTaxonomyCategory(result.tags, taxonomy);

          if (matchedCategory?.org_type_match) {
            const senderDomain = fromEmail.includes("@")
              ? fromEmail.split("@")[1].toLowerCase().trim()
              : null;

            if (senderDomain && !FREE_EMAIL_DOMAINS.has(senderDomain)) {
              // Check if an org with this domain already exists
              const { data: existingOrg } = await sb
                .schema('core').from("organizations")
                .select("id, name")
                .or(`website.ilike.%${senderDomain}%,website.ilike.%${senderDomain.replace(/\.\w+$/, "")}%`)
                .limit(1);

              let orgId: string | null = null;

              if (existingOrg && existingOrg.length > 0) {
                orgId = existingOrg[0].id;
                addLog(`  Linked to existing org: ${existingOrg[0].name}`);
              } else {
                // Derive org name from domain (e.g. "10xvp.com" → "10xvp")
                // or from the sender's display name if it looks like a company
                const domainName = senderDomain.replace(/\.\w+$/, "");
                const orgName = fromName && fromName.length > domainName.length
                  ? result.primary_entity_name || domainName
                  : domainName;

                const { data: newOrg } = await sb.schema('core').from("organizations").insert({
                  name: orgName,
                  website: senderDomain,
                  source: "gmail-scanner",
                }).select("id").single();

                if (newOrg) {
                  orgId = newOrg.id;
                  // Insert org type separately
                  await sb.schema('core').from("org_types").insert({
                    org_id: newOrg.id,
                    type: matchedCategory.org_type_match,
                    status: "active",
                  });
                  // Seed pipeline entry
                  await sb.schema('crm').from("pipeline").insert({
                    org_id: newOrg.id,
                    pipeline_type: matchedCategory.org_type_match,
                    lifecycle_status: "prospect",
                    status: "new",
                  });
                  addLog(`  Auto-created org: "${orgName}" [${matchedCategory.org_type_match}] from domain ${senderDomain}`);
                }
              }

              if (orgId) {
                // Link the sender's contact to the new org
                const senderContact = allMatches.find(
                  (m) => m.entity_type === "contacts" && m.match_method === "auto_created"
                ) || allMatches.find((m) => m.entity_type === "contacts");

                if (senderContact) {
                  // Check if link already exists
                  const { data: existingLink } = await sb
                    .schema('core').from("relationships")
                    .select("id")
                    .eq("contact_id", senderContact.entity_id)
                    .eq("org_id", orgId)
                    .limit(1);

                  if (!existingLink || existingLink.length === 0) {
                    await sb.schema('core').from("relationships").insert({
                      contact_id: senderContact.entity_id,
                      org_id: orgId,
                      relationship_type: "member",
                    });
                    addLog(`  Linked contact ${senderContact.entity_name} → org ${orgId}`);
                  }
                }

                // Update entity references for this email
                entityType = "organizations";
                entityId = orgId;
              }
            }
          }
        } catch (e) {
          addLog(`  Auto-org creation failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Track processed entities for feedback computation
      if (entityId) {
        processedEntities.push({ entity_type: entityType, entity_id: entityId });
      }

      // ── Classification logging ──
      try {
        await sb.from("classification_log").insert({
          source: "gmail",
          source_message_id: msgId,
          thread_id: details.thread_id || null,
          entity_type: entityType,
          entity_id: entityId,
          entity_name: result.primary_entity_name,
          from_email: fromEmail,
          subject: details.subject,
          classification_result: {
            primary_silo: result.primary_silo,
            summary: result.summary,
            sentiment: result.sentiment,
            tags: result.tags,
            action_count: result.action_items.length,
          },
          pre_filter_result: "passed",
          dossier_summary: dossierRendered ? dossierRendered.slice(0, 500) : null,
          feedback_summary: null,
          prompt_tokens: result.prompt_tokens || null,
          completion_tokens: result.completion_tokens || null,
          model: agentModel,
          agent_run_id: runId,
        });
      } catch { /* ignore logging error */ }

      // ── Log correspondence ──
      if (entityId) {
        await sb.schema('brain').from("correspondence").insert({
          entity_type: entityType,
          entity_id: entityId,
          channel: "gmail",
          direction,
          subject: details.subject,
          body: details.body.slice(0, 200) || null,
          from_address: fromEmail,
          to_address: toEmails[0] || null,
          sent_at: emailDate,
          metadata: {
            sender_name: fromName,
            gmail_message_id: msgId,
            source_message_id: msgId,
          },
        });
      }

      // ── Create tasks (Phase 1C: enforced priority, 1E: pending_review, 1F: taxonomy_category) ──
      for (const action of result.action_items) {
        // Enforce taxonomy priority rules — only escalates, never downgrades
        const taskPriority = enforcePriorityRules(result.tags, action.priority, taxonomy);

        const taskPayload: Record<string, unknown> = {
          title: action.title,
          priority: taskPriority,
          status: "pending_review",
          source: "gmail-scanner",
        };
        if (action.summary) taskPayload.summary = action.summary;
        if (action.recommended_action) taskPayload.recommended_action = action.recommended_action;
        if (action.description) taskPayload.description = action.description;
        if (entityType) taskPayload.entity_type = entityType;
        if (entityId) taskPayload.entity_id = entityId;
        if (action.due_date) taskPayload.due_date = action.due_date;
        if (action.goal_relevance_score != null) taskPayload.goal_relevance_score = action.goal_relevance_score;
        if (details.thread_id) taskPayload.gmail_thread_id = details.thread_id;
        taskPayload.gmail_message_id = msgId;
        taskPayload.thread_id = details.thread_id || null;
        taskPayload.source_message_id = msgId;
        if (taxonomySlug) taskPayload.taxonomy_category = taxonomySlug;
        if (result.draft_reply) taskPayload.draft_reply = result.draft_reply;

        await sb.schema('brain').from("tasks").insert(taskPayload);
        tasksCreated++;
        addLog(`  Task created [${taskPriority}${taskPriority !== action.priority ? ` ↑ from ${action.priority}` : ""}]: ${action.title.slice(0, 80)}`);
      }

      // ── Log activity (Phase 1D: enriched metadata for content-aware routing) ──
      await sb.schema('brain').from("activity").insert({
        entity_type: entityType,
        entity_id: entityId,
        action: "email_scanned",
        actor: "gmail-scanner",
        metadata: {
          summary: result.summary,
          subject: details.subject,
          from: details.from,
          direction,
          tags: result.tags,
          sentiment: result.sentiment,
          action_count: result.action_items.length,
          source_id: `gmail_${msgId}`,
          taxonomy_slug: taxonomySlug,
          taxonomy_card_key: taxonomyCardKey,
          priority: enforcedPriority,
          goal_relevance: result.action_items[0]?.goal_relevance_score ?? null,
          recommended_action: result.action_items[0]?.recommended_action ?? null,
        },
      });

      recordsUpdated++;
      const entityLabel = result.primary_entity_name
        ? ` → [${entityType}] ${result.primary_entity_name}`
        : "";
      addLog(`Processed: ${details.subject.slice(0, 60)}${entityLabel} (${result.action_items.length} tasks)`);
    }

    // ── Compute entity feedback for processed entities ──
    if (processedEntities.length > 0) {
      try {
        const feedbackCount = await computeFeedbackForEntities(sb, processedEntities);
        addLog(`Computed feedback for ${feedbackCount} entities`);
      } catch (e) {
        addLog(`Feedback computation failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── Complete run ──
    if (runId) {
      await sb.schema('brain').from("agent_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output: { records_processed: recordsProcessed, records_updated: recordsUpdated },
      }).eq("id", runId);
    }

    addLog(`Completed — processed: ${recordsProcessed}, updated: ${recordsUpdated}, skipped dupes: ${skippedDupes}`);

    addLog(`Contacts auto-created: ${contactsCreated}`);
    addLog(`Pre-filtered: ${preFiltered}, Thread-skipped: ${threadSkipped}`);

    return {
      success: true,
      messagesFound: messages.length,
      processed: recordsUpdated,
      tasksCreated,
      skippedDupes,
      contactsCreated,
      preFiltered,
      threadSkipped,
      log,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    addLog(`FAILED: ${errMsg}`);

    // Mark run as failed
    if (runId) {
      try {
        await sb.schema('brain').from("agent_runs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error: errMsg,
        }).eq("id", runId);
      } catch { /* ignore cleanup error */ }
    }

    return {
      success: false,
      messagesFound: 0,
      processed: 0,
      tasksCreated: 0,
      skippedDupes: 0,
      contactsCreated: 0,
      preFiltered: 0,
      threadSkipped: 0,
      log,
      error: errMsg,
    };
  }
}
