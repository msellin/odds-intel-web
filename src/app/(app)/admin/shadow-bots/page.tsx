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

const STAKE = 10;
const MIN_SETTLED_FOR_DECISION = 50;
const MIN_DAYS_FOR_DECISION = 14;

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
  // Active bots first
  {
    name: "bot_no_pin_home_v1",
    title: "1X2 home · matches without Pinnacle",
    subtitle: "1X2 home · edge ≥ 8%",
    backtestN: 39,
    backtestRoi: 32.7,
  },
  {
    name: "bot_sweep_1x2_home_v1",
    title: "Home wins · tier 2-3",
    subtitle: "1X2 home · edge ≥ 10%",
    backtestN: 501,
    backtestRoi: 9.3,
  },
  {
    name: "bot_sweep_1x2_draw_v1",
    title: "Draws · tier 2-3",
    subtitle: "1X2 draw · edge ≥ 5%",
    backtestN: 714,
    backtestRoi: 7.3,
  },
  {
    name: "bot_sweep_btts_yes_v1",
    title: "Both teams to score · tier 2-3",
    subtitle: "BTTS yes · edge ≥ 5%",
    backtestN: 318,
    backtestRoi: 5.4,
  },
  {
    name: "bot_sweep_ou25_v1",
    title: "OU 2.5 · line-shopping vs Pinnacle",
    subtitle: "OU 2.5 · edge ≥ 8% · no model dep",
    backtestN: 1846,
    backtestRoi: 11.0,
  },
  {
    name: "bot_sweep_ou35_v1",
    title: "OU 3.5 · line-shopping vs Pinnacle",
    subtitle: "OU 3.5 · edge ≥ 8% · no model dep",
    backtestN: 1740,
    backtestRoi: 7.4,
  },
  {
    name: "bot_pin_1x2_home_v1",
    title: "1X2 home · tier 1-2 line-shopping",
    subtitle: "1X2 home · edge ≥ 12% · tiers 1-2",
    backtestN: 1345,
    backtestRoi: 13.3,
  },
  {
    name: "bot_pin_1x2_draw_tier4_v1",
    title: "1X2 draws · tier 4 line-shopping",
    subtitle: "1X2 draw · edge ≥ 5% · tier 4 only",
    backtestN: 349,
    backtestRoi: 12.4,
  },
  // Retired bots — historical data only, kept for reference
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
  bot_id: string;
  match_id: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  result: string | null;
  pick_time: string;
  clv: number | null;
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
    status = { kind: "collecting", msg: bottleneck };
  } else if (roi >= 3) {
    status = { kind: "promote", roi };
  } else if (roi <= -8) {
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
    .select("bot_id, match_id, market, selection, odds_at_pick, result, pick_time, clv")
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
        .limit(500)  // fetch more to survive dedup + still show ~200 unique
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
  const upcoming = Array.from(upcomingDedupMap.values()).sort((a, b) => {
    const da = a.matches?.date ?? "";
    const db = b.matches?.date ?? "";
    return da.localeCompare(db);
  });
  const botNameById = new Map(bots.map((b) => [b.id, b.name]));
  // BOT_EDGE_THRESHOLDS mirrors the map on the per-bot detail page.
  const BOT_EDGE_THRESHOLDS: Record<string, number> = {
    bot_no_pin_home_v1: 0.08,
    bot_sweep_1x2_home_v1: 0.10,
    bot_sweep_1x2_draw_v1: 0.05,
    bot_sweep_btts_yes_v1: 0.05,
    bot_sweep_ou25_v1: 0.08,
    bot_sweep_ou35_v1: 0.08,
    bot_pin_1x2_home_v1: 0.12,
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header — small, admin-tool weight, one-line meta */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-100">Shadow bots</h1>
        <p className="mt-1 text-xs text-neutral-500">
          {activeSummaries.length} active · {nRetired} retired · {totalsAll.total.toLocaleString()} picks · {totalsAll.settled.toLocaleString()} settled · promote/retire at {MIN_SETTLED_FOR_DECISION} settled &amp; {MIN_DAYS_FOR_DECISION} days
        </p>
      </header>

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
            emphasize
          />
          <PortfolioCard
            label="Including retired"
            sub={`${summaries.length} bots total`}
            roi={allROI}
            won={totalsAll.won}
            lost={allLost}
            pnl={totalsAll.pnl}
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
            <div className="hidden border-b border-white/[0.04] px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[85px_minmax(0,1fr)_40px_115px_90px_55px_50px_70px_75px]">
              <div>Kickoff</div>
              <div>Match</div>
              <div className="text-center">Tier</div>
              <div>Bot</div>
              <div>Pick</div>
              <div className="text-right">Odds</div>
              <div className="text-right">Prob</div>
              <div>Book</div>
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
                return (
                  <li
                    key={u.id}
                    className={`px-4 py-2 text-sm sm:grid sm:grid-cols-[85px_minmax(0,1fr)_40px_115px_90px_55px_50px_70px_75px] sm:items-center sm:gap-3 ${
                      i > 0 ? "border-t border-white/[0.04]" : ""
                    }`}
                  >
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
                    <div className="text-sm text-emerald-300">
                      {formatPickLabel(u.market, u.selection)}
                    </div>
                    <div className="text-right font-mono text-sm tabular-nums text-neutral-100">
                      {u.odds_at_pick != null ? Number(u.odds_at_pick).toFixed(2) : "—"}
                    </div>
                    <div className="text-right font-mono text-xs tabular-nums text-neutral-400">
                      {modelProb != null ? `${(modelProb * 100).toFixed(0)}%` : "—"}
                    </div>
                    <div className="text-xs text-neutral-300 truncate">
                      {u.recommended_bookmaker ?? "—"}
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
  emphasize,
}: {
  label: string;
  sub: string;
  roi: number;
  won: number;
  lost: number;
  pnl: number;
  emphasize: boolean;
}) {
  const roiTone =
    roi >= 3 ? "text-emerald-400" : roi <= -8 ? "text-rose-400" : "text-neutral-100";
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
        <div
          className={`font-mono ${
            emphasize ? "text-2xl" : "text-lg"
          } font-semibold tabular-nums ${roiTone}`}
        >
          {roi >= 0 ? "+" : ""}
          {roi.toFixed(1)}%
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
          {s.avgClvPct != null && s.clvCount > 0 && (
            <span
              title={`Avg CLV across ${s.clvCount} settled pick${s.clvCount === 1 ? "" : "s"}. Positive means the market moved TOWARD our price after we recorded it — evidence the odds were reachable and the edge was real.`}
            >
              clv{" "}
              <span
                className={`tabular-nums font-medium ${
                  s.avgClvPct >= 3
                    ? "text-emerald-400/80"
                    : s.avgClvPct <= -3
                    ? "text-rose-400/80"
                    : "text-neutral-400"
                }`}
              >
                {s.avgClvPct >= 0 ? "+" : ""}
                {s.avgClvPct.toFixed(1)}%
              </span>
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
