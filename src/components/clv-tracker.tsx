/**
 * SUX-12: CLV Tracker — Elite only
 * Shows Closing Line Value for this match's model picks.
 * CLV > 0 means the bet was placed at better-than-closing odds (sharp bet signal).
 */

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MatchCLVData } from "@/lib/engine-data";

interface CLVTrackerProps {
  clvData: MatchCLVData;
  homeTeam: string;
  awayTeam: string;
  matchStatus: string;
}

function CLVBadge({ clv }: { clv: number | null }) {
  if (clv == null) return <span className="text-[10px] text-muted-foreground/40">—</span>;
  const pct = (clv * 100).toFixed(1);
  if (clv > 0.02) return (
    <span className="flex items-center gap-0.5 font-mono text-xs font-bold text-green-400">
      <TrendingUp className="size-3" />+{pct}%
    </span>
  );
  if (clv < -0.02) return (
    <span className="flex items-center gap-0.5 font-mono text-xs font-bold text-red-400">
      <TrendingDown className="size-3" />{pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 font-mono text-xs text-muted-foreground">
      <Minus className="size-3" />{pct}%
    </span>
  );
}

function ResultBadge({ result, pnl }: { result: string; pnl: number }) {
  if (result === "won") return (
    <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
      Won +{pnl.toFixed(2)}u
    </span>
  );
  if (result === "lost") return (
    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
      Lost {pnl.toFixed(2)}u
    </span>
  );
  if (result === "void" || result === "push") return (
    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
      Void
    </span>
  );
  return (
    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground/50">
      {result}
    </span>
  );
}

function clvExplainer(avg: number | null): string {
  if (avg == null) return "";
  if (avg > 0.03) return "Consistently beating the close — strong sharp signal.";
  if (avg > 0) return "Slightly above closing price — positive CLV edge.";
  if (avg < -0.03) return "Below closing line — possible reactive bets.";
  return "Near closing line — average market timing.";
}

export function CLVTracker({ clvData, homeTeam, awayTeam, matchStatus }: CLVTrackerProps) {
  const { pseudoClvHome, pseudoClvDraw, pseudoClvAway, settledBets } = clvData;
  const hasPseudoCLV = pseudoClvHome != null || pseudoClvDraw != null || pseudoClvAway != null;
  const hasSettledBets = settledBets.length > 0;

  if (!hasPseudoCLV && !hasSettledBets) {
    if (matchStatus !== "finished") {
      return (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground">CLV Tracker</h3>
            <span className="ml-auto rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-400">Elite</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50">CLV is calculated at settlement after the match closes.</p>
        </div>
      );
    }
    return null;
  }

  const clvValues = [pseudoClvHome, pseudoClvDraw, pseudoClvAway].filter((v): v is number => v != null);
  const avgCLV = clvValues.length ? clvValues.reduce((a, b) => a + b, 0) / clvValues.length : null;

  const betsWithCLV = settledBets.filter((b) => b.clv != null);
  const betCLVAvg = betsWithCLV.length
    ? betsWithCLV.reduce((sum, b) => sum + b.clv!, 0) / betsWithCLV.length
    : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">CLV Tracker</h3>
        <span className="ml-auto rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-400">Elite</span>
      </div>

      <p className="mb-3 text-[11px] text-muted-foreground/60">
        Closing Line Value — did we beat the closing price? Positive CLV = model priced this correctly before the market moved.
      </p>

      {/* Pseudo-CLV per selection */}
      {hasPseudoCLV && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-muted/20 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50">Market CLV vs Opening</p>
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Home</p>
              <CLVBadge clv={pseudoClvHome} />
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Draw</p>
              <CLVBadge clv={pseudoClvDraw} />
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Away</p>
              <CLVBadge clv={pseudoClvAway} />
            </div>
            {avgCLV != null && (
              <div className="text-center border-l border-white/[0.06] pl-4">
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide mb-0.5">Avg</p>
                <CLVBadge clv={avgCLV} />
              </div>
            )}
          </div>
          {avgCLV != null && (
            <p className="mt-2 text-[10px] text-muted-foreground/40 italic">{clvExplainer(avgCLV)}</p>
          )}
        </div>
      )}

      {/* Settled bets with CLV */}
      {hasSettledBets && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/50 mb-2">Bot Picks</p>
          {settledBets.map((bet) => (
            <div
              key={bet.id}
              className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-muted/10 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium text-foreground capitalize">{bet.selection} win</span>
                <span className="ml-2 text-[10px] text-muted-foreground/50">{bet.botName}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground/40">Odds</p>
                  <span className="font-mono text-[11px]">{bet.oddsAtPick.toFixed(2)}</span>
                </div>
                {bet.closingOdds != null && (
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground/40">Close</p>
                    <span className="font-mono text-[11px] text-muted-foreground">{bet.closingOdds.toFixed(2)}</span>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-[9px] text-muted-foreground/40">CLV</p>
                  <CLVBadge clv={bet.clv} />
                </div>
                <ResultBadge result={bet.result} pnl={bet.pnl} />
              </div>
            </div>
          ))}
          {betCLVAvg != null && (
            <p className="mt-2 text-[10px] text-muted-foreground/40">
              Average bet CLV: <span className={betCLVAvg >= 0 ? "text-green-400" : "text-red-400"}>{betCLVAvg >= 0 ? "+" : ""}{(betCLVAvg * 100).toFixed(1)}%</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
