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
import {
  displayProb,
  displayProbNumber,
  CONFIDENCE_CEILING,
  CONFIDENCE_CEILING_EXPLAINER,
} from "@/lib/probability-display";

interface LeagueHitRate {
  hitRate: number;   // 0..1
  settled: number;
}

interface ValueBetsScanProps {
  bets: (LiveBet & { botCount: number })[];
  totalCount: number;
  userTier: "free" | "pro" | "elite";
  oddsVerifiedAt?: string | null;
  bookOdds?: Record<string, BookOddsEntry>;
  botRecentRoi?: Record<string, { roi: number; settled: number }>;
  // ELITE-LEAGUE-FILTER (2026-06-03): map keyed by `"${country} / ${name}"`
  // matching LiveBet.league. Only populated for Elite users; Pro/Free see {}.
  leagueHitRates?: Record<string, LeagueHitRate>;
}

// Threshold for the "Strong leagues only" pill. Matches the original task
// entry: leagues where the model hit rate >= 45% over the rolling window.
const ELITE_STRONG_LEAGUE_HIT_RATE = 0.45;

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

// PRO-TIER-V2 (2026-06-02): Pro now sees the side/selection, not just the
// market. Stake sizing stays Elite-only (Kelly fraction is the actionable
// element that justifies the price gap). Anything stake-related still gates
// on isElite below; everything else gates on isPro.
function fmtPickLine(market: string, selection: string, isPro: boolean): string {
  if (!isPro || !selection) return fmtMarket(market);
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

// UNIFIED-STATUS (2026-06-02): turn the bet's `result` field into a small
// status chip rendered top-right of the row when the bet is settled. The
// "LIVE" pulse / countdown handle the pending states; this only fires
// when result !== "pending". Returns null for pending so the existing
// time/LIVE render path is unchanged.
function settledChip(result: string, pnl: number): {
  label: string;
  classes: string;
} | null {
  switch (result) {
    case "won":
      return {
        label: pnl > 0 ? `✓ Won +${pnl.toFixed(1)}` : "✓ Won",
        classes: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
      };
    case "half_won":
      return {
        label: pnl > 0 ? `½ Won +${pnl.toFixed(1)}` : "½ Won",
        classes: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
      };
    case "lost":
      return {
        label: "✗ Lost",
        classes: "bg-red-500/10 text-red-400 ring-red-500/20",
      };
    case "half_lost":
      return {
        label: pnl < 0 ? `½ Lost ${pnl.toFixed(1)}` : "½ Lost",
        classes: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
      };
    case "void":
      return {
        label: "○ Void",
        classes: "bg-white/[0.04] text-muted-foreground ring-white/[0.08]",
      };
    default:
      return null;
  }
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

// Probability bar: [market░░░░░░░ edge-gap model] with labels.
// CALIBRATION-DISPLAY-CAP: model label says "70%+" once the underlying
// probability exceeds the calibration ceiling. The BAR ITSELF still uses
// the raw probability (visual proportion) — what we cap is the LABEL.
function EdgeBar({ modelProb, liveImplied }: { modelProb: number; liveImplied: number }) {
  const mPct = Math.round(modelProb * 100);
  const iPct = Math.round(liveImplied * 100);
  const ePct = mPct - iPct;
  const fairOdds = (1 / modelProb).toFixed(2);
  const capped = modelProb >= CONFIDENCE_CEILING;

  return (
    <div>
      <div className="flex justify-between text-[11px] font-medium mb-1.5">
        <span
          className="text-emerald-400"
          title={capped ? CONFIDENCE_CEILING_EXPLAINER : undefined}
        >
          {displayProb(modelProb)} model
          {capped && <span className="ml-0.5 text-emerald-400/60 cursor-help" aria-label="display capped">ⓘ</span>}
        </span>
        <span className="text-muted-foreground">{iPct}% market</span>
      </div>
      <div className="relative h-3.5 rounded-full bg-muted/20 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-white/[0.07] rounded-full" style={{ width: `${iPct}%` }} />
        <div className="absolute inset-y-0 rounded-full bg-emerald-500/50" style={{ left: `${iPct}%`, width: `${ePct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
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
  // PRO-TIER-V2 (2026-06-02): model probability / fair odds / edge math is
  // now visible to Pro too. The Kelly stake row inside the table is the only
  // Elite-only piece — gated separately below.
  const hasModelData = isPro && bet.modelProb > 0;

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
                <td className="py-1.5 text-right font-medium text-emerald-400" title={bet.modelProb >= CONFIDENCE_CEILING ? CONFIDENCE_CEILING_EXPLAINER : undefined}>{displayProb(bet.modelProb)}</td>
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
                    <span className="ml-1.5 text-[10px] text-muted-foreground">was {fmtEdge(bet.edge)} at post</span>
                  )}
                </td>
              </tr>
              {/* PRO-TIER-V2: stake sizing remains Elite-only; Pro sees a
                  small inline upsell row instead of the value. Keeps the
                  rest of the model table (prob, fair odds, edge) visible. */}
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
                <td className="py-1.5 text-right font-medium font-mono">
                  {isElite ? (
                    `${bet.stake.toFixed(1)}u`
                  ) : (
                    <a
                      href="/profile"
                      className="text-[11px] font-normal text-amber-400 hover:text-amber-300"
                    >
                      Elite →
                    </a>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
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
  leagueHitRate,
}: {
  bet: LiveBet & { botCount: number };
  isPro: boolean;
  isElite: boolean;
  entry?: BookOddsEntry;
  expanded: boolean;
  onToggle: () => void;
  // ELITE-LEAGUE-FILTER: per-row league-strength data (Elite only — Pro/Free
  // never receives a value here).
  leagueHitRate?: LeagueHitRate;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const best = entry ? getBestNow(entry) : null;
  const liveEdge = computeLiveEdge(bet.modelProb, entry);
  const displayEdge = liveEdge !== null ? liveEdge : bet.edge;
  const drift = lineDrift(entry, bet.odds, bet.result);
  const { gutter, timeColor, isLive } = urgency(bet.kickoff, bet.result, mounted);
  // PRO-TIER-V2 (2026-06-02): selection/odds/book are visible to Pro too —
  // gating these on isPro (which includes Elite). Stake stays Elite-only.
  const pickLine = fmtPickLine(bet.market, bet.selection, isPro);

  // Odds display: live best if available, else posting odds+book.
  // UNITS-CONSISTENCY (2026-06-02): stake suffix used to only attach in
  // the live-odds branch, so rows with no live entry dropped the units.
  // Now shared across all three branches — Elite users with stake > 0
  // always see the suggested size, regardless of whether we have live
  // odds, a stored bookmaker, or only a paper stake (Asian handicap rows
  // commonly fall into this last bucket because the bookOdds map keys
  // on (market, selection) and AH selections carry the handicap line,
  // so the join misses).
  const oddsLine = (() => {
    const stakeSuffix =
      isElite && bet.stake > 0 ? ` · ${bet.stake.toFixed(1)}u` : "";
    const stakeOnly = isElite && bet.stake > 0 ? `${bet.stake.toFixed(1)}u` : null;
    if (best) {
      return `${best.odds.toFixed(2)} ${best.name}${stakeSuffix}`;
    }
    if (isPro && bet.odds > 0 && bet.recommendedBookmaker) {
      return `${bet.odds.toFixed(2)} ${bet.recommendedBookmaker}${stakeSuffix}`;
    }
    if (isPro && bet.odds > 0) {
      // Have a posted odds but no recommended bookmaker (older rows / some AH).
      return `${bet.odds.toFixed(2)}${stakeSuffix}`;
    }
    // No odds line at all — but Elite still wants to see the stake hint.
    return stakeOnly;
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
              {/* UNIFIED-STATUS (2026-06-02): type chip — distinguishes a
                  prematch pick (placed before kickoff) from an inplay pick
                  (placed during the match by an inplay bot). Without it the
                  list mixed both with no visual cue. */}
              {(() => {
                // INPLAY-METADATA-STALENESS (2026-06-03): when we have the
                // pick-time minute + score, fold them into the chip so a
                // 3' pick (close to prematch state) is visually distinct
                // from a 67' pick (highly path-dependent).
                if (!bet.isInplay) {
                  return (
                    <span
                      className="shrink-0 rounded-sm border border-sky-500/30 bg-sky-500/10 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-sky-300"
                      title="Placed before kick-off by a prematch bot"
                    >
                      Pre-match
                    </span>
                  );
                }
                const minute = bet.matchMinuteAtPick;
                const home = bet.scoreHomeAtPick;
                const away = bet.scoreAwayAtPick;
                const hasMeta = minute != null;
                const scoreFragment =
                  home != null && away != null ? ` · ${home}-${away}` : "";
                const minuteFragment = hasMeta ? ` · ${minute}'` : "";
                const tooltip = hasMeta
                  ? `Placed by an inplay bot at minute ${minute}${
                      home != null && away != null
                        ? ` (score ${home}-${away})`
                        : ""
                    }`
                  : "Placed during the match by an inplay bot";
                return (
                  <span
                    className="shrink-0 rounded-sm border border-fuchsia-500/40 bg-fuchsia-500/10 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-fuchsia-300"
                    title={tooltip}
                  >
                    {`In-play${minuteFragment}${scoreFragment}`}
                  </span>
                );
              })()}
              <span className="truncate">{pickLine}</span>
              <ConsensusDots count={bet.botCount} />
              {/* COHORT-TRANSPARENCY (2026-06-02): Elite users see picks from
                  all 39 active bots; mark the ones that are ALSO in the Pro
                  feed (calibrated subset) so they can tell the curated picks
                  from the wider Elite-only set. Hidden on Pro view because
                  every row is already calibrated. */}
              {isElite && bet.isCalibrated && (
                <span
                  className="shrink-0 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-300"
                  title="From a calibrated bot — also in the Pro tier feed"
                >
                  Pro
                </span>
              )}
              {/* ELITE-LEAGUE-FILTER (2026-06-03): per-row league strength
                  badge. Colour-coded by 90d hit rate so Elite users can
                  glance at how the model historically performs in this
                  league. Pro/Free never gets a value here. */}
              {leagueHitRate && (() => {
                const pct = Math.round(leagueHitRate.hitRate * 100);
                const cls =
                  leagueHitRate.hitRate >= 0.50
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : leagueHitRate.hitRate >= 0.45
                    ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                    : leagueHitRate.hitRate >= 0.40
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300";
                return (
                  <span
                    className={cn(
                      "shrink-0 rounded-sm border px-1 py-px text-[8px] font-bold uppercase tracking-wider",
                      cls,
                    )}
                    title={`Model hit rate in ${bet.league}: ${pct}% over last 90 days (n=${leagueHitRate.settled})`}
                  >
                    {pct}%
                  </span>
                );
              })()}
            </div>
            {oddsLine && (
              <p className="text-[11px] text-muted-foreground">{oddsLine}</p>
            )}
          </div>

          {/* Right: status chip (settled) OR LIVE pulse OR countdown */}
          <div className="shrink-0 flex flex-col items-end gap-1 min-w-[36px]">
            {(() => {
              const chip = mounted ? settledChip(bet.result, bet.pnl) : null;
              if (chip) {
                return (
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", chip.classes)}>
                    {chip.label}
                  </span>
                );
              }
              if (isLive) {
                return (
                  <span className="text-[11px] font-bold text-red-400 animate-pulse">LIVE</span>
                );
              }
              return (
                <span suppressHydrationWarning className={cn("text-[12px] tabular-nums", timeColor)}>
                  {mounted ? fmtKoTime(bet.kickoff) : ""}
                </span>
              );
            })()}
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
  leagueHitRates,
}: ValueBetsScanProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [league, setLeague] = useState(ALL);
  const [edgeFilter, setEdgeFilter] = useState<"all" | "strong" | "moderate">("all");
  // ELITE-LEAGUE-FILTER (2026-06-03): toggle to restrict to leagues where
  // the rolling 90d model hit rate >= 45%. Elite only — Pro/Free don't see
  // the pill or the per-row badge.
  const [strongLeaguesOnly, setStrongLeaguesOnly] = useState(false);

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
      if (strongLeaguesOnly && isElite) {
        const hr = leagueHitRates?.[b.league];
        if (!hr || hr.hitRate < ELITE_STRONG_LEAGUE_HIT_RATE) return false;
      }
      return true;
    });
  }, [bets, league, edgeFilter, userTier, strongLeaguesOnly, isElite, leagueHitRates]);

  const strongCount = bets.filter((b) => b.edge * 100 >= 10).length;
  const modCount = bets.filter((b) => b.edge * 100 >= 5 && b.edge * 100 < 10).length;
  // ELITE-LEAGUE-FILTER: count of currently-loaded picks whose league has
  // historical hit rate at the strong threshold.
  const strongLeagueCount = isElite && leagueHitRates
    ? bets.filter((b) => {
        const hr = leagueHitRates[b.league];
        return hr && hr.hitRate >= ELITE_STRONG_LEAGUE_HIT_RATE;
      }).length
    : 0;
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
        {/* ELITE-LEAGUE-FILTER (2026-06-03): Elite-only pill to restrict to
            picks in leagues where our model's 90d hit rate >= 45%. Sits in
            the same pill row as the edge filters so it visually belongs to
            the "narrow my list" controls. */}
        {isElite && strongLeagueCount > 0 && (
          <button
            onClick={() => setStrongLeaguesOnly(!strongLeaguesOnly)}
            title={`Restrict to leagues with model hit rate ≥ ${(ELITE_STRONG_LEAGUE_HIT_RATE * 100).toFixed(0)}% over last 90 days`}
            className={cn(
              "rounded-full px-3 py-1 text-xs border transition-colors",
              strongLeaguesOnly
                ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                : "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20",
            )}
          >
            ★ {strongLeagueCount} strong leagues
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
          <button onClick={dismissBanner} aria-label="Dismiss" className="shrink-0 hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" aria-hidden />
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
              leagueHitRate={isElite ? leagueHitRates?.[bet.league] : undefined}
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
