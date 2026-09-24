/**
 * /admin Overview data (#139, 2026-09-24): the attention inbox (IA move P4) plus the dashboard
 * charts the owner asked for ("like the admin dashboards on Google — graphs, bars, columns").
 *
 * Composed from reads that already exist — bot_scoreboard / bot_weekly / bot_config /
 * bot_capabilities (loadBotBoard), the control state, feed_status, data_quality_findings,
 * simulated_bets (stale pending), real_bets — plus view pipeline_job_latest (engine migration 417:
 * latest run per job over 35 days with its failure streak; the web's getLatestJobStatuses only sees
 * ~2 h of history and missed every nightly failure).
 * Server-only (service-role client). In the dev fixture preview the non-bot reads come from the
 * fixture's `overview` block (odds-intel-engine scripts/dump_bot_board_fixture.py).
 *
 * Honesty rules carried over from /admin/bots: bots are scored by the same view model
 * (bot-board-model.ts), so a verdict here is the verdict there; a week with fewer than 5 CLV rows
 * is a gap, not a point; an unreadable source shows as unreadable, never as zero.
 */
import { createServerServiceClient } from "@/lib/supabase-server";
import type { FeedStatus } from "@/lib/engine-data";
import { computeLadder } from "@/lib/bot-controls/ladder";
import { placementPathReason } from "@/lib/bot-controls/placement-path";
import { isBotBoardDevPreview, loadBotBoard, loadControlState, type BotWeeklyRow } from "@/lib/bot-board";
import { MANUAL_RECONCILE_SINCE, buildAttention, type AttentionItem } from "@/lib/admin-attention";
import { RETIRED_SERIES } from "@/lib/admin-overview-shared";
import {
  CONTROL_BOT,
  FAMILY_INFO,
  buildView,
  controlRef,
  isActive,
  needsALook,
  picksTelegramMismatch,
  weekStart,
  withUnpickedBots,
  type BotView,
  type Verdict,
} from "@/app/(app)/admin/bots/bot-board-model";
import type { ControlState } from "@/lib/bot-controls/types";

export interface WeekRealBets {
  week: string;
  bets: number;
  staked: number;
  pnl: number;
}

/** Real bets in the last 30 days — the SAME window and rules as the Real bets page (paper rows
 *  excluded, P/L on settled bets only), so the two pages show one number (UX test 2026-09-24). */
export interface RealWindow {
  days: number;
  bets: number;
  staked: number;
  pnl: number;
}

/** One row of view pipeline_job_latest (engine migration 417): latest run per job, 35 days. */
export interface JobLatest {
  job_name: string;
  status: string;
  started_at: string;
  error_message: string | null;
  last_ok_at: string | null;
  fail_streak: number | null;
  failing_since: string | null;
}

export interface OverviewData {
  now: number;
  attention: AttentionItem[];
  control: ControlState;
  feeds: { rows: FeedStatus[]; error: string | null };
  bots: {
    active: number;
    published: number;
    telegram: number;
    /** Bots whose € switch is ON and would pass ladder layer 2 (on, not locked, has a placement path). */
    switchedOn: number | null;
    error: string | null;
    verdicts: Record<Verdict, number>;
  };
  /** 12 ISO week starts, oldest first. */
  weeks: string[];
  /** picks per week per family (families as keys, + one 'retired' series). */
  picksByFamily: Record<string, number | string>[];
  families: string[];
  /** mc-CLV per week per pre-match family (weighted by CLV rows within the family); null = < 5 rows. */
  clvByFamily: Record<string, number | string | null>[];
  clvFamilies: string[];
  canStake: "yes" | "no" | "unknown";
  /** feed_status not rewritten for > 15 min — every feed colour is stale (same rule as /admin/feeds). */
  feedsStale: boolean;
  /** Cumulative flat 1-unit P/L per family (+ one 'retired' series). */
  pnlByFamily: Record<string, number | string | null>[];
  realBets: { rows: WeekRealBets[]; error: string | null; last30: RealWindow | null };
  /** Plain-language reasons real money cannot move now (ladder layers that block), [] when it can. */
  moneyBlockers: string[];
  jobs: { failed: number; total: number; error: string | null };
  /** Active bots for the ⌘K palette (name + display name). */
  botNames: { name: string; label: string }[];
}

const BLOCKER_WORDS: Record<string, string> = {
  path: "no bot can be placed",
  eligible: "no bot switched on",
  pause: "placement paused",
  armed: "not armed",
  executors: "Mac placer not running",
};

/** Families judged on margin-corrected CLV (model_sim is Pinnacle-judged; in-play has no close). */
const MC_FAMILIES = ["forward_test", "sharp_trigger", "sharp_generator", "model_shadow"];

