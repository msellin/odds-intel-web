import { HEADLINE_STATUSES } from "@/lib/bot-status";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createSupabasePublic } from "./supabase-public";

const CACHE_300S = { revalidate: 300 };

// Service role client — bypasses RLS. Server-side only, never sent to browser.
// PostgREST URL + service_role JWT under CrossRank pattern (Supabase→VPS
// migration Phase 4). Env vars fall back to Supabase project so this deploys
// without cutover; Phase 6 flips POSTGREST_URL to api.oddsintel.app.
function createSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// ─── Ops snapshot types ──────────────────────────────────────────────────────

export interface OpsSnapshot {
  id: number;
  snapshot_date: string;
  created_at: string;
  // ① Fixtures
  matches_today: number | null;
  matches_with_odds: number | null;
  matches_with_pinnacle: number | null;
  matches_with_predictions: number | null;
  matches_with_signals: number | null;
  matches_with_fvectors: number | null;
  matches_missing_grade: number | null;
  matches_postponed_today: number | null;
  // ② Odds
  odds_snapshots_today: number | null;
  distinct_bookmakers: number | null;
  matches_without_pinnacle: number | null;
  // #119 — sharp anchor = Pinnacle OR a liquid Betfair Exchange market (null before migration 397)
  matches_with_exchange_liquid?: number | null;
  matches_with_sharp?: number | null;
  matches_without_sharp?: number | null;
  odds_market_match_winner: number | null;
  odds_market_goals_ou: number | null;
  odds_market_btts: number | null;
  // ③ Bets
  bets_placed_today: number | null;
  bets_pending: number | null;
  bets_settled_today: number | null;
  pnl_today: number | null;
  bets_inplay_today: number | null;
  active_bots: number | null;
  silent_bots: number | null;
  duplicate_bets: number | null;
  // ④ Live
  live_snapshots_today: number | null;
  snapshots_with_xg: number | null;
  snapshots_with_live_odds: number | null;
  live_games_tracked: number | null;
  live_games_with_xg: number | null;
  live_games_with_odds: number | null;
  inplay_active_bots: number | null;
  // ⑤ Post-match
  matches_finished_today: number | null;
  post_mortem_ran_today: boolean | null;
  feature_vectors_today: number | null;
  elo_updates_today: number | null;
  // ⑥ Enrichment
  matches_with_h2h: number | null;
  matches_with_injuries: number | null;
  matches_with_lineups: number | null;
  signals_with_elo: number | null;
  signals_with_form: number | null;
  signals_with_h2h: number | null;
  signals_with_injuries: number | null;
  signals_with_standings: number | null;
  // ⑦ Email
  digests_sent_today: number | null;
  value_bet_alerts_today: number | null;
  previews_generated_today: number | null;
  news_checker_errors_today: number | null;
  watchlist_alerts_today: number | null;
  // ⑧ Backfill
  backfill_total_done: number | null;
  backfill_total_finished: number | null;
  backfill_last_run: string | null;
  // ⑨ API budget
  af_calls_today: number | null;
  af_budget_remaining: number | null;
  // ⑩ Users
  total_users: number | null;
  pro_users: number | null;
  elite_users: number | null;
  new_signups_today: number | null;
}

export interface PipelineRun {
  id: number;
  job_name: string;
  run_date: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  fixtures_count: number | null;
  records_count: number | null;
  error_message: string | null;
}

// ─── Frontend types (same interface as before) ──────────────────────────────


export interface LiveBetComboLeg {
  matchId: string;
  match: string;        // "Home vs Away", resolved server-side
  league: string;
  market: string;
  selection: string;
  odds: number;
  prob: number;
  botSource: string | null;
  // Settled per-leg outcome. "pending" = match not finished yet, "void" = scores missing.
  result: "won" | "lost" | "pending" | "void";
  // Final score, when finished. null while pending.
  scoreHome: number | null;
  scoreAway: number | null;
}

// Decide if a single combo leg won/lost given the final score. Markets are
// limited to the acca-bot eligible set (btts + ou15/ou25/ou35). Anything else
// returns "void" so the leg is visibly flagged rather than silently mis-settled.
function settleComboLeg(
  market: string,
  selection: string,
  scoreHome: number | null,
  scoreAway: number | null,
): "won" | "lost" | "pending" | "void" {
  if (scoreHome == null || scoreAway == null) return "pending";
  const m = market.toLowerCase();
  const s = selection.toLowerCase();
  const total = scoreHome + scoreAway;
  if (m === "btts") {
    const bothScored = scoreHome > 0 && scoreAway > 0;
    if (s === "yes") return bothScored ? "won" : "lost";
    if (s === "no") return bothScored ? "lost" : "won";
    return "void";
  }
  const ouLine: Record<string, number> = { ou15: 1.5, ou25: 2.5, ou35: 3.5, ou45: 4.5 };
  if (m in ouLine) {
    const line = ouLine[m];
    if (s === "over") return total > line ? "won" : "lost";
    if (s === "under") return total < line ? "won" : "lost";
    return "void";
  }
  return "void";
}

// LANDING-PERF-ROI-BASIS-2026-09-05 ───────────────────────────────────────────
// `odds_at_pick` is a high-water mark, not an offer. STALE-BEST-ODDS found the
// pipeline taking MAX() across a fixture's entire snapshot history, so it records
// the best price ANY book showed at ANY time. `odds_at_pick_live` (migration 291)
// prices the same pick at the best quote from an accessible book at or before
// pick_time. Same helper and same reasoning as the admin shadow-bots pages.
export function execOdds(
  oddsAtPick: number | string | null,
  oddsAtPickLive: number | string | null
): number {
  const live = oddsAtPickLive != null ? Number(oddsAtPickLive) : null;
  if (live != null && live > 1) return live;
  return Number(oddsAtPick ?? 0);
}

/**
 * @deprecated [[#159]] (2026-09-25) — NOT a basis for any shown ROI. Per-bot and headline figures
 * come from the engine view `bot_performance` / `bot_ledger.pnl_unit_public` (lib/bot-performance):
 * FLAT stake at the best price available at pick time on all books. Kept only for the legacy LiveBet
 * shape (caller: toBet via getAllBets — not rendered today; getPlaceableBets was deleted #162 W4.6).
 * Smoke LEGACY-CLV-PNL-NO-NEW-READERS.
 *
 * #162 (2026-09-25): returns the STORED pnl — since engine migration 441 (#155) that IS the public
 * figure (flat EUR 10 at the published price, = bot_ledger.pnl_unit_public). It used to re-price at our
 * books (odds_at_pick_live), which disagreed with /performance. Same rule as settlement._EXEC_PNL.
 */
export function execPnl(row: {
  result?: string | null;
  stake?: number | string | null;
  pnl?: number | string | null;
  odds_at_pick?: number | string | null;
  odds_at_pick_live?: number | string | null;
  combo_legs?: unknown;
}): number {
  // #162 (2026-09-25): since #155's flat restatement (engine migration 441) the STORED pnl is the public
  // figure — flat EUR 10 at the PUBLISHED price (pnl_price_basis), equal to bot_ledger.pnl_unit_public.
  // Re-pricing at our books here (odds_at_pick_live) disagreed with /performance and bot_performance.
  // Same change as the engine's settlement._EXEC_PNL, so the two cannot drift.
  return Number(row.pnl || 0);
}

export interface LiveBet {
  id: string;
  matchId: string;
  bot: string;
  match: string;
  league: string;
  tier: number;
  market: string;
  selection: string;
  odds: number;
  /** Executable price at pick time — see execOdds. `odds` stays the raw stored value. */
  oddsExec: number;
  modelProb: number;
  impliedProb: number;
  edge: number;
  stake: number;
  kickoff: string;
  placedAt: string;
  result: string;
  pnl: number;
  bankrollAfter: number | null;
  closingOdds: number | null;
  clv: number | null;
  recommendedBookmaker: string | null;
  // Combo/system bets — null for singles.
  comboLegs: LiveBetComboLeg[] | null;
  comboSize: number | null;
  systemType: string | null;
  strategyProfile: string | null;
  // PRO-TIER-V2 (2026-06-02): is this pick from an inplay bot? Drives the
  // separate "Live now" section on /value-bets. Inplay bots write xg_source
  // and/or have name LIKE 'inplay_%' — either is sufficient.
  isInplay: boolean;
  // INPLAY-METADATA-STALENESS (2026-06-03): for inplay picks, the match
  // minute + score at the moment the bet was offered. NULL for prematch.
  // UI uses these to render an "In-play · 23' · 0-1" chip so users can
  // tell a 3' pick (close to prematch state) from a 67' pick.
  matchMinuteAtPick: number | null;
  scoreHomeAtPick: number | null;
  scoreAwayAtPick: number | null;
}

// ─── Supabase row types ─────────────────────────────────────────────────────



// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimBetRow = Record<string, any>;

// ─── Public match type (no auth required) ──────────────────────────────────














// ─── Data fetching functions ────────────────────────────────────────────────

// ─── Signal intelligence batch fetch (SUX-1/2/3) ───────────────────────────

// ALL-BETS-CEILING-DEAD (fixed 2026-09-21). The previous .limit(500) silently
// truncated the per-bot aggregate tables once total bets exceeded 500, making
// /admin/bots and the per-bot modal disagree with the /performance leaderboard.
// It was replaced by .range(0, 19999) plus a warn above 20,000 — and THAT
// guard could never fire, because our PostgREST runs with
// PGRST_DB_MAX_ROWS=10000 (verified on the container 2026-09-21). The server
// caps the response at 10,000 and says nothing: a capped response is byte-for-byte
// indistinguishable from a complete one, so the page would have silently
// aggregated half the ledger from the moment simulated_bets passed 10k, while a
// guard sitting at 20k watched. Same shape as SHADOW-BOTS-DETAIL-TRUNCATION and
// COMP-FALLBACK-DRIFT.
//
// Fixed by paging. The ceiling below is now a REAL ceiling: pagination stops
// there and warns, and it is far enough above the table (4,672 rows on
// 2026-09-21) to be a genuine anomaly rather than a routine cap.
const PAGED_ROW_CEILING = 200000;

