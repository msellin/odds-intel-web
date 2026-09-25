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
/**
 * A LIVE quote this old (minutes) is stale: SKIP, never PLACE. This is the age
 * of the price we are showing you now — how likely it is to still be on the
 * book's screen.
 */
export const QUOTE_MAX_AGE_MIN = 30;

/**
 * A DECISION quote older than this was not a price anybody could take when the
 * bot decided. 60 is the ENGINE's definition, not a second opinion: the trigger
 * matcher refuses a stale leg at 60 (`FRESHNESS_MAX_AGE_MIN`) and
 * `shadow_bets_own_book_clv.decision_quote_fresh` is `<= 60`. The page used 30
 * here too, so two live rows were badged STALE while the engine counted them
 * FRESH (decision-surface review, 2026-09-15). Two different quantities, two
 * constants, each named for what it measures.
 */
export const DECISION_FRESH_MAX_MIN = 60;
/** Inside this many minutes of kickoff the placer refuses; so do we. */
export const KO_BLOCK_MIN = 3;

/** Reason string for the paused-system block. A constant because the in-play
 * override below has to recognise it without matching a free-text string. */
export const PAUSED_REASON = "placement paused";
/**
 * Standing reason on every in-play row. There is no placer for in-play at any
 * book we can bet — the slow-state rig is an INSTRUMENT, priced off Epicbet's
 * on-screen board, and nothing downstream can stake it. Shown so the operator
 * is never invited to act on a row the system cannot execute.
 */
export const NO_INPLAY_PLACER_REASON = "no in-play placer";

/**
 * How fresh the quote a decision rested on was.
 * `UNKNOWN` is a THIRD state on purpose: a NULL age means either the leg was
 * written before `decision_quote_age_min` existed (2026-09-15) or the bot has
 * no freshness gate at all. Folding it into FRESH would read as a guarantee we
 * never made — the exact shape of RELIABILITY_LEDGER §"unconfirmable".
 */
export type Freshness = "FRESH" | "STALE" | "UNKNOWN";

/** FRESH strictly under QUOTE_MAX_AGE_MIN; NULL/non-finite is UNKNOWN, never FRESH. */
export function quoteFreshness(ageMin: number | null | undefined): Freshness {
  if (ageMin == null || !Number.isFinite(ageMin)) return "UNKNOWN";
  return ageMin <= DECISION_FRESH_MAX_MIN ? "FRESH" : "STALE";
}

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
  /**
   * The bot's OWN odds floor, from the registry (`ENGINE_BOT_FLOORS`). Was
   * derived from `coolbet_placer_bots` — a table only the two real-money bots
   * have a row in — so for every other bot it resolved to null and the gate
   * floor rendered LOWER than the bot's own, turning rows into PLACE that the
   * engine has never been allowed to stake (review, 2026-09-15).
   */
  oddsFloor: number | null;
  /**
   * The bot's odds CAP, if it has one (the sharp-tight instrument is
   * `edge >= 2% AND odds <= 2.50`). A cap is not a floor: above it the
   * pre-registration says the edge is noise, so a price above the cap must
   * never read as better — or the greenest row would be the one the rule
   * excludes.
   */
  oddsCap?: number | null;
  /** Best price at a PLACEABLE book (Coolbet / Unibet-Site). Null = none. */
  livePrice: number | null;
  /** Age of that quote in minutes. Null when there is no quote. */
  quoteAgeMin: number | null;
  /** Minutes until kickoff (negative = started). */
  minutesToKo: number;
  /**
   * coolbet_session_state.placement_paused. NOTE (2026-09-15): this is context,
   * NOT a blocker. It halts the AUTOMATED placer; the operator places by hand,
   * and the Place button on this page only RECORDS what they placed. Blocking
   * the row on it meant the ledger never learned about a hand-placed bet — the
   * opposite of why that path exists. The safety strip states it loudly; the
   * row shows a muted "auto off" marker; the verdict stays about the PRICE.
   */
  placementPaused: boolean;
  /**
   * coolbet_placer_bots.ui_place_enabled for this bot. `null` = the bot has no
   * placer row (paper bot) — the toggle does not apply and cannot block.
   */
  botEnabled: boolean | null;
  /** `shadow_bets.inplay_minute IS NOT NULL` — the pick was raised in play. */
  inplay?: boolean;
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
 *
 * `pickVerdict` wraps this with `inplayOverride` — see below.
 */
