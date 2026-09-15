/**
 * Dependency-free self-check for verdict.ts (the repo has no test runner).
 *
 * Run:
 *   npx tsc src/lib/shadow-bots/verdict.ts src/lib/shadow-bots/labels.ts \
 *       src/lib/shadow-bots/verdict.selfcheck.ts \
 *       --outDir /tmp/verdict-check --module commonjs --target es2022 \
 *       --skipLibCheck --esModuleInterop --types node && node /tmp/verdict-check/verdict.selfcheck.js
 *
 * Every assertion pins a rule from dev/active/own-implementation-plan.md Phase 6.
 */
import * as assert from "node:assert/strict";
import {
  breakEven,
  gateFloor,
  liveEdge,
  pickVerdict,
  inplayOverride,
  quoteFreshness,
  botVerdict,
  meanSd,
  NO_INPLAY_PLACER_REASON,
  PAUSED_REASON,
  PREREG_MIN_N,
  QUOTE_MAX_AGE_MIN,
} from "./verdict";
import { expiresWithinDays, formatAge, isInplayControlBot } from "./labels";

const close = (a: number | null, b: number, msg = "", eps = 1e-9) => {
  assert.ok(a != null, `${msg} expected ${b}, got null`);
  assert.ok(Math.abs(a - b) < eps, `${msg} expected ${b}, got ${a}`);
};

// ── math ───────────────────────────────────────────────────────────────────
close(breakEven(0.4), 2.5);
assert.equal(breakEven(null), null);
assert.equal(breakEven(0), null);
// 1/(p − thr): p=0.416, thr=0.08 → 2.976… (the PICKS-MIN-ODDS-WRONG-FORMULA case)
close(gateFloor(0.416, 0.08), 1 / 0.336);
assert.equal(gateFloor(0.05, 0.08), null, "gate unreachable when p ≤ threshold");
close(gateFloor(0.5, 0.1, 2.8), 2.8, "placer odds floor raises the gate");
close(gateFloor(0.3, 0.1, 2.8), 5, "placer odds floor does not lower the gate");
close(liveEdge(0.4, 3.0), 0.4 - 1 / 3);
assert.equal(liveEdge(0.4, null), null);

// ── per-pick verdict ───────────────────────────────────────────────────────
const base = {
  prob: 0.4, // BE 2.50
  threshold: 0.1, // gate 3.33
  oddsFloor: null,
  livePrice: 3.4,
  quoteAgeMin: 5,
  minutesToKo: 120,
  placementPaused: false,
  botEnabled: null,
};
assert.equal(pickVerdict(base).verdict, "PLACE");
assert.equal(pickVerdict({ ...base, livePrice: 3.0 }).verdict, "THIN", "≥ BE, < gate");
assert.equal(pickVerdict({ ...base, livePrice: 2.4 }).verdict, "SKIP", "< break-even");
assert.equal(pickVerdict({ ...base, livePrice: null }).verdict, "SKIP", "no placeable price");
assert.equal(pickVerdict({ ...base, quoteAgeMin: QUOTE_MAX_AGE_MIN }).verdict, "SKIP", "stale quote");
assert.equal(pickVerdict({ ...base, quoteAgeMin: QUOTE_MAX_AGE_MIN - 1 }).verdict, "PLACE");
assert.equal(pickVerdict({ ...base, placementPaused: true }).verdict, "BLOCKED");
assert.equal(pickVerdict({ ...base, botEnabled: false }).verdict, "BLOCKED", "bot toggled off");
assert.equal(pickVerdict({ ...base, botEnabled: true }).verdict, "PLACE");
assert.equal(pickVerdict({ ...base, minutesToKo: 2.9 }).verdict, "BLOCKED", "KO < 3 min");
assert.equal(pickVerdict({ ...base, minutesToKo: 3 }).verdict, "PLACE");
// BLOCKED wins over SKIP: a paused system never shows a SKIP that reads as a price problem
assert.equal(pickVerdict({ ...base, placementPaused: true, livePrice: null }).verdict, "BLOCKED");
// unreachable gate but above break-even → THIN, never PLACE
assert.equal(pickVerdict({ ...base, prob: 0.09, threshold: 0.1, livePrice: 12 }).verdict, "THIN");
// placer odds floor gates real-money bots: 1x2 at 2.79 with p=0.5, thr=0.1 → gate 2.80
assert.equal(pickVerdict({ ...base, prob: 0.5, oddsFloor: 2.8, livePrice: 2.79 }).verdict, "THIN");
assert.equal(pickVerdict({ ...base, prob: 0.5, oddsFloor: 2.8, livePrice: 2.8 }).verdict, "PLACE");

// ── freshness (display addition 1a, 2026-09-15) ────────────────────────────
// NULL is UNKNOWN, never FRESH — a missing age is not a guarantee.
assert.equal(quoteFreshness(null), "UNKNOWN");
assert.equal(quoteFreshness(undefined), "UNKNOWN");
assert.equal(quoteFreshness(Number.NaN), "UNKNOWN");
assert.equal(quoteFreshness(0), "FRESH");
assert.equal(quoteFreshness(QUOTE_MAX_AGE_MIN - 0.01), "FRESH");
assert.equal(quoteFreshness(QUOTE_MAX_AGE_MIN), "STALE", "threshold is strict <");
assert.equal(quoteFreshness(4000), "STALE");

