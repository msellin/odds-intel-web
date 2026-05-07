/**
 * SUX-4: Match Signal Summary card
 * Shows top 3-5 signals in plain English on match detail.
 * Free users see teaser copy. Pro/Elite users see full signal breakdown.
 */

import { Zap, Lock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchSignalRow } from "@/lib/engine-data";
import {
  formSlopeLabel,
  oddsVolatilityLabel,
  overnightMoveLabel,
  bookmakerDisagreementLabel,
  fixtureImportanceLabel,
  importanceDiffLabel,
  newsImpactLabel,
  injuryCountLabel,
  refereeCardsLabel,
  h2hEdgeLabel,
  eloDiffLabel,
  leagueAvgGoalsLabel,
  managerChangeDaysLabel,
  pointsToRelegationLabel,
  pinnacleLineMoveLabel,
  type SignalLabel,
  type SignalSeverity,
} from "@/lib/signal-labels";

interface MatchSignalSummaryProps {
  signals: MatchSignalRow[];
  isPro: boolean; // pro or elite
  isElite?: boolean; // elite only
  homeTeam: string;
  awayTeam: string;
  matchStatus?: string; // "finished" | "scheduled" | "live" etc.
  scoreHome?: number | null;
  scoreAway?: number | null;
}

// Severity → colour
const SEVERITY_STYLES: Record<SignalSeverity, string> = {
  neutral: "text-muted-foreground",
  low: "text-sky-400",
  medium: "text-amber-400",
  high: "text-emerald-400",
};

const SEVERITY_DOT: Record<SignalSeverity, string> = {
  neutral: "bg-muted-foreground/40",
  low: "bg-sky-400/60",
  medium: "bg-amber-400",
  high: "bg-emerald-400",
};

