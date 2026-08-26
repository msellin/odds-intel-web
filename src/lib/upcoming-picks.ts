/**
 * Server-only pick fetchers for /picks.
 *
 * PICKS-USER-GATE 2026-08-22 — /api/v1/upcoming is the PUBLIC picks feed and
 * is now narrowed to `maturity_label = 'calibrated'` so it exactly matches
 * the cohort that ships to the Telegram public channel. Signed-in users get
 * the wider `calibrated + beta + active` cohort via this module, which is
 * called directly from the /picks server component — never exposed as a
 * client-fetchable route. Result: the wider cohort never leaves the server
 * unless a signed-in session is on the request.
 *
 * Both codepaths dedupe by (match_id, market, selection) keeping the
 * highest-edge row, matching the historic /api/v1/upcoming shape.
 */
import { createClient } from "@supabase/supabase-js";

export interface UpcomingPick {
  id: string;
  match_id: string;
  kickoff_utc: string | null;
  league: string | null;
  country: string | null;
  home_team: string | null;
  away_team: string | null;
  market: string;
  selection: string;
  odds: number | null;
  edge_pct: number | null;
  /**
   * Break-even odds: below this the bet is negative-EV and should be skipped.
   *
   * A pick is only worth taking at the price it was found at. By the time
   * someone opens the page the book may have moved, and a pick posted at 2.50
   * with a 10% edge is worthless at 2.20. Derived rather than stored:
   *   edge = odds x prob - 1  =>  prob = (1 + edge) / odds
   *   break-even = 1 / prob   =  odds / (1 + edge)
   *
   * This matters more than it looks right now — the Coolbet feed has been stale
   * for 74h, so every current pick is priced at a book the operator may not be
   * placing at. Showing the floor lets the reader check their own price instead
   * of trusting a number that may have moved.
   */
  min_odds: number | null;
  bookmaker: string | null;
  posted_at_utc: string;
  result: "pending" | "won" | "lost" | "void";
}

const PRE_MATCH_MARKETS = ["1x2", "over_under_25", "o/u", "btts"];

export const PUBLIC_MATURITY_LABELS = ["calibrated"];
export const SIGNED_IN_MATURITY_LABELS = ["calibrated", "beta", "active"];

interface BetRow {
  id: string;
  match_id: string;
  created_at: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  edge_percent: number | null;
  recommended_bookmaker: string | null;
  result: string | null;
  matches: {
    date: string;
    leagues: { name: string; country: string } | null;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
  } | null;
  bots: { name: string; maturity_label: string } | null;
}

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_POSTGREST_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.POSTGREST_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function fetchUpcomingPicks(
  maturityLabels: readonly string[],
): Promise<{ picks: UpcomingPick[]; windowStart: string; windowEnd: string }> {
  const sb = adminClient();
  const now = new Date();
  const horizonHoursForward = 36;
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  );
  const end = new Date(now.getTime() + horizonHoursForward * 3600 * 1000);

  const { data, error } = await sb
    .from("simulated_bets")
    .select(
      `id, match_id, created_at, market, selection,
       odds_at_pick, edge_percent, recommended_bookmaker, result,
       matches!inner (
         date,
         leagues ( name, country ),
         home_team:teams!matches_home_team_id_fkey ( name ),
         away_team:teams!matches_away_team_id_fkey ( name )
       ),
       bots!inner ( name, maturity_label )`,
    )
    .in("result", ["pending", "won", "lost", "void"])
    .in("bots.maturity_label", maturityLabels as string[])
    .is("bots.retired_at", null)
    .not("bots.name", "like", "inplay_%")
    .in("market", PRE_MATCH_MARKETS)
    .gte("matches.date", start.toISOString())
    .lte("matches.date", end.toISOString())
    .order("matches(date)", { ascending: true })
    .limit(300);

  if (error) throw new Error(`upcoming picks: ${error.message}`);

  const rows = (data ?? []) as unknown as BetRow[];

  const dedup = new Map<string, BetRow>();
  for (const r of rows) {
    const key = `${r.match_id}|${r.market}|${r.selection}`;
    const existing = dedup.get(key);
    if (!existing || (r.edge_percent ?? 0) > (existing.edge_percent ?? 0)) {
      dedup.set(key, r);
    }
  }

  const picks: UpcomingPick[] = Array.from(dedup.values()).map((r) => ({
    id: r.id,
    match_id: r.match_id,
    kickoff_utc: r.matches?.date ?? null,
    league: r.matches?.leagues?.name ?? null,
    country: r.matches?.leagues?.country ?? null,
    home_team: r.matches?.home_team?.name ?? null,
    away_team: r.matches?.away_team?.name ?? null,
    market: r.market,
    selection: r.selection,
    odds: r.odds_at_pick,
    edge_pct:
      r.edge_percent != null
        ? Number((Number(r.edge_percent) * 100).toFixed(2))
        : null,
    min_odds:
      r.odds_at_pick != null && r.edge_percent != null && Number(r.edge_percent) > -1
        ? Number((Number(r.odds_at_pick) / (1 + Number(r.edge_percent))).toFixed(2))
        : null,
    bookmaker: r.recommended_bookmaker,
    posted_at_utc: r.created_at,
    result: (r.result ?? "pending") as UpcomingPick["result"],
  }));

  return {
    picks,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}

export async function fetchUserPickMarkStates(
  userId: string,
): Promise<Map<string, 1 | 2>> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("user_pick_marks")
    .select("pick_id, state")
    .eq("user_id", userId);
  if (error) throw new Error(`user_pick_marks: ${error.message}`);
  const map = new Map<string, 1 | 2>();
  for (const r of (data ?? []) as { pick_id: string; state: number }[]) {
    map.set(r.pick_id, r.state === 1 ? 1 : 2);
  }
  return map;
}
