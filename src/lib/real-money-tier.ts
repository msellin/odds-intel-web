/**
 * REAL-MONEY-TIER (2026-06-06): composite "should I bet real money on this?"
 * indicator. Folds three signals per bet:
 *
 *   1. Model calibration tier   — is the probability honest? (model_calibration table)
 *   2. Bot track record         — is the bot proven to make money? (simulated_bets aggregates)
 *   3. Per-bet flags            — anything weird about THIS specific pick?
 *
 * The overall level is GATING (weakest link decides), not a weighted average:
 * a green level requires ALL THREE signals to clear their bar. This is
 * deliberately conservative for the real-money decision — if anything is
 * thin / unfitted / losing, we drop to yellow or gray.
 *
 * Bets are NEVER filtered by this — all pending paper bets keep showing on
 * /admin/place. The tier is purely informational so the operator can decide
 * which bets to back with real money.
 */

export type ModelTierKind =
  | "mature"        // ECE ≤ 5%, n ≥ 500, fit ≥ 14d old
  | "established"   // ECE ≤ 5%, n ≥ 100, fit ≥ 7d old
  | "new"           // ECE ≤ 5%, but recent or small sample
  | "partial"       // fit exists, 5% < ECE ≤ 15%
  | "under-study"   // fit exists, ECE > 15%
  | "experimental"; // no Platt fit yet

export type BotTierKind =
  | "proven"        // CLV ≥ +3%, ROI ≥ 0%, settled ≥ 30
  | "building"      // CLV ≥ 0, settled ≥ 10, not yet proven
  | "thin"          // settled < 10 — sample too thin
  | "losing";       // ROI clearly negative (≤ -5%) on ≥ 20 settled bets

export type OverallTier = "bet" | "cautious" | "paper";

export interface ModelTier {
  kind: ModelTierKind;
  eceAfter: number | null;
  sampleCount: number | null;
  daysOld: number | null;
}

export interface BotTier {
  kind: BotTierKind;
  clv: number | null;       // decimal (0.08 = +8%)
  roi: number | null;       // decimal
  settledBets: number;
}

export interface RealMoneyTier {
  overall: OverallTier;
  model: ModelTier;
  bot: BotTier;
  betFlags: string[];       // human-readable warnings, e.g. "edge too high for unfitted market"
}

export interface CalibrationRow {
  market: string;           // e.g. '1x2_home', 'btts_yes', 'asian_handicap_away -0.5'
  sample_count: number;
  ece_after: number;
  fitted_at: string;        // ISO timestamp
}

export interface BotAgg {
  botId: string;
  settledBets: number;
  clv: number | null;
  roi: number | null;
}

/** Map (market, selection) from simulated_bets to the model_calibration.market key. */
export function calibrationKey(market: string, selection: string): string | null {
  const m = (market || "").toLowerCase();
  const s = (selection || "").toLowerCase().trim();
  if (!m || !s) return null;

  if (m === "1x2") return `1x2_${s}`;                      // 1x2_home / draw / away
  if (m === "btts") return `btts_${s}`;                    // btts_yes / btts_no
  if (m === "double_chance") return `double_chance_${s.replace(/\s+/g, "")}`;  // double_chance_1x / x2 / 12
  if (m === "draw_no_bet") return `dnb_${s}`;
  if (m === "asian_handicap") return `asian_handicap_${s}`; // 'asian_handicap_away -0.5'
  if (m === "o/u") {
    // selection looks like "over 2.5" / "under 2.5"
    const parts = s.split(/\s+/);
    if (parts.length < 2) return null;
    const side = parts[0];
    const line = parts[1].replace(".", "_");                // "2.5" → "2_5"
    return `over_under_${line}_${side}`;                    // matches future fit_platt output
  }
  return null;
}

