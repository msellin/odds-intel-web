import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "./supabase-server";
import { createSupabasePublic } from "./supabase-public";

// Service role client — bypasses RLS. Server-side only, never sent to browser.
function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );
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

export interface LiveMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  league: string;
  leagueCode: string;
  sport: string;
  tier: number;
  odds: {
    operator: string;
    home: number;
    draw: number;
    away: number;
    over25: number;
    under25: number;
    over15: number;
    under15: number;
    over35: number;
    under35: number;
    bttsYes: number;
    bttsNo: number;
  }[];
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  scrapedAt: string;
}

export interface LiveBet {
  id: string;
  bot: string;
  match: string;
  league: string;
  tier: number;
  market: string;
  selection: string;
  odds: number;
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
}

// ─── Supabase row types ─────────────────────────────────────────────────────

interface MatchRow {
  id: string;
  date: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
  form_home?: string | null;
  form_away?: string | null;
  venue_name?: string | null;
  referee?: string | null;
  af_prediction?: Record<string, unknown> | null;
  home_team: { id: string; name: string; country: string; logo_url?: string | null }[] | { id: string; name: string; country: string; logo_url?: string | null } | null;
  away_team: { id: string; name: string; country: string; logo_url?: string | null }[] | { id: string; name: string; country: string; logo_url?: string | null } | null;
  league: { id: string; name: string; country: string; tier: number; priority?: number | null }[] | { id: string; name: string; country: string; tier: number; priority?: number | null } | null;
}

interface OddsRow {
  id: string;
  match_id: string;
  bookmaker: string;
  market: string;
  selection: string;
  odds: number;
  timestamp: string;
  is_closing: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimBetRow = Record<string, any>;

// ─── Public match type (no auth required) ──────────────────────────────────

export interface PublicMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  league: string;
  country: string;
  tier: number;
  status: string;
  hasOdds: boolean;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  // ML-1: Team logos (null until fixture pipeline backfills logo_url)
  logoHome: string | null;
  logoAway: string | null;
  // ML-3: Last-5 form strings e.g. "WWDLW" — null until enrichment runs
  formHome: string | null;
  formAway: string | null;
  // ML-6: Predicted score from af_prediction JSONB (null if no AF prediction)
  predictedHome: number | null;
  predictedAway: number | null;
  // ML-7: Odds movement vs ~24h ago (null if no prev snapshot)
  moveHome: "up" | "down" | null;
  moveDraw: "up" | "down" | null;
  moveAway: "up" | "down" | null;
  // ML-8: Bookmaker count
  bookmakerCount: number;
  // Signal intelligence (SUX-1/2/3) — populated by getPublicMatches(), omitted on detail
  signalCount: number;
  dataGrade: "A" | "B" | "C" | null;
  pulse: "routine" | "interesting" | "high-alert";
  teasers: string[];
  // League priority for sorting (lower = more important, null = alphabetical)
  leaguePriority: number | null;
  // populated only on match detail (getPublicMatchById)
  score_home?: number | null;
  score_away?: number | null;
  venue_name?: string | null;
  referee?: string | null;
  hasLineups?: boolean;
  // ensemble model probabilities (0-100) — null if no prediction
  modelHome?: number | null;
  modelDraw?: number | null;
  modelAway?: number | null;
}

export interface H2HMatch {
  date: string;
  homeTeam: string;
  awayTeam: string;
  scoreHome: number | null;
  scoreAway: number | null;
}

export interface MatchH2H {
  homeWins: number;
  draws: number;
  awayWins: number;
  recent: H2HMatch[];
}

export interface TeamStanding {
  teamName: string;
  teamApiId: number;
  rank: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  form: string;
}

export interface MatchInjury {
  playerName: string;
  teamSide: "home" | "away";
  status: string;
  reason: string | null;
  injuryCount: number | null;  // career injury episodes from player_sidelined
}

export interface MatchEvent {
  minute: number;
  addedTime: number;
  eventType: string;
  team: "home" | "away";
  playerName: string | null;
  assistName: string | null;
  detail: string | null;
}

export interface LineupPlayer {
  name: string;
  number: number | null;
  position: string | null;
  grid: string | null;
}

export interface LineupData {
  formationHome: string | null;
  formationAway: string | null;
  coachHome: string | null;
  coachAway: string | null;
  startXIHome: LineupPlayer[];
  startXIAway: LineupPlayer[];
}

export interface PlayerStat {
  playerName: string | null;
  teamSide: "home" | "away";
  position: string | null;
  shirtNumber: number | null;
  minutesPlayed: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  passesKey: number | null;
  yellowCards: number | null;
  redCards: number | null;
}

export interface TeamSeasonStat {
  form: string | null;
  playedTotal: number | null;
  winsTotal: number | null;
  drawsTotal: number | null;
  lossesTotal: number | null;
  goalsForAvg: number | null;
  goalsAgainstAvg: number | null;
  cleanSheetPct: number | null;
  mostUsedFormation: string | null;
  playedHome: number | null;
  goalsForHome: number | null;
  goalsAgainstHome: number | null;
  playedAway: number | null;
  goalsForAway: number | null;
  goalsAgainstAway: number | null;
}

export interface MatchStatsData {
  shots_home: number | null;
  shots_away: number | null;
  shots_on_target_home: number | null;
  shots_on_target_away: number | null;
  possession_home: number | null;
  corners_home: number | null;
  corners_away: number | null;
  xg_home: number | null;
  xg_away: number | null;
  fouls_home: number | null;
  fouls_away: number | null;
  offsides_home: number | null;
  offsides_away: number | null;
  saves_home: number | null;
  saves_away: number | null;
  blocked_shots_home: number | null;
  blocked_shots_away: number | null;
  pass_accuracy_home: number | null;
  pass_accuracy_away: number | null;
  yellow_cards_home: number | null;
  yellow_cards_away: number | null;
  red_cards_home: number | null;
  red_cards_away: number | null;
  // Half-time breakdown (API-Football v3.9.3, data from 2024 season)
  shots_home_ht: number | null;
  shots_away_ht: number | null;
  shots_on_target_home_ht: number | null;
  shots_on_target_away_ht: number | null;
  possession_home_ht: number | null;
  corners_home_ht: number | null;
  corners_away_ht: number | null;
  xg_home_ht: number | null;
  xg_away_ht: number | null;
  fouls_home_ht: number | null;
  fouls_away_ht: number | null;
  yellow_cards_home_ht: number | null;
  yellow_cards_away_ht: number | null;
}

export interface OddsMovementPoint {
  timestamp: string;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  bestOver25: number;
  bestUnder25: number;
}

export interface LiveSnapshot {
  match_id: string;
  score_home: number;
  score_away: number;
  minute: number;
  captured_at: string;
}

// ─── Data fetching functions ────────────────────────────────────────────────

// ─── Signal intelligence batch fetch (SUX-1/2/3) ───────────────────────────

const PULSE_SIGNAL_NAMES = [
  "bookmaker_disagreement",
  "importance_diff",
  "overnight_line_move",
  "odds_volatility",
  "form_slope_home",
  "form_slope_away",
  "injury_count_home",
  "injury_count_away",
  "news_impact_score",
];

interface MatchSignalSummary {
  signalCount: number;
  dataGrade: "A" | "B" | "C" | null;
  pulse: "routine" | "interesting" | "high-alert";
  teasers: string[];
}

async function batchFetchSignalSummary(
  matchIds: string[],
  todayStart: Date
): Promise<Record<string, MatchSignalSummary>> {
  if (!matchIds.length) return {};
  const supabase = createSupabasePublic();

  const [signalCountsResult, keySignalsResult, predsResult] = await Promise.all([
    // Signal counts via RPC — replaces 60k-row fetch with a single aggregated DB call
    supabase.rpc("get_signal_counts", {
      p_match_ids: matchIds,
      p_since: todayStart.toISOString(),
    }),
    // Latest values of key signals (for pulse + teasers)
    supabase
      .from("match_signals")
      .select("match_id, signal_name, signal_value, captured_at")
      .in("match_id", matchIds)
      .in("signal_name", PULSE_SIGNAL_NAMES)
      .gte("captured_at", todayStart.toISOString())
      .order("captured_at", { ascending: false })
      .limit(20000),
    // Prediction sources (for data grade A/B/D)
    supabase
      .from("predictions")
      .select("match_id, source")
      .in("match_id", matchIds)
      .eq("market", "1x2_home"),
  ]);

  // Signal counts from RPC (one row per match)
  const signalCountMap: Record<string, number> = {};
  for (const r of (signalCountsResult.data || []) as { match_id: string; signal_count: number }[]) {
    signalCountMap[r.match_id] = Number(r.signal_count);
  }

  // Latest value per key signal per match (results already ordered desc by captured_at)
  const keySignals: Record<string, Record<string, number>> = {};
  const seenKeySignals: Record<string, Set<string>> = {};
  for (const s of (keySignalsResult.data || []) as {
    match_id: string; signal_name: string; signal_value: number;
  }[]) {
    if (!keySignals[s.match_id]) {
      keySignals[s.match_id] = {};
      seenKeySignals[s.match_id] = new Set();
    }
    if (!seenKeySignals[s.match_id].has(s.signal_name)) {
      keySignals[s.match_id][s.signal_name] = Number(s.signal_value);
      seenKeySignals[s.match_id].add(s.signal_name);
    }
  }

  // Prediction sources per match
  const predSources: Record<string, Set<string>> = {};
  for (const p of (predsResult.data || []) as { match_id: string; source: string }[]) {
    if (!predSources[p.match_id]) predSources[p.match_id] = new Set();
    predSources[p.match_id].add(p.source);
  }

  const result: Record<string, MatchSignalSummary> = {};

  for (const matchId of matchIds) {
    const sigs = keySignals[matchId] || {};
    const signalCount = signalCountMap[matchId] ?? 0;

    // Grade: A = XGBoost ran, B = Poisson only, C = AF prediction only
    const sources = predSources[matchId] ?? new Set<string>();
    let dataGrade: "A" | "B" | "C" | null = null;
    if (sources.has("xgboost")) dataGrade = "A";
    else if (sources.has("poisson")) dataGrade = "B";
    else if (sources.has("af")) dataGrade = "C";

    // Pulse: derived from market + context signals available in match_signals
    const bdm = sigs["bookmaker_disagreement"] ?? 0;
    const olm = Math.abs(sigs["overnight_line_move"] ?? 0);
    const vol = sigs["odds_volatility"] ?? 0;
    const impDiff = Math.abs(sigs["importance_diff"] ?? 0);

    let pulse: "routine" | "interesting" | "high-alert" = "routine";
    if (bdm > 0.12 && (olm > 0.04 || vol > 0.008)) {
      pulse = "high-alert";
    } else if (bdm > 0.08 || olm > 0.03 || vol > 0.005 || impDiff > 0.3) {
      pulse = "interesting";
    }

    // Teasers: plain-English hooks, max 2, no numbers
    const teasers: string[] = [];

    if (bdm > 0.12) teasers.push("High bookmaker disagreement");
    else if (olm > 0.04) teasers.push("Odds shifted significantly overnight");
    else if (vol > 0.007) teasers.push("Volatile odds market");

    const news = sigs["news_impact_score"] ?? 0;
    const injTotal = (sigs["injury_count_home"] ?? 0) + (sigs["injury_count_away"] ?? 0);
    if (news < -0.3) teasers.push("Key injury news detected");
    else if (injTotal >= 3) teasers.push(`${Math.round(injTotal)} absences reported`);

    const slopeHome = sigs["form_slope_home"] ?? 0;
    const slopeAway = sigs["form_slope_away"] ?? 0;
    if (slopeHome < -0.15 && slopeAway >= -0.15) teasers.push("Home team in declining form");
    else if (slopeAway < -0.15 && slopeHome >= -0.15) teasers.push("Away team in declining form");

    if (impDiff > 0.4) teasers.push("One team with nothing to play for");

    result[matchId] = {
      signalCount,
      dataGrade,
      pulse,
      teasers: teasers.slice(0, 2),
    };
  }

  return result;
}

/**
 * Fetch today's matches using the anon key — no user session required.
 * Tables read (matches, teams, leagues, odds_snapshots) do not have RLS enabled,
 * so anon reads work. If RLS is ever enabled on these tables, add:
 *   CREATE POLICY "Public read" ON matches FOR SELECT USING (true);
 *   CREATE POLICY "Public read" ON teams FOR SELECT USING (true);
 *   CREATE POLICY "Public read" ON leagues FOR SELECT USING (true);
 *   CREATE POLICY "Public read" ON odds_snapshots FOR SELECT USING (true);
 */
