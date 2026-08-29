import { createClient } from "@supabase/supabase-js";

// Server-side client using the service role key, only ever used here, to
// verify tokens the frontend sends us. Never expose SUPABASE_SERVICE_ROLE_KEY
// to the frontend; that's the whole point of it being server-only.
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
