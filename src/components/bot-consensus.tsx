import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BotConsensusData } from "@/lib/engine-data";

const TOTAL_BOTS = 17;

function marketLabel(market: string, selection: string): string {
  const labels: Record<string, Record<string, string>> = {
    "1x2": { home: "Home Win", draw: "Draw", away: "Away Win" },
    "over_under_25": { over: "Over 2.5", under: "Under 2.5" },
    "over_under_15": { over: "Over 1.5", under: "Under 1.5" },
    "over_under_35": { over: "Over 3.5", under: "Under 3.5" },
    "btts": { yes: "BTTS Yes", no: "BTTS No" },
  };
  return labels[market]?.[selection] ?? `${market} ${selection}`;
}

function consensusLevel(count: number): { label: string; color: string } {
  const pct = count / TOTAL_BOTS;
  if (pct >= 0.5) return { label: "HIGH", color: "text-emerald-400" };
  if (pct >= 0.25) return { label: "MODERATE", color: "text-amber-400" };
  return { label: "LOW", color: "text-muted-foreground" };
}

function ModelPips({ active, total }: { active: number; total: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            i < active ? "bg-emerald-400" : "bg-muted-foreground/20"
          )}
        />
      ))}
    </div>
  );
}

interface BotConsensusProps {
  consensus: BotConsensusData;
  isPro: boolean;
}

export function BotConsensus({ consensus, isPro }: BotConsensusProps) {
  if (consensus.totalBets === 0) return null;

  const level = consensusLevel(consensus.totalBets);

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Model Consensus</h3>
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-bold tracking-wider", level.color)}>{level.label}</span>
          <span className="text-xs text-muted-foreground font-mono">{consensus.totalBets}/{TOTAL_BOTS}</span>
        </div>
      </div>

      {/* Model pips — always visible */}
      <div className="mb-3">
        <ModelPips active={consensus.totalBets} total={TOTAL_BOTS} />
      </div>

      {!isPro ? (
        // Free tier: teaser + lock
        <div className="space-y-2">
          {consensus.topItem && (
            <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 blur-[2px] select-none pointer-events-none">
              <span className="text-sm font-medium">{marketLabel(consensus.topItem.market, consensus.topItem.selection)}</span>
              <span className="text-xs text-muted-foreground">{consensus.topItem.count} model{consensus.topItem.count !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Pro</span> — see which markets {consensus.totalBets} model{consensus.totalBets !== 1 ? "s" : ""} back and average edge %
            </p>
          </div>
        </div>
      ) : (
        // Pro tier: full breakdown
        <div className="space-y-1.5">
          {consensus.markets.map((item) => (
            <div key={`${item.market}-${item.selection}`} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{marketLabel(item.market, item.selection)}</span>
                <span className="text-xs text-muted-foreground">{item.count}/{TOTAL_BOTS}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>~{item.avgProb}% prob</span>
                {item.avgEdge > 0 && (
                  <span className="text-emerald-400 font-medium">+{item.avgEdge}% edge</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