const PAGE = 5000;

/**
 * Read every row a filtered query matches, in PAGE-sized slices.
 *
 * `page(from, to)` must apply a deterministic .order() — without one, Postgres
 * may return rows in a different order per page and paging will both duplicate
 * and drop rows, which is worse than the truncation this exists to fix.
 *
 * Returns `truncated: true` only if the hard ceiling was reached, which is a
 * real anomaly worth a warning rather than the routine state it used to be.
 */
async function fetchAllPaged<T>(
  label: string,
  ceiling: number,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < ceiling; from += PAGE) {
    const to = Math.min(from + PAGE, ceiling) - 1;
    const { data, error } = await page(from, to);
    if (error) {
      console.warn(`[${label}] page ${from}-${to} failed:`, error);
      return { rows, truncated: true };
    }
    if (!data || data.length === 0) return { rows, truncated: false };
    rows.push(...data);
    if (data.length < to - from + 1) return { rows, truncated: false };
  }
  console.warn(
    `[${label}] stopped at the ${ceiling}-row ceiling — this figure is computed ` +
    `on a SUBSET and understates the true total. Raise the ceiling or move this ` +
    `aggregate into the database.`
  );
  return { rows, truncated: true };
}




















export interface BotRecord {
  id: string;
  /** The IDENTITY. Join key for simulated_bets, shadow_bets, real_bets,
   *  picks_public_all and ENGINE_BOT_FLOORS. Never rendered as the primary
   *  label on a customer surface — see `displayName`. */
  name: string;
  /** BOT-NAMES-AND-LABELS (migration 375, [[#069]]). Human-readable label for
   *  /performance and /picks. DISPLAY ONLY — never join, filter or key on it.
   *  Null for bots that predate the column; callers fall back to `name`. */
  displayName: string | null;
  strategy: string | null;
  description: string | null;
  strategyDescription: string | null;
  startingBankroll: number;
  currentBankroll: number;
  isActive: boolean;
  retiredAt: string | null;
  maturityLabel: string;
  /** #148 (migration 420): the paid-tier "VIP" bot. Shown on /performance with
   *  SETTLED picks only — its pending picks are the paid product, delivered
   *  privately before kickoff. RLS hides them from anon/authenticated too. */
  isVip: boolean;
  /** #148 (migration 421): pending rows hidden from public reads — the VIP bot
   *  AND twins whose pending picks are the VIP bot's own (bot_ou_sharp_2anchor_v1; the EV8
   *  twin bot_combined_1x2_ev8_v1 was retired 2026-09-25). Not a VIP card by itself. */
  hidePending: boolean;
  showOnPerformance?: boolean;
}

// PERF-VPS-2026-07-07: switched from createSupabaseServer (cookies) to admin
// client so this can be wrapped with unstable_cache. The frontend still gates
// bankroll display per-user tier — caching the DB result doesn't leak data.
const _getAllBotsFromDBUncached = async (): Promise<BotRecord[]> => {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("bots")
    .select("id, name, display_name, strategy, description, strategy_description, starting_bankroll, current_bankroll, is_active, retired_at, maturity_label, vip, hide_pending, show_on_performance")
    .order("name");
  if (error || !data) {
    console.error("[getAllBotsFromDB] query failed:", error?.message ?? "no data");
    return [];
  }
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    displayName: (r.display_name as string | null) ?? null,
    strategy: r.strategy as string | null,
    description: r.description as string | null,
    strategyDescription: r.strategy_description as string | null,
    startingBankroll: Number(r.starting_bankroll ?? 1000),
    currentBankroll: Number(r.current_bankroll ?? 1000),
    isActive: Boolean(r.is_active),
    retiredAt: (r.retired_at as string | null) ?? null,
    maturityLabel: (r.maturity_label as string) ?? 'active',
    isVip: r.vip === true,
    hidePending: r.hide_pending === true || r.vip === true,
    // #152: owner-chosen TESTING bots listed on /performance (migration 427) — label stays 'testing'.
    showOnPerformance: r.show_on_performance === true,
  }));
};

export const getAllBotsFromDB = unstable_cache(
  _getAllBotsFromDBUncached,
  // v2: the row shape gained display_name (migration 375) — the key must
  // change or 30 minutes of cached rows come back without it.
  // v3: gained `vip` (migration 420, #148); v4: `hide_pending` (migration 421).
  // v5: `show_on_performance` (migration 427, #152).
  ["getAllBotsFromDB_v5"],
  { revalidate: 1800 }
);

/** @deprecated [[#159]] — /performance no longer reads raw bets (rows: bot_performance; detail
 *  view: /api/performance/bot-legs; history: getCohortLegs). Its `pnl` is stake-weighted and its
 *  `clv` is the legacy column. Do not add readers. */
export async function getAllBets(): Promise<LiveBet[]> {
  const supabase = createSupabasePublic();

  const { rows: data } = await fetchAllPaged<SimBetRow>(
    "getAllBets", PAGED_ROW_CEILING,
    (from, to) => supabase
      .from("simulated_bets")
      .select(
        `id, match_id, market, selection, odds_at_pick, odds_at_pick_live, pick_time, stake,
         model_probability, calibrated_prob, edge_percent, closing_odds, clv, result, pnl,
         bankroll_after, news_triggered, reasoning, strategy_profile,
         combo_legs, combo_size, system_type,
         bot:bot_id(id, name, strategy),
         match:match_id(id, date,
           home_team:home_team_id(name),
           away_team:away_team_id(name),
           league:league_id(name, country, tier)
         )`
      )
      // pick_time alone is not unique, so id breaks ties — without a total
      // order Postgres may place an equal-pick_time row on either side of a
      // page boundary, silently duplicating one row and dropping another.
      .order("pick_time", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: SimBetRow[] | null; error: unknown }>,
  );

  if (data.length === 0) return [];

  // Resolve leg match names for combo bets. combo_legs only contains match_id strings —
  // the modal needs "Home vs Away" + league per leg, so batch-fetch them in one query.
  const legMatchIds = new Set<string>();
  for (const row of data as SimBetRow[]) {
    const legs = row.combo_legs;
    if (Array.isArray(legs)) {
      for (const l of legs) {
        if (l?.match_id) legMatchIds.add(String(l.match_id));
      }
    }
  }

  const legMatchMap = new Map<string, {
    match: string;
    league: string;
    scoreHome: number | null;
    scoreAway: number | null;
  }>();
  if (legMatchIds.size > 0) {
    const { data: legMatches } = await supabase
      .from("matches")
      .select(
        `id, status, score_home, score_away,
         home_team:home_team_id(name),
         away_team:away_team_id(name),
         league:league_id(name, country)`
      )
      .in("id", Array.from(legMatchIds));
    for (const m of legMatches ?? []) {
      const home = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team;
      const away = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team;
      const league = Array.isArray(m.league) ? m.league[0] : m.league;
      const finished = m.status === "finished";
      legMatchMap.set(String(m.id), {
        match: home && away ? `${home.name} vs ${away.name}` : "Unknown",
        league: league ? `${league.country} / ${league.name}` : "Unknown",
        scoreHome: finished && m.score_home != null ? Number(m.score_home) : null,
        scoreAway: finished && m.score_away != null ? Number(m.score_away) : null,
      });
    }
  }

  return (data as SimBetRow[]).map((row) => toBet(row, legMatchMap));
}

