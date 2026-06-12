/**
 * WC-C1 — public predictions-record loader.
 *
 * For every SETTLED WC2026 fixture, join:
 *   - our own model's 1X2 probability triple (predictions.source IN
 *     'national_team_v1', or 'national_team_v1_blended' once A4 lands —
 *     blended takes precedence per fixture when both rows exist),
 *   - market consensus (wc_market_consensus),
 *   - the actual outcome (matches.status='finished' + score_home/score_away).
 *
 * Compute:
 *   - hit rate (top-pick == actual)
 *   - Brier score: mean squared error of the 3-class probability vector
 *     against the actual one-hot outcome. Lower is better; 0 = perfect.
 *   - log-loss: -mean(log(p_actual)). Lower is better.
 *   - CLV vs market: average of (own_p_on_actual - market_p_on_actual).
 *     Positive means our model was more confident on the eventual outcome
 *     than the market was — the standard "closing line value" pattern.
 *   - calibration: bucket model probs into 10pp bins (0-10, 10-20, …, 90-100),
 *     for each bin record (predicted mean, actual hit rate, count).
 *
 * Pre-tournament: every collection is empty and the summary is null. The
 * page must render a calm placeholder in that case.
 *
 * Read path: anon supabase client (createSupabasePublic). All three tables
 * have public-read RLS already (migrations 166, 177 — see the engine repo).
 */

import { createSupabasePublic } from "./supabase-public";
import {
  WORLD_CUP_LEAGUE_API_ID,
} from "./world-cup";

// Engine writes the unblended ELO+Poisson model under "national_team_v1" and
// the market-blended Bayesian version under "national_team_v1_blended". This
// loader needs BOTH side-by-side (own vs blended) — do NOT reuse the
// world-cup.ts `NATIONAL_TEAM_MODEL_SOURCE` constant: that one was flipped to
// "national_team_v1_blended" by WC-A4-FE-SWITCH and now tracks "what to show
// on the /world-cup landing page", not "the own model identity". Importing it
// here caused the leaderboard's "OddsIntel (own model)" and "OddsIntel
// (blended)" rows to collapse to the same source.
const OWN_MODEL_SOURCE = "national_team_v1";
const BLENDED_MODEL_SOURCE = "national_team_v1_blended";

// ── Public types ─────────────────────────────────────────────────────────────

export interface ProbTriple {
  home: number; // 0-1
  draw: number;
  away: number;
}

export type Outcome = "1" | "X" | "2";

export interface RecordRow {
  matchId: string;
  date: string;            // ISO kickoff
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  actual: Outcome;
  /** Our model — null when no prediction was recorded for this fixture. */
  model: ProbTriple | null;
  /** Market consensus — null when no market row exists for this fixture. */
  market: ProbTriple | null;
  /** Pick by our model (argmax). Null when model is null. */
  modelPick: Outcome | null;
  /** Pick by market (argmax). Null when market is null. */
  marketPick: Outcome | null;
  modelHit: boolean | null;
  marketHit: boolean | null;
  /** Whether this row uses the blended source rather than raw national_team_v1. */
  modelIsBlended: boolean;
}

export interface RecordSummary {
  nSettled: number;            // matches counted in any metric (>= modelHits etc.)
  modelN: number;              // matches with our model present
  marketN: number;             // matches with market present
  bothN: number;               // matches with both (CLV pool)
  modelHits: number;
  marketHits: number;
  modelBrier: number | null;   // null when modelN == 0
  marketBrier: number | null;
  modelLogLoss: number | null;
  marketLogLoss: number | null;
  /** Avg(own_p_on_actual − market_p_on_actual) over bothN — null when bothN == 0. */
  clv: number | null;
  /** Headline favourites called: count of settled matches where modelPick had
   *  highest market consensus too, AND model was right. Compact "X/Y favs" stat. */
  favouritesCalled: number;
  favouritesTotal: number;
}

