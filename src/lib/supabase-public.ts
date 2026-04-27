import { createClient } from "@supabase/supabase-js";

/**
 * Public Supabase client — uses the anon key without cookies/session.
 * Safe for reading tables that don't have RLS enabled:
 * matches, teams, leagues, odds_snapshots, etc.
 */
export function createSupabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