function toBet(
  row: SimBetRow,
  legMatchMap: Map<string, {
    match: string;
    league: string;
    scoreHome: number | null;
    scoreAway: number | null;
  }> = new Map(),
): LiveBet {
  const bot = Array.isArray(row.bot) ? row.bot[0] : row.bot;
  const match = Array.isArray(row.match) ? row.match[0] : row.match;
  const homeTeam = match?.home_team
    ? Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
    : null;
  const awayTeam = match?.away_team
    ? Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
    : null;
  const league = match?.league
    ? Array.isArray(match.league) ? match.league[0] : match.league
    : null;

  const matchName = homeTeam && awayTeam
    ? `${homeTeam.name} vs ${awayTeam.name}`
    : "Unknown Match";

  const leagueName = league
    ? `${league.country} / ${league.name}`
    : "Unknown";

  return {
    id: row.id,
    matchId: row.match_id || "",
    bot: bot?.name || "unknown",
    match: matchName,
    league: leagueName,
    tier: league?.tier || 1,
    market: row.market,
    selection: row.selection,
    odds: Number(row.odds_at_pick),
    oddsExec: execOdds(row.odds_at_pick, row.odds_at_pick_live),
    modelProb: Number(row.calibrated_prob ?? row.model_probability),
    impliedProb: row.odds_at_pick > 0 ? 1 / Number(row.odds_at_pick) : 0,
    edge: Number(row.edge_percent), // DB stores as decimal (0.10 = 10%)
    stake: Number(row.stake),
    kickoff: match?.date || "",
    placedAt: row.pick_time,
    result: row.result,
    // LANDING-PERF-ROI-BASIS-2026-09-05: price settled P&L at the odds that were
    // actually on offer, not the stored `pnl` (which settlement derives from
    // `odds_at_pick`, a MAX() high-water mark across the fixture's whole snapshot
    // history — see STALE-BEST-ODDS). Every downstream aggregator reads `pnl`,
    // so correcting it here fixes the landing page, /performance and the bot
    // dashboard in one place rather than in four.
    pnl: execPnl(row),
    bankrollAfter: row.bankroll_after != null ? Number(row.bankroll_after) : null,
    closingOdds: row.closing_odds != null ? Number(row.closing_odds) : null,
    clv: row.clv != null ? Number(row.clv) : null,
    recommendedBookmaker: row.recommended_bookmaker ?? null,
    comboLegs: Array.isArray(row.combo_legs)
      ? (row.combo_legs as Array<{
          match_id?: string;
          market?: string;
          selection?: string;
          odds?: number;
          prob?: number;
          bot_source?: string | null;
        }>).map((l) => {
          const resolved = l.match_id ? legMatchMap.get(String(l.match_id)) : undefined;
          const market = String(l.market ?? "");
          const selection = String(l.selection ?? "");
          const scoreHome = resolved?.scoreHome ?? null;
          const scoreAway = resolved?.scoreAway ?? null;
          return {
            matchId: String(l.match_id ?? ""),
            match: resolved?.match ?? "Unknown",
            league: resolved?.league ?? "—",
            market,
            selection,
            odds: Number(l.odds ?? 0),
            prob: Number(l.prob ?? 0),
            botSource: l.bot_source ?? null,
            result: settleComboLeg(market, selection, scoreHome, scoreAway),
            scoreHome,
            scoreAway,
          };
        })
      : null,
    comboSize: row.combo_size != null ? Number(row.combo_size) : null,
    systemType: row.system_type ?? null,
    strategyProfile: row.strategy_profile ?? null,
    // PRO-TIER-V2 (2026-06-02): xg_source is the canonical inplay marker
    // (live-poller writes it on every inplay bet); bot name prefix is a
    // belt-and-braces fallback for any future variant.
    isInplay: row.xg_source != null || String(bot?.name ?? "").startsWith("inplay_"),
    // INPLAY-METADATA-STALENESS (2026-06-03): NULL for prematch picks (the
    // inplay bot writes these directly; everyone else leaves them unset).
    matchMinuteAtPick: row.match_minute_at_pick != null ? Number(row.match_minute_at_pick) : null,
    scoreHomeAtPick: row.score_home_at_pick != null ? Number(row.score_home_at_pick) : null,
    scoreAwayAtPick: row.score_away_at_pick != null ? Number(row.score_away_at_pick) : null,
  };
}

// ── Real bets ────────────────────────────────────────────────────────────────
// #162 W4.6 (2026-09-25): `getPlaceableBets` (+ PlaceableBet / PlaceableBetLeg and the
// real-money-tier badge) and `getRealBets` were DELETED. Both fed pages removed in #139
// (/admin/place) or re-implemented page-locally (/admin/real-bets → lib/admin-money.ts),
// and had no callers. `RealBet` stays: admin-money.ts extends it.

// Per-market edge constants live in `./coolbet-edge` (pure, client-safe). The ones
// server callers still import via `@/lib/engine-data` are re-exported here.
export {
  COOLBET_AUTO_MIN_EDGE_BY_MARKET,
  autoMinEdgeFor,
  MARKET_THRESHOLDS_V2_EPOCH,
} from "./coolbet-edge";

export interface RealBet {
  id: string;
  matchId: string;
  match: string;
  league: string;
  bot: string | null;
  market: string;
  selection: string;
  bookmaker: string;
  capturedOdds: number | null;
  actualOdds: number;
  slippagePct: number | null;
  /** REAL-BETS-CLV-EDGE: edge implied by actual_odds × model_probability − 1, decimal (0.05 = +5%). */
  edgePctTaken: number | null;
  /** DIRECT-BOOK-CLV (2026-09-11): (actual_odds / close AT THE BET'S OWN BOOK) − 1,
   *  decimal; null when that book has no close within 60 min of kickoff. Was vs an
   *  arbitrary API-Football book before 2026-09-11. */
  clv: number | null;
  /** De-vigged Pinnacle CLV: actual_odds × P(Pinnacle close) − 1. Same scale as shadow bets. */
  clvPinnacle: number | null;
  /** Feed that supplied the own-book close, and how many minutes before kickoff it was taken. */
  closingBookmaker: string | null;
  closingMinutesBeforeKo: number | null;
  stake: number;
  placedAt: string;
  result: string;
  pnl: number | null;
  resolvedAt: string | null;
  notes: string | null;
  /** If this real bet was placed from a paper pick, the paired simulated_bet's outcome. */
  paper: { stake: number; pnl: number | null; result: string } | null;
}

// ── Model accuracy (public) ─────────────────────────────────────────────────
// For each finished match that has 1x2 predictions, determine what the model
// called (highest probability among home/draw/away) and whether it was correct.




// ─── AI Match Preview (ENG-3) ─────────────────────────────────────────────────

















// ─── Live in-play odds for FE-LIVE ──────────────────────────────────────────




// ─── Match signals for SUX-4 summary tab ────────────────────────────────────






// ─── Track Record stats (CLV + edge metrics) ──────────────────────────────

export interface TrackRecordStats {
  avgClv: number | null;         // average CLV across settled bets
  totalValueBets: number;        // bets with edge > 0
  avgEdge: number;               // average edge %
  settledBets: number;           // total settled
  leaguesCovered: number;        // distinct leagues with bets
  bookmakersCovered: number;     // distinct bookmakers in odds
}

const _getTrackRecordStatsUncached = async (): Promise<TrackRecordStats> => {
  // Fast path: read from dashboard_cache (written by settlement at 21:00 UTC).
  // Use cache.settled_bets for the hero total so it stays in sync with the
  // per-bot breakdown (both from the same snapshot).
  const [cache, supabaseCounts] = await Promise.all([
    getDashboardCache(),
    createSupabasePublic().rpc("get_coverage_counts", {
      p_odds_since_hours: 24,
      p_matches_since_days: 7,
    }),
  ]);

  if (cache) {
    const row = Array.isArray(supabaseCounts.data) ? supabaseCounts.data[0] : supabaseCounts.data;
    // UI-METRIC-SOT (2026-06-06): the hero's "Avg CLV · active strategies" tile
    // must read `active_avg_clv` (active+non-experimental+non-retired cohort)
    // not the broader `avg_clv` (which includes retired bots and drags the
    // number down). The client `buildPerformanceStats` recompute lands at the
    // active-only number; aligning the cache read here means the cache value
    // matches the recompute exactly, killing the Suspense flicker on
    // /performance. Fallback to `avg_clv` for pre-migration-157 cache rows
    // where `active_avg_clv` is null.
    return {
      avgClv: cache.active_avg_clv ?? cache.avg_clv,
      totalValueBets: cache.settled_bets,
      avgEdge: 0,
      settledBets: cache.settled_bets,
      leaguesCovered: Number(row?.league_count ?? 0),
      bookmakersCovered: Number(row?.bookmaker_count ?? 0),
    };
  }

  // Fallback: live queries (cache not yet populated)
  const supabase = createSupabasePublic();

  const [betsResult, countsResult] = await Promise.all([
    supabase
      .from("simulated_bets")
      .select("clv, edge_percent, match:match_id(league:league_id(name))")
      .neq("result", "pending")
      .limit(1000),
    supabase.rpc("get_coverage_counts", {
      p_odds_since_hours: 24,
      p_matches_since_days: 7,
    }),
  ]);

  const settled = (betsResult.data || []) as Array<{
    clv: number | null;
    edge_percent: number | null;
    match: { league: { name: string } | { name: string }[] | null } | { league: { name: string } | { name: string }[] | null }[] | null;
  }>;

  const withClv = settled.filter((b) => b.clv != null);
  const avgClv = withClv.length > 0
    ? withClv.reduce((sum, b) => sum + Number(b.clv), 0) / withClv.length
    : null;
  const withEdge = settled.filter((b) => b.edge_percent != null);
  const avgEdge = withEdge.length > 0
    ? withEdge.reduce((sum, b) => sum + Number(b.edge_percent), 0) / withEdge.length
    : 0;
  const totalValueBets = withEdge.filter((b) => Number(b.edge_percent) > 0).length;
  const countsRow = Array.isArray(countsResult.data) ? countsResult.data[0] : countsResult.data;
  return {
    avgClv, totalValueBets, avgEdge,
    settledBets: settled.length,
    leaguesCovered: Number(countsRow?.league_count ?? 0),
    bookmakersCovered: Number(countsRow?.bookmaker_count ?? 0),
  };
};

// PERF-VPS-2026-07-07: wrapped with unstable_cache (1800s = 30min).
// /performance page renders 7 parallel queries; caching the slow ones drops
// render time from ~20s to <1s on cache hit. Supabase IO is the bottleneck.
// Raised 300s → 1800s: Uptime Kuma polls every 60s so with 300s TTL, one
// slow (~20s) regeneration hit every 5 min. 30-min TTL means one every 30 min,
// and 30-min-stale track record data is fine (settlement runs once daily).
export const getTrackRecordStats = unstable_cache(
  _getTrackRecordStatsUncached,
  ["getTrackRecordStats_v1"],
  { revalidate: 1800 }
);

// ─── Calibrated pre-match honest stats ─────────────────────────────────────
//
// HEADLINE-COHORT (2026-06-24): the public ROI claim is calibrated bots,
// pre-match markets only (1x2 + O/U + BTTS), no Asian Handicap, since the
// calibrated tier launched (2026-05-04). Excluding AH because calibrated AH
// is -13% over 132 bets and drags the headline — fix-or-retire is a separate
// internal task. Excluding in-play because the variance is wildly different
// and public conflation of the two cohorts produced confusing numbers
// (e.g. "Pre-match ROI 30d -2.2%" when calibrated pre-match all-time is
// +9.57%).