// Cheap status counts — used for tab badges without fetching full match data
export async function getMatchCounts(dayOffset = 0): Promise<{ live: number; upcoming: number; finished: number; total: number }> {
  const supabase = createSupabasePublic();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  todayStart.setUTCDate(todayStart.getUTCDate() + dayOffset);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  todayEnd.setUTCHours(3, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  const [{ data: todayRows }, { data: yesterdayRows }] = await Promise.all([
    supabase.from("matches").select("status, league:league_id!inner(is_active)").eq("league.is_active", true)
      .gte("date", todayStart.toISOString()).lte("date", todayEnd.toISOString()).limit(500),
    dayOffset === 0
      ? supabase.from("matches").select("status, league:league_id!inner(is_active)").eq("league.is_active", true)
          .gte("date", yesterdayStart.toISOString()).lt("date", todayStart.toISOString())
          .neq("status", "finished").limit(50)
      : Promise.resolve({ data: [] as { status: string }[] | null }),
  ]);

  const all = [...(yesterdayRows ?? []), ...(todayRows ?? [])];
  const live = all.filter((r) => r.status === "live").length;
  const finished = all.filter((r) => r.status === "finished").length;
  const upcoming = all.length - live - finished;
  return { live, upcoming, finished, total: all.length };
}

async function _fetchMatches(dayOffset: number, statusFilter: "all" | "active" | "finished"): Promise<PublicMatch[]> {
  const supabase = createSupabasePublic();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  todayStart.setUTCDate(todayStart.getUTCDate() + dayOffset);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  todayEnd.setUTCHours(3, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  // Step 1a: Fetch today's matches (all statuses).
  // Step 1b: Fetch yesterday's matches that are NOT finished (still live or delayed).
  // Two queries because PostgREST doesn't support OR across date + status in one filter.
  // Filter: is_active = true on the league (programmatic — no manual show_on_frontend toggle needed).
  // Leagues with neither odds nor predictions coverage are excluded naturally (no rows reach us).
  const selectFields = `id, date, status, score_home, score_away, form_home, form_away, af_prediction,
       home_team:home_team_id(id, name, country, logo_url),
       away_team:away_team_id(id, name, country, logo_url),
       league:league_id!inner(id, name, country, tier, priority)`;

  let todayQuery = supabase
    .from("matches")
    .select(selectFields)
    .eq("league.is_active", true)
    .gte("date", todayStart.toISOString())
    .lte("date", todayEnd.toISOString())
    .order("date", { ascending: true })
    .limit(500);
  if (statusFilter === "active") todayQuery = todayQuery.neq("status", "finished") as typeof todayQuery;
  if (statusFilter === "finished") todayQuery = todayQuery.eq("status", "finished") as typeof todayQuery;

  // Yesterday overhang: only for active/all fetches — finished matches from yesterday aren't needed.
  const includeYesterday = dayOffset === 0 && statusFilter !== "finished";

  const [{ data: todayMatches, error }, { data: yesterdayOngoing }] = await Promise.all([
    todayQuery,
    includeYesterday
      ? supabase
          .from("matches")
          .select(selectFields)
          .eq("league.is_active", true)
          .gte("date", yesterdayStart.toISOString())
          .lt("date", todayStart.toISOString())
          .neq("status", "finished")
          .order("date", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] as MatchRow[] | null, error: null }),
  ]);

  const matches = [
    ...(yesterdayOngoing ?? []),
    ...(todayMatches ?? []),
  ];

  if (error || matches.length === 0) return [];

  type PublicMatchRow = Pick<MatchRow, "id" | "date" | "status" | "score_home" | "score_away" | "form_home" | "form_away" | "af_prediction" | "home_team" | "away_team" | "league">;
  const matchIds = (matches as PublicMatchRow[]).map((m) => m.id);

  // Step 2: Fetch best 1X2 odds via RPC (aggregated server-side).
  // Using odds_snapshots directly hits Supabase's 1000-row PostgREST cap —
  // the table accumulates ~38 rows/match/run × 6 runs/day = 228 rows/match.
  // 80 matches × 228 rows = 18,240 rows per batch, far above the cap.
  // The RPC returns MAX(odds) GROUP BY (match_id, selection) = 3 rows/match.
  // Also returns bookmaker_count (ML-8) and prev_best_odds for movement arrows (ML-7).
  const oddsByMatch: Record<string, {
    home: number; draw: number; away: number;
    bookmakerCount: number;
    prevHome: number | null; prevDraw: number | null; prevAway: number | null;
  }> = {};
  const batchSize = 80;
  const oddsBatches: string[][] = [];
  for (let i = 0; i < matchIds.length; i += batchSize) {
    oddsBatches.push(matchIds.slice(i, i + batchSize));
  }
  // Fire all batches in parallel — previously sequential, each waiting on the last
  const allOddsRows = (
    await Promise.all(
      oddsBatches.map((batch) =>
        supabase.rpc("get_best_match_odds", {
          p_match_ids: batch,
          p_since: yesterdayStart.toISOString(),
        })
      )
    )
  ).flatMap(({ data }) => (data || []) as {
    match_id: string; selection: string; best_odds: number;
    bookmaker_count: number; prev_best_odds: number | null;
  }[]);

  for (const o of allOddsRows) {
    if (!oddsByMatch[o.match_id]) {
      oddsByMatch[o.match_id] = { home: 0, draw: 0, away: 0, bookmakerCount: 0, prevHome: null, prevDraw: null, prevAway: null };
    }
    const num = Number(o.best_odds);
    const prev = o.prev_best_odds != null ? Number(o.prev_best_odds) : null;
    const bk = o.bookmaker_count ?? 0;
    if (o.selection === "home") { oddsByMatch[o.match_id].home = num; oddsByMatch[o.match_id].prevHome = prev; }
    if (o.selection === "draw") { oddsByMatch[o.match_id].draw = num; oddsByMatch[o.match_id].prevDraw = prev; }
    if (o.selection === "away") { oddsByMatch[o.match_id].away = num; oddsByMatch[o.match_id].prevAway = prev; }
    if (bk > oddsByMatch[o.match_id].bookmakerCount) oddsByMatch[o.match_id].bookmakerCount = bk;
  }

  const matchIdsWithOdds = new Set(Object.keys(oddsByMatch));

  // Fetch signal intelligence for all matches (SUX-1/2/3)
  const signalSummary = await batchFetchSignalSummary(matchIds, yesterdayStart);

  const MOVE_THRESHOLD = 0.05; // min odds delta to show ↑↓

  const allResults = (matches as PublicMatchRow[]).map((m) => {
    const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team;
    const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team;
    const league = Array.isArray(m.league) ? m.league[0] : m.league;
    const odds = oddsByMatch[m.id];
    const sig = signalSummary[m.id];

    // ML-6: Parse predicted score from AF prediction JSONB
    const afGoals = (m.af_prediction as Record<string, Record<string, string>> | null)?.goals;
    const predictedHome = afGoals?.home != null ? Math.round(Number(afGoals.home)) : null;
    const predictedAway = afGoals?.away != null ? Math.round(Number(afGoals.away)) : null;

    // ML-7: Odds movement direction (requires prev snapshot >20h ago)
    const moveDir = (curr: number, prev: number | null): "up" | "down" | null => {
      if (!curr || prev == null || !prev) return null;
      if (curr - prev >= MOVE_THRESHOLD) return "up";
      if (prev - curr >= MOVE_THRESHOLD) return "down";
      return null;
    };

    return {
      id: m.id,
      homeTeam: homeTeam?.name || "TBD",
      awayTeam: awayTeam?.name || "TBD",
      kickoff: m.date,
      league: league ? `${league.country} / ${league.name}` : "Unknown",
      country: league?.country || "Unknown",
      tier: league?.tier || 1,
      status: m.status,
      hasOdds: matchIdsWithOdds.has(m.id),
      bestHome: odds?.home ?? 0,
      bestDraw: odds?.draw ?? 0,
      bestAway: odds?.away ?? 0,
      // ML-1: Team logos
      logoHome: homeTeam?.logo_url ?? null,
      logoAway: awayTeam?.logo_url ?? null,
      // ML-3: Form strips
      formHome: m.form_home ?? null,
      formAway: m.form_away ?? null,
      // ML-6: Predicted score
      predictedHome: predictedHome !== null && !isNaN(predictedHome) ? predictedHome : null,
      predictedAway: predictedAway !== null && !isNaN(predictedAway) ? predictedAway : null,
      // ML-7: Movement arrows
      moveHome: moveDir(odds?.home ?? 0, odds?.prevHome ?? null),
      moveDraw: moveDir(odds?.draw ?? 0, odds?.prevDraw ?? null),
      moveAway: moveDir(odds?.away ?? 0, odds?.prevAway ?? null),
      // ML-8: Bookmaker count
      bookmakerCount: odds?.bookmakerCount ?? 0,
      // Signals
      signalCount: sig?.signalCount ?? 0,
      dataGrade: sig?.dataGrade ?? null,
      pulse: sig?.pulse ?? "routine",
      teasers: sig?.teasers ?? [],
      leaguePriority: league?.priority ?? null,
      // Scores (for finished match display in list view)
      score_home: m.score_home ?? null,
      score_away: m.score_away ?? null,
    };
  });

  // Deduplicate matches from different sources (e.g. API-Football vs Kambi)
  // that create separate team/match records for the same real-world fixture.
  // Two keys cover two failure modes:
  //   nameKey — different spellings of the same team ("Bayern Munich" vs "Bayern München")
  //   timeKey — abbreviations that don't normalize the same ("PSG" vs "Paris Saint Germain"):
  //             same league + same kickoff minute + same home-team prefix = same fixture.
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const seenByName = new Map<string, number>();
  const seenByTime = new Map<string, number>();
  const deduped: PublicMatch[] = [];

  for (const match of allResults) {
    const nameKey = `${normalize(match.homeTeam)}|${normalize(match.awayTeam)}|${match.kickoff.slice(0, 10)}`;
    // Kickoff slice(0,16) = "YYYY-MM-DDTHH:MM" — minute-level precision is enough.
    // Home prefix (4 chars) disambiguates two different matches in the same league at the same time.
    const timeKey = `${match.league}|${match.kickoff.slice(0, 16)}|${normalize(match.homeTeam).slice(0, 4)}`;
    const existingIdx = seenByName.get(nameKey) ?? seenByTime.get(timeKey);

    if (existingIdx == null) {
      const idx = deduped.length;
      seenByName.set(nameKey, idx);
      seenByTime.set(timeKey, idx);
      deduped.push(match);
    } else {
      // Keep whichever has better data: live/finished > scheduled, hasOdds > no odds
      const prev = deduped[existingIdx];
      const statusRank = (s: string) => s === "live" ? 2 : s === "finished" ? 1 : 0;
      const score = (m: PublicMatch) => statusRank(m.status) * 10 + (m.hasOdds ? 5 : 0) + m.signalCount;
      if (score(match) > score(prev)) {
        deduped[existingIdx] = match;
        // Register the winning record's keys so future duplicates are also caught
        seenByName.set(nameKey, existingIdx);
        seenByTime.set(timeKey, existingIdx);
      }
    }
  }

  return deduped;
}

export const getPublicMatches = (dayOffset = 0) => _fetchMatches(dayOffset, "all");
export const getActiveMatches = (dayOffset = 0) => _fetchMatches(dayOffset, "active");
export const getFinishedMatches = (dayOffset = 0) => _fetchMatches(dayOffset, "finished");

