import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadTaxonomy, getSignalKeywords } from "@/lib/taxonomy-loader";
import { runGmailScanner } from "@/lib/gmail-scanner";
import { runSlackScanner } from "@/lib/slack-scanner";

export const maxDuration = 120;

/**
 * Customer Activity Scanner
 *
 * Scans gmail + slack for new correspondence tied to Customer-type orgs,
 * then returns the latest activity rows for the dashboard.
 * Also resolves contact-level activity to their linked organizations.
 */
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, error: "Missing Supabase env vars" },
        { status: 500 },
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Trigger gmail + slack scanners directly (bypasses Vercel deployment protection)
    try {
      await runGmailScanner(sb, 24).catch((e: unknown) => {
        console.log("[customer-scanner] Gmail scanner skipped:", e instanceof Error ? e.message : String(e));
      });
    } catch {
      // Non-fatal — Gmail scanner may not be configured
    }

    try {
      await runSlackScanner(sb, 24).catch((e: unknown) => {
        console.log("[customer-scanner] Slack scanner skipped:", e instanceof Error ? e.message : String(e));
      });
    } catch {
      // Non-fatal — Slack scanner may not be configured
    }

    // 2. Fetch customer orgs via org_types
    const { data: customerTypeRows } = await sb.schema('core').from("org_types").select("org_id").eq("type", "Customer");
    const customerOrgIds = (customerTypeRows ?? []).map((t) => t.org_id);

    const [orgResult, pipelineResult] = customerOrgIds.length > 0
      ? await Promise.all([
          sb.schema('core').from("organizations").select("id, name").in("id", customerOrgIds).order("updated_at", { ascending: false }).limit(100),
          sb.schema('crm').from("pipeline").select("org_id, status").in("org_id", customerOrgIds),
        ])
      : [{ data: [] }, { data: [] }];

    const pipelineStatusMap = new Map<string, string>();
    for (const p of pipelineResult.data ?? []) pipelineStatusMap.set(p.org_id, p.status);

    const customerMap = new Map((orgResult.data ?? []).map((o) => [o.id, { ...o, pipeline_status: pipelineStatusMap.get(o.id) ?? null }]));

    // 3. Load contact → organization links to resolve contact-level activity
    const { data: orgContactLinks } = await sb
      .schema('core').from("relationships")
      .select("contact_id, org_id");

    const contactToOrgIds = new Map<string, string[]>();
    for (const link of orgContactLinks ?? []) {
      const list = contactToOrgIds.get(link.contact_id) || [];
      list.push(link.org_id);
      contactToOrgIds.set(link.contact_id, list);
    }

    // 4. Get recent activity
    const { data: recentActivity } = await sb
      .schema('brain').from("activity")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    // Load taxonomy from database for intent-based routing
    const taxonomy = await loadTaxonomy(sb);
    const CUSTOMER_TAGS = getSignalKeywords(taxonomy, "customers");

    const rows: {
      org_id: string;
      org_name: string;
      org_status: string | null;
      summary: string;
      date: string;
      suggested_action: string | null;
      suggested_deadline: string | null;
    }[] = [];
    const seenKeys = new Set<string>();

    const ACTIVITY_TYPES = new Set(["email_scanned", "slack_scanned"]);

    for (const a of recentActivity ?? []) {
      if (!ACTIVITY_TYPES.has(a.action)) continue;
      if (!a.entity_id) continue;

      const meta = (a.metadata ?? {}) as Record<string, unknown>;

      // Collect candidate org IDs: direct match + contact→org resolution
      const candidateOrgIds: string[] = [];

      if (customerMap.has(a.entity_id)) {
        candidateOrgIds.push(a.entity_id);
      }

      if (a.entity_type === "contacts" || !customerMap.has(a.entity_id)) {
        const linkedOrgs = contactToOrgIds.get(a.entity_id) || [];
        for (const orgId of linkedOrgs) {
          if (customerMap.has(orgId) && !candidateOrgIds.includes(orgId)) {
            candidateOrgIds.push(orgId);
          }
        }
      }

      if (candidateOrgIds.length > 0) {
        for (const orgId of candidateOrgIds) {
          const dedupKey = `${a.id}:${orgId}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          const org = customerMap.get(orgId)!;
          rows.push({
            org_id: org.id,
            org_name: org.name,
            org_status: org.pipeline_status,
            summary: (meta.summary as string) || "",
            date: a.created_at,
            suggested_action: null,
            suggested_deadline: null,
          });
        }
      } else {
        // Tag-based intent routing: no customer org match — check NLP tags
        const rawTags: string[] = Array.isArray(meta.tags) ? meta.tags as string[] : [];
        const matchesIntent = rawTags.some((t: string) =>
          CUSTOMER_TAGS.some((it) => t.toLowerCase().includes(it))
        );
        if (matchesIntent) {
          const dedupKey = `${a.id}:tag-intent`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          const fromLabel = (meta.from as string) || "Unknown sender";
          rows.push({
            org_id: a.entity_id,
            org_name: `📨 ${fromLabel}`,
            org_status: null,
            summary: (meta.summary as string) || "",
            date: a.created_at,
            suggested_action: null,
            suggested_deadline: null,
          });
        }
      }
    }

    // Log the scan
    await sb.schema('brain').from("activity").insert({
      entity_type: "system",
      entity_id: null,
      action: "scan",
      actor: "customer-scanner",
      metadata: { summary: `Customer activity scan complete — ${rows.length} activity items found` },
    });

    return NextResponse.json({
      success: true,
      activity: rows.slice(0, 10),
      scanned_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
