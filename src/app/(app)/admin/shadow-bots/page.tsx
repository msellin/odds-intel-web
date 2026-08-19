/**
 * /admin/shadow-bots — summary dashboard for all shadow-only bots.
 *
 * Four experimental bots writing to shadow_bets (never simulated_bets):
 *   • bot_no_pin_shadow_v1        (2026-08-18)  — matches without Pinnacle
 *   • bot_sweep_1x2_home_v1       (2026-08-19)  — sweep-derived, 1X2 home tier 2-3
 *   • bot_sweep_1x2_draw_v1       (2026-08-19)  — sweep-derived, 1X2 draw tier 2-3
 *   • bot_sweep_btts_yes_v1       (2026-08-19)  — sweep-derived, BTTS yes tier 2-3
 *
 * Click any bot card to see its full ledger. Superadmin-only.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

const STAKE = 10;
const PROMOTE_N_THRESHOLD = 50;

// Human-readable friendly config for each shadow bot — the DB name is dev-jargon;
// this table maps it to what an operator scans for at a glance.
const SHADOW_BOTS: Array<{
  name: string;
  title: string;
  subtitle: string;
}> = [
  {
    name: "bot_no_pin_shadow_v1",
    title: "Matches without Pinnacle",
    subtitle: "Any market · edge ≥ 8% · needs ≥3 accessible books",
  },
  {
    name: "bot_sweep_1x2_home_v1",
    title: "Home wins · tier 2-3",
    subtitle: "1X2 home · edge ≥ 10% · odds 2.0-5.0 · Pinnacle required",
  },
  {
    name: "bot_sweep_1x2_draw_v1",
    title: "Draws · tier 2-3",
    subtitle: "1X2 draw · edge ≥ 5% · odds 1.3-3.5 · Pinnacle required",
  },
  {
    name: "bot_sweep_btts_yes_v1",
    title: "Both teams to score · tier 2-3",
    subtitle: "BTTS yes · edge ≥ 5% · odds 2.0-2.5",
  },
];

interface ShadowBet {
  bot_id: string;
  odds_at_pick: number | null;
  result: string | null;
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
  status: BotStatus;
}

type BotStatus =
  | { kind: "collecting"; msg: string }
  | { kind: "promote"; roi: number; n: number }
  | { kind: "retire"; roi: number; n: number }
  | { kind: "watching"; roi: number; n: number };

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

  let status: BotStatus;
  if (settled === 0) {
    status = { kind: "collecting", msg: mine.length === 0 ? "Waiting for first pick" : "No bets settled yet" };
  } else if (settled >= PROMOTE_N_THRESHOLD && roi >= 3) {
    status = { kind: "promote", roi, n: settled };
  } else if (settled >= PROMOTE_N_THRESHOLD && roi <= -8) {
    status = { kind: "retire", roi, n: settled };
  } else {
    status = { kind: "watching", roi, n: settled };
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
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Shadow bots</h1>
        <p className="mt-6 text-base text-amber-400">
          No shadow bots registered yet — migrations 271 &amp; 272 haven&apos;t been applied.
        </p>
      </div>
    );
  }

  const { data: betsRaw } = await db
    .from("shadow_bets")
    .select("bot_id, odds_at_pick, result")
    .in(
      "bot_id",
      bots.map((b) => b.id)
    );
  const bets = (betsRaw ?? []) as ShadowBet[];

  const summaries: Summary[] = SHADOW_BOTS.map((cfg) => {
    const bot = bots.find((b) => b.name === cfg.name);
    if (!bot) return null;
    return summarise(cfg, bot, bets);
  }).filter((s): s is Summary => s !== null);

  const totals = summaries.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      settled: acc.settled + s.settled,
      won: acc.won + s.won,
      pnl: acc.pnl + s.pnl,
      stake: acc.stake + s.stake,
      pending: acc.pending + s.pending,
    }),
    { total: 0, settled: 0, won: 0, pnl: 0, stake: 0, pending: 0 }
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      {/* Header */}
      <header className="mb-14 space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-400">
          Experimental
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Shadow bots</h1>
        <p className="max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
          Four experimental bots collecting data on strategies we haven&apos;t deployed yet.
          They log picks but never place bets or touch bankroll. When any bot reaches{" "}
          <span className="text-neutral-200">50 settled picks</span>, we decide: promote to
          paper beta, or retire.
        </p>
      </header>

      {/* Portfolio strip */}
      <section className="mb-14 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <PortfolioStat label="Picks collected" value={totals.total.toLocaleString()} />
          <PortfolioStat label="Awaiting result" value={totals.pending.toLocaleString()} />
          <PortfolioStat label="Settled" value={totals.settled.toLocaleString()} />
          <PortfolioStat
            label="Portfolio ROI"
            value={
              totals.stake > 0
                ? `${totals.pnl / totals.stake >= 0 ? "+" : ""}${((totals.pnl / totals.stake) * 100).toFixed(1)}%`
                : "—"
            }
            hint={totals.stake > 0 ? undefined : "Not enough data yet"}
            tone={
              totals.stake === 0
                ? "neutral"
                : totals.pnl / totals.stake >= 0.03
                ? "good"
                : totals.pnl / totals.stake <= -0.08
                ? "bad"
                : "neutral"
            }
          />
        </div>
      </section>

      {/* Bots list */}
      <section className="space-y-4">
        {summaries.map((s) => (
          <BotCard key={s.name} s={s} />
        ))}
      </section>

      <p className="mt-16 text-sm text-neutral-500">
        <Link href="/admin/ops" className="underline underline-offset-4 hover:text-neutral-300">
          ← Back to ops
        </Link>
      </p>
    </div>
  );
}

