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
 * Migration 411 adds three display views: `bot_weekly` (the 12-week strip),
 * `bot_market_stats` (per-market stats: the same-market junk-control comparison
 * and the in-play break-even hit rate) and `bot_ledger_display` (bot_ledger +
 * home/away team names). All are optional here — before 411 deploys, the strip
 * falls back to text, the control comparison uses the pooled control with a
 * caveat, and the drawer reads plain `bot_ledger`.
 *
 * HONESTY (spec §13 rule 2): in-play bots have no closing line, so any CLV the
 * ledger carries for them is meaningless. It is nulled HERE, in the data layer,
 * so it never reaches the client payload at all — not just hidden in the UI.
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
  /** From bot_ledger_display (migration 411); absent when reading plain bot_ledger. */
  home_team?: string | null;
  away_team?: string | null;
}

/** One ISO week of one bot (view bot_weekly, migration 411). CLV means are fractions. */
export interface BotWeeklyRow {
  bot_name: string;
  week: string;
  picks: number | null;
  settled: number | null;
  clv_mc_n: number | null;
  clv_mc_mean: number | null;
  clv_pin_n: number | null;
  clv_pin_mean: number | null;
  pnl_unit: number | null;
}

/** One (bot, market) of view bot_market_stats (migration 411). */
export interface BotMarketStatsRow {
  bot_name: string;
  market: string | null;
  settled: number | null;
  won: number | null;
  odds_n: number | null;
  /** Σ 1/odds over settled picks; / odds_n = break-even hit rate. */
  sum_inv_odds: number | null;
  clv_mc_n: number | null;
  clv_mc_mean: number | null;
  clv_mc_sd: number | null;
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
  /** Optional (migration 411) — `error` set while the view does not exist. */
  weekly: Read<BotWeeklyRow>;
  /** Optional (migration 411). */
  marketStats: Read<BotMarketStatsRow>;
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

// ── Local design preview (development only) ──────────────────────────────────────────
// `next dev` with BOT_BOARD_FIXTURE=<path to a JSON snapshot> renders /admin/bots from a
// file instead of the database and without the superadmin check, so the page can be
// designed and reviewed on real numbers with no credentials on the machine. The snapshot
// is written by odds-intel-engine scripts/dump_bot_board_fixture.py into .dev-fixtures/
// (gitignored). NODE_ENV is "production" in every build, so this can never switch on in
// the deployed app.
interface BotBoardFixture {
  scoreboard: BotScoreboardRow[];
  config: BotConfigRow[];
  capabilities: BotCapabilitiesRow[];
  retired: RetiredInfo[];
  ledger: Record<string, BotLedgerRow[]>;
  weekly?: Record<string, BotWeeklyRow[]>;
  market_stats?: BotMarketStatsRow[];
}

export function isBotBoardDevPreview(): boolean {
  return process.env.NODE_ENV === "development" && !!process.env.BOT_BOARD_FIXTURE;
}

async function readFixture(): Promise<BotBoardFixture> {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(process.env.BOT_BOARD_FIXTURE as string, "utf8")) as BotBoardFixture;
}

