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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

interface MatchTeamRow {
  status: string;
  score_home: number | null;
  score_away: number | null;
  home_team_id: string;
  away_team_id: string;
  league: { country: string | null } | { country: string | null }[] | null;
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

  // Pull everything we need in parallel.
  const [matchRes, snapRes, predRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        `status, score_home, score_away, home_team_id, away_team_id,
         league:league_id(country)`
      )
      .eq("id", id)
      .single(),
    supabase
      .from("live_match_snapshots")
      .select("score_home, score_away, minute, captured_at")
      .eq("match_id", id)
      .order("captured_at", { ascending: false })
      .limit(1),
    supabase
      .from("predictions")
      .select("source, market, model_probability")
      .eq("match_id", id),
  ]);

  if (matchRes.error || !matchRes.data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const match = matchRes.data as MatchTeamRow;
  const league = Array.isArray(match.league) ? match.league[0] : match.league;
  const competition: "club" | "international" =
    (league?.country ?? "").toLowerCase() === "world" ? "international" : "club";

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
  const snap = (snapRes.data ?? [])[0] as
    | { score_home: number; score_away: number; minute: number; captured_at: string }
    | undefined;

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  // Minute / score resolution.
  let minute = 0;
  let scoreHome = match.score_home ?? 0;
  let scoreAway = match.score_away ?? 0;
  if (isFinished) {
    minute = 90;
  } else if (snap) {
    minute = snap.minute;
    scoreHome = snap.score_home;
    scoreAway = snap.score_away;
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
