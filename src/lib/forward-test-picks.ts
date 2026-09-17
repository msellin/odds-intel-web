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
 * within 60 minutes. There is NO daily selection cap — `TOP_N = 8` was
 * pre-registered and dropped on 2026-09-15 (PICKS-NO-DAILY-CAP) once it was
 * shown to be discarding qualifying legs on busy days; a 60/day runaway breaker
 * remains. The rule and its stopping criteria are
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
 * `sharpBreakEvenOdds(p_sharp)` and `fetchForwardTestPicks()` lived here until
 * 2026-09-16. Both are deleted, not deprecated, and the reason is the same:
 *
 *  * `sharpBreakEvenOdds` was `1 / P_shin` — break-even against the de-vigged
 *    Pinnacle line — and /picks was its only caller. PICKS-SHOW-BOTH-BOTS put
 *    both bot families on that page, where the anchor is `p_sharp` for one arm
 *    and `calibrated_prob` for the other. `breakEvenFromFairProb(fair_prob)`
 *    replaces it: same arithmetic, either anchor, and the caller must name
 *    which one (ANCHOR_NAME in picks/page.tsx). Two functions computing one
 *    number is how a page ends up showing a break-even against an anchor the
 *    edge was never measured from.
 *
 *  * `fetchForwardTestPicks` read `picks_forward_test_public` — the sharp arm
 *    alone — and both of its callers, /picks and /api/v1/upcoming, now read
 *    `picks_public_all` via `fetchPublicPicks`. Leaving it exported would have
 *    left a SECOND definition of "the published cohort" for a future call site
 *    to pick by accident, which is precisely what PICKS-COHORT-ALIGN exists to
 *    stop.
 *
 * Git history has both if a reader needs the old shapes.
 */

/**
 * Whether a fixture has kicked off. Lives here rather than inline in the page
 * because `Date.now()` inside a component body is an impure call during render
 * (react-hooks/purity) — the clock is data, so it is read in the data layer.
 */
export function hasStarted(kickoffUtc: string | null): boolean {
  if (!kickoffUtc) return false;
  return new Date(kickoffUtc).getTime() < Date.now();
}

/**
 * Hours elapsed since midnight UTC — the lookback that means "today, all of it".
 *
 * PICKS-SHOW-WHOLE-DAY (2026-09-15, owner: "picks page loses daily picks, only
 * shows upcoming ... before 14 sept change, it showed all todays, even the ones
 * that were settled"). /picks uses a KICKOFF-keyed window, and a fixed 24h
 * lookback is the wrong shape for a day's card: at 20:00 it reaches back into
 * yesterday evening, and at 06:00 it reaches back almost the whole of yesterday
 * while the morning's own picks have not published yet. That is how the page
 * came to show yesterday's settled losers and nothing else.
 *
 * Anchoring the lookback to the start of the UTC day fixes both ends at once:
 * every pick kicking off TODAY stays on the page for the whole day, won or lost
 * or in play, and yesterday drops off at midnight instead of trailing a rolling
 * 24 hours behind the clock.
 *
 * UTC, not the viewer's timezone, because kickoffs are stored in UTC and this
 * runs server-side — a server-local day boundary would silently follow whatever
 * TZ the box happens to have.
 */
export function hoursSinceUtcMidnight(now: Date = new Date()): number {
  return (
    now.getUTCHours() +
    now.getUTCMinutes() / 60 +
    now.getUTCSeconds() / 3600
  );
}