export interface CalibratedHeadlineStats {
  allTime: {
    n: number;
    stakeEur: number;
    pnlEur: number;
    roiPct: number | null;
    /** Median CLV vs ANY-BOOK close, in percent. Matches the cohort + metric
     *  the dashboard_cache.active_avg_clv has used since the product
     *  launched — kept as the public headline so the number doesn't appear
     *  to "collapse" relative to historical claims. */
    medianClvPct: number | null;
    /** Mean CLV vs any-book close, in percent. Inflated by ±50% outliers
     *  from mixed-vintage closing snaps in the historical data; shown as a
     *  transparency footnote, not the headline. The closing_snap.py cron
     *  shipped 2026-06-24 fixes the source of the noise going forward. */
    meanClvPct: number | null;
    /** Pinnacle-specific median CLV — the metric sharp bettors look at.
     *  Smaller than any-book median because Pinnacle is the sharpest book
     *  and has the tightest closing line. Shown as a credibility marker. */
    medianClvPinPct: number | null;
    /** The same cohort with UNOBTAINABLE_BOOKMAKERS removed — prices no
     *  reader could have taken either, not merely books WE cannot place at.
     *  This is a PICKS surface; our Estonian licensing is not a reader's
     *  constraint and must not be published as one. */
    obtainableN: number;
    obtainableRoiPct: number | null;
    /** Settled rows EXCLUDED from roiPct because no accessible book quoted
     *  them at pick time — they were not placeable, and pricing them at the
     *  stale high-water mark inflated the public headline by +1.92pp
     *  (LANDING-PERF-UNPLACEABLE-FALLBACK-2026-09-06). */
    unpriceableExcluded: number;
    /** Share of settled rows roiPct is actually computed over. */
    roiCoveragePct: number;
    clvN: number;
    clvBeatPct: number | null;
    sinceDate: string;
  };
  last30d: {
    n: number;
    roiPct: number | null;
  };
}

export const CALIBRATED_SINCE = "2026-05-04";
// Headline cohort: all production strategies (calibrated + beta + active
// maturities — same cohort the dashboard_cache.active_avg_clv historically
// used). EXCLUDES retired bots (failed experiments) so the headline isn't
// dragged by deactivated losers.
// DUPLICATED-RULES-REMAINING-2026-09-06: renamed from PUBLIC_MATURITY_LABELS.
//
// `upcoming-picks.ts` ALSO exported a `PUBLIC_MATURITY_LABELS` — same
// identifier, same app, DIFFERENT value: ["calibrated"] there against
// ["calibrated","beta","active"] here. They are both correct for their own
// surface, which is exactly what made the collision dangerous: one wrong
// auto-import either widens the ANONYMOUS picks feed to beta/active bots, or
// narrows the published track record, and in both directions the code still
// compiles and looks right.
//
// The tell that someone had already tripped on it: track-record/route.ts
// imported this one under an alias (`as SHARED_PUBLIC_MATURITY_LABELS`) rather
// than by name.
//
// This constant is the HEADLINE / track-record cohort — every production
// strategy, excluding retired bots so failed experiments do not drag the
// number. The anonymous picks cohort lives in upcoming-picks.ts and stays
// narrower on purpose (PICKS-USER-GATE).
// [[#155]]/[[#175]] (2026-09-26): the headline is ACTIVE bots only (BETA + CALIBRATED were merged
// into ACTIVE by engine migration 462) — TESTING bots are sent and keep their own record but are
// NOT in the headline, VIP bots never are (getPublicCohortBotNames drops them). One source:
// lib/bot-status.ts HEADLINE_STATUSES = engine bot_distribution.in_headline.
export const HEADLINE_MATURITY_LABELS = HEADLINE_STATUSES;
export const CALIBRATED_PUBLIC_MARKETS = ["1x2", "o/u", "over_under_25", "btts"] as const;

// FLAT-ROI-EVERYWHERE (2026-08-21): all public-facing ROI numbers use €10
// flat stake per pick, matching the methodology every public tipster
// comparison service (WinnerOdds, Tipstrr, SignalOdds, Forebet) publishes
// under. Internal bots continue staking Kelly (proportional to divergence)
// — this constant is ONLY for representation on the ledger/hero/tiles.
// Kept as its own export so callers can compute matching numbers.
export const FLAT_STAKE_EUR = 10;

// PERF-COHORT-FRESH-BOTS (2026-08-21): the /performance history filter
// used to key on the cached `getAllBotsFromDB` (30-min TTL) — after a
// retirement it took up to 30 min for the just-retired bots to disappear
// from the ledger, while the hero (using a fresh DB join in the same
// query as the stats) already showed the new state. Result: history
// counted more settled bets than the hero for the same "same cohort"
// language. This helper does an uncached fresh read of the current
// public-cohort bot names so the two always reconcile immediately after
// a retirement lands. Called on every /performance request but the query
// is tiny (43-row scan) — total cost < 5ms.
//
// PERF-COHORT-PREMATCH-ONLY (2026-08-21): also exclude inplay bots so the
// hero + ledger + leaderboard all describe the same "public prematch
// strategies" cohort. Was already the leaderboard's rule since
// PERFORMANCE-PUBLIC-PREMATCH-ONLY 2026-06-24; hero + ledger drifted from
// it and users noticed (leaderboard said 8 proven, ledger dropdown showed
// 16 bots). Cost: headline ROI drops ~5pp because inplay was a strong
// contributor. Benefit: everything reconciles + matches the design note.
export async function getPublicCohortBotNames(): Promise<Set<string>> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("bots")
    .select("name")
    .is("retired_at", null)
    .in("maturity_label", HEADLINE_MATURITY_LABELS as unknown as string[])
    .eq("vip", false) // [[#155]] VIP bots have their own record, never the headline
    .not("name", "like", "inplay_%");
  if (error || !data) return new Set();
  return new Set((data as Array<{ name: string }>).map((r) => r.name));
}

// PERF-HEADLINE-IS-THE-RETIRED-ENGINE-2026-09-21, CORRECTED 2026-09-21.
//
// The first version of this filtered to the three books WE can place at from
// Estonia (Coolbet/Epicbet/Unibet-Site) and published the result as a caveat.
// That was the wrong lens for this page. /performance and /picks are PICKS
// surfaces: they serve public readers who are not bound by our licensing, and
// for whom Marathonbet, Bet365 and 10Bet are perfectly obtainable prices. Our
// Estonian restriction is an OWN constraint and belongs nowhere near a public
// track record.
//
// What IS a public-honesty problem is a price no reader could have taken
// either. That is Unibet-Kambi, excluded from ACCESSIBLE_BOOKMAKERS on
// 2026-09-06 (KAMBI-FEED-DIVERGENCE) because 38% of our stored Kambi prices
// read HIGHER than the site actually offered — median +3.3%, max +23.5%. Those
// rows price picks at quotes that never existed, so they inflate the published
// figure for everyone.
//
// Measured 2026-09-21 on the published cohort: all books +8.17% (n=697),
// excluding Kambi +7.25% (n=657). That 0.92pp is the honest correction.
// NOT extended to AF 'Unibet' (reverted 2026-09-24, owner). The "33.1%" measured on
// 2026-09-14 is the SHARE of AF Unibet quotes above what unibet.ee showed — the ESTONIAN
// site. That makes it unplaceable for US (🤖 OWN), not unobtainable for a reader in
// another country, where Unibet prices differ. This is a 👥 PICKS figure: a book's
// Estonian availability is not a reader's constraint (see the note above and
// project_own_vs_picks_book_constraint).
// [[#159]] UNOBTAINABLE_BOOKMAKERS (["Unibet-Kambi"]) retired: the public price basis is now
// computed in the engine over is_publishable_book, which already treats Unibet-Kambi as a
// non-offer — the exclusion happens in ONE place, before any number reaches this file.

// [[#159]] ONE BASIS (2026-09-25, owner-approved). The hero is now summed from the SAME per-leg
// figure the leaderboard rows and dashboard_cache read — bot_ledger.pnl_unit_public (engine
// view, migration 433): FLAT EUR 10 at the best price AVAILABLE when the pick was made on ALL
// publishable books. It used to price here at odds_at_pick_live (our 4 Estonian books) and
// DROP the legs without one, while the rows priced at a different basis — so the hero and the
// table beside it were two definitions. A leg with no quote at pick time is priced at the
// recorded odds and COUNTED (nRecordedPrice → unpriceableExcluded / roiCoveragePct keep their
// meaning as "legs not on a pick-time price"), never silently dropped or silently included.
// The legacy any-book / Pinnacle CLV medians are gone: both read simulated_bets.clv /
// clv_pinnacle (withdrawn, CLV-PUBLIC-WITHDRAWN; deprecated by #159).
const _getCalibratedHeadlineStatsUncached =
  async (): Promise<CalibratedHeadlineStats> => {
    const { getHeadlineFlat, PERF_FLAT_STAKE_EUR } = await import("./bot-performance");
    const cohort = await getPublicCohortBotNames();
    const h = await getHeadlineFlat({
      bots: [...cohort],
      markets: CALIBRATED_PUBLIC_MARKETS,
      since: `${CALIBRATED_SINCE}T00:00:00Z`,
    });
    const pct = (v: number | null) => (v == null ? null : Number((100 * v).toFixed(2)));
    return {
      allTime: {
        n: h.n,
        stakeEur: h.n * PERF_FLAT_STAKE_EUR,
        pnlEur: Number((h.pnlUnits * PERF_FLAT_STAKE_EUR).toFixed(2)),
        roiPct: pct(h.roi),
        medianClvPct: null,
        meanClvPct: null,
        medianClvPinPct: null,
        // The public basis already excludes books no reader can take (Unibet-Kambi is a
        // non-offer in is_publishable_book), so "obtainable" IS the headline now.
        obtainableN: h.n,
        obtainableRoiPct: pct(h.roi),
        unpriceableExcluded: h.nRecordedPrice,
        roiCoveragePct: h.n > 0 ? Number(((100 * (h.n - h.nRecordedPrice)) / h.n).toFixed(1)) : 100,
        clvN: 0,
        clvBeatPct: null,
        sinceDate: CALIBRATED_SINCE,
      },
      last30d: { n: h.n30, roiPct: pct(h.roi30) },
    };
  };

