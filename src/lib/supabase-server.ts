import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

/** Server-side Supabase client with service_role key — use ONLY in API routes / server actions */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
