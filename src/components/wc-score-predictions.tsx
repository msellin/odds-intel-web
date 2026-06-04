import { Target } from "lucide-react";
import { topScorelines, lambdasFromPriors } from "@/lib/wc-score-predictions";

interface Props {
  homeTeam: string;
  awayTeam: string;
  /** λ_home (mean Poisson goals for home). Optional — if absent, we derive
   *  from model 1X2 probs via `lambdasFromPriors`. */
  lambdaHome?: number | null;
  lambdaAway?: number | null;
  /** Ensemble model probabilities (0-100, same scale as PublicMatch). Used as
   *  the λ fallback path when the engine hasn't persisted explicit lambdas. */
  modelHome?: number | null;
  modelDraw?: number | null;
  modelAway?: number | null;
}

/**
 * "Top 5 most likely scorelines" table — surfaces the Poisson model's view of
 * exact-score outcomes on WC2026 match-detail pages. Renders nothing when
 * neither lambdas nor model priors are available.
 *
 * Mobile-first: the score column is narrow enough to fit on a 320px screen.
 */
export function WCScorePredictions({
  homeTeam,
  awayTeam,
  lambdaHome,
  lambdaAway,
  modelHome,
  modelDraw,
  modelAway,
}: Props) {
  // Resolve λ pair: prefer explicit values from the engine; else derive from
  // the 1X2 model probs.
  let lh: number | null = null;
  let la: number | null = null;
  if (
    lambdaHome != null &&
    lambdaAway != null &&
    Number.isFinite(lambdaHome) &&
    Number.isFinite(lambdaAway) &&
    lambdaHome > 0 &&
    lambdaAway > 0
  ) {
    lh = lambdaHome;
    la = lambdaAway;
  } else if (
    modelHome != null &&
    modelDraw != null &&
    modelAway != null
  ) {
    // modelHome/Draw/Away arrive as percentages (0..100); convert to fractions.
    const { lambdaHome: dLh, lambdaAway: dLa } = lambdasFromPriors(
      modelHome / 100,
      modelDraw / 100,
      modelAway / 100
    );
    lh = dLh;
    la = dLa;
  }

  if (lh == null || la == null) return null;

  const scorelines = topScorelines(lh, la, 5);
  if (scorelines.length === 0) return null;

  // Use the most-likely scoreline's probability to scale the bars — keeps
  // the visual contrast high even when total mass is concentrated.
  const peakProb = scorelines[0].prob;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-violet-400 shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">
          Top 5 likely scorelines
        </h3>
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider ml-auto">
          model&apos;s view
        </span>
      </div>

      <div className="space-y-2">
        {scorelines.map((s, idx) => {
          const pct = s.prob * 100;
          const barPct = peakProb > 0 ? (s.prob / peakProb) * 100 : 0;
          return (
            <div key={`${s.home}-${s.away}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground tabular-nums w-3 shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-mono font-bold text-foreground tabular-nums">
                    {s.home}–{s.away}
                  </span>
                </div>
                <span className="font-mono text-muted-foreground tabular-nums">
                  {pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-violet-400/60"
                  style={{ width: `${Math.min(barPct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Poisson model — {homeTeam} λ={lh.toFixed(2)}, {awayTeam} λ={la.toFixed(2)}.
        Top 5 cover {(scorelines.reduce((s, x) => s + x.prob, 0) * 100).toFixed(0)}%
        of outcomes.
      </p>
    </div>
  );
}
