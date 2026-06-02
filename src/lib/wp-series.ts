/**
 * Build the (minute, homeProb, drawProb, awayProb) series used by the
 * win-probability chart.
 *
 * Sources:
 *   - `live_match_snapshots` — score + minute samples (30/60s during live)
 *   - `team_elo_daily` + `team_elo_international` — for the scoring-rate split
 *   - `predictions` (ensemble) — pre-match 1X2 priors; falls back to ELO
 *
 * The series is anchored by two implicit points:
 *   - minute 0      → pre-match priors (or ELO fallback)
 *   - current minute → live computeWP result
 *
 * Between them we sample every unique snapshot minute (one curve point per
 * minute, deduplicated by keeping the *latest* snapshot for each minute —
 * the live poller can fire multiple times per minute when an event happens).
 *
 * For finished matches we draw the whole curve from historical snapshots.
 */

import { createSupabasePublic } from "@/lib/supabase-public";
import { computeWP, eloFallbackPriors, type WPInput } from "@/lib/win-probability";

/**
 * Look up the team IDs + league country for a match. Used by buildWPSeries to
 * resolve the right ELO table without making the caller plumb team_ids through
 * PublicMatch.
 */
export async function fetchMatchTeamMeta(matchId: string): Promise<{
  homeTeamId: string;
  awayTeamId: string;
  competition: "club" | "international";
} | null> {
  const supabase = createSupabasePublic();
  const { data, error } = await supabase
    .from("matches")
    .select(`home_team_id, away_team_id, league:league_id(country)`)
    .eq("id", matchId)
    .single();
  if (error || !data) return null;
  const row = data as {
    home_team_id: string;
    away_team_id: string;
    league: { country: string | null } | { country: string | null }[] | null;
  };
  const league = Array.isArray(row.league) ? row.league[0] : row.league;
  const competition: "club" | "international" =
    (league?.country ?? "").toLowerCase() === "world" ? "international" : "club";
  return {
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    competition,
  };
}

export interface WPSeriesPoint {
  /** Match minute, 0..90 (clamped). */
  minute: number;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  scoreHome: number;
  scoreAway: number;
}

export interface WPSeriesInputs {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** "scheduled" | "live" | "finished" — same shape as PublicMatch.status. */
  status: string;
  /** Latest score (used for the trailing curve point on live matches). */
  scoreHome: number | null;
  scoreAway: number | null;
  /** Latest match minute (used for the trailing curve point on live matches). */
  minute: number | null;
  /** Ensemble model probabilities, 0-100 scale. May be null if no prediction. */
  modelHome: number | null;
  modelDraw: number | null;
  modelAway: number | null;
  /** "club" | "international" — which ELO table to read. */
  competition: "club" | "international";
}

interface SnapshotRow {
  score_home: number;
  score_away: number;
  minute: number;
  captured_at: string;
}

/**
 * Look up the latest ELO for both teams. Tries the appropriate table based on
 * the competition kind; falls back to 1500 (neutral) if a team has no rating.
 */
async function fetchElos(
  homeTeamId: string,
  awayTeamId: string,
  competition: "club" | "international"
): Promise<{ homeElo: number; awayElo: number }> {
  const supabase = createSupabasePublic();
  const table = competition === "international" ? "team_elo_international" : "team_elo_daily";
  // both tables share the same shape: (team_id, elo_rating, <date column>)
  const dateCol = competition === "international" ? "match_date" : "date";

  const { data } = await supabase
    .from(table)
    .select(`team_id, elo_rating, ${dateCol}`)
    .in("team_id", [homeTeamId, awayTeamId])
    .order(dateCol, { ascending: false })
    .limit(200);

  const latest: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ team_id: string; elo_rating: number | string }>) {
    if (latest[row.team_id] != null) continue;
    latest[row.team_id] =
      typeof row.elo_rating === "string" ? parseFloat(row.elo_rating) : row.elo_rating;
  }
  return {
    homeElo: latest[homeTeamId] ?? 1500,
    awayElo: latest[awayTeamId] ?? 1500,
  };
}

/**
 * Resolve the pre-match 1X2 priors. Order of preference:
 *   1. ensemble `predictions` row (passed in via `modelHome/Draw/Away`)
 *   2. ELO-derived fallback
 */
function resolvePriors(inputs: WPSeriesInputs, elos: { homeElo: number; awayElo: number }) {
  if (
    inputs.modelHome != null &&
    inputs.modelDraw != null &&
    inputs.modelAway != null
  ) {
    const total = inputs.modelHome + inputs.modelDraw + inputs.modelAway;
    if (total > 0) {
      return {
        home: inputs.modelHome / total,
        draw: inputs.modelDraw / total,
        away: inputs.modelAway / total,
      };
    }
  }
  return eloFallbackPriors(elos.homeElo, elos.awayElo);
}

