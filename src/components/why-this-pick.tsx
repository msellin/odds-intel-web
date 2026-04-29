/**
 * SUX-11: "Why This Pick" — Elite only
 * Synthesizes match signals into a natural-language reasoning card.
 * Static translation (no LLM call) — maps top signals to sentences.
 */

import type { MatchSignalRow } from "@/lib/engine-data";
import { Sparkles } from "lucide-react";

interface WhyThisPickProps {
  signals: MatchSignalRow[];
  homeTeam: string;
  awayTeam: string;
}

interface Reason {
  text: string;
  confidence: "strong" | "moderate" | "weak";
}

function buildReasons(signals: MatchSignalRow[], homeTeam: string, awayTeam: string): Reason[] {
  const sig: Record<string, number> = {};
  for (const s of signals) {
    if (!(s.signal_name in sig)) sig[s.signal_name] = s.signal_value;
  }

  const reasons: Reason[] = [];

  // Market signals
  const bdm = sig["bookmaker_disagreement"];
  if (bdm != null) {
    if (bdm > 0.12) reasons.push({ text: `Bookmakers disagree sharply on this match (disagreement: ${(bdm * 100).toFixed(0)}%) — indicating market uncertainty and potential mispricing.`, confidence: "strong" });
    else if (bdm > 0.08) reasons.push({ text: `Some bookmaker disagreement detected — market consensus is not uniform.`, confidence: "moderate" });
  }

  const olm = sig["overnight_line_move"];
  if (olm != null) {
    const abs = Math.abs(olm);
    const dir = olm > 0 ? "shortened" : "drifted";
    if (abs > 0.04) reasons.push({ text: `The home win price ${dir} significantly overnight (${(abs * 100).toFixed(1)}pts) — consistent with sharp money movement.`, confidence: "strong" });
    else if (abs > 0.03) reasons.push({ text: `Notable overnight line movement detected — early market positioning suggests informed opinion.`, confidence: "moderate" });
  }

  // Form signals
  const slopeHome = sig["form_slope_home"];
  const slopeAway = sig["form_slope_away"];
  if (slopeHome != null && slopeAway != null) {
    if (slopeHome > 0.15 && slopeAway < -0.15)
      reasons.push({ text: `${homeTeam} are in improving form while ${awayTeam} are trending downward — form differential favors the home side.`, confidence: "strong" });
    else if (slopeAway > 0.15 && slopeHome < -0.15)
      reasons.push({ text: `${awayTeam} are in improving form while ${homeTeam} are trending down — form suggests away value.`, confidence: "strong" });
    else if (slopeHome > 0.15)
      reasons.push({ text: `${homeTeam} show a positive form trajectory — momentum is on their side.`, confidence: "moderate" });
  }

  // Fixture importance
  const impHome = sig["fixture_importance_home"] ?? sig["fixture_importance"];
  const impAway = sig["fixture_importance_away"];
  if (impHome != null && impAway != null) {
    const diff = Math.abs(impHome - impAway);
    if (diff > 0.3) {
      const moreMotivated = impHome > impAway ? homeTeam : awayTeam;
      reasons.push({ text: `${moreMotivated} have significantly more at stake in this fixture — motivation asymmetry can influence result.`, confidence: "moderate" });
    }
  }

  // H2H
  const h2h = sig["h2h_win_pct"];
  const h2hTotal = sig["h2h_total"];
  if (h2h != null && (h2hTotal == null || h2hTotal >= 3)) {
    if (h2h > 0.65) reasons.push({ text: `${homeTeam} have a dominant head-to-head record (${(h2h * 100).toFixed(0)}% win rate in recent meetings).`, confidence: "strong" });
    else if (h2h > 0.5) reasons.push({ text: `${homeTeam} have a slight edge in historical head-to-head encounters.`, confidence: "weak" });
    else if (h2h < 0.35) reasons.push({ text: `${awayTeam} have historically performed well against this opponent (home side wins only ${(h2h * 100).toFixed(0)}% of H2H meetings).`, confidence: "moderate" });
  }

  // News / injuries
  const newsScore = sig["news_impact_score"];
  if (newsScore != null && newsScore < -0.3) {
    reasons.push({ text: `Recent news is negative — key absences or disruption may reduce the affected team's effectiveness.`, confidence: "moderate" });
  }

  const injHome = sig["injury_count_home"] ?? 0;
  const injAway = sig["injury_count_away"] ?? 0;
  if (injHome >= 3 && injAway < 2) {
    reasons.push({ text: `${homeTeam} have ${Math.round(injHome)} injury absences — squad depth under pressure.`, confidence: "moderate" });
  } else if (injAway >= 3 && injHome < 2) {
    reasons.push({ text: `${awayTeam} are missing ${Math.round(injAway)} players — weakened travelling squad.`, confidence: "moderate" });
  }

  // ELO
  const eloDiff = sig["elo_diff"];
  if (eloDiff != null && Math.abs(eloDiff) > 80) {
    const stronger = eloDiff > 0 ? homeTeam : awayTeam;
    reasons.push({ text: `ELO ratings show a clear quality gap — ${stronger} is rated ${Math.abs(Math.round(eloDiff))} points above their opponent.`, confidence: "strong" });
  }

  // Referee
  const refHomeWin = sig["referee_home_win_pct"];
  if (refHomeWin != null && refHomeWin > 0.55) {
    reasons.push({ text: `This referee shows a home-win bias (${(refHomeWin * 100).toFixed(0)}% home win rate) — marginal edge for ${homeTeam}.`, confidence: "weak" });
  }

  // Fallback if no signals generated reasons
  if (reasons.length === 0) {
    reasons.push({ text: "Model identified value based on the ensemble of Poisson and XGBoost probabilities versus market implied probability.", confidence: "weak" });
  }

  return reasons.slice(0, 5);
}

const CONFIDENCE_STYLES = {
  strong: "border-green-500/20 bg-green-500/5",
  moderate: "border-amber-500/20 bg-amber-500/5",
  weak: "border-white/[0.06] bg-white/[0.02]",
};

const CONFIDENCE_DOT = {
  strong: "bg-green-500",
  moderate: "bg-amber-500",
  weak: "bg-muted-foreground/30",
};

export function WhyThisPick({ signals, homeTeam, awayTeam }: WhyThisPickProps) {
  if (signals.length === 0) return null;

  const reasons = buildReasons(signals, homeTeam, awayTeam);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-3.5 text-violet-400" />
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
          Why This Pick
        </h3>
        <span className="ml-auto rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-400">
          Elite
        </span>
      </div>

      <p className="mb-3 text-[11px] text-muted-foreground/60">
        Key factors the model weighted in this match — in plain English.
      </p>

      <div className="space-y-2">
        {reasons.map((reason, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${CONFIDENCE_STYLES[reason.confidence]}`}
          >
            <span className={`mt-1 size-1.5 shrink-0 rounded-full ${CONFIDENCE_DOT[reason.confidence]}`} />
            <p className="text-[11px] leading-relaxed text-foreground/80">{reason.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