export async function getPublicMatchById(matchId: string): Promise<PublicMatch | null> {
  const supabase = createSupabasePublic();

  const { data: match, error } = await supabase
    .from("matches")
    .select(
      `id, date, status, score_home, score_away, venue_name, referee, lineups_home, af_prediction,
       home_team:home_team_id(id, name, country, logo_url),
       away_team:away_team_id(id, name, country, logo_url),
       league:league_id(id, name, country, tier, priority)`
    )
    .eq("id", matchId)
    .single();

  if (error || !match) return null;

  type PublicMatchRow = Pick<MatchRow, "id" | "date" | "status" | "score_home" | "score_away" | "venue_name" | "referee" | "home_team" | "away_team" | "league" | "af_prediction"> & { lineups_home?: unknown };
  const m = match as PublicMatchRow;

  const { data: oddsRows } = await supabase
    .from("odds_snapshots")
    .select("match_id, selection, odds")
    .eq("match_id", matchId)
    .in("market", ["1x2", "1X2"]);

  const odds = { home: [] as number[], draw: [] as number[], away: [] as number[] };
  for (const o of (oddsRows || []) as { match_id: string; selection: string; odds: number }[]) {
    const num = Number(o.odds);
    if (o.selection === "home") odds.home.push(num);
    if (o.selection === "draw") odds.draw.push(num);
    if (o.selection === "away") odds.away.push(num);
  }

  const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team;
  const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team;
  const league = Array.isArray(m.league) ? m.league[0] : m.league;

  // Parse predicted score from AF prediction JSONB
  const afGoals = (m.af_prediction as Record<string, Record<string, string>> | null)?.goals;
  const predictedHome = afGoals?.home != null ? Math.round(Number(afGoals.home)) : null;
  const predictedAway = afGoals?.away != null ? Math.round(Number(afGoals.away)) : null;

  // Determine data grade + extract ensemble model probabilities
  const { data: predRows } = await supabase
    .from("predictions")
    .select("source, market, model_probability")
    .eq("match_id", matchId);
  type PredRow = { source: string; market: string; model_probability: number };
  const predSources = new Set((predRows ?? []).map((r: PredRow) => r.source));
  let dataGrade: "A" | "B" | "C" | null = null;
  if (predSources.has("xgboost")) dataGrade = "A";
  else if (predSources.has("poisson")) dataGrade = "B";
  else if (predSources.has("af")) dataGrade = "C";

  // Extract ensemble 1x2 model probabilities (0-100) for MarketImpliedProbabilities comparison
  let modelHome: number | null = null;
  let modelDraw: number | null = null;
  let modelAway: number | null = null;
  for (const p of (predRows ?? []) as PredRow[]) {
    if (p.source !== "ensemble") continue;
    const pct = Math.round(Number(p.model_probability) * 1000) / 10;
    if (p.market === "1x2_home") modelHome = pct;
    else if (p.market === "1x2_draw") modelDraw = pct;
    else if (p.market === "1x2_away") modelAway = pct;
  }

  const bookmakerCount = new Set(
    (oddsRows || []).map((o: { match_id: string; selection: string; odds: number }) => `${o.match_id}`)
  ).size > 0 ? odds.home.length + odds.draw.length + odds.away.length : 0;

  return {
    id: m.id,
    homeTeam: homeTeam?.name || "TBD",
    awayTeam: awayTeam?.name || "TBD",
    kickoff: m.date,
    league: league ? `${league.country} / ${league.name}` : "Unknown",
    country: league?.country || "Unknown",
    tier: league?.tier || 1,
    status: m.status,
    hasOdds: odds.home.length > 0,
    bestHome: odds.home.length ? Math.max(0, ...odds.home) : 0,
    bestDraw: odds.draw.length ? Math.max(0, ...odds.draw) : 0,
    bestAway: odds.away.length ? Math.max(0, ...odds.away) : 0,
    logoHome: homeTeam?.logo_url ?? null,
    logoAway: awayTeam?.logo_url ?? null,
    formHome: null,
    formAway: null,
    predictedHome: predictedHome !== null && !isNaN(predictedHome) ? predictedHome : null,
    predictedAway: predictedAway !== null && !isNaN(predictedAway) ? predictedAway : null,
    moveHome: null,
    moveDraw: null,
    moveAway: null,
    bookmakerCount: 0,
    signalCount: 0,
    dataGrade,
    pulse: "routine" as const,
    teasers: [],
    leaguePriority: league?.priority ?? null,
    score_home: m.score_home,
    score_away: m.score_away,
    venue_name: m.venue_name,
    referee: m.referee,
    hasLineups: m.lineups_home != null,
    modelHome,
    modelDraw,
    modelAway,
  };
}

export async function getPublicMatchBookmakerCount(matchId: string): Promise<number> {
  const supabase = createSupabasePublic();
  const { data } = await supabase.rpc("get_bookmaker_count_for_match", {
    p_match_id: matchId,
  });
  return Number(data ?? 0);
}

async function getTodayOdds(): Promise<LiveMatch[]> {
  const supabase = await createSupabaseServer();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Fetch today's matches with team + league joins
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `id, date, status, score_home, score_away,
       home_team:home_team_id(id, name, country),
       away_team:away_team_id(id, name, country),
       league:league_id(id, name, country, tier)`
    )
    .gte("date", todayStart.toISOString())
    .lte("date", todayEnd.toISOString())
    .order("date", { ascending: true });

  if (error || !matches) return [];

  // Fetch latest odds per (match, bookmaker, market, selection) — replaces
  // SELECT * which returned all historical snapshots (~18k rows for 160 matches).
  const matchIds = matches.map((m: MatchRow) => m.id);
  const { data: oddsRows } = matchIds.length
    ? await supabase.rpc("get_latest_match_odds", { p_match_ids: matchIds })
    : { data: [] };

  // Group odds by match
  const oddsByMatch: Record<string, OddsRow[]> = {};
  for (const o of (oddsRows || []) as OddsRow[]) {
    if (!oddsByMatch[o.match_id]) oddsByMatch[o.match_id] = [];
    oddsByMatch[o.match_id].push(o);
  }

  return (matches as MatchRow[]).map((m) => {
    const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team;
    const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team;
    const league = Array.isArray(m.league) ? m.league[0] : m.league;

    // Transform odds rows into per-operator format
    const matchOdds = oddsByMatch[m.id] || [];
    const operatorMap: Record<
      string,
      {
        home: number; draw: number; away: number;
        over25: number; under25: number;
        over15: number; under15: number;
        over35: number; under35: number;
        bttsYes: number; bttsNo: number;
      }
    > = {};

    for (const o of matchOdds) {
      if (!operatorMap[o.bookmaker]) {
        operatorMap[o.bookmaker] = {
          home: 0, draw: 0, away: 0,
          over25: 0, under25: 0,
          over15: 0, under15: 0,
          over35: 0, under35: 0,
          bttsYes: 0, bttsNo: 0,
        };
      }
      const mkt = o.market.toLowerCase();
      if (mkt === "1x2") {
        if (o.selection === "home") operatorMap[o.bookmaker].home = Number(o.odds);
        if (o.selection === "draw") operatorMap[o.bookmaker].draw = Number(o.odds);
        if (o.selection === "away") operatorMap[o.bookmaker].away = Number(o.odds);
      }
      if (mkt === "over_under_25" || mkt === "ou25") {
        if (o.selection === "over") operatorMap[o.bookmaker].over25 = Number(o.odds);
        if (o.selection === "under") operatorMap[o.bookmaker].under25 = Number(o.odds);
      }
      if (mkt === "over_under_15") {
        if (o.selection === "over") operatorMap[o.bookmaker].over15 = Number(o.odds);
        if (o.selection === "under") operatorMap[o.bookmaker].under15 = Number(o.odds);
      }
      if (mkt === "over_under_35") {
        if (o.selection === "over") operatorMap[o.bookmaker].over35 = Number(o.odds);
        if (o.selection === "under") operatorMap[o.bookmaker].under35 = Number(o.odds);
      }
      if (mkt === "btts") {
        if (o.selection === "yes") operatorMap[o.bookmaker].bttsYes = Number(o.odds);
        if (o.selection === "no") operatorMap[o.bookmaker].bttsNo = Number(o.odds);
      }
    }

    const operators = Object.entries(operatorMap).map(([name, odds]) => ({
      operator: name,
      ...odds,
    }));

    const validHome = operators.filter((o) => o.home > 0);
    const validDraw = operators.filter((o) => o.draw > 0);
    const validAway = operators.filter((o) => o.away > 0);

    const leagueName = league
      ? `${league.country} / ${league.name}`
      : "Unknown";

    return {
      id: m.id,
      homeTeam: homeTeam?.name || "TBD",
      awayTeam: awayTeam?.name || "TBD",
      kickoff: m.date,
      league: leagueName,
      leagueCode: league?.id || "",
      sport: "Football",
      tier: league?.tier || 1,
      odds: operators,
      bestHome: validHome.length ? Math.max(...validHome.map((o) => o.home)) : 0,
      bestDraw: validDraw.length ? Math.max(...validDraw.map((o) => o.draw)) : 0,
      bestAway: validAway.length ? Math.max(...validAway.map((o) => o.away)) : 0,
      scrapedAt: matchOdds[0]?.timestamp || "",
    };
  });
}

export async function getMatchById(matchId: string): Promise<LiveMatch | null> {
  const matches = await getTodayOdds();
  return matches.find((m) => m.id === matchId) || null;
}

export async function getTodayBets(): Promise<LiveBet[]> {
  // Use service role so RLS on simulated_bets doesn't block the server.
  // Tier-based sanitization happens in page.tsx before data reaches the client.
  const supabase = createSupabaseAdmin();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // INPLAY-HIDE-VALUEBETS: prematch-only on /value-bets while inplay bots are
  // being tuned. xg_source IS NULL ⇒ prematch bot. Inplay bets still appear on
  // /performance (historical record) where the `live` badge differentiates them.
  const { data, error } = await supabase
    .from("simulated_bets")
    .select(
      `id, match_id, market, selection, odds_at_pick, pick_time, stake,
       model_probability, edge_percent, closing_odds, clv, result, pnl,
       bankroll_after, news_triggered, reasoning,
       bot:bot_id(id, name, strategy),
       match:match_id(id, date,
         home_team:home_team_id(name),
         away_team:away_team_id(name),
         league:league_id(name, country, tier)
       )`
    )
    .gte("pick_time", todayStart.toISOString())
    .is("xg_source", null)
    .order("pick_time", { ascending: false });

  if (error || !data) return [];

  return (data as SimBetRow[]).map(toBet);
}

// The single free pick shown on the matches page — intentionally public data
// (we use this as a marketing teaser). Fetched server-side via service role
// so no client-side Supabase query is needed in DailyValueTeaser.
export interface FreePick {
  id: string;
  match: string;
  league: string;
  market: string;
  selection: string;
  odds: number;
  edge: number;
  result: string;
}

export async function getFreeDailyPick(): Promise<{ pick: FreePick | null; totalCount: number }> {
  const supabase = createSupabaseAdmin();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartStr = todayStart.toISOString();

  // INPLAY-HIDE-VALUEBETS: keep the free teaser prematch-only too — same
  // reasoning as getTodayBets. Without this filter the teaser could surface a
  // mid-match inplay bet on a finished game (highest-edge sort wins).
  const [pickRes, allBetsRes] = await Promise.all([
    supabase
      .from("simulated_bets")
      .select(
        `id, market, selection, odds_at_pick, edge_percent, result,
         match:match_id(
           home_team:home_team_id(name),
           away_team:away_team_id(name),
           league:league_id(name, country)
         )`
      )
      .gte("pick_time", todayStartStr)
      .is("xg_source", null)
      .order("edge_percent", { ascending: false })
      .limit(1),
    // Fetch match_id+market+selection to deduplicate — same logic as value bets page
    supabase
      .from("simulated_bets")
      .select("match_id, market, selection")
      .gte("pick_time", todayStartStr)
      .is("xg_source", null),
  ]);

  // Deduplicate by match+market+selection to match value bets page count
  const allBets = (allBetsRes.data ?? []) as Array<{ match_id: string; market: string; selection: string }>;
  const uniqueKeys = new Set(allBets.map((b) => `${b.match_id}|${b.market}|${b.selection}`));
  const totalCount = uniqueKeys.size;
  const rows = pickRes.data;
  if (!rows || rows.length === 0) return { pick: null, totalCount };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = rows[0] as any;
  const match = Array.isArray(row.match) ? row.match[0] : row.match;
  const ht = match?.home_team ? (Array.isArray(match.home_team) ? match.home_team[0] : match.home_team) : null;
  const at = match?.away_team ? (Array.isArray(match.away_team) ? match.away_team[0] : match.away_team) : null;
  const lg = match?.league ? (Array.isArray(match.league) ? match.league[0] : match.league) : null;

  return {
    pick: {
      id: row.id,
      match: `${ht?.name ?? "?"} vs ${at?.name ?? "?"}`,
      league: lg ? `${lg.country} / ${lg.name}` : "",
      market: row.market,
      selection: row.selection,
      odds: Number(row.odds_at_pick),
      edge: Number(row.edge_percent),
      result: row.result ?? "pending",
    },
    totalCount,
  };
}

export interface BotRecord {
  id: string;
  name: string;
  strategy: string | null;
  startingBankroll: number;
  currentBankroll: number;
  isActive: boolean;
  retiredAt: string | null;
}

export async function getAllBotsFromDB(): Promise<BotRecord[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("bots")
    .select("id, name, strategy, starting_bankroll, current_bankroll, is_active, retired_at")
    .order("name");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    strategy: r.strategy as string | null,
    startingBankroll: Number(r.starting_bankroll ?? 1000),
    currentBankroll: Number(r.current_bankroll ?? 1000),
    isActive: Boolean(r.is_active),
    retiredAt: (r.retired_at as string | null) ?? null,
  }));
}

