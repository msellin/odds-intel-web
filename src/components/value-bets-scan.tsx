"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Target, TrendingDown, TrendingUp, Minus, X, Lock, Info, ChevronDown } from "lucide-react";
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
import type { LiveBet, BookOddsEntry } from "@/lib/engine-data";

interface ValueBetsScanProps {
  bets: (LiveBet & { botCount: number })[];
  totalCount: number;
  userTier: "free" | "pro" | "elite";
  oddsVerifiedAt?: string | null;
  bookOdds?: Record<string, BookOddsEntry>;
  botRecentRoi?: Record<string, { roi: number; settled: number }>;
}

const ALL = "__all__";
const BANNER_KEY = "vb_scan_banner_v1";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getBestNow(entry: BookOddsEntry): { name: string; odds: number } | null {
  const candidates = [
    entry.bet365 != null ? { name: "Bet365", odds: entry.bet365 } : null,
    entry.unibet != null ? { name: "Unibet", odds: entry.unibet } : null,
    entry.pinnacle != null ? { name: "Pinnacle", odds: entry.pinnacle } : null,
  ].filter((c): c is { name: string; odds: number } => c !== null);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (a.odds >= b.odds ? a : b));
}

// Edge formula: cal_prob - (1/odds) — same as betting pipeline
function computeLiveEdge(modelProb: number, entry: BookOddsEntry | undefined): number | null {
  if (!entry || modelProb <= 0) return null;
  const best = getBestNow(entry);
  if (!best) return null;
  return modelProb - 1 / best.odds;
}

function edgeColorClass(edge: number): string {
  const pct = edge * 100;
  if (pct >= 10) return "text-emerald-500";
  if (pct >= 5) return "text-amber-500";
  return "text-muted-foreground";
}

function fmtEdge(edge: number): string {
  return `+${(edge * 100).toFixed(1)}%`;
}

// Asian handicap: flip away sign to match standard notation
function fmtSelection(market: string, selection: string): string {
  if (!selection) return "";
  if (market === "asian_handicap") {
    const m = selection.match(/^(away)\s+([+-]?\d+\.?\d*)$/i);
    if (m) {
      const num = parseFloat(m[2]);
      if (num !== 0) return `Away ${num > 0 ? `-${num}` : `+${Math.abs(num)}`}`;
    }
    return selection.replace(/_/g, " ");
  }
  const labels: Record<string, string> = {
    home: "Home win", draw: "Draw", away: "Away win",
    over: "Over 2.5", under: "Under 2.5",
    home_or_draw: "Home/Draw", home_or_away: "Home/Away", draw_or_away: "Draw/Away",
  };
  return labels[selection] ?? selection.replace(/_/g, " ");
}

function fmtMarket(market: string): string {
  const labels: Record<string, string> = {
    "1x2": "1×2", "o/u": "O/U 2.5", double_chance: "DC",
    asian_handicap: "AH", btts: "BTTS", dnb: "DNB",
  };
  return labels[market] ?? market;
}

function fmtPickLine(market: string, selection: string, isElite: boolean): string {
  if (!isElite || !selection) return fmtMarket(market);
  const sel = fmtSelection(market, selection);
  // Only append market suffix when it adds info
  const suffixes: Record<string, string> = {
    double_chance: " · DC", asian_handicap: " · AH", btts: " · BTTS", dnb: " · DNB",
  };
  return sel + (suffixes[market] ?? "");
}

