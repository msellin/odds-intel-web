import { createClient } from "@supabase/supabase-js";

/**
 * Anon data client — used for public reads (matches, teams, leagues,
 * odds_snapshots, predictions, signals, simulated_bets).
 *
 * Points at NEXT_PUBLIC_POSTGREST_URL / NEXT_PUBLIC_POSTGREST_ANON_KEY. Under
 * Phase 4 of the Supabase→VPS migration both env vars fall back to the
 * Supabase project (so the refactor deploys without cutover). Under Phase 6
 * they flip to the VPS PostgREST at api.oddsintel.app.
 *
 * Not for auth — use createSupabaseBrowser / createSupabaseServer for that.
 */
export function createSupabasePublic() {
  const url =
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_POSTGREST_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}