assert.equal(formatAge(null), "—");
assert.equal(formatAge(undefined), "—");
assert.equal(formatAge(Number.NaN), "—");
assert.equal(formatAge(-3), "0m", "clock skew clamps, never prints a negative age");
assert.equal(formatAge(12), "12m");
assert.equal(formatAge(29.6), "30m");
assert.equal(formatAge(119), "119m");
assert.equal(formatAge(120), "2h", "minutes up to 2 h");
assert.equal(formatAge(240), "4h");
assert.equal(formatAge(2879), "48h");
assert.equal(formatAge(2880), "2d", "hours up to 48 h");
assert.equal(formatAge(4320), "3d");

// ── in-play (display addition 1b, 2026-09-15) ──────────────────────────────
// An in-play row can NEVER read PLACE: there is no placer for in-play anywhere.
const inplayBase = { ...base, inplay: true };
assert.equal(pickVerdict(inplayBase).verdict, "SKIP", "in-play never PLACE");
assert.equal(pickVerdict(inplayBase).reason, NO_INPLAY_PLACER_REASON);
assert.equal(pickVerdict({ ...inplayBase, livePrice: 3.0 }).verdict, "SKIP", "in-play never THIN");
// kickoff is in the past for every in-play pick — that must not read as the reason
assert.equal(pickVerdict({ ...inplayBase, minutesToKo: -77 }).reason, NO_INPLAY_PLACER_REASON);
// …but a paused system still shows BLOCKED: "the machine is off" outranks it.
assert.equal(pickVerdict({ ...inplayBase, placementPaused: true }).verdict, "BLOCKED");
assert.equal(pickVerdict({ ...inplayBase, placementPaused: true }).reason, PAUSED_REASON);
// the override is the same rule, in isolation
assert.equal(inplayOverride(pickVerdict(base)).verdict, "SKIP");
assert.equal(
  inplayOverride({ verdict: "BLOCKED", reason: PAUSED_REASON, breakEven: null, gateFloor: null, liveEdge: null }).verdict,
  "BLOCKED",
);
assert.equal(
  inplayOverride({ verdict: "BLOCKED", reason: "kickoff < 3 min", breakEven: null, gateFloor: null, liveEdge: null }).verdict,
  "SKIP",
  "a started fixture is the normal state in play, not a block",
);
// the flag is opt-in: an absent `inplay` leaves the pre-match ladder untouched
assert.equal(pickVerdict(base).verdict, "PLACE");

assert.equal(isInplayControlBot("bot_inplay_slowstate_afctl_v1"), true);
assert.equal(isInplayControlBot("bot_inplay_slowstate_v1"), false, "the LIVE arm is not the control");
assert.equal(isInplayControlBot(null), false);

// ── promo expiry highlight (display addition 2, 2026-09-15) ────────────────
const t0 = Date.parse("2026-09-15T12:00:00Z");
assert.equal(expiresWithinDays(null, 7, t0), false);
assert.equal(expiresWithinDays("not a date", 7, t0), false);
assert.equal(expiresWithinDays("2026-09-21T12:00:00Z", 7, t0), true);
assert.equal(expiresWithinDays("2026-09-22T12:00:01Z", 7, t0), false, "8 days out is not expiring");
assert.equal(expiresWithinDays("2026-09-14T12:00:00Z", 7, t0), false, "already expired is not 'expiring'");

// ── per-bot verdict ────────────────────────────────────────────────────────
assert.equal(botVerdict({ n: 17, mean: 0.05, sd: 0.01 }).kind, "COLLECTING");
assert.equal(botVerdict({ n: 17, mean: 0.05, sd: 0.01 }).label, `COLLECTING 17/${PREREG_MIN_N}`);
assert.equal(botVerdict({ n: 299, mean: -0.5, sd: 0.01 }).kind, "COLLECTING", "no RETIRE before n=300");
// n=300, mean +1%, sd 0.08 → se 0.00462, CI half 0.00905 → lower 0.00095 > 0 → PROMOTE
assert.equal(botVerdict({ n: 300, mean: 0.01, sd: 0.08 }).kind, "PROMOTE");
// n=300, mean +0.5%, sd 0.08 → lower −0.004 → OBSERVE
assert.equal(botVerdict({ n: 300, mean: 0.005, sd: 0.08 }).kind, "OBSERVE");
assert.equal(botVerdict({ n: 300, mean: -0.021, sd: 0.08 }).kind, "RETIRE");
assert.equal(botVerdict({ n: 300, mean: -0.02, sd: 0.08 }).kind, "OBSERVE", "RETIRE is strict <");
assert.equal(botVerdict({ n: 0, mean: null, sd: null }).kind, "COLLECTING");

const ms = meanSd([0.1, -0.1, null, 0.3, undefined]);
assert.equal(ms.n, 3);
close(ms.mean, 0.1);
close(ms.sd, 0.2);

console.log("verdict.selfcheck: all assertions passed");
