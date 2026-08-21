"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PerformancePnlChartToggle } from "@/components/performance-pnl-chart-toggle";
import type { PublicPerformanceExtras, CalibrationBucket, Streaks, DashboardCache } from "@/lib/engine-data";

interface Props {
  data: PublicPerformanceExtras;
  cache: DashboardCache | null;
}

export function PerformanceExtras({ data, cache }: Props) {
  const { calibration, streaks } = data;
  return (
    <div className="space-y-4">
      <PerformancePnlChartToggle
        curve30d={cache?.daily_pnl_curve_30d ?? null}
        curve90d={cache?.daily_pnl_curve_90d ?? null}
      />

      <StreaksCard streaks={streaks} />

      <TransparencyCollapse>
        <CalibrationCard buckets={calibration} />
      </TransparencyCollapse>
    </div>
  );
}

function StreaksCard({ streaks }: { streaks: Streaks }) {
  const current =
    streaks.currentWin > 0
      ? { label: `${streaks.currentWin}W in a row`, tone: "win" as const }
      : streaks.currentLoss > 0
        ? { label: `${streaks.currentLoss}L in a row`, tone: "loss" as const }
        : { label: "no active streak", tone: "neutral" as const };

  const colorFor = (t: "win" | "loss" | "neutral") =>
    t === "win" ? "text-emerald-400" : t === "loss" ? "text-red-400" : "text-neutral-400";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-neutral-950/60 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">Streaks</p>
        <span className="text-[10px] text-neutral-500">variance is real — even a +5% ROI edge sees double-digit losing runs</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StreakTile label="Current" value={current.label} color={colorFor(current.tone)} />
        <StreakTile label="Longest winning" value={`${streaks.longestWin}W`} color="text-emerald-400" />
        <StreakTile label="Longest losing" value={`${streaks.longestLoss}L`} color="text-red-400" />
      </div>
    </div>
  );
}

function StreakTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-neutral-950 px-3 py-3 text-center">
      <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function TransparencyCollapse({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-neutral-950/60 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div>
          <p className="text-sm font-semibold text-neutral-100">Model transparency</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            How honest is the model? Predicted vs actual hit-rate on placed bets — with a real gap explained.
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-neutral-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-white/[0.06]">{children}</div>}
    </div>
  );
}

function CalibrationCard({ buckets }: { buckets: CalibrationBucket[] }) {
  const visible = buckets.filter((b) => b.n >= 20);
  const maxN = visible.reduce((m, b) => Math.max(m, b.n), 0);

  return (
    <div className="p-5">
      {/* CALIBRATION-HONEST-COPY (2026-07-06, updated 2026-08-21): the old
          intro said "when the model says 60%, it should hit ~60%" and every
          row showed the opposite (systematic ~10pp under-hit). That framing
          was dishonest — the model is a known 5-15pp over-confident on
          picks in the 30-60% range (documented in MODEL_WHITEPAPER §3.7
          GLOBAL-PLATT-OVERCONFIDENCE). Selection bias amplifies it: every
          row here is a pick the bot placed at market edge, so the sample
          sits on the model's optimistic tail by construction. Kelly sizing
          + the edge gate compensate at the P&L layer — ROI is still
          positive despite the visible gap. Better to say that than pretend
          the table is broken. */}
      <p className="text-xs text-neutral-400 leading-relaxed">
        These are placed bets — the bot only bets when it sees an edge, so the sample
        sits on the model&apos;s optimistic tail by construction. The model is a known
        <span className="mx-1 rounded bg-amber-500/10 px-1 py-0.5 font-mono text-[10px] font-bold text-amber-400">5–15pp overconfident</span>
        on mid-range picks. We compensate at the P&amp;L layer — Kelly sizing + the edge gate
        make sure ROI stays positive despite the visible gap.
      </p>

      {visible.length === 0 ? (
        <p className="mt-4 text-xs text-neutral-500">Need more settled bets per bucket.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {visible.map((b) => {
            const actual = b.actualHit ?? 0;
            const predicted = b.predictedMid;
            const gap = actual - predicted;
            const gapClose = Math.abs(gap) < 0.03;
            const widthPct = maxN > 0 ? (b.n / maxN) * 100 : 0;
            return (
              <div key={b.label} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-xs">
                <span className="font-mono text-neutral-300">{b.label}</span>
                <div className="relative h-6 overflow-hidden rounded bg-neutral-900/80">
                  {/* Predicted marker */}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-blue-400/60"
                    style={{ left: `${predicted * 100}%` }}
                    title={`Predicted mid ${(predicted * 100).toFixed(0)}%`}
                  />
                  {/* Actual bar */}
                  <div
                    className={`absolute inset-y-0 left-0 ${gapClose ? "bg-emerald-500/25" : "bg-amber-500/25"}`}
                    style={{ width: `${actual * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 text-[10px] text-neutral-300">
                    <span className="font-mono">actual {(actual * 100).toFixed(1)}%</span>
                    <span className={`ml-auto font-mono ${gapClose ? "text-emerald-400" : "text-amber-400"}`}>
                      {gap >= 0 ? "+" : ""}{(gap * 100).toFixed(1)}pp
                    </span>
                  </div>
                </div>
                <span
                  className="font-mono text-[10px] text-neutral-500"
                  title={`${b.n} bets in this bucket`}
                  style={{ minWidth: "60px", textAlign: "right" }}
                >
                  n={b.n}
                  <span
                    className="ml-1 inline-block h-1.5 rounded-full bg-neutral-700"
                    style={{ width: `${Math.max(6, widthPct / 3)}px` }}
                  />
                </span>
              </div>
            );
          })}
          <p className="mt-3 border-t border-white/[0.05] pt-3 text-[10px] text-neutral-500">
            <span className="mr-2 inline-block h-2 w-0.5 bg-blue-400/60 align-middle" />
            Predicted midpoint of the bucket
            <span className="mx-2">·</span>
            <span className="mr-2 inline-block h-2 w-2 rounded bg-amber-500/40 align-middle" />
            Actual hit-rate
          </p>
        </div>
      )}
    </div>
  );
}
