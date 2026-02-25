/**
 * Sync Notion Investor Tracker export → Supabase investors table
 *
 * Usage: node scripts/sync-notion-investors.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = "https://smychxtekmfzezirpubp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNteWNoeHRla21memV6aXJwdWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzMzNjUsImV4cCI6MjA4NzMwOTM2NX0.Jwyba3AlYZBTtCnmNFrLZOAxJSs-e5HKCGBYUbmMtyk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Simple CSV parser (handles quoted fields with commas/newlines) ──
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n") {
        row.push(field.trim());
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
        field = "";
      } else if (ch !== "\r") {
        field += ch;
      }
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

// ── Map pipeline status from Notion → DB ──
function mapPipelineStatus(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (s.toLowerCase().startsWith("closed")) return "Closed";
  if (s === "Disqualified") return "Passed";
  // Keep Backlog, Prospect, Qualified, Engaged, First Meeting, In Closing, Passed as-is
  return s;
}

// ── Parse Notion contact references to just names ──
function parseContactNames(raw) {
  if (!raw) return [];
  // Format: "Name (https://notion.so/...)", or "Name1 (...), Name2 (...)"
  return raw.split(/,\s*(?=[A-Z])/).map((c) => {
    return c.replace(/\s*\(https?:\/\/[^)]+\)/, "").replace(/\s*\(mailto:[^)]+\)/, "").trim();
  }).filter(Boolean);
}

// ── Main ──
async function main() {
  // Read the _all CSV (has the most columns)
  const csvText = readFileSync(
    "/tmp/notion_export/Private & Shared/Investor Workspace/Investor Tracker 2b07762c732d801eb05fd3fc2c1ba790_all.csv",
    "utf-8"
  );

  const allRows = parseCSV(csvText);
  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  console.log(`Parsed ${dataRows.length} rows from Notion export`);
  console.log("Headers:", headers.join(" | "));

  // Build column index
  const col = {};
  headers.forEach((h, i) => (col[h.trim()] = i));

  // Parse rows into investor objects, deduplicating by name (keep most complete)
  const investorMap = new Map();

  for (const row of dataRows) {
    const name = row[col["Name"]]?.trim();
    if (!name) continue;

    const entry = {
      firm_name: name,
      description: row[col["Description"]] || null,
      investor_type: row[col["Type"]] || null,
      geography: row[col["Geography"]] || null,
      location: row[col["Location"]] || null,
      sector_focus: row[col["Sector Focus"]] || null,
      check_size: row[col["Check Size"]] || null,
      website: row[col["Link"]] || null,
      notable_investments: row[col["Notable Investments"]] || null,
      connection_status: row[col["connection Status"]] || null,
      pipeline_status: mapPipelineStatus(row[col["Status"]]),
      notes: row[col["Notes"]] || null,
      last_contact_date: row[col["Last Contact Date"]] || null,
      next_action: row[col["Next Action"]] || null,
      source: row[col["Entry"]] || null,
      portfolio_url: row[col["Team Page"]] || row[col["Relevant Link"]] || null,
      _contacts: row[col["Contacts"]] || null,
      _key_contact: row[col["Key Contact"]] || null,
    };

    // Deduplicate: if we already have this firm, merge (prefer non-null)
    if (investorMap.has(name)) {
      const existing = investorMap.get(name);
      for (const [k, v] of Object.entries(entry)) {
        if (v && !existing[k]) existing[k] = v;
      }
    } else {
      investorMap.set(name, entry);
    }
  }

  console.log(`\n${investorMap.size} unique investors after dedup`);

  // Fetch all existing investors from DB
  const { data: dbInvestors, error: fetchErr } = await supabase
    .from("investors")
    .select("id, firm_name");
  if (fetchErr) { console.error("Fetch error:", fetchErr); return; }

  const dbMap = new Map();
  for (const inv of dbInvestors) {
    dbMap.set(inv.firm_name.toLowerCase(), inv);
  }
  console.log(`${dbInvestors.length} investors currently in DB\n`);

  let updated = 0, inserted = 0, skipped = 0;

  for (const [name, inv] of investorMap) {
    // Build the update payload — only include non-null fields
    const payload = {};
    const dbFields = [
      "firm_name", "description", "investor_type", "geography", "location",
      "sector_focus", "check_size", "website", "notable_investments",
      "connection_status", "pipeline_status", "notes", "next_action",
      "source", "portfolio_url",
    ];

    for (const f of dbFields) {
      if (inv[f]) payload[f] = inv[f];
    }

    // Handle last_contact_date (needs to be a valid date or null)
    if (inv.last_contact_date) {
      const d = new Date(inv.last_contact_date);
      if (!isNaN(d.getTime())) {
        payload.last_contact_date = d.toISOString().split("T")[0];
      }
    }

    const existing = dbMap.get(name.toLowerCase());

    if (existing) {
      // Update existing — don't send firm_name in update payload
      delete payload.firm_name;
      if (Object.keys(payload).length === 0) { skipped++; continue; }

      const { error } = await supabase
        .from("investors")
        .update(payload)
        .eq("id", existing.id);

      if (error) {
        console.error(`  ERROR updating "${name}":`, error.message);
      } else {
        console.log(`  UPDATED: ${name} (${Object.keys(payload).join(", ")})`);
        updated++;
      }
    } else {
      // Insert new
      payload.firm_name = name;
      payload.source = payload.source || "notion-import";

      const { error } = await supabase
        .from("investors")
        .insert(payload);

      if (error) {
        console.error(`  ERROR inserting "${name}":`, error.message);
      } else {
        console.log(`  INSERTED: ${name}`);
        inserted++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (no changes): ${skipped}`);
  console.log(`Total processed: ${investorMap.size}`);
}

main().catch(console.error);
