"use client";

import { useMemo, useState } from "react";
import type { RealBet } from "@/lib/engine-data";

const INITIAL_VISIBLE = 50;

function fmtMoney(v: number) {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}€${Math.abs(v).toFixed(2)}`;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function RealBetsLog({ bets }: { bets: RealBet[] }) {
  const [showAll, setShowAll] = useState(false);
  const [bot, setBot] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [market, setMarket] = useState<string>("");

  const bots = useMemo(
    () => unique(bets.map((b) => b.bot ?? "(none)")).sort(),
    [bets]
  );
  const markets = useMemo(() => unique(bets.map((b) => b.market)).sort(), [bets]);
  const results = useMemo(() => unique(bets.map((b) => b.result)).sort(), [bets]);

  const filtered = useMemo(
    () =>
      bets.filter((b) => {
        if (bot && (b.bot ?? "(none)") !== bot) return false;
        if (result && b.result !== result) return false;
        if (market && b.market !== market) return false;
        return true;
      }),
    [bets, bot, result, market]
  );

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE);
  const hidden = filtered.length - visible.length;
  const anyFilter = bot || result || market;

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <div className="flex flex-wrap items-center gap-3 p-3 border-b border-border">
        <h2 className="text-sm font-semibold">
          Bet log (newest first)
          <span className="text-muted-foreground font-normal ml-2">
            · {filtered.length === bets.length
              ? `${filtered.length}`
              : `${filtered.length} of ${bets.length}`}
            {filtered.length > INITIAL_VISIBLE && ` · showing ${visible.length}`}
          </span>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <FilterSelect label="Bot" value={bot} onChange={setBot} options={bots} />
          <FilterSelect label="Result" value={result} onChange={setResult} options={results} />
          <FilterSelect label="Market" value={market} onChange={setMarket} options={markets} />
          {anyFilter && (
            <button
              type="button"
              onClick={() => {
                setBot("");
                setResult("");
                setMarket("");
              }}
              className="text-muted-foreground hover:text-foreground underline"
            >
              clear
            </button>
          )}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left p-2">Placed</th>
            <th className="text-left p-2">Match</th>
            <th className="text-left p-2 hidden sm:table-cell">Bot</th>
            <th className="text-left p-2">Sel</th>
            <th className="text-right p-2 hidden sm:table-cell">Captured</th>
            <th className="text-right p-2">Odds</th>
            <th className="text-right p-2 hidden sm:table-cell">Slip</th>
            <th className="text-right p-2 hidden md:table-cell" title="Edge implied by the odds we took × bot model probability − 1">Edge</th>
            <th className="text-right p-2 hidden md:table-cell" title="Closing-line value: (actual_odds / closing_odds) − 1. Set at settlement.">CLV</th>
            <th className="text-right p-2">Stake</th>
            <th className="text-left p-2">Result</th>
            <th className="text-right p-2">PnL</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={12} className="p-4 text-center text-muted-foreground">
                {anyFilter ? "No bets match these filters." : "No real bets logged yet."}
              </td>
            </tr>
          )}
          {visible.map((b) => (
            <tr key={b.id} className="border-t border-border">
              <td className="p-2 whitespace-nowrap text-xs">
                {new Date(b.placedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              </td>
              <td className="p-2">
                <div>{b.match}</div>
                <div className="text-xs text-muted-foreground">{b.league}</div>
              </td>
              <td className="p-2 text-xs hidden sm:table-cell">{b.bot ?? "—"}</td>
              <td className="p-2 text-xs">
                <div>{b.market}</div>
                <div className="text-muted-foreground">{b.selection}</div>
              </td>
              <td className="p-2 text-right font-mono hidden sm:table-cell">
                {b.capturedOdds?.toFixed(2) ?? "—"}
              </td>
              <td className="p-2 text-right font-mono">{b.actualOdds.toFixed(2)}</td>
              <td
                className={`p-2 text-right font-mono hidden sm:table-cell ${
                  b.slippagePct != null && b.slippagePct < -1
                    ? "text-red-400"
                    : b.slippagePct != null && b.slippagePct > 1
                      ? "text-emerald-400"
                      : ""
                }`}
              >
                {b.slippagePct != null ? `${b.slippagePct.toFixed(2)}%` : "—"}
              </td>
              <td
                className={`p-2 text-right font-mono hidden md:table-cell ${
                  b.edgePctTaken != null && b.edgePctTaken > 0
                    ? "text-emerald-400"
                    : b.edgePctTaken != null && b.edgePctTaken < 0
                      ? "text-red-400"
                      : ""
                }`}
              >
                {b.edgePctTaken != null
                  ? `${(b.edgePctTaken * 100).toFixed(2)}%`
                  : "—"}
              </td>
              <td
                className={`p-2 text-right font-mono hidden md:table-cell ${
                  b.clv != null && b.clv > 0
                    ? "text-emerald-400"
                    : b.clv != null && b.clv < 0
                      ? "text-red-400"
                      : ""
                }`}
              >
                {b.clv != null ? `${(b.clv * 100).toFixed(2)}%` : "—"}
              </td>
              <td className="p-2 text-right">€{b.stake.toFixed(2)}</td>
              <td className="p-2">
                <span
                  className={
                    b.result === "won"
                      ? "text-emerald-400"
                      : b.result === "lost"
                        ? "text-red-400"
                        : b.result === "void"
                          ? "text-muted-foreground"
                          : "text-amber-400"
                  }
                >
                  {b.result}
                </span>
              </td>
              <td
                className={`p-2 text-right font-mono ${
                  (b.pnl ?? 0) > 0 ? "text-emerald-400" : (b.pnl ?? 0) < 0 ? "text-red-400" : ""
                }`}
              >
                {b.pnl != null ? fmtMoney(b.pnl) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <div className="p-3 border-t border-border text-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-sm text-primary hover:underline"
          >
            Show all {filtered.length} bets ({hidden} more)
          </button>
        </div>
      )}
      {showAll && filtered.length > INITIAL_VISIBLE && (
        <div className="p-3 border-t border-border text-center">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-sm text-muted-foreground hover:underline"
          >
            Collapse
          </button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-muted/40 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
      >
        <option value="">all</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