const WEEKS = 12;
const MIN_CLV_N = 5;

interface OverviewFixture {
  feeds?: FeedStatus[];
  jobs?: JobLatest[];
  stale_pending?: number;
  dq_24h?: { check_name: string; n: number }[];
  unconfirmed_manual?: number;
  real_bets_weekly?: WeekRealBets[];
  real_bets_30d?: RealWindow;
}

async function readOverviewFixture(): Promise<OverviewFixture> {
  const { readFile } = await import("node:fs/promises");
  const f = JSON.parse(await readFile(process.env.BOT_BOARD_FIXTURE as string, "utf8")) as { overview?: OverviewFixture };
  return f.overview ?? {};
}

type R<T> = { v: T; error: string | null };

async function realBetsWeekly(now: number): Promise<{ rows: WeekRealBets[]; error: string | null; last30: RealWindow | null }> {
  try {
    const db = createServerServiceClient();
    // from whichever starts earlier: 12 weeks of buckets, or the 30-day window
    const since = new Date(Math.min(weekStart(now) - (WEEKS - 1) * 7 * 86_400_000, now - 30 * 86_400_000)).toISOString();
    const { data, error } = await db
      .from("real_bets")
      .select("placed_at, stake, pnl, result, placed_real")
      .gte("placed_at", since)
      // paper rows (placed_real = false) are not money — same rule as engine-data's real-bets reads
      .or("placed_real.is.null,placed_real.eq.true")
      .limit(5000);
    if (error) return { rows: [], error: `real_bets: ${error.message}`, last30: null };
    const by = new Map<string, WeekRealBets>();
    const last30: RealWindow = { days: 30, bets: 0, staked: 0, pnl: 0 };
    const cut30 = now - 30 * 86_400_000;
    for (const r of (data ?? []) as { placed_at: string; stake: number | null; pnl: number | null; result: string | null }[]) {
      if (new Date(r.placed_at).getTime() >= cut30) {
        last30.bets += 1;
        last30.staked += Number(r.stake ?? 0);
        if (r.result && r.result !== "pending") last30.pnl += Number(r.pnl ?? 0);
      }
      const w = new Date(weekStart(new Date(r.placed_at).getTime())).toISOString().slice(0, 10);
      const cur = by.get(w) ?? { week: w, bets: 0, staked: 0, pnl: 0 };
      cur.bets += 1;
      cur.staked += Number(r.stake ?? 0);
      if (r.result && r.result !== "pending") cur.pnl += Number(r.pnl ?? 0);
      by.set(w, cur);
    }
    return { rows: [...by.values()], error: null, last30 };
  } catch (e) {
    return { rows: [], error: `real_bets: ${e instanceof Error ? e.message : String(e)}`, last30: null };
  }
}

