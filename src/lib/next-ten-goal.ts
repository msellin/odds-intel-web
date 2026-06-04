/**
 * WC-D4 helper — next-10-minute goal probability.
 *
 * Given the latest live xG snapshot (combined home + away xG accumulated to
 * minute M), estimate the per-minute scoring rate and project it forward 10
 * minutes via a Poisson model:
 *
 *   λ_per_min = (home_xg + away_xg) / max(minute, 1)
 *   λ_10      = λ_per_min * 10
 *   P(≥1)     = 1 - exp(-λ_10)
 *
 * Returns null when the inputs don't support a meaningful estimate (no
 * snapshot, pre-kickoff, or zero accumulated xG with zero minutes).
 *
 * Kept in its own module so the API route and the server component widget
 * can both call into the exact same math — and so the smoke description can
 * point at a single helper.
 */

export interface NextTenGoalInput {
  minute: number | null | undefined;
  homeXg: number | null | undefined;
  awayXg: number | null | undefined;
}

/**
 * Compute P(≥1 goal in next 10 minutes) from accumulated live xG.
 *
 * Returns a number in [0, 1] when computable, else null. Never throws.
 */
export function nextTenGoalProb(input: NextTenGoalInput): number | null {
  const minute = input.minute ?? null;
  const homeXg = input.homeXg == null ? null : Number(input.homeXg);
  const awayXg = input.awayXg == null ? null : Number(input.awayXg);
  if (minute == null || minute <= 0) return null;
  if (homeXg == null && awayXg == null) return null;
  if (!Number.isFinite(homeXg ?? 0) || !Number.isFinite(awayXg ?? 0)) return null;
  const totalXg = (homeXg ?? 0) + (awayXg ?? 0);
  if (totalXg <= 0) return null;
  const lambdaPerMin = totalXg / Math.max(minute, 1);
  const lambda10 = lambdaPerMin * 10;
  // Clamp into [0, 1] defensively (Poisson math is already bounded, but
  // floating-point edge cases shouldn't leak weird values into the UI).
  const p = 1 - Math.exp(-lambda10);
  if (!Number.isFinite(p)) return null;
  return Math.max(0, Math.min(1, p));
}

/**
 * One-line interpretation of the probability — "Likely", "Even", "Unlikely".
 * Thresholds match the widget copy.
 */
export function nextTenGoalVerdict(p: number): "Likely" | "Even" | "Unlikely" {
  if (p >= 0.55) return "Likely";
  if (p >= 0.35) return "Even";
  return "Unlikely";
}