export async function getAllBets(): Promise<LiveBet[]> {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("simulated_bets")
    .select(
      `id, match_id, market, selection, odds_at_pick, pick_time, stake,
       model_probability, edge_percent, closing_odds, clv, result, pnl,
       bankroll_after, news_triggered, reasoning,
       bot:bot_id(id, name, strategy),
       match:match_id(id, date,
         home_team:home_team_id(name),
         away_team:away_team_id(name),
         league:league_id(name, country, tier)
       )`
    )
    .order("pick_time", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  return (data as SimBetRow[]).map(toBet);
}

function toBet(row: SimBetRow): LiveBet {
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
    bot: bot?.name || "unknown",
    match: matchName,
    league: leagueName,
    tier: league?.tier || 1,
    market: row.market,
    selection: row.selection,
    odds: Number(row.odds_at_pick),
    modelProb: Number(row.model_probability),
    impliedProb: row.odds_at_pick > 0 ? 1 / Number(row.odds_at_pick) : 0,
    edge: Number(row.edge_percent), // DB stores as decimal (0.10 = 10%)
    stake: Number(row.stake),
    kickoff: match?.date || "",
    placedAt: row.pick_time,
    result: row.result,
    pnl: Number(row.pnl || 0),
    bankrollAfter: row.bankroll_after != null ? Number(row.bankroll_after) : null,
    closingOdds: row.closing_odds != null ? Number(row.closing_odds) : null,
    clv: row.clv != null ? Number(row.clv) : null,
  };
}

// ── Model accuracy (public) ─────────────────────────────────────────────────
// For each finished match that has 1x2 predictions, determine what the model
// called (highest probability among home/draw/away) and whether it was correct.

export interface ModelPredictionRow {
  matchId: string;
  date: string;          // ISO date string
  home: string;
  away: string;
  league: string;
  modelCall: "home" | "draw" | "away";
  confidence: number;    // 0-1, the winning probability
  actual: "home" | "draw" | "away";
  correct: boolean;
  // Real historical bookmaker odds — only rows with odds are included
  bestOddsForPick: number;    // best bookmaker odds for the model's selection
  worstOddsForPick: number;   // worst bookmaker odds for the model's selection
  bookmakerCount: number;     // how many distinct bookmakers had odds
}

export interface ModelAccuracyStats {
  total: number;
  correct: number;
  hitRate: number;       // 0-100
  byOutcome: {
    home:  { total: number; correct: number };
    draw:  { total: number; correct: number };
    away:  { total: number; correct: number };
  };
}

export interface ModelAccuracyData {
  rows: ModelPredictionRow[];
  stats: ModelAccuracyStats;
}

// ─── AI Match Preview (ENG-3) ─────────────────────────────────────────────────

export interface MatchPreview {
  previewShort: string;   // ~50 words — Free tier teaser
  previewText: string;    // ~200 words — Pro/Elite full preview
  generatedAt: string;
}

export async function getMatchPreview(matchId: string): Promise<MatchPreview | null> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("match_previews")
    .select("preview_short, preview_text, generated_at")
    .eq("match_id", matchId)
    .order("match_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    previewShort: data.preview_short,
    previewText: data.preview_text,
    generatedAt: data.generated_at,
  };
}

// Today's upcoming picks — no odds sent (intentionally; that's Pro data)
export interface TodayPick {
  matchId: string;
  kickoff: string;   // ISO timestamp
  home: string;
  away: string;
  league: string;
  modelCall: "home" | "draw" | "away";
  confidence: number;
}

export async function getTodayPicks(): Promise<TodayPick[]> {
  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().split("T")[0];
  const todayEnd = `${today}T23:59:59.999Z`;

  // Fetch today's not-yet-finished matches that have ensemble predictions
  const { data: matches } = await supabase
    .from("matches")
    .select(`
      id, date,
      home_team:home_team_id(name),
      away_team:away_team_id(name),
      league:league_id(name, country)
    `)
    .gte("date", today)
    .lte("date", todayEnd)
    .in("status", ["scheduled", "1h", "2h", "ht", "live"])
    .limit(30);

  if (!matches || matches.length === 0) return [];

  const matchIds = (matches as Array<Record<string, unknown>>).map((m) => m.id as string);

  const { data: preds } = await supabase
    .from("predictions")
    .select("match_id, market, model_probability")
    .in("match_id", matchIds)
    .in("market", ["1x2_home", "1x2_draw", "1x2_away"])
    .eq("source", "ensemble");

  if (!preds) return [];

  const predsByMatch: Record<string, Record<string, number>> = {};
  for (const p of preds as Array<{ match_id: string; market: string; model_probability: number }>) {
    if (!predsByMatch[p.match_id]) predsByMatch[p.match_id] = {};
    predsByMatch[p.match_id][p.market] = Number(p.model_probability);
  }

  const picks: TodayPick[] = [];
  for (const m of matches as Array<Record<string, unknown>>) {
    const pMap = predsByMatch[m.id as string];
    if (!pMap) continue;

    const homeProb = pMap["1x2_home"] ?? 0;
    const drawProb = pMap["1x2_draw"] ?? 0;
    const awayProb = pMap["1x2_away"] ?? 0;
    if (homeProb === 0 && drawProb === 0 && awayProb === 0) continue;

    let modelCall: "home" | "draw" | "away" = "home";
    let confidence = homeProb;
    if (drawProb > confidence) { modelCall = "draw"; confidence = drawProb; }
    if (awayProb > confidence) { modelCall = "away"; confidence = awayProb; }

    const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team as Record<string, unknown>;
    const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team as Record<string, unknown>;
    const league   = Array.isArray(m.league)    ? m.league[0]    : m.league    as Record<string, unknown>;

    picks.push({
      matchId: m.id as string,
      kickoff: m.date as string,
      home: (homeTeam?.name as string) ?? "?",
      away: (awayTeam?.name as string) ?? "?",
      league: league ? `${league.country} / ${league.name}` : "Unknown",
      modelCall,
      confidence,
    });
  }

  return picks.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export async function getModelAccuracy(): Promise<ModelAccuracyData> {
  const supabase = await createSupabaseServer();

  // Fetch finished matches that have a result
  const { data: matches, error: mErr } = await supabase
    .from("matches")
    .select(`
      id, result, date,
      home_team:home_team_id(name),
      away_team:away_team_id(name),
      league:league_id(name, country)
    `)
    .eq("status", "finished")
    .in("result", ["home", "draw", "away"])
    .order("date", { ascending: false })
    .limit(500);

  if (mErr || !matches || matches.length === 0) return emptyAccuracy();

  const matchIds = matches.map((m: Record<string, unknown>) => m.id as string);

  // Fetch 1x2 predictions for those matches (ensemble source only)
  const { data: preds, error: pErr } = await supabase
    .from("predictions")
    .select("match_id, market, model_probability")
    .in("match_id", matchIds)
    .in("market", ["1x2_home", "1x2_draw", "1x2_away"])
    .eq("source", "ensemble");

  if (pErr || !preds) return emptyAccuracy();

  // Group predictions by match
  const predsByMatch: Record<string, Record<string, number>> = {};
  for (const p of preds as Array<{ match_id: string; market: string; model_probability: number }>) {
    if (!predsByMatch[p.match_id]) predsByMatch[p.match_id] = {};
    predsByMatch[p.match_id][p.market] = Number(p.model_probability);
  }

  // Fetch historical odds for all matched match IDs via RPC (no time window)
  const { data: oddsData } = await supabase.rpc("get_historical_match_odds", {
    p_match_ids: matchIds,
  });

  // Index: matchId → selection → { best, worst, bookmakerCount }
  type OddsRow = { match_id: string; selection: string; best_odds: number; worst_odds: number; bookmaker_count: number };
  const oddsIndex: Record<string, Record<string, { best: number; worst: number; count: number }>> = {};
  for (const o of (oddsData ?? []) as OddsRow[]) {
    if (!oddsIndex[o.match_id]) oddsIndex[o.match_id] = {};
    oddsIndex[o.match_id][o.selection] = {
      best: Number(o.best_odds),
      worst: Number(o.worst_odds),
      count: Number(o.bookmaker_count),
    };
  }

  const rows: ModelPredictionRow[] = [];

  for (const m of matches as Array<Record<string, unknown>>) {
    const pMap = predsByMatch[m.id as string];
    if (!pMap) continue; // no prediction for this match

    const homeProb  = pMap["1x2_home"]  ?? 0;
    const drawProb  = pMap["1x2_draw"]  ?? 0;
    const awayProb  = pMap["1x2_away"]  ?? 0;
    if (homeProb === 0 && drawProb === 0 && awayProb === 0) continue;

    // Model's call = highest probability
    let modelCall: "home" | "draw" | "away" = "home";
    let confidence = homeProb;
    if (drawProb > confidence) { modelCall = "draw"; confidence = drawProb; }
    if (awayProb > confidence) { modelCall = "away"; confidence = awayProb; }

    const actual = m.result as "home" | "draw" | "away";
    const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team as Record<string, unknown>;
    const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team as Record<string, unknown>;
    const league   = Array.isArray(m.league)    ? m.league[0]    : m.league    as Record<string, unknown>;

    // Real historical odds for the model's pick
    const matchOdds = oddsIndex[m.id as string];
    const pickOdds = matchOdds?.[modelCall];

    // Only include matches where we have real bookmaker odds — keeps all counts consistent
    if (!pickOdds) continue;

    rows.push({
      matchId:    m.id as string,
      date:       (m.date as string).split("T")[0],
      home:       (homeTeam?.name as string) ?? "?",
      away:       (awayTeam?.name as string) ?? "?",
      league:     league ? `${league.country} / ${league.name}` : "Unknown",
      modelCall,
      confidence,
      actual,
      correct: modelCall === actual,
      bestOddsForPick:  pickOdds.best,
      worstOddsForPick: pickOdds.worst,
      bookmakerCount:   pickOdds.count,
    });
  }

  const total   = rows.length;
  const correct = rows.filter((r) => r.correct).length;
  const hitRate = total > 0 ? (correct / total) * 100 : 0;

  const byOutcome = {
    home:  { total: 0, correct: 0 },
    draw:  { total: 0, correct: 0 },
    away:  { total: 0, correct: 0 },
  };
  for (const r of rows) {
    byOutcome[r.modelCall].total++;
    if (r.correct) byOutcome[r.modelCall].correct++;
  }

  return { rows, stats: { total, correct, hitRate, byOutcome } };
}

function emptyAccuracy(): ModelAccuracyData {
  return {
    rows: [],
    stats: {
      total: 0, correct: 0, hitRate: 0,
      byOutcome: {
        home: { total: 0, correct: 0 },
        draw: { total: 0, correct: 0 },
        away: { total: 0, correct: 0 },
      },
    },
  };
}

export async function getMatchStats(matchId: string): Promise<MatchStatsData | null> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("match_stats")
    .select(
      `shots_home, shots_away, shots_on_target_home, shots_on_target_away,
       possession_home, corners_home, corners_away, xg_home, xg_away,
       fouls_home, fouls_away, offsides_home, offsides_away,
       saves_home, saves_away, blocked_shots_home, blocked_shots_away,
       pass_accuracy_home, pass_accuracy_away,
       yellow_cards_home, yellow_cards_away, red_cards_home, red_cards_away,
       shots_home_ht, shots_away_ht, shots_on_target_home_ht, shots_on_target_away_ht,
       possession_home_ht, corners_home_ht, corners_away_ht,
       xg_home_ht, xg_away_ht, fouls_home_ht, fouls_away_ht,
       yellow_cards_home_ht, yellow_cards_away_ht`
    )
    .eq("match_id", matchId)
    .single();
  if (error || !data) return null;
  return data as MatchStatsData;
}

/**
 * Fetch latest live snapshot per match for a list of match IDs.
 * Uses the public client — works server-side. For client-side polling
 * use createSupabaseBrowser() directly (see components/matches-client.tsx).
 */
export async function getLiveSnapshots(matchIds: string[]): Promise<LiveSnapshot[]> {
  if (!matchIds.length) return [];
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("live_match_snapshots")
    .select("match_id, score_home, score_away, minute, captured_at")
    .in("match_id", matchIds)
    .order("captured_at", { ascending: false });
  if (error || !data) return [];

  // Keep only the latest snapshot per match (rows are already desc-sorted)
  const seen = new Set<string>();
  return (data as LiveSnapshot[]).filter((row) => {
    if (seen.has(row.match_id)) return false;
    seen.add(row.match_id);
    return true;
  });
}