function corePickVerdict(i: PickVerdictInput): PickVerdictResult {
  const be = breakEven(i.prob);
  const gf = gateFloor(i.prob, i.threshold, i.oddsFloor);
  const le = liveEdge(i.prob, i.livePrice);
  const base = { breakEven: be, gateFloor: gf, liveEdge: le };

  // BLOCKED means "you cannot act on this row", not "automation is off".
  // placement_paused and the per-bot toggle govern the AUTOMATED placer; they
  // are surfaced as a muted marker and in the safety strip instead of
  // flattening every row to BLOCKED and hiding the price verdict (review
  // 2026-09-15: all 44 rows read BLOCKED, so the column carried no information).
  if (i.minutesToKo < KO_BLOCK_MIN) return { verdict: "BLOCKED", reason: "kickoff < 3 min", ...base };

  if (i.livePrice == null || !(i.livePrice > 1)) {
    return { verdict: "SKIP", reason: "no placeable price", ...base };
  }
  if (i.quoteAgeMin == null || i.quoteAgeMin >= QUOTE_MAX_AGE_MIN) {
    return { verdict: "SKIP", reason: `quote ≥ ${QUOTE_MAX_AGE_MIN} min old`, ...base };
  }
  if (be == null) return { verdict: "SKIP", reason: "no anchor probability", ...base };
  if (i.livePrice < be) return { verdict: "SKIP", reason: "price below break-even", ...base };

  const cap = i.oddsCap ?? null;
  if (cap != null && i.livePrice > cap) {
    return { verdict: "SKIP", reason: `above the ${cap.toFixed(2)} odds cap`, ...base };
  }
  if (gf != null && i.livePrice >= gf) return { verdict: "PLACE", reason: "price clears gate floor", ...base };
  return {
    verdict: "THIN",
    reason: gf == null ? "gate unreachable at this prob" : "above break-even, below gate",
    ...base,
  };
}

/**
 * In-play override — an in-play row can NEVER read PLACE.
 *
 * Why a separate pure function rather than another branch inside the ladder:
 * this is not a threshold that could be retuned, it is a statement about what
 * exists. No placement path accepts an in-play leg, so a green chip on such a
 * row would be an instruction the operator cannot carry out. Applied LAST so a
 * paused system still shows BLOCKED — "the whole machine is off" is a truer and
 * more urgent message than "this particular row is unplaceable".
 */
export function inplayOverride(v: PickVerdictResult): PickVerdictResult {
  // The kickoff cutoff is converted too, deliberately: an in-play pick is BY
  // DEFINITION past kickoff, so leaving it BLOCKED would make every in-play row
  // blame its own kickoff instead of naming the real reason — there is no
  // Epicbet in-play placer. (Before 2026-09-15 the exception here was
  // placement_paused; that stopped being a blocker when automation became
  // context rather than a verdict, so no BLOCKED reason survives for in-play.)
  return { ...v, verdict: "SKIP", reason: NO_INPLAY_PLACER_REASON };
}

/**
 * The edge the Pick queue SHOWS, at the best available price now (UX fix round, 2026-09-24).
 *
 * `liveEdge` is p − 1/price, which stays POSITIVE between break-even and the bot's own
 * minimum price. Shown bare, that read as "+8.9% edge" on a row whose price (1.62) was below
 * the bot's minimum (1.80) — an invitation to bet a price the bot itself would not take.
 * So the shown edge is:
 *   • below break-even        → the (negative) edge, as is;
 *   • break-even … minimum    → null ("—, below the bot's minimum"): positive, but not an edge
 *                               the bot would act on;
 *   • no reachable minimum    → null, for the same reason;
 *   • at or above the minimum → the edge.
 */
export function shownEdge(v: PickVerdictResult, livePrice: number | null | undefined): number | null {
  if (v.liveEdge == null || livePrice == null) return null;
  if (v.breakEven != null && livePrice < v.breakEven) return v.liveEdge;
  if (v.gateFloor == null || livePrice < v.gateFloor) return null;
  return v.liveEdge;
}

/** The per-pick verdict, with the in-play override applied when it applies. */
export function pickVerdict(i: PickVerdictInput): PickVerdictResult {
  const v = corePickVerdict(i);
  return i.inplay === true ? inplayOverride(v) : v;
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
    // SHADOW-BOTS-COUNTER-UNITS (2026-09-21). The label carries "CLV" because
    // this n is NOT the settled-bet count sitting two columns to its left.
    //
    // The pre-registration's checkpoints are counted in margin-corrected
    // own-book CLV ROWS, and a settled bet only yields one when we captured a
    // close AT THE BOOK THE PICK WAS PRICED AT. So the two diverge, often
    // widely: CB O/U model reads 33 settled / 16 CLV, v10 reference 582 / 552.
    // Rendered as a bare "COLLECTING 16/300" beside "33", it reads as a bug in
    // one number or the other — and the operator's reasonable conclusion,
    // "it's further along than it says", is the wrong one.
    return { kind: "COLLECTING", label: `COLLECTING ${s.n}/${PREREG_MIN_N} CLV`, ciHalf, t };
  }
  if (s.mean != null && ciHalf != null && s.mean - ciHalf > 0) {
    return { kind: "PROMOTE", label: "PROMOTE", ciHalf, t };
  }
  if (s.mean != null && s.mean < PREREG_RETIRE_CLV) {
    return { kind: "RETIRE", label: "RETIRE", ciHalf, t };
  }
  return { kind: "OBSERVE", label: "OBSERVE", ciHalf, t };
}

