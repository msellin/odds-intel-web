/**
 * market-vocab.ts — the ONE market/selection vocabulary for the frontend.
 *
 * Mirror of the engine's `workers/canonical_market.py` (MARKET-VOCAB-CANONICAL).
 * The same bet has historically been stored several ways — market `1X2` vs `1x2`,
 * `O/U` / `o/u` vs `over_under_25`, selection `over 2.5` vs `over`. This module is
 * the single place that collapses every spelling to one canonical form, so every
 * filter / bridge / label routes through it instead of hardcoding literals.
 *
 * `normalizeMarket` accepts BOTH legacy and canonical spellings and returns the
 * canonical `{ family, market, selection, line }`, or null if unrecognised. It is
 * intentionally tolerant: it must keep working during the Phase-2 migration when
 * the DB still holds a mix of old and new spellings.
 *
 * NB: the predictions vocabulary (`1x2_home` / `1x2_draw` / `1x2_away`) is a
 * SEPARATE namespace and is deliberately NOT handled here.
 */

export interface CanonicalBet {
  family: string; // '1x2' | 'o/u' | 'btts' | 'double_chance' | 'asian_handicap' | 'draw_no_bet' | 'combo' | '<x>_ou'
  market: string; // canonical storage market, e.g. '1x2', 'over_under_25', 'btts'
  selection: string; // canonical selection, e.g. 'home', 'over', 'yes', '1x'
  line: number | null;
}

const OU_MARKET_RE = /^over_under_(\d{2,3})$/;
const GENERIC_OU_RE = /^([a-z0-9]+(?:_[a-z0-9]+)*_ou)_(\d{2,3})$/;
const OU_SEL_RE = /^\s*(over|under)\s+(\d+(?:\.\d+)?)\s*$/i;
const AH_SEL_RE = /^(home|away)\s*([+-]?\d+(?:\.\d+)?)?$/;
const ONE_X_TWO_SEL: Record<string, string> = {
  "1": "home", x: "draw", "2": "away", home: "home", draw: "draw", away: "away",
};

const digitsToLine = (d: string): number => parseInt(d, 10) / 10;
const lineToOuMarket = (line: number): string =>
  "over_under_" + String(Math.round(line * 10)).padStart(2, "0");

export function normalizeMarket(
  market: string | null | undefined,
  selection: string | null | undefined,
): CanonicalBet | null {
  if (!market) return null;
  const m = String(market).trim().toLowerCase();
  const s = (selection == null ? "" : String(selection)).trim().toLowerCase();

  if (m === "1x2") {
    const sel = ONE_X_TWO_SEL[s];
    return sel ? { family: "1x2", market: "1x2", selection: sel, line: null } : null;
  }

  // Over/Under total goals — line may live in the market (over_under_25) or the selection ('over 2.5')
  let line: number | null = null;
  let side: string | null = null;
  const om = OU_MARKET_RE.exec(m);
  if (om) {
    line = digitsToLine(om[1]);
    if (s === "over" || s === "under") side = s;
    else {
      const ms = OU_SEL_RE.exec(selection ?? "");
      side = ms ? ms[1].toLowerCase() : null;
    }
  } else if (m === "o/u" || m === "ou" || m === "over_under") {
    const ms = OU_SEL_RE.exec(selection ?? "");
    if (ms) {
      side = ms[1].toLowerCase();
      line = parseFloat(ms[2]);
    } else if (s === "over" || s === "under") {
      side = s;
    }
  }
  if (side === "over" || side === "under") {
    return { family: "o/u", market: line != null ? lineToOuMarket(line) : "", selection: side, line };
  }

  // parametric over/under families with the line in the market name (corners_ou_95, cards_home_ou_20, …)
  const cm = GENERIC_OU_RE.exec(m);
  if (cm) {
    return s === "over" || s === "under"
      ? { family: cm[1], market: m, selection: s, line: digitsToLine(cm[2]) }
      : null;
  }

  if (m === "btts") {
    return s === "yes" || s === "no" ? { family: "btts", market: "btts", selection: s, line: null } : null;
  }
  if (m === "double_chance") {
    return s === "1x" || s === "12" || s === "x2"
      ? { family: "double_chance", market: "double_chance", selection: s, line: null }
      : null;
  }
  if (m === "asian_handicap") {
    const am = AH_SEL_RE.exec(s);
    return am
      ? { family: "asian_handicap", market: "asian_handicap", selection: am[1], line: am[2] ? parseFloat(am[2]) : null }
      : null;
  }
  if (m === "draw_no_bet") {
    return s === "home" || s === "away"
      ? { family: "draw_no_bet", market: "draw_no_bet", selection: s, line: null }
      : null;
  }
  if (m === "combo") {
    return s ? { family: "combo", market: "combo", selection: s, line: null } : null;
  }
  return null;
}

/** True iff (market, selection) canonicalises into `family` (spelling-agnostic). */
export function isFamily(market: string | null | undefined, family: string): boolean {
  return normalizeMarket(market, market === "asian_handicap" ? "home" : "")?.family === family
    || normalizeMarket(market, "over")?.family === family
    || normalizeMarket(market, "home")?.family === family;
}

const FAMILY_LABEL: Record<string, string> = {
  "1x2": "Match Result",
  "o/u": "Over/Under",
  btts: "Both Teams to Score",
  double_chance: "Double Chance",
  asian_handicap: "Asian Handicap",
  draw_no_bet: "Draw No Bet",
  combo: "Combo",
};
const SEL_LABEL: Record<string, string> = {
  home: "Home", draw: "Draw", away: "Away", over: "Over", under: "Under",
  yes: "Yes", no: "No", "1x": "1X", "12": "12", x2: "X2",
};

/** Human label for any (market, selection), spelling-agnostic. */
export function marketLabel(
  market: string | null | undefined,
  selection: string | null | undefined,
): string {
  const c = normalizeMarket(market, selection);
  if (!c) return [market, selection].filter(Boolean).join(" ");
  const famBase = FAMILY_LABEL[c.family] ?? c.family;
  if (c.family === "o/u" || c.family.endsWith("_ou")) {
    const sel = SEL_LABEL[c.selection] ?? c.selection;
    return c.line != null ? `${sel} ${c.line}` : `${famBase} ${sel}`;
  }
  if (c.family === "1x2" || c.family === "double_chance" || c.family === "btts") {
    return SEL_LABEL[c.selection] ?? c.selection;
  }
  if (c.family === "asian_handicap") {
    const sel = SEL_LABEL[c.selection] ?? c.selection;
    return c.line != null ? `AH ${sel} ${c.line > 0 ? "+" : ""}${c.line}` : `AH ${sel}`;
  }
  return `${famBase} ${SEL_LABEL[c.selection] ?? c.selection}`;
}
