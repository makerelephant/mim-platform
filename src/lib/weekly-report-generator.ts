/**
 * Weekly Report Generator — gathers CRM data, email activity, tasks,
 * and calls Claude to produce a professional markdown summary.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PeriodType = "day" | "week" | "month";

export interface ReportResult {
  success: boolean;
  reportId?: string;
  markdown?: string;
  title?: string;
  periodStart?: string;
  periodEnd?: string;
  log: string[];
  error?: string;
}

interface GatheredData {
  // Tasks
  tasksCreated: Array<{ title: string; priority: string; status: string; entity_type: string | null; source: string; created_at: string }>;
  tasksCompleted: Array<{ title: string; priority: string; entity_type: string | null; created_at: string }>;
  tasksOpen: Array<{ title: string; priority: string; status: string; entity_type: string | null; created_at: string }>;
  // Correspondence
  emails: Array<{ subject: string; direction: string; entity_type: string | null; sender_email: string; sender_name: string | null; email_date: string | null }>;
  // Contacts
  newContacts: Array<{ name: string; email: string | null; source: string | null; primary_category: string | null; created_at: string }>;
  // Investors
  investorUpdates: Array<{ firm_name: string; stage: string | null; updated_at: string }>;
  // Communities
  communityUpdates: Array<{ org_name: string; partner_status: string | null; updated_at: string }>;
  // Activity log
  agentActivity: Array<{ agent_name: string; action_type: string; summary: string; entity_type: string | null; created_at: string }>;
}

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 4000;

// ─── Date Helpers ───────────────────────────────────────────────────────────

function computePeriodDates(periodType: PeriodType): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // start of today (exclusive)

  let start: Date;
  if (periodType === "day") {
    start = new Date(end);
    start.setDate(start.getDate() - 1);
  } else if (periodType === "week") {
    start = new Date(end);
    start.setDate(start.getDate() - 7);
  } else {
    // month
    start = new Date(end);
    start.setMonth(start.getMonth() - 1);
  }

  return { start, end };
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDateRange(start: Date, end: Date, periodType: PeriodType): string {
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  if (periodType === "day") {
    const d = new Date(start);
    return d.toLocaleDateString("en-US", opts);
  }
  return `${start.toLocaleDateString("en-US", opts)} – ${new Date(end.getTime() - 86400000).toLocaleDateString("en-US", opts)}`;
}

function periodLabel(periodType: PeriodType): string {
  if (periodType === "day") return "Daily";
  if (periodType === "week") return "Weekly";
  return "Monthly";
}

// ─── Data Gathering ─────────────────────────────────────────────────────────

async function gatherData(
  sb: SupabaseClient,
  startISO: string,
  endISO: string,
): Promise<GatheredData> {
  const [
    { data: tasksCreated },
    { data: tasksCompleted },
    { data: tasksOpen },
    { data: emails },
    { data: newContacts },
    { data: investorUpdates },
    { data: communityUpdates },
    { data: agentActivity },
  ] = await Promise.all([
    // Tasks created in period
    sb.from("tasks")
      .select("title, priority, status, entity_type, source, created_at")
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .order("created_at", { ascending: false }),
    // Tasks completed in period
    sb.from("tasks")
      .select("title, priority, entity_type, created_at")
      .eq("status", "done")
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    // Open tasks (regardless of date — for context)
    sb.from("tasks")
      .select("title, priority, status, entity_type, created_at")
      .in("status", ["todo", "in_progress"])
      .order("priority", { ascending: true })
      .limit(30),
    // Correspondence in period
    sb.from("correspondence")
      .select("subject, direction, entity_type, sender_email, sender_name, email_date")
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(100),
    // New contacts
    sb.from("contacts")
      .select("name, email, source, primary_category, created_at")
      .gte("created_at", startISO)
      .lt("created_at", endISO),
    // Investor updates
    sb.from("investors")
      .select("firm_name, stage, updated_at")
      .gte("updated_at", startISO)
      .lt("updated_at", endISO),
    // Community updates
    sb.from("soccer_orgs")
      .select("org_name, partner_status, updated_at")
      .gte("updated_at", startISO)
      .lt("updated_at", endISO),
    // Agent activity
    sb.from("activity_log")
      .select("agent_name, action_type, summary, entity_type, created_at")
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    tasksCreated: tasksCreated || [],
    tasksCompleted: tasksCompleted || [],
    tasksOpen: tasksOpen || [],
    emails: emails || [],
    newContacts: newContacts || [],
    investorUpdates: investorUpdates || [],
    communityUpdates: communityUpdates || [],
    agentActivity: agentActivity || [],
  };
}

// ─── Build Context for Claude ───────────────────────────────────────────────

function buildDataContext(data: GatheredData): string {
  const sections: string[] = [];

  // Tasks
  sections.push(`## TASKS CREATED (${data.tasksCreated.length})`);
  if (data.tasksCreated.length > 0) {
    for (const t of data.tasksCreated.slice(0, 50)) {
      sections.push(`- [${t.priority}] ${t.title} (status: ${t.status}, silo: ${t.entity_type || "general"}, source: ${t.source})`);
    }
  } else {
    sections.push("None");
  }

  sections.push(`\n## TASKS COMPLETED (${data.tasksCompleted.length})`);
  if (data.tasksCompleted.length > 0) {
    for (const t of data.tasksCompleted) {
      sections.push(`- [${t.priority}] ${t.title} (silo: ${t.entity_type || "general"})`);
    }
  } else {
    sections.push("None");
  }

  sections.push(`\n## OPEN TASKS (${data.tasksOpen.length} total)`);
  for (const t of data.tasksOpen.slice(0, 20)) {
    sections.push(`- [${t.priority}/${t.status}] ${t.title} (silo: ${t.entity_type || "general"})`);
  }

  sections.push(`\n## EMAIL CORRESPONDENCE (${data.emails.length})`);
  if (data.emails.length > 0) {
    for (const e of data.emails.slice(0, 40)) {
      sections.push(`- ${e.direction}: "${e.subject}" from ${e.sender_name || e.sender_email} (silo: ${e.entity_type || "general"})`);
    }
  } else {
    sections.push("None");
  }

  sections.push(`\n## NEW CONTACTS (${data.newContacts.length})`);
  if (data.newContacts.length > 0) {
    for (const c of data.newContacts) {
      sections.push(`- ${c.name} (${c.email || "no email"}, category: ${c.primary_category || "uncategorized"}, source: ${c.source || "manual"})`);
    }
  } else {
    sections.push("None");
  }

  sections.push(`\n## INVESTOR UPDATES (${data.investorUpdates.length})`);
  if (data.investorUpdates.length > 0) {
    for (const i of data.investorUpdates) {
      sections.push(`- ${i.firm_name} (stage: ${i.stage || "unknown"})`);
    }
  } else {
    sections.push("None");
  }

  sections.push(`\n## COMMUNITY/PARTNER UPDATES (${data.communityUpdates.length})`);
  if (data.communityUpdates.length > 0) {
    for (const c of data.communityUpdates) {
      sections.push(`- ${c.org_name} (partner status: ${c.partner_status || "none"})`);
    }
  } else {
    sections.push("None");
  }

  sections.push(`\n## AGENT ACTIVITY SUMMARY (${data.agentActivity.length} entries)`);
  if (data.agentActivity.length > 0) {
    for (const a of data.agentActivity.slice(0, 30)) {
      sections.push(`- [${a.agent_name}] ${a.summary}`);
    }
  } else {
    sections.push("None");
  }

  return sections.join("\n");
}

// ─── Main Generator ─────────────────────────────────────────────────────────

export async function runWeeklyReport(
  sb: SupabaseClient,
  periodType: PeriodType = "week",
): Promise<ReportResult> {
  const log: string[] = [];
  const addLog = (msg: string) => { log.push(msg); console.log(`[weekly-report] ${msg}`); };

  let runId: string | null = null;

  try {
    // ── Start agent run ──
    const { data: runData } = await sb.from("agent_runs").insert({
      agent_name: "weekly-report",
      status: "running",
    }).select("id").single();
    runId = runData?.id || null;
    addLog(`Started run ${runId}`);

    // ── Validate env ──
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set.");

    // ── Load agent config ──
    let model = DEFAULT_MODEL;
    let maxTokens = DEFAULT_MAX_TOKENS;

    const { data: agentRow } = await sb
      .from("agents")
      .select("system_prompt, config")
      .eq("slug", "weekly-report")
      .single();

    if (agentRow?.config) {
      const cfg = agentRow.config as Record<string, unknown>;
      if (typeof cfg.model === "string") model = cfg.model;
      if (typeof cfg.max_tokens === "number") maxTokens = cfg.max_tokens;
    }

    // ── Compute period ──
    const { start, end } = computePeriodDates(periodType);
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    const dateRange = formatDateRange(start, end, periodType);
    const title = `${periodLabel(periodType)} Updates for ${dateRange} from Mark Slater`;
    addLog(`Period: ${formatDate(start)} → ${formatDate(end)} (${periodType})`);

    // ── Gather data ──
    const data = await gatherData(sb, startISO, endISO);
    addLog(`Gathered: ${data.tasksCreated.length} tasks created, ${data.tasksCompleted.length} completed, ${data.emails.length} emails, ${data.newContacts.length} new contacts`);

    const dataContext = buildDataContext(data);

    // ── Call Claude ──
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const systemPrompt = `You are a professional business report writer for Made in Motion (MiM), a sports merchandise company.

You will receive structured CRM data covering a specific time period. Your job is to produce a polished, publishable update report in markdown format.

The report MUST follow this exact structure:

# ${title}

## Accomplished & Completed
Items that were definitively completed, resolved, or accomplished during this period. These are wins and closed items. Group by business category.

## In Progress & Ongoing
Activities undertaken that don't yet have a definitive outcome — meetings scheduled, deals in negotiation, outreach sent, follow-ups pending. Group by business category.

## FYI & Miscellaneous
Simple informational updates for context — new contacts added, newsletters received, automated notifications, minor updates. Keep this brief.

---

**Business categories to use:** Investors, Partners, Business, Admin, Communications, Product & Tech

**Guidelines:**
- Write in a professional, concise tone suitable for a business update
- Use bullet points within each category
- Include specific names, firms, and details from the data
- If a category has no activity, omit it (don't show empty sections)
- Prioritize high-impact items first within each section
- Keep the total report length reasonable (aim for 1-2 pages when printed)
- Do NOT include raw data dumps — synthesize and summarize
- Do NOT add a header or title — I will add that separately
- Start directly with "## Accomplished & Completed"`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Here is the CRM data for the period ${formatDate(start)} to ${formatDate(end)}:\n\n${dataContext}`,
      }],
    });

    let reportBody = (response.content[0] as { type: "text"; text: string }).text.trim();
    addLog("Claude generated report");

    // ── Assemble final markdown ──
    const markdown = `# ${title}\n\n${reportBody}`;

    // ── Save to DB ──
    const { data: reportRow, error: insertErr } = await sb.from("reports").insert({
      title,
      slug: `${periodType}-${formatDate(start)}-${formatDate(end)}`,
      period_type: periodType,
      period_start: formatDate(start),
      period_end: formatDate(end),
      markdown_content: markdown,
      agent_slug: "weekly-report",
      status: "completed",
      metadata: {
        tasksCreated: data.tasksCreated.length,
        tasksCompleted: data.tasksCompleted.length,
        emailsProcessed: data.emails.length,
        newContacts: data.newContacts.length,
        model,
      },
    }).select("id").single();

    if (insertErr) throw new Error(`Failed to save report: ${insertErr.message}`);

    addLog(`Report saved: ${reportRow?.id}`);

    // ── Log activity ──
    await sb.from("activity_log").insert({
      agent_name: "weekly-report",
      action_type: "report_generated",
      summary: `Generated ${periodType} report: ${title}`,
      raw_data: { report_id: reportRow?.id, period_type: periodType },
    });

    // ── Complete run ──
    if (runId) {
      await sb.from("agent_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_processed: data.emails.length + data.tasksCreated.length,
        records_updated: 1,
      }).eq("id", runId);
    }

    return {
      success: true,
      reportId: reportRow?.id,
      markdown,
      title,
      periodStart: formatDate(start),
      periodEnd: formatDate(end),
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

    return { success: false, log, error: errMsg };
  }
}
