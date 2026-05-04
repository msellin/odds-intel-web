"use client";

import { useState, useMemo } from "react";
import { Target, Info, Lock } from "lucide-react";
import { BetExplainButton } from "@/components/bet-explain-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LiveBet } from "@/lib/engine-data";

interface ValueBetsLiveProps {
  bets: (LiveBet & { botCount: number })[];
  totalCount: number; // deduplicated count — used for stats + locked row count
  userTier: "free" | "pro" | "elite";
}

const ALL = "__all__";

function formatEdge(edge: number): string {
  return (edge * 100).toFixed(1);
}

function edgeColor(edge: number): string {
  const pct = edge * 100;
  if (pct >= 10) return "text-emerald-500";
  if (pct >= 5) return "text-amber-500";
  return "text-muted-foreground";
}

function edgeLabel(edge: number): { label: string; color: string } {
  const pct = edge * 100;
  if (pct >= 10) return { label: "Strong", color: "text-emerald-500" };
  if (pct >= 5) return { label: "Moderate", color: "text-amber-500" };
  return { label: "Marginal", color: "text-muted-foreground" };
}

function ResultBadge({ result }: { result: string }) {
  if (result === "won")
    return (
      <Badge variant="outline" className="text-[10px] font-semibold uppercase border-emerald-500/50 bg-emerald-500/10 text-emerald-500">
        Won
      </Badge>
    );
  if (result === "lost")
    return (
      <Badge variant="outline" className="text-[10px] font-semibold uppercase border-red-500/50 bg-red-500/10 text-red-500">
        Lost
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
      {result}
    </Badge>
  );
}

function TierBadge({ tier }: { tier: "pro" | "elite" }) {
  return tier === "elite" ? (
    <span className="rounded bg-amber-500/10 px-1 py-0.5 font-bold text-amber-400" style={{ fontSize: 9 }}>
      ELITE
    </span>
  ) : (
    <span className="rounded bg-blue-500/10 px-1 py-0.5 font-bold text-blue-400" style={{ fontSize: 9 }}>
      PRO
    </span>
  );
}

function LockedCell({ tier }: { tier: "pro" | "elite" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px]",
      tier === "elite"
        ? "border-amber-500/20 bg-amber-500/5 text-amber-400/50"
        : "border-blue-500/20 bg-blue-500/5 text-blue-400/50"
    )}>
      <Lock className="h-2.5 w-2.5" />
      hidden
    </span>
  );
}

