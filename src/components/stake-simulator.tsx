"use client";

/**
 * Interactive stake simulator for the /methodology page.
 *
 * Lets a visitor drag a slider 1–100 (or type a custom stake) and see
 * the per-competitor euro returns recompute live for the same matched
 * window the landing comparison block uses. ROI is fixed (it's already
 * been measured on the actual cohort); we just rescale stake × roi.
 *
 * Pure client component — no API calls, no DB. Math is `stake × roi%`
 * per row. The competitor data is duplicated from the landing
 * (single source of truth lives in ledger/comparison_*.json on the
 * engine repo; both surfaces hard-code the same five rows so they
 * stay in lock-step).
 */
import { useState } from "react";

interface Row {
  name: string;
  color: string;
  theirRoi: number;
}

const OUR_ROI = 11.91;
const COMPETITORS: Row[] = [
  { name: "WinnerOdds", color: "text-neutral-300", theirRoi: 6.55 },
  { name: "SignalOdds", color: "text-red-400",    theirRoi: -0.44 },
  { name: "DeepBetting", color: "text-red-400",   theirRoi: -9.15 },
  { name: "Tipstrr",    color: "text-red-400",    theirRoi: -5.22 },
  { name: "Forebet",    color: "text-neutral-300", theirRoi: 15.33 },
];

function fmtEur(pnl: number): string {
  const sign = pnl > 0 ? "+" : pnl < 0 ? "" : "";
  return `${sign}€${pnl.toFixed(0)}`;
}

export function StakeSimulator() {
  const [stake, setStake] = useState(10);

  const ourPnl = (OUR_ROI * stake) / 100; // ROI is %, stake is per-bet euro

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-xs font-mono uppercase tracking-widest text-emerald-400">
          Stake simulator
        </p>
        <p className="text-[10px] text-neutral-500">
          per bet · pnl scales linearly
        </p>
      </div>

      {/* Slider + numeric */}
      <div className="mb-5 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          €
        </span>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="flex-1 accent-emerald-500"
          aria-label="Stake per bet (euros)"
        />
        <input
          type="number"
          min={1}
          max={10000}
          value={stake}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 1) setStake(Math.min(10000, v));
          }}
          className="w-20 rounded-md border border-white/15 bg-neutral-950 px-2 py-1 text-right font-mono text-sm tabular-nums text-neutral-100 focus:border-emerald-500/50 focus:outline-none"
          aria-label="Stake per bet (numeric input)"
        />
      </div>

      {/* Result table */}
      <div className="overflow-hidden rounded-md border border-white/[0.06]">
        <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-white/[0.04] bg-emerald-500/[0.06] px-3 py-2.5">
          <div className="text-sm font-semibold text-neutral-100">
            OddsIntel · production
          </div>
          <div className="text-right font-mono text-base font-semibold tabular-nums text-emerald-300">
            {fmtEur(ourPnl)}
          </div>
        </div>
        {COMPETITORS.map((c) => {
          const theirPnl = (c.theirRoi * stake) / 100;
          const diff = ourPnl - theirPnl;
          return (
            <div
              key={c.name}
              className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-b border-white/[0.03] px-3 py-2 last:border-b-0"
            >
              <div className="text-sm text-neutral-400">{c.name}</div>
              <div className={`text-right font-mono text-sm tabular-nums ${c.color}`}>
                {fmtEur(theirPnl)}
              </div>
              <div
                className={`text-right font-mono text-[11px] tabular-nums ${
                  diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-neutral-500"
                }`}
              >
                {diff > 0 ? "▲ +" : diff < 0 ? "▼ " : ""}€{Math.abs(diff).toFixed(0)}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Per-bet stake assumed flat. Numbers scale linearly because ROI
        is a percentage — doubling the stake doubles every euro figure.
        For Kelly-sized comparisons see the next section.
      </p>
    </div>
  );
}
