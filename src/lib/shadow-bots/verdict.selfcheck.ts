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
  botTrack,
  botTrackKind,
  leadBotName,
  LEAD_MIN_N,
  breakEven,
  gateFloor,
  liveEdge,
  pickVerdict,
  inplayOverride,
  quoteFreshness,
  shownEdge,
  DECISION_FRESH_MAX_MIN,
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
// AUTOMATION IS CONTEXT, NOT A VERDICT (2026-09-15). placement_paused and the
// per-bot toggle halt the AUTOMATED placer. This page's Place button only
// RECORDS a bet the operator placed by hand, so blocking the row on them hid
// the price verdict on every row AND stopped the hand-placed bet from ever
// reaching `real_bets`. The row shows an "auto off" marker instead.
assert.equal(pickVerdict({ ...base, placementPaused: true }).verdict, "PLACE");
assert.equal(pickVerdict({ ...base, botEnabled: false }).verdict, "PLACE", "toggle is not a price fact");
assert.equal(pickVerdict({ ...base, botEnabled: true }).verdict, "PLACE");
assert.equal(pickVerdict({ ...base, minutesToKo: 2.9 }).verdict, "BLOCKED", "KO < 3 min");
assert.equal(pickVerdict({ ...base, minutesToKo: 3 }).verdict, "PLACE");
// A genuine price problem still reads as one while automation is off.
assert.equal(pickVerdict({ ...base, placementPaused: true, livePrice: null }).verdict, "SKIP");
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
// The DECISION badge follows the ENGINE's 60-minute definition (the matcher
// refuses a stale leg at 60; `decision_quote_fresh` is `<= 60`). The 30-minute
// QUOTE_MAX_AGE_MIN governs the LIVE quote and the SKIP rule — two different
// quantities, two constants (review 2026-09-15: one constant served both, so
// rows were badged STALE while the engine counted them FRESH).
assert.equal(quoteFreshness(DECISION_FRESH_MAX_MIN), "FRESH", "boundary is inclusive");
assert.equal(quoteFreshness(DECISION_FRESH_MAX_MIN + 0.01), "STALE");
assert.notEqual(DECISION_FRESH_MAX_MIN, QUOTE_MAX_AGE_MIN, "the two ages are not the same quantity");
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
// …and an in-play row is SKIP regardless of automation state.
assert.equal(pickVerdict({ ...inplayBase, placementPaused: true }).verdict, "SKIP");
// placement_paused is CONTEXT, not a blocker (2026-09-15): it halts the
// AUTOMATED placer, while this page's Place button only RECORDS a hand-placed
// bet. A paused system must still show the price verdict.
assert.notEqual(pickVerdict({ ...inplayBase, placementPaused: true }).reason, PAUSED_REASON);
assert.equal(pickVerdict({ ...inplayBase, placementPaused: true }).verdict, "SKIP");
// the override is the same rule, in isolation
assert.equal(inplayOverride(pickVerdict(base)).verdict, "SKIP");
// An in-play pick is past kickoff BY DEFINITION, so the cutoff must be
// converted — otherwise every in-play row blames its own kickoff instead of
// naming the real reason (there is no Epicbet in-play placer).
assert.equal(
  inplayOverride({ verdict: "BLOCKED", reason: "kickoff < 3 min", breakEven: null, gateFloor: null, liveEdge: null }).verdict,
  "SKIP",
  "a started fixture is the normal state in play, not a block",
);
assert.equal(pickVerdict({ ...inplayBase, minutesToKo: -35 }).verdict, "SKIP");
assert.equal(pickVerdict({ ...inplayBase, minutesToKo: -35 }).reason, "no in-play placer");
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
// SHADOW-BOTS-COUNTER-UNITS (2026-09-21): the label carries its UNIT, because
// this n counts margin-corrected own-book CLV rows and the column beside it on
// the board counts settled bets. They diverge widely (v10 reference: 582
// settled / 552 CLV; CB O/U model: 33 / 16), and a bare "16/300" next to "33"
// reads as one of the two numbers being broken.
assert.equal(botVerdict({ n: 17, mean: 0.05, sd: 0.01 }).label, `COLLECTING 17/${PREREG_MIN_N} CLV`);
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

// ── 2026-09-15 corrections from the decision-surface review ────────────────
// A price ABOVE an odds cap is not a better price — the pre-registration says
// the edge above the cap is noise, so it must never read PLACE.
{
  const capped = { ...base, prob: 0.5, threshold: 0.02, oddsFloor: null, oddsCap: 2.5 };
  assert.equal(pickVerdict({ ...capped, livePrice: 2.4 }).verdict, "PLACE");
  assert.equal(pickVerdict({ ...capped, livePrice: 2.6 }).verdict, "SKIP");
  assert.match(pickVerdict({ ...capped, livePrice: 2.6 }).reason, /odds cap/);
}
// The DECISION freshness threshold is the engine's 60, not the live-quote 30.
assert.equal(quoteFreshness(45), "FRESH");
assert.equal(quoteFreshness(61), "STALE");
assert.equal(quoteFreshness(null), "UNKNOWN");
console.log("verdict.selfcheck: 2026-09-15 corrections asserted");

