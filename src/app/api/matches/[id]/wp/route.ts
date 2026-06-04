/**
 * GET /api/matches/[id]/wp
 *
 * Live in-play win-probability endpoint. Returns the current WP based on the
 * latest live snapshot for a match.
 *
 * No auth/tier gating — the WP pill is a free-tier feature. The full chart
 * (with event annotations) is gated client-side via the `isPro` prop on
 * <WinProbabilityChart />.
 *
 * Response shape:
 *   {
 *     minute, homeProb, drawProb, awayProb,
 *     scoreHome, scoreAway,
 *     serverNow   // ISO timestamp, used by clients to detect stale polling
 *   }
 *
 * Performance target: ≤50ms end-to-end (one Supabase round-trip + computeWP).
 */

import { NextResponse } from "next/server";
import { createSupabasePublic } from "@/lib/supabase-public";
import { computeWP, eloFallbackPriors } from "@/lib/win-probability";
import { WORLD_CUP_LEAGUE_API_ID } from "@/lib/world-cup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

interface MatchTeamRow {
  status: string;
  score_home: number | null;
  score_away: number | null;
  home_team_id: string;
  away_team_id: string;
  // `league` is returned as either an object or a single-element array depending
  // on whether PostgREST treats the FK as a 1:1 or 1:N join. We normalise below.
  league:
    | { country: string | null; api_football_id: number | null }
    | { country: string | null; api_football_id: number | null }[]
    | null;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  const supabase = createSupabasePublic();

  // First fetch: match + league. We need the league.api_football_id to decide
  // between the club path (live_match_snapshots + team_elo_daily) and the WC
  // path (live_xg_snapshots + team_elo_international). Doing this before the
  // parallel snapshot read keeps the WC branch from issuing a wasted query
  // against the club snapshot table.
  const { data: matchData, error: matchErr } = await supabase
    .from("matches")
    .select(
      `status, score_home, score_away, home_team_id, away_team_id,
       league:league_id(country, api_football_id)`
    )
    .eq("id", id)
    .single();

  if (matchErr || !matchData) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const match = matchData as MatchTeamRow;
  const league = Array.isArray(match.league) ? match.league[0] : match.league;
  // WC2026 fixtures live under api_football_id=1 (FIFA World Cup). For any
  // international league we'd still want team_elo_international, but the WC
  // path is the only one that reads from live_xg_snapshots — that table is
  // populated only by the WC live-xg poller (workers/jobs/wc_live_xg_poller.py).
  const isWorldCup = league?.api_football_id === WORLD_CUP_LEAGUE_API_ID;
  const competition: "club" | "international" =
    isWorldCup || (league?.country ?? "").toLowerCase() === "world"
      ? "international"
      : "club";

  // Now fan out — pick the snapshot table per the WC flag.
  const snapTable = isWorldCup ? "live_xg_snapshots" : "live_match_snapshots";
  const [snapRes, predRes] = await Promise.all([
    // live_xg_snapshots does not carry score columns (D2 schema only stores
    // xg + shots + possession). For WC we still need a score — fall back to
    // matches.score_home/score_away below.
    supabase
      .from(snapTable)
      .select(
        isWorldCup
          ? "minute, captured_at"
          : "score_home, score_away, minute, captured_at"
      )
      .eq("match_id", id)
      .order("captured_at", { ascending: false })
      .limit(1),
    supabase
      .from("predictions")
      .select("source, market, model_probability")
      .eq("match_id", id),
  ]);

  // ELO lookup (fall back to 1500 if missing).
  const eloTable = competition === "international" ? "team_elo_international" : "team_elo_daily";
  const dateCol = competition === "international" ? "match_date" : "date";
  const { data: eloRows } = await supabase
    .from(eloTable)
    .select(`team_id, elo_rating, ${dateCol}`)
    .in("team_id", [match.home_team_id, match.away_team_id])
    .order(dateCol, { ascending: false })
    .limit(200);

  const latestElo: Record<string, number> = {};
  for (const row of (eloRows ?? []) as Array<{ team_id: string; elo_rating: number | string }>) {
    if (latestElo[row.team_id] != null) continue;
    latestElo[row.team_id] =
      typeof row.elo_rating === "string" ? parseFloat(row.elo_rating) : row.elo_rating;
  }
  const homeElo = latestElo[match.home_team_id] ?? 1500;
  const awayElo = latestElo[match.away_team_id] ?? 1500;

  // Pre-match priors — prefer ensemble; otherwise national-team model; otherwise ELO.
  let homePrior: number | null = null;
  let drawPrior: number | null = null;
  let awayPrior: number | null = null;
  const sourcePriority = ["ensemble", "national_team_v1", "xgboost", "poisson", "af"];
  for (const src of sourcePriority) {
    const rows = (predRes.data ?? []).filter(
      (p: { source: string }) => p.source === src
    ) as Array<{ source: string; market: string; model_probability: number }>;
    if (rows.length === 0) continue;
    for (const p of rows) {
      const val = Number(p.model_probability);
      if (p.market === "1x2_home") homePrior = val;
      else if (p.market === "1x2_draw") drawPrior = val;
      else if (p.market === "1x2_away") awayPrior = val;
    }
    if (homePrior != null && drawPrior != null && awayPrior != null) break;
    // Reset partials before trying the next source.
    homePrior = drawPrior = awayPrior = null;
  }
  if (homePrior == null || drawPrior == null || awayPrior == null) {
    const fb = eloFallbackPriors(homeElo, awayElo);
    homePrior = fb.home;
    drawPrior = fb.draw;
    awayPrior = fb.away;
  }

  // Pick the latest snapshot (or fall back to match.score_* / status).
  // For club matches the snapshot table carries scores; for WC it doesn't,
  // so we fall back to the canonical scoreline on `matches`. The select
  // string is built conditionally above, so the typed-result inference is
  // unreliable here — cast via unknown to the union shape we know we get.
  const snapRow = ((snapRes.data ?? []) as unknown as Array<{
    score_home?: number;
    score_away?: number;
    minute: number;
    captured_at: string;
  }>)[0];

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  // Minute / score resolution.
  let minute = 0;
  let scoreHome = match.score_home ?? 0;
  let scoreAway = match.score_away ?? 0;
  if (isFinished) {
    minute = 90;
  } else if (snapRow) {
    minute = snapRow.minute;
    // For club matches the snapshot row has its own (per-tick) score; for WC
    // (live_xg_snapshots) we only get a minute, so the score stays whatever
    // is on `matches` (the live_tracker keeps that field fresh).
    if (snapRow.score_home != null && snapRow.score_away != null) {
      scoreHome = snapRow.score_home;
      scoreAway = snapRow.score_away;
    }
  }

  const wp = computeWP({
    homeElo,
    awayElo,
    homePreMatchProb: homePrior,
    drawPreMatchProb: drawPrior,
    awayPreMatchProb: awayPrior,
    scoreHome,
    scoreAway,
    minute,
    isLive: isLive || isFinished,
  });

  return NextResponse.json({
    minute: Math.min(minute, 90),
    homeProb: wp.homeProb,
    drawProb: wp.drawProb,
    awayProb: wp.awayProb,
    scoreHome,
    scoreAway,
    serverNow: new Date().toISOString(),
  });
}