function formatBot(bot: string): string {
  return bot.replace("bot_", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ValueBetsLive({ bets, totalCount, userTier }: ValueBetsLiveProps) {
  const [league, setLeague] = useState(ALL);
  const [bot, setBot] = useState(ALL);

  const isPro = userTier === "pro" || userTier === "elite";
  const isElite = userTier === "elite";

  const leagues = useMemo(
    () => Array.from(new Set(bets.map((b) => b.league))).sort(),
    [bets]
  );

  const bots = useMemo(
    () => Array.from(new Set(bets.map((b) => b.bot))).sort(),
    [bets]
  );

  const filtered = useMemo(() => {
    if (userTier === "free") return bets; // only 1 bet received from server
    return bets.filter((b) => {
      if (league !== ALL && b.league !== league) return false;
      if (bot !== ALL && b.bot !== bot) return false;
      return true;
    });
  }, [bets, league, bot, userTier]);

  const topBet = filtered[0] ?? null;
  const lockedRows = filtered.slice(1);
  const lockedCount = userTier === "free" ? totalCount - bets.length : 0;

  const highEdge = filtered.filter((b) => b.edge * 100 >= 10).length;
  const modEdge = filtered.filter((b) => b.edge * 100 >= 5 && b.edge * 100 < 10).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">Value Bets</h1>
          <Badge variant="secondary" className="font-mono text-xs">{bets.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {isElite
            ? "Today's picks ranked by edge — placed by the engine when it finds value."
            : isPro
            ? "Today's directional picks. Upgrade to Elite for exact odds, model probabilities, and stake sizing."
            : "AI-identified value bets placed by the engine today. Free accounts see 1 pick per day."}
        </p>
      </div>

      {/* Stats — pro/elite only */}
      {isPro && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total bets</p>
            <p className="font-mono text-2xl font-bold">{filtered.length}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Strong edge (10%+)</p>
            <p className="font-mono text-2xl font-bold text-emerald-500">{highEdge}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Moderate edge (5–10%)</p>
            <p className="font-mono text-2xl font-bold text-amber-500">{modEdge}</p>
          </div>
        </div>
      )}

      {/* Filters — pro/elite only */}
      {isPro && (
        <div className="flex flex-wrap items-center gap-3">
          <Select value={league} onValueChange={(v) => setLeague(v ?? ALL)}>
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <SelectValue>{league === ALL ? "All leagues" : league}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All leagues</SelectItem>
              {leagues.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isElite && (
            <Select value={bot} onValueChange={(v) => setBot(v ?? ALL)}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue>{bot === ALL ? "All strategies" : formatBot(bot)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All strategies</SelectItem>
                {bots.map((b) => (
                  <SelectItem key={b} value={b}>{formatBot(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filtered.length !== bets.length && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {bets.length} shown
            </span>
          )}
        </div>
      )}

      {/* Table */}
      {bets.length === 0 ? (
        <div className="rounded-lg border border-border/50 bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No bets placed today. The model runs at 06:00 UTC — check back later.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="border-b border-border/30 bg-card/40">
                  <th className="py-2 pl-4 pr-2 text-left font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Match</th>
                  <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Market</th>
                  <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Selection</th>
                  <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Edge</th>
                  {/* Odds — Pro locked for free, Elite locked for pro */}
                  <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-[10px]">
                    {isElite ? (
                      <span className="text-muted-foreground">Odds</span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-blue-400/70">
                        <Lock className="h-2.5 w-2.5" />
                        Odds
                        <TierBadge tier={isPro ? "elite" : "pro"} />
                      </span>
                    )}
                  </th>
                  {/* Model prob — Elite only */}
                  <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-[10px]">
                    {isElite ? (
                      <span className="flex items-center justify-center gap-1 text-muted-foreground cursor-default group relative">
                        Model prob
                        <Info className="h-3 w-3 text-muted-foreground/40" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 z-50 mb-2 w-56 rounded-lg border border-border/60 bg-popover p-3 text-left text-xs text-muted-foreground font-normal opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                          Our model&apos;s estimated probability for this outcome.
                        </span>
                      </span>
                    ) : (
                      <span className={cn("flex items-center justify-center gap-1", isPro ? "text-amber-400/70" : "text-blue-400/70")}>
                        <Lock className="h-2.5 w-2.5" />
                        Model prob
                        <TierBadge tier="elite" />
                      </span>
                    )}
                  </th>
                  {/* Stake — Elite only */}
                  <th className="py-2 px-2 text-center font-medium uppercase tracking-wider text-[10px]">
                    {isElite ? (
                      <span className="text-muted-foreground">Stake</span>
                    ) : (
                      <span className={cn("flex items-center justify-center gap-1", isPro ? "text-amber-400/70" : "text-blue-400/70")}>
                        <Lock className="h-2.5 w-2.5" />
                        Stake
                        <TierBadge tier="elite" />
                      </span>
                    )}
                  </th>
                  <th className="py-2 pl-2 pr-4 text-center font-medium uppercase tracking-wider text-muted-foreground text-[10px]">Result</th>
                  {isElite && <th className="py-2 pl-2 pr-4 text-[10px]" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {/* Top bet — always fully visible */}
                {topBet && <BetRow bet={topBet} isPro={isPro} isElite={isElite} isFreeHighlight={!isPro} />}

                {/* Remaining rows — Pro: real data; Free: fake placeholders (no real data sent) */}
                {isPro
                  ? lockedRows.map((bet) => (
                      <BetRow key={bet.id} bet={bet} isPro={isPro} isElite={isElite} />
                    ))
                  : Array.from({ length: Math.min(lockedCount, 4) }).map((_, i) => (
                      <tr key={i} className="pointer-events-none select-none blur-[3px] opacity-50" aria-hidden>
                        <td className="py-3 pl-4 pr-2">
                          <div className="h-3 w-36 rounded bg-muted-foreground/20 mb-1" />
                          <div className="h-2 w-24 rounded bg-muted-foreground/10" />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="mx-auto h-4 w-10 rounded bg-muted-foreground/20" />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="mx-auto h-4 w-14 rounded bg-muted-foreground/20" />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="mx-auto h-4 w-12 rounded bg-muted-foreground/20" />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="mx-auto h-4 w-10 rounded bg-muted-foreground/20" />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="mx-auto h-4 w-10 rounded bg-muted-foreground/20" />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="mx-auto h-4 w-8 rounded bg-muted-foreground/20" />
                        </td>
                        <td className="py-3 pl-2 pr-4 text-center">
                          <div className="mx-auto h-4 w-12 rounded bg-muted-foreground/20" />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t border-border/30 bg-card/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {!isPro ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  <Lock className="inline h-3 w-3 mr-1 text-muted-foreground/50" />
                  {lockedCount} more bet{lockedCount !== 1 ? "s" : ""} today — Pro unlocks all picks with direction and edge tier. Elite adds exact odds, model probabilities, and Kelly sizing.
                </p>
                <a
                  href="/profile"
                  className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Upgrade to Pro — €4.99/mo
                </a>
              </>
            ) : !isElite ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Elite unlocks exact odds, model probabilities, and Kelly stake sizing for every pick.
                </p>
                <span className="shrink-0 rounded-md border border-amber-500/20 px-3 py-1.5 text-[11px] font-medium text-amber-400/50 cursor-default">
                  Elite — Coming Soon
                </span>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                CLV and closing odds are revealed after each match settles.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single row component ─────────────────────────────────────────────────────

function BetRow({
  bet,
  isPro,
  isElite,
  isFreeHighlight = false,
}: {
  bet: LiveBet & { botCount: number };
  isPro: boolean;
  isElite: boolean;
  isFreeHighlight?: boolean;
}) {
  const { label, color } = edgeLabel(bet.edge);

  return (
    <tr className={cn(
      "hover:bg-muted/5 transition-colors",
      bet.edge * 100 >= 10 && "bg-emerald-500/5",
      isFreeHighlight && "ring-1 ring-inset ring-emerald-500/20"
    )}>
      {/* Match */}
      <td className="py-3 pl-4 pr-2">
        <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
            {isFreeHighlight && (
              <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
                Free pick
              </span>
            )}
            {isElite && bet.botCount > 1 && (
              <span className="shrink-0 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                {bet.botCount} bots
              </span>
            )}
          </div>
        <p className="font-medium text-foreground/90 truncate max-w-[200px] mt-0.5">{bet.match}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">{bet.league}</p>
      </td>

      {/* Market */}
      <td className="py-3 px-2 text-center">
        <Badge variant="outline" className="text-[10px]">{bet.market}</Badge>
      </td>

      {/* Selection */}
      <td className="py-3 px-2 text-center">
        <span className="rounded bg-white/[0.06] px-2 py-0.5 font-medium">{bet.selection}</span>
      </td>

      {/* Edge — exact % for elite and free pick; label only for pro rows */}
      <td className="py-3 px-2 text-center">
        {isElite || isFreeHighlight ? (
          <span className={cn("font-mono font-bold", edgeColor(bet.edge))}>
            +{formatEdge(bet.edge)}%
          </span>
        ) : (
          <span className={cn("font-semibold text-xs", color)}>{label}</span>
        )}
      </td>

      {/* Odds — visible to free for their 1 pick, locked for pro rows (elite-only column) */}
      <td className="py-3 px-2 text-center">
        {isElite || isFreeHighlight ? (
          <span className="font-mono font-bold">{bet.odds.toFixed(2)}</span>
        ) : isPro ? (
          <LockedCell tier="elite" />
        ) : (
          <LockedCell tier="pro" />
        )}
      </td>

      {/* Model prob */}
      <td className="py-3 px-2 text-center">
        {isElite ? (
          <span className="font-mono">{(bet.modelProb * 100).toFixed(1)}%</span>
        ) : (
          <LockedCell tier="elite" />
        )}
      </td>

      {/* Stake */}
      <td className="py-3 px-2 text-center">
        {isElite ? (
          <span className="font-mono">{bet.stake.toFixed(1)}</span>
        ) : (
          <LockedCell tier="elite" />
        )}
      </td>

      {/* Result */}
      <td className="py-3 pl-2 pr-4 text-center">
        <ResultBadge result={bet.result} />
      </td>

      {/* Explain — Elite only */}
      {isElite && (
        <td className="py-3 pl-2 pr-4">
          <BetExplainButton betId={bet.id} />
        </td>
      )}
    </tr>
  );
}
