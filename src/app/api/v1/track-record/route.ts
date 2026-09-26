/**
 * GET /api/v1/track-record
 *
 * Public, auth-free JSON ledger of every settled calibrated pre-match bet.
 * Tipstrr-style verification mechanic — anyone can independently re-settle
 * each bet from public sources (ESPN, Flashscore) using the timestamps and
 * market data exposed here.
 *
 * Filter scope (intentional, never widen without updating MODEL_WHITEPAPER):
 *   - bots.maturity_label = 'active' (HEADLINE_MATURITY_LABELS — the bots that count in the
 *     headline totals; BETA + CALIBRATED merged into ACTIVE 2026-09-26, [[#175]]), not VIP,
 *     excludes retired (failed experiments) and TESTING (own record only)
 *   - market IN ('1x2', 'over_under_25', 'o/u', 'btts')  (pre-match only)
 *   - result IN ('won', 'lost')  (settled, no pending/voided)
 *
 * Query params:
 *   ?since=YYYY-MM-DD     (default: '2026-05-04' — calibrated tier launch)
 *   ?limit=N              (default 500, max 5000)
 *   ?cursor=<iso-ts>      (for paging — created_at < cursor)
 *
 * Returns:
 *   { meta: { count, total, roi_pct, roi_n, since },
 *     bets: [...] }
 */
