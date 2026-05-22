"use client";

import { useState } from "react";
import type { RealBet } from "@/lib/engine-data";

const INITIAL_VISIBLE = 50;

function fmtMoney(v: number) {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}€${Math.abs(v).toFixed(2)}`;
}

export function RealBetsLog({ bets }: { bets: RealBet[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? bets : bets.slice(0, INITIAL_VISIBLE);
  const hidden = bets.length - visible.length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="text-sm font-semibold">
          Bet log (newest first)
          {bets.length > INITIAL_VISIBLE && (
            <span className="text-muted-foreground font-normal ml-2">
              · showing {visible.length} of {bets.length}
            </span>
          )}
        </h2>
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
            <th className="text-right p-2">Stake</th>
            <th className="text-left p-2">Result</th>
            <th className="text-right p-2">PnL</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={10} className="p-4 text-center text-muted-foreground">
                No real bets logged yet.
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
            Show all {bets.length} bets ({hidden} more)
          </button>
        </div>
      )}
      {showAll && bets.length > INITIAL_VISIBLE && (
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
