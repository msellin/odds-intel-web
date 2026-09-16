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
 * It now serves `picks_public_all` — BOTH bot families, the exact rows posted
 * to the channel.
 *
 * SECOND CONTRACT CHANGE, 2026-09-16 (PICKS-SHOW-BOTH-BOTS), stated rather
 * than slipped in. This served the sharp arm alone from 2026-09-14. /picks now
 * renders both families, and leaving this endpoint on the sharp ledger would
 * have (a) split ONE published cohort across two surfaces — the thing
 * PICKS-COHORT-ALIGN exists to prevent — and (b) left the `scope` string below
 * claiming to be "exactly the picks posted to the public Telegram channel"
 * while `bot_v10_all` posted to that channel and was absent here.
 *
 * ⚠️ SO `edge_pct` NOW CARRIES TWO DIFFERENT QUANTITIES, and the new
 * `edge_kind` field says which per row:
 *
 *     'sharp' -> P(Shin-de-vigged Pinnacle) x price - 1   an expected RETURN
 *     'model' -> calibrated_prob - 1/price                PROBABILITY POINTS
 *
 * A consumer that averages `edge_pct` across rows is now averaging two
 * different units and must split on `edge_kind` first. `edge_kind` and `bot`
 * are ADDITIVE — no existing field changed name or type — but this is the
 * breaking-ish part and it is why `meta.edge_basis` leads with it.
 *
 * (The first change, 2026-09-14: `edge_pct` went from a MODEL edge to a SHARP
 * one when the page was repointed. `min_odds` was stripped then and stays
 * absent — it was a model break-even.)
 *
 * Scope (intentional):
 *   - arm = 'live' — enforced in the view, so the junk-anchor negative control
 *     can never leak into a public feed
 *   - `bots.show_on_picks` — the model arm is curated; a bot is invisible here
 *     until someone switches it on
 *   - kickoffs from 24h back through +36h, so the feed does not go dark the
 *     moment a match kicks off
 *   - settled picks carry their outcome, and their CLV once it is computed
 *
 * Cache: 60s. Rate limit: 60 req/min/IP.
 */
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchPublicPicks } from "@/lib/forward-test-picks";

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
    // PICKS-SHOW-BOTH-BOTS (2026-09-16). Was fetchForwardTestPicks — the sharp
    // arm only. /picks moved to the union of both bot families, and leaving
    // this endpoint on the sharp ledger would have split one published cohort
    // across two surfaces (PICKS-COHORT-ALIGN), AND left this route's own meta
    // claiming to be "exactly the picks posted to the public Telegram channel"
    // while bot_v10_all posted to that channel and was absent here.
    const rows = await fetchPublicPicks(
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
      // ⚠️ edge_pct MEANS TWO DIFFERENT THINGS AND edge_kind SAYS WHICH.
      //   'sharp' -> p_sharp x odds - 1       an expected RETURN
      //   'model' -> cal_prob - 1/odds        PROBABILITY POINTS
      // They are not comparable and must never be averaged together. A 16.0
      // model edge at odds of 4.00 is roughly +64% expected return; a 3.3
      // sharp edge is 3.3%. Both fields are new as of 2026-09-16 and are
      // ADDITIVE — no existing field changed name or type — but a consumer
      // that was averaging edge_pct across rows must now split on edge_kind.
      edge_kind: p.edge_kind,
      bot: p.bot,
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
          "MIXED as of 2026-09-16 — read `edge_kind` on every pick before comparing any two. edge_kind='sharp': edge_pct = P(Shin-de-vigged Pinnacle) x best_book_price - 1, an expected RETURN. edge_kind='model': edge_pct = calibrated_probability - 1/price, PROBABILITY POINTS against our own model, NOT a return — a 16.0 model edge at odds of 4.00 is roughly +64% expected return. The two are different rulers and must never be averaged together. History: before 2026-09-14 this field was model-only; from 2026-09-14 to 2026-09-16 it was sharp-only.",
        scope:
          "public feed — every pick posted to the public Telegram channel, from BOTH bot families, identified per row by `edge_kind` and `bot`. SHARP arm: the pre-registered forward test, live arm only — edge >= 3%, odds <= 4.0, sharp anchor and bet quote within 60 minutes, no daily selection cap (a 60/day runaway breaker only). MODEL arm: bots with bots.show_on_picks = true, pre-match singles only, no combos and no in-play. Kickoffs from 24h back through +36h, so the feed does not go dark the moment a match kicks off. The junk-anchor negative control is never served here.",
        notes:
          "No past performance is claimed for the SHARP method: it started 2026-09-14 at zero. The MODEL arm predates that and has its own separate record; neither arm's history transfers to the other. Picks with result='pending' have not settled. 'push'/'void' mean the stake was returned. `clv` is the raw price ratio against the same book's closing price, with no margin removed, so break-even on it is that book's margin rather than zero.",
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