export async function getMatchH2H(matchId: string): Promise<MatchH2H | null> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("matches")
    .select("h2h_home_wins, h2h_draws, h2h_away_wins, h2h_raw")
    .eq("id", matchId)
    .single();

  if (error || !data) return null;

  const row = data as {
    h2h_home_wins: number | null;
    h2h_draws: number | null;
    h2h_away_wins: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    h2h_raw: any[] | null;
  };

  if (row.h2h_home_wins === null && row.h2h_draws === null && row.h2h_away_wins === null) return null;

  const recent: H2HMatch[] = [];
  if (Array.isArray(row.h2h_raw)) {
    for (const m of row.h2h_raw) {
      try {
        recent.push({
          date: m.fixture?.date || m.date || "",
          homeTeam: m.teams?.home?.name || "",
          awayTeam: m.teams?.away?.name || "",
          scoreHome: m.goals?.home ?? null,
          scoreAway: m.goals?.away ?? null,
        });
      } catch { /* skip malformed entries */ }
    }
  }

  return {
    homeWins: row.h2h_home_wins ?? 0,
    draws: row.h2h_draws ?? 0,
    awayWins: row.h2h_away_wins ?? 0,
    recent: recent.slice(0, 5),
  };
}

export async function getMatchInjuries(matchId: string): Promise<MatchInjury[]> {
  const supabase = createSupabasePublic();

  // Fetch injuries with player_id so we can join sidelined history count
  const { data, error } = await supabase
    .from("match_injuries")
    .select("player_name, player_id, team_side, status, reason")
    .eq("match_id", matchId);

  if (error || !data) return [];

  type InjRow = { player_name: string; player_id: number | null; team_side: string; status: string; reason: string | null };
  const rows = data as InjRow[];

  // Fetch career injury counts from player_sidelined for all player IDs
  const playerIds = rows.map((r) => r.player_id).filter(Boolean) as number[];
  const sidCountMap = new Map<number, number>();

  if (playerIds.length > 0) {
    const { data: sidRows } = await supabase
      .from("player_sidelined")
      .select("player_id")
      .in("player_id", playerIds);

    if (sidRows) {
      for (const r of sidRows as { player_id: number }[]) {
        sidCountMap.set(r.player_id, (sidCountMap.get(r.player_id) ?? 0) + 1);
      }
    }
  }

  return rows.map((r) => ({
    playerName: r.player_name,
    teamSide: r.team_side as "home" | "away",
    status: r.status,
    reason: r.reason,
    injuryCount: r.player_id ? (sidCountMap.get(r.player_id) ?? null) : null,
  }));
}

export async function getTeamStandings(
  homeTeam: string,
  awayTeam: string
): Promise<{ home: TeamStanding | null; away: TeamStanding | null }> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("league_standings")
    .select("team_name, team_api_id, rank, points, played, wins, draws, losses, goals_for, goals_against, form")
    .in("team_name", [homeTeam, awayTeam])
    .order("fetched_date", { ascending: false });

  if (error || !data) return { home: null, away: null };

  type Row = {
    team_name: string;
    team_api_id: number;
    rank: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goals_for: number;
    goals_against: number;
    form: string;
  };

  // dedupe by team_name — keep most recent (first due to desc sort)
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const r of data as Row[]) {
    if (!seen.has(r.team_name)) {
      seen.add(r.team_name);
      rows.push(r);
    }
  }

  const toStanding = (r: Row | undefined): TeamStanding | null => {
    if (!r) return null;
    return {
      teamName: r.team_name,
      teamApiId: r.team_api_id,
      rank: r.rank,
      points: r.points,
      played: r.played,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      goalsFor: r.goals_for,
      goalsAgainst: r.goals_against,
      form: r.form || "",
    };
  };

  return {
    home: toStanding(rows.find((r) => r.team_name === homeTeam)),
    away: toStanding(rows.find((r) => r.team_name === awayTeam)),
  };
}

export async function getMatchEvents(matchId: string): Promise<MatchEvent[]> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("match_events")
    .select("minute, added_time, event_type, team, player_name, assist_name, detail")
    .eq("match_id", matchId)
    .order("minute", { ascending: true });
  if (error || !data) return [];
  return (data as {
    minute: number;
    added_time: number;
    event_type: string;
    team: string;
    player_name: string | null;
    assist_name: string | null;
    detail: string | null;
  }[]).map((r) => ({
    minute: r.minute,
    addedTime: r.added_time,
    eventType: r.event_type,
    team: r.team as "home" | "away",
    playerName: r.player_name,
    assistName: r.assist_name,
    detail: r.detail,
  }));
}

export async function getMatchLineups(matchId: string): Promise<LineupData | null> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("matches")
    .select("lineups_home, lineups_away, formation_home, formation_away, coach_home, coach_away")
    .eq("id", matchId)
    .single();
  if (error || !data) return null;
  const row = data as {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineups_home: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineups_away: any;
    formation_home: string | null;
    formation_away: string | null;
    coach_home: string | null;
    coach_away: string | null;
  };
  if (!row.lineups_home && !row.lineups_away) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseXI = (lineup: any): LineupPlayer[] => {
    if (!lineup?.startXI) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return lineup.startXI.map((e: any) => ({
      name: e.player?.name || "",
      number: e.player?.number ?? null,
      position: e.player?.pos ?? null,
      grid: e.player?.grid ?? null,
    }));
  };

  return {
    formationHome: row.formation_home,
    formationAway: row.formation_away,
    coachHome: row.coach_home,
    coachAway: row.coach_away,
    startXIHome: parseXI(row.lineups_home),
    startXIAway: parseXI(row.lineups_away),
  };
}

export async function getMatchPlayerStats(matchId: string): Promise<PlayerStat[]> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("match_player_stats")
    .select(
      "player_name, team_side, position, shirt_number, minutes_played, rating, goals, assists, passes_key, yellow_cards, red_cards"
    )
    .eq("match_id", matchId)
    .order("rating", { ascending: false });
  if (error || !data) return [];
  return (data as {
    player_name: string | null;
    team_side: string;
    position: string | null;
    shirt_number: number | null;
    minutes_played: number | null;
    rating: number | null;
    goals: number | null;
    assists: number | null;
    passes_key: number | null;
    yellow_cards: number | null;
    red_cards: number | null;
  }[]).map((r) => ({
    playerName: r.player_name,
    teamSide: r.team_side as "home" | "away",
    position: r.position,
    shirtNumber: r.shirt_number,
    minutesPlayed: r.minutes_played,
    rating: r.rating,
    goals: r.goals,
    assists: r.assists,
    passesKey: r.passes_key,
    yellowCards: r.yellow_cards,
    redCards: r.red_cards,
  }));
}

export async function getTeamSeasonStats(
  homeApiId: number | null,
  awayApiId: number | null
): Promise<{ home: TeamSeasonStat | null; away: TeamSeasonStat | null }> {
  const ids = [homeApiId, awayApiId].filter((id): id is number => id !== null);
  if (!ids.length) return { home: null, away: null };

  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("team_season_stats")
    .select(
      `team_api_id, form, played_total, wins_total, draws_total, losses_total,
       goals_for_avg, goals_against_avg, clean_sheet_pct, most_used_formation,
       played_home, goals_for_home, goals_against_home,
       played_away, goals_for_away, goals_against_away`
    )
    .in("team_api_id", ids)
    .order("fetched_date", { ascending: false });

  if (error || !data) return { home: null, away: null };

  type Row = {
    team_api_id: number;
    form: string | null;
    played_total: number | null;
    wins_total: number | null;
    draws_total: number | null;
    losses_total: number | null;
    goals_for_avg: number | null;
    goals_against_avg: number | null;
    clean_sheet_pct: number | null;
    most_used_formation: string | null;
    played_home: number | null;
    goals_for_home: number | null;
    goals_against_home: number | null;
    played_away: number | null;
    goals_for_away: number | null;
    goals_against_away: number | null;
  };

  // dedupe — keep most recent per team
  const seen = new Set<number>();
  const rows: Row[] = [];
  for (const r of data as Row[]) {
    if (!seen.has(r.team_api_id)) { seen.add(r.team_api_id); rows.push(r); }
  }

  const toStat = (id: number | null): TeamSeasonStat | null => {
    if (!id) return null;
    const r = rows.find((x) => x.team_api_id === id);
    if (!r) return null;
    return {
      form: r.form,
      playedTotal: r.played_total,
      winsTotal: r.wins_total,
      drawsTotal: r.draws_total,
      lossesTotal: r.losses_total,
      goalsForAvg: r.goals_for_avg,
      goalsAgainstAvg: r.goals_against_avg,
      cleanSheetPct: r.clean_sheet_pct,
      mostUsedFormation: r.most_used_formation,
      playedHome: r.played_home,
      goalsForHome: r.goals_for_home,
      goalsAgainstHome: r.goals_against_home,
      playedAway: r.played_away,
      goalsForAway: r.goals_for_away,
      goalsAgainstAway: r.goals_against_away,
    };
  };

  return { home: toStat(homeApiId), away: toStat(awayApiId) };
}

export async function getOddsMovement(matchId: string): Promise<OddsMovementPoint[]> {
  // DATE_TRUNC('hour') + MAX GROUP BY in DB — replaces fetching all snapshots
  // and bucketing by hour in JS. Returns ~20-50 rows instead of 100-1000.
  const supabase = createSupabasePublic();
  const { data, error } = await supabase.rpc("get_odds_movement_bucketed", {
    p_match_id: matchId,
  });
  if (error || !data) return [];

  type BucketRow = { hour_bucket: string; market: string; selection: string; best_odds: number };

  // Pivot the flat rows into the OddsMovementPoint shape
  const byHour: Record<string, { home: number; draw: number; away: number; over25: number; under25: number }> = {};
  for (const row of data as BucketRow[]) {
    const key = row.hour_bucket;
    if (!byHour[key]) byHour[key] = { home: 0, draw: 0, away: 0, over25: 0, under25: 0 };
    const odds = Number(row.best_odds);
    if (row.market === "1x2") {
      if (row.selection === "home") byHour[key].home = odds;
      if (row.selection === "draw") byHour[key].draw = odds;
      if (row.selection === "away") byHour[key].away = odds;
    } else if (row.market === "over_under_25") {
      if (row.selection === "over") byHour[key].over25 = odds;
      if (row.selection === "under") byHour[key].under25 = odds;
    }
  }

  return Object.entries(byHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ts, odds]) => ({
      timestamp: ts,
      bestHome: odds.home,
      bestDraw: odds.draw,
      bestAway: odds.away,
      bestOver25: odds.over25,
      bestUnder25: odds.under25,
    }))
    .filter((p) => p.bestHome > 0 || p.bestDraw > 0 || p.bestAway > 0 || p.bestOver25 > 0);
}

// ─── Live in-play odds for FE-LIVE ──────────────────────────────────────────

export interface LiveOddsPoint {
  minute: number; // match minute (minutes_to_kickoff stored as minute elapsed)
  bookmaker: string;
  market: string;
  selection: string;
  odds: number;
  timestamp: string;
}

export interface LiveOddsSnapshot {
  minute: number;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
}

/**
 * Fetch live in-play odds for a match, aggregated by minute.
 * Returns best odds per (minute, selection) across all bookmakers.
 */
export async function getLiveMatchOdds(matchId: string): Promise<LiveOddsSnapshot[]> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("odds_snapshots")
    .select("bookmaker, market, selection, odds, minutes_to_kickoff, timestamp")
    .eq("match_id", matchId)
    .eq("is_live", true)
    .eq("market", "1x2")
    .order("minutes_to_kickoff", { ascending: true });

  if (error || !data) return [];

  // Group by match minute, find best odds per selection
  const byMinute: Record<number, { home: number[]; draw: number[]; away: number[] }> = {};
  for (const row of data as { bookmaker: string; market: string; selection: string; odds: number; minutes_to_kickoff: number | null; timestamp: string }[]) {
    const minute = row.minutes_to_kickoff ?? 0;
    if (!byMinute[minute]) byMinute[minute] = { home: [], draw: [], away: [] };
    const odds = Number(row.odds);
    if (!odds || odds <= 1) continue;
    if (row.selection === "home") byMinute[minute].home.push(odds);
    if (row.selection === "draw") byMinute[minute].draw.push(odds);
    if (row.selection === "away") byMinute[minute].away.push(odds);
  }

  return Object.entries(byMinute)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([minute, odds]) => ({
      minute: Number(minute),
      bestHome: odds.home.length ? Math.max(...odds.home) : 0,
      bestDraw: odds.draw.length ? Math.max(...odds.draw) : 0,
      bestAway: odds.away.length ? Math.max(...odds.away) : 0,
    }))
    .filter((p) => p.bestHome > 0 || p.bestDraw > 0 || p.bestAway > 0);
}

