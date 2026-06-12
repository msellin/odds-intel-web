/**
 * WC-B1-B4 — server-side data loader for the per-fixture Model Card surfaced
 * on the match-detail page (above the tabs) for WC2026 fixtures.
 *
 * For one match_id, fetch:
 *   - own model: predictions.source = 'national_team_v1'
 *   - blended:   predictions.source = 'national_team_v1_blended'
 *   - lineup:    predictions.source = 'national_team_v1_lineup' (T-60min refresh)
 *   - market:    wc_market_consensus (home/draw/away probs + n_sources)
 *
 * Each probability triple is returned as numbers in 0..1, normalised. Any row
 * that's missing (or partially populated) comes back as `null` so the card UI
 * can render its "X data unavailable" placeholder cleanly.
 *
 * Why a tiny dedicated module: keeps the loader testable + decoupled from
 * `wc-record.ts` (which is the global predictions-record loader for the
 * whole tournament). Doing it in `engine-data.ts` would balloon that already
 * 2600-line file.
 */

import { createSupabasePublic } from "./supabase-public";

// Engine writes the unblended ELO+Poisson model under "national_team_v1" and
// the market-blended Bayesian version under "national_team_v1_blended". The
// model card needs BOTH side-by-side — do NOT reuse the world-cup.ts
// `OWN_MODEL_SOURCE` constant: that one was flipped to
// "national_team_v1_blended" by WC-A4-FE-SWITCH and now tracks "what to show
// on the /world-cup landing page", not "the own model identity". Importing
// it here caused the card's "own" row to silently mirror the blended row.
const OWN_MODEL_SOURCE = "national_team_v1";
const BLENDED_MODEL_SOURCE = "national_team_v1_blended";
const LINEUP_MODEL_SOURCE = "national_team_v1_lineup";

export interface ModelCardTriple {
  /** 0-1 — normalised so home+draw+away ~= 1. */
  home: number;
  draw: number;
  away: number;
}

export interface ModelCardMarket extends ModelCardTriple {
  /** n_sources from wc_market_consensus — useful for the "λ scaled down" note. */
  nSources: number;
}

export interface ModelCardData {
  /** Own ELO+Poisson national_team_v1 — null if missing or partial. */
  own: ModelCardTriple | null;
  /** Own × market blend (national_team_v1_blended) — null until A4 lands. */
  blended: ModelCardTriple | null;
  /** Lineup-refreshed (national_team_v1_lineup) — null until T-60 job lands. */
  lineup: ModelCardTriple | null;
  /** wc_market_consensus row — null if the scraper hasn't seen this fixture. */
  market: ModelCardMarket | null;
  /** First non-empty reasoning string we find across the three sources. */
  reasoning: string | null;
}

interface RawPredictionRow {
  market: string;
  model_probability: number | null;
  source: string;
  reasoning: string | null;
}

interface RawMarketRow {
  home_prob: string | number;
  draw_prob: string | number;
  away_prob: string | number;
  n_sources: number;
}

interface Accumulator {
  home: number | null;
  draw: number | null;
  away: number | null;
  reasoning: string | null;
}

function emptyAccumulator(): Accumulator {
  return { home: null, draw: null, away: null, reasoning: null };
}

function assignSelection(acc: Accumulator, market: string, value: number | null): void {
  const m = market.toLowerCase();
  // Match the three writer conventions used historically — colon, underscore, bare.
  // Mirrors world-cup.ts `mergePredictionRow`.
  const isHome = m.endsWith(":home") || m.endsWith("_home") || m === "home";
  const isDraw = m.endsWith(":draw") || m.endsWith("_draw") || m === "draw";
  const isAway = m.endsWith(":away") || m.endsWith("_away") || m === "away";
  if (isHome) acc.home = value;
  else if (isDraw) acc.draw = value;
  else if (isAway) acc.away = value;
}

function normaliseTriple(home: number, draw: number, away: number): ModelCardTriple | null {
  const sum = home + draw + away;
  if (!isFinite(sum) || sum <= 0) return null;
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

function finaliseTriple(acc: Accumulator | undefined): ModelCardTriple | null {
  if (!acc) return null;
  if (acc.home == null || acc.draw == null || acc.away == null) return null;
  return normaliseTriple(acc.home, acc.draw, acc.away);
}

function asNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) : v;
}

/**
 * Argmax pick from a 1X2 triple. Ties break to '1' to match
 * `modelPickFromTriple` in wc-vs-you-helpers.
 */
export function pickFromTriple(t: ModelCardTriple): "1" | "X" | "2" {
  const max = Math.max(t.home, t.draw, t.away);
  if (t.home === max) return "1";
  if (t.away === max) return "2";
  return "X";
}

/**
 * Confidence band on the favourite probability — used by the model-card
 * header tag. Aligned with how the rest of the WC UI talks about confidence.
 */
export function confidenceBand(t: ModelCardTriple): "HIGH" | "MED" | "LOW" {
  const max = Math.max(t.home, t.draw, t.away);
  if (max >= 0.6) return "HIGH";
  if (max >= 0.4) return "MED";
  return "LOW";
}

/**
 * Probability assigned to a specific side by a triple.
 */
export function probOnPick(t: ModelCardTriple, pick: "1" | "X" | "2"): number {
  if (pick === "1") return t.home;
  if (pick === "2") return t.away;
  return t.draw;
}

/**
 * Server-side loader. Single Supabase round-trip per table; cheap.
 */
export async function loadWCModelCard(matchId: string): Promise<ModelCardData> {
  const supabase = createSupabasePublic();

  const [predsRes, marketRes] = await Promise.all([
    supabase
      .from("predictions")
      .select("market, model_probability, source, reasoning")
      .eq("match_id", matchId)
      .in("source", [
        OWN_MODEL_SOURCE,
        BLENDED_MODEL_SOURCE,
        LINEUP_MODEL_SOURCE,
      ]),
    supabase
      .from("wc_market_consensus")
      .select("home_prob, draw_prob, away_prob, n_sources")
      .eq("match_id", matchId)
      .maybeSingle(),
  ]);

  const bySource = new Map<string, Accumulator>();
  let reasoning: string | null = null;
  for (const row of (predsRes.data ?? []) as RawPredictionRow[]) {
    if (!bySource.has(row.source)) bySource.set(row.source, emptyAccumulator());
    const acc = bySource.get(row.source)!;
    assignSelection(acc, row.market, row.model_probability);
    if (row.reasoning && !acc.reasoning) acc.reasoning = row.reasoning;
    if (row.reasoning && !reasoning) reasoning = row.reasoning;
  }

  const own = finaliseTriple(bySource.get(OWN_MODEL_SOURCE));
  const blended = finaliseTriple(bySource.get(BLENDED_MODEL_SOURCE));
  const lineup = finaliseTriple(bySource.get(LINEUP_MODEL_SOURCE));

  let market: ModelCardMarket | null = null;
  const rawMarket = marketRes.data as RawMarketRow | null;
  if (rawMarket) {
    const normalised = normaliseTriple(
      asNumber(rawMarket.home_prob),
      asNumber(rawMarket.draw_prob),
      asNumber(rawMarket.away_prob)
    );
    if (normalised) {
      market = { ...normalised, nSources: rawMarket.n_sources ?? 0 };
    }
  }

  return { own, blended, lineup, market, reasoning };
}
