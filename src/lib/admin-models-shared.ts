/**
 * /admin/models — types and pure helpers shared by the server loader (admin-models.ts) and the client
 * view ([[#153]]). No server imports here: the client bundle imports this file.
 */
export interface R<T> {
  rows: T;
  error: string | null;
}

export interface AccuracyRow {
  model: string;
  market: string;
  win: string;
  n: number;
  logloss: number;
  brier: number;
  base_logloss: number | null;
  pin_n: number;
  logloss_pin_rows: number | null;
  pin_logloss: number | null;
  first_kickoff: string | null;
  last_kickoff: string | null;
  computed_at?: string | null;
}

export interface ModelBotConfig {
  bot_name: string;
  family: string | null;
  markets: string[] | null;
  prob_source: string | null;
  edge_floor: string | null;
  edge_floor_source: string | null;
  odds_min: number | null;
  odds_max: number | null;
  gates: { name: string; value: unknown; source: string }[] | null;
  books: string[] | null;
  anchor: string | null;
  placeable: boolean | null;
  published: boolean | null;
  telegram: boolean | null;
  exported_at: string | null;
}

export interface ModelBotRow {
  name: string;
  display_name: string | null;
  maturity_label: string | null;
  vip: boolean | null;
  show_on_performance: boolean | null;
  hide_pending: boolean | null;
  retired_at: string | null;
  rule_version: string | null;
}

export interface ModelBotPerf {
  bot_name: string;
  picks_total: number;
  settled: number;
  clv_n: number;
  clv_public: number | null;
  roi_public: number | null;
  first_pick_at: string | null;
  last_pick_at: string | null;
}

export interface RuleHistoryRow {
  bot_name: string;
  rule_version: string | null;
  model_version: string | null;
  first_pick: string;
  last_pick: string;
  picks: number;
}

export interface ChangeLogRow {
  bot_name: string;
  effective_from: string;
  superseded_at: string | null;
  change_ref: string;
  rationale: string | null;
}

export interface ModelsData {
  now: number;
  accuracy: R<AccuracyRow[]>;
  config: R<ModelBotConfig[]>;
  bots: R<ModelBotRow[]>;
  performance: R<ModelBotPerf[]>;
  ruleHistory: R<RuleHistoryRow[]>;
  changeLog: R<ChangeLogRow[]>;
}

/** The model family a stored accuracy row belongs to ("ensemble 1X2 v20260830" → "ensemble"). */
export type ModelFamily = "newplus" | "rating" | "ou_comb" | "ensemble" | "pinnacle" | "consensus" | "tonybet" | "af" | "none";

export function familyOfModel(model: string): ModelFamily {
  if (model.startsWith("NEW+")) return "newplus";
  if (model.startsWith("NEW ratings")) return "rating";
  if (model.startsWith("O/U combined")) return "ou_comb";
  if (model.startsWith("ensemble")) return "ensemble";
  if (model.startsWith("Pinnacle")) return "pinnacle";
  if (model.startsWith("Tonybet fair")) return "tonybet";
  if (model.startsWith("API-Football")) return "af";
  return "none";
}

/** The model family a bot prices off, from bot_config.prob_source (the export's plain-text source). */
export function familyOfBot(probSource: string | null): ModelFamily {
  const s = (probSource ?? "").toLowerCase();
  if (s.includes("r1x2_comb_v1")) return "newplus";
  if (s.includes("r1x2_d8plus_v1")) return "rating";
  if (s.includes("ou_comb_v1")) return "ou_comb";
  if (s.includes("consensus")) return "consensus";
  if (s.includes("pinnacle")) return "pinnacle";
  if (s.includes("calibrated") || s.includes("predictions")) return "ensemble";
  return "none";
}

export const FAMILY_LABEL: Record<ModelFamily, string> = {
  newplus: "1X2 new model (NEW+)",
  rating: "1X2 ratings only (NEW)",
  ou_comb: "Goals model (O/U combined)",
  ensemble: "Old ensemble (Poisson + XGBoost)",
  pinnacle: "Pinnacle's price (de-vigged)",
  consensus: "Other books' consensus",
  tonybet: "Tonybet's fair price (Sportradar)",
  af: "API-Football predictions",
  none: "No model (in-play / book's own price)",
};

/** Does a bot (by its exported markets) trade this accuracy row's market? Legacy spellings in
 *  bot_config.markets: "o/u" / "ou" = the 2.5 line, "ou15" / "ou35" = 1.5 / 3.5. */
export const MARKET_ALIAS: Record<string, string> = { "o/u": "over_under_25", ou: "over_under_25", ou15: "over_under_15", ou25: "over_under_25", ou35: "over_under_35" };
export function tradesMarket(botMarkets: string, market: string): boolean {
  return botMarkets
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .some((t) => (MARKET_ALIAS[t] ?? t) === market);
}

/** Log-loss gaps within ±0.002 read as "level" everywhere on the page. */
export const LEVEL_BAND = 0.002;