export const getCalibratedHeadlineStats = unstable_cache(
  _getCalibratedHeadlineStatsUncached,
  // v2 [[#159]]: one public basis (bot_ledger.pnl_unit_public).
  ["getCalibratedHeadlineStats_v2"],
  { revalidate: 600 },
);

// ─── System status (live activity indicators) ──────────────────────────────



// ─── ENG-6: Bot consensus ───────────────────────────────────────────────────



// ─── PERF-CACHE: Pre-computed dashboard stats ───────────────────────────────

export interface RetiredBotBreakdownRow {
  name: string;
  settled: number;
  won: number;
  total_pnl: number;
  roi_pct: number | null;
  avg_clv: number | null;
  retired_at: string | null;
  retired_reason: string | null;
}

export interface DashboardCache {
  computed_at: string;
  total_bets: number;
  settled_bets: number;
  pending_bets: number;
  won_bets: number;
  lost_bets: number;
  hit_rate: number | null;
  total_staked: number;
  total_pnl: number;
  roi_pct: number | null;
  avg_clv: number | null;
  bot_breakdown: Array<{
    name: string;
    settled: number;
    won: number;
    total_pnl: number;
    roi_pct: number | null;
    avg_clv: number | null;
  }>;
  market_breakdown: Array<{
    market: string;
    bets: number;
    won: number;
    avg_clv: number | null;
  }>;
  model_accuracy_pct: number | null;
  prediction_sample_size: number;
  pseudo_clv_count: number;
  live_snapshot_matches: number;
  alignment_settled_count: number;
  // PERF-HONEST-HEADLINE (2026-05-17): active-only headline + retired
  // strategies breakdown. Nullable on legacy rows (pre-migration 104).
  active_total_bets: number | null;
  active_settled_bets: number | null;
  active_won_bets: number | null;
  active_lost_bets: number | null;
  active_total_staked: number | null;
  active_total_pnl: number | null;
  active_roi_pct: number | null;
  active_avg_clv: number | null;
  retired_bot_breakdown: RetiredBotBreakdownRow[] | null;
  // PERF-HERO-COHORT-SPLIT (2026-06-01): last-30d ROI split by cohort so the
  // hero can render separate Pre-match / In-play tiles. Nullable on legacy
  // rows (pre-migration 157) and on empty cohorts.
  prematch_settled_bets: number | null;
  prematch_won_bets: number | null;
  prematch_total_staked: number | null;
  prematch_total_pnl: number | null;
  prematch_roi_pct: number | null;
  prematch_avg_clv: number | null;
  inplay_settled_bets: number | null;
  inplay_won_bets: number | null;
  inplay_total_staked: number | null;
  inplay_total_pnl: number | null;
  inplay_roi_pct: number | null;
  // PERF-HERO-EQUITY-SPARKLINE (2026-06-01): daily cumulative P&L for last
  // 30d on active+non-experimental bots, ascending by date. Nullable on
  // legacy cache rows (pre-migration 158).
  daily_pnl_curve_30d: Array<{ d: string; cum: number }> | null;
  // UI-METRIC-SOT (2026-06-06): same series, 90-day window — read by the
  // PerformanceExtras cumulative P&L chart. Single source of truth: the 30d
  // curve above is the tail of this one. Nullable on legacy cache rows
  // (pre-migration 188).
  daily_pnl_curve_90d: Array<{ d: string; cum: number }> | null;
  // PERF-HERO-RECENT-WINS (2026-06-01): top 8 deduped wins from last 14d by
  // CLV beat. Concrete "model picked these and was right" stories for the
  // public page. Nullable on legacy cache rows (pre-migration 159).
  recent_top_wins: Array<{
    home: string;
    away: string;
    league: string | null;
    country: string | null;
    market: string;
    selection: string;
    odds: number;
    clv: number;
    pick_time: string | null;
  }> | null;
  // PERF-HERO-NEXT-MODEL (2026-06-01): summary of the latest unpromoted
  // candidate model vs production from model_versions.cv_metrics. Drives the
  // "Next upgrade" callout on /performance. Null when no candidate is
  // available or candidate has zero markets improving.
  upcoming_model_summary: {
    candidate: string;
    production: string;
    trained_at: string | null;
    markets_better: number;
    markets_worse: number;
    markets_tied: number;
    group_deltas: Record<string, number>; // e.g. { "1x2": -10.0, "ah": -2.6 }
    holdout_n: number | null;
  } | null;
  // PRO-TIER-V2 (2026-06-02): rolling-30d hero stats for /value-bets. Pro card
  // shows the calibrated cohort; Elite card shows all active bots. Either can
  // be null on a fresh cohort with no settled bets.
  pro_value_bets_30d: {
    n: number;
    won: number;
    win_rate_pct: number | null;
    roi_pct: number | null;
    clv_pct: number | null;
  } | null;
  elite_value_bets_30d: {
    n: number;
    won: number;
    win_rate_pct: number | null;
    roi_pct: number | null;
    clv_pct: number | null;
  } | null;
  // GROWTH-COPY-DENSITY-AUDIT Day 1 (2026-06-06) — cumulative since
  // chain_start ('2026-05-03'). Drives the landing hero load-bearing
  // outcome line. Migration 187, settlement.py _value_bets_cumulative().
  // Null on fresh installs / pre-migration rows.
  elite_value_bets_cumulative: {
    n_settled: number;
    won: number;
    win_rate_pct: number | null;
    staked: number;
    pnl: number;
    avg_clv_pct: number | null;
    cumulative_clv_eur: number | null;
    chain_start: string;       // "2026-05-03"
    first_pick: string | null; // ISO
    last_pick: string | null;  // ISO
    days: number | null;
  } | null;
}

export async function getDashboardCache(): Promise<DashboardCache | null> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("dashboard_cache")
    .select("*")
    .order("computed_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as DashboardCache;
}

// ─── Published picks (GROWTH-ACCURACY-PICKS-LOG, 2026-06-05) ───────────────
// Powers the future /accuracy marketing surface. Pure outcome-accuracy log;
// NOT the same as simulated_bets (which is bankroll/EV-aware). Even
// 1.01-odds heavy-favourite picks count as hits if the outcome occurred.






// ─── GROWTH-SEO-PAST-FIXTURE-RECAPS (2026-06-05) — Phase 3 ───────────────────
// Per-fixture pages render post-match recap content for finished fixtures.
// We need every published pick for the match (1x2, OU 1.5, OU 2.5, BTTS) so
// the recap can show "model called X right" / "model missed Y" badges.



export interface SimpleSettledBet {
  id: string;
  match: string;
  date: string;
  market: string;
  selection: string;
  result: string;
}

export async function getRecentSettledBets(limit = 10): Promise<SimpleSettledBet[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("simulated_bets")
    .select(`id, market, selection, result, pick_time, match:match_id(date, home_team:home_team_id(name), away_team:away_team_id(name))`)
    .neq("result", "pending")
    .neq("result", "void")
    .order("pick_time", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => {
    const m = Array.isArray(row.match) ? row.match[0] : row.match as Record<string, unknown> | null;
    const home = m?.home_team ? (Array.isArray(m.home_team) ? m.home_team[0] : m.home_team) as { name: string } : null;
    const away = m?.away_team ? (Array.isArray(m.away_team) ? m.away_team[0] : m.away_team) as { name: string } : null;
    return {
      id: row.id as string,
      match: home && away ? `${home.name} vs ${away.name}` : "Unknown",
      date: (m?.date ?? row.pick_time) as string,
      market: row.market as string,
      selection: row.selection as string,
      result: row.result as string,
    };
  });
}


// ─── ENG-14: League prediction pages ─────────────────────────────────────────





// ─── GROWTH-SEO-EXPAND-LEAGUES (2026-06-05): dynamic league list ────────────
// Drives sitemap, generateStaticParams, /predictions/[league] resolution and
// the per-fixture page for ANY league with enough ensemble prediction coverage,
// not just the curated 8.





// ─── Per-fixture prediction pages (GROWTH-SEO-CONTENT-ENGINE Phase 1) ───────
// One indexable URL per upcoming fixture in a covered league. URL shape:
//   /predictions/[league-slug]/[fixture-slug]
// where fixture-slug looks like "manchester-city-vs-arsenal-2026-12-08".
//
// Forebet/PredictZ pattern: programmatic content-rich pages targeting
// long-tail "[home] vs [away] prediction" Google searches. Each page must
// be content-rich enough to avoid the thin-content penalty — we use the
// AI-generated match_previews + model probability + signals + crests.








// ─── ENG-12: Model vs Market vs Users ────────────────────────────────────────



// ─── ENG-11: What Changed Today ───────────────────────────────────────────────



// ─── ELITE-BANKROLL: Personal bankroll analytics ───────────────────────────





// ─── Ops Dashboard ──────────────────────────────────────────────────────────



/** Returns the single latest run per job_name — used for the per-job status dashboard.
 *  Excludes micro-batch backfill jobs (run every 5min — they flood the window and are shown in the Backfill section). */
export async function getLatestJobStatuses(): Promise<PipelineRun[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("pipeline_runs")
    .select("id, job_name, run_date, status, started_at, completed_at, fixtures_count, records_count, error_message")
    .not("job_name", "in", '("hist_backfill","backfill_coaches","backfill_transfers")')
    .order("started_at", { ascending: false })
    .limit(300);
  const seen = new Set<string>();
  const latest: PipelineRun[] = [];
  for (const run of data ?? []) {
    if (!seen.has(run.job_name)) {
      seen.add(run.job_name);
      latest.push(run as PipelineRun);
    }
  }
  return latest;
}



