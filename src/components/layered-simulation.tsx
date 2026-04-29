"use client";

/**
 * Layered simulation — shows how each additional layer changes the outcome
 * of the same model predictions, using REAL historical bookmaker odds.
 *
 * Layer 1: Flat €10, worst bookmaker odds  (Free baseline)
 * Layer 2: Flat €10, best bookmaker odds   (Pro: odds comparison — 1 of 6 Pro signals)
 * Layer 3: Flat €10, best odds + 60%+ conf (Pro: confidence filtering)
 * Layer 4: Kelly staking, best odds + 60%+ (Elite: optimal stake sizing — 1 of 4 Elite extras)
 */

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Lock, TrendingUp, Database, Info } from "lucide-react";
import type { ModelPredictionRow } from "@/lib/engine-data";

interface Props {
  rows: ModelPredictionRow[];
}

const START_BANKROLL = 1000;
const FLAT_STAKE = 10;
const MAX_KELLY_FRACTION = 0.08;

interface BetResult { stake: number; pnl: number }

function runSimulation(
  rows: ModelPredictionRow[],
  oddsSelector: (row: ModelPredictionRow) => number,
  minConfidence: number,
  useKelly: boolean
): {
  bets: number;
  won: number;
  hitRate: number;
  totalStaked: number;
  pnl: number;
  roi: number;
  finalBankroll: number;
  series: BetResult[];
} {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const eligible = sorted.filter((r) => r.confidence >= minConfidence);

  let bankroll = START_BANKROLL;
  let totalStaked = 0;
  let totalPnl = 0;
  let won = 0;
  const series: BetResult[] = [];

  for (const row of eligible) {
    const odds = oddsSelector(row);
    if (odds <= 1) continue;

    let stake: number;
    if (useKelly) {
      const p = row.confidence;
      const b = odds - 1;
      const kelly = (p * b - (1 - p)) / b;
      const fraction = Math.max(0, Math.min(kelly, MAX_KELLY_FRACTION));
      stake = Math.max(1, bankroll * fraction);
    } else {
      stake = FLAT_STAKE;
    }

    const pnl = row.correct ? stake * (odds - 1) : -stake;
    totalStaked += stake;
    totalPnl += pnl;
    bankroll += pnl;
    if (row.correct) won++;
    series.push({ stake, pnl });
  }

  const bets = series.length;
  const hitRate = bets > 0 ? (won / bets) * 100 : 0;
  const roi = totalStaked > 0 ? (totalPnl / totalStaked) * 100 : 0;

  return {
    bets,
    won,
    hitRate,
    totalStaked,
    pnl: totalPnl,
    roi,
    finalBankroll: Math.round(bankroll * 100) / 100,
    series,
  };
}

function buildBankrollCurve(series: BetResult[]): number[] {
  let b = START_BANKROLL;
  const pts = [b];
  for (const { pnl } of series) {
    b += pnl;
    pts.push(Math.round(b * 100) / 100);
  }
  return pts;
}

const LAYERS = [
  {
    id: "l1",
    color: "#64748b",
    tier: "Free",
    label: "Any bookmaker",
    desc: "€10 flat on every pick · worst available odds",
    locked: false,
  },
  {
    id: "l2",
    color: "#3b82f6",
    tier: "Pro",
    label: "+ Best odds",
    desc: "Same picks · always at the best bookmaker price",
    locked: true,
  },
  {
    id: "l3",
    color: "#f59e0b",
    tier: "Pro",
    label: "+ High confidence only",
    desc: "Only 60%+ confidence picks · best odds",
    locked: true,
  },
  {
    id: "l4",
    color: "#10b981",
    tier: "Elite",
    label: "+ Kelly staking",
    desc: "Stake sized to model edge · 60%+ picks · best odds",
    locked: true,
  },
];