export interface CalibrationBucket {
  /** 0.0, 0.1, 0.2, … 0.9 — bucket lower edge. */
  lower: number;
  upper: number;                // lower + 0.1
  meanPredicted: number;        // mean predicted prob inside bucket (0 if empty)
  actualHitRate: number;        // observed fraction (0 if empty)
  count: number;
}

export interface Record {
  summary: RecordSummary | null;   // null when nSettled == 0
  byMatch: RecordRow[];            // settled rows only, sorted by date DESC
  calibration: CalibrationBucket[]; // always length 10 (empty buckets ok)
}

// ── Internal: raw DB row shapes ──────────────────────────────────────────────

interface RawMatchRow {
  id: string;
  date: string;
  status: string;
  score_home: number | null;
  score_away: number | null;
  home_team: RawTeamRow | RawTeamRow[] | null;
  away_team: RawTeamRow | RawTeamRow[] | null;
}

interface RawTeamRow {
  id: string;
  name: string;
}

interface RawPredictionRow {
  match_id: string;
  market: string;
  model_probability: number | null;
  source: string;
}

interface RawConsensusRow {
  match_id: string;
  home_prob: string | number;
  draw_prob: string | number;
  away_prob: string | number;
}

// ── Helpers (exported for unit-testability, even if smoke is source-inspect) ─

export function actualFromScore(sh: number, sa: number): Outcome {
  if (sh > sa) return "1";
  if (sh < sa) return "2";
  return "X";
}

export function pickFromTriple(p: ProbTriple): Outcome {
  const m = Math.max(p.home, p.draw, p.away);
  if (p.home === m) return "1";
  if (p.away === m) return "2";
  return "X";
}

/**
 * Brier score for a single 3-class prediction against a one-hot actual.
 *   BS = sum_i (p_i - y_i)^2
 * Range: 0 (perfect) to 2 (worst — all mass on the wrong class). We report
 * the mean across matches; the spec calls this "Brier score" without the
 * /N convention argument — using the standard "sum of squared errors per
 * row, averaged" definition (matches sklearn brier_score_loss for binary
 * and is the convention used in published WC backtest literature).
 */
export function brierRow(p: ProbTriple, actual: Outcome): number {
  const yH = actual === "1" ? 1 : 0;
  const yD = actual === "X" ? 1 : 0;
  const yA = actual === "2" ? 1 : 0;
  return (
    (p.home - yH) * (p.home - yH) +
    (p.draw - yD) * (p.draw - yD) +
    (p.away - yA) * (p.away - yA)
  );
}

export function logLossRow(p: ProbTriple, actual: Outcome): number {
  // Clamp away from 0 to avoid -Infinity when a source assigns 0 probability
  // to the eventual outcome. 1e-9 matches sklearn default.
  const EPS = 1e-9;
  const pActual =
    actual === "1" ? p.home : actual === "X" ? p.draw : p.away;
  const safe = Math.min(Math.max(pActual, EPS), 1 - EPS);
  return -Math.log(safe);
}

function probOnActual(p: ProbTriple, actual: Outcome): number {
  if (actual === "1") return p.home;
  if (actual === "X") return p.draw;
  return p.away;
}

function normaliseTriple(home: number, draw: number, away: number): ProbTriple {
  const sum = home + draw + away;
  if (!isFinite(sum) || sum <= 0) {
    return { home: 0.34, draw: 0.32, away: 0.34 };
  }
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

function flatten<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function asNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? parseFloat(v) : v;
}

// ── Prediction aggregation ───────────────────────────────────────────────────

interface PredictionAccumulator {
  home: number | null;
  draw: number | null;
  away: number | null;
  isBlended: boolean;
}

function assignSelection(
  acc: PredictionAccumulator,
  market: string,
  value: number | null
): void {
  const m = market.toLowerCase();
  // Accept the three writer conventions used historically (see world-cup.ts
  // `mergePredictionRow` for context — colon, underscore, bare).
  const isHome = m.endsWith(":home") || m.endsWith("_home") || m === "home";
  const isDraw = m.endsWith(":draw") || m.endsWith("_draw") || m === "draw";
  const isAway = m.endsWith(":away") || m.endsWith("_away") || m === "away";
  if (isHome) acc.home = value;
  else if (isDraw) acc.draw = value;
  else if (isAway) acc.away = value;
}

