/**
 * Server-only pick fetchers for /picks.
 *
 * PICKS-USER-GATE 2026-08-22 — /api/v1/upcoming is the PUBLIC picks feed and
 * is now narrowed to `maturity_label = 'calibrated'` so it exactly matches
 * the cohort that ships to the Telegram public channel. Signed-in users get
 * the wider `calibrated + beta + active` cohort via this module, which is
 * called directly from the /picks server component — never exposed as a
 * client-fetchable route. Result: the wider cohort never leaves the server
 * unless a signed-in session is on the request.
 *
 * Both codepaths dedupe by (match_id, market, selection) keeping the
 * highest-edge row, matching the historic /api/v1/upcoming shape.
 */
import { createClient } from "@supabase/supabase-js";
import {
  ENGINE_MIN_EDGE_BY_MARKET,
  ENGINE_MIN_ODDS_BY_MARKET,
  ENGINE_MODEL_1X2_HOME_FLOOR,
} from "./generated/engine-floors";

export interface UpcomingPick {
  id: string;
  match_id: string;
  kickoff_utc: string | null;
  league: string | null;
  country: string | null;
  home_team: string | null;
  away_team: string | null;
  market: string;
  selection: string;
  odds: number | null;
  edge_pct: number | null;
  /**
   * Break-even odds: below this the bet is negative-EV and should be skipped.
   *
   * A pick is only worth taking at the price it was found at. By the time
   * someone opens the page the book may have moved, and a pick posted at 2.50
   * is worthless well above 2.20. Showing the floor lets the reader check the
   * price they are actually offered instead of trusting a number that has moved.
   *
   * PICKS-MIN-ODDS-WRONG-FORMULA-2026-09-05 — this was wrong on every pick.
   * The previous derivation assumed the standard multiplicative definition:
   *     edge = odds x prob - 1  =>  break-even = odds / (1 + edge)
   * That premise is false for this engine. `daily_pipeline_v2.py:3474` computes
   *     edge = cal_prob - ip,  where ip = 1 / odds
   * i.e. a difference in PROBABILITY POINTS, not a multiplicative EV. Feeding a
   * probability-point edge into the multiplicative formula inflates the floor.
   *
   * Correct derivation:
   *     cal_prob   = edge + 1 / odds
   *     break-even = 1 / cal_prob = 1 / (edge + 1 / odds)
   *
   * Measured before the fix, 478 picks over 45 days: the displayed floor was
   * ABOVE the true break-even on 478 of 478 — median +18.0%, mean +19.6%,
   * p90 +37.2%. Worked example: odds 3.11, edge 0.09, cal_prob 0.416 gave a
   * displayed 2.85 against a true 2.40.
   *
   * The error ran in the harmful direction: it told readers a still-+EV bet was
   * dead, so they skipped good bets, while the UI asserted it as fact.
   */
  min_odds: number | null;
  bookmaker: string | null;
  posted_at_utc: string;
  result: "pending" | "won" | "lost" | "void";
}

/**
 * Break-even price for a pick: below this the bet is -EV under our own model.
 *
 * Single definition, used everywhere. `break-even = 1 / cal_prob`.
 *
 * Prefers the stored `calibrated_prob` and falls back to reconstructing it from
 * the stored edge, since `edge = cal_prob - 1/odds` (daily_pipeline_v2.py:3474)
 * gives `cal_prob = edge + 1/odds`. Both routes agree; the direct one avoids
 * compounding the rounding already applied to `edge_percent`.
 *
 * Returns null rather than a wrong number when the inputs cannot support it —
 * a missing floor is honest, an invented one is not.
 */
export function breakEvenOdds(
  oddsAtPick: number | null,
  edgePercent: number | null,
  calibratedProb: number | null
): number | null {
  const cal = calibratedProb != null ? Number(calibratedProb) : null;
  if (cal != null && cal > 0 && cal <= 1) {
    return Number((1 / cal).toFixed(2));
  }
  const odds = oddsAtPick != null ? Number(oddsAtPick) : null;
  const edge = edgePercent != null ? Number(edgePercent) : null;
  if (odds == null || odds <= 1 || edge == null) return null;
  const impliedProb = edge + 1 / odds; // = cal_prob
  if (impliedProb <= 0 || impliedProb > 1) return null;
  return Number((1 / impliedProb).toFixed(2));
}