/** Pending bets where the match has already kicked off >2.5h ago (truly overdue).
 *  fix_stale_live_matches uses a 130-min cutoff (90 min match + 40 min buffer),
 *  so we only alarm at 150 min to avoid racing the cleanup sweep itself. */
export async function getStalePendingBets(): Promise<{ id: string; market: string; pick_time: string; bot_id: string; match_kickoff: string | null }[]> {
  const admin = createSupabaseAdmin();
  const kickoffCutoff = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("simulated_bets")
    .select("id, market, pick_time, bot_id, match:match_id(date)")
    .eq("result", "pending")
    .order("pick_time", { ascending: true })
    .limit(100);
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter((b) => {
      const kickoff = b.match?.date;
      return kickoff && new Date(kickoff) < new Date(kickoffCutoff);
    })
    .slice(0, 20)
    .map((b) => ({
      id: b.id,
      market: b.market,
      pick_time: b.pick_time,
      bot_id: b.bot_id,
      match_kickoff: b.match?.date ?? null,
    }));
}





// ─── Public performance extras ─────────────────────────────────────────────
// Feeds /performance's cumulative chart, calibration table, streak badges,
// and the per-bot recent-ROI map used by the free-tier value-bets teaser.
// One query, four derivations — keeps the page fast for anon visitors.

export interface PublicPnlPoint { date: string; cumPnl: number; }
export interface CalibrationBucket {
  label: string;        // e.g. "40–50%"
  predictedMid: number; // bucket midpoint, 0-1
  actualHit: number | null;
  n: number;
}
export interface Streaks {
  currentWin: number;
  currentLoss: number;
  longestWin: number;
  longestLoss: number;
}
export interface PublicPerformanceExtras {
  cumulative: PublicPnlPoint[];
  calibration: CalibrationBucket[];
  streaks: Streaks;
  botRecentRoi: Record<string, { roi: number; settled: number }>;
}

// LIGHTHOUSE-FIX-3: wrapped with unstable_cache (300s) — see export below.
// 5-min cache is fine since this powers the cumulative-PnL chart that
// updates once daily as bets settle.
const _getPublicPerformanceExtrasUncached = async (): Promise<PublicPerformanceExtras> => {
  const admin = createSupabaseAdmin();
  // 90-day window covers the launch-to-now visual story. Bets are needed for
  // calibration / streaks / per-bot recent ROI; the cumulative-P&L series is
  // read from dashboard_cache.daily_pnl_curve_90d so the hero sparkline and
  // this chart land on identical endpoints. UI-METRIC-SOT (2026-06-06).
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  // ALL-BETS-CEILING-DEAD-2026-09-21: .range(0, 49999) against a 10,000-row cap.
  type ExtrasRow = {
    pick_time: string; result: string | null;
    pnl: number | string | null; stake: number | string | null;
    model_probability: number | null; calibrated_prob: number | null;
    bot: { name: string; retired_at: string | null } | { name: string; retired_at: string | null }[] | null;
  };
  const [{ data }, cache] = await Promise.all([
    (async () => ({ data: (await fetchAllPaged<ExtrasRow>(
      "publicPerformanceExtras", PAGED_ROW_CEILING,
      (from, to) => admin
      .from("simulated_bets")
      .select(
        "pick_time, result, pnl, stake, model_probability, calibrated_prob, bot:bot_id(name, retired_at)",
      )
      .in("result", ["won", "lost"])
      .gte("pick_time", since)
      .order("pick_time", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: ExtrasRow[] | null; error: unknown }>,
    )).rows }))(),
    getDashboardCache(),
  ]);

  type Row = {
    pick_time: string;
    result: "won" | "lost";
    pnl: number | string | null;
    stake: number | string;
    model_probability: number | string;
    calibrated_prob: number | string | null;
    bot:
      | { name: string; retired_at: string | null }
      | { name: string; retired_at: string | null }[]
      | null;
  };
  const EXPERIMENTAL_BOT_NAMES = new Set([
    "bot_acca_value", "bot_acca_proven", "bot_acca_coolbet",
    "bot_combo_system", "bot_combo_proven_system", "bot_acca_leg_shadow",
  ]);

  // CALIBRATION-COHORT-FIX (2026-07-06): previously the calibration table
  // included retired bots — post-audit query showed this leaked ~10-15%
  // more overconfidence-heavy legacy bets into the buckets vs. the
  // headline ROI cohort. `getModelV2Stats` already filters retired; align
  // this query with the same rule. The public calibration display should
  // reflect currently-live strategies, not the graveyard.
  const rows = ((data ?? []) as Row[]).filter((r) => {
    const bot = Array.isArray(r.bot) ? r.bot[0] : r.bot;
    if (!bot) return true;
    if (EXPERIMENTAL_BOT_NAMES.has(bot.name)) return false;
    if (bot.retired_at) return false;
    return true;
  });

  // Cumulative series: read straight from cache. Same cohort as the hero
  // sparkline (active + non-experimental + non-retired bots, won/lost only).
  // Fallback: if the cache row is pre-migration-188 it has no 90d curve, so
  // bucket from the bets we just loaded as a one-time transition path.
  let cumulative: PublicPnlPoint[];
  if (cache?.daily_pnl_curve_90d?.length) {
    cumulative = cache.daily_pnl_curve_90d.map((p) => ({
      date: p.d.slice(5),
      cumPnl: Number(p.cum.toFixed(2)),
    }));
  } else {
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const day = r.pick_time.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(r.pnl ?? 0));
    }
    const days = Array.from(byDay.keys()).sort();
    let cum = 0;
    cumulative = days.map((d) => {
      cum += byDay.get(d) ?? 0;
      return { date: d.slice(5), cumPnl: Number(cum.toFixed(2)) };
    });
  }

  // Calibration — bucket by calibrated_prob (fallback to model_probability).
  const buckets: Array<[string, number, number]> = [
    ["<30%", 0, 0.30],
    ["30–40%", 0.30, 0.40],
    ["40–50%", 0.40, 0.50],
    ["50–60%", 0.50, 0.60],
    ["60–70%", 0.60, 0.70],
    ["70%+", 0.70, 1.01],
  ];
  const calibration: CalibrationBucket[] = buckets.map(([label, lo, hi]) => {
    const inBucket = rows.filter((r) => {
      const p = Number(r.calibrated_prob ?? r.model_probability);
      return p >= lo && p < hi;
    });
    const won = inBucket.filter((r) => r.result === "won").length;
    return {
      label,
      predictedMid: (lo + hi) / 2,
      actualHit: inBucket.length > 0 ? won / inBucket.length : null,
      n: inBucket.length,
    };
  });

  // Streaks — walk chronologically, count current + longest W/L runs.
  let currentWin = 0,
    currentLoss = 0,
    longestWin = 0,
    longestLoss = 0;
  let runKind: "won" | "lost" | null = null;
  let runLen = 0;
  for (const r of rows) {
    if (r.result === runKind) {
      runLen += 1;
    } else {
      runKind = r.result;
      runLen = 1;
    }
    if (runKind === "won") longestWin = Math.max(longestWin, runLen);
    else longestLoss = Math.max(longestLoss, runLen);
  }
  // "Current" = the most recent run length.
  if (runKind === "won") currentWin = runLen;
  else if (runKind === "lost") currentLoss = runLen;
  const streaks: Streaks = { currentWin, currentLoss, longestWin, longestLoss };

  // Bot recent ROI — last 30 days, per bot.
  const cutoff30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const recentByBot = new Map<string, { staked: number; pnl: number; settled: number }>();
  for (const r of rows) {
    if (r.pick_time < cutoff30) continue;
    const bot = Array.isArray(r.bot) ? r.bot[0] : r.bot;
    const name = bot?.name;
    if (!name) continue;
    let agg = recentByBot.get(name);
    if (!agg) {
      agg = { staked: 0, pnl: 0, settled: 0 };
      recentByBot.set(name, agg);
    }
    agg.staked += Number(r.stake);
    agg.pnl += Number(r.pnl ?? 0);
    agg.settled += 1;
  }
  const botRecentRoi: Record<string, { roi: number; settled: number }> = {};
  for (const [name, agg] of recentByBot) {
    botRecentRoi[name] = {
      roi: agg.staked > 0 ? (agg.pnl / agg.staked) * 100 : 0,
      settled: agg.settled,
    };
  }

  return { cumulative, calibration, streaks, botRecentRoi };
};
export const getPublicPerformanceExtras = unstable_cache(
  _getPublicPerformanceExtrasUncached,
  ["getPublicPerformanceExtras_v1"],
  CACHE_300S,
);

// ── Model v2 era stats ────────────────────────────────────────────────────────

export interface ModelV2Stats {
  settled: number;
  roi: number | null;
  avgClv: number | null;
  prematchSettled: number;
  prematchRoi: number | null;
  inplaySettled: number;
  inplayRoi: number | null;
}

const EXPERIMENTAL_BOTS_V2 = new Set([
  "bot_acca_value", "bot_acca_proven", "bot_acca_coolbet",
  "bot_combo_system", "bot_combo_proven_system", "bot_acca_leg_shadow",
]);

/**
 * Live stats for bets that literally used model v20260524_market (Model v2),
 * excluding retired and experimental bots. model_version tag is the correct
 * filter here — date would include early May 24 pipeline runs that still
 * carried v14 before the model file was swapped.
 */
