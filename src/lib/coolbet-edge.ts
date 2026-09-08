/**
 * Pure, client-safe per-market edge thresholds. Lives in its own file so
 * client components (e.g. `place-bet-table.tsx`) can import `autoMinEdgeFor`
 * without dragging `engine-data.ts` — and via it `supabase-server.ts` +
 * `next/headers` — into the client bundle. Next 16 / Turbopack rejects that
 * import graph at build time.
 *
 * Mirrors `_MIN_EDGE_BY_MARKET` in `workers/automation/coolbet_placer.py`.
 * See `dev/active/per-market-thresholds-plan.md` for the backtest that
 * picked these floors. `null` means retired — never auto-place this market.
 */

/** Legacy single-floor threshold (kept for any external callers). New code
 * should call `autoMinEdgeFor(market)` so each market gets its own floor. */
export const COOLBET_AUTO_MIN_EDGE = 0.05;

/** Legacy live-edge floor — see autoMinEdgeFor() for the per-market version. */
export const COOLBET_AUTO_MIN_REMAINING_EDGE = 0.03;

export const COOLBET_AUTO_MIN_EDGE_BY_MARKET: Record<string, number | null> = {
  // BOT-CONFIG-GOLDEN-MIDDLE-2026-09-08: kept at 0.10 (a brief raise to 0.15
  // was overturned by a full-history backtest — 0.15 lost in-sample and was
  // indistinguishable from 0.13 out-of-sample; 0.10 makes the most absolute
  // profit). Mirrors coolbet_placer.py — keep in lockstep for the badge.
  "1x2":            0.10,
  "o/u":            0.03,
  "asian_handicap": 0.05,
  // BTTS-RETIRED-2026-09-03: mirrors the engine's _MIN_EDGE_BY_MARKET.
  // n=427 settled shadow picks returned -12.76% at prices live at pick time
  // (t=-2.87), and better calibration made the survivors worse.
  "btts":           null,
  "double_chance":  null,
  "combo":          0.10,
  "draw_no_bet":    0.05,
};

/** Per-market edge floor. Returns `Infinity` for retired markets (any
 * `edge >= autoMinEdgeFor(m)` comparison is False), and the legacy 3%
 * default for unknown markets. */
export function autoMinEdgeFor(market: string | null | undefined): number {
  if (!market) return 0.03;
  const v = COOLBET_AUTO_MIN_EDGE_BY_MARKET[market.toLowerCase()];
  if (v === undefined) return 0.03;
  if (v === null) return Infinity;
  return v;
}

/** Timestamp when per-market thresholds went live. Real-bets page splits
 * stats pre/post this epoch so we can measure the lift in isolation.
 * Bets placed AT OR AFTER this time are "era v2". */
export const MARKET_THRESHOLDS_V2_EPOCH = "2026-06-06T17:00:00Z";

// ─── Per-bot edge thresholds ────────────────────────────────────────────────
// DUPLICATED-BUSINESS-RULES-AUDIT-2026-09-05. This map existed as two
// copy-pasted literals — one inside the render loop of
// `/admin/shadow-bots/page.tsx` and one at module scope in
// `/admin/shadow-bots/[bot]/page.tsx`. They happened to agree numerically
// (the index copy omitted `bot_no_pin_shadow_v1` but its `?? 0.08` fallback
// produced the same 0.08), which is exactly the latent state that produced
// the 2026-09-05 four-surface incident: two copies that agree until one is
// edited.
//
// Values are decimal fractions of PROBABILITY-POINT edge — this engine
// computes `edge = cal_prob - 1/odds` (daily_pipeline_v2.py:3474), NOT a
// multiplicative EV. Do not feed these into `(1 + threshold) / prob`.
//
// PER-BOT-SWEEP-2026-08-24: the three line-shop bots gate on DE-VIGGED edge
// (`_LINESHOP_TRUE_EDGE_MIN`). Picks written before 2026-08-24 carry
// vig-inclusive edge and are not comparable.
//
// COOLBET-UI-PLACER (2026-08-27): `bot_coolbet_value_v1` must stay present.
// When it was missing it fell through to the 0.08 default and every min-odds
// floor was computed at an 8% edge while the bot fires at 3% — on 2026-08-27
// that marked all 11 of its live picks "below floor" when 3 cleared the real
// threshold. A too-high floor is silent: it looks like caution, not a bug.
export const BOT_EDGE_THRESHOLDS: Record<string, number> = {
  bot_no_pin_shadow_v1: 0.08,
  // Retired 2026-08-24 — kept so historical rows still resolve a threshold.
  bot_no_pin_home_v1: 0.08,
  bot_sweep_1x2_home_v1: 0.10,
  bot_sweep_1x2_draw_v1: 0.05,
  bot_sweep_btts_yes_v1: 0.05,
  bot_coolbet_value_v1: 0.03,
  bot_sweep_ou25_v1: 0.03,
  bot_sweep_ou35_v1: 0.03,
  bot_pin_1x2_home_v1: 0.03,
  bot_pin_1x2_draw_tier4_v1: 0.05,
};

/** Edge threshold for a shadow bot. Unknown bots fall back to 0.08, matching
 *  the `?? 0.08` both admin pages used before this was centralised. */
export function botEdgeThreshold(botName: string | null | undefined): number {
  if (!botName) return 0.08;
  return BOT_EDGE_THRESHOLDS[botName] ?? 0.08;
}