function aggregatePredictions(
  rows: RawPredictionRow[]
): Record_<string, { triple: ProbTriple; isBlended: boolean } | null> {
  // Bucket by (match_id, source). Blended wins when both exist for a match.
  const buckets = new Map<string, Map<string, PredictionAccumulator>>();
  for (const row of rows) {
    if (!buckets.has(row.match_id)) buckets.set(row.match_id, new Map());
    const bySource = buckets.get(row.match_id)!;
    if (!bySource.has(row.source)) {
      bySource.set(row.source, {
        home: null,
        draw: null,
        away: null,
        isBlended: row.source === BLENDED_MODEL_SOURCE,
      });
    }
    assignSelection(bySource.get(row.source)!, row.market, row.model_probability);
  }

  const out: Record_<string, { triple: ProbTriple; isBlended: boolean } | null> = {};
  for (const [matchId, bySource] of buckets.entries()) {
    const preferred =
      bySource.get(BLENDED_MODEL_SOURCE) ?? bySource.get(OWN_MODEL_SOURCE);
    if (!preferred) {
      out[matchId] = null;
      continue;
    }
    if (preferred.home == null || preferred.draw == null || preferred.away == null) {
      out[matchId] = null;
      continue;
    }
    out[matchId] = {
      triple: normaliseTriple(preferred.home, preferred.draw, preferred.away),
      isBlended: preferred.isBlended,
    };
  }
  return out;
}

// Local alias — `Record` is exported as a domain type above. Use a private
// alias for the structural `Record<K, V>` utility type so we don't shadow it.
type Record_<K extends string | number | symbol, V> = { [P in K]: V };

// ── Calibration ──────────────────────────────────────────────────────────────

/**
 * Bucket every (predicted-prob, actual-was-this-outcome) pair into 10pp bins.
 * We use ALL three predicted probs per match — i.e. each match contributes 3
 * data points: (p_home, y_home), (p_draw, y_draw), (p_away, y_away). This is
 * the standard multi-class reliability diagram setup (one diagonal across all
 * outcomes rather than one curve per class — keeps the plot tiny).
 */
export function buildCalibration(rows: RecordRow[]): CalibrationBucket[] {
  const buckets: { sumP: number; hits: number; count: number }[] = Array.from(
    { length: 10 },
    () => ({ sumP: 0, hits: 0, count: 0 })
  );

  for (const row of rows) {
    if (!row.model) continue;
    const pairs: Array<[number, 0 | 1]> = [
      [row.model.home, row.actual === "1" ? 1 : 0],
      [row.model.draw, row.actual === "X" ? 1 : 0],
      [row.model.away, row.actual === "2" ? 1 : 0],
    ];
    for (const [p, y] of pairs) {
      // 1.0 belongs to the last bucket (index 9) — clamp to handle floating drift.
      const idx = Math.min(9, Math.max(0, Math.floor(p * 10)));
      buckets[idx].sumP += p;
      buckets[idx].hits += y;
      buckets[idx].count += 1;
    }
  }

  return buckets.map((b, i) => ({
    lower: i / 10,
    upper: (i + 1) / 10,
    meanPredicted: b.count > 0 ? b.sumP / b.count : 0,
    actualHitRate: b.count > 0 ? b.hits / b.count : 0,
    count: b.count,
  }));
}

// ── Per-row construction + summary ───────────────────────────────────────────

interface BuildInput {
  matches: RawMatchRow[];
  predictionsByMatch: Record_<string, { triple: ProbTriple; isBlended: boolean } | null>;
  consensusByMatch: Record_<string, ProbTriple | null>;
}