function SignalRow({
  label,
  icon,
  severity,
  description,
}: SignalLabel) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
      <span className={cn("mt-0.5 h-2 w-2 rounded-full shrink-0", SEVERITY_DOT[severity])} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", SEVERITY_STYLES[severity])}>
          {icon} {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function buildSignalInsights(
  signals: MatchSignalRow[],
  homeTeam: string,
  awayTeam: string
): { label: SignalLabel; signalName: string }[] {
  const byName: Record<string, number> = {};
  for (const s of signals) byName[s.signal_name] = Number(s.signal_value);

  const insights: { label: SignalLabel; signalName: string; priority: number }[] = [];

  // ── Form slope ────────────────────────────────────────────────────────────
  const slopeHome = byName["form_slope_home"];
  const slopeAway = byName["form_slope_away"];
  if (slopeHome !== undefined && Math.abs(slopeHome) > 0.1) {
    const lbl = formSlopeLabel(slopeHome);
    insights.push({
      label: { ...lbl, description: `${homeTeam}: ${lbl.description.toLowerCase()}` },
      signalName: "form_slope_home",
      priority: Math.abs(slopeHome) > 0.3 ? 2 : 3,
    });
  }
  if (slopeAway !== undefined && Math.abs(slopeAway) > 0.1) {
    const lbl = formSlopeLabel(slopeAway);
    insights.push({
      label: { ...lbl, description: `${awayTeam}: ${lbl.description.toLowerCase()}` },
      signalName: "form_slope_away",
      priority: Math.abs(slopeAway) > 0.3 ? 2 : 3,
    });
  }

  // ── Market signals ────────────────────────────────────────────────────────
  const bdm = byName["bookmaker_disagreement"];
  if (bdm !== undefined && bdm > 0.06) {
    const lbl = bookmakerDisagreementLabel(bdm);
    insights.push({ label: lbl, signalName: "bookmaker_disagreement", priority: bdm > 0.12 ? 1 : 2 });
  }

  const olm = byName["overnight_line_move"];
  if (olm !== undefined && Math.abs(olm) > 0.025) {
    const lbl = overnightMoveLabel(olm);
    insights.push({ label: lbl, signalName: "overnight_line_move", priority: Math.abs(olm) > 0.04 ? 1 : 2 });
  }

  const vol = byName["odds_volatility"];
  if (vol !== undefined && vol > 0.004) {
    const lbl = oddsVolatilityLabel(vol);
    insights.push({ label: lbl, signalName: "odds_volatility", priority: vol > 0.008 ? 1 : 3 });
  }

  // ── Fixture importance ────────────────────────────────────────────────────
  const impDiff = byName["importance_diff"];
  if (impDiff !== undefined && Math.abs(impDiff) > 0.2) {
    const lbl = importanceDiffLabel(impDiff);
    insights.push({ label: lbl, signalName: "importance_diff", priority: Math.abs(impDiff) > 0.4 ? 2 : 3 });
  } else {
    const imp = byName["fixture_importance"];
    if (imp !== undefined && imp > 0.4) {
      const lbl = fixtureImportanceLabel(imp);
      insights.push({ label: lbl, signalName: "fixture_importance", priority: imp > 0.7 ? 2 : 3 });
    }
  }

  // ── News & injuries ───────────────────────────────────────────────────────
  const news = byName["news_impact_score"];
  if (news !== undefined && Math.abs(news) > 0.2) {
    const lbl = newsImpactLabel(news);
    insights.push({ label: lbl, signalName: "news_impact_score", priority: Math.abs(news) > 0.5 ? 1 : 2 });
  }

  const injHome = byName["injury_count_home"] ?? 0;
  const injAway = byName["injury_count_away"] ?? 0;
  if (injHome >= 2) {
    const lbl = injuryCountLabel(injHome);
    insights.push({
      label: { ...lbl, description: `${homeTeam}: ${lbl.description}` },
      signalName: "injury_count_home",
      priority: injHome >= 4 ? 1 : 2,
    });
  }
  if (injAway >= 2) {
    const lbl = injuryCountLabel(injAway);
    insights.push({
      label: { ...lbl, description: `${awayTeam}: ${lbl.description}` },
      signalName: "injury_count_away",
      priority: injAway >= 4 ? 1 : 2,
    });
  }

  // ── Context ───────────────────────────────────────────────────────────────
  const refCards = byName["referee_cards_avg"];
  if (refCards !== undefined && (refCards > 5 || refCards < 2.5)) {
    const lbl = refereeCardsLabel(refCards);
    insights.push({ label: lbl, signalName: "referee_cards_avg", priority: 4 });
  }

  const h2hPct = byName["h2h_win_pct"];
  const h2hTotal = byName["h2h_total"];
  if (h2hPct !== undefined && h2hTotal !== undefined && h2hTotal >= 3 && (h2hPct > 0.6 || h2hPct < 0.3)) {
    const lbl = h2hEdgeLabel(h2hPct, h2hTotal);
    const teamName = h2hPct > 0.6 ? homeTeam : awayTeam;
    insights.push({
      label: { ...lbl, description: `${teamName} dominates this fixture` },
      signalName: "h2h_win_pct",
      priority: 3,
    });
  }

  const eloDiff = byName["elo_diff"];
  if (eloDiff !== undefined && Math.abs(eloDiff) > 80) {
    const lbl = eloDiffLabel(eloDiff);
    insights.push({ label: lbl, signalName: "elo_diff", priority: Math.abs(eloDiff) > 200 ? 2 : 4 });
  }

  const leagueAvgGoals = byName["league_avg_goals"];
  if (leagueAvgGoals !== undefined && (leagueAvgGoals > 3.0 || leagueAvgGoals < 2.0)) {
    const lbl = leagueAvgGoalsLabel(leagueAvgGoals);
    insights.push({ label: lbl, signalName: "league_avg_goals", priority: 5 });
  }

  // ── Manager change ────────────────────────────────────────────────────────
  const mgrHome = byName["manager_change_home_days"];
  if (mgrHome !== undefined && mgrHome <= 21) {
    const lbl = managerChangeDaysLabel(Math.round(mgrHome));
    insights.push({
      label: { ...lbl, description: `${homeTeam}: ${lbl.description}` },
      signalName: "manager_change_home_days",
      priority: mgrHome <= 7 ? 1 : 2,
    });
  }
  const mgrAway = byName["manager_change_away_days"];
  if (mgrAway !== undefined && mgrAway <= 21) {
    const lbl = managerChangeDaysLabel(Math.round(mgrAway));
    insights.push({
      label: { ...lbl, description: `${awayTeam}: ${lbl.description}` },
      signalName: "manager_change_away_days",
      priority: mgrAway <= 7 ? 1 : 2,
    });
  }

  // ── Relegation pressure ───────────────────────────────────────────────────
  const relHome = byName["points_to_relegation_home"];
  if (relHome !== undefined && relHome <= 5) {
    const lbl = pointsToRelegationLabel(Math.round(relHome));
    insights.push({
      label: { ...lbl, description: `${homeTeam}: ${lbl.description}` },
      signalName: "points_to_relegation_home",
      priority: relHome <= 2 ? 1 : 2,
    });
  }
  const relAway = byName["points_to_relegation_away"];
  if (relAway !== undefined && relAway <= 5) {
    const lbl = pointsToRelegationLabel(Math.round(relAway));
    insights.push({
      label: { ...lbl, description: `${awayTeam}: ${lbl.description}` },
      signalName: "points_to_relegation_away",
      priority: relAway <= 2 ? 1 : 2,
    });
  }

  // ── Pinnacle sharp line move (if strong) ──────────────────────────────────
  const pinMoveHome = byName["pinnacle_line_move_home"];
  if (pinMoveHome !== undefined && Math.abs(pinMoveHome) > 0.04) {
    const lbl = pinnacleLineMoveLabel(pinMoveHome, "home");
    insights.push({ label: lbl, signalName: "pinnacle_line_move_home", priority: 1 });
  }
  const pinMoveAway = byName["pinnacle_line_move_away"];
  if (pinMoveAway !== undefined && Math.abs(pinMoveAway) > 0.04) {
    const lbl = pinnacleLineMoveLabel(pinMoveAway, "away");
    insights.push({ label: lbl, signalName: "pinnacle_line_move_away", priority: 1 });
  }

  // Sort by priority (lower = more important), keep top 5
  insights.sort((a, b) => a.priority - b.priority);
  return insights.slice(0, 5).map(({ label, signalName }) => ({ label, signalName }));
}

/** Build a post-match retrospective insight for Free users (SUX-10) */
function buildPostMatchInsight(
  signals: MatchSignalRow[],
  homeTeam: string,
  awayTeam: string,
  scoreHome: number,
  scoreAway: number
): string {
  const byName: Record<string, number> = {};
  for (const s of signals) byName[s.signal_name] = Number(s.signal_value);

  const winner = scoreHome > scoreAway ? homeTeam : scoreAway > scoreHome ? awayTeam : null;
  const scoreStr = `${scoreHome}–${scoreAway}`;

  const olm = byName["overnight_line_move"] ?? 0;
  const bdm = byName["bookmaker_disagreement"] ?? 0;
  const vol = byName["odds_volatility"] ?? 0;
  const injHome = byName["injury_count_home"] ?? 0;
  const injAway = byName["injury_count_away"] ?? 0;

  // Pick the most interesting signal detected
  if (Math.abs(olm) > 0.04 && winner) {
    const dir = olm > 0 ? homeTeam : awayTeam;
    if (dir === winner) {
      return `Sharp overnight money moved toward ${winner} before kickoff — they won ${scoreStr}.`;
    }
  }
  if (bdm > 0.12) {
    const result = winner ? `${winner} won ${scoreStr}` : `the match ended ${scoreStr}`;
    return `Bookmakers disagreed on this match — our signals flagged the uncertainty. ${result}.`;
  }
  if (vol > 0.008 && winner) {
    return `Odds were volatile before kickoff — our market signals picked up activity. ${winner} won ${scoreStr}.`;
  }
  if (injHome >= 3 && scoreAway > scoreHome) {
    return `${homeTeam} had ${injHome} absences — our signals detected the disruption. ${awayTeam} won ${scoreStr}.`;
  }
  if (injAway >= 3 && scoreHome > scoreAway) {
    return `${awayTeam} had ${injAway} absences — our signals detected the disruption. ${homeTeam} won ${scoreStr}.`;
  }
  // Generic fallback
  if (winner) return `Our model's signals tracked this match throughout. ${winner} won ${scoreStr}.`;
  return `Our model's signals tracked this match throughout. It ended ${scoreStr}.`;
}

/** Detect if signals diverge meaningfully from market consensus */
function detectSignalDivergence(signals: MatchSignalRow[]): {
  hasDivergence: boolean;
  description: string;
} {
  const byName: Record<string, number> = {};
  for (const s of signals) byName[s.signal_name] = Number(s.signal_value);

  const bdm = byName["bookmaker_disagreement"] ?? 0;
  const olm = byName["overnight_line_move"] ?? 0;
  const slopeHome = byName["form_slope_home"] ?? 0;
  const slopeAway = byName["form_slope_away"] ?? 0;

  // Sharp overnight move toward home but form suggests away is improving
  if (olm > 0.03 && slopeAway > 0.2 && slopeAway > slopeHome + 0.2) {
    return { hasDivergence: true, description: "Market moved toward Home, but Away form is trending stronger" };
  }
  if (olm < -0.03 && slopeHome > 0.2 && slopeHome > slopeAway + 0.2) {
    return { hasDivergence: true, description: "Market moved toward Away, but Home form is trending stronger" };
  }

  // High disagreement without a clear overnight directional move
  if (bdm > 0.12 && Math.abs(olm) < 0.015) {
    return { hasDivergence: true, description: "Bookmakers disagree significantly — no clear consensus on this match" };
  }

  return { hasDivergence: false, description: "" };
}

export function MatchSignalSummary({
  signals,
  isPro,
  isElite = false,
  homeTeam,
  awayTeam,
  matchStatus,
  scoreHome,
  scoreAway,
}: MatchSignalSummaryProps) {
  if (!signals.length) return null;

  const insights = buildSignalInsights(signals, homeTeam, awayTeam);

  // Count how many signals exist
  const totalSignals = new Set(signals.map((s) => s.signal_name)).size;
  const isFinished = matchStatus === "finished";

  // ── Free users: post-match reveal (SUX-10) or live teaser ─────────────────
  if (!isPro) {
    const topInsight = insights[0];

    // Post-match reveal for finished matches (SUX-10)
    if (isFinished && scoreHome != null && scoreAway != null) {
      const insight = buildPostMatchInsight(signals, homeTeam, awayTeam, scoreHome, scoreAway);
      return (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/30">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Signal Reveal</h3>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 ml-auto">
              Post-match
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-foreground leading-relaxed">{insight}</p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border-t border-border/30">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              Upgrade to Pro to see all {totalSignals} signals before kickoff
            </p>
            <a href="/profile" className="text-xs font-semibold text-primary hover:underline shrink-0">
              Upgrade →
            </a>
          </div>
        </div>
      );
    }

    // Pre-match teaser
    if (!topInsight) return null;
    return (
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/30">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Intelligence Summary</h3>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
            {totalSignals} signals
          </span>
        </div>
        {/* Show 1 free insight */}
        <div className="px-4">
          <SignalRow {...topInsight.label} />
        </div>
        {/* Lock banner for the rest */}
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border-t border-border/30">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">
            {insights.length > 1 ? `${insights.length - 1} more signals` : "Full analysis"} available on Pro
          </p>
          <a href="/profile" className="text-xs font-semibold text-primary hover:underline shrink-0">
            Upgrade →
          </a>
        </div>
      </div>
    );
  }

  // ── Pro/Elite: full signal summary ─────────────────────────────────────────
  const divergence = detectSignalDivergence(signals);
  const showEliteLock = !isElite; // Pro users see the Elite conversion hook

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/30">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Intelligence Summary</h3>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
          {totalSignals} signals
        </span>
      </div>

      {/* Signal divergence alert (SUX-7) */}
      {divergence.hasDivergence && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/20">
          <Zap className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-400">Signal divergence detected</p>
            <p className="text-[11px] text-muted-foreground">{divergence.description}</p>
          </div>
        </div>
      )}

      {insights.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            No notable signals for this match yet. Signals are written at 06:00 UTC.
          </p>
        </div>
      ) : (
        <div className="px-4">
          {insights.map(({ label, signalName }) => (
            <SignalRow key={signalName} {...label} />
          ))}
        </div>
      )}

      {/* Footer: stats + Pro→Elite conversion hook (SUX-7) */}
      {showEliteLock ? (
        <div className="border-t border-border/30 bg-muted/10">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              {totalSignals} signals analysed · Top {Math.min(insights.length, 5)} shown
            </p>
          </div>
          {/* Elite conversion hook */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-border/20">
            <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              Our model analysed all {totalSignals} signals. See the full probability breakdown and edge %.
            </p>
            <a
              href="/profile"
              className="shrink-0 rounded-md bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
            >
              Elite →
            </a>
          </div>
        </div>
      ) : insights.length > 0 ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/10 border-t border-border/30">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">
            {totalSignals} signals analysed · Top {Math.min(insights.length, 5)} shown
          </p>
        </div>
      ) : null}
    </div>
  );
}