// ── 2026-09-16 · TRACK: which bot am I actually watching? ───────────────────
// Fixture is the REAL board of 2026-09-16 (mean/sd as fractions, from
// shadow_bot_scoreboard). If the classification of these ten changes, the
// change was deliberate or the rule broke — either way it must be seen.
{
  const board: Array<{ name: string; stats: { n: number; mean: number; sd: number } }> = [
    { name: "bot_unibet_trigger_sharp_1x2_v1", stats: { n: 92, mean: +0.0114, sd: 0.151 } },
    { name: "bot_unibet_trigger_sharp_ou_v1", stats: { n: 17, mean: +0.0008, sd: 0.086 } },
    { name: "bot_high_roi_global_v2", stats: { n: 10, mean: -0.0022, sd: 0.091 } },
    { name: "bot_coolbet_trigger_sharp_ou_v1", stats: { n: 27, mean: -0.0059, sd: 0.080 } },
    { name: "bot_coolbet_trigger_sharp_1x2_v1", stats: { n: 102, mean: -0.0228, sd: 0.092 } },
    { name: "bot_coolbet_ou_model_v1", stats: { n: 16, mean: -0.0249, sd: 0.078 } },
    { name: "bot_trigger_1x2_sharp_tight_v1", stats: { n: 45, mean: -0.0299, sd: 0.130 } },
    { name: "bot_coolbet_1x2_model_v1", stats: { n: 9, mean: -0.0359, sd: 0.053 } },
    { name: "bot_v10_1x2", stats: { n: 155, mean: -0.0380, sd: 0.089 } },
    { name: "bot_ou35_model_v1", stats: { n: 23, mean: -0.0469, sd: 0.040 } },
  ];
  const lead = leadBotName(board);
  assert.equal(lead, "bot_unibet_trigger_sharp_1x2_v1", "the lead is the positive-mean bot with the most legs");

  const track = (n: string) => botTrack(board.find((b) => b.name === n)!.stats, n === lead);
  // Whole CI below zero — decided, not "slightly losing".
  for (const n of ["bot_coolbet_trigger_sharp_1x2_v1", "bot_coolbet_1x2_model_v1",
                   "bot_v10_1x2", "bot_ou35_model_v1"]) {
    assert.equal(track(n), "NEGATIVE", n + " CI is entirely below zero");
  }
  // Negative mean but the CI still spans zero — not ruled out.
  for (const n of ["bot_coolbet_ou_model_v1", "bot_trigger_1x2_sharp_tight_v1",
                   "bot_coolbet_trigger_sharp_ou_v1", "bot_high_roi_global_v2"]) {
    assert.equal(track(n), "OPEN", n + " CI still spans zero — not decided");
  }
  // Positive mean but too few legs for the sign to mean anything.
  assert.equal(track("bot_unibet_trigger_sharp_ou_v1"), "OPEN", "n=17 < LEAD_MIN_N");
  assert.equal(track("bot_unibet_trigger_sharp_1x2_v1"), "LEAD");

  // THE ASYMMETRY, asserted directly: ruling OUT needs the whole CI below zero,
  // being the LEAD needs only a positive mean. A bot with a positive mean and a
  // CI that spans zero is still the lead — LEAD is where to look, not a claim
  // that the bot works.
  assert.equal(botTrackKind({ n: 92, mean: +0.0114, sd: 0.151 }), "CANDIDATE");
  assert.ok(0.0114 - 1.96 * (0.151 / Math.sqrt(92)) < 0, "and its CI does span zero");

  // n below the floor can never lead, however good it looks.
  assert.equal(botTrackKind({ n: LEAD_MIN_N - 1, mean: +0.087, sd: 0.294 }), "OPEN");
  assert.equal(leadBotName([{ name: "x", stats: { n: 3, mean: +0.087, sd: 0.294 } }]), null,
    "no qualifying bot must return null, never the least-bad row");
  // An empty board has no lead.
  assert.equal(leadBotName([]), null);
  // Ties break on n, then mean, then name — stable across renders.
  assert.equal(
    leadBotName([
      { name: "b_second", stats: { n: 40, mean: 0.02, sd: 0.1 } },
      { name: "a_first", stats: { n: 40, mean: 0.02, sd: 0.1 } },
    ]),
    "a_first",
  );
}
console.log("verdict.selfcheck: 2026-09-16 TRACK asserted");

// ── shown edge (UX fix round, 2026-09-24) ─────────────────────────────────────
// The tester's case: best 1.62, bot minimum 1.80, raw edge +8.9% — the page must NOT show a
// positive edge on a price below the bot's own minimum.
{
  // p = 0.706 → BE 1.416; threshold 0.15 → gate 1/(0.556) = 1.80
  const inp = { ...base, prob: 0.706, threshold: 0.15, livePrice: 1.62 };
  const v = pickVerdict(inp);
  assert.ok(v.liveEdge != null && v.liveEdge > 0.08, "raw edge is positive (≈ +8.9%)");
  assert.equal(v.verdict, "THIN");
  assert.equal(shownEdge(v, 1.62), null, "between break-even and the minimum → no edge shown");
  // below break-even → the negative edge is shown as is
  const lo = pickVerdict({ ...inp, livePrice: 1.3 });
  assert.ok(shownEdge(lo, 1.3)! < 0, "below break-even the shown edge is negative");
  // at/above the minimum → the edge
  const hi = pickVerdict({ ...inp, livePrice: 1.9 });
  close(shownEdge(hi, 1.9), 0.706 - 1 / 1.9, "at/above the minimum the edge is shown");
  // gate unreachable → nothing shown even though the price beats break-even
  const un = pickVerdict({ ...inp, threshold: 0.8, livePrice: 2.0 });
  assert.equal(un.gateFloor, null);
  assert.equal(shownEdge(un, 2.0), null);
  // no price → nothing
  assert.equal(shownEdge(pickVerdict({ ...inp, livePrice: null }), null), null);
}
console.log("verdict.selfcheck: 2026-09-24 shown edge asserted");
