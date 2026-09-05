/**
 * GET /api/v1/track-record
 *
 * Public, auth-free JSON ledger of every settled calibrated pre-match bet.
 * Tipstrr-style verification mechanic — anyone can independently re-settle
 * each bet from public sources (ESPN, Flashscore) using the timestamps and
 * market data exposed here.
 *
 * Filter scope (intentional, never widen without updating MODEL_WHITEPAPER):
 *   - bots.maturity_label IN ('calibrated','beta','active')  — production
 *     strategies only, excludes retired (failed experiments)
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
import {
  execOdds,
  CALIBRATED_SINCE,
  CALIBRATED_PUBLIC_MARKETS,
  FLAT_STAKE_EUR,
  PUBLIC_MATURITY_LABELS as SHARED_PUBLIC_MATURITY_LABELS,
} from "@/lib/engine-data";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// LANDING-PERF-ROI-BASIS-2026-09-05: these were duplicated literals that happened
// to agree with /performance's cohort. They are now imported from the single
// definition in engine-data, because a silently-diverging cohort is exactly how
// two public pages end up publishing different ROI for the same bets.
const DEFAULT_SINCE = CALIBRATED_SINCE;
const PRE_MATCH_MARKETS = CALIBRATED_PUBLIC_MARKETS as unknown as string[];
const PUBLIC_MATURITY_LABELS = SHARED_PUBLIC_MATURITY_LABELS as unknown as string[];

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

interface BetRow {
  id: string;
  match_id: string;
  created_at: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  odds_at_pick_live: number | null;
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
  // PERF-COHORT-PREMATCH-ONLY (2026-08-21): exclude inplay bots so this
  // matches /performance's getCalibratedHeadlineStats + the leaderboard's
  // PERFORMANCE-PUBLIC-PREMATCH-ONLY rule. Landing pulls its ROI headline
  // from this endpoint, so this drives the landing's "N verified pre-match
  // picks" number too.
  let q = sb
    .from("simulated_bets")
    .select(
      `id, match_id, created_at, market, selection,
       odds_at_pick, odds_at_pick_live, recommended_bookmaker, stake, pnl, result,
       closing_odds, clv, clv_pinnacle,
       matches!inner ( date, home_team_id, away_team_id, score_home, score_away,
         leagues ( name, country )
       ),
       bots!inner ( name, maturity_label )`
    )
    .in("bots.maturity_label", PUBLIC_MATURITY_LABELS)
    .not("bots.name", "like", "inplay_%")
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

  // 2) aggregate stats (count, ROI, CLV) — full window, not just this page.
  // FLAT-ROI-EVERYWHERE (2026-08-21): fetch odds_at_pick + result so ROI can
  // be computed at €10 flat stake per pick, matching WinnerOdds / Tipstrr /
  // SignalOdds / Forebet publication methodology. Internal Kelly stakes in
  // simulated_bets.stake are ignored for this public endpoint.
  // Shared with /performance so both publish the same stake basis.
  const FLAT_STAKE = FLAT_STAKE_EUR;
  const aggRes = await sb
    .from("simulated_bets")
    .select(
      "odds_at_pick, odds_at_pick_live, result, clv, clv_pinnacle, bots!inner(name, maturity_label)",
      { count: "exact" }
    )
    .in("bots.maturity_label", PUBLIC_MATURITY_LABELS)
    .not("bots.name", "like", "inplay_%")
    .in("market", PRE_MATCH_MARKETS)
    .in("result", ["won", "lost"])
    .gte("created_at", `${since}T00:00:00Z`);

  let total = 0;
  let stake = 0;
  let pnl = 0;
  const unitReturns: number[] = [];
  // any-book CLV is the public headline metric (matches the cohort used
  // historically in dashboard_cache.active_avg_clv).
  const clvAnyVals: number[] = [];
  const clvPinVals: number[] = [];
  let clvSum = 0;
  let clvBeats = 0;
  if (!aggRes.error && aggRes.data) {
    total = aggRes.count ?? aggRes.data.length;
    for (const r of aggRes.data as Array<{
      odds_at_pick: number | null;
      odds_at_pick_live: number | null;
      result: string | null;
      clv: number | null;
      clv_pinnacle: number | null;
    }>) {
      // LANDING-PERF-ROI-BASIS-2026-09-05: this is the PUBLIC headline ROI and
      // the published ledger, so it must be priced at odds that were actually
      // on offer. `odds_at_pick` is a MAX() high-water mark across the fixture's
      // whole snapshot history (STALE-BEST-ODDS) — publishing a return derived
      // from a price nobody could have taken is the same class of error as the
      // earlier +14.33% -> +10.65% restatement.
      const odds = execOdds(r.odds_at_pick, r.odds_at_pick_live);
      // Flat €10 stake: win = 10*(odds-1), loss = -10.
      pnl += r.result === "won" ? FLAT_STAKE * (odds - 1) : -FLAT_STAKE;
      stake += FLAT_STAKE;
      // LANDING-PERF-ROI-BASIS: collect unit returns so the response can publish
      // a confidence interval. A bare ROI with no interval reads as precision it
      // does not have — per-bet unit-return sd here is ~1.4, so even n in the
      // hundreds leaves a several-point band.
      unitReturns.push(r.result === "won" ? odds - 1 : -1);
      if (r.clv != null) {
        const c = Number(r.clv);
        clvAnyVals.push(c);
        clvSum += c;
        if (c > 0) clvBeats += 1;
      }
      if (r.clv_pinnacle != null) {
        clvPinVals.push(Number(r.clv_pinnacle));
      }
    }
  }
  function median(xs: number[]): number | null {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    const med = s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
    return Number((med * 100).toFixed(2));
  }
  const medianClvPct = median(clvAnyVals);
  const medianClvPinPct = median(clvPinVals);
  const meanClvPct = clvAnyVals.length
    ? Number(((100 * clvSum) / clvAnyVals.length).toFixed(2))
    : null;
  const clvN = clvAnyVals.length;

  const bets = rows.map((r) => {
    // FLAT-ROI-EVERYWHERE (2026-08-21): per-bet stake/pnl in the public
    // response are €10-flat so summing rows reconciles with meta.roi_pct.
    // Kelly numbers from r.stake / r.pnl remain internal (admin dashboards).
    // LANDING-PERF-ROI-BASIS-2026-09-05: must use the SAME basis as meta.roi_pct
    // above, or the reconciliation promised by the comment breaks.
    const oddsN = execOdds(r.odds_at_pick, r.odds_at_pick_live);
    const flatStake = FLAT_STAKE;
    const flatPnl = r.result === "won" ? FLAT_STAKE * (oddsN - 1)
                    : r.result === "lost" ? -FLAT_STAKE
                    : 0;  // void / pending — no PnL
    return {
      id: r.id,
      match_id: r.match_id,
      kickoff_utc: r.matches?.date ?? null,
      league: r.matches?.leagues?.name ?? null,
      country: r.matches?.leagues?.country ?? null,
      market: r.market,
      selection: r.selection,
      // The price the return is computed from (executable at pick time).
      placed_odds: oddsN > 0 ? Number(oddsN.toFixed(2)) : null,
      // The raw stored high-water value, kept for transparency/diffing.
      placed_odds_high_water: r.odds_at_pick,
      bookmaker: r.recommended_bookmaker,
      placed_at_utc: r.created_at,
      closing_odds: r.closing_odds,
      clv_any_pct: r.clv != null ? Number((Number(r.clv) * 100).toFixed(2)) : null,
      clv_pin_pct:
        r.clv_pinnacle != null
          ? Number((Number(r.clv_pinnacle) * 100).toFixed(2))
          : null,
      stake: flatStake,
      pnl: Number(flatPnl.toFixed(2)),
      result: r.result,
      bot: r.bots?.name ?? null,
      score: r.matches
        ? r.matches.score_home != null && r.matches.score_away != null
          ? `${r.matches.score_home}-${r.matches.score_away}`
          : null
        : null,
    };
  });

  // LANDING-PERF-ROI-BASIS-2026-09-05: publish the uncertainty alongside the
  // point estimate. Standard error of the mean unit return, in ROI percentage
  // points. Consumers should render roi_pct together with roi_ci_*_pct.
  let roiSePct: number | null = null;
  if (unitReturns.length > 1) {
    const mean = unitReturns.reduce((a, b) => a + b, 0) / unitReturns.length;
    const variance =
      unitReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (unitReturns.length - 1);
    roiSePct = (100 * Math.sqrt(variance)) / Math.sqrt(unitReturns.length);
  }
  const roiPct = stake > 0 ? (100 * pnl) / stake : null;

  const meta = {
    since,
    total_bets: total,
    page_size: bets.length,
    roi_pct: roiPct != null ? Number(roiPct.toFixed(2)) : null,
    // Uncertainty on roi_pct. Render these WITH the headline, never the point
    // estimate alone.
    roi_se_pct: roiSePct != null ? Number(roiSePct.toFixed(2)) : null,
    roi_ci_low_pct:
      roiPct != null && roiSePct != null ? Number((roiPct - 1.96 * roiSePct).toFixed(2)) : null,
    roi_ci_high_pct:
      roiPct != null && roiSePct != null ? Number((roiPct + 1.96 * roiSePct).toFixed(2)) : null,
    // Which price the return is computed from.
    price_basis: "executable_at_pick_time",
    pnl_total: Number(pnl.toFixed(2)),
    stake_total: Number(stake.toFixed(2)),
    median_clv_pct: medianClvPct,
    mean_clv_pct: meanClvPct,
    median_clv_pin_pct: medianClvPinPct,
    clv_coverage_pct: total > 0 ? Number(((100 * clvN) / total).toFixed(1)) : 0,
    clv_beat_pct: clvN > 0 ? Number(((100 * clvBeats) / clvN).toFixed(1)) : null,
    scope:
      "pre-match strategies only (calibrated + beta + active maturity, no retired, no in-play bots), pre-match markets (1x2, OU 2.5; BTTS retired 2026-09-03 after 427 settled shadow picks returned -12.76% at prices live at pick time, t=-2.87 — historical BTTS bets remain in the record), settled only. Matches /performance's headline cohort. **ROI is priced at the odds actually available from an accessible bookmaker at or before pick time (`placed_odds`), not the best price any book showed at any point in the day — the raw stored value is exposed as `placed_odds_high_water` for comparison. Restated 2026-09-05: the previous basis overstated this figure by 4.29pp.** ROI computed at €10 flat stake per pick — matches WinnerOdds / Tipstrr / SignalOdds / Forebet publication methodology so head-to-head comparison is apples-to-apples.",
    notes:
      "Every row is an independently re-settleable bet. Use match_id (UUID) + kickoff_utc + market + selection + placed_at_utc to verify against ESPN/Flashscore. Track record published unfiltered — losing bets are present. `stake` and `pnl` per row are €10-flat; internal bots stake proportional to divergence (Kelly) but that's admin-only.",
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
