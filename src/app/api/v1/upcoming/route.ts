/**
 * GET /api/v1/upcoming
 *
 * Public, auth-free JSON feed of recent + upcoming pre-match picks. Serves
 * the /picks live-feed page. Counterpart to /api/v1/track-record (settled
 * history over the full ledger).
 *
 * Scope (intentional):
 *   - bots.maturity_label IN ('calibrated','beta','active')  — production
 *     strategies, no retired
 *   - market IN ('1x2', 'over_under_25', 'o/u', 'btts')  — pre-match only
 *   - match kickoff between NOW() - 24h and NOW() + 36 hours  — recent past
 *     picks (settled today) + all upcoming
 *   - result IN ('pending','won','lost','void')  — everything, badge shows outcome
 *
 * PICKS-WIDEN (2026-07-08): earlier version was NOW→NOW+36h + result='pending'
 * only, which made /picks look empty as soon as a match kicked off. Widening
 * backward + surfacing result badges lets the page double as social proof
 * ("here's what the model called today, and how it settled").
 *
 * Cache: 60s (the picks list itself updates as new bets fire each cron cycle).
 * Rate limit: 60 req/min/IP.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const PRE_MATCH_MARKETS = ["1x2", "over_under_25", "o/u", "btts"];
const PUBLIC_MATURITY_LABELS = ["calibrated", "beta", "active"];

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { persistSession: false } }
  );
}

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

export async function GET(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon";
  const rl = checkRateLimit(`upcoming:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded — 60 req/min/IP" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  const sb = adminClient();
  const now = new Date();
  const horizonHoursForward = 36;
  const horizonHoursBackward = 24;
  const start = new Date(now.getTime() - horizonHoursBackward * 3600 * 1000);
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
       bots!inner ( name, maturity_label )`
    )
    .in("result", ["pending", "won", "lost", "void"])
    .in("bots.maturity_label", PUBLIC_MATURITY_LABELS)
    .in("market", PRE_MATCH_MARKETS)
    .gte("matches.date", start.toISOString())
    .lte("matches.date", end.toISOString())
    .order("matches(date)", { ascending: true })
    .limit(300);

  if (error) {
    return NextResponse.json(
      { error: "DB error", detail: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as unknown as BetRow[];

  // Deduplicate: same (match, market, selection) might appear from multiple
  // production-tier bots. Keep the one with the highest edge.
  const dedup = new Map<string, BetRow>();
  for (const r of rows) {
    const key = `${r.match_id}|${r.market}|${r.selection}`;
    const existing = dedup.get(key);
    if (!existing || (r.edge_percent ?? 0) > (existing.edge_percent ?? 0)) {
      dedup.set(key, r);
    }
  }

  const picks = Array.from(dedup.values()).map((r) => ({
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
    edge_pct: r.edge_percent != null ? Number((Number(r.edge_percent) * 100).toFixed(2)) : null,
    bookmaker: r.recommended_bookmaker,
    posted_at_utc: r.created_at,
    result: r.result ?? "pending",
  }));

  return NextResponse.json(
    {
      meta: {
        generated_at_utc: now.toISOString(),
        horizon_hours_backward: horizonHoursBackward,
        horizon_hours_forward: horizonHoursForward,
        count: picks.length,
        scope:
          "pre-match picks from production strategies (calibrated + beta + active maturity), kickoffs from -24h to +36h. Includes settled picks (won/lost/void) so the feed doesn't go dark right after a match kicks off.",
        notes:
          "Picks with result='pending' are live. Settled picks (won/lost/void) come off /api/v1/track-record's ledger once the match finishes. Use match_id to correlate.",
      },
      picks,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
