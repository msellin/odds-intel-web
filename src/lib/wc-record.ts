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
  NATIONAL_TEAM_MODEL_SOURCE,
} from "./world-cup";

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
      bySource.get(BLENDED_MODEL_SOURCE) ?? bySource.get(NATIONAL_TEAM_MODEL_SOURCE);
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
    .in("source", [NATIONAL_TEAM_MODEL_SOURCE, BLENDED_MODEL_SOURCE])
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
