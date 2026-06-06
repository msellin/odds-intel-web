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
  "1x2":            0.10,
  "o/u":            0.03,
  "asian_handicap": 0.05,
  "btts":           0.10,
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
