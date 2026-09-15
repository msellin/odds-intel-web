/**
 * Pure decision rules for /admin/shadow-bots (OWN Phase 6, 2026-09-15).
 *
 * No imports on purpose: this file is the one place the per-pick and per-bot
 * verdicts are defined, and it must stay runnable in isolation so the
 * self-check (`verdict.selfcheck.ts`) can exercise it without Next.
 *
 * Two vocabularies live here and must not be confused:
 *   • per-PICK verdict — "should I take this price right now?" — a function
 *     of the bot's anchor probability, its edge threshold, the live placeable
 *     price and its age, and the safety flags.
 *   • per-BOT verdict — "does this bot work?" — the pre-registered rule on
 *     MARGIN-CORRECTED own-book CLV (break-even 0), NOT raw CLV (break-even ≈
 *     the book's margin) and NOT ROI (per-bet sd ≈ 1.3, needs ~15,600 bets).
 *     See dev/active/own-sharp-tight-preregistration.md in the engine repo.
 */

// ── pre-registration constants (engine: OWN pre-registration, 2026-09-15) ──
/** Bots with fewer margin-corrected own-book CLV rows than this have no verdict. */
export const PREREG_MIN_N = 300;
/** Mean margin-corrected CLV below this at n ≥ PREREG_MIN_N retires the bot. */
export const PREREG_RETIRE_CLV = -0.02;
/** PROMOTE requires the 95% CI lower bound above zero. */
export const CI_Z = 1.96;

// ── per-pick thresholds ─────────────────────────────────────────────────────
/** A live quote this old (minutes) is stale: SKIP, never PLACE. */
export const QUOTE_MAX_AGE_MIN = 30;
/** Inside this many minutes of kickoff the placer refuses; so do we. */
export const KO_BLOCK_MIN = 3;

export type PickVerdict = "PLACE" | "THIN" | "SKIP" | "BLOCKED";
export const PICK_VERDICT_RANK: Record<PickVerdict, number> = {
  PLACE: 0,
  THIN: 1,
  SKIP: 2,
  BLOCKED: 3,
};

/** Break-even price for the bot's anchor probability: 1/p. */
export function breakEven(prob: number | null | undefined): number | null {
  if (prob == null || !(prob > 0) || prob >= 1) return null;
  return 1 / prob;
}

/**
 * The price below which the bot itself would not have raised the pick.
 * Our gate is `edge = p − 1/odds ≥ threshold`, so odds ≥ 1/(p − threshold).
 * Null when p ≤ threshold — no finite price clears the gate.
 * `oddsFloor` (the placer's per-market minimum, e.g. 2.80 for 1x2) raises
 * the result when supplied; pass null for bots the placer does not gate.
 */
export function gateFloor(
  prob: number | null | undefined,
  threshold: number,
  oddsFloor: number | null = null,
): number | null {
  if (prob == null || !(prob > 0) || prob >= 1) return null;
  if (!(threshold >= 0) || prob <= threshold) return null;
  const g = 1 / (prob - threshold);
  return oddsFloor != null && oddsFloor > g ? oddsFloor : g;
}

/** Edge at the shown price against the bot's own anchor: p − 1/price. */
export function liveEdge(
  prob: number | null | undefined,
  price: number | null | undefined,
): number | null {
  if (prob == null || price == null || !(price > 1)) return null;
  return prob - 1 / price;
}

export interface PickVerdictInput {
  /** Anchor probability (calibrated_prob: model prob for model bots, sharp prob for sharp bots). */
  prob: number | null;
  /** The bot's edge threshold in probability points (e.g. 0.10). */
  threshold: number;
  /** Placer odds floor for this market, if the placer gates this bot; else null. */
  oddsFloor: number | null;
  /** Best price at a PLACEABLE book (Coolbet / Unibet-Site). Null = none. */
  livePrice: number | null;
  /** Age of that quote in minutes. Null when there is no quote. */
  quoteAgeMin: number | null;
  /** Minutes until kickoff (negative = started). */
  minutesToKo: number;
  /** coolbet_session_state.placement_paused */
  placementPaused: boolean;
  /**
   * coolbet_placer_bots.ui_place_enabled for this bot. `null` = the bot has no
   * placer row (paper bot) — the toggle does not apply and cannot block.
   */
  botEnabled: boolean | null;
}

export interface PickVerdictResult {
  verdict: PickVerdict;
  /** One short phrase explaining the verdict (≤ ~60 chars). */
  reason: string;
  breakEven: number | null;
  gateFloor: number | null;
  liveEdge: number | null;
}

