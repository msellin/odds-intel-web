import { Zap } from "lucide-react";

interface Props {
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  homeTeam: string;
  awayTeam: string;
  modelHome?: number | null;
  modelDraw?: number | null;
  modelAway?: number | null;
  matchStatus?: string;
  isPro?: boolean;
}

interface OutcomeRowProps {
  label: string;
  marketPct: number;
  modelPct: number | null;
  showModel: boolean;
  isValue: boolean;
}

function OutcomeRow({ label, marketPct, modelPct, showModel, isValue }: OutcomeRowProps) {
  const edge = showModel && modelPct != null ? modelPct - marketPct : null;
  const hasEdge = edge != null && Math.abs(edge) >= 1;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground truncate max-w-[120px]">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {showModel && modelPct != null && (
            <span className="font-mono text-violet-400/80">{modelPct.toFixed(0)}%</span>
          )}
          <span className="font-mono font-bold text-foreground">{marketPct.toFixed(0)}%</span>
          {hasEdge && (
            <span className={`font-mono text-[10px] font-bold ${edge! > 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {edge! > 0 ? "+" : ""}{edge!.toFixed(0)}pp
            </span>
          )}
          {isValue && (
            <Zap className="h-3 w-3 text-amber-400 shrink-0" />
          )}
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/50 transition-all"
          style={{ width: `${Math.min(marketPct, 100)}%` }}
        />
        {showModel && modelPct != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-violet-400"
            style={{ left: `${Math.min(modelPct, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function MarketImpliedProbabilities({
  bestHome,
  bestDraw,
  bestAway,
  homeTeam,
  awayTeam,
  modelHome,
  modelDraw,
  modelAway,
  matchStatus,
  isPro = false,
}: Props) {
  if (!bestHome || !bestDraw || !bestAway) return null;

  const isLive = matchStatus === "live";
  const showModel = !isLive && modelHome != null && modelDraw != null && modelAway != null;

  // Normalize market implied probabilities (removes overround)
  const rawHome = 1 / bestHome;
  const rawDraw = 1 / bestDraw;
  const rawAway = 1 / bestAway;
  const total = rawHome + rawDraw + rawAway;

  const impliedHome = (rawHome / total) * 100;
  const impliedDraw = (rawDraw / total) * 100;
  const impliedAway = (rawAway / total) * 100;
  const overround = (total - 1) * 100;
  const isNegativeMargin = overround < 0;

  // Find outcome with biggest positive model edge (value side)
  let valueSide: "home" | "draw" | "away" | null = null;
  if (showModel && modelHome != null && modelDraw != null && modelAway != null) {
    const edges = [
      { side: "home" as const, edge: modelHome - impliedHome },
      { side: "draw" as const, edge: modelDraw - impliedDraw },
      { side: "away" as const, edge: modelAway - impliedAway },
    ];
    const top = edges.reduce((a, b) => b.edge > a.edge ? b : a);
    if (top.edge >= 3) valueSide = top.side;
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {isLive ? "Market Probabilities" : "Pre-match · model vs market"}
        </h3>
        {isLive ? (
          <span className="text-[10px] text-amber-400/70 font-mono">Live</span>
        ) : (
          <span
            className={`text-[10px] font-mono ${isNegativeMargin ? "text-emerald-400" : "text-muted-foreground/50"}`}
            title="Overround = sum of 1/odds minus 1. Negative means best-line shopping erases the house edge."
          >
            {overround > 0 ? "+" : ""}{overround.toFixed(1)}% margin
          </span>
        )}
      </div>

      {/* Negative overround callout */}
      {isNegativeMargin && !isLive && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
          <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
          <p className="text-[11px] text-emerald-400/90 leading-relaxed">
            <span className="font-semibold">Best-line margin {overround.toFixed(1)}%.</span>{" "}
            Shopping across {Math.round(total)} books erases the house edge on this match.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <OutcomeRow
          label={homeTeam}
          marketPct={impliedHome}
          modelPct={showModel ? modelHome : null}
          showModel={showModel && isPro}
          isValue={valueSide === "home"}
        />
        <OutcomeRow
          label="Draw"
          marketPct={impliedDraw}
          modelPct={showModel ? modelDraw : null}
          showModel={showModel && isPro}
          isValue={valueSide === "draw"}
        />
        <OutcomeRow
          label={awayTeam}
          marketPct={impliedAway}
          modelPct={showModel ? modelAway : null}
          showModel={showModel && isPro}
          isValue={valueSide === "away"}
        />
      </div>

      {showModel && (
        <div className="flex items-center gap-3 pt-1 border-t border-border/20">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <span className="inline-block w-2.5 h-0.5 bg-violet-400 rounded" />
            Model
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <span className="inline-block w-2.5 h-2 rounded bg-primary/50" />
            Market (normalized)
          </div>
          <span className="text-[10px] text-muted-foreground/40 ml-auto">pp = percentage points</span>
        </div>
      )}
      {isLive && (
        <p className="text-[10px] text-muted-foreground/40">
          Pre-match model comparison hidden during live matches
        </p>
      )}
    </div>
  );
}
