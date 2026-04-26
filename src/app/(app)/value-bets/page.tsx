import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { valueBets } from "@/lib/mock-data";
import { ValueBetsClient } from "@/components/value-bets-client";
import { TierGate } from "@/components/tier-gate";

export default function ValueBetsPage() {
  const sorted = [...valueBets].sort((a, b) => b.edgePercent - a.edgePercent);
  const avgEdge =
    sorted.reduce((sum, b) => sum + b.edgePercent, 0) / sorted.length;
  const highConfCount = sorted.filter((b) => b.confidence === "high").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">
            Value Bets
          </h1>
          <Badge variant="secondary" className="font-mono text-xs">
            {sorted.length}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Today&apos;s top picks ranked by edge
        </p>
      </div>

      <TierGate requiredTier="sharp" featureName="Value Bets">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total bets</p>
            <p className="font-mono text-2xl font-bold">{sorted.length}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Avg edge</p>
            <p className="font-mono text-2xl font-bold text-amber-500">
              {avgEdge.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">High confidence</p>
            <p className="font-mono text-2xl font-bold text-emerald-500">
              {highConfCount}
            </p>
          </div>
        </div>

        {/* Client component with filters + table */}
        <ValueBetsClient bets={sorted} />
      </TierGate>
    </div>
  );
}
