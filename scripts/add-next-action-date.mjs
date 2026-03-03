import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  // Add next_action_date column to investors
  const { error } = await sb.rpc("exec_sql", {
    query: "ALTER TABLE investors ADD COLUMN IF NOT EXISTS next_action_date DATE;"
  });

  if (error) {
    // If rpc doesn't exist, try direct approach
    console.log("RPC not available, trying direct column check...");

    // Test if column exists by querying it
    const { error: testErr } = await sb
      .from("investors")
      .select("next_action_date")
      .limit(1);

    if (testErr && testErr.message.includes("next_action_date")) {
      console.error("Column 'next_action_date' does not exist. Please run in Supabase SQL Editor:");
      console.error("ALTER TABLE investors ADD COLUMN IF NOT EXISTS next_action_date DATE;");
    } else {
      console.log("Column 'next_action_date' already exists or was created successfully.");
    }
  } else {
    console.log("Migration completed successfully.");
  }
}

main();