export interface PublicPick {
  id: string;
  /**
   * ⚠️ LOAD-BEARING. `edge` below means two different things and they are NOT
   * comparable:
   *
   *   'sharp' -> p_sharp x odds - 1        a RETURN, vs a de-vigged Pinnacle line
   *   'model' -> cal_prob - 1/odds         PROBABILITY POINTS, vs our own model
   *
   * A reader who sees +16.0 next to +3.3 and concludes the first is five times
   * better has been misled by us — a 16-point model edge at odds of 4.00 is
   * roughly +64% expected return. Every render of `edge` MUST switch its label
   * on this field, and so must the break-even tooltip, because `fair_prob` is
   * an anchor probability from two different anchors. SYSTEM_MAP §1.
   */
  edge_kind: "sharp" | "model";
  /** Which bot produced it — shown per row so the two families stay tellable apart. */
  bot: string;
  match_id: string;
  market: string;
  selection: string;
  odds: number | null;
  bookmaker: string | null;
  /** A FRACTION in both arms (0.047 = 4.7). See edge_kind for what it measures. */
  edge: number | null;
  /** The anchor probability: p_sharp (sharp) or calibrated_prob (model). */
  fair_prob: number | null;
  rule_version: string | null;
  alignment_gap_minutes: number | null;
  kickoff_utc: string | null;
  published_at: string;
  league: string | null;
  country: string | null;
  home_team: string | null;
  away_team: string | null;
  outcome: "won" | "lost" | "push" | "void" | null;
  clv: number | null;
}

/**
 * Break-even price for a pick: 1 / fair_prob.
 *
 * Works for both arms because `fair_prob` is whichever anchor probability that
 * arm is priced against — but it is break-even AGAINST A DIFFERENT ANCHOR in
 * each, so any UI that shows it must say which (drive the wording off
 * `edge_kind`). Returns null rather than a wrong number on unusable input: a
 * missing floor is honest, an invented one is not.
 */
export function breakEvenFromFairProb(fairProb: number | null): number | null {
  if (fairProb == null) return null;
  const p = Number(fairProb);
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;
  return Number((1 / p).toFixed(2));
}

/**
 * Every pick offered to customers, both families, kicking off in the window.
 *
 * Same day-anchored window as before (see hoursSinceUtcMidnight): today stays
 * all day, yesterday drops at midnight.
 */
export async function fetchPublicPicks(
  hoursBack = 24,
  hoursForward = 48,
): Promise<PublicPick[]> {
  const sb = createSupabasePublic();
  const now = Date.now();
  const { data, error } = await sb
    .from("picks_public_all")
    .select(
      `id, edge_kind, bot, match_id, market, selection, odds, bookmaker, edge,
       fair_prob, rule_version, alignment_gap_minutes, kickoff_utc, published_at,
       league, country, home_team, away_team, outcome, clv`,
    )
    .gte("kickoff_utc", new Date(now - hoursBack * 3600_000).toISOString())
    .lte("kickoff_utc", new Date(now + hoursForward * 3600_000).toISOString())
    .order("kickoff_utc", { ascending: true })
    .limit(200);

  if (error) throw new Error(`public picks: ${error.message}`);
  return (data ?? []) as unknown as PublicPick[];
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
  // PICKS-WATCHLIST-FUTURE-ONLY-2026-09-17. Two defects, both reader-visible.
  //
  // (1) NO KICKOFF FILTER. Neither this query nor `picks_board_public` bounded
  //     kickoff, and `write_board` does not remove finished legs. Because the
  //     list sorts by edge descending, yesterday's matches sat at the TOP:
  //     measured 2026-09-16, 18 of the 40 rows had already kicked off, up to
  //     19.6h earlier, several already settled — Liverpool v Tottenham was shown
  //     as a price to watch 18.6h after kickoff, outcome `won`. A watchlist of
  //     finished matches is worse than an empty one.
  //
  // (2) THE COUNT WAS A CAP. The caller renders `watchlist.length` as "N prices
  //     we're tracking". With a hard `.limit(40)` against a view holding 132
  //     rows, that read "40" every day regardless of the real number — a cap
  //     presented as a measurement. The limit stays (the panel is collapsed and
  //     40 is plenty to render) but the caller now says "top N by edge" instead
  //     of implying it counted something.
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("picks_board_public")
    .select(
      `match_id, market, selection, odds, bookmaker, p_sharp, edge,
       odds_breakeven, odds_grade_b, odds_grade_a, anchor_overround,
       kickoff_utc, updated_at, league, country, home_team, away_team`,
    )
    .gt("kickoff_utc", nowIso)
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
