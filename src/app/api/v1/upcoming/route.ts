/**
 * GET /api/v1/upcoming
 *
 * PUBLIC, auth-free JSON feed of recent + upcoming pre-match picks. This is
 * the ONLY externally-fetchable feed of picks, and it is deliberately
 * narrowed to the same cohort the public Telegram channel ships
 * (@oddsintelpicks) so the two surfaces match one-to-one.
 *
 * PICKS-USER-GATE (2026-08-22): narrowed from calibrated+beta+active down to
 * calibrated only. Signed-in users get the wider cohort when they load
 * /picks — that widening happens server-side inside the page render, never
 * via a JSON endpoint. This means the beta+active picks cannot be scraped
 * from the network tab by an anon caller.
 *
 * Scope (intentional):
 *   - bots.maturity_label = 'calibrated'  — same set the public Telegram sends
 *   - bots.retired_at IS NULL  — exclude retired bots
 *   - bots.name NOT LIKE 'inplay_%'  — pre-match cohort only
 *   - market IN ('1x2', 'over_under_25', 'o/u', 'btts')  — pre-match only
 *   - match kickoff between start of today UTC and NOW() + 36 hours
 *   - result IN ('pending','won','lost','void')  — badge shows outcome
 *
 * PICKS-COHORT-ALIGN (2026-08-21): added retired_at + inplay_% filters so
 * /picks describes the SAME cohort as /performance's ledger + hero.
 *
 * PICKS-WIDEN (2026-07-08): earlier version was NOW→NOW+36h + result='pending'
 * only, which made /picks look empty as soon as a match kicked off. Widening
 * backward + surfacing result badges lets the page double as social proof.
 *
 * Cache: 60s. Rate limit: 60 req/min/IP.
 */
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  fetchUpcomingPicks,
  PUBLIC_MATURITY_LABELS,
} from "@/lib/upcoming-picks";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// DUPLICATED-BUSINESS-RULES-AUDIT-2026-09-05.
//
// This route used to carry its own copy of the cohort rule: a second
// `PRE_MATCH_MARKETS`, a second `PUBLIC_MATURITY_LABELS`, a second
// `adminClient()`, a second `BetRow`, and a line-for-line duplicate of the
// query, the dedupe and the row mapping in `lib/upcoming-picks.ts` — which
// /picks calls for the SAME picks. Two implementations of one feed is how the
// landing and /performance came to publish +13.10% and +17.39% for identical
// bets on 2026-09-05.
//
// It now calls `fetchUpcomingPicks()`. The published JSON is unchanged:
// same cohort (calibrated only), same window, same dedupe, same fields. The
// one field the shared fetcher additionally computes, `min_odds`, is stripped
// below — publishing a break-even floor on the anon feed is a product
// decision, not a refactor.
const HORIZON_HOURS_FORWARD = 36;

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

  let picks: Array<Record<string, unknown>>;
  let start: string;
  let end: string;
  try {
    // Single definition of the picks cohort — see lib/upcoming-picks.ts.
    const res = await fetchUpcomingPicks(PUBLIC_MATURITY_LABELS);
    start = res.windowStart;
    end = res.windowEnd;
    // `min_odds` is computed by the shared fetcher for /picks; it is not part
    // of this endpoint's published contract, so drop it rather than silently
    // widening the public payload.
    picks = res.picks.map(({ min_odds: _minOdds, ...rest }) => rest);
  } catch (e) {
    return NextResponse.json(
      {
        error: "DB error",
        // Strip the fetcher's context prefix so this endpoint's 500 body is
        // unchanged from when it ran its own query.
        detail: (e instanceof Error ? e.message : String(e)).replace(
          /^upcoming picks: /,
          "",
        ),
      },
      { status: 500 }
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
        scope:
          "public feed — pre-match picks from calibrated bots only (same cohort as the Telegram public channel), non-retired, non-inplay, kickoffs from start of today UTC through +36h. Signed-in users see a wider cohort (calibrated + beta + active) inline on /picks; that wider set is not available via any JSON endpoint. Includes settled picks (won/lost/void) so the feed doesn't go dark right after a match kicks off.",
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