/**
 * Rules, evaluated in this order (first match wins):
 *   BLOCKED — placement paused, or bot toggled off, or KO < 3 min
 *   SKIP    — no placeable price, or quote ≥ 30 min old, or price < break-even,
 *             or no break-even (no anchor prob)
 *   PLACE   — price ≥ gate floor (and quote < 30 min, not blocked)
 *   THIN    — price ≥ break-even but < gate floor (or gate unreachable)
 */
export function pickVerdict(i: PickVerdictInput): PickVerdictResult {
  const be = breakEven(i.prob);
  const gf = gateFloor(i.prob, i.threshold, i.oddsFloor);
  const le = liveEdge(i.prob, i.livePrice);
  const base = { breakEven: be, gateFloor: gf, liveEdge: le };

  if (i.placementPaused) return { verdict: "BLOCKED", reason: "placement paused", ...base };
  if (i.botEnabled === false) return { verdict: "BLOCKED", reason: "bot toggled off", ...base };
  if (i.minutesToKo < KO_BLOCK_MIN) return { verdict: "BLOCKED", reason: "kickoff < 3 min", ...base };

  if (i.livePrice == null || !(i.livePrice > 1)) {
    return { verdict: "SKIP", reason: "no placeable price", ...base };
  }
  if (i.quoteAgeMin == null || i.quoteAgeMin >= QUOTE_MAX_AGE_MIN) {
    return { verdict: "SKIP", reason: `quote ≥ ${QUOTE_MAX_AGE_MIN} min old`, ...base };
  }
  if (be == null) return { verdict: "SKIP", reason: "no anchor probability", ...base };
  if (i.livePrice < be) return { verdict: "SKIP", reason: "price below break-even", ...base };

  if (gf != null && i.livePrice >= gf) return { verdict: "PLACE", reason: "price clears gate floor", ...base };
  return {
    verdict: "THIN",
    reason: gf == null ? "gate unreachable at this prob" : "above break-even, below gate",
    ...base,
  };
}

// ── per-bot verdict (pre-registration) ─────────────────────────────────────
export type BotVerdictKind = "COLLECTING" | "PROMOTE" | "RETIRE" | "OBSERVE";

export interface BotStats {
  /** Rows with a margin-corrected own-book CLV value. */
  n: number;
  /** Mean of clv_margin_corrected (fraction, e.g. −0.031). */
  mean: number | null;
  /** Sample sd of clv_margin_corrected. */
  sd: number | null;
}

export interface BotVerdictResult {
  kind: BotVerdictKind;
  /** e.g. "COLLECTING 17/300" */
  label: string;
  /** 95% CI half-width (fraction), null when n < 2. Cluster-naive: 1.96·sd/√n. */
  ciHalf: number | null;
  /** t = mean / (sd/√n), null when sd is 0 or n < 2. */
  t: number | null;
}

/** mean, sample sd and n over a list of fractions; nulls skipped. */
export function meanSd(values: Array<number | null | undefined>): BotStats {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const n = xs.length;
  if (n === 0) return { n: 0, mean: null, sd: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, mean, sd: null };
  const varS = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(varS) };
}

/**
 * Verbatim pre-registration:
 *   COLLECTING n/300  if n < 300
 *   PROMOTE           if CI lower bound (mean − 1.96·sd/√n) > 0
 *   RETIRE            if mean < −2%
 *   OBSERVE           otherwise
 */
export function botVerdict(s: BotStats): BotVerdictResult {
  const se = s.sd != null && s.n >= 2 ? s.sd / Math.sqrt(s.n) : null;
  const ciHalf = se != null ? CI_Z * se : null;
  const t = se != null && se > 0 && s.mean != null ? s.mean / se : null;

  if (s.n < PREREG_MIN_N) {
    return { kind: "COLLECTING", label: `COLLECTING ${s.n}/${PREREG_MIN_N}`, ciHalf, t };
  }
  if (s.mean != null && ciHalf != null && s.mean - ciHalf > 0) {
    return { kind: "PROMOTE", label: "PROMOTE", ciHalf, t };
  }
  if (s.mean != null && s.mean < PREREG_RETIRE_CLV) {
    return { kind: "RETIRE", label: "RETIRE", ciHalf, t };
  }
  return { kind: "OBSERVE", label: "OBSERVE", ciHalf, t };
}
