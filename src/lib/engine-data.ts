import { createSupabaseServer } from "./supabase-server";
import { createSupabasePublic } from "./supabase-public";

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
}

// ─── Supabase row types ─────────────────────────────────────────────────────

interface MatchRow {
  id: string;
  date: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
  venue_name?: string | null;
  referee?: string | null;
  home_team: { id: string; name: string; country: string }[] | { id: string; name: string; country: string } | null;
  away_team: { id: string; name: string; country: string }[] | { id: string; name: string; country: string } | null;
  league: { id: string; name: string; country: string; tier: number }[] | { id: string; name: string; country: string; tier: number } | null;
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
  // Signal intelligence (SUX-1/2/3) — populated by getPublicMatches(), omitted on detail
  signalCount: number;
  dataGrade: "A" | "B" | "D" | null;
  pulse: "routine" | "interesting" | "high-alert";
  teasers: string[];
  // populated only on match detail (getPublicMatchById)
  score_home?: number | null;
  score_away?: number | null;
  venue_name?: string | null;
  referee?: string | null;
  hasLineups?: boolean;
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
  // Half-time
  shots_home_ht: number | null;
  shots_away_ht: number | null;
  possession_home_ht: number | null;
  corners_home_ht: number | null;
  corners_away_ht: number | null;
  xg_home_ht: number | null;
  xg_away_ht: number | null;
}

export interface OddsMovementPoint {
  timestamp: string;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
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
  dataGrade: "A" | "B" | "D" | null;
  pulse: "routine" | "interesting" | "high-alert";
  teasers: string[];
}

