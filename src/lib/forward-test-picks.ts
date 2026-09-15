/**
 * PICKS-PAGE-SHOW-FORWARD-TEST (2026-09-14) — read path for the pre-registered
 * sharp-edge forward test.
 *
 * WHY THIS FILE REPLACED THE `simulated_bets` PATH ON /picks
 *
 * /picks read `simulated_bets` filtered to calibrated bots and rendered a MODEL
 * edge ("Edge: +8.5%" = our calibrated probability minus the implied price).
 * Migration 335 deleted the O/U Platt calibrator that had been fitted on raw
 * ensemble probabilities and applied to Pinnacle-shrunk ones, manufacturing
 * ~8-9 percentage points of that edge on every pick it touched. With it gone,
 * nothing clears the old model floors and the query returns nothing — the page
 * is dead, not quiet.
 *
 * What replaced it uses NO MODEL. A pick is a price that beats the Shin-de-vigged
 * Pinnacle line by >= 3%, at odds <= 4.0, with the anchor quote and the bet quote
 * within 60 minutes, top 8 a day by edge. The rule and its stopping criteria are
 * locked in dev/active/picks-forward-test-preregistration.md (engine repo) and
 * pinned by the smoke test PICKS-FORWARD-TEST-RULE-LOCKED.
 *
 * THREE RULES THIS MODULE EXISTS TO ENFORCE
 *
 * 1. **Never show the backtest number.** The rule backtested +5.5% ROI with a
 *    95% CI of [-0.7, +11.7] — a positive point estimate whose interval includes
 *    zero, i.e. NO DEMONSTRATED EDGE. It is a prior, not a record. The only
 *    aggregate this module can return is the LIVE one from
 *    `picks_forward_test_summary`, and it always carries its n and its CI.
 * 2. **Never link these picks to /performance.** That page is the model-anchored
 *    ledger: priced on the manufactured edge above, and surviving in 2 bots out
 *    of 46. Whatever it shows does not transfer to this method, and putting the
 *    two on one page would imply it does.
 * 3. **Never show the junk_anchor arm.** It is the negative control — the same
 *    rule with the anchor shuffled to a different fixture, expected to lose the
 *    vig. The filter lives in the VIEW (`picks_forward_test_public` is
 *    `WHERE arm = 'live'`), not here, so it cannot be forgotten at a call site.
 *
 * TIER: FREE, including signed-out. These exact picks are broadcast to a public
 * Telegram channel (@oddsintelpicks) the moment they are generated. Gating on
 * the website what we simultaneously publish to an open channel would be
 * theatre, and the pre-registration requires the published set and the recorded
 * ledger to be the same set. There is therefore nothing to gate server-side.
 */
import { createSupabasePublic } from "./supabase-public";

export interface ForwardTestPick {
  id: string;
  match_id: string;
  market: string;
  selection: string;
  odds: number | null;
  bookmaker: string | null;
  /** Sharp edge as a FRACTION (0.053 = +5.3%). Not a probability-point edge. */
  edge: number | null;
  p_sharp: number | null;
  rule_version: string;
  /** Minutes between the anchor quote and the bet quote. The rule caps it at 60. */
  alignment_gap_minutes: number | null;
  kickoff_utc: string | null;
  published_at: string;
  league: string | null;
  country: string | null;
  home_team: string | null;
  away_team: string | null;
  outcome: "won" | "lost" | "push" | "void" | null;
  pnl: number | null;
  clv: number | null;
  clv_margin_corrected: number | null;
}

export interface ForwardTestSummary {
  /** Which pre-registered rule produced these picks. NEVER pool across it. */
  rule_version: string;
  started_at: string | null;
  published: number;
  pending: number;
  refunded: number;
  /** won + lost. Pushes/voids return the stake and carry no return. */
  settled: number;
  won: number;
  pnl_units: number | null;
  /** Mean unit return. Multiply by 100 for a percentage. */
  roi: number | null;
  /** Sample sd of the per-bet unit return — the input to the CI, never shown raw. */
  roi_sd: number | null;
  n_clv: number;
  clv_raw: number | null;
  n_clv_mc: number;
  clv_margin_corrected: number | null;
  clv_mc_sd: number | null;
}

/**
 * 95% CI half-width for a mean, from the sample sd and n.
 *
 * Returned separately from the mean, and every caller in this codebase renders
 * both, because the entire point of the pre-registration is that the interval
 * is what decides the test. A +5.5% with [-0.7, +11.7] and a +5.5% with
 * [+4.9, +6.1] are different claims, and only one of them is a claim at all.
 *
 * null below n=2 (an sd needs two points) — an interval we cannot compute is
 * shown as "not yet", never as zero width.
 */
export function ci95(sd: number | null, n: number): number | null {
  if (sd == null || !Number.isFinite(sd) || n < 2) return null;
  return 1.96 * (sd / Math.sqrt(n));
}

/**
 * Break-even price for a forward-test pick: 1 / P_shin.
 *
 * A pick is only worth taking near the price it was found at. Odds move after
 * publication, and a pick posted at 3.00 is worthless well above 2.60 — so the
 * reader needs the price below which the bet is negative-EV *against the sharp
 * line*, which is simply the reciprocal of the de-vigged sharp probability.
 *
 * This replaces the model-era break-even (`breakEvenOdds` in upcoming-picks.ts,
 * `1 / cal_prob`). Same purpose, different estimator: the anchor is now the
 * Shin-de-vigged Pinnacle line rather than our calibrated model — which is the
 * whole point of the method change, and the reason the two numbers must not be
 * mixed. Returns null rather than a wrong number when p_sharp is unusable; a
 * missing floor is honest, an invented one is not.
 */