import { NextResponse } from "next/server";
import {
  CALIBRATED_SINCE,
  CALIBRATED_PUBLIC_MARKETS,
  FLAT_STAKE_EUR,
  HEADLINE_MATURITY_LABELS,
  getPublicCohortBotNames,
} from "@/lib/engine-data";
import { getHeadlineFlat, getPublicPrices } from "@/lib/bot-performance";
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
// DUPLICATED-RULES-REMAINING-2026-09-06: this used to import
// engine-data's PUBLIC_MATURITY_LABELS under an alias, because
// upcoming-picks.ts exported the same name with a different value.
// The constant is now named for what it is, so no alias is needed.
const PUBLIC_MATURITY_LABELS = HEADLINE_MATURITY_LABELS as unknown as string[];

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
  recommended_bookmaker: string | null;
  result: string;
  closing_odds: number | null;
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
       odds_at_pick, recommended_bookmaker, result, closing_odds,
       matches!inner ( date, home_team_id, away_team_id, score_home, score_away,
         leagues ( name, country )
       ),
       bots!inner ( name, maturity_label, vip )`
    )
    .in("bots.maturity_label", PUBLIC_MATURITY_LABELS)
    .eq("bots.vip", false) // [[#155]] the headline cohort never includes VIP bots
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

  // 2) aggregate stats — full window, not just this page.
  // [[#159]] (2026-09-25, owner-approved): ONE definition. The aggregate is summed from the
  // engine view's per-leg public figure (bot_ledger.pnl_unit_public — FLAT at the best price
  // AVAILABLE when the pick was made on ALL publishable books), exactly as /performance's hero,
  // over the same cohort (getPublicCohortBotNames: calibrated/beta/active, not retired, not
  // in-play). It used to price here at our 4 Estonian books and DROP legs without a quote
  // (LANDING-PERF-UNPLACEABLE-FALLBACK); a leg with no quote at pick time is now priced at the
  // recorded odds and COUNTED (roi_recorded_price_n) — the rule every surface shares.
  // The legacy clv / clv_pinnacle columns are no longer read (CLV-PUBLIC-WITHDRAWN; #159).
  const FLAT_STAKE = FLAT_STAKE_EUR;
  const cohort = await getPublicCohortBotNames();
  const head = await getHeadlineFlat({
    bots: [...cohort],
    markets: PRE_MATCH_MARKETS,
    since: `${since}T00:00:00Z`,
  });
  const total = head.n;
  const pnl = head.pnlUnits * FLAT_STAKE;
  const stake = head.n * FLAT_STAKE;
  const prices = await getPublicPrices(rows.map((r) => r.id));

  const bets = rows.map((r) => {
    // FLAT-ROI-EVERYWHERE (2026-08-21): per-bet stake/pnl in the public
    // response are €10-flat so summing rows reconciles with meta.roi_pct.
    // Kelly numbers from r.stake / r.pnl remain internal (admin dashboards).
    // LANDING-PERF-ROI-BASIS-2026-09-05: must use the SAME basis as meta.roi_pct
    // above, or the reconciliation promised by the comment breaks.
    // [[#159]] the row's price and P&L from the same view column as meta.roi_pct.
    const pr = prices.get(r.id);
    const oddsN = pr?.odds ?? Number(r.odds_at_pick ?? 0);
    const flatStake = FLAT_STAKE;
    const flatPnl = (pr?.pnlUnit ?? (r.result === "won" ? oddsN - 1 : -1)) * FLAT_STAKE;
    return {
      id: r.id,
      match_id: r.match_id,
      kickoff_utc: r.matches?.date ?? null,
      league: r.matches?.leagues?.name ?? null,
      country: r.matches?.leagues?.country ?? null,
      market: r.market,
      selection: r.selection,
      // The price the return is computed from: the best price available on any publishable
      // book at or before the pick (#159). `price_basis` says when it fell back to the recorded odds.
      placed_odds: oddsN > 0 ? Number(oddsN.toFixed(2)) : null,
      price_basis: pr?.basis ?? "recorded",
      // The raw stored high-water value, kept for transparency/diffing.
      placed_odds_high_water: r.odds_at_pick,
      bookmaker: r.recommended_bookmaker,
      placed_at_utc: r.created_at,
      closing_odds: r.closing_odds,
      // CLV-PUBLIC-WITHDRAWN (completed 2026-09-07). The first pass removed the
      // five CLV fields from `meta` but LEFT them on every individual bet row,
      // so the withdrawal was cosmetic: this endpoint is auth-free, and
      // `clv_pin_pct` derives from simulated_bets.clv_pinnacle — the RAW,
      // VIGGED column priced at a high-water mark, i.e. precisely the number
      // that reads +9.49% against an honest -3.22%. Publishing it per row and
      // not in aggregate still publishes it, and anyone could have averaged the
      // rows to reconstruct the withdrawn headline.
      //
      // Found by reading the live endpoint rather than trusting the build.
      // `closing_odds` above stays: it is an observed price, not a derived CLV
      // claim, and a reader re-settling the ledger needs it.
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

  // LANDING-PERF-ROI-BASIS-2026-09-05: publish the uncertainty alongside the point estimate
  // (standard error of the mean flat return, in ROI percentage points).
  const roiSePct: number | null = head.roiSe != null ? 100 * head.roiSe : null;
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
    price_basis: "best_available_at_pick_time_all_books",
    // LANDING-PERF-UNPLACEABLE-FALLBACK-2026-09-06: settled rows EXCLUDED from
    // roi_pct because no accessible book quoted them at pick time. They were
    // not placeable, so pricing them at the stale high-water mark would inflate
    // the headline — measured at +1.92pp on the public cohort. Published rather
    // than hidden, because a restated ROI without its coverage invites exactly
    // the "your data is thin" dismissal (ANALYSIS_GOTCHAS #29). `total_bets`
    // stays the full settled count; `roi_n` is what roi_pct is computed over.
    // [[#159]] roi_pct is computed over EVERY settled bet in scope; roi_recorded_price_n of them
    // had no stored quote at pick time and are priced at the recorded odds.
    roi_n: total,
    roi_excluded_unpriceable: 0,
    roi_recorded_price_n: head.nRecordedPrice,
    roi_coverage_pct: total > 0 ? Number(((100 * (total - head.nRecordedPrice)) / total).toFixed(1)) : 0,
    pnl_total: Number(pnl.toFixed(2)),
    stake_total: Number(stake.toFixed(2)),
    // CLV-PUBLIC-WITHDRAWN (2026-09-06). median_clv_pct, mean_clv_pct,
    // median_clv_pin_pct, clv_coverage_pct and clv_beat_pct are no longer
    // emitted. This endpoint is auth-free, so anything it returns is published
    // whether or not a page renders it.
    //
    // They were WRONG, not merely unflattering. All of them derive from
    // simulated_bets.clv_pinnacle, which settlement.py writes RAW
    // (odds_at_pick / pinnacle_closing - 1): no de-vig, and priced at
    // odds_at_pick, a MAX high-water mark rather than an executable quote.
    // Measured on this cohort: "% vs Pinnacle" published +9.49% against an
    // honest -3.22%; "beat the close" published 78% against an honest 36%.
    //
    // Withdrawn rather than restated because the corrected figure is negative
    // AND unvalidated — CLV-EXECUTABLE-PRICE-SUBSET measured CLV predicting
    // realised return at r=+0.0375, not significant, on bets carrying a real
    // executable price. The engine still computes and stores CLV; this is a
    // publication decision, reversible in one commit once the number is both
    // positive and shown to predict return.
    //
    // roi_pct is UNAFFECTED: it comes from stake and pnl and never touches
    // clv_pinnacle.
    scope:
      "pre-match strategies only (calibrated + beta + active maturity, no retired, no in-play bots), pre-match markets (1x2, OU 2.5; BTTS retired 2026-09-03 after 427 settled shadow picks returned -12.76% at prices live at pick time, t=-2.87 — historical BTTS bets remain in the record), settled only. Matches /performance's headline cohort. **ROI is priced at the best price available on any publishable bookmaker at or before pick time (`placed_odds`; latest quote per book, dead feeds excluded), not the best price any book showed at any point in the day — the raw stored value is exposed as `placed_odds_high_water` for comparison. Restated 2026-09-05 and 2026-09-25 (#159: one definition with /performance).** ROI computed at €10 flat stake per pick — matches WinnerOdds / Tipstrr / SignalOdds / Forebet publication methodology so head-to-head comparison is apples-to-apples.",
    // TRACK-RECORD-UNFILTERED-CLAIM (2026-09-06): this used to read "Track
    // record published unfiltered — losing bets are present." The second half
    // is true; the first was not. The cohort filters on bots.maturity_label, so
    // retiring a bot removes its whole settled history from this feed —
    // measured 2026-09-06 at 993 bets (64% of the record) carrying -3.16% ROI.
    // Claiming "unfiltered" while applying a survivorship filter is the one
    // sentence here a reader could call false, so it is gone. The wording now
    // claims only what is true: no winner-picking within what is published.
    // Whether to change the COHORT is a separate, deliberate decision
    // (TRACK-RECORD-SURVIVORSHIP) and the owner has deferred it.
    notes:
      "Every row is an independently re-settleable bet. Use match_id (UUID) + kickoff_utc + market + selection + placed_at_utc to verify against ESPN/Flashscore. Losing bets are present — this feed is not filtered for winners. `stake` and `pnl` per row are €10-flat; internal bots stake proportional to divergence (Kelly) but that's admin-only.",
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
