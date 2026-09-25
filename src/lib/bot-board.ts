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
import { ownerIds } from "@/lib/admin-auth";
import type {
  BotControlRow,
  ControlChange,
  ControlState,
  CRead,
  FleetState,
  PlacerHeartbeat,
  PlacerRow,
} from "@/lib/bot-controls/types";
import { PREVIEW_REFUSAL } from "@/lib/bot-controls/types";
import { SNAPSHOT_BOOKS, type SnapshotBook } from "@/lib/bot-snapshot-books";

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
  /** [[#159]] FLAT 1-unit ROI at OUR books (odds_at_pick_live) — from bot_performance. */
  roi_unit: number | null;
  /** [[#159]] The same at the best price available on ALL books — the /performance figure. */
  roi_public?: number | null;
  /** [[#159]] Sharp-anchor CLV at the public price — the /performance figure. */
  clv_public?: number | null;
  clv_public_n?: number | null;
  roi_staked?: number | null;
  n_own_recorded?: number | null;
  n_public_recorded?: number | null;
  /** Own-book margin-corrected CLV — the labelled SECONDARY. */
  clv_mc_n: number | null;
  clv_mc_mean: number | null;
  clv_mc_se: number | null;
  clv_mc_t: number | null;
  /** [[#159]] THE CLV: sharp-anchor close (fresh de-vigged Pinnacle, else a 5+-book consensus)
   *  at our books' price. Replaced the legacy clv_pin_* (clv_pinnacle_devig: no close-age
   *  limit, recorded price) — migration 433. */
  clv_anchor_n: number | null;
  clv_anchor_n_pinnacle?: number | null;
  clv_anchor_n_consensus?: number | null;
  clv_anchor_mean: number | null;
  clv_anchor_se: number | null;
  clv_anchor_t: number | null;
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
  /** LEGACY (clv_pinnacle_devig / shadow clv_pinnacle) — never shown; use clv_anchor_own. */
  clv_pinnacle: number | null;
  /** [[#159]] per-leg sharp-anchor CLV at our books' price (bot_ledger, migration 433). */
  clv_anchor_own?: number | null;
  clv_anchor_source?: string | null;
  odds_own?: number | null;
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
  clv_anchor_n: number | null;
  clv_anchor_mean: number | null;
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
  /** [[#159]] sharp-anchor CLV per market (migration 433) — the junk-control comparison. */
  clv_anchor_n: number | null;
  clv_anchor_mean: number | null;
  clv_anchor_sd: number | null;
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
  /** IA move P7: real_bets placed rows per bot and current prices (dump_bot_board_fixture.py). */
  placed?: Record<string, PlacedRaw[]>;
  prices?: PriceRaw[];
  /** The REAL control state (dump_bot_board_fixture.py, #139 UX fix round). Absent in older snapshots. */
  control?: {
    fleet: FleetState | null;
    placers: PlacerRow[];
    bots: BotControlRow[];
    heartbeats: PlacerHeartbeat[];
    changes: ControlChange[];
  };
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
            clv_anchor_n: null, clv_anchor_mean: null, clv_anchor_se: null, clv_anchor_t: null,
            clv_public: null, clv_public_n: null, clv_outlier_n: null }
        : r,
    ),
  };
  const weekly = {
    ...d.weekly,
    rows: d.weekly.rows.map((r) =>
      inplay.has(r.bot_name) ? { ...r, clv_mc_n: null, clv_mc_mean: null, clv_anchor_n: null, clv_anchor_mean: null } : r,
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
  r.is_inplay || r.bot_name.startsWith("bot_inplay_") ? { ...r, clv_raw: null, clv_mc: null, clv_pinnacle: null, clv_anchor_own: null } : r;

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


// ── Control state (#139 phase A: the /admin/bots control panel) ───────────────────────────────
//
// Service-role reads, server only: the fleet switches (named columns only — never the JWT or
// cookies on the same row), the real-money eligibility list, per-bot /picks flags, the Mac placer
// heartbeats and the last 50 audited control changes (engine migration 413). Every read reports
// its own error so an unreadable layer renders as "Unknown", never as "Off".

const FLEET_COLS =
  "placement_paused, placement_paused_at, placement_paused_reason, real_money_armed, real_money_armed_at, " +
  "real_money_armed_reason, publishing_paused, publishing_paused_at, publishing_paused_reason, daemons_paused, " +
  "daemons_paused_at, daemons_paused_reason, money_gate_contract";

async function readRows<T>(relation: string, columns: string, order?: { col: string; asc: boolean }, limit = 5000): Promise<CRead<T>> {
  try {
    const db = createServerServiceClient();
    let q = db.from(relation).select(columns).limit(limit);
    if (order) q = q.order(order.col, { ascending: order.asc });
    const { data, error } = await q;
    if (error) return { rows: [], error: `${relation}: ${error.message}` };
    return { rows: (data ?? []) as T[], error: null };
  } catch (e) {
    return { rows: [], error: `${relation}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Everything the controls render. `viewerUserId` decides the owner-only Arm button. */
export async function loadControlState(viewerUserId: string | null): Promise<ControlState> {
  if (isBotBoardDevPreview()) return previewControlState(await readFixture(), await readActivityChanges());
  const [fleet, placers, bots, heartbeats, changes] = await Promise.all([
    readFleet(),
    readRows<PlacerRow>("coolbet_placer_bots", "bot_name, ui_place_enabled, locked_reason, note, updated_at"),
    // vip (migration 420): the paid-tier bot is on /performance whatever its label — the sheet's
    // "/performance because …" line reads it. Extra column, carried at runtime (BotControlVip).
    readRows<BotControlRow>("bots", "name, show_on_picks, maturity_label, is_active, retired_at, display_name, vip"),
    readRows<PlacerHeartbeat>("placer_heartbeats", "placer, host, last_seen_at, execute_requested, execute_effective, refused_reason, result"),
    readRows<ControlChange>(
      "control_changes",
      "id, created_at, actor, source, control, bot_name, old_value, new_value, reason, outcome, refusal",
      { col: "id", asc: false },
      50,
    ),
  ]);
  return {
    fleet,
    placers,
    bots,
    heartbeats,
    changes,
    viewer: { isOwner: !!viewerUserId && ownerIds().has(viewerUserId), readOnly: false, readOnlyReason: null },
  };
}

/**
 * Just the fleet switches — the shared admin shell's STATUS block (src/app/(app)/admin/layout.tsx)
 * reads this on every admin page. One row, not the five reads loadControlState() makes.
 */
export async function loadFleetStatus(): Promise<ControlState["fleet"]> {
  if (isBotBoardDevPreview()) return previewControlState(await readFixture(), null).fleet;
  return readFleet();
}

async function readFleet(): Promise<ControlState["fleet"]> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db.from("coolbet_session_state").select(FLEET_COLS).eq("id", 1).maybeSingle();
    if (error) return { row: null, error: `coolbet_session_state: ${error.message}` };
    if (!data) return { row: null, error: "coolbet_session_state: row missing" };
    return { row: data as unknown as FleetState, error: null };
  } catch (e) {
    return { row: null, error: `coolbet_session_state: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * The /admin/activity preview snapshot's control_changes (admin-activity.json, written by the
 * engine's dump_admin_fixture.py --page activity), so the bots page's Activity drawer shows the
 * SAME rows as /admin/activity. null when that snapshot is absent.
 */
async function readActivityChanges(): Promise<ControlChange[] | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { dirname, join } = await import("node:path");
    const file = join(dirname(process.env.BOT_BOARD_FIXTURE as string), "admin-activity.json");
    const j = JSON.parse(await readFile(file, "utf8")) as { changes?: ControlChange[] };
    return Array.isArray(j.changes) ? j.changes.slice(0, 50) : null;
  } catch {
    return null;
  }
}

/**
 * Control state for the design preview — the REAL rows from the snapshot (#139 UX fix round,
 * 2026-09-24). It used to be invented (a fake owner@example.test change, a refused off→on, a
 * Telegram /pause, a 26-hour-old heartbeat), so the Activity drawer disagreed with /admin/activity
 * and the ladder showed a placer check-in that never happened. Now: fleet, eligibility rows, bots
 * and heartbeats from the bot-board snapshot's `control` block; the audit rows from
 * admin-activity.json when present (so both pages list the same changes), else the snapshot's own.
 * An older snapshot without `control` renders every layer as unreadable (Unknown), never as a
 * made-up state. `readOnly` keeps every control disabled, and the write routes refuse regardless.
 */
function previewControlState(f: BotBoardFixture, activity: ControlChange[] | null): ControlState {
  const c = f.control;
  const missing = "not in the preview snapshot — re-run scripts/dump_bot_board_fixture.py";
  const changes = activity ?? c?.changes ?? null;
  return {
    fleet: c?.fleet ? { row: c.fleet, error: null } : { row: null, error: `coolbet_session_state: ${missing}` },
    placers: c ? { rows: c.placers, error: null } : { rows: [], error: `coolbet_placer_bots: ${missing}` },
    bots: c ? { rows: c.bots, error: null } : { rows: [], error: `bots: ${missing}` },
    heartbeats: c ? { rows: c.heartbeats, error: null } : { rows: [], error: `placer_heartbeats: ${missing}` },
    changes: changes ? { rows: changes, error: null } : { rows: [], error: `control_changes: ${missing}` },
    viewer: { isOwner: true, readOnly: true, readOnlyReason: PREVIEW_REFUSAL },
  };
}

// ── Picks tab: placements + current prices (IA move P7, 2026-09-24) ──────────────────────────
//
// /admin/shadow-bots/[bot] is retired into the /admin/bots sheet. What it had that the sheet
// lacked is added HERE, on top of bot_ledger, so the sheet stays on the one unified ledger:
//
//  * "Bet made": was real money staked on this exact pick, at what price, where? From real_bets
//    with placed_real IS NOT FALSE (TRUE = money moved; NULL = a legacy reconciled real bet;
//    FALSE = the paper daemon's execute=False rows, excluded). Matched by the ledger row's own
//    id (real_bets.shadow_bet_id / simulated_bet_id) OR by (match, market, selection) of the
//    same bot — shadow ledger rows are the EARLIEST cohort row of a pick, while the placer may
//    have linked a later cohort row, so the id alone misses some. Forward-test rows carry no
//    bot_id and cannot be linked to a placement at all: the sheet says so instead of "no".
//  * Current price at our three books (Coolbet, Unibet-Site, Epicbet) for PENDING PRE-MATCH
//    picks only, latest non-live snapshot in the last 12 h. Unibet is the PLACEABLE site feed
//    (UB-COLUMN-NOT-PLACEABLE: never the Kambi API, which unibet.ee left on 2026-09-06). One
//    query per book, constrained to the page's matches and markets, so one high-volume book
//    cannot push the others past PostgREST's row cap (OU-COLUMN-CEILING). In-play picks get no
//    price: a pre-match quote says nothing about a bet placed during the match.
//
// Deliberately NOT carried over: the old page's "Min odds" column. It applied one model-edge
// formula, 1/(p − floor), to every bot — wrong for sharp bots (multiplicative floor), for
// in-play and for tiered floors (#139 finding b), and bot_ledger carries no probability to
// compute it honestly. Each family's own gate is shown in the sheet's Configuration instead.

// SNAPSHOT_BOOKS lives in bot-snapshot-books.ts so the client table can import it too.
export { SNAPSHOT_BOOKS, type SnapshotBook } from "@/lib/bot-snapshot-books";

export interface BotPickPlacement {
  odds: number | null;
  bookmaker: string | null;
  stake: number | null;
  /** TRUE = money moved; NULL = legacy reconciled real bet. */
  placedReal: boolean | null;
}

export interface BotPickPrice {
  odds: number;
  ts: string;
}

export interface BotPickRow extends BotLedgerRow {
  /** null = no real bet on this pick (or not linkable — see BotPicksResult.placementLinked). */
  placed: BotPickPlacement | null;
  /** Pending pre-match picks only; null otherwise. */
  now: Partial<Record<SnapshotBook, BotPickPrice>> | null;
}

export interface BotPicksResult {
  rows: BotPickRow[];
  error: string | null;
  /** real_bets unreadable → "Bet made" renders Unknown, never "no". */
  placedError: string | null;
  pricesError: string | null;
  /** false when the bot's ledger rows carry no bot_id (forward-test arms): placements cannot be linked. */
  placementLinked: boolean;
  hasMore: boolean;
  /**
   * Picks of this bot that carry a real bet, over its WHOLE ledger (distinct match · market ·
   * selection among its real_bets rows) — not just the loaded page. null = unknown (real_bets
   * unreadable, or the bot's rows carry no bot id). #139 UX fix round: the tab used to say
   * "No real money on any of these 50 picks", which was only about the loaded rows.
   */
  placedPicks: number | null;
  /** true = this result is the "Bet made only" filter, applied server-side over the whole ledger. */
  placedOnly: boolean;
}

interface PlacedRaw {
  match_id: string | null;
  market: string | null;
  selection: string | null;
  actual_odds: number | string | null;
  bookmaker: string | null;
  stake: number | string | null;
  placed_real: boolean | null;
  shadow_bet_id: string | null;
  simulated_bet_id: string | null;
}

interface PriceRaw {
  match_id: string;
  market: string;
  selection: string;
  bookmaker: string;
  odds: number | string;
  timestamp: string;
}

const pickKey = (m: string | null, market: string | null, sel: string | null) =>
  `${m ?? ""}|${(market ?? "").toLowerCase()}|${(sel ?? "").toLowerCase()}`;

const isInplayRow = (r: BotLedgerRow) => r.is_inplay === true || /^(bot_)?inplay_/.test(r.bot_name);

/** Pending, pre-match, kick-off still ahead: the only picks a "current price" means anything for. */
function wantsPrice(r: BotLedgerRow, now: number): boolean {
  return r.result === "pending" && !isInplayRow(r) && !!r.match_id && !!r.kickoff && new Date(r.kickoff).getTime() > now;
}

function attachExtras(rows: BotLedgerRow[], placed: PlacedRaw[], prices: PriceRaw[], now: number): BotPickRow[] {
  const byId = new Map<string, PlacedRaw>();
  const byKey = new Map<string, PlacedRaw>();
  for (const p of placed) {
    if (p.shadow_bet_id) byId.set(p.shadow_bet_id, p);
    if (p.simulated_bet_id) byId.set(p.simulated_bet_id, p);
    const k = pickKey(p.match_id, p.market, p.selection);
    if (!byKey.has(k)) byKey.set(k, p);
  }
  const priceBy = new Map<string, Partial<Record<SnapshotBook, BotPickPrice>>>();
  for (const p of prices) {
    if (!(SNAPSHOT_BOOKS as readonly string[]).includes(p.bookmaker)) continue;
    const k = pickKey(p.match_id, p.market, p.selection);
    const cur = priceBy.get(k) ?? {};
    const book = p.bookmaker as SnapshotBook;
    // rows arrive newest-first; keep the first (latest) quote per book
    if (!cur[book]) cur[book] = { odds: Number(p.odds), ts: p.timestamp };
    priceBy.set(k, cur);
  }
  return rows.map((r) => {
    const k = pickKey(r.match_id, r.market, r.selection);
    const p = byId.get(r.pick_id) ?? (r.bot_id ? byKey.get(k) : undefined);
    return {
      ...r,
      placed: p
        ? {
            odds: p.actual_odds == null ? null : Number(p.actual_odds),
            bookmaker: p.bookmaker,
            stake: p.stake == null ? null : Number(p.stake),
            placedReal: p.placed_real,
          }
        : null,
      now: wantsPrice(r, now) ? priceBy.get(k) ?? {} : null,
    };
  });
}

const distinctPicks = (placed: PlacedRaw[]) => new Set(placed.map((p) => pickKey(p.match_id, p.market, p.selection))).size;

/**
 * One page of a bot's picks (newest pick first) with "Bet made" and current prices attached.
 * `limit` ≤ 100; `hasMore` says whether an older page exists. `placedOnly` = only picks that
 * carry a real bet, filtered over the WHOLE ledger (not the loaded page): the placed rows'
 * matches are read first, then only those matches' ledger rows.
 */
export async function loadBotPicks(
  botName: string,
  { limit = 50, offset = 0, placedOnly = false }: { limit?: number; offset?: number; placedOnly?: boolean } = {},
): Promise<BotPicksResult> {
  const lim = Math.max(1, Math.min(100, limit));
  const off = Math.max(0, offset);
  const now = Date.now();
  if (isBotBoardDevPreview()) {
    const f = await readFixture();
    const all = (f.ledger[botName] ?? []).map(redactLedgerRow);
    const linked = all.some((r) => r.bot_id);
    const placed = linked ? f.placed?.[botName] ?? [] : [];
    const placedError = f.placed ? null : "real_bets: not in fixture";
    const pool = placedOnly ? attachExtras(all, placed, [], now).filter((r) => r.placed) : null;
    const page = pool ? pool.slice(off, off + lim) : all.slice(off, off + lim);
    return {
      rows: attachExtras(page, placed, f.prices ?? [], now),
      error: null,
      placedError,
      pricesError: f.prices ? null : "odds_snapshots: not in fixture",
      placementLinked: linked || all.length === 0,
      hasMore: (pool ?? all).length > off + lim,
      placedPicks: linked && !placedError ? distinctPicks(placed) : null,
      placedOnly,
    };
  }
  if (placedOnly) return loadPlacedPicks(botName, lim, off, now);
  let page = await readLedgerPage("bot_ledger_display", botName, lim + 1, off);
  if (page.error) page = await readLedgerPage("bot_ledger", botName, lim + 1, off);
  if (page.error) return { rows: [], error: page.error, placedError: null, pricesError: null, placementLinked: true, hasMore: false, placedPicks: null, placedOnly };
  const hasMore = page.rows.length > lim;
  const rows = page.rows.slice(0, lim);
  const botId = rows.find((r) => r.bot_id)?.bot_id ?? null;
  const [placed, prices] = await Promise.all([botId ? readPlaced(botId) : Promise.resolve({ rows: [] as PlacedRaw[], error: null }), readPrices(rows, now)]);
  return {
    rows: attachExtras(rows, placed.rows, prices.rows, now),
    error: null,
    placedError: placed.error,
    pricesError: prices.error,
    placementLinked: !!botId || rows.length === 0,
    hasMore,
    placedPicks: botId && !placed.error ? distinctPicks(placed.rows) : null,
    placedOnly,
  };
}

/** "Bet made only", server-side: the bot's real bets → their matches' ledger rows → linked ones. */
async function loadPlacedPicks(botName: string, lim: number, off: number, now: number): Promise<BotPicksResult> {
  const empty = { rows: [], pricesError: null, hasMore: false, placedOnly: true };
  let botId: string | null = null;
  try {
    const db = createServerServiceClient();
    const { data, error } = await db.from("bots").select("id").eq("name", botName).maybeSingle();
    if (error) return { ...empty, error: null, placedError: `bots: ${error.message}`, placementLinked: true, placedPicks: null };
    botId = (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    return { ...empty, error: null, placedError: `bots: ${e instanceof Error ? e.message : String(e)}`, placementLinked: true, placedPicks: null };
  }
  // No `bots` row (forward-test arms, the control): their ledger rows cannot be linked to a bet.
  if (!botId) return { ...empty, error: null, placedError: null, placementLinked: false, placedPicks: null };
  const placed = await readPlaced(botId);
  if (placed.error) return { ...empty, error: null, placedError: placed.error, placementLinked: true, placedPicks: null };
  const matchIds = [...new Set(placed.rows.map((p) => p.match_id).filter((m): m is string => !!m))];
  const ledger: BotLedgerRow[] = [];
  // ≤ 100 match ids per request keeps the PostgREST URL short.
  for (let i = 0; i < matchIds.length; i += 100) {
    const chunk = matchIds.slice(i, i + 100);
    let r = await readLedgerForMatches("bot_ledger_display", botName, chunk);
    if (r.error) r = await readLedgerForMatches("bot_ledger", botName, chunk);
    if (r.error) return { ...empty, error: r.error, placedError: null, placementLinked: true, placedPicks: null };
    ledger.push(...r.rows);
  }
  ledger.sort((a, b) => (b.pick_time ?? "").localeCompare(a.pick_time ?? ""));
  const withBet = attachExtras(ledger, placed.rows, [], now).filter((r) => r.placed);
  const page = withBet.slice(off, off + lim);
  const prices = await readPrices(page, now);
  return {
    rows: attachExtras(page, placed.rows, prices.rows, now),
    error: null,
    placedError: null,
    pricesError: prices.error,
    placementLinked: true,
    hasMore: withBet.length > off + lim,
    placedPicks: distinctPicks(placed.rows),
    placedOnly: true,
  };
}

async function readLedgerForMatches(relation: string, botName: string, matchIds: string[]): Promise<Read<BotLedgerRow>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db
      .from(relation)
      .select("*")
      .eq("bot_name", botName)
      .in("match_id", matchIds)
      .order("pick_time", { ascending: false, nullsFirst: false })
      .limit(5000);
    if (error) return { rows: [], error: `${relation}: ${error.message}` };
    return { rows: ((data ?? []) as BotLedgerRow[]).map(redactLedgerRow), error: null };
  } catch (e) {
    return { rows: [], error: `${relation}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function readLedgerPage(relation: string, botName: string, count: number, offset: number): Promise<Read<BotLedgerRow>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db
      .from(relation)
      .select("*")
      .eq("bot_name", botName)
      .order("pick_time", { ascending: false, nullsFirst: false })
      .range(offset, offset + count - 1);
    if (error) return { rows: [], error: `${relation}: ${error.message}` };
    return { rows: ((data ?? []) as BotLedgerRow[]).map(redactLedgerRow), error: null };
  } catch (e) {
    return { rows: [], error: `${relation}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function readPlaced(botId: string): Promise<Read<PlacedRaw>> {
  try {
    const db = createServerServiceClient();
    const { data, error } = await db
      .from("real_bets")
      .select("match_id, market, selection, actual_odds, bookmaker, stake, placed_real, shadow_bet_id, simulated_bet_id")
      .eq("bot_id", botId)
      .not("placed_real", "is", false)
      .order("placed_at", { ascending: false })
      .limit(5000);
    if (error) return { rows: [], error: `real_bets: ${error.message}` };
    return { rows: (data ?? []) as PlacedRaw[], error: null };
  } catch (e) {
    return { rows: [], error: `real_bets: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function readPrices(rows: BotLedgerRow[], now: number): Promise<Read<PriceRaw>> {
  const want = rows.filter((r) => wantsPrice(r, now));
  if (want.length === 0) return { rows: [], error: null };
  const matchIds = [...new Set(want.map((r) => r.match_id as string))];
  const markets = [...new Set(want.map((r) => (r.market ?? "").toLowerCase()).filter(Boolean))];
  const since = new Date(now - 12 * 3600_000).toISOString();
  try {
    const db = createServerServiceClient();
    const per = await Promise.all(
      SNAPSHOT_BOOKS.map((book) =>
        db
          .from("odds_snapshots")
          .select("match_id, market, selection, odds, timestamp, bookmaker")
          .in("match_id", matchIds)
          .in("market", markets)
          .eq("bookmaker", book)
          .eq("is_live", false)
          .gte("timestamp", since)
          .order("timestamp", { ascending: false })
          .limit(5000),
      ),
    );
    const err = per.find((r) => r.error)?.error;
    return { rows: per.flatMap((r) => (r.data ?? []) as PriceRaw[]), error: err ? `odds_snapshots: ${err.message}` : null };
  } catch (e) {
    return { rows: [], error: `odds_snapshots: ${e instanceof Error ? e.message : String(e)}` };
  }
}