// ── which bot am I actually watching? (2026-09-16) ───────────────────────────
/**
 * `botVerdict()` answers the PRE-REGISTERED question — "is this bot decided?"
 * — and under n = 300 the honest answer is COLLECTING for every bot on the
 * board. That is correct and it is useless as a place to look: fifteen bots
 * render identically, so the operator's eye goes to the green PLACE chips
 * instead, which are a per-PICK price test and say nothing about whether the
 * bot behind them works. On 2026-09-16 three of the five PLACE rows belonged to
 * the single most conclusively negative bot we have.
 *
 * TRACK is the second, weaker question: "given what we know TODAY, is this bot
 * still a live candidate?" It is deliberately NOT a verdict and never gates
 * anything — it only decides where the page points your attention.
 *
 *   NEGATIVE  the whole 95% CI sits below zero. Not "slightly losing" — decided,
 *             at this n. More data on it buys information about how negative,
 *             not about whether.
 *   LEAD      the candidate closest to resolving: mean above zero on enough legs
 *             for the sign to mean anything, and the most legs among those.
 *             Exactly one bot, or none.
 *   CANDIDATE mean above zero and past LEAD_MIN_N, but another bot is further along.
 *   OPEN      everything else — too few legs to have a sign, or a negative mean
 *             whose CI still spans zero. This is the "not ruled out" bucket: a
 *             positive truth is still inside the interval.
 *
 * Note the asymmetry, and that it is intentional: NEGATIVE needs the entire CI
 * below zero, LEAD needs only a positive mean. Ruling a bot OUT should be hard;
 * pointing the operator AT one is a suggestion about where to look, not a claim
 * that it works. The page must never render LEAD as an endorsement.
 */
export type BotTrack = "LEAD" | "CANDIDATE" | "NEGATIVE" | "OPEN" | "WAITING";

/** Families whose fair value IS the sharp anchor line: a close on that same line cannot judge them fairly (#150) — "can't judge yet". Anchor-based, NOT a bookmaker veto. */
export const UNJUDGEABLE_FAMILIES = new Set(["sharp_trigger", "sharp_generator"]);
/** Forward-test arms priced off the de-vigged sharp anchor line (bot_config family 'forward_test') — same reason. */
export const UNJUDGEABLE_BOTS = new Set(["bot_sharp_1x2_v1", "bot_sharp_ou_v1", "bot_sharp_aligned_v1"]);

/**
 * Below this many CLV legs the sign of the mean is noise, so a bot cannot be
 * the lead however good it looks. 30 is a judgement call, not a pre-registered
 * constant — with mc-CLV sd ≈ 8–15pp, n = 30 still leaves a ±3–5pp interval.
 * It is here to stop an n = 3 bot at +8.7pp from becoming the thing we watch.
 */
export const LEAD_MIN_N = 30;

/**
 * NEGATIVE / positive-mean / OPEN, before the cross-bot LEAD pick is applied.
 *
 * ONE LIMIT, STATED HERE BECAUSE THE PAGE CANNOT STATE IT: OPEN means more
 * margin-corrected CLV could still move this bot, and CLV is measured against
 * the closing line. A book that is PERSISTENTLY soft in some segment has a
 * closing line that is wrong too, so CLV there reads ≈ −margin by construction
 * and accumulating it will never reveal the edge. That class of mispricing is
 * only visible in OUTCOMES, which need ~15,600 bets to resolve at ROI's
 * variance. OPEN is therefore "not ruled out by this instrument", never "not
 * ruled out by anything".
 */
export function botTrackKind(s: BotStats): "NEGATIVE" | "CANDIDATE" | "OPEN" {
  const { ciHalf } = botVerdict(s);
  if (s.mean == null) return "OPEN";
  if (ciHalf != null && s.mean + ciHalf < 0) return "NEGATIVE";
  if (s.n >= LEAD_MIN_N && s.mean > 0) return "CANDIDATE";
  return "OPEN";
}

/**
 * The one bot to watch, or null when nothing qualifies — which is a legitimate
 * and expected answer, and the page says so rather than promoting the
 * least-bad row.
 *
 * Among CANDIDATEs, most legs wins: it is nearest its own resolution, so it is
 * where waiting actually buys something. Ties break on the higher mean, then
 * on name so the choice is stable across renders.
 */
export function leadBotName(
  rows: Array<{ name: string; stats: BotStats }>,
): string | null {
  const c = rows.filter((r) => botTrackKind(r.stats) === "CANDIDATE");
  if (c.length === 0) return null;
  c.sort(
    (a, b) =>
      b.stats.n - a.stats.n ||
      (b.stats.mean ?? 0) - (a.stats.mean ?? 0) ||
      a.name.localeCompare(b.name),
  );
  return c[0].name;
}

/** Final per-bot track, given the board-wide lead. */
export function botTrack(s: BotStats, isLead: boolean): BotTrack {
  const k = botTrackKind(s);
  if (k === "CANDIDATE") return isLead ? "LEAD" : "CANDIDATE";
  return k;
}