function fmtKoTime(kickoff: string): string {
  const mins = Math.round((new Date(kickoff).getTime() - Date.now()) / 60000);
  if (mins <= 0) return "LIVE";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function urgency(kickoff: string, result: string, mounted: boolean) {
  if (!mounted || result !== "pending") {
    return { gutter: "border-l-border/20", timeColor: "text-muted-foreground", isLive: false };
  }
  const ms = new Date(kickoff).getTime() - Date.now();
  if (ms <= 0)  return { gutter: "border-l-red-500 animate-pulse", timeColor: "text-red-400 font-semibold", isLive: true };
  if (ms < 3_600_000)   return { gutter: "border-l-red-500",        timeColor: "text-red-400 font-semibold", isLive: false };
  if (ms < 7_200_000)   return { gutter: "border-l-amber-500",      timeColor: "text-amber-500",             isLive: false };
  return { gutter: "border-l-emerald-500/40", timeColor: "text-muted-foreground", isLive: false };
}

function lineDrift(entry: BookOddsEntry | undefined, postOdds: number, result: string) {
  if (result !== "pending" || !entry || postOdds <= 0) return null;
  const best = getBestNow(entry);
  if (!best) return null;
  const pct = ((best.odds - postOdds) / postOdds) * 100;
  if (pct <= -1.5) return { dir: "shorter" as const, pct };
  if (pct >= 1.5)  return { dir: "drifted" as const, pct };
  return { dir: "steady" as const, pct };
}

function bookmakerUrl(name: string | null | undefined): string {
  const urls: Record<string, string> = {
    Unibet: "https://www.unibet.com",
    Bet365: "https://www.bet365.com",
    Pinnacle: "https://www.pinnacle.com",
    Marathonbet: "https://www.marathonbet.com",
    Coolbet: "https://www.coolbet.com",
  };
  return (name && urls[name]) ?? "#";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FreshnessChip({ verifiedAt }: { verifiedAt: string }) {
  const ageMin = Math.floor((Date.now() - new Date(verifiedAt).getTime()) / 60000);
  const [label, cls] =
    ageMin < 45 ? [`${ageMin}m ago`, "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"]
    : ageMin < 90 ? [ageMin >= 60 ? `${Math.floor(ageMin / 60)}h ${ageMin % 60}m ago` : `${ageMin}m ago`, "text-amber-500 border-amber-500/20 bg-amber-500/10"]
    : [`${Math.floor(ageMin / 60)}h ago — check`, "text-red-500 border-red-500/20 bg-red-500/10"];
  return (
    <span suppressHydrationWarning className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", cls)}>
      Odds verified {label}
    </span>
  );
}

function ConsensusDots({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span title={`${count} strategies agree`} className="shrink-0 text-[9px] text-blue-400/70 tracking-widest leading-none">
      {"●".repeat(Math.min(count, 5))}
    </span>
  );
}

function DriftIcon({ dir }: { dir: "shorter" | "drifted" | "steady" | null }) {
  if (!dir || dir === "steady") return <Minus className="h-3 w-3 text-muted-foreground/30" />;
  if (dir === "shorter") return <TrendingDown className="h-3 w-3 text-emerald-500" />;
  return <TrendingUp className="h-3 w-3 text-blue-400" />;
}

// Probability bar: [market░░░░░░░ edge-gap model] with labels
function EdgeBar({ modelProb, liveImplied }: { modelProb: number; liveImplied: number }) {
  const mPct = Math.round(modelProb * 100);
  const iPct = Math.round(liveImplied * 100);
  const ePct = mPct - iPct;
  const fairOdds = (1 / modelProb).toFixed(2);

  return (
    <div>
      <div className="flex justify-between text-[11px] font-medium mb-1.5">
        <span className="text-emerald-400">{mPct}% model</span>
        <span className="text-muted-foreground">{iPct}% market</span>
      </div>
      <div className="relative h-3.5 rounded-full bg-muted/20 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-white/[0.07] rounded-full" style={{ width: `${iPct}%` }} />
        <div className="absolute inset-y-0 rounded-full bg-emerald-500/50" style={{ left: `${iPct}%`, width: `${ePct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground/50 mt-1.5">
        Fair price {fairOdds} · the gap between model probability and market-implied probability is the edge.
      </p>
    </div>
  );
}

// ─── Expanded panel ───────────────────────────────────────────────────────────

function ExpandedPanel({
  bet,
  isPro,
  isElite,
  entry,
  mounted,
}: {
  bet: LiveBet & { botCount: number };
  isPro: boolean;
  isElite: boolean;
  entry?: BookOddsEntry;
  mounted: boolean;
}) {
  const best = entry ? getBestNow(entry) : null;
  const liveEdge = computeLiveEdge(bet.modelProb, entry);
  const liveImplied = best ? 1 / best.odds : bet.impliedProb;
  const drift = lineDrift(entry, bet.odds, bet.result);
  const hasModelData = isElite && bet.modelProb > 0;

  // KO timing signal
  const koSignal = (() => {
    if (!mounted || bet.result !== "pending") return null;
    const ms = new Date(bet.kickoff).getTime() - Date.now();
    const hrs = ms / 3_600_000;
    if (hrs <= 0) return null;
    const label = fmtKoTime(bet.kickoff);
    return hrs < 2
      ? `${label} to kickoff — price may still move, act soon.`
      : `${label} to kickoff — price likely to tighten closer to KO.`;
  })();

  return (
    <div className="px-4 pt-3 pb-4 border-t border-border/20 bg-card/20 space-y-3.5">

      {/* EdgeBar + table — Elite only */}
      {hasModelData ? (
        <div className="space-y-3">
          <EdgeBar modelProb={bet.modelProb} liveImplied={liveImplied} />
          <table className="w-full text-[12px]">
            <tbody className="divide-y divide-border/20">
              <tr>
                <td className="py-1.5 text-muted-foreground">Model win probability</td>
                <td className="py-1.5 text-right font-medium text-emerald-400">{(bet.modelProb * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="py-1.5 text-muted-foreground">Market implied{best ? " (live)" : " (at post)"}</td>
                <td className="py-1.5 text-right font-medium">{(liveImplied * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td className="py-1.5 text-muted-foreground">Edge{liveEdge !== null && bet.odds > 0 ? " (live)" : " (at post)"}</td>
                <td className="py-1.5 text-right font-medium text-emerald-400">
                  {fmtEdge(liveEdge ?? bet.edge)}
                  {liveEdge !== null && bet.odds > 0 && Math.abs(liveEdge - bet.edge) > 0.003 && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground/50">was {fmtEdge(bet.edge)} at post</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-muted-foreground">
                  Suggested stake
                  <span
                    title="We use a conservative Kelly fraction (0.15) to protect bankroll during variance."
                    className="ml-1 cursor-help border-b border-dotted border-muted-foreground/30"
                  >
                    (fractional Kelly · 0.15) ⓘ
                  </span>
                </td>
                <td className="py-1.5 text-right font-medium font-mono">{bet.stake.toFixed(1)}u</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : isPro ? (
        <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/70">Model probability, fair odds and stake sizing</span>
          {" "}are available on Elite.{" "}
          <a href="/profile" className="text-amber-400 hover:text-amber-300">Upgrade →</a>
        </div>
      ) : null}

      {/* Supporting signals */}
      <div className="space-y-2.5">
        {/* Line movement */}
        {mounted && drift && drift.dir !== "steady" && best && bet.odds > 0 && (
          <div className="flex gap-2.5 items-start">
            {drift.dir === "shorter"
              ? <TrendingDown className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              : <TrendingUp className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
            }
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {drift.dir === "shorter"
                ? `Market moved from ${bet.odds.toFixed(2)} → ${best.odds.toFixed(2)} since we posted — money is moving to our side. Validates the pick, but edge has shrunk.`
                : `Odds drifted from ${bet.odds.toFixed(2)} → ${best.odds.toFixed(2)} since posting — edge has improved.`
              }
            </p>
          </div>
        )}

        {/* Ensemble */}
        {bet.botCount > 1 && (
          <div className="flex gap-2.5 items-start">
            <span className="text-[10px] text-blue-400/70 mt-0.5 shrink-0 tracking-widest">
              {"●".repeat(Math.min(bet.botCount, 4))}
            </span>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {bet.botCount} independent strategies all rate this pick above market.
            </p>
          </div>
        )}

        {/* Timing */}
        {koSignal && (
          <div className="flex gap-2.5 items-start">
            <Info className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
            <p className="text-[12px] text-muted-foreground leading-relaxed">{koSignal}</p>
          </div>
        )}
      </div>

      {/* Elite: LLM narrative via existing explain route */}
      {isElite && (
        <div>
          <BetExplainButton betId={bet.id} />
        </div>
      )}

      {/* Action row */}
      {(isPro || isElite) && (
        <a
          href={bookmakerUrl(best?.name ?? bet.recommendedBookmaker)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
        >
          Bet at {best?.name ?? bet.recommendedBookmaker ?? "bookmaker"}
          <span className="text-[11px] opacity-60">↗</span>
        </a>
      )}
    </div>
  );
}

// ─── Single scan row ──────────────────────────────────────────────────────────

function ValueBetRow({
  bet,
  isPro,
  isElite,
  entry,
  expanded,
  onToggle,
}: {
  bet: LiveBet & { botCount: number };
  isPro: boolean;
  isElite: boolean;
  entry?: BookOddsEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const best = entry ? getBestNow(entry) : null;
  const liveEdge = computeLiveEdge(bet.modelProb, entry);
  const displayEdge = liveEdge !== null ? liveEdge : bet.edge;
  const drift = lineDrift(entry, bet.odds, bet.result);
  const { gutter, timeColor, isLive } = urgency(bet.kickoff, bet.result, mounted);
  const pickLine = fmtPickLine(bet.market, bet.selection, isElite);

  // Odds display: live best if available, else posting odds+book
  const oddsLine = (() => {
    if (best) {
      const stake = isElite && bet.stake > 0 ? ` · ${bet.stake.toFixed(1)}u` : "";
      return `${best.odds.toFixed(2)} ${best.name}${stake}`;
    }
    if (isElite && bet.odds > 0 && bet.recommendedBookmaker) {
      return `${bet.odds.toFixed(2)} ${bet.recommendedBookmaker}`;
    }
    return null;
  })();

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full text-left border-l-[3px] transition-colors",
          gutter,
          expanded ? "bg-muted/20" : "hover:bg-muted/10",
        )}
      >
        <div className="flex items-center gap-3 px-3 py-3">

          {/* Edge — hero number */}
          <div className="shrink-0 w-[54px] text-right">
            <span className={cn("font-mono font-bold text-[15px] leading-none", edgeColorClass(displayEdge))}>
              {fmtEdge(displayEdge)}
            </span>
          </div>

          {/* Center: match + pick + odds */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground/90 truncate leading-tight">
              {bet.match.replace(" vs ", " — ")}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="truncate">{pickLine}</span>
              <ConsensusDots count={bet.botCount} />
            </div>
            {oddsLine && (
              <p className="text-[11px] text-muted-foreground/60">{oddsLine}</p>
            )}
          </div>

          {/* Right: KO time + drift + chevron */}
          <div className="shrink-0 flex flex-col items-end gap-1 min-w-[36px]">
            {isLive ? (
              <span className="text-[11px] font-bold text-red-400 animate-pulse">LIVE</span>
            ) : (
              <span suppressHydrationWarning className={cn("text-[12px] tabular-nums", timeColor)}>
                {mounted ? fmtKoTime(bet.kickoff) : ""}
              </span>
            )}
            <div className="flex items-center gap-0.5">
              <DriftIcon dir={mounted ? (drift?.dir ?? null) : null} />
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground/30 transition-transform", expanded && "rotate-180")} />
            </div>
          </div>

        </div>
      </button>

      {/* Inline expanded panel */}
      {expanded && (
        <ExpandedPanel
          bet={bet}
          isPro={isPro}
          isElite={isElite}
          entry={entry}
          mounted={mounted}
        />
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ValueBetsScan({
  bets,
  totalCount,
  userTier,
  oddsVerifiedAt,
  bookOdds,
}: ValueBetsScanProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [league, setLeague] = useState(ALL);
  const [edgeFilter, setEdgeFilter] = useState<"all" | "strong" | "moderate">("all");

  const isPro = userTier === "pro" || userTier === "elite";
  const isElite = userTier === "elite";

  useEffect(() => {
    setBannerDismissed(!!localStorage.getItem(BANNER_KEY));
  }, []);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(BANNER_KEY, "1");
    setBannerDismissed(true);
  }, []);

  const leagues = useMemo(
    () => Array.from(new Set(bets.map((b) => b.league))).sort((a, b) => a.localeCompare(b)),
    [bets],
  );

  const filtered = useMemo(() => {
    if (userTier === "free") return bets;
    return bets.filter((b) => {
      if (league !== ALL && b.league !== league) return false;
      if (edgeFilter === "strong" && b.edge * 100 < 10) return false;
      if (edgeFilter === "moderate" && (b.edge * 100 < 5 || b.edge * 100 >= 10)) return false;
      return true;
    });
  }, [bets, league, edgeFilter, userTier]);

  const strongCount = bets.filter((b) => b.edge * 100 >= 10).length;
  const modCount = bets.filter((b) => b.edge * 100 >= 5 && b.edge * 100 < 10).length;
  const lockedCount = totalCount - bets.length;

  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Target className="h-4 w-4 text-primary shrink-0" />
        <h1 className="text-lg font-bold tracking-tight">Value Bets</h1>
        <Badge variant="secondary" className="font-mono text-xs">
          {userTier === "free" ? `1 of ${totalCount}` : filtered.length}
        </Badge>
        {oddsVerifiedAt && <FreshnessChip verifiedAt={oddsVerifiedAt} />}
      </div>

      {/* Tier filter pills — color-coded */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setEdgeFilter("all")}
          className={cn(
            "rounded-full px-3 py-1 text-xs border transition-colors",
            edgeFilter === "all"
              ? "bg-muted/40 border-border/60 text-foreground"
              : "border-border/30 text-muted-foreground hover:bg-muted/20",
          )}
        >
          All {totalCount}
        </button>
        {strongCount > 0 && (
          <button
            onClick={() => setEdgeFilter(edgeFilter === "strong" ? "all" : "strong")}
            className={cn(
              "rounded-full px-3 py-1 text-xs border transition-colors",
              edgeFilter === "strong"
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20",
            )}
          >
            ● {strongCount} strong 10%+
          </button>
        )}
        {modCount > 0 && (
          <button
            onClick={() => setEdgeFilter(edgeFilter === "moderate" ? "all" : "moderate")}
            className={cn(
              "rounded-full px-3 py-1 text-xs border transition-colors",
              edgeFilter === "moderate"
                ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20",
            )}
          >
            ● {modCount} moderate 5–10%
          </button>
        )}
      </div>

      {/* League filter (Pro+) */}
      {isPro && leagues.length > 1 && (
        <Select value={league} onValueChange={(v) => setLeague(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="Filter by league">
            <SelectValue>{league === ALL ? "All leagues" : league}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All leagues</SelectItem>
            {leagues.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* First-visit banner */}
      {!bannerDismissed && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
          <span>{totalCount} bets sorted by edge · tap any row to see the math</span>
          <button onClick={dismissBanner} className="shrink-0 hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Scan list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/50 bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No bets match this filter.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden divide-y divide-border/20">
          {filtered.map((bet) => (
            <ValueBetRow
              key={bet.id}
              bet={bet}
              isPro={isPro}
              isElite={isElite}
              entry={bookOdds?.[bet.id]}
              expanded={expandedId === bet.id}
              onToggle={() => toggle(bet.id)}
            />
          ))}

          {/* Free: blurred locked rows + upgrade CTA */}
          {userTier === "free" && lockedCount > 0 && (
            <>
              {Array.from({ length: Math.min(lockedCount, 3) }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="flex items-center gap-3 px-3 py-3 border-l-[3px] border-l-emerald-500/40 blur-[3px] opacity-25 pointer-events-none select-none"
                >
                  <div className="w-[54px] flex justify-end">
                    <div className="h-4 w-11 rounded bg-emerald-500/30" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-44 rounded bg-muted-foreground/20" />
                    <div className="h-2.5 w-28 rounded bg-muted-foreground/15" />
                  </div>
                  <div className="h-3 w-6 rounded bg-muted-foreground/20" />
                </div>
              ))}
              <div className="px-4 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    <Lock className="inline h-3.5 w-3.5 mr-1 text-amber-400" />
                    {lockedCount} more bets today
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Sign up free to unlock 1 daily pick
                  </p>
                </div>
                <a
                  href="/signup"
                  className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  Sign up free
                </a>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
