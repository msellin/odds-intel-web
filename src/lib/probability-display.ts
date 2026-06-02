/**
 * CALIBRATION-DISPLAY-CAP (2026-06-02) — display-layer truth-claim safeguard.
 *
 * Why: production audit (90d, n=2,631 settled bets) shows our model is
 * structurally overconfident at the high-confidence tail. The 0.9 bucket
 * predicts 90% probability but actual hit rate is 65-67% — a +23pp gap.
 * Post-Platt calibration helps the 0.6 bucket (only +4pp gap) but FAILS at
 * 0.7+ (+21pp, +23pp at 0.9). Isotonic was tested and made things worse
 * (see dev/active/calibration-ceiling-findings.md).
 *
 * Until we have a real fix (more high-conf settled samples → refit isotonic
 * with tail density, post-WC), we cap displayed probabilities at 70%. The
 * internal model + bot edge math are unchanged; only what users SEE is
 * capped.
 *
 * Reversibility: when the structural fix lands, delete this file and
 * inline-replace `displayProb(p)` with `${(p * 100).toFixed(0)}%`.
 */

export const CONFIDENCE_CEILING = 0.70;

/**
 * Display a model probability honestly. Above the calibration ceiling, we
 * show "70%+ (high confidence)" instead of the specific overclaim.
 *
 *   displayProb(0.42) → "42%"
 *   displayProb(0.69) → "69%"
 *   displayProb(0.70) → "70%+"
 *   displayProb(0.92) → "70%+"
 */
export function displayProb(prob: number, digits = 0): string {
  if (!isFinite(prob) || prob < 0) return "—";
  if (prob >= CONFIDENCE_CEILING) return "70%+";
  return `${(prob * 100).toFixed(digits)}%`;
}

/**
 * Same as displayProb but for use inside <div> templates where we just want
 * the number portion. The "+" suffix is rendered separately by the caller.
 *
 *   displayProbNumber(0.42) → { value: 42, capped: false }
 *   displayProbNumber(0.92) → { value: 70, capped: true }
 */
export function displayProbNumber(prob: number, digits = 0): { value: number | null; capped: boolean } {
  if (!isFinite(prob) || prob < 0) return { value: null, capped: false };
  if (prob >= CONFIDENCE_CEILING) return { value: 70, capped: true };
  return { value: Number((prob * 100).toFixed(digits)), capped: false };
}

/**
 * Tooltip / explainer text used wherever we render the capped "70%+" label.
 * Cite the empirical reason so users with technical-curiosity understand
 * we're not lazy — we're honest.
 */
export const CONFIDENCE_CEILING_EXPLAINER =
  "Capped at 70% — our model's highest-confidence picks have historically hit ~66% of the time, so we never display higher to avoid overclaiming.";
