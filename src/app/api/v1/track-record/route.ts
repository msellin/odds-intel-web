/**
 * GET /api/v1/track-record
 *
 * Public, auth-free JSON ledger of every settled calibrated pre-match bet.
 * Tipstrr-style verification mechanic — anyone can independently re-settle
 * each bet from public sources (ESPN, Flashscore) using the timestamps and
 * market data exposed here.
 *
 * Filter scope (intentional, never widen without updating MODEL_WHITEPAPER):
 *   - bots.maturity_label = 'calibrated'  (no beta/active/retired noise)
 *   - market IN ('1x2', 'over_under_25', 'o/u', 'btts')  (pre-match only)
 *   - result IN ('won', 'lost')  (settled, no pending/voided)
 *
 * Query params:
 *   ?since=YYYY-MM-DD     (default: '2026-05-04' — calibrated tier launch)
 *   ?limit=N              (default 500, max 5000)
 *   ?cursor=<iso-ts>      (for paging — created_at < cursor)
 *
 * Returns:
 *   { meta: { count, total, roi_pct, avg_clv_pin_pct, since },
 *     bets: [...] }
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const DEFAULT_SINCE = "2026-05-04";
const PRE_MATCH_MARKETS = ["1x2", "over_under_25", "o/u", "btts"];

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
  recommended_bookmaker: string | null;
  stake: number | null;
  pnl: number | null;
  result: string;
  closing_odds: number | null;
  clv: number | null;
  clv_pinnacle: number | null;
  matches: {
    date: string;
    home_team_id: string | null;
    away_team_id: string | null;
    score_home: number | null;
    score_away: number | null;
    leagues: { name: string; country: string } | null;
  } | null;
  bots: { name: string; maturity_label: string } | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Light IP rate limit so anyone abusing this doesn't burn the pooler.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon";
  const rl = checkRateLimit(`track-record:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded — 60 req/min/IP" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
    );
  }

  const since = searchParams.get("since") || DEFAULT_SINCE;
  const limitRaw = parseInt(searchParams.get("limit") || "500", 10);
  const limit = Math.min(Math.max(limitRaw || 500, 1), 5000);
  const cursor = searchParams.get("cursor");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    return NextResponse.json({ error: "since must be YYYY-MM-DD" }, { status: 400 });
  }

  const sb = adminClient();

  // 1) page of bets
  let q = sb
    .from("simulated_bets")
    .select(
      `id, match_id, created_at, market, selection,
       odds_at_pick, recommended_bookmaker, stake, pnl, result,
       closing_odds, clv, clv_pinnacle,
       matches!inner ( date, home_team_id, away_team_id, score_home, score_away,
         leagues ( name, country )
       ),
       bots!inner ( name, maturity_label )`
    )
    .eq("bots.maturity_label", "calibrated")
    .in("market", PRE_MATCH_MARKETS)
    .in("result", ["won", "lost"])
    .gte("created_at", `${since}T00:00:00Z`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) q = q.lt("created_at", cursor);

  const { data: rowsRaw, error } = await q;
  if (error) {
    return NextResponse.json(
      { error: "DB error", detail: error.message },
      { status: 500 }
    );
  }
  const rows = (rowsRaw ?? []) as unknown as BetRow[];

  // 2) aggregate stats (count, ROI, CLV) — full window, not just this page
  const aggRes = await sb
    .from("simulated_bets")
    .select(
      "stake, pnl, clv_pinnacle, bots!inner(maturity_label)",
      { count: "exact" }
    )
    .eq("bots.maturity_label", "calibrated")
    .in("market", PRE_MATCH_MARKETS)
    .in("result", ["won", "lost"])
    .gte("created_at", `${since}T00:00:00Z`);

  let total = 0;
  let stake = 0;
  let pnl = 0;
  let clvSum = 0;
  let clvN = 0;
  let clvBeats = 0;
  if (!aggRes.error && aggRes.data) {
    total = aggRes.count ?? aggRes.data.length;
    for (const r of aggRes.data as Array<{
      stake: number | null;
      pnl: number | null;
      clv_pinnacle: number | null;
    }>) {
      stake += Number(r.stake ?? 0);
      pnl += Number(r.pnl ?? 0);
      if (r.clv_pinnacle != null) {
        clvSum += Number(r.clv_pinnacle);
        clvN += 1;
        if (Number(r.clv_pinnacle) > 0) clvBeats += 1;
      }
    }
  }

  const bets = rows.map((r) => ({
    id: r.id,
    match_id: r.match_id,
    kickoff_utc: r.matches?.date ?? null,
    league: r.matches?.leagues?.name ?? null,
    country: r.matches?.leagues?.country ?? null,
    market: r.market,
    selection: r.selection,
    placed_odds: r.odds_at_pick,
    bookmaker: r.recommended_bookmaker,
    placed_at_utc: r.created_at,
    closing_odds: r.closing_odds,
    clv_any_pct: r.clv != null ? Number((Number(r.clv) * 100).toFixed(2)) : null,
    clv_pin_pct:
      r.clv_pinnacle != null
        ? Number((Number(r.clv_pinnacle) * 100).toFixed(2))
        : null,
    stake: r.stake,
    pnl: r.pnl,
    result: r.result,
    bot: r.bots?.name ?? null,
    score: r.matches
      ? r.matches.score_home != null && r.matches.score_away != null
        ? `${r.matches.score_home}-${r.matches.score_away}`
        : null
      : null,
  }));

  const meta = {
    since,
    total_bets: total,
    page_size: bets.length,
    roi_pct: stake > 0 ? Number(((100 * pnl) / stake).toFixed(2)) : null,
    pnl_total: Number(pnl.toFixed(2)),
    stake_total: Number(stake.toFixed(2)),
    avg_clv_pin_pct: clvN > 0 ? Number(((100 * clvSum) / clvN).toFixed(2)) : null,
    clv_pin_coverage_pct: total > 0 ? Number(((100 * clvN) / total).toFixed(1)) : 0,
    clv_pin_beat_pct: clvN > 0 ? Number(((100 * clvBeats) / clvN).toFixed(1)) : null,
    scope:
      "calibrated bots, pre-match markets (1x2, OU 2.5, BTTS), settled only",
    notes:
      "Every row is an independently re-settleable bet. Use match_id (UUID) + kickoff_utc + market + selection + placed_at_utc to verify against ESPN/Flashscore. Track record published unfiltered — losing bets are present.",
    next_cursor:
      bets.length === limit ? bets[bets.length - 1]?.placed_at_utc : null,
  };

  return NextResponse.json(
    { meta, bets },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
