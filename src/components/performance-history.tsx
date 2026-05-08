"use client";

import { useState, useMemo } from "react";
import { Lock, TrendingUp, TrendingDown, Minus, Filter } from "lucide-react";
import Link from "next/link";
import type { SimpleSettledBet } from "@/lib/engine-data";

export interface FullBetItem {
  id: string;
  match: string;
  league: string;
  date: string;
  market: string;
  selection: string;
  odds: number;
  stake: number | null;
  result: string;
  pnl: number;
  clvSign: "positive" | "negative" | "neutral" | null;
  clvExact: number | null;
  closingOdds: number | null;
  botName: string;
}

interface Props {
  fullBets: FullBetItem[] | null;
  recentSettled: SimpleSettledBet[] | null;
  isPro: boolean;
  isElite: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function pnlColor(n: number) {
  return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted-foreground";
}

function resultPill(r: string) {
  if (r === "won")
    return <span className="inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">W</span>;
  if (r === "lost")
    return <span className="inline-flex items-center rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">L</span>;
  return <span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">{r}</span>;
}

function ClvCell({ sign, exact }: { sign: "positive" | "negative" | "neutral" | null; exact: number | null }) {
  if (exact != null) {
    return (
      <span className={`font-mono tabular-nums ${exact > 0 ? "text-emerald-400" : exact < 0 ? "text-red-400" : "text-muted-foreground"}`}>
        {exact >= 0 ? "+" : ""}{(exact * 100).toFixed(1)}%
      </span>
    );
  }
  if (sign === "positive") return <TrendingUp className="h-3.5 w-3.5 text-emerald-400 mx-auto" />;
  if (sign === "negative") return <TrendingDown className="h-3.5 w-3.5 text-red-400/80 mx-auto" />;
  if (sign === "neutral") return <Minus className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />;
  return <span className="text-muted-foreground">—</span>;
}

// ── Free: simple 10-bet table ─────────────────────────────────────────────────

function SimpleBetsTable({ bets }: { bets: SimpleSettledBet[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="border-b border-border/20 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2.5 pl-5 pr-2">Date</th>
            <th className="py-2.5 px-2">Match</th>
            <th className="py-2.5 px-2">Market</th>
            <th className="py-2.5 pr-5 text-center">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          {bets.map((b) => (
            <tr key={b.id} className="hover:bg-muted/20">
              <td className="py-2.5 pl-5 pr-2 text-muted-foreground whitespace-nowrap">
                {new Date(b.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
              </td>
              <td className="py-2.5 px-2 max-w-[200px] truncate font-medium" title={b.match}>{b.match}</td>
              <td className="py-2.5 px-2 font-mono uppercase text-muted-foreground text-[10px] whitespace-nowrap">
                {b.market} · {b.selection}
              </td>
              <td className="py-2.5 pr-5 text-center">{resultPill(b.result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Pro+: full history with filters ──────────────────────────────────────────

function FullBetsTable({ bets, isElite }: { bets: FullBetItem[]; isElite: boolean }) {
  const [botFilter, setBotFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const bots = useMemo(() => {
    const names = new Set(bets.map((b) => b.botName));
    return Array.from(names).sort();
  }, [bets]);

  const markets = useMemo(() => {
    const names = new Set(bets.map((b) => b.market));
    return Array.from(names).sort();
  }, [bets]);

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (botFilter !== "all" && b.botName !== botFilter) return false;
      if (marketFilter !== "all" && b.market !== marketFilter) return false;
      return true;
    });
  }, [bets, botFilter, marketFilter]);

  const settledFiltered = filtered.filter((b) => b.result !== "pending");
  const totalPnl = settledFiltered.reduce((s, b) => s + b.pnl, 0);
  const won = settledFiltered.filter((b) => b.result === "won").length;

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/20">
        <button
          onClick={() => setShowFilters((f) => !f)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            showFilters ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Filter className="h-3 w-3" />
          Filters
        </button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} bets
          {settledFiltered.length > 0 && (
            <>
              {" · "}
              <span className={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmt(totalPnl)}€
              </span>
              {" · "}
              {won}W {settledFiltered.length - won}L
            </>
          )}
        </span>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 px-5 py-3 border-b border-border/20 bg-muted/20">
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Bot</label>
            <select
              value={botFilter}
              onChange={(e) => setBotFilter(e.target.value)}
              className="rounded border border-border/50 bg-background px-2 py-1 text-xs"
            >
              <option value="all">All bots</option>
              {bots.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Market</label>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="rounded border border-border/50 bg-background px-2 py-1 text-xs"
            >
              <option value="all">All markets</option>
              {markets.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {(botFilter !== "all" || marketFilter !== "all") && (
            <button
              onClick={() => { setBotFilter("all"); setMarketFilter("all"); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-border/20 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2.5 pl-5 pr-2">Date</th>
              <th className="py-2.5 px-2">Match</th>
              <th className="py-2.5 px-2">Bot</th>
              <th className="py-2.5 px-2">Market</th>
              <th className="py-2.5 px-2 text-right">Odds</th>
              {isElite && <th className="py-2.5 px-2 text-right">Stake</th>}
              {isElite && <th className="py-2.5 px-2 text-right">Close</th>}
              <th className="py-2.5 px-2 text-center">Result</th>
              <th className="py-2.5 px-2 text-right">P&L</th>
              <th className="py-2.5 pr-5 text-center">
                {isElite ? (
                  "CLV %"
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    CLV
                    <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-[8px] font-bold text-emerald-400">ELITE</span>
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {filtered.slice(0, 200).map((b) => (
              <tr key={b.id} className="hover:bg-muted/20">
                <td className="py-2.5 pl-5 pr-2 text-muted-foreground whitespace-nowrap">
                  {new Date(b.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                </td>
                <td className="py-2.5 px-2 max-w-[160px] truncate font-medium" title={b.match}>{b.match}</td>
                <td className="py-2.5 px-2 font-mono text-[10px] text-muted-foreground truncate max-w-[100px]">{b.botName}</td>
                <td className="py-2.5 px-2 font-mono uppercase text-muted-foreground text-[10px] whitespace-nowrap">
                  {b.market} · {b.selection}
                </td>
                <td className="py-2.5 px-2 text-right tabular-nums">{b.odds.toFixed(2)}</td>
                {isElite && (
                  <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                    {b.stake != null ? `€${b.stake.toFixed(2)}` : "—"}
                  </td>
                )}
                {isElite && (
                  <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                    {b.closingOdds != null ? b.closingOdds.toFixed(2) : "—"}
                  </td>
                )}
                <td className="py-2.5 px-2 text-center">{resultPill(b.result)}</td>
                <td className={`py-2.5 px-2 text-right tabular-nums ${b.result !== "pending" ? pnlColor(b.pnl) : "text-muted-foreground"}`}>
                  {b.result !== "pending" ? fmt(b.pnl) : "—"}
                </td>
                <td className="py-2.5 pr-5 text-center">
                  <ClvCell sign={b.clvSign} exact={b.clvExact} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 200 && (
        <div className="border-t border-border/20 px-5 py-3 text-center text-xs text-muted-foreground">
          Showing 200 of {filtered.length} bets. Use filters to narrow down.
        </div>
      )}

      <div className="border-t border-border/20 px-5 py-3 text-center">
        <p className="text-[11px] text-muted-foreground/50">
          Every bet shown — wins and losses. No cherry-picking.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PerformanceHistory({ fullBets, recentSettled, isPro, isElite }: Props) {
  const [expanded, setExpanded] = useState(false);

  const header = (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-muted/5 transition-colors"
    >
      <div>
        <h2 className="text-sm font-semibold">
          {isPro ? "Bet History" : "Recent Results"}
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isPro
            ? `${fullBets?.length ?? 0} settled bets — full history`
            : `Last ${recentSettled?.length ?? 0} settled bets — no cherry-picking`}
        </p>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      {header}

      {expanded && (
        <div className="border-t border-border/30">
          {isPro && fullBets ? (
            <FullBetsTable bets={fullBets} isElite={isElite} />
          ) : recentSettled && recentSettled.length > 0 ? (
            <>
              <SimpleBetsTable bets={recentSettled} />
              {/* Upsell */}
              <div className="border-t border-border/20 px-5 py-4 bg-blue-500/5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-foreground">Full bet history with odds & P&L</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pro shows up to 500 bets with odds, P&L, CLV direction, and bot/market filters.
                    </p>
                  </div>
                  <Link
                    href="/how-it-works"
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Upgrade to Pro
                    </span>
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No settled bets yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