/**
 * Admin-only: the odds a pick must be offered at to clear the Coolbet PLACEMENT
 * edge floor — i.e. what the real-money bot ACTUALLY needs to see before it places.
 * Derived from the public break-even min_odds (= 1/cal_prob):
 *   place_min = max( 1/(cal_prob − edge_floor), odds_floor )
 * FAVLONG-CUTS-2026-09-09: the real-money 1x2 bot (bot_coolbet_1x2_model_v1) places
 * HOME-UNDERDOGS ONLY, at a 10% edge / odds≥2.80 — home-favs, aways and draws are
 * NOT placed. So for 1x2 the trigger is 10% for a HOME selection and null (not
 * placed) for draw/away. O/U is 8% / odds≥1.80. Returns null if the pick can't
 * reach the edge at any odds, or the (market, selection) isn't placed at all.
 */
export function placementTriggerOdds(
  breakEvenMinOdds: number | null,
  market: string,
  selection?: string | null,
): number | null {
  if (breakEvenMinOdds == null || breakEvenMinOdds <= 1) return null;
  const cal = 1 / breakEvenMinOdds;
  const m =
    market === "o/u" || market === "over_under_25"
      ? "ou"
      : market === "1x2"
        ? "1x2"
        : null;
  if (!m) return null;
  let edgeFloor: number;
  let oddsFloor: number;
  // FLOORS-ONE-SOURCE-CROSS-LANGUAGE (2026-09-11): the NUMBERS now come from
  // the engine via a generated file. They used to be hardcoded here (0.1/2.8,
  // 0.08/1.8) with no import path to Python, so a floor change in the engine
  // never reached this published "place >= X.XX" hint — the one readers act on.
  // Regenerate with `python3 scripts/gen_frontend_floors.py`; the smoke test
  // FLOORS-ONE-SOURCE-CROSS-LANGUAGE fails CI if this file drifts.
  if (m === "1x2") {
    // FAVLONG-CUTS: real money = home UNDERDOGS only. Home-favs and aways are
    // not fold-robust at the underdog floor, so they are not placed at all and
    // get no trigger price.
    if ((selection ?? "").toLowerCase() !== "home") return null;
    oddsFloor = ENGINE_MIN_ODDS_BY_MARKET["1x2"];
    // The home-underdog floor ALWAYS applies to the published trigger, and the
    // pooled 1x2 floor never does. Python keys the exception off the OFFERED
    // odds (>= the 1x2 odds floor), and every price this function can return is
    // clamped to that floor below — so by construction the pick is an underdog
    // at any price we would publish. The pooled floor would only bind BELOW the
    // odds floor, which is unplaceable anyway.
    //
    // A first version of this branch fell back to the pooled 13% whenever the
    // 10% trigger came out under 2.80, and published 3.03 where the engine
    // actually clears at 2.80 — too STRICT, on 6 of the ~100 calibrated
    // probabilities swept (cal 0.46-0.48). Verified against the real
    // clears_edge_floor() across cal 0.11-0.60: 0 mismatches.
    edgeFloor = ENGINE_MODEL_1X2_HOME_FLOOR;
  } else {
    // `null` in the engine map means the market is RETIRED (btts and
    // double_chance are null there, and _min_edge_for returns infinity for
    // them so nothing clears). A `?? 0.08` fallback would silently resurrect a
    // retired market's floor and publish a trigger price for something we no
    // longer bet — the exact "silent wrong floor" shape this whole change is
    // removing. Mirror the engine instead: no floor, no trigger.
    const ouFloor = ENGINE_MIN_EDGE_BY_MARKET["o/u"];
    if (ouFloor == null) return null;
    edgeFloor = ouFloor;
    oddsFloor = ENGINE_MIN_ODDS_BY_MARKET["o/u"];
  }
  if (cal <= edgeFloor) return null;
  return Math.max(1 / (cal - edgeFloor), oddsFloor);
}

