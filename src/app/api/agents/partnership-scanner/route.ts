import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadTaxonomy, getSignalKeywords } from "@/lib/taxonomy-loader";

export const maxDuration = 120;

/**
 * Partnership Activity Scanner
 *
 * Scans gmail + slack for new correspondence tied to Partner-type orgs,
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

    // 1. Trigger gmail + slack scanners if available
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      await fetch(`${baseUrl}/api/agents/gmail-scanner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHours: 24 }),
      }).catch(() => {});

      await fetch(`${baseUrl}/api/agents/slack-scanner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHours: 24 }),
      }).catch(() => {});
    } catch {
      // Non-fatal — scanners may not be configured yet
    }

    // 2. Fetch partner orgs
    const { data: partnerOrgs } = await sb
      .from("organizations")
      .select("id, name, partner_status")
      .contains("org_type", ["Partner"])
      .order("updated_at", { ascending: false })
      .limit(100);

    const partnerMap = new Map((partnerOrgs ?? []).map((o) => [o.id, o]));

    // 3. Load contact → organization links to resolve contact-level activity
    const { data: orgContactLinks } = await sb
      .from("organization_contacts")
      .select("contact_id, organization_id");

    const contactToOrgIds = new Map<string, string[]>();
    for (const link of orgContactLinks ?? []) {
      const list = contactToOrgIds.get(link.contact_id) || [];
      list.push(link.organization_id);
      contactToOrgIds.set(link.contact_id, list);
    }

    // 4. Get recent activity
    const { data: recentActivity } = await sb
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    // Load taxonomy from database for intent-based routing
    const taxonomy = await loadTaxonomy(sb);
    const PARTNER_TAGS = getSignalKeywords(taxonomy, "partners");

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

    for (const a of recentActivity ?? []) {
      if (!a.entity_id) continue;

      // Collect candidate org IDs: direct match + contact→org resolution
      const candidateOrgIds: string[] = [];

      if (partnerMap.has(a.entity_id)) {
        candidateOrgIds.push(a.entity_id);
      }

      if (a.entity_type === "contacts" || !partnerMap.has(a.entity_id)) {
        const linkedOrgs = contactToOrgIds.get(a.entity_id) || [];
        for (const orgId of linkedOrgs) {
          if (partnerMap.has(orgId) && !candidateOrgIds.includes(orgId)) {
            candidateOrgIds.push(orgId);
          }
        }
      }

      if (candidateOrgIds.length > 0) {
        for (const orgId of candidateOrgIds) {
          const dedupKey = `${a.id}:${orgId}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          const org = partnerMap.get(orgId)!;
          rows.push({
            org_id: org.id,
            org_name: org.name,
            org_status: org.partner_status,
            summary: a.summary,
            date: a.created_at,
            suggested_action: null,
            suggested_deadline: null,
          });
        }
      } else {
        // Tag-based intent routing: no partner org match — check NLP tags
        const rawTags: string[] = Array.isArray(a.raw_data?.tags) ? a.raw_data.tags : [];
        const matchesIntent = rawTags.some((t: string) =>
          PARTNER_TAGS.some((it) => t.toLowerCase().includes(it))
        );
        if (matchesIntent) {
          const dedupKey = `${a.id}:tag-intent`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          const fromLabel = a.raw_data?.from || "Unknown sender";
          rows.push({
            org_id: a.entity_id,
            org_name: `📨 ${fromLabel}`,
            org_status: null,
            summary: a.summary,
            date: a.created_at,
            suggested_action: null,
            suggested_deadline: null,
          });
        }
      }
    }

    // Log the scan
    await sb.from("activity_log").insert({
      agent_name: "partnership-scanner",
      action_type: "scan",
      summary: `Partnership activity scan complete — ${rows.length} activity items found`,
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