export function sharpBreakEvenOdds(pSharp: number | null): number | null {
  if (pSharp == null) return null;
  const p = Number(pSharp);
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  return Number((1 / p).toFixed(2));
}

/**
 * Whether a fixture has kicked off. Lives here rather than inline in the page
 * because `Date.now()` inside a component body is an impure call during render
 * (react-hooks/purity) — the clock is data, so it is read in the data layer.
 */
export function hasStarted(kickoffUtc: string | null): boolean {
  if (!kickoffUtc) return false;
  return new Date(kickoffUtc).getTime() < Date.now();
}

/** Fixtures kicking off from `hoursBack` ago to `hoursForward` ahead. */
export async function fetchForwardTestPicks(
  hoursBack = 24,
  hoursForward = 48,
): Promise<ForwardTestPick[]> {
  const sb = createSupabasePublic();
  const now = Date.now();
  const { data, error } = await sb
    .from("picks_forward_test_public")
    .select(
      `id, match_id, market, selection, odds, bookmaker, edge, p_sharp,
       rule_version, alignment_gap_minutes, kickoff_utc, published_at, league,
       country, home_team, away_team, outcome, pnl, clv, clv_margin_corrected`,
    )
    .gte("kickoff_utc", new Date(now - hoursBack * 3600_000).toISOString())
    .lte("kickoff_utc", new Date(now + hoursForward * 3600_000).toISOString())
    .order("kickoff_utc", { ascending: true })
    .limit(200);

  if (error) throw new Error(`forward-test picks: ${error.message}`);
  return (data ?? []) as unknown as ForwardTestPick[];
}

export interface BoardLeg {
  match_id: string;
  market: string;
  selection: string;
  odds: number | null;
  bookmaker: string | null;
  p_sharp: number | null;
  /** Expected-ROI edge AT THE CURRENT PRICE. Negative-to-small is normal here. */
  edge: number | null;
  odds_breakeven: number | null;
  odds_grade_b: number | null;
  odds_grade_a: number | null;
  anchor_overround: number | null;
  kickoff_utc: string | null;
  updated_at: string;
  league: string | null;
  country: string | null;
  home_team: string | null;
  away_team: string | null;
}

/**
 * The live candidate board — every leg at or above break-even against the sharp
 * line, with the price it would need to become a pick.
 *
 * PICKS-BOARD-WATCHLIST (2026-09-15). The pre-registered rule publishes only
 * legs clearing a 3% expected-ROI floor, and on a flat day that is nothing at
 * all (0 of 31 the day this shipped). Showing the board with required prices
 * gives a reader something every day WITHOUT lowering the floor: the arithmetic
 * is exact and claims nothing — edge = p_sharp x odds - 1, so the price needed
 * for a target edge t is (1 + t) / p_sharp.
 *
 * ⚠️ THESE ARE NOT PICKS AND MUST NEVER BE RENDERED AS PICKS. A leg here did not
 * qualify. It comes from `picks_board`, a display table replaced every 30
 * minutes — not from `picks_forward_test`, which is the graded, pre-registered
 * ledger whose n feeds the stopping rules. Do not merge, count, or settle these.
 *
 * Returns [] rather than throwing: the watchlist is a nice-to-have and must
 * never take the picks page down with it.
 */
export async function fetchBoard(): Promise<BoardLeg[]> {
  const sb = createSupabasePublic();
  const { data, error } = await sb
    .from("picks_board_public")
    .select(
      `match_id, market, selection, odds, bookmaker, p_sharp, edge,
       odds_breakeven, odds_grade_b, odds_grade_a, anchor_overround,
       kickoff_utc, updated_at, league, country, home_team, away_team`,
    )
    .order("edge", { ascending: false })
    .limit(40);
  if (error || !data) return [];
  return data as unknown as BoardLeg[];
}

/**
 * The running result of the CURRENT pre-registered rule.
 *
 * FORWARD-TEST-SUMMARY-POOLS-RULE-VERSIONS (2026-09-15). `picks_forward_test_summary`
 * returns ONE ROW PER `rule_version`, and these rows must never be summed. A
 * rule change starts a new test with a new start date and its own n — v1
 * (`sharp_edge_v1_2026_09_14`) was closed at n=8 when v2 added the 20%
 * book/anchor price-ratio cap — and carrying a closed test's n into a running
 * one is the exact discipline failure the pre-registration exists to prevent. A
 * checkpoint at n=200 would fire eight picks early on a mix of two rules.
 *
 * So: the current test is the row with the latest `started_at`, and earlier
 * rows are returned separately rather than silently dropped. A closed
 * pre-registered test keeps its own number; it just is not this one.
 *
 * Null when the view is unreachable — callers show nothing rather than a zero,
 * because "0.0%" and "we don't know" are different facts.
 */
export async function fetchForwardTestSummary(): Promise<{
  current: ForwardTestSummary;
  closed: ForwardTestSummary[];
} | null> {
  const sb = createSupabasePublic();
  const { data, error } = await sb
    .from("picks_forward_test_summary")
    .select("*")
    .order("started_at", { ascending: false });
  if (error || !data || data.length === 0) return null;
  const rows = data as unknown as ForwardTestSummary[];
  return { current: rows[0], closed: rows.slice(1) };
}
