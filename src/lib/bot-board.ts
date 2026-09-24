/**
 * /admin/bots data layer — #139 UNIFIED-BOT-MODEL, phase 1 (web side).
 *
 * Reads the unified contract defined in the engine repo
 * (`docs/UNIFIED_BOT_MODEL_DESIGN_2026_09_24.md`): views `bot_scoreboard`,
 * `bot_capabilities`, `bot_ledger` and table `bot_config`. Every bot — model
 * sim, shadow, sharp trigger, in-play, forward-test arm, control — is the same
 * kind of object here, so the page never has to know which ledger table a bot
 * happens to write.
 *
 * All reads use `createServerServiceClient()` (service_role): the views are
 * admin-only (not anon-readable, #072). Server-only — never import from a
 * client component.
 *
 * Tolerance: while migration 410 is not deployed the views do not exist and
 * PostgREST answers with an error. Each read returns `{ rows, error }` instead
 * of throwing, so the page can show "unified views not deployed yet" rather
 * than crashing.
 */
import { createServerServiceClient } from "@/lib/supabase-server";

export type BotFamily =
  | "model_sim"
  | "model_shadow"
  | "sharp_trigger"
  | "sharp_generator"
  | "inplay"
  | "forward_test"
  | "control"
  | "unknown";

export interface BotScoreboardRow {
  bot_name: string;
  display_name: string | null;
  source: string | null;
  is_active: boolean | null;
  retired_at: string | null;
  maturity_label: string | null;
  family: string | null;
  picks_total: number | null;
  pending: number | null;
  settled: number | null;
  won: number | null;
  lost: number | null;
  void: number | null;
  roi_unit: number | null;
  clv_mc_n: number | null;
  clv_mc_mean: number | null;
  clv_mc_se: number | null;
  clv_mc_t: number | null;
  clv_pin_n: number | null;
  clv_pin_mean: number | null;
  clv_pin_se: number | null;
  clv_pin_t: number | null;
  /** Forward-test / control bots: the rule_version being scored (pre-registration — never pooled across versions). */
  scored_rule_version: string | null;
  /** Picks under earlier rule_versions of this bot, kept in bot_ledger but not scored here. */
  earlier_version_picks: number | null;
  /** Rows left out of the CLV stats because |clv| > 1 (outlier guard). */
  clv_outlier_n: number | null;
  first_pick_at: string | null;
  last_pick_at: string | null;
  picks_7d: number | null;
  settled_7d: number | null;
}

export interface BotGate {
  name: string;
  value: unknown;
  source: string | null;
}

export interface BotConfigRow {
  bot_name: string;
  family: string | null;
  description: string | null;
  ledger: string | null;
  writer_job: string | null;
  cadence: string | null;
  markets: string[] | null;
  prob_source: string | null;
  edge_floor: string | null;
  edge_floor_source: string | null;
  odds_min: number | null;
  odds_max: number | null;
  gates: BotGate[] | null;
  books: string[] | null;
  books_source: string | null;
  anchor: string | null;
  placeable: boolean | null;
  published: boolean | null;
  telegram: boolean | null;
  admissible_metric: string | null;
  exported_at: string | null;
}

export interface BotCapabilitiesRow {
  bot_name: string;
  collect: boolean | null;
  publish: boolean | null;
  telegram: boolean | null;
  place_capable: boolean | null;
  place_enabled: boolean | null;
  fleet_placement_paused: boolean | null;
  fleet_real_money_armed: boolean | null;
  /** Wrote at least one pick in the last 7 days (retired bots keep collecting by owner decision). */
  writing_7d: boolean | null;
}

export interface BotLedgerRow {
  source: string;
  pick_id: string;
  bot_name: string;
  bot_id: string | null;
  match_id: string | null;
  kickoff: string | null;
  pick_time: string | null;
  market: string | null;
  selection: string | null;
  odds: number | null;
  bookmaker: string | null;
  result: string | null;
  pnl_unit: number | null;
  clv_raw: number | null;
  clv_mc: number | null;
  clv_pinnacle: number | null;
  is_inplay: boolean | null;
  model_version?: string | null;
  rule_version?: string | null;
}

export interface RetiredInfo {
  name: string;
  retired_at: string | null;
  retired_reason: string | null;
}

export interface Read<T> {
  rows: T[];
  /** null = read OK. Otherwise the PostgREST message (typically "relation does not exist"). */
  error: string | null;
}

export interface BotBoardData {
  scoreboard: Read<BotScoreboardRow>;
  config: Read<BotConfigRow>;
  capabilities: Read<BotCapabilitiesRow>;
  retired: Read<RetiredInfo>;
  /** Render clock, read in the data layer (react-hooks/purity convention). */
  now: number;
}

async function readAll<T>(relation: string, columns = "*"): Promise<Read<T>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db.from(relation).select(columns).limit(5000);
    if (error) return { rows: [], error: `${relation}: ${error.message}` };
    return { rows: (data ?? []) as T[], error: null };
  } catch (e) {
    return { rows: [], error: `${relation}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Everything /admin/bots renders on load (the ledger is fetched per bot on demand). */
export async function loadBotBoard(): Promise<BotBoardData> {
  const [scoreboard, config, capabilities, retired] = await Promise.all([
    readAll<BotScoreboardRow>("bot_scoreboard"),
    readAll<BotConfigRow>("bot_config"),
    readAll<BotCapabilitiesRow>("bot_capabilities"),
    // `bots` exists today; only the reason text is taken from it (the contract's
    // scoreboard carries retired_at but not the reason).
    readRetired(),
  ]);
  return { scoreboard, config, capabilities, retired, now: Date.now() };
}

async function readRetired(): Promise<Read<RetiredInfo>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db
      .from("bots")
      .select("name, retired_at, retired_reason")
      .not("retired_at", "is", null)
      .limit(5000);
    if (error) return { rows: [], error: `bots: ${error.message}` };
    return { rows: (data ?? []) as RetiredInfo[], error: null };
  } catch (e) {
    return { rows: [], error: `bots: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** One bot's most recent picks from `bot_ledger` (newest pick first). */
export async function loadBotLedger(botName: string, limit = 30): Promise<Read<BotLedgerRow>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db
      .from("bot_ledger")
      // "*" rather than a column list: the contract leaves model_version /
      // rule_version as "whichever the source carries", so do not pin names.
      .select("*")
      .eq("bot_name", botName)
      .order("pick_time", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return { rows: [], error: `bot_ledger: ${error.message}` };
    return { rows: (data ?? []) as BotLedgerRow[], error: null };
  } catch (e) {
    return { rows: [], error: `bot_ledger: ${e instanceof Error ? e.message : String(e)}` };
  }
}