async function batchFetchSignalSummary(
  matchIds: string[],
  todayStart: Date
): Promise<Record<string, MatchSignalSummary>> {
  if (!matchIds.length) return {};
  const supabase = createSupabasePublic();

  const [signalNamesResult, keySignalsResult, predsResult] = await Promise.all([
    // All distinct signal names per match (for count)
    supabase
      .from("match_signals")
      .select("match_id, signal_name")
      .in("match_id", matchIds)
      .gte("captured_at", todayStart.toISOString())
      .limit(60000),
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

  // Count distinct signal names per match
  const signalNamesSeen: Record<string, Set<string>> = {};
  for (const s of (signalNamesResult.data || []) as { match_id: string; signal_name: string }[]) {
    if (!signalNamesSeen[s.match_id]) signalNamesSeen[s.match_id] = new Set();
    signalNamesSeen[s.match_id].add(s.signal_name);
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
    const signalCount = signalNamesSeen[matchId]?.size ?? 0;

    // Grade: A = XGBoost ran, B = Poisson only, D = AF prediction only
    const sources = predSources[matchId] ?? new Set<string>();
    let dataGrade: "A" | "B" | "D" | null = null;
    if (sources.has("xgboost")) dataGrade = "A";
    else if (sources.has("poisson")) dataGrade = "B";
    else if (sources.has("af")) dataGrade = "D";

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
export async function getPublicMatches(): Promise<PublicMatch[]> {
  const supabase = createSupabasePublic();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Step 1: Get today's matches that have at least one odds snapshot
  const { data: allTodayMatches } = await supabase
    .from("matches")
    .select("id")
    .gte("date", todayStart.toISOString())
    .lte("date", todayEnd.toISOString())
    .not("api_football_id", "is", null);

  const todayIds = (allTodayMatches || []).map((r: { id: string }) => r.id);
  if (todayIds.length === 0) return [];

  // Find which of today's matches have odds (batch query)
  const idsWithOdds = new Set<string>();
  const batchSize = 80;
  for (let i = 0; i < todayIds.length; i += batchSize) {
    const batch = todayIds.slice(i, i + batchSize);
    const { data: oddsRows } = await supabase
      .from("odds_snapshots")
      .select("match_id")
      .in("match_id", batch);
    for (const r of (oddsRows || []) as { match_id: string }[]) {
      idsWithOdds.add(r.match_id);
    }
  }

  const filteredIds = [...idsWithOdds];
  if (filteredIds.length === 0) return [];

  // Step 2: Fetch only matches that have odds
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `id, date, status,
       home_team:home_team_id(id, name, country),
       away_team:away_team_id(id, name, country),
       league:league_id(id, name, country, tier)`
    )
    .in("id", filteredIds)
    .order("date", { ascending: true });

  if (error || !matches) return [];

  type PublicMatchRow = Pick<MatchRow, "id" | "date" | "status" | "home_team" | "away_team" | "league">;

  // Check which matches have odds (just need match_ids, not full odds)
  const matchIds = (matches as PublicMatchRow[]).map((m) => m.id);
  const { data: oddsRows } = matchIds.length
    ? await supabase
        .from("odds_snapshots")
        .select("match_id, bookmaker, market, selection, odds")
        .in("match_id", matchIds)
        .eq("market", "1X2")
    : { data: [] };

  // Group 1X2 odds by match → compute best H/D/A
  const oddsByMatch: Record<string, { home: number[]; draw: number[]; away: number[] }> = {};
  for (const o of (oddsRows || []) as { match_id: string; selection: string; odds: number }[]) {
    if (!oddsByMatch[o.match_id]) oddsByMatch[o.match_id] = { home: [], draw: [], away: [] };
    const num = Number(o.odds);
    if (o.selection === "home") oddsByMatch[o.match_id].home.push(num);
    if (o.selection === "draw") oddsByMatch[o.match_id].draw.push(num);
    if (o.selection === "away") oddsByMatch[o.match_id].away.push(num);
  }

  const matchIdsWithOdds = new Set(Object.keys(oddsByMatch));

  // Fetch signal intelligence for all matches (SUX-1/2/3)
  const signalSummary = await batchFetchSignalSummary(matchIds, todayStart);

  return (matches as PublicMatchRow[]).map((m) => {
    const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team;
    const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team;
    const league = Array.isArray(m.league) ? m.league[0] : m.league;
    const odds = oddsByMatch[m.id];
    const sig = signalSummary[m.id];

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
      bestHome: odds ? Math.max(0, ...odds.home) : 0,
      bestDraw: odds ? Math.max(0, ...odds.draw) : 0,
      bestAway: odds ? Math.max(0, ...odds.away) : 0,
      signalCount: sig?.signalCount ?? 0,
      dataGrade: sig?.dataGrade ?? null,
      pulse: sig?.pulse ?? "routine",
      teasers: sig?.teasers ?? [],
    };
  });
}

export async function getPublicMatchById(matchId: string): Promise<PublicMatch | null> {
  const supabase = createSupabasePublic();

  const { data: match, error } = await supabase
    .from("matches")
    .select(
      `id, date, status, score_home, score_away, venue_name, referee, lineups_home,
       home_team:home_team_id(id, name, country),
       away_team:away_team_id(id, name, country),
       league:league_id(id, name, country, tier)`
    )
    .eq("id", matchId)
    .single();

  if (error || !match) return null;

  type PublicMatchRow = Pick<MatchRow, "id" | "date" | "status" | "score_home" | "score_away" | "venue_name" | "referee" | "home_team" | "away_team" | "league"> & { lineups_home?: unknown };
  const m = match as PublicMatchRow;

  const { data: oddsRows } = await supabase
    .from("odds_snapshots")
    .select("match_id, selection, odds")
    .eq("match_id", matchId)
    .eq("market", "1X2");

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
    // Signal fields not fetched on detail page (handled by match detail components directly)
    signalCount: 0,
    dataGrade: null,
    pulse: "routine" as const,
    teasers: [],
    score_home: m.score_home,
    score_away: m.score_away,
    venue_name: m.venue_name,
    referee: m.referee,
    hasLineups: m.lineups_home != null,
  };
}

export async function getPublicMatchBookmakerCount(matchId: string): Promise<number> {
  const supabase = createSupabasePublic();
  const { data } = await supabase
    .from("odds_snapshots")
    .select("bookmaker")
    .eq("match_id", matchId)
    .eq("market", "1X2");

  if (!data) return 0;
  return new Set(data.map((r: { bookmaker: string }) => r.bookmaker)).size;
}

export async function getTodayOdds(): Promise<LiveMatch[]> {
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

  // Fetch odds for all today's matches
  const matchIds = matches.map((m: MatchRow) => m.id);
  const { data: oddsRows } = matchIds.length
    ? await supabase
        .from("odds_snapshots")
        .select("*")
        .in("match_id", matchIds)
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
      { home: number; draw: number; away: number; over25: number; under25: number }
    > = {};

    for (const o of matchOdds) {
      if (!operatorMap[o.bookmaker]) {
        operatorMap[o.bookmaker] = { home: 0, draw: 0, away: 0, over25: 0, under25: 0 };
      }
      if (o.market === "1X2") {
        if (o.selection === "home") operatorMap[o.bookmaker].home = Number(o.odds);
        if (o.selection === "draw") operatorMap[o.bookmaker].draw = Number(o.odds);
        if (o.selection === "away") operatorMap[o.bookmaker].away = Number(o.odds);
      }
      if (o.market === "OU25") {
        if (o.selection === "over") operatorMap[o.bookmaker].over25 = Number(o.odds);
        if (o.selection === "under") operatorMap[o.bookmaker].under25 = Number(o.odds);
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
  const supabase = await createSupabaseServer();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

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
    .order("pick_time", { ascending: false });

  if (error || !data) return [];

  return (data as SimBetRow[]).map(toBet);
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
    edge: Number(row.edge_percent) / 100, // DB stores as percentage, frontend expects decimal
    stake: Number(row.stake),
    kickoff: match?.date || "",
    placedAt: row.pick_time,
    result: row.result,
    pnl: Number(row.pnl || 0),
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

export async function getAvailableLeagues(): Promise<string[]> {
  const matches = await getTodayOdds();
  const leagues = [...new Set(matches.map((m) => m.league))];
  return leagues.sort();
}

export async function getMatchStats(matchId: string): Promise<MatchStatsData | null> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("match_stats")
    .select(
      `shots_home, shots_away, shots_on_target_home, shots_on_target_away,
       possession_home, corners_home, corners_away, xg_home, xg_away,
       shots_home_ht, shots_away_ht, possession_home_ht,
       corners_home_ht, corners_away_ht, xg_home_ht, xg_away_ht`
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
  const { data, error } = await supabase
    .from("match_injuries")
    .select("player_name, team_side, status, reason")
    .eq("match_id", matchId);

  if (error || !data) return [];

  return (data as { player_name: string; team_side: string; status: string; reason: string | null }[]).map((r) => ({
    playerName: r.player_name,
    teamSide: r.team_side as "home" | "away",
    status: r.status,
    reason: r.reason,
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
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("odds_snapshots")
    .select("timestamp, selection, odds")
    .eq("match_id", matchId)
    .eq("market", "1X2")
    .order("timestamp", { ascending: true });
  if (error || !data) return [];

  // Bucket by hour → best odds per bucket
  const byHour: Record<string, { home: number[]; draw: number[]; away: number[] }> = {};
  for (const row of data as { timestamp: string; selection: string; odds: number }[]) {
    const ts = new Date(row.timestamp);
    ts.setMinutes(0, 0, 0);
    const key = ts.toISOString();
    if (!byHour[key]) byHour[key] = { home: [], draw: [], away: [] };
    const num = Number(row.odds);
    if (row.selection === "home") byHour[key].home.push(num);
    if (row.selection === "draw") byHour[key].draw.push(num);
    if (row.selection === "away") byHour[key].away.push(num);
  }

  return Object.entries(byHour)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ts, odds]) => ({
      timestamp: ts,
      bestHome: odds.home.length ? Math.max(...odds.home) : 0,
      bestDraw: odds.draw.length ? Math.max(...odds.draw) : 0,
      bestAway: odds.away.length ? Math.max(...odds.away) : 0,
    }))
    .filter((p) => p.bestHome > 0 || p.bestDraw > 0 || p.bestAway > 0);
}