/**
 * Deduplicate snapshots: keep the *latest* (highest captured_at) row per
 * minute, then sort ascending by minute.
 */
function dedupeByMinute(rows: SnapshotRow[]): SnapshotRow[] {
  // Rows arrive ordered by captured_at DESC, so the first row we see for
  // each minute is the freshest one.
  const seen = new Set<number>();
  const picked: SnapshotRow[] = [];
  for (const r of rows) {
    if (seen.has(r.minute)) continue;
    seen.add(r.minute);
    picked.push(r);
  }
  picked.sort((a, b) => a.minute - b.minute);
  return picked;
}

export async function buildWPSeries(inputs: WPSeriesInputs): Promise<{
  series: WPSeriesPoint[];
  current: WPSeriesPoint | null;
  preMatch: WPSeriesPoint;
}> {
  const supabase = createSupabasePublic();

  const [{ data: snapData }, elos] = await Promise.all([
    supabase
      .from("live_match_snapshots")
      .select("score_home, score_away, minute, captured_at")
      .eq("match_id", inputs.matchId)
      .order("captured_at", { ascending: false })
      .limit(500),
    fetchElos(inputs.homeTeamId, inputs.awayTeamId, inputs.competition),
  ]);

  const priors = resolvePriors(inputs, elos);

  // Pre-match anchor — always present.
  const preMatch: WPSeriesPoint = {
    minute: 0,
    homeProb: priors.home,
    drawProb: priors.draw,
    awayProb: priors.away,
    scoreHome: 0,
    scoreAway: 0,
  };

  const baseWPInput: Omit<WPInput, "scoreHome" | "scoreAway" | "minute" | "isLive"> = {
    homeElo: elos.homeElo,
    awayElo: elos.awayElo,
    homePreMatchProb: priors.home,
    drawPreMatchProb: priors.draw,
    awayPreMatchProb: priors.away,
  };

  const snaps = dedupeByMinute((snapData ?? []) as SnapshotRow[]);

  const series: WPSeriesPoint[] = [preMatch];
  for (const s of snaps) {
    const wp = computeWP({
      ...baseWPInput,
      scoreHome: s.score_home,
      scoreAway: s.score_away,
      minute: s.minute,
      isLive: true,
    });
    series.push({
      minute: Math.min(s.minute, 90),
      homeProb: wp.homeProb,
      drawProb: wp.drawProb,
      awayProb: wp.awayProb,
      scoreHome: s.score_home,
      scoreAway: s.score_away,
    });
  }

  // If we have a live trailing minute that doesn't match the latest snapshot
  // (e.g. score updated but no snapshot yet), append a synthetic "current"
  // point so the curve runs all the way to the right edge.
  let current: WPSeriesPoint | null = null;
  if (inputs.status === "live" && inputs.minute != null) {
    const scoreH = inputs.scoreHome ?? snaps[snaps.length - 1]?.score_home ?? 0;
    const scoreA = inputs.scoreAway ?? snaps[snaps.length - 1]?.score_away ?? 0;
    const wp = computeWP({
      ...baseWPInput,
      scoreHome: scoreH,
      scoreAway: scoreA,
      minute: inputs.minute,
      isLive: true,
    });
    current = {
      minute: Math.min(inputs.minute, 90),
      homeProb: wp.homeProb,
      drawProb: wp.drawProb,
      awayProb: wp.awayProb,
      scoreHome: scoreH,
      scoreAway: scoreA,
    };
    // Don't duplicate the last snapshot if it's already at the same minute.
    const last = series[series.length - 1];
    if (!last || last.minute !== current.minute) {
      series.push(current);
    }
  }

  // For finished matches add a FT anchor (minute 90 with the final score) so
  // the curve ends at 0/100/0.
  if (inputs.status === "finished" && inputs.scoreHome != null && inputs.scoreAway != null) {
    const wp = computeWP({
      ...baseWPInput,
      scoreHome: inputs.scoreHome,
      scoreAway: inputs.scoreAway,
      minute: 90,
      isLive: true,
    });
    const ftPoint: WPSeriesPoint = {
      minute: 90,
      homeProb: wp.homeProb,
      drawProb: wp.drawProb,
      awayProb: wp.awayProb,
      scoreHome: inputs.scoreHome,
      scoreAway: inputs.scoreAway,
    };
    series.push(ftPoint);
    current = ftPoint;
  }

  return { series, current, preMatch };
}
