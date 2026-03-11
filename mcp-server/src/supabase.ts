/**
 * Supabase client for MCP server.
 * Uses the service key for full admin access — bypasses RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.\n" +
    "Set them in your Claude Desktop config or .env file."
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

/** The deployed MiM app URL — used for triggering scanners via HTTP */
export const MIM_APP_URL = process.env.MIM_APP_URL || "https://mim-platform.vercel.app";
