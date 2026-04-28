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

export interface MatchStatsData {
  shots_home: number | null;
  shots_away: number | null;
  shots_on_target_home: number | null;
  shots_on_target_away: number | null;
  possession_home: number | null;
  corners_home: number | null;
  corners_away: number | null;
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

  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `id, date, status,
       home_team:home_team_id(id, name, country),
       away_team:away_team_id(id, name, country),
       league:league_id(id, name, country, tier)`
    )
    .gte("date", todayStart.toISOString())
    .lte("date", todayEnd.toISOString())
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

  return (matches as PublicMatchRow[]).map((m) => {
    const homeTeam = Array.isArray(m.home_team) ? m.home_team[0] : m.home_team;
    const awayTeam = Array.isArray(m.away_team) ? m.away_team[0] : m.away_team;
    const league = Array.isArray(m.league) ? m.league[0] : m.league;
    const odds = oddsByMatch[m.id];

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
      "shots_home, shots_away, shots_on_target_home, shots_on_target_away, possession_home, corners_home, corners_away"
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
    .select("team_name, rank, points, played, wins, draws, losses, goals_for, goals_against, form")
    .in("team_name", [homeTeam, awayTeam])
    .order("fetched_date", { ascending: false });

  if (error || !data) return { home: null, away: null };

  type Row = {
    team_name: string;
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
