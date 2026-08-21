"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Lock, TrendingUp, TrendingDown, Minus, Filter, ArrowUpDown } from "lucide-react";
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
  isLoggedIn: boolean;
  isElite: boolean;
}

type SortKey = "date_desc" | "date_asc" | "pnl_desc" | "pnl_asc" | "odds_desc" | "odds_asc";

const SORT_LABELS: Record<SortKey, string> = {
  date_desc: "Newest first",
  date_asc: "Oldest first",
  pnl_desc: "Biggest wins",
  pnl_asc: "Biggest losses",
  odds_desc: "Highest odds",
  odds_asc: "Lowest odds",
};

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

// ── Anonymous: simple 10-bet teaser ───────────────────────────────────────────

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

// ── Logged-in: full history with filters + sort ───────────────────────────────

function FullBetsTable({ bets, isElite }: { bets: FullBetItem[]; isElite: boolean }) {
  const [botFilter, setBotFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [showFilters, setShowFilters] = useState(false);

  // PERF-HISTORY-CROSSFILTER (2026-08-21): precompute a flat projection of
  // just (bot, market, league) once when `bets` changes, then derive each
  // dropdown's options from the projection filtered by the OTHER active
  // filters. Small tuples + a single pass per dropdown change keep this
  // <1ms even at 20K rows. Counts show next to each option so the user
  // can see how much data backs each choice before clicking.
  const projection = useMemo(
    () =>
      bets.map((b) => ({ bot: b.botName, market: b.market, league: b.league || "Unknown" })),
    [bets],
  );

  const buildOptions = (
    getter: (row: (typeof projection)[number]) => string,
    passesOthers: (row: (typeof projection)[number]) => boolean,
  ): Array<{ value: string; count: number }> => {
    const counts = new Map<string, number>();
    for (const r of projection) {
      if (!passesOthers(r)) continue;
      const v = getter(r);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  const availableBots = useMemo(
    () =>
      buildOptions(
        (r) => r.bot,
        (r) =>
          (marketFilter === "all" || r.market === marketFilter) &&
          (leagueFilter === "all" || r.league === leagueFilter),
      ),
    [projection, marketFilter, leagueFilter],
  );

  const availableMarkets = useMemo(
    () =>
      buildOptions(
        (r) => r.market,
        (r) =>
          (botFilter === "all" || r.bot === botFilter) &&
          (leagueFilter === "all" || r.league === leagueFilter),
      ),
    [projection, botFilter, leagueFilter],
  );

  const availableLeagues = useMemo(
    () =>
      buildOptions(
        (r) => r.league,
        (r) =>
          (botFilter === "all" || r.bot === botFilter) &&
          (marketFilter === "all" || r.market === marketFilter),
      ),
    [projection, botFilter, marketFilter],
  );

  // If a previously-selected value no longer exists in its dropdown after
  // the user changed a sibling filter, snap back to "all" so the user
  // isn't stuck with a filter that would show 0 rows.
  useEffect(() => {
    if (botFilter !== "all" && !availableBots.some((o) => o.value === botFilter)) setBotFilter("all");
  }, [availableBots, botFilter]);
  useEffect(() => {
    if (marketFilter !== "all" && !availableMarkets.some((o) => o.value === marketFilter)) setMarketFilter("all");
  }, [availableMarkets, marketFilter]);
  useEffect(() => {
    if (leagueFilter !== "all" && !availableLeagues.some((o) => o.value === leagueFilter)) setLeagueFilter("all");
  }, [availableLeagues, leagueFilter]);

  const filtered = useMemo(() => {
    const rows = bets.filter((b) => {
      if (botFilter !== "all" && b.botName !== botFilter) return false;
      if (marketFilter !== "all" && b.market !== marketFilter) return false;
      if (leagueFilter !== "all" && b.league !== leagueFilter) return false;
      return true;
    });
    const sorted = [...rows];
    switch (sortKey) {
      case "date_desc":
        sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case "date_asc":
        sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case "pnl_desc":
        sorted.sort((a, b) => b.pnl - a.pnl);
        break;
      case "pnl_asc":
        sorted.sort((a, b) => a.pnl - b.pnl);
        break;
      case "odds_desc":
        sorted.sort((a, b) => b.odds - a.odds);
        break;
      case "odds_asc":
        sorted.sort((a, b) => a.odds - b.odds);
        break;
    }
    return sorted;
  }, [bets, botFilter, marketFilter, leagueFilter, sortKey]);

  const settledFiltered = filtered.filter((b) => b.result !== "pending");
  const totalPnl = settledFiltered.reduce((s, b) => s + b.pnl, 0);
  const won = settledFiltered.filter((b) => b.result === "won").length;
  const activeFilterCount = [
    botFilter !== "all",
    marketFilter !== "all",
    leagueFilter !== "all",
  ].filter(Boolean).length;

  // PERF-HISTORY-DYNAMIC-ROI (2026-08-21): stake is null on the wire for
  // non-Elite users (Elite-only field on SanitizedBotBet). Recover it from
  // pnl + odds + result so the toolbar can show ROI for any filter slice.
  //   won:  pnl = stake * (odds - 1)  → stake = pnl / (odds - 1)
  //   lost: pnl = -stake              → stake = -pnl
  // Void bets (pnl = 0) get stake=0 and are excluded from ROI anyway.
  const totalStake = settledFiltered.reduce((s, b) => {
    if (b.stake != null) return s + b.stake;
    if (b.result === "won" && b.odds > 1) return s + b.pnl / (b.odds - 1);
    if (b.result === "lost") return s - b.pnl;
    return s;
  }, 0);
  const roi = totalStake > 0 ? (100 * totalPnl) / totalStake : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border/20">
        <button
          onClick={() => setShowFilters((f) => !f)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            showFilters || activeFilterCount > 0
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Filter className="h-3 w-3" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded bg-blue-500/20 px-1 text-[10px] font-semibold text-blue-400">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground">
          <ArrowUpDown className="h-3 w-3" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-transparent text-xs text-foreground focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k} className="bg-background">
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">
          {/* PERF-HISTORY-COUNTS (2026-08-21): match the subhead — show
              settled bets as the primary number so the ROI headline (settled-
              only) reconciles with the table's row count. Pending shown as
              a secondary "+ N pending" note only when non-zero.
              PERF-HISTORY-DYNAMIC-ROI (2026-08-21): ROI updates live with
              the filter selection — so filtering by "bot_v10_all" or
              "1x2 only" shows that slice's ROI right in the toolbar. */}
          {settledFiltered.length} settled
          {filtered.length > settledFiltered.length && (
            <span className="text-muted-foreground/60">
              {" + "}{filtered.length - settledFiltered.length} pending
            </span>
          )}
          {settledFiltered.length > 0 && (
            <>
              {" · "}
              <span className={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmt(totalPnl)}€
              </span>
              {roi != null && (
                <span className={`ml-1 ${roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  ({roi >= 0 ? "+" : ""}{roi.toFixed(2)}% ROI)
                </span>
              )}
              {" · "}
              {won}W {settledFiltered.length - won}L
            </>
          )}
        </span>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 px-5 py-3 border-b border-border/20 bg-muted/20 sm:flex sm:flex-wrap">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">League</label>
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="rounded border border-border/50 bg-background px-2 py-1 text-xs max-w-[180px] truncate"
            >
              <option value="all">All leagues</option>
              {availableLeagues.map((l) => (
                <option key={l.value} value={l.value}>{l.value} ({l.count})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Market</label>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="rounded border border-border/50 bg-background px-2 py-1 text-xs"
            >
              <option value="all">All markets</option>
              {availableMarkets.map((m) => (
                <option key={m.value} value={m.value}>{m.value} ({m.count})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Bot</label>
            <select
              value={botFilter}
              onChange={(e) => setBotFilter(e.target.value)}
              className="rounded border border-border/50 bg-background px-2 py-1 text-xs max-w-[180px] truncate"
            >
              <option value="all">All bots</option>
              {availableBots.map((b) => (
                <option key={b.value} value={b.value}>{b.value} ({b.count})</option>
              ))}
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setBotFilter("all"); setMarketFilter("all"); setLeagueFilter("all"); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors sm:self-center"
            >
              Clear all
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
              <th className="py-2.5 px-2 hidden md:table-cell">League</th>
              <th className="py-2.5 px-2">Bot</th>
              <th className="py-2.5 px-2">Market</th>
              <th className="py-2.5 px-2 text-right">Odds</th>
              {isElite && <th className="py-2.5 px-2 text-right">Stake</th>}
              {isElite && <th className="py-2.5 px-2 text-right">Close</th>}
              <th className="py-2.5 px-2 text-center">Result</th>
              <th className="py-2.5 px-2 text-right">P&L</th>
              <th className="py-2.5 pr-5 text-center">CLV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {filtered.slice(0, 200).map((b) => (
              <tr key={b.id} className="hover:bg-muted/20">
                <td className="py-2.5 pl-5 pr-2 text-muted-foreground whitespace-nowrap">
                  {new Date(b.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                </td>
                <td className="py-2.5 px-2 max-w-[160px] truncate font-medium" title={b.match}>{b.match}</td>
                <td className="py-2.5 px-2 max-w-[140px] truncate text-muted-foreground text-[11px] hidden md:table-cell" title={b.league}>
                  {b.league || "—"}
                </td>
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
          Showing 200 of {filtered.length} bets. Narrow the filters to see more.
        </div>
      )}

      {filtered.length === 0 && (
        <div className="border-t border-border/20 px-5 py-10 text-center text-sm text-muted-foreground">
          No bets match these filters.
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

export function PerformanceHistory({ fullBets, recentSettled, isLoggedIn, isElite }: Props) {
  // Default-open on the anonymous 10-bet view: page's whole pitch is "every
  // bet logged" — hiding the ledger behind a click contradicts it. Logged-in
  // users default collapsed because their fuller table is longer and might
  // drown the page. Loading state (fullBets === null while streaming) also
  // starts collapsed so we don't show an empty box.
  const [expanded, setExpanded] = useState(!isLoggedIn);
  const rootRef = useRef<HTMLDivElement>(null);

  // PERF-HISTORY-ANCHOR (2026-08-21): support /performance#history deep
  // links — auto-open the collapse + scroll into view so shared links land
  // on the ledger. Runs on mount and on hashchange (some SPAs rewrite hash
  // without a reload).
  useEffect(() => {
    const openIfMatch = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash !== "#history") return;
      setExpanded(true);
      // Wait a tick for the DOM to reflow before scrolling; the collapse
      // content mounts synchronously after setExpanded(true).
      requestAnimationFrame(() => {
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    openIfMatch();
    window.addEventListener("hashchange", openIfMatch);
    return () => window.removeEventListener("hashchange", openIfMatch);
  }, []);

  const isLoading = isLoggedIn && fullBets === null;
  const settledCount = fullBets?.filter((b) => b.result !== "pending").length ?? 0;

  const header = (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-muted/5 transition-colors"
    >
      <div>
        <h2 className="text-sm font-semibold">
          {isLoggedIn ? "Full Bet History" : "Recent Results"}
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isLoading
            ? "Loading full ledger…"
            : isLoggedIn
              ? `${settledCount} settled bets — matches the ROI headline · filter by league, market, bot`
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
    <div
      ref={rootRef}
      id="history"
      className="scroll-mt-16 rounded-xl border border-border/50 bg-card/60 overflow-hidden"
    >
      {header}

      {expanded && (
        <div className="border-t border-border/30">
          {isLoading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground animate-pulse">
              Loading bet history…
            </div>
          ) : isLoggedIn && fullBets ? (
            fullBets.length > 0 ? (
              <FullBetsTable bets={fullBets} isElite={isElite} />
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No settled bets yet.
              </div>
            )
          ) : recentSettled && recentSettled.length > 0 ? (
            <>
              <SimpleBetsTable bets={recentSettled} />
              {/* Sign-up upsell for anonymous — the paywall for filters/history
                  is now behind sign-up, not behind Pro (TIER-COLLAPSE 2026-06-24). */}
              <div className="border-t border-border/20 px-5 py-4 bg-blue-500/5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-foreground">See every bet, ever placed</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Sign up free to unlock the full ledger with league, market, and bot filters.
                    </p>
                  </div>
                  <Link
                    href="/signup"
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Sign up free
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
