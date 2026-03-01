/**
 * Gmail Scanner — TypeScript port of the Python agent system.
 * Runs natively on Vercel serverless functions.
 *
 * Combines: agent_base, entity_resolver, classifier, gmail-scanner
 */

import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EntityMatch {
  entity_type: string; // "contacts", "investors", "soccer_orgs"
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

const CLASSIFIER_SYSTEM_PROMPT = `You are an AI assistant that classifies business communications for a sports merchandise company called Made in Motion (MiM).

MiM works with three main entity types:
1. **Investors** — venture capital firms, angel investors, seed funds. Communications about fundraising, cap tables, term sheets, due diligence, pitch decks, portfolio updates, financial projections.
2. **Communities (soccer_orgs)** — youth soccer organizations, clubs, leagues in Massachusetts. Communications about partnerships, merchandise, tournaments, player registrations, outreach, sponsorships, uniforms, team stores.
3. **Contacts** — general contacts, networking, personal relationships that don't clearly fit investors or communities.

You will receive:
- The message content (subject, body, sender)
- A list of resolved entities that the sender/recipients match to in our database

Your job:
1. **Classify** which silo this message primarily belongs to (investors, soccer_orgs, or contacts)
2. **Pick the primary entity** from the resolved list (or null if none match well)
3. **Summarize** the message in one concise line
4. **Extract action items** with appropriate priorities:
   - critical: urgent deadlines, legal issues, compliance, time-sensitive investor requests
   - high: meeting requests, term sheet discussions, partnership proposals, investor follow-ups, deal updates
   - medium: general follow-ups, status updates, introductions, scheduling
   - low: newsletters, FYI emails, automated notifications, mass emails
5. **Tag** the message with relevant categories

Respond with ONLY a JSON object in this exact format:
{
  "primary_silo": "investors" | "soccer_orgs" | "contacts",
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
  "tags": ["follow-up", "meeting-request", "deal-update", "partnership", "intro-request", "merch", "newsletter", etc.]
}

IMPORTANT:
- If there are no action items, return an empty array []
- Task titles should be actionable and specific
- Only extract genuine action items that require the user to do something
- Skip automated notifications, marketing emails, and spam
- If the email is clearly automated/newsletter, set primary_silo to "contacts" and return no action items

For each action item, separate CONTEXT from ACTION:
- "summary" = the background/situation
- "recommended_action" = what to do about it
- "goal_relevance_score" = how relevant this is to the company's 90-day strategic goals (1=tangential, 5=moderately relevant, 10=directly critical to fundraising/partnerships). Only set this if you can reasonably infer relevance.`;

// ─── Entity Resolver ────────────────────────────────────────────────────────

class EntityResolver {
  private emailToContacts: Map<string, { id: string; name: string; organization?: string }> = new Map();
  private contactToInvestors: Map<string, { id: string; name: string }[]> = new Map();
  private contactToOrgs: Map<string, { id: string; name: string }[]> = new Map();
  private domainToInvestors: Map<string, { id: string; name: string }> = new Map();
  private domainToOrgs: Map<string, { id: string; name: string }> = new Map();

  constructor(private sb: SupabaseClient) {}

  async load(): Promise<void> {
    // 1. Load contacts
    const { data: contacts } = await this.sb.from("contacts").select("id, name, email, organization");
    for (const c of contacts || []) {
      if (c.email) {
        this.emailToContacts.set(c.email.toLowerCase().trim(), {
          id: c.id, name: c.name, organization: c.organization,
        });
      }
    }

    // 2. Load contact_emails junction
    const { data: contactEmails } = await this.sb.from("contact_emails").select("contact_id, email");
    for (const ce of contactEmails || []) {
      const emailLower = ce.email.toLowerCase().trim();
      if (!this.emailToContacts.has(emailLower)) {
        const contactMatch = (contacts || []).find((c: { id: string }) => c.id === ce.contact_id);
        if (contactMatch) {
          this.emailToContacts.set(emailLower, {
            id: contactMatch.id, name: contactMatch.name, organization: contactMatch.organization,
          });
        }
      }
    }

    // 3. Load investor_contacts junction
    const { data: invContacts } = await this.sb
      .from("investor_contacts")
      .select("contact_id, investor_id, investors(id, firm_name)");
    for (const ic of invContacts || []) {
      const inv = ic.investors as unknown as { id: string; firm_name: string } | null;
      if (inv) {
        const list = this.contactToInvestors.get(ic.contact_id) || [];
        list.push({ id: inv.id, name: inv.firm_name });
        this.contactToInvestors.set(ic.contact_id, list);
      }
    }

    // 4. Load soccer_org_contacts junction
    const { data: orgContacts } = await this.sb
      .from("soccer_org_contacts")
      .select("contact_id, soccer_org_id, soccer_orgs(id, org_name)");
    for (const oc of orgContacts || []) {
      const org = oc.soccer_orgs as unknown as { id: string; org_name: string } | null;
      if (org) {
        const list = this.contactToOrgs.get(oc.contact_id) || [];
        list.push({ id: org.id, name: org.org_name });
        this.contactToOrgs.set(oc.contact_id, list);
      }
    }

    // 5. Domain -> investor mapping
    const { data: investors } = await this.sb
      .from("investors")
      .select("id, firm_name, website")
      .not("website", "is", null);
    for (const inv of investors || []) {
      const domain = this.extractDomain(inv.website);
      if (domain) {
        this.domainToInvestors.set(domain, { id: inv.id, name: inv.firm_name });
      }
    }

    // 6. Domain -> soccer_org mapping
    const { data: orgs } = await this.sb
      .from("soccer_orgs")
      .select("id, org_name, website")
      .not("website", "is", null);
    for (const org of orgs || []) {
      const domain = this.extractDomain(org.website);
      if (domain) {
        this.domainToOrgs.set(domain, { id: org.id, name: org.org_name });
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

      // Step 2: Contact -> linked investors
      for (const inv of this.contactToInvestors.get(contact.id) || []) {
        const invKey = `investors:${inv.id}`;
        if (!seen.has(invKey)) {
          seen.add(invKey);
          matches.push({
            entity_type: "investors", entity_id: inv.id,
            entity_name: inv.name, match_method: "email_junction", confidence: 0.9,
          });
        }
      }

      // Step 3: Contact -> linked communities
      for (const org of this.contactToOrgs.get(contact.id) || []) {
        const orgKey = `soccer_orgs:${org.id}`;
        if (!seen.has(orgKey)) {
          seen.add(orgKey);
          matches.push({
            entity_type: "soccer_orgs", entity_id: org.id,
            entity_name: org.name, match_method: "email_junction", confidence: 0.9,
          });
        }
      }
    }

    // Step 4: Domain fallback
    if (matches.length === 0) {
      const domain = this.extractEmailDomain(email);
      if (domain) {
        const inv = this.domainToInvestors.get(domain);
        if (inv && !seen.has(`investors:${inv.id}`)) {
          seen.add(`investors:${inv.id}`);
          matches.push({
            entity_type: "investors", entity_id: inv.id,
            entity_name: inv.name, match_method: "domain_fallback", confidence: 0.6,
          });
        }
        const org = this.domainToOrgs.get(domain);
        if (org && !seen.has(`soccer_orgs:${org.id}`)) {
          seen.add(`soccer_orgs:${org.id}`);
          matches.push({
            entity_type: "soccer_orgs", entity_id: org.id,
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
): Promise<ClassificationResult> {
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
  const userPrompt = `${entityContext}\n\n---\n\n${msgContent}`;

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
    const { data: runData } = await sb.from("agent_runs").insert({
      agent_name: "gmail-scanner",
      status: "running",
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
        if (typeof cfg.scan_hours === "number") scanHours = cfg.scan_hours;
        if (Array.isArray(cfg.monitored_emails)) userEmailsList = cfg.monitored_emails as string[];
      }
      addLog("Loaded config from agents table");
    } else {
      addLog("No agent record found — using defaults");
    }

    const userEmails = new Set(userEmailsList.map((e) => e.toLowerCase().trim()));

    // ── Entity resolver ──
    const resolver = new EntityResolver(sb);
    await resolver.load();
    addLog("Entity resolver loaded");

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

    for (const msgRef of messages) {
      recordsProcessed++;
      const msgId = msgRef.id!;

      // ── Deduplication check ──
      const { data: dupeCheck } = await sb
        .from("correspondence")
        .select("id")
        .eq("gmail_message_id", msgId)
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

      // ── Parse participants ──
      const fromEmail = extractEmailAddress(details.from);
      const fromName = extractName(details.from);
      const toEmails = parseEmailList(details.to);
      const ccEmails = parseEmailList(details.cc);
      const allParticipantEmails = [fromEmail, ...toEmails, ...ccEmails];

      // ── Resolve entities ──
      const allMatches = resolver.resolveMultiple(allParticipantEmails);

      // Auto-create contact for unresolved sender (skip user's own emails)
      if (allMatches.length === 0 && !userEmails.has(fromEmail)) {
        // Check if contact already exists by email
        const { data: existingByEmail } = await sb
          .from("contacts")
          .select("id")
          .eq("email", fromEmail)
          .limit(1);

        let existingContactId: string | null = null;

        if (existingByEmail && existingByEmail.length > 0) {
          existingContactId = existingByEmail[0].id;
        } else {
          // Also check contact_emails junction
          const { data: existingByJunction } = await sb
            .from("contact_emails")
            .select("contact_id")
            .eq("email", fromEmail)
            .limit(1);

          if (existingByJunction && existingByJunction.length > 0) {
            existingContactId = existingByJunction[0].contact_id;
          }
        }

        if (!existingContactId) {
          // Create new contact
          const senderDisplayName = fromName || fromEmail.split("@")[0];
          const { data: newContact } = await sb.from("contacts").insert({
            name: senderDisplayName,
            email: fromEmail,
            primary_category: "uncategorized",
            source: "gmail-scanner",
          }).select("id").single();

          if (newContact) {
            existingContactId = newContact.id;
            // Also create contact_emails junction entry
            await sb.from("contact_emails").insert({
              contact_id: newContact.id,
              email: fromEmail,
            });
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

      // ── Classify ──
      const result = await classifyMessage(
        anthropic,
        { subject: details.subject, body: details.body, from: details.from },
        allMatches,
        { systemPrompt: agentSystemPrompt, model: agentModel, maxTokens: agentMaxTokens },
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

      const entityType = result.primary_silo;
      const entityId = result.primary_entity_id;

      // ── Log correspondence ──
      if (entityId) {
        await sb.from("correspondence").insert({
          entity_type: entityType,
          entity_id: entityId,
          direction,
          subject: details.subject,
          snippet: details.body.slice(0, 200) || null,
          sender_email: fromEmail,
          sender_name: fromName,
          recipient_email: toEmails[0] || null,
          email_date: emailDate,
          source: "gmail",
          gmail_message_id: msgId,
          source_message_id: msgId,
        });
      }

      // ── Create tasks ──
      for (const action of result.action_items) {
        const taskPayload: Record<string, unknown> = {
          title: action.title,
          priority: action.priority,
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

        await sb.from("tasks").insert(taskPayload);
        tasksCreated++;
        addLog(`  Task created [${action.priority}]: ${action.title.slice(0, 80)}`);
      }

      // ── Log activity ──
      await sb.from("activity_log").insert({
        agent_name: "gmail-scanner",
        action_type: "email_scanned",
        entity_type: entityType,
        entity_id: entityId,
        summary: result.summary,
        raw_data: {
          subject: details.subject,
          from: details.from,
          direction,
          tags: result.tags,
          sentiment: result.sentiment,
          action_count: result.action_items.length,
        },
        source_id: `gmail_${msgId}`,
      });

      recordsUpdated++;
      const entityLabel = result.primary_entity_name
        ? ` → [${entityType}] ${result.primary_entity_name}`
        : "";
      addLog(`Processed: ${details.subject.slice(0, 60)}${entityLabel} (${result.action_items.length} tasks)`);
    }

    // ── Complete run ──
    if (runId) {
      await sb.from("agent_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_processed: recordsProcessed,
        records_updated: recordsUpdated,
      }).eq("id", runId);
    }

    addLog(`Completed — processed: ${recordsProcessed}, updated: ${recordsUpdated}, skipped dupes: ${skippedDupes}`);

    addLog(`Contacts auto-created: ${contactsCreated}`);

    return {
      success: true,
      messagesFound: messages.length,
      processed: recordsUpdated,
      tasksCreated,
      skippedDupes,
      contactsCreated,
      log,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    addLog(`FAILED: ${errMsg}`);

    // Mark run as failed
    if (runId) {
      try {
        await sb.from("agent_runs").update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errMsg,
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
      log,
      error: errMsg,
    };
  }
}
