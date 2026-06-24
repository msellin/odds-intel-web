/**
 * GET /api/v1/upcoming
 *
 * Public, auth-free JSON feed of pending pre-match picks our production
 * strategies have flagged in the next 36 hours. Counterpart to
 * /api/v1/track-record (which only shows settled bets).
 *
 * Scope (intentional):
 *   - bots.maturity_label IN ('calibrated','beta','active')  — production
 *     strategies, no retired
 *   - market IN ('1x2', 'over_under_25', 'o/u', 'btts')  — pre-match only
 *   - sb.result = 'pending'                               — unsettled
 *   - match kickoff between NOW() and NOW() + 36 hours
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
  const horizonHours = 36;
  const end = new Date(now.getTime() + horizonHours * 3600 * 1000);

  const { data, error } = await sb
    .from("simulated_bets")
    .select(
      `id, match_id, created_at, market, selection,
       odds_at_pick, edge_percent, recommended_bookmaker,
       matches!inner (
         date,
         leagues ( name, country ),
         home_team:teams!matches_home_team_id_fkey ( name ),
         away_team:teams!matches_away_team_id_fkey ( name )
       ),
       bots!inner ( name, maturity_label )`
    )
    .eq("result", "pending")
    .in("bots.maturity_label", PUBLIC_MATURITY_LABELS)
    .in("market", PRE_MATCH_MARKETS)
    .gte("matches.date", now.toISOString())
    .lte("matches.date", end.toISOString())
    .order("matches(date)", { ascending: true })
    .limit(200);

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
  }));

  return NextResponse.json(
    {
      meta: {
        generated_at_utc: now.toISOString(),
        horizon_hours: horizonHours,
        count: picks.length,
        scope:
          "pending pre-match picks from production strategies (calibrated + beta + active maturity), next 36h",
        notes:
          "These picks are live — they will move to /api/v1/track-record once the matches settle. Use the same match_id to track each pick from publication through settlement.",
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
