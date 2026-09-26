/**
 * /admin/models loader ([[#153]], 2026-09-26): which models exist, how good each is right now, which bot
 * uses which one, and when a bot's rule or model changed.
 *
 * Reads (service role, server only — all private relations, no anon grant):
 *   - model_accuracy (engine migration 466, job model_accuracy 02:40 UTC): per model / market / window
 *     (7d, 30d, 90d) on settled matches, only probabilities written before kickoff: n, log-loss, Brier,
 *     the window's base-rate log-loss ("guessing"), and Pinnacle's de-vigged close on the SAME rows.
 *   - bot_config (the per-bot config export, migration 410) + bots (status, visibility) +
 *     bot_performance (the one record: settled, sharp-anchor CLV, ROI at the price available at pick).
 *   - bot_rule_history (466): each (rule_version, model_version) a bot's picks carry, first/last pick.
 *   - bot_config_history (migration 281): the older hand-written change log (16 rows, to 2026-08-24).
 * Each read keeps its error — a table that could not be read says so, it never reads as "nothing".
 */
import { createServerServiceClient } from "@/lib/supabase-server";
import { readAdminFixture } from "@/lib/admin-fixture";

import type { AccuracyRow, ChangeLogRow, ModelBotConfig, ModelBotPerf, ModelBotRow, ModelsData, R, RuleHistoryRow } from "@/lib/admin-models-shared";

export * from "@/lib/admin-models-shared";

async function read<T>(relation: string, columns = "*"): Promise<R<T[]>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db.from(relation).select(columns).limit(5000);
    if (error) return { rows: [], error: `${relation}: ${error.message}` };
    return { rows: (data ?? []) as T[], error: null };
  } catch (e) {
    return { rows: [], error: `${relation}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

interface ModelsFixture {
  accuracy?: AccuracyRow[];
  config?: ModelBotConfig[];
  bots?: ModelBotRow[];
  performance?: ModelBotPerf[];
  rule_history?: RuleHistoryRow[];
  change_log?: ChangeLogRow[];
}

const CONFIG_COLS =
  "bot_name, family, markets, prob_source, edge_floor, edge_floor_source, odds_min, odds_max, gates, books, anchor, placeable, published, telegram, exported_at";

export async function loadModels(): Promise<ModelsData> {
  const now = Date.now();
  const fx = await readAdminFixture<ModelsFixture>("models");
  if (fx) {
    const ok = <T,>(rows: T[] | undefined): R<T[]> => ({ rows: rows ?? [], error: null });
    return {
      now,
      accuracy: ok(fx.accuracy),
      config: ok(fx.config),
      bots: ok(fx.bots),
      performance: ok(fx.performance),
      ruleHistory: ok(fx.rule_history),
      changeLog: ok(fx.change_log),
    };
  }
  const [accuracy, config, bots, performance, ruleHistory, changeLog] = await Promise.all([
    read<AccuracyRow>("model_accuracy"),
    read<ModelBotConfig>("bot_config", CONFIG_COLS),
    read<ModelBotRow>("bots", "name, display_name, maturity_label, vip, show_on_performance, hide_pending, retired_at, rule_version"),
    read<ModelBotPerf>("bot_performance", "bot_name, picks_total, settled, clv_n, clv_public, roi_public, first_pick_at, last_pick_at"),
    read<RuleHistoryRow>("bot_rule_history"),
    read<ChangeLogRow>("bot_config_history", "bot_name, effective_from, superseded_at, change_ref, rationale"),
  ]);
  return { now, accuracy, config, bots, performance, ruleHistory, changeLog };
}