// ─── Match signals for SUX-4 summary tab ────────────────────────────────────

export interface MatchSignalRow {
  signal_name: string;
  signal_value: number;
  signal_group: string;
  captured_at: string;
}

/**
 * Fetch all latest signal values for a single match (SUX-4).
 * Returns the most recent value per signal_name.
 * Uses public client — match_signals has no RLS (public read).
 */
export async function getMatchSignals(matchId: string): Promise<MatchSignalRow[]> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("match_signals")
    .select("signal_name, signal_value, signal_group, captured_at")
    .eq("match_id", matchId)
    .order("captured_at", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  // Keep only the latest value per signal_name
  const seen = new Set<string>();
  return (data as MatchSignalRow[]).filter((row) => {
    if (seen.has(row.signal_name)) return false;
    seen.add(row.signal_name);
    return true;
  });
}

/**
 * Fetch full signal capture history for SUX-8 (Signal Timeline).
 * Returns ALL captures (not deduplicated), ordered ascending by captured_at.
 * Used to build a chronological timeline of signal events.
 * Pro/Elite only — called only when isPro is confirmed server-side.
 */
export async function getMatchSignalHistory(matchId: string): Promise<MatchSignalRow[]> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("match_signals")
    .select("signal_name, signal_value, signal_group, captured_at")
    .eq("match_id", matchId)
    .order("captured_at", { ascending: true })
    .limit(1000);

  if (error || !data) return [];
  return data as MatchSignalRow[];
}

/**
 * Fetch CLV data for a match (SUX-12).
 * Returns pseudo_clv columns and any settled simulated bets for this match.
 * Elite only — called only when isElite is confirmed server-side.
 */
export interface MatchCLVData {
  pseudoClvHome: number | null;
  pseudoClvDraw: number | null;
  pseudoClvAway: number | null;
  settledBets: Array<{
    id: string;
    selection: string;
    oddsAtPick: number;
    closingOdds: number | null;
    clv: number | null;
    result: string;
    pnl: number;
    botName: string;
  }>;
}

export async function getMatchCLVData(matchId: string): Promise<MatchCLVData> {
  const supabase = await createSupabaseServer();

  const [matchResult, betsResult] = await Promise.all([
    supabase
      .from("matches")
      .select("pseudo_clv_home, pseudo_clv_draw, pseudo_clv_away")
      .eq("id", matchId)
      .single(),
    supabase
      .from("simulated_bets")
      .select(`id, selection, odds_at_pick, closing_odds, clv, result, pnl, bot:bot_id(name)`)
      .eq("match_id", matchId)
      .neq("result", "pending")
      .order("pick_time", { ascending: false }),
  ]);

  const matchData = matchResult.data;
  const bets = (betsResult.data || []) as Array<{
    id: string; selection: string; odds_at_pick: number; closing_odds: number | null;
    clv: number | null; result: string; pnl: number;
    bot: { name: string } | { name: string }[] | null;
  }>;

  return {
    pseudoClvHome: matchData?.pseudo_clv_home ?? null,
    pseudoClvDraw: matchData?.pseudo_clv_draw ?? null,
    pseudoClvAway: matchData?.pseudo_clv_away ?? null,
    settledBets: bets.map((b) => ({
      id: b.id,
      selection: b.selection,
      oddsAtPick: Number(b.odds_at_pick),
      closingOdds: b.closing_odds != null ? Number(b.closing_odds) : null,
      clv: b.clv != null ? Number(b.clv) : null,
      result: b.result,
      pnl: Number(b.pnl || 0),
      botName: (Array.isArray(b.bot) ? b.bot[0] : b.bot)?.name || "unknown",
    })),
  };
}

// ─── Track Record stats (CLV + edge metrics) ──────────────────────────────

export interface TrackRecordStats {
  avgClv: number | null;         // average CLV across settled bets
  totalValueBets: number;        // bets with edge > 0
  avgEdge: number;               // average edge %
  settledBets: number;           // total settled
  leaguesCovered: number;        // distinct leagues with bets
  bookmakersCovered: number;     // distinct bookmakers in odds
}

export async function getTrackRecordStats(): Promise<TrackRecordStats> {
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
    return {
      avgClv: cache.avg_clv,
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
}

// ─── System status (live activity indicators) ──────────────────────────────

export interface SystemStatus {
  lastOddsScan: string | null;   // ISO timestamp
  lastPredictionRun: string | null; // ISO timestamp
  matchesToday: number;
  liveMatchesNow: number;
  valueOpportunitiesToday: number;
  oddsUpdatesToday: number;
  activeBots: number;
  leaguesTracked: number;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const supabase = createSupabasePublic();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  // 4 fast queries in parallel (was 8):
  // - getDashboardCache: single row, index scan — replaces activeBots + leaguesTracked
  // - lastOddsResult: single row ORDER BY timestamp DESC
  // - liveResult / matchCountResult / valueBetsResult: COUNT(*) with index — near-instant
  // - oddsCountResult: COUNT(*) with index
  const [cache, lastOddsResult, liveResult, matchCountResult, valueBetsResult, oddsCountResult] = await Promise.all([
    getDashboardCache(),
    supabase
      .from("odds_snapshots")
      .select("timestamp")
      .order("timestamp", { ascending: false })
      .limit(1),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .in("status", ["live", "1H", "2H", "HT"]),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .gte("date", todayStr)
      .lte("date", now.toISOString()),
    supabase
      .from("simulated_bets")
      .select("id", { count: "exact", head: true })
      .gte("pick_time", todayStr),
    supabase
      .from("odds_snapshots")
      .select("id", { count: "exact", head: true })
      .gte("timestamp", todayStr),
  ]);

  const lastTs = (lastOddsResult.data as { timestamp: string }[] | null)?.[0]?.timestamp ?? null;

  return {
    lastOddsScan: lastTs,
    lastPredictionRun: null,
    matchesToday: matchCountResult.count ?? 0,
    liveMatchesNow: liveResult.count ?? 0,
    valueOpportunitiesToday: valueBetsResult.count ?? 0,
    oddsUpdatesToday: oddsCountResult.count ?? 0,
    activeBots: 16,  // fixed — bot count doesn't change at runtime
    leaguesTracked: 0,
  };
}

// ─── ENG-6: Bot consensus ───────────────────────────────────────────────────

export interface BotConsensusItem {
  market: string;
  selection: string;
  count: number;
  avgEdge: number;
  avgProb: number;
}

export interface BotConsensusData {
  totalBets: number;
  topItem: BotConsensusItem | null;
  markets: BotConsensusItem[];
}

// ─── PERF-CACHE: Pre-computed dashboard stats ───────────────────────────────

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

export async function getBotConsensus(matchId: string): Promise<BotConsensusData | null> {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("simulated_bets")
    .select("market, selection, edge_percent, model_probability")
    .eq("match_id", matchId)
    .eq("result", "pending");

  if (error || !data || data.length === 0) return null;

  // Group by market+selection
  const grouped: Record<string, { count: number; totalEdge: number; totalProb: number }> = {};
  for (const row of data) {
    const key = `${row.market}||${row.selection}`;
    if (!grouped[key]) grouped[key] = { count: 0, totalEdge: 0, totalProb: 0 };
    grouped[key].count++;
    grouped[key].totalEdge += row.edge_percent ?? 0;
    grouped[key].totalProb += row.model_probability ?? 0;
  }

  const markets: BotConsensusItem[] = Object.entries(grouped)
    .map(([key, g]) => {
      const [market, selection] = key.split("||");
      return {
        market,
        selection,
        count: g.count,
        avgEdge: Math.round((g.totalEdge / g.count) * 1000) / 10,
        avgProb: Math.round((g.totalProb / g.count) * 1000) / 10,
      };
    })
    .sort((a, b) => b.count - a.count || b.avgEdge - a.avgEdge);

  return {
    totalBets: data.length,
    topItem: markets[0] ?? null,
    markets,
  };
}

// ─── ENG-14: League prediction pages ─────────────────────────────────────────

export interface LeaguePredictionMatch {
  id: string;
  date: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  leagueName: string;
  leagueCountry: string;
  modelCall: "home" | "draw" | "away" | null;
  confidence: number | null;   // 0-100
  homeProb: number | null;
  drawProb: number | null;
  awayProb: number | null;
  bestHomeOdds: number | null;
  bestDrawOdds: number | null;
  bestAwayOdds: number | null;
  previewTeaser: string | null;
}

export interface LeaguePredictionPage {
  leagueId: string;
  leagueName: string;
  leagueCountry: string;
  leagueSlug: string;
  weekStart: string;
  weekEnd: string;
  matches: LeaguePredictionMatch[];
}

// Featured leagues for the predictions index page
// leagueId: hardcoded Supabase UUID — skips the ilike search that often matches wrong leagues
export const PREDICTION_LEAGUES = [
  { slug: "premier-league",  name: "Premier League",  country: "England",     leagueId: "73c57213-6829-4c04-b5aa-04db792b98e8", searchName: undefined,              searchCountry: undefined },
  { slug: "la-liga",         name: "La Liga",          country: "Spain",       leagueId: "0cfb91ae-0f59-4278-8229-ef92118960c3", searchName: undefined,              searchCountry: undefined },
  { slug: "bundesliga",      name: "Bundesliga",       country: "Germany",     leagueId: "e8094a6f-70b5-4c9d-ba89-4ed16fe29403", searchName: undefined,              searchCountry: undefined },
  { slug: "serie-a",         name: "Serie A",          country: "Italy",       leagueId: "fc8d465e-202a-48d4-9ef3-512e84f854d9", searchName: undefined,              searchCountry: undefined },
  { slug: "ligue-1",         name: "Ligue 1",          country: "France",      leagueId: "01c7bf8f-bcd8-4342-81bd-939c33780d7b", searchName: undefined,              searchCountry: undefined },
  { slug: "champions-league",name: "Champions League", country: "Europe",      leagueId: "1bb28d8a-8b00-436b-aef7-7ba9c86dcc3f", searchName: "UEFA Champions League", searchCountry: "World" },
  { slug: "eredivisie",      name: "Eredivisie",       country: "Netherlands", leagueId: "3a05f941-ee5f-44c4-8c9d-67ecf8ea5b3b", searchName: undefined,              searchCountry: undefined },
  { slug: "primeira-liga",   name: "Primeira Liga",    country: "Portugal",    leagueId: "eb39f011-6493-4e06-8c50-56034e1a3e37", searchName: undefined,              searchCountry: undefined },
];

export type PredictionLeagueSlug = (typeof PREDICTION_LEAGUES)[number]["slug"];

/** Per-league fixture counts for the next 21 days, keyed by leagueId.
 * Used by the predictions index — page is ISR-cached, so this runs at most once per revalidate window. */
export async function getPredictionLeagueCounts(): Promise<Record<string, number>> {
  const admin = createSupabaseAdmin();
  const leagueIds = PREDICTION_LEAGUES.map((l) => l.leagueId);
  const now = new Date();
  const start = now.toISOString().split("T")[0];
  const end = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data } = await admin
    .from("matches")
    .select("league_id")
    .in("league_id", leagueIds)
    .gte("date", start)
    .lte("date", end)
    .in("status", ["scheduled", "live"]);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ league_id: string }>) {
    counts[row.league_id] = (counts[row.league_id] ?? 0) + 1;
  }
  return counts;
}