// The engine-data helpers for these tables swallow read errors (`data ?? []`), which would render
// an unreadable source as "all clear". The Overview reads them itself and keeps the error.
async function read<T>(label: string, q: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, fallback: T): Promise<R<T>> {
  try {
    const { data, error } = await q();
    if (error) return { v: fallback, error: `${label}: ${error.message}` };
    return { v: (data ?? fallback) as T, error: null };
  } catch (e) {
    return { v: fallback, error: `${label}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function readLive(now: number) {
  const db = createServerServiceClient();
  const since24 = new Date(now - 86_400_000).toISOString();
  const [feeds, jobs, dq, pending, manual] = await Promise.all([
    read<FeedStatus[]>("feed_status", () => db.from("feed_status").select("*"), []),
    read<JobLatest[]>("pipeline_job_latest", () => db.from("pipeline_job_latest").select("*"), []),
    read<{ check_name: string }[]>("data_quality_findings", () => db.from("data_quality_findings").select("check_name").gte("found_at", since24).limit(5000), []),
    read<{ match: { date: string } | null }[]>(
      "simulated_bets",
      () => db.from("simulated_bets").select("match:match_id(date)").eq("result", "pending").limit(5000),
      [],
    ),
    read<{ id: string }[]>(
      "real_bets",
      () => db.from("real_bets").select("id").is("placed_real", null).gte("placed_at", MANUAL_RECONCILE_SINCE).lt("placed_at", since24).limit(5000),
      [],
    ),
  ]);
  const cutoff = now - 2.5 * 3600_000; // same 150-min rule as getStalePendingBets (settlement sweep races below it)
  const stale = pending.v.filter((b) => b.match?.date && new Date(b.match.date).getTime() < cutoff).length;
  const dqMap = new Map<string, number>();
  for (const r of dq.v) dqMap.set(r.check_name, (dqMap.get(r.check_name) ?? 0) + 1);
  return {
    feeds,
    jobs,
    stale: { v: stale, error: pending.error },
    dq: { v: [...dqMap.entries()].map(([check_name, n]) => ({ check_name, n })), error: dq.error },
    manual: { v: manual.v.length, error: manual.error },
  };
}

export async function loadOverview(viewerId: string | null): Promise<OverviewData> {
  const preview = isBotBoardDevPreview();
  const fx = preview ? await readOverviewFixture() : null;
  const now = Date.now();

  const [board, control, live, realBets] = await Promise.all([
    loadBotBoard(),
    loadControlState(viewerId),
    fx
      ? Promise.resolve({
          feeds: { v: fx.feeds ?? [], error: fx.feeds ? null : "feed_status: not in fixture" },
          jobs: { v: fx.jobs ?? [], error: fx.jobs ? null : "pipeline_job_latest: not in fixture" },
          stale: { v: fx.stale_pending ?? 0, error: null },
          dq: { v: fx.dq_24h ?? [], error: null },
          manual: { v: fx.unconfirmed_manual ?? 0, error: null },
        })
      : readLive(now),
    fx
      ? Promise.resolve({ rows: fx.real_bets_weekly ?? [], error: fx.real_bets_weekly ? null : "real_bets: not in fixture", last30: fx.real_bets_30d ?? null })
      : realBetsWeekly(now),
  ]);
  const { feeds: feedsR, jobs: jobsR, stale: staleR, dq: dqR, manual: manualR } = live;

  // ── bots: the same view model as /admin/bots ──
  const cfgBy = new Map(board.config.rows.map((c) => [c.bot_name, c]));
  const capsBy = new Map(board.capabilities.rows.map((c) => [c.bot_name, c]));
  const sbBy = new Map(board.scoreboard.rows.map((s) => [s.bot_name, s]));
  const weeklyBy = board.weekly.error ? null : groupBy(board.weekly.rows, (r) => r.bot_name);
  const marketsBy = board.marketStats.error ? null : groupBy(board.marketStats.rows, (r) => r.bot_name);
  const ctlRef = controlRef(sbBy.get(CONTROL_BOT), marketsBy ? marketsBy.get(CONTROL_BOT) ?? [] : null);
  // + registered active bots with no pick yet (no bot_scoreboard row) — same helper as /admin/bots
  const sbRows = withUnpickedBots(board.scoreboard.rows, board.config.rows, control.bots.error ? [] : control.bots.rows);
  const views: BotView[] = sbRows
    .filter(isActive)
    .filter((sb) => sb.bot_name !== CONTROL_BOT)
    .map((sb) => buildView(sb.bot_name, sb, cfgBy.get(sb.bot_name), capsBy.get(sb.bot_name), { control: ctlRef, weekly: weeklyBy, markets: marketsBy, now, active: true }));
  const fleetCaps = board.capabilities.rows[0]
    ? { ...board.capabilities.rows[0], fleet_placement_paused: control.fleet.row?.placement_paused ?? null, fleet_real_money_armed: control.fleet.row?.real_money_armed ?? null }
    : undefined;
  // same rule as /admin/bots: a locked-off bot whose source is gone is info, not a to-do
  const lockedBots = new Set(control.placers.rows.filter((p) => !!p.locked_reason).map((p) => p.bot_name));
  const issues = needsALook(views, fleetCaps, [
    { view: "bot_scoreboard", error: board.scoreboard.error },
    { view: "bot_config", error: board.config.error },
    { view: "bot_capabilities", error: board.capabilities.error },
  ], now, { lockedBots });
  const showBy = new Map(control.bots.rows.map((b) => [b.name, b.show_on_picks]));
  for (const v of views) {
    if (picksTelegramMismatch(v, control.bots.error ? null : showBy.get(v.name) ?? null)) {
      issues.push({ bot: v.name, text: `${v.displayName}: /picks ≠ Telegram`, severity: "warn" });
    }
  }
  const verdicts: Record<Verdict, number> = { beats: 0, loses: 0, inconclusive: 0, early: 0, noclv: 0 };
  for (const v of views) verdicts[v.verdict] += 1;

  // The real-money ladder, computed exactly as /admin/bots does (capable = placement-path rule).
  const capable = board.config.error ? null : views.filter((v) => placementPathReason(v.family, v.cfg?.ledger, v.cfg?.books) == null).map((v) => v.name);
  const ladder = computeLadder(control, capable, now);
  const capSet = capable ? new Set(capable) : null;
  const switchedOn = control.placers.error
    ? null
    : control.placers.rows.filter((p) => p.ui_place_enabled && !p.locked_reason && (!capSet || capSet.has(p.bot_name))).length;

  // ── weekly charts ──
  // Active bots by family, plus ONE "retired" series: ~45 bots were retired in this window, and
  // dropping their history would read fleet turnover as 30x growth. Forward-test arms appear under
  // their CURRENT rule version only (bot_weekly's contract), so earlier-rule picks are not counted.
  const w0 = weekStart(now);
  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(w0 - (WEEKS - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10));
  const famOf = new Map(views.map((v) => [v.name, v.family]));
  const activeFamilies = Object.keys(FAMILY_INFO).filter((f) => f !== "control" && views.some((v) => v.family === f));
  const families = [...activeFamilies, RETIRED_SERIES];
  const weekKey = (r: BotWeeklyRow) => new Date(weekStart(new Date(r.week).getTime())).toISOString().slice(0, 10);
  const idx = new Map(weeks.map((w, i) => [w, i]));
  const zero = () => Object.fromEntries(families.map((f) => [f, 0])) as Record<string, number>;
  const picksWeek = weeks.map(zero);
  const pnlWeek = weeks.map(zero);
  const clvAgg = weeks.map(() => Object.fromEntries(MC_FAMILIES.map((f) => [f, { n: 0, s: 0 }])) as Record<string, { n: number; s: number }>);
  for (const r of board.weekly.rows) {
    const i = idx.get(weekKey(r));
    if (i == null || r.bot_name === CONTROL_BOT) continue;
    const fam = famOf.get(r.bot_name) ?? RETIRED_SERIES;
    picksWeek[i][fam] += r.picks ?? 0;
    pnlWeek[i][fam] += r.pnl_unit ?? 0;
    if (MC_FAMILIES.includes(fam) && r.clv_mc_n && r.clv_mc_mean != null) {
      clvAgg[i][fam].n += r.clv_mc_n;
      clvAgg[i][fam].s += r.clv_mc_mean * r.clv_mc_n;
    }
  }
  const picksByFamily = weeks.map((week, i) => ({ week, ...picksWeek[i] }));
  const clvFamilies = MC_FAMILIES.filter((f) => views.some((v) => v.family === f));
  const clvByFamily = weeks.map((week, i) => {
    const row: Record<string, number | string | null> = { week };
    for (const f of clvFamilies) row[f] = clvAgg[i][f].n >= MIN_CLV_N ? clvAgg[i][f].s / clvAgg[i][f].n : null;
    return row;
  });
  const running = zero();
  const pnlByFamily = weeks.map((week, i) => {
    const row: Record<string, number | string | null> = { week };
    for (const f of families) {
      running[f] += pnlWeek[i][f];
      row[f] = Math.round(running[f] * 100) / 100;
    }
    return row;
  });

  const realRows = weeks.map((week) => realBets.rows.find((r) => r.week === week) ?? { week, bets: 0, staked: 0, pnl: 0 });

  const attention = buildAttention({
    now,
    control,
    canStake: ladder.canStake,
    feeds: feedsR.v,
    feedsError: feedsR.error,
    jobs: jobsR.v,
    jobsError: jobsR.error,
    stalePending: staleR.v,
    staleError: staleR.error,
    dqLast24h: dqR.v,
    dqError: dqR.error,
    unconfirmedManual: manualR.v,
    unconfirmedError: manualR.error,
    bots: issues.filter((x): x is typeof x & { bot: string } => !!x.bot),
  });
  // view-level errors (no bot) still belong in the inbox
  for (const x of issues) if (!x.bot) attention.push({ id: `bots-${x.text}`, severity: "warn", area: "bots", title: x.text, href: "/admin/bots" });

  return {
    now,
    attention,
    control,
    feeds: { rows: feedsR.v, error: feedsR.error },
    bots: {
      active: views.length,
      published: views.filter((v) => v.caps?.publish).length,
      telegram: views.filter((v) => v.caps?.telegram).length,
      switchedOn,
      error: board.scoreboard.error,
      verdicts,
    },
    weeks,
    picksByFamily,
    families,
    clvByFamily,
    clvFamilies,
    canStake: ladder.canStake,
    feedsStale: (() => {
      const u = feedsR.v.reduce<string | null>((m, x) => (x.updated_at && (!m || x.updated_at > m) ? x.updated_at : m), null);
      return u != null && now - new Date(u).getTime() > 15 * 60_000;
    })(),
    pnlByFamily,
    realBets: { rows: realRows, error: realBets.error, last30: realBets.last30 },
    moneyBlockers: ladder.layers.filter((l) => l.state === "blocked").map((l) => BLOCKER_WORDS[l.key] ?? l.title),
    jobs: { failed: jobsR.v.filter((j) => j.status === "failed").length, total: jobsR.v.length, error: jobsR.error },
    botNames: views.map((v) => ({ name: v.name, label: v.displayName })),
  };
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
}
