/**
 * Pure Poisson scoreline math — no DB, no I/O.
 *
 * Mirrors `workers/model/national_team_predictor.py::_matrix` from the engine
 * so the frontend can derive the joint P(home_goals=i, away_goals=j) grid
 * from λ_home / λ_away and surface the top-N most likely exact scorelines.
 *
 * Used by `components/wc-score-predictions.tsx` to render a compact
 * "Top 5 scorelines" table on WC match-detail pages.
 *
 * Assumes independence between the two scoring rates — same simplification
 * the engine's national-team predictor uses (no Dixon-Coles ρ correction in
 * v1). For tournament-scale λs (typically 0.5..2.5) the truncated 9×9 grid
 * captures >99.9% of the mass.
 */

const MAX_GOALS_PER_SIDE = 8;

/** P(X = k) for X ~ Poisson(λ). */
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  // log-space avoids overflow on edge cases; we cap at k=8.
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** Pre-cache Poisson PMFs over [0..MAX_GOALS_PER_SIDE] for a given λ. */
function pmfTable(lambda: number): number[] {
  const out = new Array<number>(MAX_GOALS_PER_SIDE + 1);
  for (let k = 0; k <= MAX_GOALS_PER_SIDE; k++) out[k] = poissonPmf(k, lambda);
  return out;
}

export interface ScorelineProbability {
  home: number;
  away: number;
  /** Joint probability P(home_goals=home, away_goals=away). 0..1. */
  prob: number;
}

/**
 * Return the top-N most likely exact scorelines for a Poisson(λ_h)×Poisson(λ_a)
 * match. Results are sorted by `prob` descending, ties broken by lower total
 * goals first (a 1-1 ranks above 2-2 when they share probability, etc.).
 *
 * The probabilities sum to a value strictly less than 1.0 because we only
 * return the top tail of the full joint distribution. For sensible WC λs
 * (0.8..2.0 per side) the top 5 typically cover 45-60% of the mass.
 *
 * Defensive against bad input:
 *   - λ ≤ 0 → treated as 0 (everyone scores 0 → only 0-0 has mass)
 *   - non-finite λ → empty list
 *   - count ≤ 0 → empty list
 */
export function topScorelines(
  lambdaHome: number,
  lambdaAway: number,
  count: number = 5
): ScorelineProbability[] {
  if (!Number.isFinite(lambdaHome) || !Number.isFinite(lambdaAway)) return [];
  if (count <= 0) return [];

  const lh = Math.max(0, lambdaHome);
  const la = Math.max(0, lambdaAway);
  const ph = pmfTable(lh);
  const pa = pmfTable(la);

  const all: ScorelineProbability[] = [];
  for (let i = 0; i <= MAX_GOALS_PER_SIDE; i++) {
    for (let j = 0; j <= MAX_GOALS_PER_SIDE; j++) {
      const p = ph[i] * pa[j];
      if (p <= 0) continue;
      all.push({ home: i, away: j, prob: p });
    }
  }

  all.sort((a, b) => {
    if (b.prob !== a.prob) return b.prob - a.prob;
    // tie-break: prefer the lower-total-goals scoreline (cleaner UX)
    return a.home + a.away - (b.home + b.away);
  });

  return all.slice(0, count);
}

/**
 * Derive a (λ_home, λ_away) pair from 1X2 model probabilities (0..1 scale)
 * when the engine hasn't persisted explicit lambdas. Mirrors the heuristic
 * in `lib/win-probability.ts::solveBaselineLambdas`:
 *
 *   - total expected goals = `totalGoals` (caller-supplied; defaults to 2.5
 *     which is the WC qualifying-era average per match)
 *   - home share = P(home) + 0.5 × P(draw)
 *
 * Used as a fallback in `wc-score-predictions.tsx` when `predictions.reasoning`
 * doesn't expose `lam_h`/`lam_a` (the engine currently writes a plain string;
 * see `scripts/write_national_team_predictions.py`).
 */
export function lambdasFromPriors(
  modelHome: number,
  modelDraw: number,
  modelAway: number,
  totalGoals: number = 2.5
): { lambdaHome: number; lambdaAway: number } {
  const total = modelHome + modelDraw + modelAway;
  if (!(total > 0)) {
    return { lambdaHome: totalGoals / 2, lambdaAway: totalGoals / 2 };
  }
  const winShareHome = (modelHome + 0.5 * modelDraw) / total;
  // Clamp to [0.05, 0.95] to avoid degenerate λ ≈ 0 cases.
  const share = Math.max(0.05, Math.min(0.95, winShareHome));
  return {
    lambdaHome: Math.max(0.15, totalGoals * share),
    lambdaAway: Math.max(0.15, totalGoals * (1 - share)),
  };
}