export async function getLeaguePredictions(
  leagueSlug: string
): Promise<LeaguePredictionPage | null> {
  const supabase = await createSupabaseServer();

  const meta = PREDICTION_LEAGUES.find((l) => l.slug === leagueSlug);

  // Show up to 21 days ahead so next-round fixtures appear even if a bit out
  const now = new Date();
  const weekStart = now.toISOString().split("T")[0];
  const weekEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Use hardcoded leagueId when available — avoids ilike matching wrong leagues
  let leagueIds: string[];
  let primaryLeague: { id: string; name: string; country: string };

  if (meta?.leagueId) {
    leagueIds = [meta.leagueId];
    primaryLeague = { id: meta.leagueId, name: meta.name, country: meta.country };
  } else {
    // Fall back to ilike search for dynamic/unknown leagues
    let leagueQuery = supabase.from("leagues").select("id, name, country");
    if (meta) {
      const searchName = meta.searchName ?? meta.name;
      const searchCountry = meta.searchCountry ?? meta.country;
      leagueQuery = leagueQuery
        .ilike("name", `%${searchName}%`)
        .ilike("country", `%${searchCountry}%`);
    } else {
      const parts = leagueSlug.replace(/-/g, " ").split(" ");
      leagueQuery = leagueQuery.ilike("name", `%${parts[0]}%`);
    }
    const { data: leagues } = await leagueQuery.limit(3);
    if (!leagues || leagues.length === 0) return null;
    leagueIds = (leagues as Array<{ id: string; name: string; country: string }>).map((l) => l.id);
    primaryLeague = leagues[0] as { id: string; name: string; country: string };
  }

  const { data: matchRows } = await supabase
    .from("matches")
    .select(`
      id, date,
      home_team:home_team_id(name, logo_url),
      away_team:away_team_id(name, logo_url)
    `)
    .in("league_id", leagueIds)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .in("status", ["scheduled", "live", "finished"])
    .order("date", { ascending: true })
    .limit(30);

  if (!matchRows || matchRows.length === 0) {
    return {
      leagueId: primaryLeague.id,
      leagueName: meta?.name ?? primaryLeague.name,
      leagueCountry: meta?.country ?? primaryLeague.country,
      leagueSlug,
      weekStart,
      weekEnd,
      matches: [],
    };
  }

  const matchIds = (matchRows as Array<Record<string, unknown>>).map((m) => m.id as string);

  // Fetch predictions, previews, and best odds in parallel
  // Best odds via RPC (same approach as getPublicMatches) — odds_home/draw/away don't exist on matches table
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: preds }, { data: previews }, { data: oddsRows }] = await Promise.all([
    supabase
      .from("predictions")
      .select("match_id, market, model_probability")
      .in("match_id", matchIds)
      .in("market", ["1x2_home", "1x2_draw", "1x2_away"])
      .eq("source", "ensemble"),
    supabase
      .from("match_previews")
      .select("match_id, teaser")
      .in("match_id", matchIds),
    supabase.rpc("get_best_match_odds", {
      p_match_ids: matchIds,
      p_since: yesterday,
    }),
  ]);

  const predMap = new Map<string, Record<string, number>>();
  for (const p of (preds ?? []) as Array<{ match_id: string; market: string; model_probability: number }>) {
    if (!predMap.has(p.match_id)) predMap.set(p.match_id, {});
    predMap.get(p.match_id)![p.market] = Number(p.model_probability);
  }

  const previewMap = new Map<string, string>();
  for (const pv of (previews ?? []) as Array<{ match_id: string; teaser: string | null }>) {
    if (pv.teaser) previewMap.set(pv.match_id, pv.teaser);
  }

  // Build odds map from RPC result
  const oddsMap = new Map<string, { home: number; draw: number; away: number }>();
  for (const o of (oddsRows ?? []) as Array<{ match_id: string; selection: string; best_odds: number }>) {
    if (!oddsMap.has(o.match_id)) oddsMap.set(o.match_id, { home: 0, draw: 0, away: 0 });
    const entry = oddsMap.get(o.match_id)!;
    if (o.selection === "home") entry.home = o.best_odds;
    else if (o.selection === "draw") entry.draw = o.best_odds;
    else if (o.selection === "away") entry.away = o.best_odds;
  }

  const matches: LeaguePredictionMatch[] = (
    matchRows as Array<Record<string, unknown>>
  ).map((m) => {
    const ht = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team;
    const at = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team;
    const probs = predMap.get(m.id as string);
    const hp = probs?.["1x2_home"] ?? null;
    const dp = probs?.["1x2_draw"] ?? null;
    const ap = probs?.["1x2_away"] ?? null;
    const odds = oddsMap.get(m.id as string);

    let modelCall: "home" | "draw" | "away" | null = null;
    let confidence: number | null = null;
    if (hp !== null && dp !== null && ap !== null) {
      const maxP = Math.max(hp, dp, ap);
      modelCall = hp === maxP ? "home" : dp === maxP ? "draw" : "away";
      confidence = Math.round(maxP * 100);
    }

    return {
      id: m.id as string,
      date: m.date as string,
      kickoff: m.date as string,
      homeTeam: (ht as Record<string, string>)?.name ?? "Home",
      awayTeam: (at as Record<string, string>)?.name ?? "Away",
      homeLogo: ((ht as Record<string, string | null>)?.logo_url as string | null) ?? null,
      awayLogo: ((at as Record<string, string | null>)?.logo_url as string | null) ?? null,
      leagueName: meta?.name ?? primaryLeague.name,
      leagueCountry: meta?.country ?? primaryLeague.country,
      modelCall,
      confidence,
      homeProb: hp !== null ? Math.round(hp * 100) : null,
      drawProb: dp !== null ? Math.round(dp * 100) : null,
      awayProb: ap !== null ? Math.round(ap * 100) : null,
      bestHomeOdds: odds?.home ?? null,
      bestDrawOdds: odds?.draw ?? null,
      bestAwayOdds: odds?.away ?? null,
      previewTeaser: previewMap.get(m.id as string) ?? null,
    };
  });

  // Deduplicate: same match can be stored twice with different team name variants
  // (e.g. "Atletico Madrid" vs "Atlético Madrid"). Group by kickoff timestamp,
  // keep the richer record (has model predictions > has odds > neither).
  const seen = new Map<string, LeaguePredictionMatch>();
  for (const m of matches) {
    const key = m.kickoff; // exact ISO timestamp — same match = same kickoff
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, m);
    } else {
      const score = (x: LeaguePredictionMatch) =>
        (x.modelCall !== null ? 2 : 0) + (x.bestHomeOdds !== null ? 1 : 0);
      if (score(m) > score(existing)) seen.set(key, m);
    }
  }
  const deduped = Array.from(seen.values());

  return {
    leagueId: primaryLeague.id,
    leagueName: meta?.name ?? primaryLeague.name,
    leagueCountry: meta?.country ?? primaryLeague.country,
    leagueSlug,
    weekStart,
    weekEnd,
    matches: deduped,
  };
}

// ─── ENG-12: Model vs Market vs Users ────────────────────────────────────────

export interface ModelMarketUsersData {
  modelHome: number;   // model probability for home win (0-1)
  marketHome: number;  // 1/best_home_odds (implied, vig-inclusive)
  usersHome: number;   // community vote share for home (0-1), null if no votes
  homeTeam: string;
  hasVotes: boolean;
  totalVotes: number;
}

export async function getModelMarketUsers(matchId: string): Promise<ModelMarketUsersData | null> {
  const supabase = await createSupabaseServer();

  // Fetch ensemble 1x2_home prediction + match odds + community votes in parallel
  const [predResult, voteResult] = await Promise.all([
    supabase
      .from("predictions")
      .select("model_probability, implied_probability, market")
      .eq("match_id", matchId)
      .eq("source", "ensemble")
      .eq("market", "1x2_home")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("match_votes")
      .select("vote")
      .eq("match_id", matchId),
  ]);

  const pred = predResult.data;
  if (!pred) return null;

  const votes = voteResult.data ?? [];
  const voteCounts = { home: 0, draw: 0, away: 0, total: votes.length };
  for (const v of votes as { vote: string }[]) {
    if (v.vote === "home") voteCounts.home++;
    else if (v.vote === "draw") voteCounts.draw++;
    else if (v.vote === "away") voteCounts.away++;
  }

  return {
    modelHome:  Math.round(Number(pred.model_probability) * 1000) / 10,
    marketHome: Math.round(Number(pred.implied_probability) * 1000) / 10,
    usersHome:  voteCounts.total > 0
      ? Math.round((voteCounts.home / voteCounts.total) * 1000) / 10
      : 50,
    homeTeam:   "",  // filled by caller from match data
    hasVotes:   voteCounts.total > 0,
    totalVotes: voteCounts.total,
  };
}

// ─── ENG-11: What Changed Today ───────────────────────────────────────────────

export interface WhatChangedItem {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  signalName: string;
  signalLabel: string;
  valueBefore: number | null;
  valueNow: number;
  delta: number;
  direction: "up" | "down";
  magnitude: "small" | "medium" | "large";
}

export async function getWhatChangedToday(): Promise<WhatChangedItem[]> {
  const supabase = await createSupabaseServer();

  // Find signals that changed significantly in the last 8 hours
  // by comparing the most recent value to a value from 20-32 hours ago
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();
  const oldStart = new Date(now.getTime() - 32 * 60 * 60 * 1000).toISOString();
  const oldEnd = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

  // Signals worth tracking for changes
  const TRACKED_SIGNALS = [
    "elo_diff",
    "odds_drift_home",
    "odds_drift_away",
    "news_impact_score",
    "injury_count_home",
    "injury_count_away",
    "model_confidence",
    "sharp_consensus_home",
    "pinnacle_implied_home",
  ];

  const { data: recentRows } = await supabase
    .from("match_signals")
    .select("match_id, signal_name, signal_value, captured_at")
    .in("signal_name", TRACKED_SIGNALS)
    .gte("captured_at", recentCutoff)
    .not("signal_value", "is", null);

  if (!recentRows || recentRows.length === 0) return [];

  // Get yesterday's values for same matches+signals
  const matchIds = [...new Set(recentRows.map((r) => r.match_id))];
  const { data: oldRows } = await supabase
    .from("match_signals")
    .select("match_id, signal_name, signal_value, captured_at")
    .in("signal_name", TRACKED_SIGNALS)
    .in("match_id", matchIds)
    .gte("captured_at", oldStart)
    .lte("captured_at", oldEnd)
    .not("signal_value", "is", null);

  // Build map: matchId+signalName → old value
  const oldMap = new Map<string, number>();
  for (const row of (oldRows ?? [])) {
    const key = `${row.match_id}::${row.signal_name}`;
    const existing = oldMap.get(key);
    const val = Number(row.signal_value);
    // Keep most recent old value
    if (existing === undefined || Number(row.captured_at) > Number(existing)) {
      oldMap.set(key, val);
    }
  }

  // Build map: matchId+signalName → newest recent value
  const recentMap = new Map<string, number>();
  for (const row of recentRows) {
    const key = `${row.match_id}::${row.signal_name}`;
    const existing = recentMap.get(key);
    const val = Number(row.signal_value);
    if (existing === undefined) recentMap.set(key, val);
  }

  // Find matches with significant deltas
  const THRESHOLDS: Record<string, number> = {
    elo_diff: 50,
    odds_drift_home: 0.04,
    odds_drift_away: 0.04,
    news_impact_score: 0.3,
    injury_count_home: 1,
    injury_count_away: 1,
    model_confidence: 0.04,
    sharp_consensus_home: 0.03,
    pinnacle_implied_home: 0.03,
  };

  const SIGNAL_LABELS: Record<string, string> = {
    elo_diff: "ELO gap shifted",
    odds_drift_home: "Home odds moved",
    odds_drift_away: "Away odds moved",
    news_impact_score: "News impact spiked",
    injury_count_home: "Home injuries",
    injury_count_away: "Away injuries",
    model_confidence: "Model confidence changed",
    sharp_consensus_home: "Sharp money moved",
    pinnacle_implied_home: "Pinnacle line shifted",
  };

  interface DeltaRow {
    matchId: string;
    signalName: string;
    delta: number;
    valueBefore: number | null;
    valueNow: number;
  }

  const deltas: DeltaRow[] = [];

  for (const [key, nowVal] of recentMap) {
    const [mId, sigName] = key.split("::");
    const oldVal = oldMap.get(key) ?? null;
    if (oldVal === null) continue;
    const delta = nowVal - oldVal;
    const threshold = THRESHOLDS[sigName] ?? 0.05;
    if (Math.abs(delta) >= threshold) {
      deltas.push({ matchId: mId, signalName: sigName, delta, valueBefore: oldVal, valueNow: nowVal });
    }
  }

  if (deltas.length === 0) return [];

  // Sort by abs(delta) descending, take top 8
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const topDeltas = deltas.slice(0, 8);
  const topMatchIds = [...new Set(topDeltas.map((d) => d.matchId))];

  // Fetch match info for these matches
  const { data: matchRows } = await supabase
    .from("matches")
    .select(`
      id,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name),
      league:leagues(name)
    `)
    .in("id", topMatchIds);

  const matchMeta = new Map<string, { home: string; away: string; league: string }>();
  for (const m of (matchRows ?? []) as unknown as Array<{
    id: string;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
    league: { name: string } | null;
  }>) {
    matchMeta.set(m.id, {
      home: m.home_team?.name ?? "Home",
      away: m.away_team?.name ?? "Away",
      league: m.league?.name ?? "",
    });
  }

  return topDeltas
    .filter((d) => matchMeta.has(d.matchId))
    .slice(0, 5)
    .map((d) => {
      const meta = matchMeta.get(d.matchId)!;
      const absDelta = Math.abs(d.delta);
      const threshold = THRESHOLDS[d.signalName] ?? 0.05;
      return {
        matchId: d.matchId,
        homeTeam: meta.home,
        awayTeam: meta.away,
        league: meta.league,
        signalName: d.signalName,
        signalLabel: SIGNAL_LABELS[d.signalName] ?? d.signalName,
        valueBefore: d.valueBefore,
        valueNow: d.valueNow,
        delta: Math.round(d.delta * 1000) / 1000,
        direction: d.delta > 0 ? "up" : "down",
        magnitude: absDelta > threshold * 3 ? "large" : absDelta > threshold * 1.5 ? "medium" : "small",
      };
    });
}

