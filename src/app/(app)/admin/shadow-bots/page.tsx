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
const SHADOW_BOTS: Array<{ name: string; title: string; subtitle: string }> = [
  {
    name: "bot_no_pin_shadow_v1",
    title: "Matches without Pinnacle",
    subtitle: "1X2 · edge ≥ 8%",
  },
  {
    name: "bot_sweep_1x2_home_v1",
    title: "Home wins · tier 2-3",
    subtitle: "1X2 home · edge ≥ 10%",
  },
  {
    name: "bot_sweep_1x2_draw_v1",
    title: "Draws · tier 2-3",
    subtitle: "1X2 draw · edge ≥ 5%",
  },
  {
    name: "bot_sweep_btts_yes_v1",
    title: "Both teams to score · tier 2-3",
    subtitle: "BTTS yes · edge ≥ 5%",
  },
  {
    name: "bot_sweep_ou25_v1",
    title: "OU 2.5 · line-shopping vs Pinnacle",
    subtitle: "OU 2.5 · edge ≥ 8% · no model dep",
  },
  {
    name: "bot_sweep_ou35_v1",
    title: "OU 3.5 · line-shopping vs Pinnacle",
    subtitle: "OU 3.5 · edge ≥ 8% · no model dep",
  },
  {
    name: "bot_pin_1x2_home_v1",
    title: "1X2 home · tier 1-2 line-shopping",
    subtitle: "1X2 home · edge ≥ 12% · tiers 1-2",
  },
  {
    name: "bot_pin_1x2_draw_tier4_v1",
    title: "1X2 draws · tier 4 line-shopping",
    subtitle: "1X2 draw · edge ≥ 5% · tier 4 only",
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
}
interface Summary {
  name: string;
  title: string;
  subtitle: string;
  maturity: string | null;
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
    .select("id, name, maturity_label")
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

  const totals = summaries.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      settled: acc.settled + s.settled,
      won: acc.won + s.won,
      pnl: acc.pnl + s.pnl,
      stake: acc.stake + s.stake,
    }),
    { total: 0, settled: 0, won: 0, pnl: 0, stake: 0 }
  );
  const anySettled = totals.settled > 0;
  const portfolioROI = totals.stake > 0 ? (totals.pnl / totals.stake) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header — small, admin-tool weight, one-line meta */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-100">Shadow bots</h1>
        <p className="mt-1 text-xs text-neutral-500">
          {summaries.length} bots · {totals.total.toLocaleString()} picks · {totals.settled.toLocaleString()} settled · promote/retire at {MIN_SETTLED_FOR_DECISION} settled &amp; {MIN_DAYS_FOR_DECISION} days
        </p>
      </header>

      {/* Portfolio metric — only render when we have signal */}
      {anySettled ? (
        <section className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-neutral-500">Portfolio ROI</span>
              <span
                className={`ml-3 font-mono text-2xl font-semibold tabular-nums ${
                  portfolioROI >= 3
                    ? "text-emerald-400"
                    : portfolioROI <= -8
                    ? "text-rose-400"
                    : "text-neutral-100"
                }`}
              >
                {portfolioROI >= 0 ? "+" : ""}
                {portfolioROI.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-neutral-500">
              <span className="text-emerald-400">{totals.won} won</span>
              {" · "}
              <span className="text-rose-400">{totals.settled - totals.won} lost</span>
              {" · "}
              <span className="tabular-nums text-neutral-300">€{totals.pnl.toFixed(0)}</span> P&amp;L
            </div>
          </div>
        </section>
      ) : null}

      {/* 2×2 grid of bot cards */}
      <section className="grid gap-3 md:grid-cols-2">
        {summaries.map((s) => (
          <BotCard key={s.name} s={s} />
        ))}
      </section>

      <p className="mt-10 text-xs text-neutral-500">
        <Link href="/admin/ops" className="underline underline-offset-4 hover:text-neutral-300">
          ← Back to ops
        </Link>
      </p>
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

  return (
    <Link
      href={`/admin/shadow-bots/${s.name}`}
      className="group flex flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      {/* Header row: title + primary metric */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-neutral-100">{s.title}</h3>
            <StatusPill status={s.status} />
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
