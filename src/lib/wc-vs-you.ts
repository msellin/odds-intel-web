/**
 * Server-side helpers for "OddsIntel vs You" feature.
 *
 * Picks are stored in `wc_user_picks` (migration 166). Anonymous viewers get
 * an empty map; signed-in users get their full pick set in one query.
 */

import { createSupabaseServer } from "./supabase-server";
import type { WCFixture, WCPredictionSlot } from "./world-cup";

export type WCPick = "1" | "X" | "2";

export interface WCScorecard {
  totalSettled: number;
  userCorrect: number;
  modelCorrect: number;
  /** Total picks the user has locked in (whether settled or not). */
  userLockedCount: number;
}

/**
 * Fetch the signed-in user's WC picks. Anonymous users get an empty map.
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

/**
 * Pick the highest-probability outcome from a model prediction triple as the
 * model's "pick" for vs-You comparison. Ties (rare in practice) break to '1'.
 */
export function modelPickFromTriple(triple: WCPredictionSlot | undefined): WCPick | null {
  if (!triple) return null;
  const { homeProb, drawProb, awayProb } = triple;
  if (homeProb == null || drawProb == null || awayProb == null) return null;
  const maxP = Math.max(homeProb, drawProb, awayProb);
  if (homeProb === maxP) return "1";
  if (awayProb === maxP) return "2";
  return "X";
}

/**
 * Derive the actual 1X2 result for a finished fixture. Returns null when the
 * match isn't finished yet.
 */
export function actualPickFromFixture(f: WCFixture): WCPick | null {
  if (f.status !== "finished") return null;
  if (f.scoreHome == null || f.scoreAway == null) return null;
  if (f.scoreHome > f.scoreAway) return "1";
  if (f.scoreHome < f.scoreAway) return "2";
  return "X";
}

/**
 * Walk fixtures and tally You vs Model accuracy on settled (finished) matches.
 */
export function buildScorecard(
  fixtures: WCFixture[],
  predictions: Record<string, WCPredictionSlot>,
  userPicks: Record<string, WCPick>
): WCScorecard {
  let totalSettled = 0;
  let userCorrect = 0;
  let modelCorrect = 0;
  for (const f of fixtures) {
    const actual = actualPickFromFixture(f);
    if (!actual) continue;
    totalSettled += 1;
    const userPick = userPicks[f.id];
    if (userPick === actual) userCorrect += 1;
    const modelPick = modelPickFromTriple(predictions[f.id]);
    if (modelPick === actual) modelCorrect += 1;
  }
  return {
    totalSettled,
    userCorrect,
    modelCorrect,
    userLockedCount: Object.keys(userPicks).length,
  };
}
