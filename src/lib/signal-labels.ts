/**
 * Signal translation layer (SUX-6)
 * Converts raw signal values into plain-English labels, icons, and severity levels.
 * Used by SUX-4 (summary tab), SUX-5 (accordion), SUX-7 (conversion hooks).
 */

export type SignalSeverity = "neutral" | "low" | "medium" | "high"

export interface SignalLabel {
  label: string
  icon: string
  severity: SignalSeverity
  description: string
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function formSlopeLabel(slope: number): SignalLabel {
  if (slope > 0.4) return { label: "Surging", icon: "↑↑", severity: "high", description: "Strong recent improvement" }
  if (slope > 0.15) return { label: "Improving", icon: "↑", severity: "medium", description: "Form trending up" }
  if (slope > -0.15) return { label: "Stable", icon: "→", severity: "neutral", description: "Consistent recent form" }
  if (slope > -0.4) return { label: "Declining", icon: "↓", severity: "medium", description: "Form trending down" }
  return { label: "Collapsing", icon: "↓↓", severity: "high", description: "Sharp recent decline" }
}

// ─── Market signals ───────────────────────────────────────────────────────────

export function oddsVolatilityLabel(vol: number): SignalLabel {
  if (vol > 0.008)
    return { label: "Volatile", icon: "⚡", severity: "high", description: "Odds moving sharply — market unsettled" }
  if (vol > 0.005)
    return { label: "Active", icon: "↕", severity: "medium", description: "Some odds movement detected" }
  return { label: "Stable", icon: "−", severity: "neutral", description: "Odds largely unchanged" }
}

export function overnightMoveLabel(olm: number): SignalLabel {
  const abs = Math.abs(olm)
  const dir = olm > 0 ? "↑" : "↓"
  if (abs > 0.04)
    return { label: `Sharp move ${dir}`, icon: "🔺", severity: "high", description: "Big overnight line move — sharp money signal" }
  if (abs > 0.03)
    return { label: `Moved ${dir}`, icon: "↕", severity: "medium", description: "Notable overnight line movement" }
  return { label: "Stable", icon: "−", severity: "neutral", description: "Opening line held steady overnight" }
}

export function bookmakerDisagreementLabel(bdm: number): SignalLabel {
  if (bdm > 0.12)
    return { label: "High disagreement", icon: "⚠", severity: "high", description: "Books disagree sharply — uncertainty in market" }
  if (bdm > 0.08)
    return { label: "Split", icon: "≈", severity: "medium", description: "Bookmakers pricing this differently" }
  return { label: "Consensus", icon: "✓", severity: "neutral", description: "Bookmakers broadly agree on price" }
}

// ─── Fixture importance ───────────────────────────────────────────────────────

export function fixtureImportanceLabel(imp: number): SignalLabel {
  if (imp > 0.7)
    return { label: "Decisive", icon: "🔥", severity: "high", description: "High-stakes fixture — title or relegation implications" }
  if (imp > 0.4)
    return { label: "Important", icon: "!", severity: "medium", description: "Meaningful standings implications" }
  return { label: "Routine", icon: "−", severity: "neutral", description: "Low direct impact on standings" }
}

export function importanceDiffLabel(diff: number): SignalLabel {
  const abs = Math.abs(diff)
  const who = diff > 0 ? "Home" : "Away"
  if (abs > 0.4)
    return { label: `${who} desperate`, icon: "⚡", severity: "high", description: `${who} side has much more to play for` }
  if (abs > 0.2)
    return { label: `${who} motivated`, icon: "↑", severity: "medium", description: `${who} side has more stake in this result` }
  return { label: "Even stakes", icon: "=", severity: "neutral", description: "Both sides have similar importance" }
}

// ─── News & injuries ──────────────────────────────────────────────────────────

export function newsImpactLabel(score: number): SignalLabel {
  if (score > 0.3)
    return { label: "Positive news", icon: "✓", severity: "low", description: "Recent news favors this team" }
  if (score < -0.3)
    return { label: "Negative news", icon: "✗", severity: "high", description: "Concerning news — key absences or disruption" }
  return { label: "Neutral", icon: "−", severity: "neutral", description: "No significant news impact" }
}

export function injuryCountLabel(count: number): SignalLabel {
  if (count >= 4)
    return { label: "Major disruption", icon: "🚑", severity: "high", description: `${count} players out — squad depth stretched` }
  if (count >= 2)
    return { label: "Some injuries", icon: "!", severity: "medium", description: `${count} injured players` }
  return { label: "Full strength", icon: "✓", severity: "neutral", description: "No notable injury concerns" }
}

// ─── Referee ──────────────────────────────────────────────────────────────────

export function refereeCardsLabel(avg: number): SignalLabel {
  if (avg > 5.5)
    return { label: "Card-heavy", icon: "🟨", severity: "high", description: "Referee averages many cards — physical match likely" }
  if (avg > 3.5)
    return { label: "Average", icon: "−", severity: "neutral", description: "Typical card rate" }
  return { label: "Clean", icon: "✓", severity: "low", description: "Referee lets the game flow" }
}

// ─── H2H ─────────────────────────────────────────────────────────────────────

export function h2hEdgeLabel(pct: number, total: number): SignalLabel {
  if (total < 3)
    return { label: "No data", icon: "?", severity: "neutral", description: "Insufficient head-to-head history" }
  if (pct > 0.65)
    return { label: "Strong edge", icon: "↑↑", severity: "high", description: "Dominant head-to-head record" }
  if (pct > 0.5)
    return { label: "Slight edge", icon: "↑", severity: "medium", description: "Positive head-to-head record" }
  if (pct < 0.35)
    return { label: "Disadvantage", icon: "↓", severity: "medium", description: "Poor head-to-head record vs this opponent" }
  return { label: "Even", icon: "=", severity: "neutral", description: "Balanced head-to-head history" }
}

// ─── ELO ─────────────────────────────────────────────────────────────────────

export function eloStrengthLabel(elo: number): SignalLabel {
  if (elo > 1700)
    return { label: "Elite", icon: "★", severity: "high", description: "Top-tier team by ELO rating" }
  if (elo > 1500)
    return { label: "Strong", icon: "↑", severity: "medium", description: "Above-average ELO rating" }
  if (elo > 1350)
    return { label: "Average", icon: "−", severity: "neutral", description: "Mid-table ELO range" }
  return { label: "Weak", icon: "↓", severity: "low", description: "Below-average ELO rating" }
}

export function eloDiffLabel(diff: number): SignalLabel {
  // diff = home_elo - away_elo
  if (diff > 200)
    return { label: "Heavy favourite", icon: "↑↑", severity: "high", description: "Home side significantly stronger by ELO" }
  if (diff > 80)
    return { label: "Favourite", icon: "↑", severity: "medium", description: "Home side stronger by ELO" }
  if (diff < -200)
    return { label: "Heavy underdog", icon: "↓↓", severity: "high", description: "Away side significantly stronger by ELO" }
  if (diff < -80)
    return { label: "Underdog", icon: "↓", severity: "medium", description: "Away side stronger by ELO" }
  return { label: "Even", icon: "=", severity: "neutral", description: "Teams closely matched by ELO" }
}

// ─── Sharp consensus ─────────────────────────────────────────────────────────

export function sharpConsensusLabel(val: number, selection: "home" | "draw" | "away" = "home"): SignalLabel {
  const who = selection === "home" ? "Home" : selection === "draw" ? "Draw" : "Away"
  if (val > 0.02)
    return { label: `Sharp on ${who}`, icon: "⚡", severity: "high", description: `Sharp books price ${who} significantly higher than soft books` }
  if (val > 0.005)
    return { label: `Slight sharp lean ${who}`, icon: "↑", severity: "medium", description: `Mild sharp-book preference for ${who}` }
  if (val < -0.02)
    return { label: `Sharps fade ${who}`, icon: "↓", severity: "high", description: `Sharp books price ${who} lower than soft books — fading signal` }
  if (val < -0.005)
    return { label: `Mild fade ${who}`, icon: "↓", severity: "medium", description: `Soft books slightly more bullish on ${who} than sharps` }
  return { label: "No sharp lean", icon: "=", severity: "neutral", description: "Sharp and soft books broadly agree on this price" }
}

// ─── Doubtful players ────────────────────────────────────────────────────────

export function playersDoubtfulLabel(count: number): SignalLabel {
  if (count >= 3)
    return { label: "Several doubtful", icon: "?", severity: "high", description: `${count} players with uncertain availability — line likely to move on team news` }
  if (count >= 1)
    return { label: "Players doubtful", icon: "?", severity: "medium", description: `${count} player(s) listed as doubtful — watch for late team news` }
  return { label: "None doubtful", icon: "✓", severity: "neutral", description: "No players with uncertain availability" }
}

// ─── Injury uncertainty ───────────────────────────────────────────────────────

export function injuryUncertaintyLabel(count: number): SignalLabel {
  if (count >= 3)
    return { label: "High uncertainty", icon: "⚠", severity: "high", description: `${count} uncertain players — market cannot fully price this squad` }
  if (count >= 1)
    return { label: "Some uncertainty", icon: "?", severity: "medium", description: `${count} doubtful player(s) — partial market inefficiency possible` }
  return { label: "Clear squad", icon: "✓", severity: "neutral", description: "Squad situation clear — low pre-match uncertainty" }
}

// ─── League stats ─────────────────────────────────────────────────────────────

export function leagueAvgGoalsLabel(avg: number): SignalLabel {
  if (avg > 3.0)
    return { label: "High scoring", icon: "⚽⚽", severity: "medium", description: "League averages many goals per game" }
  if (avg > 2.4)
    return { label: "Average goals", icon: "⚽", severity: "neutral", description: "Typical goal rate for this league" }
  return { label: "Low scoring", icon: "−", severity: "low", description: "Tight league — goals at a premium" }
}

export function leagueOver25PctLabel(pct: number): SignalLabel {
  if (pct > 0.60)
    return { label: "Over-heavy league", icon: "⚽⚽", severity: "medium", description: `${Math.round(pct * 100)}% of matches go over 2.5 goals — open league` }
  if (pct > 0.50)
    return { label: "Over-friendly", icon: "⚽", severity: "low", description: `${Math.round(pct * 100)}% over 2.5 — slightly above average` }
  if (pct < 0.40)
    return { label: "Low-scoring league", icon: "−", severity: "low", description: `Only ${Math.round(pct * 100)}% over 2.5 — defensive league` }
  return { label: "Balanced scoring", icon: "=", severity: "neutral", description: `${Math.round(pct * 100)}% over 2.5 — average for this league` }
}

export function leagueBttsPctLabel(pct: number): SignalLabel {
  if (pct > 0.60)
    return { label: "BTTS-heavy", icon: "⚽", severity: "medium", description: `${Math.round(pct * 100)}% both teams score — expect goals at both ends` }
  if (pct > 0.50)
    return { label: "BTTS-likely", icon: "↑", severity: "low", description: `${Math.round(pct * 100)}% BTTS rate — slightly above average` }
  if (pct < 0.38)
    return { label: "One-sided league", icon: "↓", severity: "low", description: `Only ${Math.round(pct * 100)}% BTTS — clean sheets common` }
  return { label: "Average BTTS", icon: "=", severity: "neutral", description: `${Math.round(pct * 100)}% BTTS rate — typical` }
}

// ─── Injury recurrence ────────────────────────────────────────────────────────

export function injuryRecurrenceLabel(avg: number): SignalLabel {
  if (avg >= 5)
    return { label: "Injury-prone squad", icon: "🚑", severity: "high", description: "Currently-injured players have a long injury history — chronic issues" }
  if (avg >= 3)
    return { label: "Some recurrence", icon: "!", severity: "medium", description: "Injured players have had repeat issues before" }
  return { label: "Isolated injuries", icon: "−", severity: "neutral", description: "No pattern of repeat injuries" }
}

// ─── Squad disruption (transfers) ────────────────────────────────────────────

export function squadDisruptionLabel(arrivals: number): SignalLabel {
  if (arrivals >= 5)
    return { label: "Heavily rebuilt", icon: "⚠", severity: "high", description: `${arrivals} new arrivals in 60 days — unfamiliar system likely` }
  if (arrivals >= 3)
    return { label: "Some new faces", icon: "↕", severity: "medium", description: `${arrivals} recent transfers in — settling-in risk` }
  if (arrivals >= 1)
    return { label: "Minor turnover", icon: "−", severity: "low", description: `${arrivals} transfer in last 60 days` }
  return { label: "Stable squad", icon: "✓", severity: "neutral", description: "No recent transfer activity" }
}

// ─── Group 2 signal refinements ───────────────────────────────────────────────

export function restDaysNormLabel(logVal: number): SignalLabel {
  // log(rest_days+1): log(4)≈1.39 (3 days), log(8)≈2.08 (7 days), log(15)≈2.71 (14 days)
  if (logVal >= 2.3)
    return { label: "Well rested", icon: "✓", severity: "low", description: "7+ days since last match — fully recovered" }
  if (logVal >= 1.6)
    return { label: "Rested", icon: "↑", severity: "low", description: "4–6 days — good recovery time" }
  if (logVal >= 1.1)
    return { label: "Normal", icon: "=", severity: "neutral", description: "3 days since last match — standard schedule" }
  if (logVal >= 0.7)
    return { label: "Short turnaround", icon: "↓", severity: "medium", description: "2 days since last match — fatigue risk" }
  return { label: "Quick turnaround", icon: "↓↓", severity: "high", description: "1 day or same day — significant fatigue risk" }
}

export function fixtureUrgencyLabel(urgency: number): SignalLabel {
  // Points-gap urgency normalized by games remaining. >1.0 = mathematically dire
  if (urgency > 1.0)
    return { label: "Must-win situation", icon: "🔥", severity: "high", description: "Team is in a mathematically desperate position" }
  if (urgency >= 0.7)
    return { label: "High pressure", icon: "⚠", severity: "high", description: "Points gap is critical given games remaining" }
  if (urgency >= 0.4)
    return { label: "Under pressure", icon: "↑", severity: "medium", description: "Position is uncomfortable with games running out" }
  if (urgency >= 0.15)
    return { label: "Some pressure", icon: "−", severity: "low", description: "Some urgency but manageable" }
  return { label: "Low urgency", icon: "=", severity: "neutral", description: "Comfortable position relative to season stage" }
}

export function turfFamiliarityLabel(games: number): SignalLabel {
  if (games >= 5)
    return { label: "Turf veteran", icon: "✓", severity: "neutral", description: `${games} away games on artificial turf this season — well adapted` }
  if (games >= 3)
    return { label: "Some turf exp.", icon: "=", severity: "low", description: `${games} away turf games — familiar with surface` }
  if (games >= 1)
    return { label: "Limited turf exp.", icon: "↓", severity: "medium", description: `Only ${games} away turf game(s) — limited experience` }
  return { label: "No turf exp.", icon: "⚠", severity: "high", description: "No away games on artificial turf this season — potential disadvantage" }
}

export function formVsEloLabel(residual: number): SignalLabel {
  // Positive = team performing above ELO expectation (hot streak)
  if (residual > 0.5)
    return { label: "Hot streak", icon: "↑↑", severity: "high", description: "Team is significantly outperforming their ELO rating lately" }
  if (residual > 0.2)
    return { label: "Above expectation", icon: "↑", severity: "medium", description: "Recent results better than ELO quality suggests" }
  if (residual > -0.2)
    return { label: "As expected", icon: "=", severity: "neutral", description: "Recent form matches ELO quality" }
  if (residual > -0.5)
    return { label: "Below expectation", icon: "↓", severity: "medium", description: "Recent results below ELO rating — potential regression inbound" }
  return { label: "Cold streak", icon: "↓↓", severity: "high", description: "Team underperforming their quality by a wide margin" }
}

// ─── Half-time tendency ───────────────────────────────────────────────────────

export function h1ShotDominanceLabel(ratio: number): SignalLabel {
  // ratio = H1 shots / full-match shots (0.5 = equal halves)
  if (ratio > 0.62)
    return { label: "Fast starters", icon: "↑", severity: "medium", description: "Team takes most of their shots in the first half" }
  if (ratio < 0.38)
    return { label: "Slow starters", icon: "↓", severity: "medium", description: "Team typically takes over in the second half" }
  return { label: "Balanced", icon: "=", severity: "neutral", description: "Shot output spread evenly across both halves" }
}

/**
 * Human-readable signal group names for use in UI headers.
 */
export const SIGNAL_GROUP_LABELS: Record<string, string> = {
  model: "Model Predictions",
  market: "Market Signals",
  quality: "Team Quality",
  information: "News & Injuries",
  context: "Context",
  live: "Live",
}

