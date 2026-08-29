import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local");
}

// The anon key is safe to expose client-side by design, it identifies
// the project, not a user. Actual access control happens via the session
// token this client manages, which the backend verifies on every request.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
