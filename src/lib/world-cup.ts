/**
 * FIFA World Cup 2026 — data fetchers and group derivation.
 *
 * Anchors:
 *   - League: leagues.api_football_id = 1 (FIFA World Cup); UUID 108e7471-93af-42bb-81b6-841b9acfa985
 *   - Fixtures filter: filter by league_id only — DO NOT filter by season.
 *     The 72 group-stage fixtures are stored with season=2025 (football-season convention,
 *     June = previous year) so a season filter would exclude them.
 *   - Predictions slot: predictions.source = 'national_team_v1' (Phase 3 work-in-progress,
 *     not yet emitting rows). The page must render gracefully when empty.
 */

import { createSupabasePublic } from "./supabase-public";

// Tournament metadata
export const WORLD_CUP_LEAGUE_API_ID = 1;
export const WORLD_CUP_LEAGUE_UUID = "108e7471-93af-42bb-81b6-841b9acfa985";

// Phase 3 — national-team prediction source string. Engine writes to
// predictions.source (NOT model_source — column was renamed pre-launch).
export const NATIONAL_TEAM_MODEL_SOURCE = "national_team_v1";

// First match: 2026-06-11 19:00 UTC — Mexico v South Africa at Estadio Azteca
export const WC_FIRST_KICKOFF_ISO = "2026-06-11T19:00:00Z";
export const WC_LAST_DATE_ISO = "2026-07-19T23:59:59Z";

/**
 * Server-side "now" snapshot. Lives here so the React purity lint doesn't
 * flag Date.now() inside the page component (server components are async
 * and render once per request — the rule is overly cautious but easier to
 * satisfy than to suppress).
 */
export function getServerNowMs(): number {
  return Date.now();
}

export interface WCTeam {
  id: string;            // teams.id
  name: string;
  logo: string | null;
  country: string;
}

export interface WCFixture {
  id: string;
  date: string;          // ISO
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  venueName: string | null;
  home: WCTeam;
  away: WCTeam;
}

export interface WCGroup {
  label: string;         // "A" … "L"
  teams: WCTeam[];       // 4 teams
  fixtures: WCFixture[]; // 6 group fixtures (4 teams choose 2 = 6)
  standings: WCStanding[];
}

