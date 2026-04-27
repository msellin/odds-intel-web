import fs from "fs";
import path from "path";

const ENGINE_DATA_DIR = path.join(
  process.cwd(),
  "..",
  "odds-intel-engine",
  "data",
  "daily"
);

// ─── Raw types matching the engine's JSON output ────────────────────────────

export interface RawOddsMatch {
  home_team: string;
  away_team: string;
  start_time: string;
  league_path: string;
  league_code: string;
  tier: number;
  operator: string;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  odds_over_25: number;
  odds_under_25: number;
  scraped_at: string;
  operators: Record<
    string,
    {
      home: number;
      draw: number;
      away: number;
      over_25: number;
      under_25: number;
    }
  >;
}

export interface RawBet {
  bot: string;
  match: string;
  league: string;
  tier: number;
  market: string;
  selection: string;
  odds: number;
  model_prob: number;
  implied_prob: number;
  edge: number;
  stake: number;
  kickoff: string;
  placed_at: string;
  result: "pending" | "won" | "lost" | "void";
  pnl: number;
}

// ─── Transformed types for the frontend ─────────────────────────────────────

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

// ─── Helper: parse league_path into sport + league ──────────────────────────

function parseSport(leaguePath: string): string {
  // All current data is football. Future: "Tennis / WTA", "Esports / CS2"
  return "Football";
}

function parseLeagueName(leaguePath: string): string {
  return leaguePath; // Keep full path like "England / Premier League"
}

// ─── Data loading functions ─────────────────────────────────────────────────

function getDateString(date?: Date): string {
  const d = date || new Date();
  return d.toISOString().split("T")[0];
}

function readJsonFile<T>(filename: string): T | null {
  const filePath = path.join(ENGINE_DATA_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function generateMatchId(m: RawOddsMatch): string {
  // Deterministic ID from teams + date
  const dateStr = m.start_time.split("T")[0];
  const slug = `${m.home_team}-${m.away_team}-${dateStr}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return slug;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function getTodayOdds(date?: Date): LiveMatch[] {
  const dateStr = getDateString(date);
  const raw = readJsonFile<RawOddsMatch[]>(`odds_${dateStr}.json`);
  if (!raw) return [];

  return raw.map((m) => {
    const operators = Object.entries(m.operators).map(([name, odds]) => ({
      operator: name,
      home: odds.home,
      draw: odds.draw,
      away: odds.away,
      over25: odds.over_25,
      under25: odds.under_25,
    }));

    const validHome = operators.filter((o) => o.home > 0);
    const validDraw = operators.filter((o) => o.draw > 0);
    const validAway = operators.filter((o) => o.away > 0);

    return {
      id: generateMatchId(m),
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      kickoff: m.start_time,
      league: parseLeagueName(m.league_path),
      leagueCode: m.league_code,
      sport: parseSport(m.league_path),
      tier: m.tier,
      odds: operators,
      bestHome: validHome.length
        ? Math.max(...validHome.map((o) => o.home))
        : 0,
      bestDraw: validDraw.length
        ? Math.max(...validDraw.map((o) => o.draw))
        : 0,
      bestAway: validAway.length
        ? Math.max(...validAway.map((o) => o.away))
        : 0,
      scrapedAt: m.scraped_at,
    };
  });
}

export function getTodayBets(date?: Date): LiveBet[] {
  const dateStr = getDateString(date);
  const raw = readJsonFile<RawBet[]>(`bets_${dateStr}.json`);
  if (!raw) return [];

  return raw.map((b, i) => ({
    id: `bet-${dateStr}-${i}`,
    bot: b.bot,
    match: b.match,
    league: b.league,
    tier: b.tier,
    market: b.market,
    selection: b.selection,
    odds: b.odds,
    modelProb: b.model_prob,
    impliedProb: b.implied_prob,
    edge: b.edge,
    stake: b.stake,
    kickoff: b.kickoff,
    placedAt: b.placed_at,
    result: b.result,
    pnl: b.pnl,
  }));
}

export function getAllBets(): LiveBet[] {
  // Read all bet files across all dates
  try {
    const files = fs.readdirSync(ENGINE_DATA_DIR);
    const betFiles = files
      .filter((f) => f.startsWith("bets_") && f.endsWith(".json"))
      .sort();

    const allBets: LiveBet[] = [];
    for (const file of betFiles) {
      const dateStr = file.replace("bets_", "").replace(".json", "");
      const raw = readJsonFile<RawBet[]>(file);
      if (raw) {
        raw.forEach((b, i) => {
          allBets.push({
            id: `bet-${dateStr}-${i}`,
            bot: b.bot,
            match: b.match,
            league: b.league,
            tier: b.tier,
            market: b.market,
            selection: b.selection,
            odds: b.odds,
            modelProb: b.model_prob,
            impliedProb: b.implied_prob,
            edge: b.edge,
            stake: b.stake,
            kickoff: b.kickoff,
            placedAt: b.placed_at,
            result: b.result,
            pnl: b.pnl,
          });
        });
      }
    }
    return allBets;
  } catch {
    return [];
  }
}

export function getMatchById(matchId: string, date?: Date): LiveMatch | null {
  const matches = getTodayOdds(date);
  return matches.find((m) => m.id === matchId) || null;
}

export function getAvailableLeagues(date?: Date): string[] {
  const matches = getTodayOdds(date);
  const leagues = [...new Set(matches.map((m) => m.league))];
  return leagues.sort();
}

export function getAvailableDates(): string[] {
  try {
    const files = fs.readdirSync(ENGINE_DATA_DIR);
    return files
      .filter((f) => f.startsWith("odds_") && f.endsWith(".json"))
      .map((f) => f.replace("odds_", "").replace(".json", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
