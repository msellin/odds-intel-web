/**
 * /admin/shadow-bots — summary dashboard for all shadow-only bots.
 *
 * Eight experimental bots writing to shadow_bets (never simulated_bets):
 *   • bot_no_pin_shadow_v1        (2026-08-18)  — matches without Pinnacle
 *   • bot_sweep_1x2_home_v1       (2026-08-19)  — sweep-derived, 1X2 home tier 2-3
 *   • bot_sweep_1x2_draw_v1       (2026-08-19)  — sweep-derived, 1X2 draw tier 2-3
 *   • bot_sweep_btts_yes_v1       (2026-08-19)  — sweep-derived, BTTS yes tier 2-3
 *   • bot_sweep_ou25_v1           (2026-08-21)  — Pinnacle-vs-soft OU 2.5 line-shop
 *   • bot_sweep_ou35_v1           (2026-08-21)  — Pinnacle-vs-soft OU 3.5 line-shop
 *   • bot_pin_1x2_home_v1         (2026-08-21)  — 1X2 home line-shop, tier 1-2
 *   • bot_pin_1x2_draw_tier4_v1   (2026-08-21)  — 1X2 draw line-shop, tier 4 only
 *
 * Promotion decision requires BOTH:
 *   • n_settled ≥ MIN_SETTLED_FOR_DECISION (50) — statistical power
 *   • observation_days ≥ MIN_DAYS_FOR_DECISION (14) — two weekend cycles
 * so a high-volume bot that hits 50 in one day doesn't get an early call.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { PickBetMark } from "@/components/pick-bet-mark";
import { fetchUserPickMarkStates } from "@/lib/upcoming-picks";

const STAKE = 10;

// SHADOW-PROMOTION-GATE-2026-08-26.
//
// The old gate was `settled >= 50 && observationDays >= 14`, then promote at
// ROI >= 3% / retire at ROI <= -8%. Monte-Carlo over the empirical odds
// distribution these bots actually bet at (mean odds 3.01, n=659 real picks,
// scripts/promotion_gate_simulation.py, 20k trials per cell) showed that gate
// is close to uninformative:
//
//     true edge   promote   retire
//        -10%      24.6%     55.6%
//          0%      42.8%     35.9%     <- a break-even bot promotes 43% of the time
//         +5%      52.8%     26.7%     <- a genuinely good bot is retired 27% of the time
//
// Raising n does not fix it, because the failure is the *threshold*, not the
// sample size: at n=2000 a break-even bot still promotes 17% of the time, since
// "ROI >= 3%" is cleared whenever noise happens to land above 3%.
//
// A t-statistic gate does fix it. Requiring mean/SE >= 1.65 holds the false
// promote rate at ~4% at every n — that is what a one-sided 5% test means —
// and the power to detect a real +5% edge then grows with n as it should
// (7.9% at n=100, 18.4% at n=500, 28.3% at n=1000).
//
// The honest consequence: promotion becomes rare and slow. That is the correct
// answer, not a problem to tune away. No active bot currently has |t| > 0.7.
const MIN_SETTLED_FOR_DECISION = 200;
const MIN_DAYS_FOR_DECISION = 14;
const PROMOTE_T = 1.65;
const RETIRE_T = -1.65;

// Compact per-bot config: DB name → human title + one-line strategy summary.
// backtestN + backtestRoi = historical simulation over 2026-05-04 → today at
// each bot's exact config. Shown next to live shadow performance so operator
// can spot signal drift.
const SHADOW_BOTS: Array<{
  name: string;
  title: string;
  subtitle: string;
  backtestN: number;
  backtestRoi: number;
}> = [
  // PER-BOT-SWEEP-2026-08-24: backtestN/backtestRoi replaced. The previous
  // values came from an ad-hoc simulation whose script was never committed
  // (migrations 274/275) and could not be reproduced. These are from
  // scripts/per_bot_backtest_sweep.py — a point-in-time replay priced at
  // kickoff-3h with no look-ahead, 2026-05-01 → 08-21, at each bot's
  // as-deployed config. They are lower and less flattering, but real.
  //
  // Caveat worth remembering when reading them: that same sweep showed
  // selecting configs on backtest ROI is ANTI-predictive (-9.2% out of
  // sample). Treat these as context, not as a target.

  // Active bots first
  {
    name: "bot_pin_1x2_home_v1",
    title: "1X2 home · tier 1-2 line-shopping",
    subtitle: "1X2 home · de-vigged edge ≥ 3% · tiers 1-2",
    backtestN: 692,
    backtestRoi: 7.3,
  },
  {
    name: "bot_sweep_1x2_home_v1",
    title: "Home wins · tier 2-3",
    subtitle: "1X2 home · model edge ≥ 10%",
    backtestN: 411,
    backtestRoi: 2.1,
  },
  {
    name: "bot_sweep_ou25_v1",
    title: "OU 2.5 · line-shopping vs Pinnacle",
    subtitle: "OU 2.5 · de-vigged edge ≥ 3% · tiers 1-2 · one side only",
    backtestN: 1005,
    backtestRoi: 1.7,
  },
  {
    name: "bot_sweep_1x2_draw_v1",
    title: "Draws · tier 2-3",
    subtitle: "1X2 draw · model edge ≥ 5% · watch: recent window weak",
    backtestN: 614,
    backtestRoi: 1.1,
  },
  {
    name: "bot_sweep_ou35_v1",
    title: "OU 3.5 · line-shopping vs Pinnacle",
    subtitle: "OU 3.5 · de-vigged edge ≥ 3% · tiers 1-2 · one side only",
    backtestN: 992,
    backtestRoi: -0.2,
  },
  {
    name: "bot_sweep_btts_yes_v1",
    title: "Both teams to score · tier 2-3",
    subtitle: "BTTS yes · model edge ≥ 5%",
    backtestN: 240,
    backtestRoi: -1.7,
  },

  // Retired bots — historical data only, kept for reference
  {
    name: "bot_pin_1x2_draw_tier4_v1",
    title: "1X2 draws · tier 4 line-shopping (retired 2026-08-24)",
    subtitle: "Retired: 5% gate sat below the 12.2% tier-4 overround — 85% of picks were negative-EV",
    backtestN: 339,
    backtestRoi: 7.8,
  },
  {
    name: "bot_no_pin_home_v1",
    title: "1X2 home · no Pinnacle (retired 2026-08-24)",
    subtitle: "Retired: negative at every edge threshold tested; model 17.3pp overconfident",
    backtestN: 187,
    backtestRoi: -6.2,
  },
  {
    name: "bot_no_pin_shadow_v1",
    title: "1X2 · matches without Pinnacle (retired 2026-08-21)",
    subtitle: "1X2 any selection · edge ≥ 8%",
    backtestN: 121,
    backtestRoi: -4.3,
  },
  // bot_acca_leg_shadow removed from index 2026-08-22 — never had a
  // detail-page ALLOWED entry (was a historical audit of "would acca
  // legs work as singles?" conducted before this page existed). Its
  // 532 shadow_bets rows stay in the DB for reference but don't
  // deserve UI real estate — the audit concluded -9.2% ROI, killed.
];

interface ShadowBet {
  id: string;
  bot_id: string;
  match_id: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  result: string | null;
  pick_time: string;
  clv: number | null;
  clv_pinnacle: number | null;
}
interface BotRow {
  id: string;
  name: string;
  maturity_label: string | null;
  retired_at: string | null;
}
interface Summary {
  name: string;
  title: string;
  subtitle: string;
  maturity: string | null;
  retiredAt: string | null;
  backtestN: number;
  backtestRoi: number;
  total: number;
  pending: number;
  won: number;
  lost: number;
  void: number;
  settled: number;
  pnl: number;
  stake: number;
  roi: number;
  hitRate: number;
  avgClvPct: number | null;
  clvCount: number;
  avgPinClvPct: number | null;
  pinClvCount: number;
  tStat: number | null;
  observationDays: number;
  status: BotStatus;
}

type BotStatus =
  | { kind: "waiting" } // 0 picks
  | { kind: "collecting"; msg: string } // <50 settled OR <14 days
  | { kind: "promote"; roi: number }
  | { kind: "retire"; roi: number }
  | { kind: "watching"; roi: number };

function summarise(cfg: (typeof SHADOW_BOTS)[number], bot: BotRow, bets: ShadowBet[]): Summary {
  const mine = bets.filter((b) => b.bot_id === bot.id);
  const won = mine.filter((b) => b.result === "won").length;
  const lost = mine.filter((b) => b.result === "lost").length;
  const voided = mine.filter((b) => b.result === "void").length;
  const pending = mine.filter((b) => !b.result || b.result === "pending").length;
  const settled = won + lost;
  const stake = settled * STAKE;
  const pnl =
    mine
      .filter((b) => b.result === "won")
      .reduce((s, b) => s + (Number(b.odds_at_pick ?? 0) - 1) * STAKE, 0) - lost * STAKE;
  const roi = stake > 0 ? (pnl / stake) * 100 : 0;
  const hitRate = settled > 0 ? (won / settled) * 100 : 0;
  // CLV populated at settlement (settled shadow bets only). Skip rows
  // where clv is null (still pending or capture failed).
  const clvVals = mine
    .map((b) => (b.clv != null ? Number(b.clv) : null))
    .filter((v): v is number => v != null);
  const avgClvPct = clvVals.length > 0
    ? (clvVals.reduce((s, v) => s + v, 0) / clvVals.length) * 100
    : null;

  // SHADOW-CLV-BOOKMAKER-FIX-2026-08-26: the validator to actually read.
  // `clv` above compares odds_at_pick against whichever bookmaker happened to
  // sort last in the closing snapshot; since odds_at_pick is the MAX across
  // accessible books, that comparison reads positive whether or not the bet had
  // edge. clv_pinnacle is anchored to the de-vigged Pinnacle close, so 0 means
  // Pinnacle-fair. Backfilling it flipped the sign for every bot that was
  // retired on mechanism grounds — the old column had all nine bots positive.
  // Null for BTTS: API-Football's Pinnacle feed carries only 8 bet types and
  // Both Teams Score is not one of them, so that bot has no sharp anchor at all.
  const pinClvVals = mine
    .map((b) => (b.clv_pinnacle != null ? Number(b.clv_pinnacle) : null))
    .filter((v): v is number => v != null);
  const avgPinClvPct = pinClvVals.length > 0
    ? (pinClvVals.reduce((s, v) => s + v, 0) / pinClvVals.length) * 100
    : null;

  // Per-bet returns, for the t-statistic the promotion gate now uses. A bet
  // returns (odds - 1) when it wins and -1 when it loses; ROI is the mean of
  // that and the t-stat is mean / standard error.
  const rets = mine
    .filter((b) => b.result === "won" || b.result === "lost")
    .map((b) => (b.result === "won" ? Number(b.odds_at_pick ?? 0) - 1 : -1));
  let tStat: number | null = null;
  if (rets.length > 1) {
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance =
      rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    const se = Math.sqrt(variance / rets.length);
    tStat = se > 0 ? mean / se : null;
  }

  const first = mine.reduce<string | null>(
    (acc, b) => (!acc || b.pick_time < acc ? b.pick_time : acc),
    null
  );
  const observationDays = first
    ? Math.max(1, Math.floor((Date.now() - new Date(first).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const enoughN = settled >= MIN_SETTLED_FOR_DECISION;
  const enoughDays = observationDays >= MIN_DAYS_FOR_DECISION;
  const readyForDecision = enoughN && enoughDays;

  let status: BotStatus;
  if (mine.length === 0) {
    status = { kind: "waiting" };
  } else if (!readyForDecision) {
    const bottleneck = !enoughN
      ? `${settled}/${MIN_SETTLED_FOR_DECISION} settled`
      : `${observationDays}/${MIN_DAYS_FOR_DECISION} days observed`;
    // t is shown alongside so it is obvious how far off significance a bot is,
    // rather than only how far off the sample-size threshold.
    status = { kind: "collecting", msg: bottleneck };
  } else if (tStat != null && tStat >= PROMOTE_T && roi > 0) {
    status = { kind: "promote", roi };
  } else if (tStat != null && tStat <= RETIRE_T) {
    status = { kind: "retire", roi };
  } else {
    status = { kind: "watching", roi };
  }

  return {
    name: bot.name,
    title: cfg.title,
    subtitle: cfg.subtitle,
    maturity: bot.maturity_label,
    retiredAt: bot.retired_at,
    backtestN: cfg.backtestN,
    backtestRoi: cfg.backtestRoi,
    total: mine.length,
    pending,
    won,
    lost,
    void: voided,
    settled,
    pnl,
    stake,
    roi,
    hitRate,
    avgClvPct,
    clvCount: clvVals.length,
    avgPinClvPct,
    pinClvCount: pinClvVals.length,
    tStat,
    observationDays,
    status,
  };
}

export default async function ShadowBotsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Denied />;
  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) return <Denied text="Superadmin only." />;

  // Per-user "I placed this bet" state — powers the checkbox in the
  // Upcoming picks table. Read once here so every row renders with the
  // correct initial state (no flash of unticked → ticked).
  let pickMarkStates = new Map<string, 1 | 2>();
  try {
    pickMarkStates = await fetchUserPickMarkStates(user.id);
  } catch {
    pickMarkStates = new Map();
  }

  const names = SHADOW_BOTS.map((b) => b.name);
  const { data: botsRaw } = await db
    .from("bots")
    .select("id, name, maturity_label, retired_at")
    .in("name", names);
  const bots = (botsRaw ?? []) as BotRow[];

  if (bots.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-xl font-semibold">Shadow bots</h1>
        <p className="mt-4 text-sm text-amber-400">
          No shadow bots registered yet — migrations 271 &amp; 272 haven&apos;t been applied.
        </p>
      </div>
    );
  }

  const { data: betsRaw } = await db
    .from("shadow_bets")
    .select(
      "id, bot_id, match_id, market, selection, odds_at_pick, result, pick_time, clv, clv_pinnacle"
    )
    .in(
      "bot_id",
      bots.map((b) => b.id)
    );
  const rawBets = (betsRaw ?? []) as ShadowBet[];

  // SHADOW-BOTS-STATS-DEDUP-2026-08-22: multi-cohort writes duplicate rows
  // for the same (bot × match × market × selection) as they persist across
  // refresh windows. Portfolio ROI / hit rate / picks count should reflect
  // UNIQUE picks, not the underlying cohort rows. Otherwise a €10 win at
  // 2.5 that persisted for 5 cohorts counts as €50 stake with €75 pnl —
  // 150% ROI on a single bet. Dedup here so stats math is honest.
  const statsDedup = new Map<string, ShadowBet>();
  for (const r of rawBets) {
    const key = `${r.bot_id}|${r.match_id}|${r.market}|${r.selection}`;
    const existing = statsDedup.get(key);
    if (!existing || r.pick_time < existing.pick_time) {
      statsDedup.set(key, r);
    }
  }
  const bets = Array.from(statsDedup.values());

  // Upcoming picks — the "single place to look when placing real money"
  // section. All pending picks from ACTIVE bots on matches that haven't
  // kicked off yet. Sorted by kickoff ascending (soonest first).
  const activeBotIds = bots.filter((b) => !b.retired_at).map((b) => b.id);
  const { data: upcomingRaw } = activeBotIds.length > 0
    ? await db
        .from("shadow_bets")
        .select(
          `id, bot_id, match_id, market, selection, odds_at_pick, model_probability,
           edge_percent, recommended_bookmaker, pick_time, shadow_cohort,
           matches!inner (
             date,
             leagues ( name, country, tier ),
             home_team:teams!matches_home_team_id_fkey ( name ),
             away_team:teams!matches_away_team_id_fkey ( name )
           )`
        )
        .in("bot_id", activeBotIds)
        .eq("result", "pending")
        .gte("matches.date", new Date().toISOString())
        .order("matches(date)", { ascending: true })
        // SHADOW-BOTS-LIMIT-FIX-2026-08-22: bumped 500 → 5000. Multi-cohort
        // fires (:10/:40 every 30min 24h) mean each unique pick has 4-6 rows.
        // At 500 the panel was cut off around 14:00 UTC kickoff, hiding
        // evening matches (18-23 UTC). Diagnosed with 2,270 pending future
        // rows → 147 unique picks visible at 5000 (vs 56 at 500). If we ever
        // approach 5000 raw rows we'll switch to a DISTINCT ON strategy.
        .limit(5000)
    : { data: [] };
  const upcomingRawArr = (upcomingRaw ?? []) as unknown as Array<{
    id: string;
    bot_id: string;
    match_id: string;
    market: string;
    selection: string;
    odds_at_pick: number | null;
    model_probability: number | null;
    edge_percent: number | null;
    recommended_bookmaker: string | null;
    pick_time: string;
    shadow_cohort: string | null;
    matches: {
      date: string;
      leagues: { name: string | null; country: string | null; tier: number | null } | null;
      home_team: { name: string | null } | null;
      away_team: { name: string | null } | null;
    } | null;
  }>;

  // SHADOW-BOTS-UPCOMING-DEDUP-2026-08-22: multi-cohort fires (every :10/:40
  // 24/7) create one shadow_bets row per (cohort × bot × match × market ×
  // selection). Great for tracking odds drift across the day, but the
  // "Upcoming picks" list should show ONE row per pick.
  //
  // Keep the row with the EARLIEST pick_time — that's when we first spotted
  // the edge, matching what the operator saw when the alert first fired.
  // Subsequent cohorts just re-record the same pick with drifted odds.
  const upcomingDedupMap = new Map<string, typeof upcomingRawArr[number]>();
  for (const r of upcomingRawArr) {
    const key = `${r.bot_id}|${r.match_id}|${r.market}|${r.selection}`;
    const existing = upcomingDedupMap.get(key);
    if (!existing || r.pick_time < existing.pick_time) {
      upcomingDedupMap.set(key, r);
    }
  }
  // PICKS-DEDUPE-ORDER-2026-08-22: sort by (kickoff, match_id, market,
  // selection) so identical (match, market, sel) picks from different bots
  // land adjacent — makes it obvious when two bots point at the same bet
  // and prevents the operator from double-placing. Full de-duplication
  // across bots is filed as PICKS-DEDUPE-2026-08-22.
  const upcoming = Array.from(upcomingDedupMap.values()).sort((a, b) => {
    const da = a.matches?.date ?? "";
    const db = b.matches?.date ?? "";
    if (da !== db) return da.localeCompare(db);
    if (a.match_id !== b.match_id) return a.match_id.localeCompare(b.match_id);
    if (a.market !== b.market) return a.market.localeCompare(b.market);
    return a.selection.localeCompare(b.selection);
  });

  // SHADOW-BOTS-COOLBET-CURRENT-2026-08-22: fetch latest Coolbet snapshot per
  // (match, market, selection) for every upcoming pick, so the operator sees
  // the current placement price + drift vs signal price. Solves the stale-odds
  // trap (Gimnástica case: signal odds 2.75, current Coolbet 3.15 hours later).
  const uniqueMatchIds = Array.from(new Set(upcoming.map((u) => u.match_id)));
  const { data: cbSnapshots } = uniqueMatchIds.length > 0
    ? await db
        .from("odds_snapshots")
        .select("match_id, market, selection, odds, timestamp")
        .in("match_id", uniqueMatchIds)
        .eq("bookmaker", "Coolbet")
        .eq("is_live", false)
        .order("timestamp", { ascending: false })
        .limit(5000)
    : { data: [] };
  const coolbetCurrent = new Map<string, { odds: number; ts: string }>();
  for (const row of (cbSnapshots ?? []) as Array<{
    match_id: string; market: string; selection: string; odds: number | string; timestamp: string;
  }>) {
    const key = `${row.match_id}|${row.market}|${row.selection}`;
    if (!coolbetCurrent.has(key)) {
      coolbetCurrent.set(key, { odds: Number(row.odds), ts: row.timestamp });
    }
  }
  const botNameById = new Map(bots.map((b) => [b.id, b.name]));
  // BOT_EDGE_THRESHOLDS mirrors the map on the per-bot detail page.
  // PER-BOT-SWEEP-2026-08-24: the three line-shop bots moved to a DE-VIGGED
  // 3% floor (daily_pipeline_v2.py `_LINESHOP_TRUE_EDGE_MIN`). Their stored
  // edge_percent is now true post-vig edge, so it is not comparable to the
  // old vig-inclusive numbers on pre-2026-08-24 picks.
  const BOT_EDGE_THRESHOLDS: Record<string, number> = {
    bot_sweep_1x2_home_v1: 0.10,
    bot_sweep_1x2_draw_v1: 0.05,
    bot_sweep_btts_yes_v1: 0.05,
    bot_sweep_ou25_v1: 0.03,
    bot_sweep_ou35_v1: 0.03,
    bot_pin_1x2_home_v1: 0.03,
    // Retired 2026-08-24 — kept so historical rows still resolve a threshold.
    bot_no_pin_home_v1: 0.08,
    bot_pin_1x2_draw_tier4_v1: 0.05,
  };

  const summaries: Summary[] = SHADOW_BOTS.map((cfg) => {
    const bot = bots.find((b) => b.name === cfg.name);
    return bot ? summarise(cfg, bot, bets) : null;
  }).filter((s): s is Summary => s !== null);

  // Portfolio metric split active vs all — retired bots' historical losses
  // shouldn't drag the "how are current bots doing" read.
  const activeSummaries = summaries.filter((s) => !s.retiredAt);
  const _sum = (arr: Summary[]) =>
    arr.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        settled: acc.settled + s.settled,
        won: acc.won + s.won,
        pnl: acc.pnl + s.pnl,
        stake: acc.stake + s.stake,
      }),
      { total: 0, settled: 0, won: 0, pnl: 0, stake: 0 }
    );
  const totalsActive = _sum(activeSummaries);
  const totalsAll = _sum(summaries);
  const anySettled = totalsAll.settled > 0;
  const activeROI = totalsActive.stake > 0 ? (totalsActive.pnl / totalsActive.stake) * 100 : 0;
  const allROI = totalsAll.stake > 0 ? (totalsAll.pnl / totalsAll.stake) * 100 : 0;
  const activeLost = totalsActive.settled - totalsActive.won;
  const allLost = totalsAll.settled - totalsAll.won;
  const nRetired = summaries.filter((s) => s.retiredAt).length;
  // Portfolio CLV — weighted average across bots (each bot's avgClvPct
  // weighted by its clvCount). Skips bots without settled picks.
  const _clvAgg = (arr: Summary[]) => {
    let sum = 0, n = 0;
    for (const s of arr) {
      if (s.avgClvPct != null && s.clvCount > 0) {
        sum += s.avgClvPct * s.clvCount;
        n += s.clvCount;
      }
    }
    return n > 0 ? { pct: sum / n, n } : { pct: null as number | null, n: 0 };
  };
  const activeClv = _clvAgg(activeSummaries);
  const allClv = _clvAgg(summaries);

  // SHADOW-DISCRETION-BLEED-2026-08-26 — does hand-picking help or hurt?
  //
  // user_pick_marks.state 2 = "bet placed with real money". Comparing that
  // subset against the picks left untouched is the only read we have on whether
  // the discretionary layer adds value. It is shown here, at the point of
  // placing, because that is where it can change a decision.
  //
  // Framed carefully on purpose. The pooled numbers look alarming, but bets
  // placed on the same day share match outcomes and one model run, so they are
  // not independent observations; clustering by day gives t = -2.15 on df = 3
  // against a critical value of 3.18 — suggestive, NOT established. Overstating
  // it would be its own error. scripts/discretion_bleed_report.py re-runs the
  // clustered test as marking days accumulate.
  const disc = (want: number | null) => {
    const rows = bets.filter((b) => {
      if (b.result !== "won" && b.result !== "lost") return false;
      const st = pickMarkStates.get(b.id) ?? 0;
      return want == null ? st === 0 : st === want;
    });
    if (rows.length === 0) return null;
    const rets = rows.map((b) =>
      b.result === "won" ? Number(b.odds_at_pick ?? 0) - 1 : -1
    );
    const mean = rets.reduce((a, c) => a + c, 0) / rets.length;
    const days = new Set(rows.map((b) => b.pick_time.slice(0, 10))).size;
    return { n: rows.length, roi: mean * 100, days };
  };
  const discPlaced = disc(2);
  const discUntouched = disc(null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header — small, admin-tool weight, one-line meta */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-100">Shadow bots</h1>
        <p className="mt-1 text-xs text-neutral-500">
          {activeSummaries.length} active · {nRetired} retired · {totalsAll.total.toLocaleString()} picks · {totalsAll.settled.toLocaleString()} settled · promote/retire at {MIN_SETTLED_FOR_DECISION} settled &amp; {MIN_DAYS_FOR_DECISION} days
        </p>
      </header>

      {/* Discipline check — hand-picked vs left alone. Deliberately placed
          above the portfolio numbers: if the discretionary layer is costing
          money, that dominates any per-bot tuning below it. */}
      {discPlaced && discUntouched && discPlaced.n >= 20 ? (
        <section className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-xs font-medium text-amber-300/90">
              Discipline check
            </span>
            <span className="text-xs text-neutral-400">
              bet placed{" "}
              <span
                className={`tabular-nums font-medium ${
                  discPlaced.roi >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {discPlaced.roi >= 0 ? "+" : ""}
                {discPlaced.roi.toFixed(1)}%
              </span>{" "}
              <span className="text-neutral-600">({discPlaced.n})</span>
            </span>
            <span className="text-xs text-neutral-400">
              left untouched{" "}
              <span
                className={`tabular-nums font-medium ${
                  discUntouched.roi >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {discUntouched.roi >= 0 ? "+" : ""}
                {discUntouched.roi.toFixed(1)}%
              </span>{" "}
              <span className="text-neutral-600">({discUntouched.n})</span>
            </span>
            <span className="text-xs text-neutral-400">
              gap{" "}
              <span className="tabular-nums font-medium text-neutral-200">
                {discPlaced.roi - discUntouched.roi >= 0 ? "+" : ""}
                {(discPlaced.roi - discUntouched.roi).toFixed(1)}pp
              </span>
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
            Picks you marked as placed vs picks you left alone.{" "}
            <strong className="font-medium text-neutral-400">
              Only {discPlaced.days} day{discPlaced.days === 1 ? "" : "s"} of marks
            </strong>{" "}
            — bets on one day share match outcomes, so the pooled gap overstates
            its own significance. Clustered by day this is not yet statistically
            established. Watch it, don&apos;t act on it alone;{" "}
            <code className="text-neutral-500">
              scripts/discretion_bleed_report.py
            </code>{" "}
            runs the honest test.
          </p>
        </section>
      ) : null}

      {/* Portfolio ROI split — active-only is the "how are current bots
          doing" number; all is included for completeness. Retired bots'
          historical losses shouldn't drag the current read. */}
      {anySettled ? (
        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          <PortfolioCard
            label="Active bots"
            sub={`${activeSummaries.length} bot${activeSummaries.length === 1 ? "" : "s"}`}
            roi={activeROI}
            won={totalsActive.won}
            lost={activeLost}
            pnl={totalsActive.pnl}
            clvPct={activeClv.pct}
            clvN={activeClv.n}
            emphasize
          />
          <PortfolioCard
            label="Including retired"
            sub={`${summaries.length} bots total`}
            roi={allROI}
            won={totalsAll.won}
            lost={allLost}
            pnl={totalsAll.pnl}
            clvPct={allClv.pct}
            clvN={allClv.n}
            emphasize={false}
          />
        </section>
      ) : null}

      {/* Upcoming picks — pending picks from active bots, kickoff in future.
          Native <details> for zero-JS collapse. Opens by default so the
          operator sees pending picks immediately on page load. */}
      {upcoming.length > 0 && (
        <details open className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03]">
          <summary className="cursor-pointer select-none list-none px-4 py-3 hover:bg-emerald-500/[0.05]">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-emerald-300">
                  Upcoming picks
                </span>
                <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                  {upcoming.length}
                </span>
                <span className="ml-2 text-xs text-neutral-500">
                  pending · sorted by kickoff · click to collapse
                </span>
              </div>
              <span className="text-[11px] text-neutral-500">
                One-stop review for placing real money
              </span>
            </div>
          </summary>
          <div className="border-t border-emerald-500/10">
            {/* SHADOW-BOTS-COLUMNS-2026-08-22: added Gap (model vs market) and
                Now @ CB (current Coolbet price + drift) columns. Gap surfaces
                calibration issues at a glance (>20pp = red = usually a broken
                calibration on young bots, not real edge). Now @ CB shows the
                actual placement price so the operator can compare it against
                Min odds without a manual site lookup. */}
            <div className="hidden border-b border-white/[0.04] px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[28px_85px_minmax(0,1fr)_40px_115px_90px_55px_50px_60px_70px_75px_75px] sm:gap-3">
              <div className="text-center" title="Tick once you've placed this bet with a book. Persists across sessions.">Bet</div>
              <div>Kickoff</div>
              <div>Match</div>
              <div className="text-center">Tier</div>
              <div>Bot</div>
              <div>Pick</div>
              <div className="text-right">Odds</div>
              <div className="text-right">Prob</div>
              <div className="text-right" title="Model probability minus market-implied probability (from odds), in percentage points. Larger positive = bigger claimed edge. Interpret per bot — settled data shows different bots calibrate very differently, no universal good/bad threshold.">Gap</div>
              <div>Book</div>
              <div className="text-right" title="Coolbet's latest snapshot price for this exact selection. Arrow shows drift vs signal odds. — means no Coolbet coverage.">Now @ CB</div>
              <div className="text-right">Min odds</div>
            </div>
            <ul>
              {upcoming.map((u, i) => {
                const ko = u.matches?.date ? new Date(u.matches.date) : null;
                const kd = ko
                  ? ko.toLocaleString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })
                  : "—";
                const kt = ko
                  ? ko.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
                  : "";
                const tier = u.matches?.leagues?.tier ?? null;
                const tierTone =
                  tier === 1 ? "bg-emerald-500/15 text-emerald-300"
                  : tier === 2 ? "bg-sky-500/15 text-sky-300"
                  : tier === 3 ? "bg-amber-500/15 text-amber-300"
                  : tier === 4 ? "bg-fuchsia-500/15 text-fuchsia-300"
                  : "bg-neutral-500/15 text-neutral-400";
                const botName = botNameById.get(u.bot_id) ?? "?";
                const threshold = BOT_EDGE_THRESHOLDS[botName] ?? 0.08;
                const modelProb = u.model_probability != null ? Number(u.model_probability) : null;
                const minOdds = modelProb && modelProb > 0 ? (1 + threshold) / modelProb : null;

                // Gap = model_prob − market_implied_prob, in percentage points.
                // Positive = model thinks the outcome is more likely than the
                // market prices it (which is the whole point of a value bet).
                // Color coding intentionally removed 2026-08-22 after settled
                // data audit contradicted the initial thresholds — active
                // bots actually convert 20-40pp gaps at +46% ROI, while
                // 5-20pp is the bleed band. Show raw number, let operator
                // use judgment + per-bot track record.
                const signalOdds = u.odds_at_pick != null ? Number(u.odds_at_pick) : null;
                const marketImplied = signalOdds && signalOdds > 0 ? 1 / signalOdds : null;
                const gapPp = modelProb != null && marketImplied != null
                  ? (modelProb - marketImplied) * 100
                  : null;

                // Current Coolbet price + drift vs signal.
                //   ▲ = odds moved up (better price for bettor, market disagrees)
                //   ▼ = odds moved down (worse price, sharp money confirms)
                //   → = within 3% (stable)
                //   — = no Coolbet coverage
                const cbKey = `${u.match_id}|${u.market}|${u.selection}`;
                const cb = coolbetCurrent.get(cbKey);
                let cbArrow = "";
                let cbArrowTone = "text-neutral-500";
                if (cb && signalOdds && signalOdds > 0) {
                  const diffPct = (cb.odds - signalOdds) / signalOdds;
                  if (diffPct > 0.03) { cbArrow = "▲"; cbArrowTone = "text-emerald-400"; }
                  else if (diffPct < -0.03) { cbArrow = "▼"; cbArrowTone = "text-amber-400"; }
                  else { cbArrow = "→"; cbArrowTone = "text-neutral-500"; }
                }
                const cbBelowFloor = cb && minOdds != null && cb.odds < minOdds;

                // Real-money confidence flag — visual warning for patterns confirmed negative in settled data.
                // Bots keep firing to collect data; this flag is for operator's manual betting decisions.
                type CFlag = { level: "red" | "yellow"; reason: string } | null;
                // PER-BOT-SWEEP-2026-08-24 cut this from five flags to one.
                // Four of the five are now enforced in bot config instead of
                // being warned about at placement time, which is strictly
                // better — the bets are never generated at all:
                //   • draw_tier4 bot        → retired (migration 281)
                //   • tier 0 / NULL leagues → excluded at the SQL layer
                //   • sub-10% edge          → obsolete basis. It was calibrated
                //     on vig-inclusive line-shop edge; those bots now gate on
                //     DE-VIGGED edge ≥ 3%, so a 4% edge is genuinely +EV and
                //     flagging it red would flag nearly every pick.
                //   • home @ 3.5+ odds      → never supported. pin_home at 3.5+
                //     was −24.7% but sweep_home was +104% — opposite directions
                //     with error bars far wider than the effect.
                //
                // What remains is the one problem still open and unfixed:
                // SWEEP-HOME-BOTS-CALIBRATION-2026-08-22. The model-driven bots
                // produce extreme model-vs-market gaps on reserve/II teams and
                // cross-tier ties (+142% on Zvijezda 09, +134% on Sparta Praha II).
                // Every model bot measured 6–17pp overconfident, worst in the
                // 0.50–0.60 probability band (predicts 54%, actual 29%).
                const MODEL_DRIVEN = new Set([
                  "bot_sweep_1x2_home_v1",
                  "bot_sweep_1x2_draw_v1",
                  "bot_sweep_btts_yes_v1",
                ]);
                let cFlag: CFlag = null;
                if (botName && MODEL_DRIVEN.has(botName) && gapPp != null && gapPp >= 25) {
                  cFlag = {
                    level: "yellow",
                    reason: `Model is ${gapPp.toFixed(0)}pp above the market. The model-driven bots run 6–17pp overconfident and this size of gap clusters on reserve/II teams and cross-tier ties (SWEEP-HOME-BOTS-CALIBRATION, still open). Check who is actually playing before placing.`,
                  };
                }

                return (
                  <li
                    key={u.id}
                    className={`px-4 py-2 text-sm sm:grid sm:grid-cols-[28px_85px_minmax(0,1fr)_40px_115px_90px_55px_50px_60px_70px_75px_75px] sm:items-center sm:gap-3 border-l-2 ${
                      cFlag?.level === "red" ? "border-rose-500/60" :
                      cFlag?.level === "yellow" ? "border-amber-500/50" :
                      "border-transparent"
                    } ${i > 0 ? "border-t border-white/[0.04]" : ""}`}
                  >
                    <div className="flex items-center justify-center">
                      <PickBetMark
                        pickId={u.id}
                        initialState={pickMarkStates.get(u.id) ?? 0}
                      />
                    </div>
                    <div className="font-mono text-xs text-neutral-400">
                      <span className="text-neutral-200">{kd}</span>
                      <span className="ml-1 text-neutral-500">{kt}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-neutral-100">
                        {u.matches?.home_team?.name ?? "Home"}{" "}
                        <span className="text-neutral-500">vs</span>{" "}
                        {u.matches?.away_team?.name ?? "Away"}
                      </div>
                      <div className="truncate text-[11px] text-neutral-500">
                        {u.matches?.leagues?.country ? `${u.matches.leagues.country} · ` : ""}
                        {u.matches?.leagues?.name ?? ""}
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${tierTone}`}>
                        {tier ? `T${tier}` : "—"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/shadow-bots/${botName}`}
                        className="truncate font-mono text-[11px] text-emerald-400/80 hover:text-emerald-300 hover:underline"
                        title={botName}
                      >
                        {botName.replace(/^bot_/, "")}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-emerald-300">
                      {formatPickLabel(u.market, u.selection)}
                      {cFlag && (
                        <span
                          title={cFlag.reason}
                          className={`shrink-0 rounded px-1 py-px font-mono text-[10px] font-bold ${
                            cFlag.level === "red"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {cFlag.level === "red" ? "✕" : "⚠"}
                        </span>
                      )}
                    </div>
                    <div className="text-right font-mono text-sm tabular-nums text-neutral-100">
                      {u.odds_at_pick != null ? Number(u.odds_at_pick).toFixed(2) : "—"}
                    </div>
                    <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                      {modelProb != null ? `${(modelProb * 100).toFixed(0)}%` : "—"}
                    </div>
                    <div
                      className="text-right font-mono text-xs tabular-nums text-neutral-400"
                      title="Model probability minus market-implied probability (from odds), in percentage points. Larger positive = model thinks the outcome is more likely than the market prices it. Interpret alongside the bot's own track record + CLV — no universal 'good/bad' threshold, calibration varies by bot."
                    >
                      {gapPp != null ? `${gapPp >= 0 ? "+" : ""}${gapPp.toFixed(0)}pp` : "—"}
                    </div>
                    <div className="text-xs text-neutral-300 truncate">
                      {u.recommended_bookmaker ?? "—"}
                    </div>
                    <div
                      className="text-right font-mono text-sm tabular-nums"
                      title={
                        cb == null
                          ? "Coolbet doesn't cover this match/market — verify at another book or skip."
                          : cbBelowFloor
                            ? `Coolbet ${cb.odds.toFixed(2)} is BELOW min-odds floor ${minOdds?.toFixed(2)} — do NOT place. Signal fired at ${signalOdds?.toFixed(2)}, market has moved.`
                            : `Coolbet current ${cb.odds.toFixed(2)} · signal was ${signalOdds?.toFixed(2)} · snapshot ${new Date(cb.ts).toUTCString()}`
                      }
                    >
                      {cb == null
                        ? <span className="text-neutral-600">—</span>
                        : <>
                            <span className={cbBelowFloor ? "text-rose-400" : "text-sky-300"}>
                              {cb.odds.toFixed(2)}
                            </span>
                            {cbArrow && <span className={`ml-1 ${cbArrowTone}`}>{cbArrow}</span>}
                          </>
                      }
                    </div>
                    <div className="text-right font-mono text-sm tabular-nums" title="Check manually at your book — bet only if it meets or beats this price.">
                      {minOdds != null
                        ? <span className="text-amber-300">≥{minOdds.toFixed(2)}</span>
                        : <span className="text-neutral-600">—</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
      )}

      {/* Active bots first, retired bots in a separate muted section */}
      {(() => {
        const active = summaries.filter((s) => !s.retiredAt);
        const retired = summaries.filter((s) => s.retiredAt);
        return (
          <>
            <section className="grid gap-3 md:grid-cols-2">
              {active.map((s) => (
                <BotCard key={s.name} s={s} />
              ))}
            </section>
            {retired.length > 0 && (
              <>
                <h2 className="mt-8 mb-3 text-xs font-mono uppercase tracking-widest text-neutral-500">
                  Retired · historical data only
                </h2>
                <section className="grid gap-3 md:grid-cols-2 opacity-60">
                  {retired.map((s) => (
                    <BotCard key={s.name} s={s} />
                  ))}
                </section>
              </>
            )}
          </>
        );
      })()}

      <p className="mt-10 text-xs text-neutral-500">
        <Link href="/admin/ops" className="underline underline-offset-4 hover:text-neutral-300">
          ← Back to ops
        </Link>
      </p>
    </div>
  );
}

function PortfolioCard({
  label,
  sub,
  roi,
  won,
  lost,
  pnl,
  clvPct,
  clvN,
  emphasize,
}: {
  label: string;
  sub: string;
  roi: number;
  won: number;
  lost: number;
  pnl: number;
  clvPct: number | null;
  clvN: number;
  emphasize: boolean;
}) {
  const roiTone =
    roi >= 3 ? "text-emerald-400" : roi <= -8 ? "text-rose-400" : "text-neutral-100";
  const clvTone =
    clvPct == null ? "text-neutral-500"
    : clvPct >= 3 ? "text-emerald-400"
    : clvPct <= -3 ? "text-rose-400"
    : "text-neutral-300";
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        emphasize
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/[0.04] bg-white/[0.01] opacity-80"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
          <div className="mt-0.5 text-[10px] text-neutral-600">{sub}</div>
        </div>
        <div className="text-right">
          <div
            className={`font-mono ${
              emphasize ? "text-2xl" : "text-lg"
            } font-semibold tabular-nums ${roiTone}`}
            title="Portfolio flat-stake ROI across settled picks"
          >
            {roi >= 0 ? "+" : ""}
            {roi.toFixed(1)}%
          </div>
          <div
            className={`mt-0.5 font-mono text-[10px] tabular-nums ${clvTone}`}
            title={clvPct != null
              ? `Weighted CLV across ${clvN} settled picks. Positive = market moved toward our price after we recorded it — evidence the odds were real signal.`
              : "No settled picks with CLV yet"}
          >
            clv {clvPct != null ? `${clvPct >= 0 ? "+" : ""}${clvPct.toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-neutral-500">
        <span className="text-emerald-400">{won} won</span>
        {" · "}
        <span className="text-rose-400">{lost} lost</span>
        {" · "}
        <span className="tabular-nums text-neutral-300">€{pnl.toFixed(0)}</span> P&amp;L
      </div>
    </div>
  );
}


function BotCard({ s }: { s: Summary }) {
  // Progress bar keys off SETTLED, not total. High-volume bots that pile
  // pending picks fast can no longer look "ready" until settlement lands.
  const progressPct = Math.min(100, (s.settled / MIN_SETTLED_FOR_DECISION) * 100);

  // Show ROI only when we have real data
  const hasROI = s.settled > 0;
  const roiTone =
    s.status.kind === "promote" ? "good" : s.status.kind === "retire" ? "bad" : "neutral";

  const isRetired = !!s.retiredAt;
  return (
    <Link
      href={`/admin/shadow-bots/${s.name}`}
      className={`group flex flex-col justify-between rounded-xl border p-4 transition ${
        isRetired
          ? "border-rose-500/20 bg-rose-500/[0.03] hover:bg-rose-500/[0.06]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      {/* Header row: title + primary metric */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-neutral-100">{s.title}</h3>
            {isRetired ? (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-rose-300">
                Retired
              </span>
            ) : (
              <StatusPill status={s.status} />
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">{s.subtitle}</p>
        </div>
        {hasROI ? (
          <div className="text-right">
            <div
              className={`font-mono text-xl font-semibold tabular-nums leading-none ${
                roiTone === "good"
                  ? "text-emerald-400"
                  : roiTone === "bad"
                  ? "text-rose-400"
                  : "text-neutral-100"
              }`}
            >
              {s.roi >= 0 ? "+" : ""}
              {s.roi.toFixed(1)}%
            </div>
            <div className="mt-1 text-[10px] text-neutral-500">{s.hitRate.toFixed(0)}% hit</div>
          </div>
        ) : null}
      </div>

      {/* Progress bar (counts SETTLED, not total) */}
      <div className="mt-4">
        <div className="mb-1 flex items-baseline justify-between text-[11px]">
          <span className="text-neutral-500">
            <span className="tabular-nums text-neutral-300">{s.settled}</span>/{MIN_SETTLED_FOR_DECISION} settled
            <span className="mx-1.5 text-neutral-700">·</span>
            <span className="tabular-nums text-neutral-300">{s.observationDays}</span>/
            {MIN_DAYS_FOR_DECISION} days
          </span>
          <span className="text-neutral-500">
            {s.status.kind === "waiting"
              ? "no picks yet"
              : s.status.kind === "collecting"
              ? "collecting"
              : s.status.kind === "promote"
              ? "ready · promote"
              : s.status.kind === "retire"
              ? "ready · retire"
              : "ready · watch"}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${
              s.status.kind === "promote"
                ? "bg-emerald-400"
                : s.status.kind === "retire"
                ? "bg-rose-400"
                : "bg-neutral-400"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Outcome row */}
      <div className="mt-3 flex items-center gap-3 text-[11px] tabular-nums">
        <span className="text-neutral-500">
          <span className="text-neutral-200">{s.total}</span> picks
        </span>
        <Dot className="bg-emerald-400" />
        <span className="text-neutral-400">
          <span className="text-neutral-200">{s.won}</span>W
        </span>
        <Dot className="bg-rose-400" />
        <span className="text-neutral-400">
          <span className="text-neutral-200">{s.lost}</span>L
        </span>
        <Dot className="bg-neutral-500" />
        <span className="text-neutral-400">
          <span className="text-neutral-200">{s.void}</span>V
        </span>
        <Dot className="bg-sky-400" />
        <span className="text-neutral-400">
          <span className="text-neutral-200">{s.pending}</span>P
        </span>
        <span className="ml-auto flex items-center gap-2 text-[10px] text-neutral-500">
          {s.tStat != null && (
            <span
              title={`t = ${s.tStat.toFixed(2)} on ${s.settled} settled picks. This is the promotion gate: |t| >= 1.65 is a one-sided 5% test. Raw ROI is not used because at these odds a break-even bot clears "ROI >= 3%" 43% of the time.`}
            >
              t{" "}
              <span
                className={`tabular-nums font-medium ${
                  s.tStat >= PROMOTE_T
                    ? "text-emerald-400/80"
                    : s.tStat <= RETIRE_T
                    ? "text-rose-400/80"
                    : "text-neutral-400"
                }`}
              >
                {s.tStat >= 0 ? "+" : ""}
                {s.tStat.toFixed(2)}
              </span>
            </span>
          )}
          {s.pinClvCount > 0 && s.avgPinClvPct != null ? (
            <span
              title={`Pinnacle CLV across ${s.pinClvCount} settled pick${s.pinClvCount === 1 ? "" : "s"} — odds_at_pick vs the DE-VIGGED Pinnacle close, so 0 means exactly Pinnacle-fair. This is the validator to trust; it needs far fewer picks than ROI to say something. The old any-book "clv" showed all nine bots positive, including the two retired for being negative-EV by construction.`}
            >
              pin clv{" "}
              <span
                className={`tabular-nums font-medium ${
                  s.avgPinClvPct >= 2
                    ? "text-emerald-400/80"
                    : s.avgPinClvPct <= -2
                    ? "text-rose-400/80"
                    : "text-neutral-400"
                }`}
              >
                {s.avgPinClvPct >= 0 ? "+" : ""}
                {s.avgPinClvPct.toFixed(1)}%
              </span>
            </span>
          ) : (
            <span
              title="No Pinnacle anchor available. API-Football's Pinnacle feed carries only 8 bet types (Match Winner, Asian Handicap, Goals O/U, team totals) and Both Teams Score is not among them — so this bot cannot be validated against a sharp line at all."
              className="text-amber-500/70"
            >
              pin clv n/a
            </span>
          )}
          <span
            title="Historical backtest — bot's config applied to matches from 2026-05-04 → today (same window as landing/performance). Reference for what to expect once live data accumulates."
          >
            past{" "}
            <span
              className={`tabular-nums font-medium ${
                s.backtestRoi >= 3
                  ? "text-emerald-400/80"
                  : s.backtestRoi <= -3
                  ? "text-rose-400/80"
                  : "text-neutral-400"
              }`}
            >
              {s.backtestRoi >= 0 ? "+" : ""}
              {s.backtestRoi.toFixed(1)}%
            </span>
            <span className="text-neutral-600"> n={s.backtestN}</span>
          </span>
        </span>
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: BotStatus }) {
  if (status.kind === "waiting") {
    return (
      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-400">
        Waiting
      </span>
    );
  }
  if (status.kind === "collecting") {
    return (
      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-300">
        Collecting
      </span>
    );
  }
  if (status.kind === "promote") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
        Promote
      </span>
    );
  }
  if (status.kind === "retire") {
    return (
      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-rose-400">
        Retire
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-400">
      Watch
    </span>
  );
}

function formatPickLabel(market: string, selection: string): string {
  const sel = (selection ?? "").toLowerCase();
  if (market === "1x2") {
    if (sel === "home") return "Home";
    if (sel === "draw") return "Draw";
    if (sel === "away") return "Away";
  }
  if (market === "btts") return sel === "yes" ? "BTTS yes" : "BTTS no";
  if (market.startsWith("over_under_")) {
    const line = market.replace("over_under_", "").replace(/^(\d)(\d)$/, "$1.$2");
    return sel === "over" ? `Over ${line}` : `Under ${line}`;
  }
  return `${market} ${sel}`;
}


function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />;
}

function Denied({ text = "Access denied." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">{text}</div>
  );
}