export interface WCStanding {
  team: WCTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface WCPredictionSlot {
  matchId: string;
  homeProb: number | null; // 0-1
  drawProb: number | null;
  awayProb: number | null;
  reasoning: string | null;
}

interface RawFixtureRow {
  id: string;
  date: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
  venue_name: string | null;
  home_team: { id: string; name: string; logo_url: string | null; country: string } | { id: string; name: string; logo_url: string | null; country: string }[] | null;
  away_team: { id: string; name: string; logo_url: string | null; country: string } | { id: string; name: string; logo_url: string | null; country: string }[] | null;
}

function flatten<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Fetch all FIFA World Cup 2026 fixtures (group stage today, knockout later
 * once AF seeds them).
 *
 * Filtered by:
 *   - `league.api_football_id = 1` (the World Cup league row)
 *   - `date >= 2026-06-01` (isolates the 2026 edition from historical WC
 *     2022 / WC 2018 finished matches that WC-PHASE-2 backfilled into
 *     `matches` for training the national-team model — without this date
 *     guard the page renders 2022 group standings with real results)
 *
 * Note: a `season` filter would NOT work for the 2026 edition because
 * WC group-stage fixtures land with `season=2025` under the football-
 * season convention (June = previous year). The date guard is the
 * portable filter that survives the convention.
 */
export async function getWorldCupFixtures(): Promise<WCFixture[]> {
  const supabase = createSupabasePublic();

  const { data, error } = await supabase
    .from("matches")
    .select(
      `id, date, status, score_home, score_away, venue_name,
       home_team:home_team_id(id, name, logo_url, country),
       away_team:away_team_id(id, name, logo_url, country),
       league:league_id!inner(api_football_id)`
    )
    .eq("league.api_football_id", WORLD_CUP_LEAGUE_API_ID)
    .gte("date", "2026-06-01")
    .order("date", { ascending: true })
    .limit(200);

  if (error || !data) return [];

  return (data as RawFixtureRow[])
    .map((m): WCFixture | null => {
      const h = flatten(m.home_team);
      const a = flatten(m.away_team);
      if (!h || !a) return null;
      return {
        id: m.id,
        date: m.date,
        status: m.status,
        scoreHome: m.score_home,
        scoreAway: m.score_away,
        venueName: m.venue_name,
        home: { id: h.id, name: h.name, logo: h.logo_url, country: h.country },
        away: { id: a.id, name: a.name, logo: a.logo_url, country: a.country },
      };
    })
    .filter((f): f is WCFixture => f !== null);
}

/**
 * Derive groups from fixture pairings. WC group stage: each team plays exactly
 * 3 matches against 3 other teams (the other 3 in its group). The set of
 * connected teams via group-stage matches forms exactly 12 components of size 4.
 *
 * Implementation: union-find. Labels assigned A-L in order of first fixture
 * kickoff per group.
 */
export function deriveGroups(fixtures: WCFixture[]): WCGroup[] {
  // Group-stage fixtures only — knockout fixtures (when they land) shouldn't
  // be clustered. WC convention: group-stage IDs precede knockout in AF.
  // Heuristic: only fixtures dated on/before 2026-06-28 (group stage ends ~27th).
  const GROUP_STAGE_CUTOFF = new Date("2026-06-29T00:00:00Z").getTime();
  const groupFixtures = fixtures.filter(
    (f) => new Date(f.date).getTime() < GROUP_STAGE_CUTOFF
  );

  if (groupFixtures.length === 0) return [];

  // Union-find by team id
  const parent: Record<string, string> = {};
  const find = (start: string): string => {
    let x = start;
    while (parent[x] && parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return parent[x] ?? x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const allTeams = new Map<string, WCTeam>();
  for (const f of groupFixtures) {
    if (!parent[f.home.id]) parent[f.home.id] = f.home.id;
    if (!parent[f.away.id]) parent[f.away.id] = f.away.id;
    allTeams.set(f.home.id, f.home);
    allTeams.set(f.away.id, f.away);
    union(f.home.id, f.away.id);
  }

  // Bucket teams by root
  const teamsByRoot = new Map<string, WCTeam[]>();
  for (const [id, team] of allTeams.entries()) {
    const root = find(id);
    if (!teamsByRoot.has(root)) teamsByRoot.set(root, []);
    teamsByRoot.get(root)!.push(team);
  }

  // Bucket fixtures by root
  const fixturesByRoot = new Map<string, WCFixture[]>();
  for (const f of groupFixtures) {
    const root = find(f.home.id);
    if (!fixturesByRoot.has(root)) fixturesByRoot.set(root, []);
    fixturesByRoot.get(root)!.push(f);
  }

  // Order groups by earliest fixture kickoff → label A..L
  const roots = Array.from(teamsByRoot.keys());
  roots.sort((a, b) => {
    const fa = fixturesByRoot.get(a) ?? [];
    const fb = fixturesByRoot.get(b) ?? [];
    const minA = fa.reduce(
      (m, f) => Math.min(m, new Date(f.date).getTime()),
      Number.POSITIVE_INFINITY
    );
    const minB = fb.reduce(
      (m, f) => Math.min(m, new Date(f.date).getTime()),
      Number.POSITIVE_INFINITY
    );
    return minA - minB;
  });

  const ALPHA = "ABCDEFGHIJKL";

  return roots.map((root, idx) => {
    const teams = (teamsByRoot.get(root) ?? []).slice().sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const groupFx = (fixturesByRoot.get(root) ?? []).slice().sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    return {
      label: ALPHA[idx] ?? `G${idx + 1}`,
      teams,
      fixtures: groupFx,
      standings: computeStandings(teams, groupFx),
    };
  });
}

function emptyStanding(team: WCTeam): WCStanding {
  return {
    team, played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
  };
}

function applyResult(h: WCStanding, a: WCStanding, sh: number, sa: number): void {
  h.played += 1; a.played += 1;
  h.goalsFor += sh; h.goalsAgainst += sa;
  a.goalsFor += sa; a.goalsAgainst += sh;
  if (sh > sa) { h.wins += 1; h.points += 3; a.losses += 1; }
  else if (sh < sa) { a.wins += 1; a.points += 3; h.losses += 1; }
  else { h.draws += 1; a.draws += 1; h.points += 1; a.points += 1; }
}

/**
 * Compute pre-tournament / live standings from finished fixtures only.
 * Returns 4 rows (one per team), pre-populated with zeros if no results yet.
 */
export function computeStandings(
  teams: WCTeam[],
  fixtures: WCFixture[]
): WCStanding[] {
  const stats: Record<string, WCStanding> = {};
  for (const t of teams) stats[t.id] = emptyStanding(t);

  for (const f of fixtures) {
    if (f.status !== "finished") continue;
    if (f.scoreHome == null || f.scoreAway == null) continue;
    const h = stats[f.home.id];
    const a = stats[f.away.id];
    if (!h || !a) continue;
    applyResult(h, a, f.scoreHome, f.scoreAway);
  }

  for (const id in stats) {
    stats[id].goalDiff = stats[id].goalsFor - stats[id].goalsAgainst;
  }

  return Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.name.localeCompare(b.team.name);
  });
}

/**
 * Fetch national-team predictions for a set of match IDs. Phase 3 (in progress)
 * writes rows with source='national_team_v1'. Returns empty array today; the
 * UI uses each row to populate the matching fixture slot.
 *
 * Market filter: '1x2' so we get one row per match (home/draw/away percent).
 * Once Phase 3 lands, schema confirms predictions store ONE row per (match, market, source)
 * with model_probability storing... [TBD per Phase 3 design — might be flattened
 * to per-selection rows or kept as a JSON probability vector in reasoning].
 *
 * For v1, treat reasoning text as optional and only render probabilities when
 * the row's columns are populated as expected.
 */
export async function getWorldCupPredictions(
  matchIds: string[]
): Promise<Record<string, WCPredictionSlot>> {
  if (matchIds.length === 0) return {};

  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("predictions")
    .select("match_id, market, model_probability, reasoning")
    .eq("source", NATIONAL_TEAM_MODEL_SOURCE)
    .in("match_id", matchIds);

  if (error || !data) return {};

  // Aggregate by match_id. Phase 3 may write either:
  //  (a) one row per selection — market='1x2:home','1x2:draw','1x2:away'
  //  (b) one row per market — market='1x2' with all probs in a JSON field
  // Build a tolerant aggregator: collect anything that looks like a selection.
  const byMatch: Record<string, WCPredictionSlot> = {};
  for (const row of data as PredictionRow[]) {
    mergePredictionRow(byMatch, row);
  }
  return byMatch;
}

interface PredictionRow {
  match_id: string;
  market: string;
  model_probability: number | null;
  reasoning: string | null;
}

function mergePredictionRow(
  byMatch: Record<string, WCPredictionSlot>,
  row: PredictionRow
): void {
  const slot = byMatch[row.match_id] ?? {
    matchId: row.match_id,
    homeProb: null,
    drawProb: null,
    awayProb: null,
    reasoning: null,
  };
  byMatch[row.match_id] = slot;

  const m = row.market.toLowerCase();
  if (m.endsWith(":home") || m === "home") slot.homeProb = row.model_probability;
  else if (m.endsWith(":draw") || m === "draw") slot.drawProb = row.model_probability;
  else if (m.endsWith(":away") || m === "away") slot.awayProb = row.model_probability;
  if (row.reasoning && !slot.reasoning) slot.reasoning = row.reasoning;
}

// ─── Featured match-of-the-day ───────────────────────────────────────────────

/**
 * Pick the next scheduled WC fixture within the next 48 hours. Used by the
 * sticky banner above the hero. Returns null when no match is upcoming (e.g.
 * between the group stage and the R32).
 */
export function pickFeaturedFixture(
  fixtures: WCFixture[],
  nowMs: number
): WCFixture | null {
  const horizonMs = nowMs + 48 * 3600 * 1000;
  const upcoming = fixtures
    .filter((f) => {
      const t = new Date(f.date).getTime();
      return t >= nowMs && t <= horizonMs && f.status !== "finished";
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (upcoming.length === 0) {
    const live = fixtures.find(
      (f) => f.status === "live" || f.status === "1h" || f.status === "2h" || f.status === "ht"
    );
    return live ?? null;
  }
  return upcoming[0] ?? null;
}

// ─── International ELO (PHASE-3 ingest target) ───────────────────────────────

/**
 * Pull the latest ELO rating per team from `team_elo_international`. Populated
 * by `scripts/compute_international_elo.py` once Phase 3 ships — until then,
 * returns an empty map and the advancement Monte Carlo gracefully degrades.
 */
export async function getInternationalElos(
  teamIds: string[]
): Promise<Record<string, number>> {
  if (teamIds.length === 0) return {};

  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("team_elo_international")
    .select("team_id, elo_rating, match_date")
    .in("team_id", teamIds)
    .order("match_date", { ascending: false })
    .limit(2000);

  if (error || !data) return {};

  const latest: Record<string, number> = {};
  for (const row of data as Array<{ team_id: string; elo_rating: string | number }>) {
    if (latest[row.team_id] != null) continue;
    latest[row.team_id] =
      typeof row.elo_rating === "string" ? parseFloat(row.elo_rating) : row.elo_rating;
  }
  return latest;
}

// ─── Advancement probability (Monte Carlo, group stage) ──────────────────────

export interface GroupAdvancementProb {
  teamId: string;
  pAdvance: number;
  pWinner: number;
  pRunnerUp: number;
  pBestThird: number;
}

/**
 * ELO-based 1X2 helper used when Phase 3 predictions aren't present. Logistic
 * on rating_diff/400, softened by 1.3 to stretch the win/loss tail and leave
 * room for a 0.30 draw mass. WC matches are neutral venues so no home bonus.
 */
function eloOneXTwo(
  eloHome: number,
  eloAway: number,
  drawBase = 0.30,
  softening = 1.3
): { home: number; draw: number; away: number } {
  const diff = (eloHome - eloAway) / 400;
  const rawHome = 1 / (1 + Math.pow(10, -diff / softening));
  const rawAway = 1 - rawHome;
  const remaining = 1 - drawBase;
  return {
    home: rawHome * remaining,
    draw: drawBase,
    away: rawAway * remaining,
  };
}

/**
 * Per-fixture 1X2 probability — prefers national_team_v1 predictions when
 * present, falls back to ELO, finally falls back to a neutral 0.34/0.32/0.34
 * sentinel so the sim always produces *some* number.
 */
function fixtureProbs(
  fixture: WCFixture,
  predictions: Record<string, WCPredictionSlot>,
  elos: Record<string, number>
): { home: number; draw: number; away: number } {
  const p = predictions[fixture.id];
  if (p?.homeProb != null && p.drawProb != null && p.awayProb != null) {
    const total = p.homeProb + p.drawProb + p.awayProb;
    if (total > 0) {
      return { home: p.homeProb / total, draw: p.drawProb / total, away: p.awayProb / total };
    }
  }
  const eh = elos[fixture.home.id];
  const ea = elos[fixture.away.id];
  if (eh != null && ea != null) return eloOneXTwo(eh, ea);
  return { home: 0.34, draw: 0.32, away: 0.34 };
}

function sampleResult(probs: { home: number; draw: number; away: number }): {
  hPts: number;
  aPts: number;
} {
  const r = Math.random();
  if (r < probs.home) return { hPts: 3, aPts: 0 };
  if (r < probs.home + probs.draw) return { hPts: 1, aPts: 1 };
  return { hPts: 0, aPts: 3 };
}

export interface GroupSimSummary {
  byTeam: Record<string, GroupAdvancementProb>;
  thirdPlacePointsDistribution: Record<string, number[]>;
}

export function simulateGroup(
  group: WCGroup,
  predictions: Record<string, WCPredictionSlot>,
  elos: Record<string, number>,
  iterations = 10_000
): GroupSimSummary {
  const teamIds = group.teams.map((t) => t.id);
  const baseStats: Record<string, { pts: number; gd: number; gf: number }> = {};
  for (const s of group.standings) {
    baseStats[s.team.id] = { pts: s.points, gd: s.goalDiff, gf: s.goalsFor };
  }
  const unfinished = group.fixtures.filter((f) => f.status !== "finished");

  const winnerCount: Record<string, number> = {};
  const runnerCount: Record<string, number> = {};
  const thirdCount: Record<string, number> = {};
  const thirdPointsSamples: Record<string, number[]> = {};
  for (const id of teamIds) {
    winnerCount[id] = 0;
    runnerCount[id] = 0;
    thirdCount[id] = 0;
    thirdPointsSamples[id] = [];
  }

  for (let iter = 0; iter < iterations; iter += 1) {
    const stats: Record<string, { pts: number; gd: number; gf: number }> = {};
    for (const id of teamIds) stats[id] = { ...baseStats[id] };

    for (const f of unfinished) {
      const probs = fixtureProbs(f, predictions, elos);
      const { hPts, aPts } = sampleResult(probs);
      stats[f.home.id].pts += hPts;
      stats[f.away.id].pts += aPts;
      const gdSurrogate = hPts === 3 ? 1 : hPts === 0 ? -1 : 0;
      stats[f.home.id].gd += gdSurrogate;
      stats[f.away.id].gd -= gdSurrogate;
    }
    const ranked = teamIds.slice().sort((a, b) => {
      const sa = stats[a];
      const sb = stats[b];
      if (sb.pts !== sa.pts) return sb.pts - sa.pts;
      if (sb.gd !== sa.gd) return sb.gd - sa.gd;
      if (sb.gf !== sa.gf) return sb.gf - sa.gf;
      return Math.random() - 0.5;
    });
    winnerCount[ranked[0]] += 1;
    runnerCount[ranked[1]] += 1;
    thirdCount[ranked[2]] += 1;
    thirdPointsSamples[ranked[2]].push(stats[ranked[2]].pts);
  }

  const byTeam: Record<string, GroupAdvancementProb> = {};
  for (const id of teamIds) {
    const pWinner = winnerCount[id] / iterations;
    const pRunnerUp = runnerCount[id] / iterations;
    byTeam[id] = {
      teamId: id,
      pAdvance: pWinner + pRunnerUp,
      pWinner,
      pRunnerUp,
      pBestThird: 0,
    };
  }
  return { byTeam, thirdPlacePointsDistribution: thirdPointsSamples };
}

/**
 * Cross-group pass — approximates "best 8 of 12 third-place" via the mean
 * points achieved when each team finishes 3rd. A full correlated simulation
 * needs iteration-aligned samples across all 12 groups; v1 uses an empirical
 * rule (≥4 mean pts when 3rd => stronger advance signal). Good enough for UI;
 * Phase 3 backend will replace with a proper joint sim.
 */
export function computeAdvancement(
  groups: WCGroup[],
  predictions: Record<string, WCPredictionSlot>,
  elos: Record<string, number>,
  iterations = 10_000
): Record<string, GroupAdvancementProb> {
  const out: Record<string, GroupAdvancementProb> = {};
  const groupSims = groups.map((g) => ({ group: g, sim: simulateGroup(g, predictions, elos, iterations) }));
  const ADV_VIA_THIRD_RATE = 0.45;

  for (const { sim } of groupSims) {
    for (const id of Object.keys(sim.byTeam)) {
      const tp = sim.thirdPlacePointsDistribution[id] ?? [];
      const pFinish3rd = tp.length / iterations;
      const meanPts = tp.length > 0 ? tp.reduce((a, b) => a + b, 0) / tp.length : 0;
      const pAdvanceAsThird = pFinish3rd * (meanPts >= 4 ? ADV_VIA_THIRD_RATE * 1.5 : ADV_VIA_THIRD_RATE);
      const base = sim.byTeam[id];
      out[id] = {
        ...base,
        pBestThird: Math.min(pAdvanceAsThird, 1),
        pAdvance: Math.min(base.pWinner + base.pRunnerUp + pAdvanceAsThird, 1),
      };
    }
  }
  return out;
}