const _getModelV2StatsUncached = async (): Promise<ModelV2Stats> => {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("simulated_bets")
    .select("result, pnl, stake, clv, bot:bot_id(name, retired_at, maturity_label)")
    .eq("model_version", "v20260524_market")
    .in("result", ["won", "lost"]);

  type Row = {
    result: string;
    pnl: number | string | null;
    stake: number | string;
    clv: number | null;
    bot: { name: string; retired_at: string | null; maturity_label: string | null } | null
       | { name: string; retired_at: string | null; maturity_label: string | null }[];
  };

  const rows = ((data ?? []) as Row[]).filter((r) => {
    const bot = Array.isArray(r.bot) ? r.bot[0] : r.bot;
    if (!bot) return true;
    if (EXPERIMENTAL_BOTS_V2.has(bot.name)) return false;
    if (bot.retired_at) return false;
    return true;
  });

  const getBotName = (r: Row) => {
    const bot = Array.isArray(r.bot) ? r.bot[0] : r.bot;
    return bot?.name ?? "";
  };

  const prematch = rows.filter((r) => !getBotName(r).startsWith("inplay_"));
  const inplay   = rows.filter((r) => getBotName(r).startsWith("inplay_"));

  const calcRoi = (subset: Row[]) => {
    const staked = subset.reduce((s, r) => s + Number(r.stake), 0);
    const pnl    = subset.reduce((s, r) => s + Number(r.pnl ?? 0), 0);
    return staked > 0 ? (pnl / staked) * 100 : null;
  };

  const staked = rows.reduce((s, r) => s + Number(r.stake), 0);
  const pnl    = rows.reduce((s, r) => s + Number(r.pnl ?? 0), 0);
  // CLV only meaningful for pre-match bets; inplay bots don't track it.
  const clvValues = prematch.map((r) => r.clv).filter((c): c is number => c != null && Number.isFinite(c));

  return {
    settled:         rows.length,
    roi:             staked > 0 ? (pnl / staked) * 100 : null,
    avgClv:          clvValues.length > 0 ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : null,
    prematchSettled: prematch.length,
    prematchRoi:     calcRoi(prematch),
    inplaySettled:   inplay.length,
    inplayRoi:       calcRoi(inplay),
  };
};

// PERF-VPS-2026-07-07: unstable_cache (1800s = 30min) — full simulated_bets
// scan filtered by model_version. Expensive; results change slowly.
export const getModelV2Stats = unstable_cache(
  _getModelV2StatsUncached,
  ["getModelV2Stats_v1"],
  { revalidate: 1800 }
);

// ─── WC roster strength (Wave 3 B3) ─────────────────────────────────────────
//
// `team_roster_strength` is engine-side (RLS on, no public read policy) — we
// read it via the service-role admin client. Returns the highest-value squad
// asset per team. `playerName` / `playerClub` are reserved for a future TM
// squad-name fetch and are nullable today.




// ─── Match Recap (SEO pages) ──────────────────────────────────────────────────








// ─── PICKS forward test (published picks) ────────────────────────────────────
// PICKS-ON-PERFORMANCE-2026-09-14. The published picks had no home on
// /performance: bot_sharp_forward_test_v1 writes NO simulated_bets (it reads
// through to picks_forward_test), and the leaderboard is built on
// simulated_bets, so the one thing readers actually receive was the one thing
// the page could not show. Meanwhile an OWN paper instrument WAS showing, via a
// 'experiment' vs 'experimental' typo. The page was wrong in both directions.
export type PicksForwardTestSummary = {
  ruleVersion: string;
  startedAt: string;
  published: number;
  settled: number;
  pending: number;
  won: number;
  pnlUnits: number;
  roi: number | null;
  roiSd: number | null;
  clvMarginCorrected: number | null;
  clvMcSd: number | null;
  nClvMc: number;
};

function mapForwardTestRow(r: Record<string, unknown>): PicksForwardTestSummary {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    ruleVersion: String(r.rule_version ?? ""),
    startedAt: String(r.started_at ?? ""),
    published: Number(r.published ?? 0),
    settled: Number(r.settled ?? 0),
    pending: Number(r.pending ?? 0),
    won: Number(r.won ?? 0),
    pnlUnits: Number(r.pnl_units ?? 0),
    roi: num(r.roi),
    roiSd: num(r.roi_sd),
    clvMarginCorrected: num(r.clv_margin_corrected),
    clvMcSd: num(r.clv_mc_sd),
    nClvMc: Number(r.n_clv_mc ?? 0),
  };
}

/**
 * Every pre-registered rule version that has published picks, newest first.
 *
 * FORWARD-TEST-VERSIONS-DO-NOT-VANISH (2026-09-15). This used to be
 * `.limit(1)` — the newest `started_at` and nothing else — and that made every
 * rule-version bump silently erase the public record. Two consequences, both
 * live at the time:
 *
 *   * the panel presented **v1, a closed rule, as the current method**, because
 *     v1 was the newest version that had published anything while the engine
 *     had already moved to v3;
 *   * on v4's first pick, v1's result (n=8, ROI -37.1%, margin-corrected CLV
 *     -11.1%) would have disappeared from every public surface.
 *
 * A scoreboard that resets itself whenever the number goes bad is worse than no
 * scoreboard, and this one would have done it on a schedule: v1 -> v2 -> v3 in
 * two days. A closed pre-registered test keeps its own number; it just is not
 * the running one.
 *
 * `current` is the newest version WITH PUBLISHED PICKS, which is not
 * necessarily the rule the engine is executing — the view only knows what has
 * rows. Callers must therefore label by `ruleVersion`, never as "the live rule".
 *
 * NEVER SUM `current` AND `closed` (FORWARD-TEST-SUMMARY-POOLS-RULE-VERSIONS):
 * a rule change starts a new test with its own n, and pooling would fire an
 * n=200 checkpoint early on a mixture of rules.
 *
 * Null when the view is unreachable — callers show nothing rather than a zero,
 * because "0.0%" and "we don't know" are different facts.
 */
// ARM-SCOPED (2026-09-22, [[#068]]). `picks_forward_test_summary` used to be
// the live arm by definition; migration 371 made it carry every PUBLISHED arm so
// /performance can show a record for each one a reader actually receives.
//
// The parameter defaults to "live" so every existing caller is unchanged, and it
// is applied as a FILTER rather than a grouping on purpose: `pooled` below sums
// the rows it is given, so an unfiltered call would silently pool two different
// RULES into one track record. That is precisely what building a second arm was
// meant to prevent — the live arm's record is of one locked, pre-registered rule.
export async function getPicksForwardTestSummary(
  arm: string = "live",
  // [[#095]] the consensus arm is TWO bots, one per grade — pass the grade to
  // get one bot's record. Omitted = the whole arm (the live arm has no grade).
  grade?: "B" | "C" | "D",
  // [[#122]] the sharp (live) arm is TWO bots, one per market — pass the market to
  // get one half's record. It reads `picks_forward_test_summary_by_market`
  // (migration 402); without it the per-arm view the stopping rules use is read,
  // unchanged.
  market?: "1x2" | "over_under_25",
): Promise<{
  current: PicksForwardTestSummary;
  closed: PicksForwardTestSummary[];
  pooled: PicksForwardTestSummary;
} | null> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from(market ? "picks_forward_test_summary_by_market" : "picks_forward_test_summary")
    .select("*")
    .eq("arm", arm)
    .match({ ...(grade ? { grade } : {}), ...(market ? { market } : {}) })
    .order("started_at", { ascending: false });
  if (error || !data || data.length === 0) return null;
  const rows = (data as Record<string, unknown>[]).map(mapForwardTestRow);

  // PICKS-ROW-RECONCILES-2026-09-17. `current` is the CURRENT rule version and
  // stays the basis for the pre-registered stopping rules — pooling versions
  // there would fire an n=200 checkpoint early on a mixture of rules, which is
  // the discipline failure the pre-registration exists to prevent.
  //
  // But the LEADERBOARD ROW is a different object from the TEST. A reader who
  // expands that row counts every live pick ever published (the bets list reads
  // `picks_forward_test_public`, all versions), and the summary was showing only
  // the current version's n. On 2026-09-17 that read 14 settled against 22 in
  // the list — a reader who counts gets a different answer from the page, which
  // is indefensible whatever the statistics say.
  //
  // So: `pooled` is every live pick published to date, and it is what the public
  // row uses. `current` and `closed` are untouched for the test's own machinery.
  // Two objects, two numbers, both honest, neither pretending to be the other.
  const pooled: PicksForwardTestSummary = {
    ruleVersion: rows.length === 1 ? rows[0].ruleVersion : `${rows.length} rule versions`,
    startedAt: rows[rows.length - 1].startedAt,
    published: rows.reduce((a, r) => a + r.published, 0),
    settled: rows.reduce((a, r) => a + r.settled, 0),
    pending: rows.reduce((a, r) => a + r.pending, 0),
    won: rows.reduce((a, r) => a + r.won, 0),
    pnlUnits: rows.reduce((a, r) => a + r.pnlUnits, 0),
    // ROI is recomputed from pooled units and pooled n, never averaged across
    // versions — averaging ratios is the error that reported +10.94% where the
    // stake-weighted truth was +6.51% (ANALYSIS_GOTCHAS 9a(h)).
    roi: (() => {
      const n = rows.reduce((a, r) => a + r.settled, 0);
      return n > 0 ? rows.reduce((a, r) => a + r.pnlUnits, 0) / n : null;
    })(),
    roiSd: null,
    // Margin-corrected CLV is n-weighted across versions; null when nothing has one.
    clvMarginCorrected: (() => {
      const w = rows.filter((r) => r.clvMarginCorrected != null && r.nClvMc > 0);
      const n = w.reduce((a, r) => a + r.nClvMc, 0);
      return n > 0 ? w.reduce((a, r) => a + (r.clvMarginCorrected as number) * r.nClvMc, 0) / n : null;
    })(),
    clvMcSd: null,
    nClvMc: rows.reduce((a, r) => a + r.nClvMc, 0),
  };

  return { current: rows[0], closed: rows.slice(1), pooled };
}

