import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chunkText, embedBatch, estimateTokens } from "@/lib/embeddings";

export const maxDuration = 300;

/**
 * POST /api/brain/embed-crm
 * GET  /api/brain/embed-crm
 *
 * Converts all CRM operational data into embedded knowledge chunks.
 * This gives the brain deep, searchable knowledge of every organization,
 * contact, pipeline deal, and correspondence record in the system.
 *
 * Query params:
 *   ?type=organizations|contacts|pipeline|correspondence|feed_cards|all (default: all)
 *   ?batch=10  (number of records per call, default: 10)
 *   ?force=true (re-embed even if chunks already exist)
 *
 * Each record is converted into a rich text dossier, chunked, embedded,
 * and stored in brain.knowledge_chunks with source metadata.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface EmbedResult {
  type: string;
  processed: number;
  skipped: number;
  errors: string[];
  remaining: number;
}

// ── Dossier builders: convert CRM records into rich searchable text ──

function buildOrgDossier(org: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`# Organization: ${org.name || "Unknown"}`);
  parts.push(`Type: ${org.type || "unknown"} | Status: ${org.status || "unknown"} | Industry: ${org.industry || "unknown"}`);
  if (org.website) parts.push(`Website: ${org.website}`);
  if (org.phone) parts.push(`Phone: ${org.phone}`);
  if (org.email) parts.push(`Email: ${org.email}`);
  if (org.address_line1 || org.city || org.state) {
    parts.push(`Location: ${[org.address_line1, org.city, org.state, org.country].filter(Boolean).join(", ")}`);
  }
  if (org.description) parts.push(`\nDescription: ${org.description}`);
  if (org.notes) parts.push(`\nNotes: ${org.notes}`);
  if (org.tags && Array.isArray(org.tags) && org.tags.length > 0) {
    parts.push(`Tags: ${org.tags.join(", ")}`);
  }
  if (org.metadata && typeof org.metadata === "object") {
    const meta = org.metadata as Record<string, unknown>;
    if (meta.linkedin_url) parts.push(`LinkedIn: ${meta.linkedin_url}`);
    if (meta.annual_revenue) parts.push(`Annual Revenue: ${meta.annual_revenue}`);
    if (meta.employee_count) parts.push(`Employees: ${meta.employee_count}`);
  }
  return parts.join("\n");
}

function buildContactDossier(contact: Record<string, unknown>, orgName?: string): string {
  const parts: string[] = [];
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";
  parts.push(`# Contact: ${name}`);
  if (contact.role || contact.title) parts.push(`Role: ${contact.role || contact.title || "unknown"}`);
  if (orgName) parts.push(`Organization: ${orgName}`);
  if (contact.email) parts.push(`Email: ${contact.email}`);
  if (contact.phone) parts.push(`Phone: ${contact.phone}`);
  if (contact.linkedin_url) parts.push(`LinkedIn: ${contact.linkedin_url}`);
  if (contact.source) parts.push(`Source: ${contact.source}`);
  if (contact.notes) parts.push(`\nNotes: ${contact.notes}`);
  if (contact.tags && Array.isArray(contact.tags) && contact.tags.length > 0) {
    parts.push(`Tags: ${contact.tags.join(", ")}`);
  }
  return parts.join("\n");
}

function buildPipelineDossier(deal: Record<string, unknown>, orgName?: string): string {
  const parts: string[] = [];
  parts.push(`# Pipeline Deal: ${deal.title || deal.name || "Untitled"}`);
  if (orgName) parts.push(`Organization: ${orgName}`);
  parts.push(`Stage: ${deal.stage || "unknown"} | Status: ${deal.status || "unknown"}`);
  if (deal.value || deal.amount) parts.push(`Value: $${deal.value || deal.amount}`);
  if (deal.probability) parts.push(`Probability: ${deal.probability}%`);
  if (deal.expected_close_date) parts.push(`Expected Close: ${deal.expected_close_date}`);
  if (deal.owner) parts.push(`Owner: ${deal.owner}`);
  if (deal.source) parts.push(`Source: ${deal.source}`);
  if (deal.description) parts.push(`\nDescription: ${deal.description}`);
  if (deal.notes) parts.push(`\nNotes: ${deal.notes}`);
  return parts.join("\n");
}

function buildCorrespondenceDossier(corr: Record<string, unknown>): string {
  const parts: string[] = [];
  const dir = corr.direction === "outbound" ? "SENT" : "RECEIVED";
  parts.push(`# Correspondence: ${corr.subject || "No Subject"}`);
  parts.push(`Channel: ${corr.channel || "email"} | Direction: ${dir}`);
  if (corr.from_address) parts.push(`From: ${corr.from_address}`);
  if (corr.to_addresses) parts.push(`To: ${corr.to_addresses}`);
  if (corr.sent_at) parts.push(`Date: ${new Date(corr.sent_at as string).toLocaleDateString()}`);
  if (corr.content) {
    // Include FULL content — no truncation. This is the whole point.
    parts.push(`\n${corr.content}`);
  }
  if (corr.summary) parts.push(`\nSummary: ${corr.summary}`);
  return parts.join("\n");
}

function buildFeedCardDossier(card: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`# Feed Card: ${card.title || "Untitled"}`);
  parts.push(`Type: ${card.card_type || "unknown"} | Priority: ${card.priority || "medium"} | Category: ${card.acumen_category || "uncategorized"}`);
  if (card.source_type) parts.push(`Source: ${card.source_type}`);
  if (card.ceo_action) parts.push(`CEO Action: ${card.ceo_action}`);
  if (card.body) {
    parts.push(`\n${card.body}`);
  }
  if (card.action_recommendation) parts.push(`\nRecommendation: ${card.action_recommendation}`);
  return parts.join("\n");
}

// ── Core embedding function ──

async function embedRecords(
  sb: SB,
  records: Record<string, unknown>[],
  sourceType: string,
  dossierBuilder: (r: Record<string, unknown>, extra?: string) => string,
  existingTitles: Set<string>,
  force: boolean,
  orgLookup?: Map<string, string>,
): Promise<EmbedResult> {
  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const record of records) {
    const id = record.id as string;
    const name = String(record.name || record.title || record.first_name || record.subject || id).slice(0, 200);
    const kbTitle = `[CRM ${sourceType}] ${name}`;

    // Skip if already embedded (unless force)
    if (!force && existingTitles.has(kbTitle)) {
      skipped++;
      continue;
    }

    try {
      // Build the rich text dossier
      let orgName: string | undefined;
      if (orgLookup && record.organization_id) {
        orgName = orgLookup.get(record.organization_id as string);
      }
      const dossier = dossierBuilder(record, orgName);
      if (dossier.trim().length < 10) {
        skipped++;
        continue;
      }

      // Chunk the dossier
      const chunks = chunkText(dossier, 500);
      if (chunks.length === 0) {
        skipped++;
        continue;
      }

      // Generate embeddings in batch
      const embeddings = await embedBatch(chunks);
      if (embeddings.length === 0) {
        errors.push(`${id}: embedding generation returned empty`);
        continue;
      }

      // If force mode, delete existing kb entry + chunks
      if (force && existingTitles.has(kbTitle)) {
        const { data: existingKb } = await sb
          .from("knowledge_base")
          .select("id")
          .eq("title", kbTitle)
          .limit(1);
        if (existingKb?.[0]) {
          await sb.schema("brain").from("knowledge_chunks").delete().eq("kb_id", existingKb[0].id);
          await sb.from("knowledge_base").delete().eq("id", existingKb[0].id);
        }
      }

      // Create knowledge_base entry first (foreign key parent)
      const { data: kbInsert, error: kbError } = await sb
        .from("knowledge_base")
        .insert({
          title: kbTitle,
          source_type: `crm_${sourceType}`,
          source_ref: id,
          content_text: dossier,
          summary: dossier.slice(0, 300),
          tags: ["crm", sourceType, "auto-embedded"],
          processed: true,
          processed_at: new Date().toISOString(),
          metadata: { entity_type: sourceType, entity_id: id },
        })
        .select("id")
        .single();

      if (kbError || !kbInsert) {
        errors.push(`${id}: kb insert failed — ${kbError?.message}`);
        continue;
      }

      // Build chunk rows linked to the new kb entry
      const chunkRows = chunks.map((chunk: string, idx: number) => ({
        kb_id: kbInsert.id,
        chunk_index: idx,
        content: chunk,
        token_count: estimateTokens(chunk),
        embedding: `[${embeddings[idx].join(",")}]`,
        metadata: {
          title: name,
          source_type: `crm_${sourceType}`,
          entity_type: sourceType,
          entity_id: id,
        },
      }));

      // Insert chunks
      const { error: insertError } = await sb
        .schema("brain")
        .from("knowledge_chunks")
        .insert(chunkRows);

      if (insertError) {
        errors.push(`${id}: chunk insert failed — ${insertError.message}`);
      } else {
        processed++;
        existingTitles.add(kbTitle);
      }
    } catch (err) {
      errors.push(`${id}: ${String(err)}`);
    }
  }

  return {
    type: sourceType,
    processed,
    skipped,
    errors,
    remaining: 0,
  };
}

// ── Main handler ──

async function handleEmbedCRM(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ success: false, error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "all";
  const batchSize = Math.min(parseInt(url.searchParams.get("batch") || "10"), 50);
  const force = url.searchParams.get("force") === "true";

  // Get existing CRM knowledge entries to skip duplicates
  const { data: existingKb } = await sb
    .from("knowledge_base")
    .select("title")
    .like("source_type", "crm_%");
  const existingTitles = new Set(
    (existingKb || []).map((r: { title: string }) => r.title)
  );

  const results: EmbedResult[] = [];

  // ── Organizations ──
  if (type === "all" || type === "organizations") {
    const { data: orgs, count: totalOrgs } = await sb
      .schema("core")
      .from("organizations")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(batchSize);

    if (orgs && orgs.length > 0) {
      const result = await embedRecords(sb, orgs, "organization", buildOrgDossier, existingTitles, force);
      result.remaining = Math.max(0, (totalOrgs || 0) - batchSize);
      results.push(result);
    }
  }

  // ── Contacts ──
  if (type === "all" || type === "contacts") {
    // Build org lookup for contact→org name resolution
    const { data: allOrgs } = await sb
      .schema("core")
      .from("organizations")
      .select("id, name");
    const orgLookup = new Map<string, string>();
    (allOrgs || []).forEach((o: { id: string; name: string }) => orgLookup.set(o.id, o.name));

    // Get contacts with their org links
    const { data: contacts, count: totalContacts } = await sb
      .schema("core")
      .from("contacts")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(batchSize);

    // For each contact, try to resolve their org via junction table
    if (contacts && contacts.length > 0) {
      const contactIds = contacts.map((c: Record<string, unknown>) => c.id as string);
      const { data: orgLinks } = await sb
        .schema("core")
        .from("organization_contacts")
        .select("contact_id, organization_id")
        .in("contact_id", contactIds);

      const contactOrgLookup = new Map<string, string>();
      (orgLinks || []).forEach((link: { contact_id: string; organization_id: string }) => {
        const orgName = orgLookup.get(link.organization_id);
        if (orgName) contactOrgLookup.set(link.contact_id, orgName);
      });

      const result = await embedRecords(
        sb,
        contacts,
        "contact",
        (r, extra) => buildContactDossier(r, extra || contactOrgLookup.get(r.id as string)),
        existingTitles,
        force,
      );
      result.remaining = Math.max(0, (totalContacts || 0) - batchSize);
      results.push(result);
    }
  }

  // ── Pipeline ──
  if (type === "all" || type === "pipeline") {
    const { data: allOrgs } = await sb
      .schema("core")
      .from("organizations")
      .select("id, name");
    const orgLookup = new Map<string, string>();
    (allOrgs || []).forEach((o: { id: string; name: string }) => orgLookup.set(o.id, o.name));

    const { data: deals, count: totalDeals } = await sb
      .schema("crm")
      .from("pipeline")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false })
      .limit(batchSize);

    if (deals && deals.length > 0) {
      const result = await embedRecords(sb, deals, "pipeline", (r) => buildPipelineDossier(r, orgLookup.get(r.organization_id as string)), existingTitles, force);
      result.remaining = Math.max(0, (totalDeals || 0) - batchSize);
      results.push(result);
    }
  }

  // ── Correspondence ──
  if (type === "all" || type === "correspondence") {
    const { data: corrs, count: totalCorr } = await sb
      .schema("brain")
      .from("correspondence")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false })
      .limit(batchSize);

    if (corrs && corrs.length > 0) {
      const result = await embedRecords(sb, corrs, "correspondence", buildCorrespondenceDossier, existingTitles, force);
      result.remaining = Math.max(0, (totalCorr || 0) - batchSize);
      results.push(result);
    }
  }

  // ── Feed Cards ──
  if (type === "all" || type === "feed_cards") {
    const { data: cards, count: totalCards } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (cards && cards.length > 0) {
      const result = await embedRecords(sb, cards, "feed_card", buildFeedCardDossier, existingTitles, force);
      result.remaining = Math.max(0, (totalCards || 0) - batchSize);
      results.push(result);
    }
  }

  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalRemaining = results.reduce((sum, r) => sum + r.remaining, 0);
  const allErrors = results.flatMap((r) => r.errors);

  return NextResponse.json({
    success: true,
    processed: totalProcessed,
    skipped: totalSkipped,
    remaining: totalRemaining,
    errors: allErrors,
    breakdown: results.map((r) => ({
      type: r.type,
      processed: r.processed,
      skipped: r.skipped,
      remaining: r.remaining,
      errors: r.errors.length,
    })),
    message: totalRemaining > 0
      ? `Processed ${totalProcessed} records. ${totalRemaining} remaining — call again to continue.`
      : `All records processed. ${totalProcessed} embedded, ${totalSkipped} skipped.`,
  });
}

export async function POST(request: NextRequest) {
  return handleEmbedCRM(request);
}

export async function GET(request: NextRequest) {
  return handleEmbedCRM(request);
}
