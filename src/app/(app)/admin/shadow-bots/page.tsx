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
  {
    name: "bot_acca_leg_shadow",
    title: "Acca legs as singles (retired 2026-08-21)",
    subtitle: "Combo-leg audit · killed by ROI gate",
    backtestN: 532,
    backtestRoi: -9.2,
  },
];

interface ShadowBet {
  bot_id: string;
  odds_at_pick: number | null;
  result: string | null;
  pick_time: string;
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
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-xl font-semibold">Shadow bots</h1>
        <p className="mt-4 text-sm text-amber-400">
          No shadow bots registered yet — migrations 271 &amp; 272 haven&apos;t been applied.
        </p>
      </div>
    );
  }

  const { data: betsRaw } = await db
    .from("shadow_bets")
    .select("bot_id, odds_at_pick, result, pick_time")
    .in(
      "bot_id",
      bots.map((b) => b.id)
    );
  const bets = (betsRaw ?? []) as ShadowBet[];

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
    <div className="mx-auto max-w-4xl px-6 py-10">
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
        <span
          className="ml-auto text-[10px] text-neutral-500"
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

function Dot({ className }: { className: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />;
}

function Denied({ text = "Access denied." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">{text}</div>
  );
}