export function LayeredSimulation({ rows }: Props) {
  // All rows have real odds (data layer filters out rows without odds)
  const simulations = useMemo(() => [
    runSimulation(rows, (r) => r.worstOddsForPick, 0, false),
    runSimulation(rows, (r) => r.bestOddsForPick, 0, false),
    runSimulation(rows, (r) => r.bestOddsForPick, 0.6, false),
    runSimulation(rows, (r) => r.bestOddsForPick, 0.6, true),
  ], [rows]);

  const chartData = useMemo(() => {
    const curves = simulations.map((s) => buildBankrollCurve(s.series));
    const maxLen = Math.max(...curves.map((c) => c.length));
    return Array.from({ length: maxLen }, (_, i) => ({
      i,
      l1: curves[0][Math.min(i, curves[0].length - 1)],
      l2: curves[1][Math.min(i, curves[1].length - 1)],
      l3: curves[2][Math.min(i, curves[2].length - 1)],
      l4: curves[3][Math.min(i, curves[3].length - 1)],
    }));
  }, [simulations]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-5 rounded-xl border border-border/50 bg-card/60 p-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h2 className="text-base font-semibold text-foreground">What if you added more layers?</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
          The same {rows.length} predictions above, starting with €{START_BANKROLL.toLocaleString()}.
          Each layer stacks one more advantage — better odds, sharper filtering, smarter sizing.
        </p>

        {/* "One signal" callout */}
        <div className="flex items-start gap-1.5 rounded-md border px-3 py-1.5 w-fit mt-1 border-amber-500/20 bg-amber-500/5">
          <Info className="h-3 w-3 shrink-0 text-amber-400/70 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            This simulation isolates <strong className="text-foreground/80">one signal per tier</strong> — Pro has 6 advantages stacked, Elite adds 4 more on top. The real edge compounds further.
          </p>
        </div>

        {/* Data source badge */}
        <div className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 w-fit border-border/40 bg-card/40">
          <Database className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          <p className="text-[11px] text-muted-foreground">
            Real bookmaker odds from our database — same {rows.length} matches shown above
          </p>
        </div>
      </div>

      {/* Layer cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LAYERS.map((layer, i) => {
          const sim = simulations[i];
          const delta = sim.finalBankroll - START_BANKROLL;
          const positive = delta > 0;

          return (
            <div
              key={layer.id}
              className="relative rounded-lg border bg-card/40 p-4 space-y-3 flex flex-col"
              style={{ borderColor: layer.color + "30" }}
            >
              {/* Tier + lock */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: layer.color }}>
                  {layer.tier}
                </span>
                {layer.locked && <Lock className="h-3 w-3 text-muted-foreground/30" />}
              </div>

              {/* Label + desc */}
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">{layer.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{layer.desc}</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] border-t border-border/30 pt-2">
                <span className="text-muted-foreground/60">Bets</span>
                <span className="font-mono font-medium text-right">{sim.bets}</span>
                <span className="text-muted-foreground/60">Hit rate</span>
                <span className={`font-mono font-medium text-right ${sim.hitRate >= 45 ? "text-emerald-400" : sim.hitRate >= 33 ? "text-amber-400" : "text-muted-foreground"}`}>
                  {sim.hitRate.toFixed(0)}%
                </span>
                <span className="text-muted-foreground/60">ROI</span>
                <span className={`font-mono font-medium text-right ${sim.roi > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {sim.roi >= 0 ? "+" : ""}{sim.roi.toFixed(1)}%
                </span>
              </div>

              {/* Bankroll result */}
              <div
                className="rounded-md px-3 py-2.5 text-center"
                style={{ backgroundColor: layer.color + "14" }}
              >
                <p className="text-[10px] text-muted-foreground/60 mb-0.5">€1,000 →</p>
                <p className="font-mono text-xl font-bold" style={{ color: layer.color }}>
                  €{sim.finalBankroll.toFixed(0)}
                </p>
                <p className={`text-[11px] font-medium mt-0.5 ${positive ? "text-emerald-400" : "text-red-400"}`}>
                  {positive ? "+" : ""}€{delta.toFixed(0)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bankroll chart */}
      <div className="rounded-lg border border-border/30 bg-card/30 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Bankroll growth — all 4 scenarios
        </p>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="i"
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 10 }}
                label={{ value: "Bet #", position: "insideBottomRight", offset: -5, fill: "#64748b", fontSize: 10 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickFormatter={(v: number) => `€${v}`}
                width={58}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "11px", fontFamily: "monospace" }}
                labelStyle={{ color: "#64748b", fontSize: "10px" }}
                formatter={(value, name) => {
                  const labels: Record<string, string> = { l1: "Any odds", l2: "+ Best odds", l3: "+ 60%+ filter", l4: "+ Kelly sizing" };
                  const v = typeof value === "number" ? value : 0;
                  const n = String(name ?? "");
                  return [`€${v.toFixed(0)}`, labels[n] ?? n] as [string, string];
                }}
              />
              <Legend
                formatter={(value) => {
                  const labels: Record<string, string> = { l1: "Any odds", l2: "+ Best odds", l3: "+ 60%+ filter", l4: "+ Kelly sizing" };
                  return <span style={{ fontSize: 11, color: "#94a3b8" }}>{labels[value] ?? value}</span>;
                }}
              />
              <ReferenceLine y={START_BANKROLL} stroke="#334155" strokeDasharray="4 3" />
              {LAYERS.map((layer) => (
                <Line
                  key={layer.id}
                  type="monotone"
                  dataKey={layer.id}
                  stroke={layer.color}
                  strokeWidth={layer.id === "l4" ? 2.5 : 1.5}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key insight */}
      <div className="rounded-lg border border-border/30 bg-card/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p>
          <strong className="text-foreground/80">Bookmaker names hidden</strong> — which book had the best price on each historical match is Pro data.
          Pro shows you the best available odds <em>right now</em> on today&apos;s picks, so you capture that edge in real time.
        </p>
        <p>
          <strong className="text-foreground/80">Kelly staking</strong> bets more when the model&apos;s edge is larger, less when it&apos;s smaller — compounding gains and reducing drawdown on uncertain picks.
        </p>
        <p className="border-t border-border/20 pt-2 text-muted-foreground/60">
          Each simulated layer represents <strong className="text-foreground/60">one signal</strong> from its tier.
          Pro stacks 6 advantages total; Elite adds 4 more — value bet alerts, AI-powered bet reasoning, and more.
          The full stack compounds further than what you see here.
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Capture this edge on today&apos;s picks</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Pro: odds across 13 bookmakers + 5 more signals. Elite: Kelly sizing + value alerts + AI reasoning.
          </p>
        </div>
        <a
          href="/how-it-works"
          className="shrink-0 rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          See tiers →
        </a>
      </div>
    </div>
  );
}
