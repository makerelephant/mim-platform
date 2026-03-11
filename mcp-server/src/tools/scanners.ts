/**
 * Scanner & Report tools for MiM MCP Server
 *
 * trigger_scan    — Run any scanner (gmail, slack, sheets, sentiment, etc.)
 * generate_report — Trigger report generation
 */
import { z } from "zod";
import { MIM_APP_URL } from "../supabase.js";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SCANNER_ROUTES: Record<string, string> = {
  gmail: "/api/agents/gmail-scanner",
  slack: "/api/agents/slack-scanner",
  sheets: "/api/agents/sheets-scanner",
  sentiment: "/api/agents/sentiment-scanner",
  customer: "/api/agents/customer-scanner",
  partnership: "/api/agents/partnership-scanner",
  fundraising: "/api/agents/fundraising-scanner",
};

export function registerScannerTools(server: McpServer) {

  // ── trigger_scan ──
  server.tool(
    "trigger_scan",
    "Trigger a scanner to process recent communications. Available scanners: gmail, slack, sheets, sentiment, customer, partnership, fundraising. Note: scanners run on Vercel and may timeout after 120 seconds for large batch sizes.",
    {
      scanner: z.enum(["gmail", "slack", "sheets", "sentiment", "customer", "partnership", "fundraising"]).describe("Which scanner to run"),
      days: z.number().optional().default(1).describe("Look back N days (default 1). Larger values may timeout."),
    },
    async ({ scanner, days }) => {
      const route = SCANNER_ROUTES[scanner];
      if (!route) {
        return { content: [{ type: "text" as const, text: `Unknown scanner: ${scanner}` }] };
      }

      const url = `${MIM_APP_URL}${route}`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: days ?? 1 }),
          signal: AbortSignal.timeout(130000), // 130s to account for Vercel's 120s limit
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          return { content: [{ type: "text" as const, text: `Scanner returned ${response.status}: ${text.slice(0, 500)}` }] };
        }

        const result = await response.json();

        // Format the result nicely
        const summary = typeof result === "object"
          ? JSON.stringify(result, null, 2)
          : String(result);

        return {
          content: [{
            type: "text" as const,
            text: `Scanner "${scanner}" completed (${days} day lookback):\n\n${summary.slice(0, 3000)}`,
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("timeout") || message.includes("abort")) {
          return { content: [{ type: "text" as const, text: `Scanner "${scanner}" timed out (Vercel 120s limit). Try a shorter lookback period (days=1).` }] };
        }
        return { content: [{ type: "text" as const, text: `Error triggering scanner: ${message}` }] };
      }
    }
  );

  // ── generate_report ──
  server.tool(
    "generate_report",
    "Generate a new intelligence report or retrieve the latest. Triggers the weekly report generator which scans email/Slack and synthesizes with Claude.",
    {
      period: z.enum(["daily", "weekly", "monthly"]).optional().default("weekly").describe("Report period"),
      days: z.number().optional().describe("Override look-back period in days"),
    },
    async ({ period, days }) => {
      const url = `${MIM_APP_URL}/api/agents/weekly-report`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            period: period ?? "weekly",
            days: days ?? (period === "daily" ? 1 : period === "monthly" ? 30 : 7),
          }),
          signal: AbortSignal.timeout(180000), // Reports can take longer
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          return { content: [{ type: "text" as const, text: `Report generation failed (${response.status}): ${text.slice(0, 500)}` }] };
        }

        const result = await response.json();
        return {
          content: [{
            type: "text" as const,
            text: `Report generated successfully:\n\n${JSON.stringify(result, null, 2).slice(0, 5000)}`,
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error generating report: ${message}` }] };
      }
    }
  );

  // ── get_report ──
  server.tool(
    "get_report",
    "Retrieve the latest generated report or a specific report by ID.",
    {
      report_id: z.string().optional().describe("Specific report UUID. If omitted, returns the latest."),
    },
    async ({ report_id }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let report: any = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let error: any = null;

      if (report_id) {
        const result = await supabase.from("reports")
          .select("id, title, period, content, metadata, created_at")
          .eq("id", report_id)
          .single();
        report = result.data;
        error = result.error;
      } else {
        const result = await supabase.from("reports")
          .select("id, title, period, content, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        report = result.data;
        error = result.error;
      }

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!report) return { content: [{ type: "text" as const, text: "No reports found." }] };

      const sections: string[] = [];
      sections.push(`# ${report.title || "Intelligence Report"}`);
      sections.push(`**Period:** ${report.period || "unknown"}`);
      sections.push(`**Generated:** ${report.created_at}`);
      sections.push(`**ID:** ${report.id}`);

      if (report.content) {
        const content = report.content.length > 8000
          ? report.content.slice(0, 8000) + "\n\n... [truncated]"
          : report.content;
        sections.push(`\n${content}`);
      }

      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    }
  );
}
