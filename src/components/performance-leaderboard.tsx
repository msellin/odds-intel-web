"use client";

import { useState } from "react";
import { Lock, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";

export interface PublicBotStat {
  name: string;
  settled: number;
  won: number;
  lost: number;
  pnl: number | null;
  roi: number | null;
  clvDirection: "positive" | "negative" | "neutral" | null;
  avgClv: number | null;
  currentBankroll: number | null;
  // PERF-CHART-STARTING-BANKROLL (2026-05-17): per-bot starting bankroll so the
  // chart's synthetic origin matches reality. Was hardcoded €1000, which broke
  // for bot_aggressive_v2 (€10k start) — the line jumped from 1000 to 10000+
  // on the first bet, looking like the chart "started from the first bet."
  startingBankroll: number | null;
  hasEnoughData: boolean;
}

export interface SanitizedBotBet {
  id: string;
  match: string;
  league: string;
  placedAt: string;
  market: string;
  selection: string;
  odds: number;
  stake: number | null;
  result: string;
  pnl: number;
  bankrollAfter: number | null;
  modelProb: number;
  clv: number | null;
  bot: string;
}

interface Props {
  bots: PublicBotStat[];
  isPro: boolean;
  isElite: boolean;
  allBets: SanitizedBotBet[] | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function fmtPct(n: number | null) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function pnlColor(n: number) {
  return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted-foreground";
}

function ClvIcon({ dir }: { dir: "positive" | "negative" | "neutral" | null }) {
  if (dir === "positive") return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (dir === "negative") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

function resultBadge(r: string) {
  if (r === "won") return <span className="text-emerald-400 font-semibold">W</span>;
  if (r === "lost") return <span className="text-red-400/80">L</span>;
  if (r === "void") return <span className="text-muted-foreground">V</span>;
  return <span className="text-yellow-400/70">P</span>;
}

// ── Bankroll chart ────────────────────────────────────────────────────────────

function buildChartData(bets: SanitizedBotBet[], startingBankroll: number | null) {
  const settled = [...bets]
    .filter((b) => b.result === "won" || b.result === "lost")
    .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

  if (settled.length < 2) return [];

  // PERF-CHART-STARTING-BANKROLL (2026-05-17): use the bot's actual starting
  // bankroll. Was hardcoded €1000, which broke bot_aggressive_v2 (€10k start)
  // — the line jumped from 1000 to ~10000 on the first bet, looking like the
  // chart "started from the first bet's result."
  const origin = startingBankroll ?? 1000;
  const hasBankroll = settled.some((b) => b.bankrollAfter != null);
  let running = origin;

  const series = settled.map((b, i) => {
    const bankroll = hasBankroll && b.bankrollAfter != null
      ? b.bankrollAfter
      : (running += b.pnl, running);
    return {
      idx: i + 1,
      bankroll: Math.round(bankroll * 100) / 100,
      date: new Date(b.placedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      result: b.result as "won" | "lost" | "origin",
    };
  });
  return [
    { idx: 0, bankroll: origin, date: "Start", result: "origin" as const },
    ...series,
  ];
}

// ── Bot detail modal (Pro+) ───────────────────────────────────────────────────

function BotModal({
  bot,
  bets,
  isElite,
  onClose,
}: {
  bot: PublicBotStat;
  bets: SanitizedBotBet[];
  isElite: boolean;
  onClose: () => void;
}) {
  // MATCH-DUPES-CLEANUP: hide voided bets from the per-bot history. They fire when the
  // OU/odds-quality cleanup (or future audits) retroactively invalidates a settled bet —
  // pnl=0 by definition, but the row at original odds_at_pick was misleading users into
  // thinking the bot had taken e.g. Over 1.5 at 3.42 (it did, but the price was garbage).
  const botBets = bets
    .filter((b) => b.bot === bot.name && b.result !== "void")
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const chartData = buildChartData(botBets, bot.startingBankroll);
  const origin = bot.startingBankroll ?? 1000;
  const bankrollValues = chartData.map((d) => d.bankroll);
  const minB = Math.min(...bankrollValues, origin);
  const maxB = Math.max(...bankrollValues, origin);
  // Bucket size scales with origin — €50 buckets feel right at €1000 starts
  // but tiny at €10k. Use 5% of origin, min 50.
  const bucket = Math.max(50, Math.round((origin * 0.05) / 50) * 50);
  const yDomain = [Math.floor((minB - bucket * 0.6) / bucket) * bucket, Math.ceil((maxB + bucket * 0.6) / bucket) * bucket];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-base">{bot.name}</span>
            {bot.settled > 0 && bot.pnl != null && (
              <span className={`text-base font-semibold ${pnlColor(bot.pnl)}`}>
                {fmt(bot.pnl)}€
              </span>
            )}
            <span className="text-sm text-muted-foreground font-normal">
              {bot.settled > 0
                ? `${bot.settled} settled · ROI ${fmtPct(bot.roi)}`
                : "Accumulating data…"}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Chart */}
        {chartData.length > 1 ? (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">
              Bankroll progression · {chartData.length} settled bets
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#888" }} tickLine={false} />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                  formatter={(v) => [`€${Number(v).toFixed(2)}`, "Bankroll"]}
                  labelFormatter={(label) => {
                    const idx = Number(label);
                    const d = chartData.find((x) => x.idx === idx);
                    if (!d) return `Bet #${label}`;
                    if (d.result === "origin") return "Starting bankroll";
                    return `Bet #${idx} · ${d.date}`;
                  }}
                />
                <ReferenceLine y={1000} stroke="#555" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const fill = payload.result === "won"
                      ? "#22c55e"
                      : payload.result === "lost"
                        ? "#ef4444"
                        : "#666";
                    return (
                      <circle
                        key={`dot-${props.index}`}
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill={fill}
                        stroke="none"
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-muted-foreground">
            {botBets.length > 0
              ? `${botBets.filter((b) => b.result === "pending").length} pending bet(s) — waiting for results.`
              : "No bets placed yet."}
          </div>
        )}

        {/* Bets table */}
        {botBets.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">{botBets.length} bets (newest first)</p>
            <div className="rounded-md border border-white/[0.08] overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pl-3 pr-2">Date</th>
                    <th className="py-2 px-2">Match</th>
                    <th className="py-2 px-2">Market</th>
                    <th className="py-2 px-2 text-right">Odds</th>
                    {isElite && <th className="py-2 px-2 text-right">Stake</th>}
                    <th className="py-2 px-2 text-center">Result</th>
                    <th className="py-2 px-2 text-right">P&L</th>
                    <th className="py-2 pr-3 text-right">CLV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {botBets.map((b) => (
                    <tr key={b.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 pl-3 pr-2 text-muted-foreground whitespace-nowrap">
                        {new Date(b.placedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2 px-2 max-w-[180px] truncate" title={b.match}>{b.match}</td>
                      <td className="py-2 px-2 font-mono uppercase text-muted-foreground text-[10px] whitespace-nowrap">
                        {b.market} · {b.selection}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{b.odds.toFixed(2)}</td>
                      {isElite && (
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                          {b.stake != null ? `€${b.stake.toFixed(2)}` : "—"}
                        </td>
                      )}
                      <td className="py-2 px-2 text-center">{resultBadge(b.result)}</td>
                      <td className={`py-2 px-2 text-right tabular-nums ${b.result !== "pending" ? pnlColor(b.pnl) : "text-muted-foreground"}`}>
                        {b.result !== "pending" ? fmt(b.pnl) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {isElite && b.clv != null ? (
                          <span className={b.clv > 0 ? "text-emerald-400" : b.clv < 0 ? "text-red-400" : "text-muted-foreground"}>
                            {b.clv >= 0 ? "+" : ""}{(b.clv * 100).toFixed(1)}%
                          </span>
                        ) : b.clv != null ? (
                          <ClvIcon dir={b.clv > 0 ? "positive" : b.clv < 0 ? "negative" : "neutral"} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PerformanceLeaderboard({ bots, isPro, isElite, allBets }: Props) {
  const [selected, setSelected] = useState<PublicBotStat | null>(null);

  const visibleBots = bots;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Bot Leaderboard</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isPro
                ? `${bots.length} bots · click any row for bankroll chart`
                : `${bots.length} bots · dimmed = still accumulating · Pro unlocks W/L, P&L, charts`}
            </p>
          </div>
        </div>
      </div>

      {visibleBots.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          Bots are accumulating data — results appear after 5 settled bets.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-border/20 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-2.5 pl-5 pr-2">Bot</th>
                <th scope="col" className="py-2.5 px-2 text-right">Settled</th>
                {isPro && <th scope="col" className="py-2.5 px-2 text-right">W / L</th>}
                <th scope="col" className="py-2.5 px-2 text-right">ROI</th>
                {isPro && <th scope="col" className="py-2.5 px-2 text-right">P&L (€)</th>}
                {isElite && <th scope="col" className="py-2.5 px-2 text-right">Avg CLV</th>}
                {isElite && <th scope="col" className="py-2.5 px-2 text-right">Bankroll</th>}
                <th scope="col" className="py-2.5 px-2 text-center">CLV</th>
                {isPro && <th scope="col" className="py-2.5 pr-4 w-6" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {visibleBots.map((bot) => {
                const isMaturing = !bot.hasEnoughData;
                const isLive = bot.name.startsWith("inplay_");

                return (
                  <tr
                    key={bot.name}
                    className={`group transition-colors ${isPro ? "cursor-pointer hover:bg-muted/40" : ""} ${isMaturing ? "opacity-50" : ""}`}
                    onClick={() => isPro && allBets && setSelected(bot)}
                  >
                    <td className="py-3 pl-5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{bot.name}</span>
                        {isLive && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/30 text-amber-400/70">
                            live
                          </Badge>
                        )}
                      </div>
                      {isMaturing && (
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                          {bot.settled > 0 ? `${bot.settled} settled — accumulating data` : "Active · no settled bets yet"}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right text-sm tabular-nums">
                      {bot.settled > 0
                        ? <span className={isMaturing ? "text-muted-foreground text-xs" : ""}>{bot.settled}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    {isPro && (
                      <td className="py-3 px-2 text-right text-sm whitespace-nowrap">
                        {isMaturing ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <>
                            <span className="text-emerald-400">{bot.won}</span>
                            <span className="text-muted-foreground mx-0.5">/</span>
                            <span className="text-red-400">{bot.lost}</span>
                          </>
                        )}
                      </td>
                    )}
                    <td className={`py-3 px-2 text-right text-sm tabular-nums font-medium ${
                      isMaturing ? "text-muted-foreground" :
                      bot.roi == null ? "text-muted-foreground" :
                      bot.roi > 0 ? "text-emerald-400" : bot.roi < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {isMaturing ? "—" : fmtPct(bot.roi)}
                    </td>
                    {isPro && (
                      <td className={`py-3 px-2 text-right text-sm tabular-nums ${
                        isMaturing || bot.pnl == null ? "text-muted-foreground" : pnlColor(bot.pnl)
                      }`}>
                        {isMaturing || bot.pnl == null ? "—" : fmt(bot.pnl)}
                      </td>
                    )}
                    {isElite && (
                      <td className={`py-3 px-2 text-right text-sm tabular-nums ${
                        isMaturing || bot.avgClv == null ? "text-muted-foreground" :
                        bot.avgClv > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {isMaturing || bot.avgClv == null ? "—" : (bot.avgClv >= 0 ? "+" : "") + (bot.avgClv * 100).toFixed(1) + "%"}
                      </td>
                    )}
                    {isElite && (
                      <td className="py-3 px-2 text-right text-sm tabular-nums text-muted-foreground">
                        {bot.currentBankroll != null ? `€${bot.currentBankroll.toFixed(0)}` : "—"}
                      </td>
                    )}
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center">
                        {isMaturing ? (
                          <Minus className="h-3.5 w-3.5 text-muted-foreground/30" />
                        ) : (
                          <ClvIcon dir={bot.clvDirection} />
                        )}
                      </div>
                    </td>
                    {isPro && (
                      <td className="py-3 pr-4">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pro upsell — only when there's data to show */}
      {!isPro && visibleBots.length > 0 && (
        <div className="border-t border-border/20 px-5 py-4 bg-blue-500/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-foreground">
                Win/loss breakdown, P&amp;L, and bankroll charts
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pro unlocks full detail for every bot — click any row.
              </p>
            </div>
            <Link
              href="/how-it-works"
              className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}

      {/* Elite upsell for Pro users */}
      {isPro && !isElite && (
        <div className="border-t border-border/20 px-5 py-3 bg-emerald-500/5">
          <p className="text-[11px] text-muted-foreground">
            <span className="text-emerald-400 font-medium">Elite</span> unlocks exact CLV %, current bankroll per bot, and stake sizes.{" "}
            <Link href="/how-it-works" className="text-emerald-400 hover:underline">Upgrade →</Link>
          </p>
        </div>
      )}

      {selected && allBets && (
        <BotModal
          bot={selected}
          bets={allBets}
          isElite={isElite}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