function BotCard({ s }: { s: Summary }) {
  const progress = Math.min(100, (s.total / PROMOTE_N_THRESHOLD) * 100);

  return (
    <Link
      href={`/admin/shadow-bots/${s.name}`}
      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition hover:border-white/20 hover:bg-white/[0.04] sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        {/* Left column — identity + strategy */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-neutral-100 sm:text-2xl">{s.title}</h3>
            <StatusPill status={s.status} />
          </div>
          <p className="mt-2 text-sm text-neutral-400">{s.subtitle}</p>
          <p className="mt-1 font-mono text-[11px] text-neutral-600">{s.name}</p>
        </div>

        {/* Right column — key numbers when settled */}
        {s.settled > 0 ? (
          <div className="flex shrink-0 gap-8">
            <ResultNumber
              label="ROI"
              value={`${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1)}%`}
              tone={s.roi >= 3 ? "good" : s.roi <= -8 ? "bad" : "neutral"}
            />
            <ResultNumber label="Hit rate" value={`${s.hitRate.toFixed(0)}%`} />
          </div>
        ) : null}
      </div>

      {/* Progress bar toward the 50-settled promotion threshold */}
      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-neutral-300">
            <span className="text-lg font-semibold text-neutral-100">{s.total}</span>{" "}
            <span className="text-neutral-500">picks collected</span>
          </span>
          <span className="text-xs text-neutral-500">
            {s.total >= PROMOTE_N_THRESHOLD
              ? "ready for decision"
              : `${PROMOTE_N_THRESHOLD - s.total} more to decision`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all ${
              s.status.kind === "promote"
                ? "bg-emerald-400"
                : s.status.kind === "retire"
                ? "bg-rose-400"
                : "bg-neutral-400"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bottom row — outcome dots + CTA */}
      <div className="mt-5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4 text-neutral-400">
          <OutcomePill kind="won" n={s.won} />
          <OutcomePill kind="lost" n={s.lost} />
          <OutcomePill kind="void" n={s.void} />
          <OutcomePill kind="pending" n={s.pending} />
        </div>
        <span className="text-sm text-neutral-500 transition group-hover:text-neutral-200">
          View picks →
        </span>
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: BotStatus }) {
  if (status.kind === "collecting") {
    return (
      <span className="rounded-full bg-amber-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-400">
        Collecting
      </span>
    );
  }
  if (status.kind === "promote") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
        Promote candidate
      </span>
    );
  }
  if (status.kind === "retire") {
    return (
      <span className="rounded-full bg-rose-500/15 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-rose-400">
        Retire candidate
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/[0.05] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-300">
      Watching
    </span>
  );
}

function OutcomePill({ kind, n }: { kind: "won" | "lost" | "void" | "pending"; n: number }) {
  const dot =
    kind === "won"
      ? "bg-emerald-400"
      : kind === "lost"
      ? "bg-rose-400"
      : kind === "void"
      ? "bg-neutral-500"
      : "bg-amber-400";
  const label = kind === "won" ? "won" : kind === "lost" ? "lost" : kind === "void" ? "void" : "pending";
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="tabular-nums text-neutral-200">{n}</span>
      <span className="text-neutral-500">{label}</span>
    </span>
  );
}

function ResultNumber({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-neutral-100";
  return (
    <div className="text-right">
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function PortfolioStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-neutral-100";
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

function Denied({ text = "Access denied." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">{text}</div>
  );
}
