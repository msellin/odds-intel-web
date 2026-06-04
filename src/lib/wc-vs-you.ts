/**
 * Server-side picker query for "OddsIntel vs You".
 *
 * Picks are stored in `wc_user_picks` (migration 166). Anonymous viewers get
 * an empty map; signed-in users get their full pick set in one query.
 *
 * Pure helpers (modelPickFromTriple, actualPickFromFixture, buildScorecard)
 * + types (WCPick, WCScorecard) live in `wc-vs-you-helpers.ts` so client
 * components can use them without pulling `next/headers` into the browser
 * bundle. Re-exported here for backward compatibility with server callers.
 */

import { createSupabaseServer } from "./supabase-server";
import type { WCPick } from "./wc-vs-you-helpers";

export type { WCPick, WCScorecard } from "./wc-vs-you-helpers";
export {
  modelPickFromTriple,
  actualPickFromFixture,
  buildScorecard,
} from "./wc-vs-you-helpers";

/**
 * Fetch the signed-in user's WC picks. Anonymous users get an empty map.
 * Server-only — uses `next/headers` via `createSupabaseServer`.
 */
export async function getUserWcPicks(
  matchIds: string[]
): Promise<Record<string, WCPick>> {
  if (matchIds.length === 0) return {};
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("wc_user_picks")
    .select("match_id, pick")
    .eq("user_id", user.id)
    .in("match_id", matchIds);
  if (error || !data) return {};

  const out: Record<string, WCPick> = {};
  for (const row of data as Array<{ match_id: string; pick: WCPick }>) {
    out[row.match_id] = row.pick;
  }
  return out;
}