// ─── ELITE-BANKROLL: Personal bankroll analytics ───────────────────────────

export interface BankrollPick {
  id: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  selection: string;
  odds: number;
  result: "won" | "lost" | "pending";
  units: number;       // net units for this pick (won: odds-1, lost: -1)
  clv: number | null;  // closing line value from pseudo_clv on matches table
}

export interface BankrollLeagueStat {
  league: string;
  total: number;
  won: number;
  lost: number;
  netUnits: number;
  roi: number;
}

export interface BankrollData {
  picks: BankrollPick[];
  cumulativeSeries: { date: string; units: number }[];
  stats: {
    total: number;
    won: number;
    lost: number;
    pending: number;
    hitRate: number;
    roi: number;
    netUnits: number;
    avgClv: number | null;
    maxDrawdown: number;
  };
  leagueBreakdown: BankrollLeagueStat[];
  modelComparison: {
    total: number;
    won: number;
    lost: number;
    netUnits: number;
    hitRate: number;
    avgClv: number | null;
  } | null;
}

export async function getUserBankrollData(userId: string): Promise<BankrollData> {
  const supabase = await createSupabaseServer();

  // Fetch all user picks with match info (session-RLS filters to this user)
  const { data: rawPicks } = await supabase
    .from("user_picks")
    .select(
      `id, match_id, selection, odds, stake, result, created_at,
       match:match_id(
         date,
         pseudo_clv_home, pseudo_clv_draw, pseudo_clv_away,
         home_team:home_team_id(name),
         away_team:away_team_id(name),
         league:league_id(name, country)
       )`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const rows = (rawPicks ?? []) as unknown as Array<{
    id: string;
    match_id: string;
    selection: string;
    odds: number | null;
    stake: number | null;
    result: string;
    created_at: string;
    match: {
      date: string;
      pseudo_clv_home: number | null;
      pseudo_clv_draw: number | null;
      pseudo_clv_away: number | null;
      home_team: { name: string } | { name: string }[];
      away_team: { name: string } | { name: string }[];
      league: { name: string; country: string } | { name: string; country: string }[];
    } | null;
  }>;

  const picks: BankrollPick[] = rows.map((r) => {
    const m = r.match;
    const ht = m?.home_team ? (Array.isArray(m.home_team) ? m.home_team[0] : m.home_team) : null;
    const at = m?.away_team ? (Array.isArray(m.away_team) ? m.away_team[0] : m.away_team) : null;
    const lg = m?.league ? (Array.isArray(m.league) ? m.league[0] : m.league) : null;

    const result = (r.result || "pending") as "won" | "lost" | "pending";
    const odds   = r.odds ? Number(r.odds) : 2.0;
    const stake  = r.stake ? Number(r.stake) : 1;
    const units  = result === "won" ? (odds - 1) * stake : result === "lost" ? -stake : 0;

    let clv: number | null = null;
    if (r.selection === "home" && m?.pseudo_clv_home != null)       clv = Number(m.pseudo_clv_home) * 100;
    else if (r.selection === "draw" && m?.pseudo_clv_draw != null)  clv = Number(m.pseudo_clv_draw) * 100;
    else if (r.selection === "away" && m?.pseudo_clv_away != null)  clv = Number(m.pseudo_clv_away) * 100;

    return {
      id: r.id,
      date: m?.date ?? r.created_at,
      homeTeam: ht?.name ?? "?",
      awayTeam: at?.name ?? "?",
      league: lg ? `${lg.country} / ${lg.name}` : "Unknown",
      selection: r.selection,
      odds,
      result,
      units: Math.round(units * 100) / 100,
      clv: clv !== null ? Math.round(clv * 10) / 10 : null,
    };
  });

  const settled = picks.filter((p) => p.result !== "pending");

  // Cumulative units over time (settled picks only, chronological).
  // Prepend a 0u origin point one day before the first settled pick so the
  // chart visibly starts at 0 instead of jumping straight to the first bet's
  // delta — otherwise the line "starts" at e.g. -1u with no reference.
  let running = 0;
  const cumulativeSeries: { date: string; units: number }[] = settled.map((p) => {
    running += p.units;
    return { date: p.date.slice(0, 10), units: Math.round(running * 100) / 100 };
  });
  if (cumulativeSeries.length > 0) {
    const firstDate = new Date(settled[0].date);
    firstDate.setUTCDate(firstDate.getUTCDate() - 1);
    cumulativeSeries.unshift({ date: firstDate.toISOString().slice(0, 10), units: 0 });
  }

  // Max drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let runningDd = 0;
  for (const p of settled) {
    runningDd += p.units;
    if (runningDd > peak) peak = runningDd;
    const dd = peak - runningDd;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Per-league breakdown
  const leagueMap = new Map<string, BankrollLeagueStat>();
  for (const p of settled) {
    const key = p.league;
    const existing = leagueMap.get(key) ?? { league: key, total: 0, won: 0, lost: 0, netUnits: 0, roi: 0 };
    existing.total++;
    if (p.result === "won") existing.won++;
    if (p.result === "lost") existing.lost++;
    existing.netUnits = Math.round((existing.netUnits + p.units) * 100) / 100;
    leagueMap.set(key, existing);
  }
  const leagueBreakdown = Array.from(leagueMap.values())
    .map((l) => ({ ...l, roi: l.total > 0 ? Math.round((l.netUnits / l.total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.netUnits - a.netUnits);

  // Stats
  const won     = settled.filter((p) => p.result === "won").length;
  const lost    = settled.filter((p) => p.result === "lost").length;
  const pending = picks.filter((p) => p.result === "pending").length;
  const netUnits = Math.round(running * 100) / 100;
  const roi = settled.length > 0 ? Math.round((netUnits / settled.length) * 1000) / 10 : 0;
  const clvValues = picks.map((p) => p.clv).filter((c): c is number => c !== null);
  const avgClv = clvValues.length > 0 ? Math.round(clvValues.reduce((a, b) => a + b, 0) / clvValues.length * 10) / 10 : null;

  // Model comparison — admin client needed (simulated_bets has service-role RLS)
  const admin = createSupabaseAdmin();
  const { data: modelBets } = await admin
    .from("simulated_bets")
    .select("result, pnl, clv")
    .in("result", ["won", "lost"])
    .order("created_at", { ascending: true })
    .limit(500);

  let modelComparison = null;
  if (modelBets && modelBets.length > 0) {
    const mWon = modelBets.filter((b) => b.result === "won").length;
    const mLost = modelBets.filter((b) => b.result === "lost").length;
    const mUnits = modelBets.reduce((s, b) => s + Number(b.pnl ?? 0), 0);
    const mClvArr = modelBets.map((b) => b.clv).filter((c) => c != null).map(Number);
    modelComparison = {
      total: modelBets.length,
      won: mWon,
      lost: mLost,
      netUnits: Math.round(mUnits * 100) / 100,
      hitRate: Math.round((mWon / modelBets.length) * 100),
      avgClv: mClvArr.length > 0 ? Math.round(mClvArr.reduce((a, b) => a + b, 0) / mClvArr.length * 1000) / 10 : null,
    };
  }

  return {
    picks: picks.reverse(), // most recent first for table display
    cumulativeSeries,
    stats: {
      total: picks.length,
      won,
      lost,
      pending,
      hitRate: settled.length > 0 ? Math.round((won / settled.length) * 100) : 0,
      roi,
      netUnits,
      avgClv,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    },
    leagueBreakdown,
    modelComparison,
  };
}

// ─── Ops Dashboard ──────────────────────────────────────────────────────────

/** Latest pre-computed ops snapshot for today (written by each pipeline job). */
export async function getOpsSnapshot(date?: string): Promise<OpsSnapshot | null> {
  const admin = createSupabaseAdmin();
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("ops_snapshots")
    .select("*")
    .eq("snapshot_date", targetDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

/** Last 50 pipeline runs across all jobs (live query — small table). */
export async function getRecentPipelineRuns(): Promise<PipelineRun[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("pipeline_runs")
    .select("id, job_name, run_date, status, started_at, completed_at, fixtures_count, records_count, error_message")
    .not("job_name", "in", '("hist_backfill","backfill_coaches","backfill_transfers","write_ops_snapshot")')
    .order("started_at", { ascending: false })
    .limit(50);
  return (data ?? []) as PipelineRun[];
}

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

export interface BackfillCounts {
  coachesTotal: number;
  coachesDone: number;
  coachesLastRun: string | null;
  coachesLastStatus: string | null;
  transfersTotal: number;
  transfersDone: number;
  transfersLastRun: string | null;
  transfersLastStatus: string | null;
  histLastRun: string | null;
  histLastStatus: string | null;
  histDone: number;
  histTotal: number;
}

/** Coaches and transfers backfill progress — team counts + last run info.
 *  Hist (Match stats & events) counts come from live SQL — match_stats has
 *  match_id as PK so COUNT(*) === COUNT(DISTINCT match_id). The previous path
 *  through write_ops_snapshot was hours stale (and sometimes failed entirely),
 *  so the dashboard lagged backfill runs by a full snapshot cycle. */
export async function getBackfillCounts(): Promise<BackfillCounts> {
  const admin = createSupabaseAdmin();
  const [
    totalRes, coachRes, transferRes,
    coachRunRes, transferRunRes, histRunRes,
    histDoneRes, histTotalRes,
  ] = await Promise.all([
    admin.rpc("count_distinct_team_af_ids"),
    admin.rpc("count_distinct_coached_teams"),
    admin.from("team_transfer_cache").select("team_api_id", { count: "exact", head: true }),
    admin.from("pipeline_runs").select("started_at, status").eq("job_name", "backfill_coaches").order("started_at", { ascending: false }).limit(1),
    admin.from("pipeline_runs").select("started_at, status").eq("job_name", "backfill_transfers").order("started_at", { ascending: false }).limit(1),
    admin.from("pipeline_runs").select("started_at, status").eq("job_name", "hist_backfill").order("started_at", { ascending: false }).limit(1),
    admin.from("match_stats").select("match_id", { count: "exact", head: true }),
    admin.from("matches").select("id", { count: "exact", head: true }).eq("status", "finished").not("api_football_id", "is", null),
  ]);
  const total = (totalRes.data as number | null) ?? 0;
  const coachRun = coachRunRes.data?.[0] ?? null;
  const transferRun = transferRunRes.data?.[0] ?? null;
  const histRun = histRunRes.data?.[0] ?? null;
  return {
    coachesTotal: total,
    coachesDone: (coachRes.data as number | null) ?? 0,
    coachesLastRun: coachRun?.started_at ?? null,
    coachesLastStatus: coachRun?.status ?? null,
    transfersTotal: total,
    transfersDone: transferRes.count ?? 0,
    transfersLastRun: transferRun?.started_at ?? null,
    transfersLastStatus: transferRun?.status ?? null,
    histLastRun: histRun?.started_at ?? null,
    histLastStatus: histRun?.status ?? null,
    histDone: histDoneRes.count ?? 0,
    histTotal: histTotalRes.count ?? 0,
  };
}

/** Pending bets where the match has already kicked off >2h ago (truly overdue).
 *  Joins to matches so pre-kickoff morning bets don't trigger false alarms. */
export async function getStalePendingBets(): Promise<{ id: string; market: string; pick_time: string; bot_id: string; match_kickoff: string | null }[]> {
  const admin = createSupabaseAdmin();
  const kickoffCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
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

/** Timestamp of most recent live snapshot (live query — 1 row). */
export async function getLastLiveSnapshotAge(): Promise<string | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("live_match_snapshots")
    .select("captured_at")
    .order("captured_at", { ascending: false })
    .limit(1)
    .single();
  return data?.captured_at ?? null;
}