// ─── SHARP-ANCHOR CLV for the forward-test bots ([[#156]], 2026-09-25) ──────────
// The forward-test rows used to show `clv_margin_corrected` — the pick's odds against
// the SAME soft book's own close. These rules pick a leg BECAUSE that book misprices
// it, and a mispriced line that is never corrected closes where it opened, so that
// figure sits near minus the book's margin BY CONSTRUCTION: it could not tell the
// live arm from the random junk-anchor control (−0.4pp [−1.9, +1.2]) while the
// sharp-anchor close separated them by +4.6pp (1X2) / +3.7pp (O/U). The stopping
// rule was amended the same day (engine: dev/active/picks-forward-test-preregistration.md).
//
// Sharp-anchor CLV = `clv_sharp` (fresh Shin-de-vigged Pinnacle close) where present,
// else `clv_cons` (>=5-book consensus close); thin 3–4-book consensus is excluded.
// `leg_clv_sharp` is PRIVATE (anon least-privilege, migration 404), so this reads a
// private aggregate view server-side (430: `picks_forward_test_anchor_clv`; since #158:
// `picks_forward_test_bot_record`, same CLV definition). No anon grant exists or is needed.
//
// [[#158]] (2026-09-25, owner-approved) the row's record also counts EARLIER-rule picks that
// pass the CURRENT rule on pick-time data (engine: scripts/recheck_forward_test_picks.py →
// table pick_rule_recheck). The verdict is data, not page logic: this reads the private
// view `picks_forward_test_bot_record` (migration 431, service_role only), which carries each
// pick's record_rule_version / record_state. is_current rows = native + rechecked_pass;
// the rest is the "earlier" line — rechecked_fail = "didn't meet today's rule".
// The pre-registered test's own counts (picks_forward_test_summary) are NOT affected.
export type ForwardTestBotRecord = {
  ruleVersion: string;
  published: number;
  pending: number;
  settled: number;
  won: number;
  pnlUnits: number;
  roi: number | null;
  nAnchor: number;
  nPinnacle: number;
  nConsensus: number;
  clvAnchor: number | null;
  nClvMc: number;
  clvMarginCorrected: number | null;
  /** Earlier-rule picks counted here because they passed the current rule (published count). */
  nRechecked: number;
};

export type ForwardTestBotRecordEarlier = {
  ruleVersion: string;
  /** true = re-checked against the current rule and failed ("didn't meet today's rule"). */
  failedRecheck: boolean;
  settled: number;
  nAnchor: number;
  clvAnchor: number | null;
};

/** One forward-test bot's record. Null when the view is unreachable or the bot has no picks. */
export async function getForwardTestBotRecord(
  arm: string,
  grade?: "B" | "C" | "D",
  market?: "1x2" | "over_under_25",
): Promise<{ current: ForwardTestBotRecord | null; earlier: ForwardTestBotRecordEarlier[] } | null> {
  const db = createSupabaseAdmin();
  const { data, error } = await db
    .from("picks_forward_test_bot_record")
    .select("*")
    .eq("arm", arm)
    .match({ ...(grade ? { grade } : {}), ...(market ? { market } : {}) });
  if (error || !data || data.length === 0) return null;
  const rows = data as Record<string, unknown>[];
  const n = (v: unknown) => Number(v ?? 0);
  // n-weighted means, never an average of ratios (ANALYSIS_GOTCHAS 9a(h)).
  const fold = (rs: Record<string, unknown>[]) => {
    let a = 0, mc = 0;
    const o = {
      published: 0, pending: 0, settled: 0, won: 0, pnlUnits: 0,
      nAnchor: 0, nPinnacle: 0, nConsensus: 0, nClvMc: 0, nRechecked: 0,
    };
    for (const r of rs) {
      o.published += n(r.published); o.pending += n(r.pending); o.settled += n(r.settled);
      o.won += n(r.won); o.pnlUnits += n(r.pnl_units);
      o.nAnchor += n(r.n_anchor); o.nPinnacle += n(r.n_pinnacle); o.nConsensus += n(r.n_consensus);
      o.nClvMc += n(r.n_clv_mc);
      if (r.record_state === "rechecked_pass") o.nRechecked += n(r.published);
      if (r.clv_anchor != null) a += Number(r.clv_anchor) * n(r.n_anchor);
      if (r.clv_margin_corrected != null) mc += Number(r.clv_margin_corrected) * n(r.n_clv_mc);
    }
    return {
      ...o,
      roi: o.settled > 0 ? o.pnlUnits / o.settled : null,
      clvAnchor: o.nAnchor > 0 ? a / o.nAnchor : null,
      clvMarginCorrected: o.nClvMc > 0 ? mc / o.nClvMc : null,
    };
  };
  const cur = rows.filter((r) => r.is_current === true);
  const current = cur.length
    ? { ruleVersion: String(cur[0].record_rule_version ?? ""), ...fold(cur) }
    : null;
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of rows.filter((x) => x.is_current !== true)) {
    const k = `${r.record_rule_version}|${r.record_state === "rechecked_fail"}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const earlier = [...groups.entries()].map(([k, rs]) => {
    const f = fold(rs);
    return {
      ruleVersion: k.split("|")[0],
      failedRecheck: k.endsWith("|true"),
      settled: f.settled, nAnchor: f.nAnchor, clvAnchor: f.clvAnchor,
    };
  });
  return { current, earlier };
}

// PICKS-BOT-ACTS-LIKE-THE-OTHERS-2026-09-14. The leaderboard row for
// bot_sharp_forward_test_v1 needs the same things every other row has: a
// bankroll chart and an expandable bet list. Both are driven by the shared
// `SanitizedBotBet[]`, which comes from `simulated_bets` — a table this bot
// deliberately does not write to (migration 342: writing there would pull the
// published picks into every bot-cohort query and re-contaminate the ledger).
//
// So its bets are read from its OWN table and shaped to the same contract.
//
// UNITS: the published rule stakes a flat 1 unit; every other bot on that page
// runs a EUR 1000 bankroll at EUR 10 flat. Rendering 1.03 units next to
// EUR 1,339 would make the newest strategy look like a rounding error, so the
// unit ledger is scaled by STAKE_EUR. This changes no stored value and no
// stopping rule — those are evaluated on CLV in units, untouched.
export const PICKS_FORWARD_TEST_STAKE_EUR = 10;
export const PICKS_FORWARD_TEST_START_BANKROLL = 1000;

// [[#159]] getPicksForwardTestBets (the forward-test rows' bet list from picks_forward_test_public)
// is gone: every /performance detail view reads the SAME record legs its row is computed from —
// bot_ledger_display (in_record = the #158 record) via /api/performance/bot-legs.

// ── FEEDS-DASHBOARD (#107, 2026-09-23) ─────────────────────────────────────────
// feed_status / feed_book_stats are written every 5 min by the engine's
// workers/jobs/feed_health.py from workers/registry/feed_registry.py. Health is
// judged on DATA WRITTEN, not on the job's own verdict — the first read of this
// data found Coolbet silent for 4 h while every run said "completed" (#108).
export interface FeedStatus {
  feed_id: string;
  label: string;
  book: string | null;
  category: "book" | "af" | "infra";
  kind: string | null;
  schedule: string | null;
  interval_min: number | null;
  stale_after_min: number | null;
  health_basis: "data" | "runs" | "service";
  status: "ok" | "warn" | "fail" | "unknown" | "paused";
  status_reason: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_seconds: number | null;
  last_success_at: string | null;
  last_error: string | null;
  runs_24h: number | null;
  failures_24h: number | null;
  fail_streak: number | null;
  last_data_at: string | null;
  rows_1h: number | null;
  rows_24h: number | null;
  service_state: Record<string, string> | null;
  runbook: string | null;
  // phase B (migration 389): controls + operator state
  controls: string[] | null;
  paused: boolean;
  paused_reason: string | null;
  paused_by: string | null;
  paused_at: string | null;
  run_now_pending: boolean;
  updated_at: string;
}

export interface FeedBookStats {
  book: string;
  fixtures_today: number | null;
  priced_today: number | null;
  fixtures_yesterday: number | null;
  priced_yesterday: number | null;
  rows_today: number | null;
  market_families: number | null;
  last_row_at: string | null;
  // Exchange only (migration 403): fixtures whose latest 1X2 is liquid, not merely listed
  liquid_today?: number | null;
  liquid_yesterday?: number | null;
  // #107 C (migration 408): of the fixtures that kicked off in the last 24 h and this book
  // priced pre-match, how many carry a price in the final 15 minutes (its close)
  closing_priced_24h?: number | null;
  closing_captured_24h?: number | null;
  // BOOK-FOOTPRINT (#110): requests we sent this clock hour vs the book's budget
  requests_1h: number | null;
  budget_1h: number | null;
  challenges_1h: number | null;
  errors_1h: number | null;
  requests_24h: number | null;
  updated_at: string;
}

/** Everything /admin/feeds needs, plus the render clock. The clock is read HERE,
 *  in the data layer, not in the component (react-hooks/purity) — same
 *  convention as forward-test-picks.ts. */
// #120/#121 — data-quality checks (board_guard at write time, board_audit read-back,
// results_check). Rows the checks refused or moved are in odds_snapshots_quarantined.
export interface DataQualityFinding {
  id: number;
  check_name: string;
  match_id: string | null;
  bookmaker: string | null;
  detail: Record<string, unknown> | null;
  rows_moved: number;
  found_at: string;
}


