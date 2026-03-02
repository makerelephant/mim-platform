/**
 * Google Sheets Scanner Agent
 * Reads investor data from a configured Google Sheet and syncs into the investors table.
 * Matches by firm name to avoid duplicates; creates new records and updates existing ones.
 */

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

// ── Defaults ──
const DEFAULT_SPREADSHEET_ID = "1meJENDhLWYlAL1mC-JhwceMypA-E7xK5_n0Bh_QZf4o";
const DEFAULT_SHEET_NAME = "FoundersEdge Investor Help";
const DEFAULT_HEADER_ROW = 4; // 0-indexed: row 4 has headers (Firm, Contact, etc.)

interface SheetInvestor {
  firm: string;
  contact: string;
  connectionStatus: string;
  status: string;
  score: string;
  correspondence: string;
  update: string;
}

interface ScanResult {
  success: boolean;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  totalRows: number;
  logs: string[];
  error?: string;
}

export async function runSheetsScanner(opts?: {
  spreadsheetId?: string;
  sheetName?: string;
}): Promise<ScanResult> {
  const logs: string[] = [];
  const addLog = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsSkipped = 0;
  let totalRows = 0;

  try {
    addLog("Starting Google Sheets scanner");

    // ── Supabase (service role) ──
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) throw new Error("Missing Supabase env vars");
    const sb = createClient(sbUrl, sbKey);

    // ── Log agent run ──
    const { data: runData } = await sb.from("agent_runs").insert({
      agent_name: "sheets-scanner",
      status: "running",
      started_at: new Date().toISOString(),
    }).select("id").single();
    const runId = runData?.id || null;
    addLog(`Started run ${runId}`);

    // ── Google OAuth ──
    const tokenJson = process.env.GOOGLE_TOKEN;
    if (!tokenJson) throw new Error("GOOGLE_TOKEN environment variable not set.");

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

    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    addLog("Google Sheets authenticated");

    // ── Load agent config from DB ──
    const spreadsheetId = opts?.spreadsheetId || DEFAULT_SPREADSHEET_ID;
    const sheetName = opts?.sheetName || DEFAULT_SHEET_NAME;

    // ── Read spreadsheet ──
    const range = `'${sheetName}'!A1:Z200`;
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = result.data.values || [];
    addLog(`Read ${rows.length} rows from "${sheetName}"`);

    if (rows.length <= DEFAULT_HEADER_ROW + 1) {
      addLog("No data rows found after header");
      return { success: true, recordsCreated: 0, recordsUpdated: 0, recordsSkipped: 0, totalRows: 0, logs };
    }

    // ── Parse header row to find column indices ──
    const headerRow = rows[DEFAULT_HEADER_ROW] || [];
    const colMap: Record<string, number> = {};
    for (let i = 0; i < headerRow.length; i++) {
      const h = (headerRow[i] || "").toString().trim().toLowerCase();
      if (h === "firm") colMap.firm = i;
      else if (h === "contact") colMap.contact = i;
      else if (h === "connection status") colMap.connectionStatus = i;
      else if (h === "status") colMap.status = i;
      else if (h === "score") colMap.score = i;
      else if (h === "correspondence") colMap.correspondence = i;
      else if (h === "update") colMap.update = i;
    }

    addLog(`Column mapping: ${JSON.stringify(colMap)}`);

    if (colMap.firm === undefined) {
      throw new Error("Could not find 'Firm' column in header row");
    }

    // ── Parse data rows ──
    const sheetInvestors: SheetInvestor[] = [];
    for (let i = DEFAULT_HEADER_ROW + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const firm = (row[colMap.firm] || "").toString().trim();
      if (!firm) continue; // Skip empty rows

      sheetInvestors.push({
        firm,
        contact: colMap.contact !== undefined ? (row[colMap.contact] || "").toString().trim() : "",
        connectionStatus: colMap.connectionStatus !== undefined ? (row[colMap.connectionStatus] || "").toString().trim() : "",
        status: colMap.status !== undefined ? (row[colMap.status] || "").toString().trim() : "",
        score: colMap.score !== undefined ? (row[colMap.score] || "").toString().trim() : "",
        correspondence: colMap.correspondence !== undefined ? (row[colMap.correspondence] || "").toString().trim() : "",
        update: colMap.update !== undefined ? (row[colMap.update] || "").toString().trim() : "",
      });
    }

    totalRows = sheetInvestors.length;
    addLog(`Parsed ${totalRows} investor rows from sheet`);

    // ── Load existing investors from DB ──
    const { data: existingInvestors } = await sb.from("investors").select("id, firm_name, description, connection_status, pipeline_status, likelihood_score, next_action");
    const firmMap = new Map<string, typeof existingInvestors extends (infer T)[] | null ? T : never>();
    if (existingInvestors) {
      for (const inv of existingInvestors) {
        firmMap.set(inv.firm_name.toLowerCase().trim(), inv);
      }
    }
    addLog(`Loaded ${firmMap.size} existing investors from DB`);

    // ── Map sheet status values to pipeline_status ──
    const statusMap: Record<string, string> = {
      "prospect": "Prospect",
      "qualified": "Qualified",
      "engaged": "Engaged",
      "first meeting": "First Meeting",
      "in closing": "In Closing",
      "closed": "Closed",
      "passed": "Passed",
      "not a fit": "Not a Fit",
      "backlogged": "Passed", // Map backlogged to Passed
    };

    // ── Map sheet connection status values ──
    const connectionMap: Record<string, string> = {
      "active": "Active",
      "stale": "Stale",
      "need introduction": "Need Introduction",
      "warm intro": "Warm Intro",
      "cold": "Cold",
      "founders edge": "Active", // FoundersEdge = active connection
    };

    // ── Sync each row ──
    for (const si of sheetInvestors) {
      const key = si.firm.toLowerCase().trim();
      const existing = firmMap.get(key);

      // Parse score
      const score = si.score ? parseInt(si.score, 10) : null;
      const validScore = score && !isNaN(score) ? score : null;

      // Map status
      const pipelineStatus = statusMap[si.status.toLowerCase()] || si.status || null;

      // Map connection — handle compound values like "Founders Edge, Walt, Mark"
      const firstConnection = si.connectionStatus.split(",")[0].trim().toLowerCase();
      const connectionStatus = connectionMap[firstConnection] || si.connectionStatus || null;

      // Build description from contact + correspondence
      const descParts: string[] = [];
      if (si.contact) descParts.push(`Contact: ${si.contact}`);
      if (si.correspondence) descParts.push(si.correspondence);
      const description = descParts.join("\n\n") || null;

      if (existing) {
        // ── Update existing investor ──
        const updates: Record<string, unknown> = {};

        // Only update fields that are empty in DB but have data in sheet
        if (!existing.pipeline_status && pipelineStatus) updates.pipeline_status = pipelineStatus;
        if (!existing.connection_status && connectionStatus) updates.connection_status = connectionStatus;
        if (!existing.likelihood_score && validScore) updates.likelihood_score = validScore;
        if (!existing.next_action && si.update) updates.next_action = si.update;

        // Always update description if sheet has richer data
        if (description && (!existing.description || description.length > (existing.description || "").length)) {
          updates.description = description;
        }

        // If sheet has explicit pipeline_status and DB differs, prefer sheet
        if (pipelineStatus && existing.pipeline_status !== pipelineStatus) {
          updates.pipeline_status = pipelineStatus;
        }

        if (Object.keys(updates).length > 0) {
          await sb.from("investors").update(updates).eq("id", existing.id);
          recordsUpdated++;
          addLog(`Updated: ${si.firm} (${Object.keys(updates).join(", ")})`);
        } else {
          recordsSkipped++;
          addLog(`Skipped (no changes): ${si.firm}`);
        }
      } else {
        // ── Create new investor ──
        const { error } = await sb.from("investors").insert({
          firm_name: si.firm,
          description,
          connection_status: connectionStatus,
          pipeline_status: pipelineStatus,
          likelihood_score: validScore,
          next_action: si.update || null,
          source: "google-sheets",
        });

        if (error) {
          addLog(`Error creating ${si.firm}: ${error.message}`);
        } else {
          recordsCreated++;
          addLog(`Created: ${si.firm}`);
        }
      }
    }

    // ── Log activity ──
    await sb.from("activity_log").insert({
      agent_name: "sheets-scanner",
      action_type: "sheets_synced",
      summary: `Synced ${totalRows} rows from Google Sheets: ${recordsCreated} created, ${recordsUpdated} updated, ${recordsSkipped} unchanged`,
      raw_data: {
        spreadsheet_id: spreadsheetId,
        sheet_name: sheetName,
        total_rows: totalRows,
        created: recordsCreated,
        updated: recordsUpdated,
        skipped: recordsSkipped,
      },
    });

    // ── Complete run ──
    if (runId) {
      await sb.from("agent_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_processed: totalRows,
        records_updated: recordsCreated + recordsUpdated,
        summary: `Synced ${totalRows} investors: ${recordsCreated} new, ${recordsUpdated} updated`,
      }).eq("id", runId);
    }

    addLog(`Done: ${recordsCreated} created, ${recordsUpdated} updated, ${recordsSkipped} skipped`);

    return { success: true, recordsCreated, recordsUpdated, recordsSkipped, totalRows, logs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addLog(`ERROR: ${msg}`);
    return { success: false, recordsCreated, recordsUpdated, recordsSkipped, totalRows, logs, error: msg };
  }
}
