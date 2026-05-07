interface MarketImpliedProbabilitiesProps {
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  homeTeam: string;
  awayTeam: string;
  /** Model predictions for comparison (shows edge if available) */
  modelHome?: number | null;
  modelDraw?: number | null;
  modelAway?: number | null;
  matchStatus?: string;
}

function ProbBar({ label, pct, modelPct }: { label: string; pct: number; modelPct?: number | null }) {
  const edge = modelPct != null ? modelPct - pct : null;
  const hasEdge = edge != null && Math.abs(edge) >= 1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground">{pct.toFixed(0)}%</span>
          {hasEdge && (
            <span className={`font-mono text-[10px] font-bold ${edge! > 0 ? "text-green-400" : "text-red-400"}`}>
              {edge! > 0 ? "+" : ""}{edge!.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {modelPct != null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-violet-400"
            style={{ left: `${Math.min(modelPct, 100)}%` }}
            title={`Model: ${modelPct.toFixed(0)}%`}
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
}: MarketImpliedProbabilitiesProps) {
  if (!bestHome || !bestDraw || !bestAway) return null;

  // For live matches, odds are in-play and the pre-match model comparison is meaningless
  const isLive = matchStatus === "live";
  const showModel = !isLive && modelHome != null;

  // Remove overround to get true implied probabilities
  const rawHome = 1 / bestHome;
  const rawDraw = 1 / bestDraw;
  const rawAway = 1 / bestAway;
  const total = rawHome + rawDraw + rawAway;

  const impliedHome = (rawHome / total) * 100;
  const impliedDraw = (rawDraw / total) * 100;
  const impliedAway = (rawAway / total) * 100;
  const overround = (total - 1) * 100;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Market Probabilities</h3>
        {isLive ? (
          <span className="text-[10px] text-amber-400/70 font-mono">Live odds</span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            {overround.toFixed(1)}% margin
          </span>
        )}
      </div>

      <div className="space-y-3">
        <ProbBar label={homeTeam} pct={impliedHome} modelPct={showModel ? modelHome : null} />
        <ProbBar label="Draw" pct={impliedDraw} modelPct={showModel ? modelDraw : null} />
        <ProbBar label={awayTeam} pct={impliedAway} modelPct={showModel ? modelAway : null} />
      </div>

      {showModel && (
        <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">
          <span className="inline-block w-2 h-0.5 bg-violet-400 mr-1 align-middle rounded" />
          Model estimate
        </p>
      )}
      {isLive && (
        <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">
          Pre-match model comparison hidden during live matches
        </p>
      )}
    </div>
  );
}