/** Everything /admin/bots renders on load (the ledger is fetched per bot on demand). */
export async function loadBotBoard(): Promise<BotBoardData> {
  if (isBotBoardDevPreview()) {
    const f = await readFixture();
    const ok = <T,>(rows: T[]): Read<T> => ({ rows, error: null });
    const weekly: Read<BotWeeklyRow> = f.weekly
      ? ok(Object.values(f.weekly).flat())
      : { rows: [], error: "bot_weekly: not in fixture" };
    const marketStats: Read<BotMarketStatsRow> = f.market_stats
      ? ok(f.market_stats)
      : { rows: [], error: "bot_market_stats: not in fixture" };
    return redactInplay({ scoreboard: ok(f.scoreboard), config: ok(f.config), capabilities: ok(f.capabilities),
             retired: ok(f.retired), weekly, marketStats, now: Date.now() });
  }
  const [scoreboard, config, capabilities, retired, weekly, marketStats] = await Promise.all([
    readAll<BotScoreboardRow>("bot_scoreboard"),
    readAll<BotConfigRow>("bot_config"),
    readAll<BotCapabilitiesRow>("bot_capabilities"),
    // `bots` exists today; only the reason text is taken from it (the contract's
    // scoreboard carries retired_at but not the reason).
    readRetired(),
    // 12 weeks × ~90 bots stays far under the 5000-row cap.
    readAll<BotWeeklyRow>("bot_weekly"),
    readAll<BotMarketStatsRow>("bot_market_stats"),
  ]);
  return redactInplay({ scoreboard, config, capabilities, retired, weekly, marketStats, now: Date.now() });
}

/** In-play bots are judged on lift, never CLV — drop their CLV before it leaves the server. */
function redactInplay(d: BotBoardData): BotBoardData {
  const inplay = new Set<string>();
  for (const r of d.scoreboard.rows) if (r.family === "inplay") inplay.add(r.bot_name);
  for (const r of d.config.rows) if (r.family === "inplay") inplay.add(r.bot_name);
  if (inplay.size === 0) return d;
  const scoreboard = {
    ...d.scoreboard,
    rows: d.scoreboard.rows.map((r) =>
      inplay.has(r.bot_name)
        ? { ...r, clv_mc_n: null, clv_mc_mean: null, clv_mc_se: null, clv_mc_t: null,
            clv_pin_n: null, clv_pin_mean: null, clv_pin_se: null, clv_pin_t: null, clv_outlier_n: null }
        : r,
    ),
  };
  const weekly = {
    ...d.weekly,
    rows: d.weekly.rows.map((r) =>
      inplay.has(r.bot_name) ? { ...r, clv_mc_n: null, clv_mc_mean: null, clv_pin_n: null, clv_pin_mean: null } : r,
    ),
  };
  const marketStats = {
    ...d.marketStats,
    rows: d.marketStats.rows.map((r) =>
      inplay.has(r.bot_name) ? { ...r, clv_mc_n: null, clv_mc_mean: null, clv_mc_sd: null } : r,
    ),
  };
  return { ...d, scoreboard, weekly, marketStats };
}

const redactLedgerRow = (r: BotLedgerRow): BotLedgerRow =>
  r.is_inplay || r.bot_name.startsWith("bot_inplay_") ? { ...r, clv_raw: null, clv_mc: null, clv_pinnacle: null } : r;

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

/** One bot's most recent picks (newest pick first), with team names when migration 411 is live. */
export async function loadBotLedger(botName: string, limit = 30): Promise<Read<BotLedgerRow>> {
  if (isBotBoardDevPreview()) {
    const f = await readFixture();
    return { rows: (f.ledger[botName] ?? []).slice(0, limit).map(redactLedgerRow), error: null };
  }
  // bot_ledger_display = bot_ledger + home_team / away_team (411). Before 411 deploys the
  // view does not exist — fall back to the bare ledger (the drawer shows a match-id stub).
  const display = await readLedger("bot_ledger_display", botName, limit);
  if (!display.error) return display;
  return readLedger("bot_ledger", botName, limit);
}

async function readLedger(relation: string, botName: string, limit: number): Promise<Read<BotLedgerRow>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db
      .from(relation)
      // "*" rather than a column list: the contract leaves model_version /
      // rule_version as "whichever the source carries", so do not pin names.
      .select("*")
      .eq("bot_name", botName)
      .order("pick_time", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return { rows: [], error: `${relation}: ${error.message}` };
    return { rows: ((data ?? []) as BotLedgerRow[]).map(redactLedgerRow), error: null };
  } catch (e) {
    return { rows: [], error: `${relation}: ${e instanceof Error ? e.message : String(e)}` };
  }
}