const PRE_MATCH_MARKETS = ["1x2", "over_under_25", "o/u", "btts"];

export const PUBLIC_MATURITY_LABELS = ["calibrated"];
export const SIGNED_IN_MATURITY_LABELS = ["calibrated", "beta", "active"];

interface BetRow {
  id: string;
  match_id: string;
  created_at: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  edge_percent: number | null;
  calibrated_prob: number | null;
  recommended_bookmaker: string | null;
  result: string | null;
  matches: {
    date: string;
    leagues: { name: string; country: string } | null;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
  bots: { name: string; maturity_label: string } | null;
}

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function fetchUpcomingPicks(
  maturityLabels: readonly string[],
): Promise<{ picks: UpcomingPick[]; windowStart: string; windowEnd: string }> {
  const sb = adminClient();
  const now = new Date();
  const horizonHoursForward = 36;
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  );
  const end = new Date(now.getTime() + horizonHoursForward * 3600 * 1000);

  const { data, error } = await sb
    .from("simulated_bets")
    .select(
      `id, match_id, created_at, market, selection,
       odds_at_pick, edge_percent, calibrated_prob, recommended_bookmaker, result,
       matches!inner (
         date,
         leagues ( name, country ),
         home_team:teams!matches_home_team_id_fkey ( name ),
         away_team:teams!matches_away_team_id_fkey ( name )
       ),
       bots!inner ( name, maturity_label )`,
    )
    .in("result", ["pending", "won", "lost", "void"])
    .in("bots.maturity_label", maturityLabels as string[])
    .is("bots.retired_at", null)
    .not("bots.name", "like", "inplay_%")
    .in("market", PRE_MATCH_MARKETS)
    .gte("matches.date", start.toISOString())
    .lte("matches.date", end.toISOString())
    .order("matches(date)", { ascending: true })
    .limit(300);

  if (error) throw new Error(`upcoming picks: ${error.message}`);

  const rows = (data ?? []) as unknown as BetRow[];

  const dedup = new Map<string, BetRow>();
  for (const r of rows) {
    const key = `${r.match_id}|${r.market}|${r.selection}`;
    const existing = dedup.get(key);
    if (!existing || (r.edge_percent ?? 0) > (existing.edge_percent ?? 0)) {
      dedup.set(key, r);
    }
  }

  const picks: UpcomingPick[] = Array.from(dedup.values()).map((r) => ({
    id: r.id,
    match_id: r.match_id,
    kickoff_utc: r.matches?.date ?? null,
    league: r.matches?.leagues?.name ?? null,
    country: r.matches?.leagues?.country ?? null,
    home_team: r.matches?.home_team?.name ?? null,
    away_team: r.matches?.away_team?.name ?? null,
    market: r.market,
    selection: r.selection,
    odds: r.odds_at_pick,
    edge_pct:
      r.edge_percent != null
        ? Number((Number(r.edge_percent) * 100).toFixed(2))
        : null,
    min_odds: breakEvenOdds(r.odds_at_pick, r.edge_percent, r.calibrated_prob),
    bookmaker: r.recommended_bookmaker,
    posted_at_utc: r.created_at,
    result: (r.result ?? "pending") as UpcomingPick["result"],
  }));

  return {
    picks,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}

export async function fetchUserPickMarkStates(
  userId: string,
): Promise<Map<string, 1 | 2>> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("user_pick_marks")
    .select("pick_id, state")
    .eq("user_id", userId);
  if (error) throw new Error(`user_pick_marks: ${error.message}`);
  const map = new Map<string, 1 | 2>();
  for (const r of (data ?? []) as { pick_id: string; state: number }[]) {
    map.set(r.pick_id, r.state === 1 ? 1 : 2);
  }
  return map;
}
