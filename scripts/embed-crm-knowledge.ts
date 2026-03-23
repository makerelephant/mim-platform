/**
 * CRM Knowledge Embedding Script
 *
 * Converts all CRM operational data (organizations, contacts, pipeline,
 * correspondence, feed cards) into embedded knowledge chunks.
 *
 * Usage: npx tsx scripts/embed-crm-knowledge.ts [--type=all] [--batch=20] [--force]
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { config } from "dotenv";
// Try Vercel env first (has OPENAI_API_KEY), fall back to .env.local
config({ path: ".env.local.vercel" });
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY) as any;
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ── Embedding helpers ──

async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100).map((t) => t.slice(0, 32000));
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
      dimensions: 1536,
    });
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }
  return results;
}

function chunkText(text: string, maxChars = 2000): string[] {
  if (!text || text.trim().length === 0) return [];
  if (text.length <= maxChars) return [text.trim()];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (current.length + trimmed.length + 2 <= maxChars) {
      current += (current ? "\n\n" : "") + trimmed;
    } else {
      if (current) chunks.push(current.trim());
      if (trimmed.length > maxChars) {
        for (let i = 0; i < trimmed.length; i += maxChars) {
          chunks.push(trimmed.slice(i, i + maxChars).trim());
        }
        current = "";
      } else {
        current = trimmed;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 0);
}

// ── Dossier builders ──

function orgDossier(org: any): string {
  const p: string[] = [];
  p.push(`# Organization: ${org.name || "Unknown"}`);
  p.push(`Type: ${org.type || "unknown"} | Status: ${org.status || "unknown"} | Industry: ${org.industry || "unknown"}`);
  if (org.website) p.push(`Website: ${org.website}`);
  if (org.phone) p.push(`Phone: ${org.phone}`);
  if (org.email) p.push(`Email: ${org.email}`);
  if (org.address_line1 || org.city || org.state) {
    p.push(`Location: ${[org.address_line1, org.city, org.state, org.country].filter(Boolean).join(", ")}`);
  }
  if (org.description) p.push(`\nDescription: ${org.description}`);
  if (org.notes) p.push(`\nNotes: ${org.notes}`);
  if (org.tags?.length) p.push(`Tags: ${org.tags.join(", ")}`);
  return p.join("\n");
}

function contactDossier(contact: any, orgName?: string): string {
  const p: string[] = [];
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";
  p.push(`# Contact: ${name}`);
  if (contact.role || contact.title) p.push(`Role: ${contact.role || contact.title}`);
  if (orgName) p.push(`Organization: ${orgName}`);
  if (contact.email) p.push(`Email: ${contact.email}`);
  if (contact.phone) p.push(`Phone: ${contact.phone}`);
  if (contact.linkedin_url) p.push(`LinkedIn: ${contact.linkedin_url}`);
  if (contact.source) p.push(`Source: ${contact.source}`);
  if (contact.notes) p.push(`\nNotes: ${contact.notes}`);
  return p.join("\n");
}

function pipelineDossier(deal: any, orgName?: string): string {
  const p: string[] = [];
  p.push(`# Pipeline Deal: ${deal.title || deal.name || "Untitled"}`);
  if (orgName) p.push(`Organization: ${orgName}`);
  p.push(`Stage: ${deal.stage || "unknown"} | Status: ${deal.status || "unknown"}`);
  if (deal.value || deal.amount) p.push(`Value: $${deal.value || deal.amount}`);
  if (deal.probability) p.push(`Probability: ${deal.probability}%`);
  if (deal.expected_close_date) p.push(`Expected Close: ${deal.expected_close_date}`);
  if (deal.description) p.push(`\nDescription: ${deal.description}`);
  if (deal.notes) p.push(`\nNotes: ${deal.notes}`);
  return p.join("\n");
}

function corrDossier(corr: any): string {
  const p: string[] = [];
  const dir = corr.direction === "outbound" ? "SENT" : "RECEIVED";
  p.push(`# Correspondence: ${corr.subject || "No Subject"}`);
  p.push(`Channel: ${corr.channel || "email"} | Direction: ${dir}`);
  if (corr.from_address) p.push(`From: ${corr.from_address}`);
  if (corr.to_addresses) p.push(`To: ${corr.to_addresses}`);
  if (corr.sent_at) p.push(`Date: ${new Date(corr.sent_at).toLocaleDateString()}`);
  if (corr.content) p.push(`\n${corr.content}`);
  if (corr.summary) p.push(`\nSummary: ${corr.summary}`);
  return p.join("\n");
}

function cardDossier(card: any): string {
  const p: string[] = [];
  p.push(`# Feed Card: ${card.title || "Untitled"}`);
  p.push(`Type: ${card.card_type || "unknown"} | Priority: ${card.priority || "medium"} | Category: ${card.acumen_category || "uncategorized"}`);
  if (card.source_type) p.push(`Source: ${card.source_type}`);
  if (card.ceo_action) p.push(`CEO Action: ${card.ceo_action}`);
  if (card.body) p.push(`\n${card.body}`);
  if (card.action_recommendation) p.push(`\nRecommendation: ${card.action_recommendation}`);
  return p.join("\n");
}

// ── Core embed function ──

async function embedRecords(
  records: any[],
  sourceType: string,
  buildDossier: (r: any) => string,
  existingTitles: Set<string>,
  force: boolean,
) {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of records) {
    const name = String(record.name || record.title || record.first_name || record.subject || record.id).slice(0, 200);
    const kbTitle = `[CRM ${sourceType}] ${name}`;

    if (!force && existingTitles.has(kbTitle)) {
      skipped++;
      continue;
    }

    try {
      const dossier = buildDossier(record);
      if (dossier.trim().length < 10) {
        skipped++;
        continue;
      }

      const chunks = chunkText(dossier);
      if (chunks.length === 0) {
        skipped++;
        continue;
      }

      const embeddings = await embedBatch(chunks);
      if (embeddings.length === 0) {
        errors++;
        continue;
      }

      // Delete existing kb entry + chunks if force
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

      // Create knowledge_base entry (in public schema where the table lives)
      const { data: kbInsert, error: kbError } = await sb
        .from("knowledge_base")
        .insert({
          title: kbTitle,
          source_type: `crm_${sourceType}`,
          source_ref: record.id,
          content_text: dossier,
          summary: dossier.slice(0, 300),
          tags: ["crm", sourceType, "auto-embedded"],
          processed: true,
          processed_at: new Date().toISOString(),
          metadata: {
            entity_type: sourceType,
            entity_id: record.id,
          },
        })
        .select("id")
        .single();

      if (kbError || !kbInsert) {
        console.error(`  ✗ ${name}: kb insert failed — ${kbError?.message}`);
        errors++;
        continue;
      }

      // Insert chunks linked to the new kb entry
      const chunkRows = chunks.map((chunk: string, idx: number) => ({
        kb_id: kbInsert.id,
        chunk_index: idx,
        content: chunk,
        token_count: Math.ceil(chunk.length / 4),
        embedding: `[${embeddings[idx].join(",")}]`,
        metadata: {
          title: name,
          source_type: `crm_${sourceType}`,
          entity_type: sourceType,
          entity_id: record.id,
        },
      }));

      const { error: insertError } = await sb
        .schema("brain")
        .from("knowledge_chunks")
        .insert(chunkRows);

      if (insertError) {
        console.error(`  ✗ ${name}: chunk insert failed — ${insertError.message}`);
        errors++;
      } else {
        processed++;
        existingTitles.add(kbTitle);
        process.stdout.write(`  ✓ ${name.slice(0, 50)} (${chunks.length} chunks)\n`);
      }
    } catch (err) {
      console.error(`  ✗ ${record.id}: ${err}`);
      errors++;
    }
  }

  return { processed, skipped, errors };
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const type = args.find((a) => a.startsWith("--type="))?.split("=")[1] || "all";
  const force = args.includes("--force");

  console.log(`\n🧠 CRM Knowledge Embedding`);
  console.log(`Type: ${type} | Force: ${force}\n`);

  // Get existing CRM knowledge entries by title to skip duplicates
  const { data: existingKb } = await sb
    .from("knowledge_base")
    .select("title")
    .like("source_type", "crm_%");
  const existingTitles = new Set<string>(
    (existingKb || []).map((r: { title: string }) => r.title)
  );
  console.log(`Existing CRM knowledge entries: ${existingTitles.size}\n`);

  // Build org lookup
  const { data: allOrgs } = await sb.schema("core").from("organizations").select("id, name");
  const orgMap = new Map<string, string>();
  (allOrgs || []).forEach((o: any) => orgMap.set(o.id, o.name));

  // ── Organizations ──
  if (type === "all" || type === "organizations") {
    const { data: orgs, count } = await sb
      .schema("core")
      .from("organizations")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });

    console.log(`\n📊 Organizations: ${count} total`);
    if (orgs) {
      const result = await embedRecords(orgs, "organization", orgDossier, existingTitles, force);
      console.log(`   Processed: ${result.processed} | Skipped: ${result.skipped} | Errors: ${result.errors}`);
    }
  }

  // ── Contacts ──
  if (type === "all" || type === "contacts") {
    const { data: contacts, count } = await sb
      .schema("core")
      .from("contacts")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });

    // Resolve org names via junction table
    if (contacts) {
      const contactIds = contacts.map((c: any) => c.id);
      const { data: orgLinks } = await sb
        .schema("core")
        .from("organization_contacts")
        .select("contact_id, organization_id")
        .in("contact_id", contactIds);

      const contactOrgMap = new Map<string, string>();
      (orgLinks || []).forEach((link: any) => {
        const name = orgMap.get(link.organization_id);
        if (name) contactOrgMap.set(link.contact_id, name);
      });

      console.log(`\n👤 Contacts: ${count} total`);
      const result = await embedRecords(
        contacts,
        "contact",
        (c) => contactDossier(c, contactOrgMap.get(c.id)),
        existingTitles,
        force,
      );
      console.log(`   Processed: ${result.processed} | Skipped: ${result.skipped} | Errors: ${result.errors}`);
    }
  }

  // ── Pipeline ──
  if (type === "all" || type === "pipeline") {
    const { data: deals, count } = await sb
      .schema("crm")
      .from("pipeline")
      .select("*", { count: "exact" })
      .order("updated_at", { ascending: false });

    console.log(`\n💰 Pipeline: ${count} total`);
    if (deals) {
      const result = await embedRecords(
        deals,
        "pipeline",
        (d) => pipelineDossier(d, orgMap.get(d.organization_id)),
        existingTitles,
        force,
      );
      console.log(`   Processed: ${result.processed} | Skipped: ${result.skipped} | Errors: ${result.errors}`);
    }
  }

  // ── Correspondence ──
  if (type === "all" || type === "correspondence") {
    const { data: corrs, count } = await sb
      .schema("brain")
      .from("correspondence")
      .select("*", { count: "exact" })
      .order("sent_at", { ascending: false });

    console.log(`\n✉️  Correspondence: ${count} total`);
    if (corrs) {
      const result = await embedRecords(corrs, "correspondence", corrDossier, existingTitles, force);
      console.log(`   Processed: ${result.processed} | Skipped: ${result.skipped} | Errors: ${result.errors}`);
    }
  }

  // ── Feed Cards ──
  if (type === "all" || type === "feed_cards") {
    const { data: cards, count } = await sb
      .schema("brain")
      .from("feed_cards")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    console.log(`\n🃏 Feed Cards: ${count} total`);
    if (cards) {
      const result = await embedRecords(cards, "feed_card", cardDossier, existingTitles, force);
      console.log(`   Processed: ${result.processed} | Skipped: ${result.skipped} | Errors: ${result.errors}`);
    }
  }

  // Final count
  const { count: finalChunks } = await sb
    .schema("brain")
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true });
  console.log(`\n✅ Done. Total knowledge chunks: ${finalChunks}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
