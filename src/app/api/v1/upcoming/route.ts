/**
 * GET /api/v1/upcoming
 *
 * PUBLIC, auth-free JSON feed of recent + upcoming pre-match picks. This is the
 * ONLY externally-fetchable feed of picks, and it exists to match the public
 * Telegram channel (@oddsintelpicks) one-to-one.
 *
 * PICKS-PAGE-SHOW-FORWARD-TEST (2026-09-14) — REPOINTED. This route used to
 * serve `simulated_bets` from calibrated bots, and its contract was "the same
 * cohort the public Telegram channel ships". That stopped being true the day
 * the channel switched to the pre-registered sharp-edge forward test: migration
 * 335 removed the O/U Platt calibrator that had manufactured ~8-9pp of the
 * published model edge, after which nothing cleared the old model floors and
 * this feed returned an empty list while claiming to mirror a channel that was
 * posting daily. An endpoint that documents a cohort it no longer serves is
 * worse than one that 404s.
 *
 * It now serves `picks_forward_test`, live arm only — the exact rows posted to
 * the channel.
 *
 * CONTRACT CHANGE, stated rather than slipped in: `edge_pct` is now a SHARP
 * edge (the price against the Shin-de-vigged Pinnacle line, no model) where it
 * used to be a MODEL edge (our calibrated probability minus the implied price).
 * They are different rulers and are NOT comparable across the change, so
 * `meta.edge_basis` names which one a response carries. `min_odds` was already
 * stripped here and stays absent: it was a model break-even, and this rule has
 * no model to take one from.
 *
 * Scope (intentional):
 *   - arm = 'live' — enforced in the view, so the junk-anchor negative control
 *     can never leak into a public feed
 *   - kickoffs from 24h back through +36h, so the feed does not go dark the
 *     moment a match kicks off
 *   - settled picks carry their outcome, and their CLV once it is computed
 *
 * Cache: 60s. Rate limit: 60 req/min/IP.
 */
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchForwardTestPicks } from "@/lib/forward-test-picks";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// DUPLICATED-BUSINESS-RULES-AUDIT-2026-09-05 still applies: there is ONE
// definition of the picks cohort and both /picks and this route call it. It now
// lives in lib/forward-test-picks.ts, and the `arm = 'live'` filter lives one
// level deeper still, in the database view, where a call site cannot forget it.
const HORIZON_HOURS_FORWARD = 36;
const HORIZON_HOURS_BACK = 24;

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

  const nowMs = Date.now();
  const start = new Date(nowMs - HORIZON_HOURS_BACK * 3600 * 1000).toISOString();
  const end = new Date(nowMs + HORIZON_HOURS_FORWARD * 3600 * 1000).toISOString();

  let picks: Array<Record<string, unknown>>;
  try {
    const rows = await fetchForwardTestPicks(
      HORIZON_HOURS_BACK,
      HORIZON_HOURS_FORWARD,
    );
    picks = rows.map((p) => ({
      id: p.id,
      match_id: p.match_id,
      kickoff_utc: p.kickoff_utc,
      league: p.league,
      country: p.country,
      home_team: p.home_team,
      away_team: p.away_team,
      market: p.market,
      selection: p.selection,
      odds: p.odds,
      // SHARP edge, as a percentage. See meta.edge_basis.
      edge_pct: p.edge != null ? Number((Number(p.edge) * 100).toFixed(2)) : null,
      bookmaker: p.bookmaker,
      posted_at_utc: p.published_at,
      // Minutes between the sharp reference quote and this price when the pick
      // was made. Published per row because it is the quantity that separated a
      // +8.47% backtest from a +5.5% one — staleness, not edge.
      alignment_gap_minutes: p.alignment_gap_minutes,
      result: p.outcome ?? "pending",
      clv: p.clv,
    }));
  } catch (e) {
    return NextResponse.json(
      {
        error: "DB error",
        detail: (e instanceof Error ? e.message : String(e)).replace(
          /^forward-test picks: /,
          "",
        ),
      },
      { status: 500 },
    );
  }
  const horizonHoursForward = HORIZON_HOURS_FORWARD;
  // `generated_at_utc` is derived from the window rather than a second
  // `new Date()`, so the old invariant `window_end_utc === generated_at_utc +
  // 36h` still holds exactly. Two independent clocks would leave a sub-ms
  // drift and, on a midnight boundary, a window_start a day ahead.
  const now = new Date(
    new Date(end).getTime() - horizonHoursForward * 3600 * 1000,
  );

  return NextResponse.json(
    {
      meta: {
        generated_at_utc: now.toISOString(),
        window_start_utc: start,
        window_end_utc: end,
        horizon_hours_forward: horizonHoursForward,
        count: picks.length,
        edge_basis:
          "sharp — edge = P(Shin-de-vigged Pinnacle) x best_book_price - 1. NOT a model edge. Before 2026-09-14 this field carried a MODEL edge (calibrated probability minus implied price); the two are different rulers and are not comparable across that date.",
        scope:
          "public feed — the pre-registered sharp-edge forward test, live arm only, exactly the picks posted to the public Telegram channel. Rule: edge >= 3%, odds <= 4.0, sharp anchor and bet quote within 60 minutes, top 8 per day by edge. Kickoffs from 24h back through +36h, so the feed does not go dark the moment a match kicks off. The junk-anchor negative control is never served here.",
        notes:
          "No past performance is claimed for this method: it started 2026-09-14 at zero. Picks with result='pending' have not settled. 'push'/'void' mean the stake was returned. `clv` is the raw price ratio against the same book's closing price, with no margin removed, so break-even on it is that book's margin rather than zero.",
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
