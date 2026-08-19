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

const SHADOW_BOT_NAMES = [
  "bot_no_pin_shadow_v1",
  "bot_sweep_1x2_home_v1",
  "bot_sweep_1x2_draw_v1",
  "bot_sweep_btts_yes_v1",
] as const;

interface ShadowBet {
  bot_id: string;
  odds_at_pick: number | null;
  result: string | null;
}
interface BotRow {
  id: string;
  name: string;
  description: string | null;
  maturity_label: string | null;
}
interface Summary {
  bot: BotRow;
  total: number;
  pending: number;
  won: number;
  lost: number;
  void: number;
  pnl: number;
  stake: number;
  roi: number;
  hitRate: number;
}

const STAKE = 10;

function summarise(bot: BotRow, bets: ShadowBet[]): Summary {
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
  return {
    bot,
    total: mine.length,
    pending,
    won,
    lost,
    void: voided,
    pnl,
    stake,
    roi,
    hitRate,
  };
}

export default async function ShadowBotsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }
  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Superadmin only.
      </div>
    );
  }

  const { data: botsRaw } = await db
    .from("bots")
    .select("id, name, description, maturity_label")
    .in("name", SHADOW_BOT_NAMES as unknown as string[]);
  const bots = (botsRaw ?? []) as BotRow[];

  if (bots.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Shadow Bots</h1>
        <p className="mt-4 text-sm text-amber-400">
          No shadow bots registered yet — migrations 271 &amp; 272 haven&apos;t been applied.
        </p>
      </div>
    );
  }

  const botIds = bots.map((b) => b.id);
  const { data: betsRaw } = await db
    .from("shadow_bets")
    .select("bot_id, odds_at_pick, result")
    .in("bot_id", botIds);
  const bets = (betsRaw ?? []) as ShadowBet[];

  // Fixed display order
  const summaries: Summary[] = SHADOW_BOT_NAMES.map((n) => bots.find((b) => b.name === n))
    .filter((b): b is BotRow => !!b)
    .map((b) => summarise(b, bets));

  const totals = summaries.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      settled: acc.settled + s.won + s.lost,
      won: acc.won + s.won,
      pnl: acc.pnl + s.pnl,
      stake: acc.stake + s.stake,
    }),
    { total: 0, settled: 0, won: 0, pnl: 0, stake: 0 }
  );
  const totalROI = totals.stake > 0 ? (totals.pnl / totals.stake) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">
          Experimental · data collection only
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Shadow bots</h1>
        <p className="max-w-2xl text-sm text-neutral-400">
          Four experimental bots that write only to <code>shadow_bets</code> — never to{" "}
          <code>simulated_bets</code>, never touch bankroll. Purpose: measure whether the model has
          real edge on strategies not yet in production. Promote to paper beta at n≥50 with ROI ≥
          +3% and positive CLV. Retire at ROI ≤ -8%. Full checkpoint:{" "}
          <span className="font-mono text-neutral-300">MODEL-EVIDENCE-CHECKPOINT-2026-11-01</span>.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total picks" value={totals.total.toLocaleString()} />
        <StatCard label="Settled" value={totals.settled.toLocaleString()} />
        <StatCard
          label="Hit rate"
          value={
            totals.settled > 0 ? `${((totals.won / totals.settled) * 100).toFixed(1)}%` : "—"
          }
        />
        <StatCard
          label="Portfolio ROI"
          value={totals.stake > 0 ? `${totalROI >= 0 ? "+" : ""}${totalROI.toFixed(1)}%` : "—"}
          tone={totalROI >= 3 ? "good" : totalROI <= -8 ? "bad" : "neutral"}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-500">Bots</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {summaries.map((s) => (
            <BotCard key={s.bot.id} summary={s} />
          ))}
        </div>
      </section>

      <p className="text-xs text-neutral-500">
        <Link href="/admin/ops" className="underline hover:text-neutral-300">
          ← Back to ops
        </Link>
      </p>
    </div>
  );
}

function BotCard({ summary }: { summary: Summary }) {
  const s = summary;
  const settled = s.won + s.lost;
  const tone: "good" | "bad" | "neutral" =
    settled === 0 ? "neutral" : s.roi >= 3 ? "good" : s.roi <= -8 ? "bad" : "neutral";
  return (
    <Link
      href={`/admin/shadow-bots/${s.bot.name}`}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:border-white/[0.15] hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-100">{s.bot.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{s.bot.description ?? "—"}</p>
        </div>
        <span className="rounded bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
          {s.bot.maturity_label ?? "—"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 border-t border-white/[0.04] pt-4">
        <MiniStat label="Picks" value={s.total.toString()} />
        <MiniStat
          label="Hit"
          value={settled > 0 ? `${s.hitRate.toFixed(0)}%` : "—"}
          tone="neutral"
        />
        <MiniStat
          label="P&L"
          value={settled > 0 ? `${s.pnl >= 0 ? "+" : ""}€${s.pnl.toFixed(0)}` : "—"}
          tone={tone}
        />
        <MiniStat
          label="ROI"
          value={settled > 0 ? `${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(1)}%` : "—"}
          tone={tone}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          <span className="text-emerald-400/80">{s.won}W</span>
          <span className="mx-1 text-neutral-600">·</span>
          <span className="text-rose-400/80">{s.lost}L</span>
          <span className="mx-1 text-neutral-600">·</span>
          <span className="text-neutral-500">{s.void}V</span>
          <span className="mx-1 text-neutral-600">·</span>
          <span className="text-amber-400/80">{s.pending}P</span>
        </span>
        <span className="opacity-0 transition group-hover:opacity-100">View ledger →</span>
      </div>
    </Link>
  );
}

function StatCard({
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
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({
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
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