export function buildRows({
  matches,
  predictionsByMatch,
  consensusByMatch,
}: BuildInput): RecordRow[] {
  const out: RecordRow[] = [];
  for (const m of matches) {
    if (m.status !== "finished") continue;
    if (m.score_home == null || m.score_away == null) continue;
    const home = flatten(m.home_team);
    const away = flatten(m.away_team);
    if (!home || !away) continue;

    const actual = actualFromScore(m.score_home, m.score_away);
    const modelEntry = predictionsByMatch[m.id] ?? null;
    const market = consensusByMatch[m.id] ?? null;

    const modelPick = modelEntry ? pickFromTriple(modelEntry.triple) : null;
    const marketPick = market ? pickFromTriple(market) : null;

    out.push({
      matchId: m.id,
      date: m.date,
      homeName: home.name,
      awayName: away.name,
      scoreHome: m.score_home,
      scoreAway: m.score_away,
      actual,
      model: modelEntry?.triple ?? null,
      market,
      modelPick,
      marketPick,
      modelHit: modelPick == null ? null : modelPick === actual,
      marketHit: marketPick == null ? null : marketPick === actual,
      modelIsBlended: modelEntry?.isBlended ?? false,
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

export function summarise(rows: RecordRow[]): RecordSummary | null {
  if (rows.length === 0) return null;

  let modelN = 0;
  let marketN = 0;
  let bothN = 0;
  let modelHits = 0;
  let marketHits = 0;
  let modelBrierSum = 0;
  let marketBrierSum = 0;
  let modelLogSum = 0;
  let marketLogSum = 0;
  let clvSum = 0;
  let favouritesCalled = 0;
  let favouritesTotal = 0;

  for (const r of rows) {
    if (r.model) {
      modelN += 1;
      if (r.modelHit) modelHits += 1;
      modelBrierSum += brierRow(r.model, r.actual);
      modelLogSum += logLossRow(r.model, r.actual);
    }
    if (r.market) {
      marketN += 1;
      if (r.marketHit) marketHits += 1;
      marketBrierSum += brierRow(r.market, r.actual);
      marketLogSum += logLossRow(r.market, r.actual);
    }
    if (r.model && r.market) {
      bothN += 1;
      clvSum += probOnActual(r.model, r.actual) - probOnActual(r.market, r.actual);
      // "Favourite" = market's top pick. If both pointed there and it was
      // right, count it. If market had a fav and model called it correctly,
      // it's the headline trust signal.
      if (r.marketPick) {
        favouritesTotal += 1;
        if (r.modelPick === r.marketPick && r.modelHit) favouritesCalled += 1;
      }
    }
  }

  return {
    nSettled: rows.length,
    modelN,
    marketN,
    bothN,
    modelHits,
    marketHits,
    modelBrier: modelN > 0 ? modelBrierSum / modelN : null,
    marketBrier: marketN > 0 ? marketBrierSum / marketN : null,
    modelLogLoss: modelN > 0 ? modelLogSum / modelN : null,
    marketLogLoss: marketN > 0 ? marketLogSum / marketN : null,
    clv: bothN > 0 ? clvSum / bothN : null,
    favouritesCalled,
    favouritesTotal,
  };
}

// ── Public loader ────────────────────────────────────────────────────────────

/**
 * Server-side loader for the /world-cup/predictions-record page. Pulls every
 * settled WC2026 fixture, joins model + market + actual, and returns the
 * triple (summary, byMatch, calibration) ready for the page to render.
 *
 * Returns a zeroed record when nothing is settled yet — the page checks
 * `summary === null` to switch to placeholder mode.
 */
export async function loadRecord(): Promise<Record> {
  const supabase = createSupabasePublic();

  // 1. Settled WC2026 fixtures (mirrors the date filter convention from
  //    world-cup.ts — season filter doesn't work for WC fixtures).
  const { data: rawMatches, error: matchesErr } = await supabase
    .from("matches")
    .select(
      `id, date, status, score_home, score_away,
       home_team:home_team_id(id, name),
       away_team:away_team_id(id, name),
       league:league_id!inner(api_football_id)`
    )
    .eq("league.api_football_id", WORLD_CUP_LEAGUE_API_ID)
    .gte("date", "2026-06-01")
    .eq("status", "finished")
    .order("date", { ascending: false })
    .limit(200);

  if (matchesErr || !rawMatches || rawMatches.length === 0) {
    return {
      summary: null,
      byMatch: [],
      calibration: buildCalibration([]),
    };
  }

  const matches = rawMatches as RawMatchRow[];
  const matchIds = matches.map((m) => m.id);

  // 2. Our model + blended predictions for those match IDs.
  const { data: rawPreds } = await supabase
    .from("predictions")
    .select("match_id, market, model_probability, source")
    .in("source", [OWN_MODEL_SOURCE, BLENDED_MODEL_SOURCE])
    .in("match_id", matchIds);

  const predictionsByMatch = aggregatePredictions((rawPreds ?? []) as RawPredictionRow[]);

  // 3. Market consensus.
  const { data: rawConsensus } = await supabase
    .from("wc_market_consensus")
    .select("match_id, home_prob, draw_prob, away_prob")
    .in("match_id", matchIds);

  const consensusByMatch: Record_<string, ProbTriple | null> = {};
  for (const c of (rawConsensus ?? []) as RawConsensusRow[]) {
    consensusByMatch[c.match_id] = normaliseTriple(
      asNumber(c.home_prob),
      asNumber(c.draw_prob),
      asNumber(c.away_prob)
    );
  }

  const byMatch = buildRows({ matches, predictionsByMatch, consensusByMatch });
  const summary = summarise(byMatch);
  const calibration = buildCalibration(byMatch);

  return { summary, byMatch, calibration };
}

// ── C2 — CLV series ──────────────────────────────────────────────────────────

export interface CLVPoint {
  matchId: string;
  date: string;          // ISO kickoff
  homeName: string;
  awayName: string;
  /** Per-match CLV = model_p_on_actual − market_p_on_actual. */
  clv: number;
  /** Cumulative CLV over all chronologically-prior matches (inclusive). */
  cumClv: number;
}

/**
 * Walk every settled match where BOTH our model and market have probabilities,
 * compute per-match CLV, sort chronologically (ASC — oldest first, so the chart
 * line moves left-to-right), and emit cumulative sum.
 *
 * Empty array when nothing's settled or no overlapping rows exist — the page
 * treats that as the pre-tournament placeholder state.
 *
 * Reuses `loadRecord()` so the SQL + math (probOnActual semantics, blended
 * source precedence, etc.) come from C1 and stay consistent.
 */
export async function loadCLVSeries(): Promise<CLVPoint[]> {
  const { byMatch } = await loadRecord();
  // byMatch is DESC by date; we want ASC for cumulative.
  const both = byMatch
    .filter((r) => r.model != null && r.market != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const out: CLVPoint[] = [];
  for (const r of both) {
    // Safe — filter guarantees both are non-null.
    const m = r.model!;
    const mk = r.market!;
    const pModel = r.actual === "1" ? m.home : r.actual === "X" ? m.draw : m.away;
    const pMarket = r.actual === "1" ? mk.home : r.actual === "X" ? mk.draw : mk.away;
    const clv = pModel - pMarket;
    running += clv;
    out.push({
      matchId: r.matchId,
      date: r.date,
      homeName: r.homeName,
      awayName: r.awayName,
      clv,
      cumClv: running,
    });
  }
  return out;
}

// ── C3 — Leaderboard ─────────────────────────────────────────────────────────

export interface LeaderboardRow {
  /** Stable id (used as the React key + slot lookup). */
  source: "oddsintel_own" | "oddsintel_blended" | "market" | "opta";
  /** Display label. */
  label: string;
  /** Optional one-line caption for the row (e.g. "Coming soon — scrape pending"). */
  note: string | null;
  /** Mean Brier on settled fixtures where this source had a row. Null when N=0. */
  brier: number | null;
  /** Mean log-loss on settled fixtures where this source had a row. Null when N=0. */
  logLoss: number | null;
  /** hits / N. Null when N=0. */
  hitRate: number | null;
  /** Avg(source_p_on_actual − market_p_on_actual). Null for the market row itself, null when N=0 vs market overlap. */
  clv: number | null;
  /** Number of settled matches this source has a prediction for. */
  n: number;
}

/**
 * Per-source metrics across all settled WC2026 fixtures. Reuses C1's loader so
 * the math (brierRow, logLossRow, blended-source precedence) stays single-sourced.
 *
 * What you'll see in each row:
 *   - `oddsintel_own`     — raw `national_team_v1` predictions (no blend).
 *   - `oddsintel_blended` — `national_team_v1_blended` rows ONLY (blend with market).
 *   - `market`            — `wc_market_consensus` (vig-removed Pinnacle/FotMob avg).
 *   - `opta`              — placeholder; we don't scrape Opta yet. Returned with
 *                           null metrics and a "Coming soon" note so the UI can
 *                           render the row consistently.
 *
 * Sorting and rank assignment is a UI concern — this returns the raw rows in a
 * deterministic order; the page sorts by Brier ASC, putting null-metric rows last.
 *
 * Empty/pre-tournament behaviour: every metric is null, every N is 0, but the
 * rows are still returned so the page can show "0 matches" placeholder copy
 * rather than a fully blank table.
 */
export async function loadLeaderboard(): Promise<LeaderboardRow[]> {
  // To compute per-source metrics we need to look at raw predictions BEFORE
  // C1's "blended-takes-precedence" collapse. We replicate the same DB query
  // as loadRecord() but split the model rows into the two sub-sources.
  const supabase = createSupabasePublic();

  const { data: rawMatches } = await supabase
    .from("matches")
    .select(
      `id, date, status, score_home, score_away,
       home_team:home_team_id(id, name),
       away_team:away_team_id(id, name),
       league:league_id!inner(api_football_id)`
    )
    .eq("league.api_football_id", WORLD_CUP_LEAGUE_API_ID)
    .gte("date", "2026-06-01")
    .eq("status", "finished")
    .order("date", { ascending: false })
    .limit(200);

  // Always return all four rows — empty/pre-tournament state is handled by
  // null metrics, not missing rows.
  const emptyRow = (
    source: LeaderboardRow["source"],
    label: string,
    note: string | null
  ): LeaderboardRow => ({
    source,
    label,
    note,
    brier: null,
    logLoss: null,
    hitRate: null,
    clv: null,
    n: 0,
  });

  if (!rawMatches || rawMatches.length === 0) {
    return [
      emptyRow("oddsintel_own", "OddsIntel (own model)", null),
      emptyRow("oddsintel_blended", "OddsIntel (blended with market)", null),
      emptyRow("market", "Market consensus (Pinnacle + FotMob, vig-removed)", null),
      emptyRow("opta", "Opta supercomputer", "Coming soon — scrape not yet wired up."),
    ];
  }

  const matches = rawMatches as RawMatchRow[];
  const matchIds = matches.map((m) => m.id);

  // Pull predictions for BOTH sources — split them per-source rather than
  // collapsing with blended-precedence (which is what aggregatePredictions does).
  const { data: rawPreds } = await supabase
    .from("predictions")
    .select("match_id, market, model_probability, source")
    .in("source", [OWN_MODEL_SOURCE, BLENDED_MODEL_SOURCE])
    .in("match_id", matchIds);

  const { data: rawConsensus } = await supabase
    .from("wc_market_consensus")
    .select("match_id, home_prob, draw_prob, away_prob")
    .in("match_id", matchIds);

  // ── Helper: collapse raw rows for ONE source into matchId -> triple. ──
  function collapseSource(sourceFilter: string): Map<string, ProbTriple> {
    const out = new Map<string, ProbTriple>();
    const accumulators = new Map<string, PredictionAccumulator>();
    for (const r of (rawPreds ?? []) as RawPredictionRow[]) {
      if (r.source !== sourceFilter) continue;
      if (!accumulators.has(r.match_id)) {
        accumulators.set(r.match_id, {
          home: null,
          draw: null,
          away: null,
          isBlended: sourceFilter === BLENDED_MODEL_SOURCE,
        });
      }
      assignSelection(accumulators.get(r.match_id)!, r.market, r.model_probability);
    }
    for (const [mid, acc] of accumulators.entries()) {
      if (acc.home == null || acc.draw == null || acc.away == null) continue;
      out.set(mid, normaliseTriple(acc.home, acc.draw, acc.away));
    }
    return out;
  }

  const ownByMatch = collapseSource(OWN_MODEL_SOURCE);
  const blendedByMatch = collapseSource(BLENDED_MODEL_SOURCE);
  const marketByMatch = new Map<string, ProbTriple>();
  for (const c of (rawConsensus ?? []) as RawConsensusRow[]) {
    marketByMatch.set(
      c.match_id,
      normaliseTriple(asNumber(c.home_prob), asNumber(c.draw_prob), asNumber(c.away_prob))
    );
  }

  // ── Settled match outcomes. ──
  const settled: Array<{ id: string; actual: Outcome }> = [];
  for (const m of matches) {
    if (m.status !== "finished") continue;
    if (m.score_home == null || m.score_away == null) continue;
    settled.push({ id: m.id, actual: actualFromScore(m.score_home, m.score_away) });
  }

  // ── Per-source scorer (split into pure helpers to keep complexity low). ──
  function clvDeltaFor(
    triple: ProbTriple,
    actual: Outcome,
    matchId: string
  ): number | null {
    const market = marketByMatch.get(matchId);
    if (!market) return null;
    return probOnActual(triple, actual) - probOnActual(market, actual);
  }

  interface ScoreAcc {
    n: number;
    hits: number;
    brierSum: number;
    logSum: number;
    clvSum: number;
    clvN: number;
  }

  function accumulateOne(
    acc: ScoreAcc,
    triple: ProbTriple,
    actual: Outcome,
    matchId: string,
    isMarketRow: boolean
  ): void {
    acc.n += 1;
    if (pickFromTriple(triple) === actual) acc.hits += 1;
    acc.brierSum += brierRow(triple, actual);
    acc.logSum += logLossRow(triple, actual);
    if (isMarketRow) return;
    const delta = clvDeltaFor(triple, actual, matchId);
    if (delta == null) return;
    acc.clvSum += delta;
    acc.clvN += 1;
  }

  function score(
    by: Map<string, ProbTriple>,
    label: string,
    source: LeaderboardRow["source"],
    isMarketRow: boolean
  ): LeaderboardRow {
    const acc: ScoreAcc = { n: 0, hits: 0, brierSum: 0, logSum: 0, clvSum: 0, clvN: 0 };
    for (const s of settled) {
      const triple = by.get(s.id);
      if (!triple) continue;
      accumulateOne(acc, triple, s.actual, s.id, isMarketRow);
    }
    return {
      source,
      label,
      note: null,
      brier: acc.n > 0 ? acc.brierSum / acc.n : null,
      logLoss: acc.n > 0 ? acc.logSum / acc.n : null,
      hitRate: acc.n > 0 ? acc.hits / acc.n : null,
      clv: isMarketRow ? null : acc.clvN > 0 ? acc.clvSum / acc.clvN : null,
      n: acc.n,
    };
  }

  return [
    score(ownByMatch, "OddsIntel (own model)", "oddsintel_own", false),
    score(blendedByMatch, "OddsIntel (blended with market)", "oddsintel_blended", false),
    score(marketByMatch, "Market consensus (Pinnacle + FotMob, vig-removed)", "market", true),
    {
      source: "opta",
      label: "Opta supercomputer",
      note: "Coming soon — scrape not yet wired up.",
      brier: null,
      logLoss: null,
      hitRate: null,
      clv: null,
      n: 0,
    },
  ];
}