/** Classify model calibration from a row (or its absence). */
export function classifyModelTier(
  row: CalibrationRow | undefined,
  nowMs: number = Date.now(),
): ModelTier {
  if (!row) {
    return { kind: "experimental", eceAfter: null, sampleCount: null, daysOld: null };
  }
  const eceAfter = row.ece_after;
  const sampleCount = row.sample_count;
  const daysOld = (nowMs - new Date(row.fitted_at).getTime()) / 86_400_000;

  if (eceAfter <= 0.05) {
    if (sampleCount >= 500 && daysOld >= 14)
      return { kind: "mature", eceAfter, sampleCount, daysOld };
    if (sampleCount >= 100 && daysOld >= 7)
      return { kind: "established", eceAfter, sampleCount, daysOld };
    return { kind: "new", eceAfter, sampleCount, daysOld };
  }
  if (eceAfter <= 0.15)
    return { kind: "partial", eceAfter, sampleCount, daysOld };
  return { kind: "under-study", eceAfter, sampleCount, daysOld };
}

/** Classify bot track record from settled-bets aggregates. */
export function classifyBotTier(agg: BotAgg | undefined): BotTier {
  if (!agg || agg.settledBets < 10) {
    return {
      kind: "thin",
      clv: agg?.clv ?? null,
      roi: agg?.roi ?? null,
      settledBets: agg?.settledBets ?? 0,
    };
  }
  const clv = agg.clv ?? 0;
  const roi = agg.roi ?? 0;

  if (roi <= -0.05 && agg.settledBets >= 20)
    return { kind: "losing", clv, roi, settledBets: agg.settledBets };

  if (clv >= 0.03 && roi >= 0 && agg.settledBets >= 30)
    return { kind: "proven", clv, roi, settledBets: agg.settledBets };

  return { kind: "building", clv, roi, settledBets: agg.settledBets };
}

/** Detect per-bet warning flags. */
export function detectBetFlags(args: {
  edge: number | null;       // decimal — 0.06 = 6%
  modelTier: ModelTier;
}): string[] {
  const flags: string[] = [];
  const { edge, modelTier } = args;

  // High edge on an unfitted market is the classic over-confidence signature
  // (inplay_n / inplay_i diagnoses both surfaced this). Flag any edge > 20%
  // on experimental / under-study models.
  if (edge !== null && edge > 0.20 && (modelTier.kind === "experimental" || modelTier.kind === "under-study")) {
    flags.push("high-edge-uncalibrated");
  }

  // Any edge > 50% is almost always a data issue or stale odds — flag
  // regardless of calibration tier.
  if (edge !== null && edge > 0.50) {
    flags.push("edge-implausibly-high");
  }

  return flags;
}

/** Combine the three signals into the overall recommendation. */
export function combineToOverall(
  model: ModelTier,
  bot: BotTier,
  betFlags: string[],
): OverallTier {
  // Hard "paper only" — any of these collapses the tier
  if (betFlags.length > 0) return "paper";
  if (bot.kind === "losing") return "paper";
  if (bot.kind === "thin") return "paper";
  if (model.kind === "experimental" || model.kind === "under-study") return "paper";

  // Green — all three signals clear
  if (
    (model.kind === "mature" || model.kind === "established" || model.kind === "new") &&
    bot.kind === "proven"
  ) {
    return "bet";
  }

  // Otherwise yellow (something is partial / building but nothing is failing)
  return "cautious";
}

/** Top-level composer — call this from getPlaceableBets. */
export function computeRealMoneyTier(args: {
  market: string;
  selection: string;
  edge: number | null;
  botId: string;
  calibrationByKey: Map<string, CalibrationRow>;
  botById: Map<string, BotAgg>;
  nowMs?: number;
}): RealMoneyTier {
  const key = calibrationKey(args.market, args.selection);
  const calRow = key ? args.calibrationByKey.get(key) : undefined;
  const model = classifyModelTier(calRow, args.nowMs);
  const bot = classifyBotTier(args.botById.get(args.botId));
  const betFlags = detectBetFlags({ edge: args.edge, modelTier: model });
  const overall = combineToOverall(model, bot, betFlags);
  return { overall, model, bot, betFlags };
}
