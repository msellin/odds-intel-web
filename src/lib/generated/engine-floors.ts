// GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: workers/automation/coolbet_placer.py
// Regenerate:      python3 scripts/gen_frontend_floors.py
// Drift guard:     smoke test FLOORS-ONE-SOURCE-CROSS-LANGUAGE
//
// Why this file exists (FLOORS-ONE-SOURCE-CROSS-LANGUAGE, 2026-09-11):
// upcoming-picks.ts hardcoded 0.1/2.8 and 0.08/1.8 and its own copy of the
// FAVLONG-CUTS home-underdog rule, with no import path to Python. A floor
// change in the engine never reached the published "place >= X.XX" hint that
// readers act on. Six copies of the edge floors existed across the stack; this
// closes the cross-language ones.

export const ENGINE_MIN_EDGE_BY_MARKET: Record<string, number | null> =
  {
  "1x2": 0.13,
  "asian_handicap": 0.05,
  "btts": null,
  "combo": 0.1,
  "double_chance": null,
  "draw_no_bet": 0.05,
  "o/u": 0.08
};

export const ENGINE_MIN_ODDS_BY_MARKET: Record<string, number> =
  {
  "1x2": 2.8,
  "asian_handicap": 1.0,
  "draw_no_bet": 1.0,
  "o/u": 1.8
};

/** FAVLONG-CUTS: 1x2 HOME underdogs (odds >= the 1x2 odds floor) clear at this
 *  edge. Home-favs and aways stay on the pooled floor — they are not
 *  fold-robust at 10%. */
export const ENGINE_MODEL_1X2_HOME_FLOOR = 0.1;

/** Parity fixture, computed by Python's real min_edge_for_pick(). A test
 *  asserts the TS rule reproduces every row. Constants agreeing while the RULE
 *  drifts is exactly how these paths diverged before, so pinning the numbers
 *  alone is not enough. */
export const ENGINE_FLOOR_FIXTURE: ReadonlyArray<{
  market: string; selection: string; odds: number; floor: number;
}> = [
  {
    "market": "1x2",
    "selection": "home",
    "odds": 3.3,
    "floor": 0.1
  },
  {
    "market": "1x2",
    "selection": "home",
    "odds": 2.8,
    "floor": 0.1
  },
  {
    "market": "1x2",
    "selection": "home",
    "odds": 2.79,
    "floor": 0.13
  },
  {
    "market": "1x2",
    "selection": "away",
    "odds": 3.3,
    "floor": 0.13
  },
  {
    "market": "1x2",
    "selection": "draw",
    "odds": 3.3,
    "floor": 0.13
  },
  {
    "market": "over_under_25",
    "selection": "under",
    "odds": 2.93,
    "floor": 0.08
  },
  {
    "market": "o/u",
    "selection": "over",
    "odds": 1.85,
    "floor": 0.08
  }
];
