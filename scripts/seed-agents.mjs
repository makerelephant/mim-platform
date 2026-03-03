import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  const { data: existing } = await sb.from("agents").select("slug");
  console.log("Existing agents:", existing?.map((a) => a.slug));

  const existingSlugs = new Set(existing?.map((a) => a.slug) || []);
  const agentsToInsert = [];

  if (!existingSlugs.has("slack-scanner")) {
    agentsToInsert.push({
      name: "Slack",
      slug: "slack-scanner",
      description:
        "Scans Slack channels for messages, classifies them using AI, resolves entities, auto-creates contacts for unknown users, and generates actionable tasks.",
      agent_type: "scheduled",
      system_prompt: null,
      config: { scan_hours: 24, model: "claude-sonnet-4-5-20250929" },
      status: "active",
    });
  }

  if (!existingSlugs.has("sheets-scanner")) {
    agentsToInsert.push({
      name: "Google Sheets",
      slug: "sheets-scanner",
      description:
        "Syncs data from Google Sheets spreadsheets into the platform. Maps rows to contacts, investors, or organizations based on sheet structure.",
      agent_type: "scheduled",
      system_prompt: null,
      config: { model: "claude-sonnet-4-5-20250929" },
      status: "active",
    });
  }

  if (!existingSlugs.has("weekly-report")) {
    agentsToInsert.push({
      name: "Weekly Report",
      slug: "weekly-report",
      description:
        "Generates a comprehensive weekly activity report by aggregating tasks, correspondence, and agent activity across all data sources.",
      agent_type: "scheduled",
      system_prompt: null,
      config: { period_type: "week", model: "claude-sonnet-4-5-20250929" },
      status: "active",
    });
  }

  if (agentsToInsert.length > 0) {
    const { data, error } = await sb
      .from("agents")
      .insert(agentsToInsert)
      .select("name, slug");
    if (error) console.error("Insert error:", error.message);
    else console.log("Inserted:", data.map((a) => a.slug));
  } else {
    console.log("All agents already exist.");
  }
}

main();
