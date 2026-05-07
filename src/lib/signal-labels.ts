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

// ─── Pinnacle market signals ──────────────────────────────────────────────────

export function pinnacleImpliedLabel(prob: number, selection: "home" | "draw" | "away"): SignalLabel {
  const who = selection === "home" ? "Home" : selection === "draw" ? "Draw" : "Away"
  return {
    label: `Pinnacle ${who}`,
    icon: "📌",
    severity: "neutral",
    description: `Pinnacle fair probability (vig-removed): ${(prob * 100).toFixed(1)}%`,
  }
}

export function pinnacleLineMoveLabel(move: number, selection: "home" | "draw" | "away"): SignalLabel {
  const who = selection === "home" ? "Home" : selection === "draw" ? "Draw" : "Away"
  const abs = Math.abs(move)
  const dir = move > 0 ? "shortened" : "drifted"
  if (abs > 0.04)
    return { label: `${who} sharp move`, icon: "🔺", severity: "high", description: `Pinnacle ${who} has ${dir} ${(abs * 100).toFixed(1)}pp since open — strong sharp signal` }
  if (abs > 0.02)
    return { label: `${who} moved`, icon: "↕", severity: "medium", description: `Pinnacle ${who} ${dir} ${(abs * 100).toFixed(1)}pp — notable line movement` }
  return { label: `${who} stable`, icon: "−", severity: "neutral", description: `Pinnacle ${who} line largely unchanged since open` }
}

export function pinnacleAHLineLabel(line: number): SignalLabel {
  if (line > 0.5)
    return { label: `Home +${line}`, icon: "↑", severity: "medium", description: `Pinnacle gives home team a ${line} goal head start — away favoured` }
  if (line < -0.5)
    return { label: `Home ${line}`, icon: "↓", severity: "medium", description: `Home team gives ${Math.abs(line)} goal head start — clear home favourite` }
  return { label: "Pick-em AH", icon: "=", severity: "neutral", description: "Asian Handicap is near level — evenly matched teams" }
}

export function pinnacleAHMoveLabel(move: number): SignalLabel {
  const abs = Math.abs(move)
  if (abs >= 0.5)
    return { label: "AH line shifted", icon: "⚡", severity: "high", description: `AH line moved ${move > 0 ? "toward home" : "toward away"} by ${abs} goals — significant sharp activity` }
  if (abs >= 0.25)
    return { label: "AH moving", icon: "↕", severity: "medium", description: `AH line shifted ${move > 0 ? "toward home" : "toward away"} — some sharp action` }
  return { label: "AH stable", icon: "−", severity: "neutral", description: "Asian Handicap line unchanged since open" }
}

export function ahBookmakerDisagreementLabel(val: number): SignalLabel {
  if (val > 0.15)
    return { label: "AH disagreement", icon: "⚠", severity: "high", description: "Books split on the handicap line — uncertain team strength assessment" }
  if (val > 0.08)
    return { label: "AH split", icon: "≈", severity: "medium", description: "Some bookmaker disagreement on Asian Handicap" }
  return { label: "AH consensus", icon: "✓", severity: "neutral", description: "Books broadly agree on the Asian Handicap" }
}

export function pinnacleOULabel(overProb: number): SignalLabel {
  if (overProb > 0.65)
    return { label: "High-scoring likely", icon: "⚽⚽", severity: "medium", description: `Pinnacle prices Over 2.5 at ${(overProb * 100).toFixed(1)}% — goal-heavy match expected` }
  if (overProb > 0.55)
    return { label: "Slight Over lean", icon: "⚽", severity: "low", description: `Pinnacle Over 2.5 at ${(overProb * 100).toFixed(1)}%` }
  if (overProb < 0.40)
    return { label: "Low-scoring likely", icon: "−", severity: "low", description: `Pinnacle prices Under 2.5 strongly — tight match expected` }
  return { label: "O/U balanced", icon: "=", severity: "neutral", description: `Pinnacle Over 2.5 at ${(overProb * 100).toFixed(1)}% — close call` }
}

export function pinnacleBTTSLabel(prob: number): SignalLabel {
  if (prob > 0.65)
    return { label: "BTTS likely", icon: "⚽", severity: "medium", description: `Pinnacle prices both teams to score at ${(prob * 100).toFixed(1)}%` }
  if (prob > 0.55)
    return { label: "BTTS leaning", icon: "↑", severity: "low", description: `Pinnacle BTTS at ${(prob * 100).toFixed(1)}% — slight lean` }
  if (prob < 0.38)
    return { label: "BTTS unlikely", icon: "↓", severity: "low", description: `Pinnacle BTTS only ${(prob * 100).toFixed(1)}% — clean sheet expected` }
  return { label: "BTTS neutral", icon: "=", severity: "neutral", description: `Pinnacle BTTS at ${(prob * 100).toFixed(1)}%` }
}

// ─── Manager change ───────────────────────────────────────────────────────────

export function managerChangeDaysLabel(days: number): SignalLabel {
  if (days <= 7)
    return { label: "New manager", icon: "👤", severity: "high", description: `Manager changed ${days} day${days === 1 ? "" : "s"} ago — new manager bounce possible, tactical uncertainty high` }
  if (days <= 21)
    return { label: "Recent manager change", icon: "↕", severity: "medium", description: `Manager changed ${days} days ago — team still adjusting to new system` }
  return { label: "Manager settled", icon: "=", severity: "low", description: `Manager changed ${days} days ago — squad likely settled` }
}

// ─── Venue surface ────────────────────────────────────────────────────────────

export function venueSurfaceLabel(isArtificial: boolean): SignalLabel {
  if (isArtificial)
    return { label: "Artificial turf", icon: "🟩", severity: "medium", description: "Home team plays on artificial turf — away teams often uncomfortable on this surface" }
  return { label: "Natural grass", icon: "✓", severity: "neutral", description: "Standard grass pitch" }
}

// ─── H2H depth ────────────────────────────────────────────────────────────────

export function h2hGoalDiffLabel(diff: number): SignalLabel {
  // diff from home team's perspective (positive = home scores more in H2H)
  if (diff > 1.0)
    return { label: "Home dominates H2H goals", icon: "↑↑", severity: "high", description: `Home team outscores away by ${diff.toFixed(1)} goals/game in H2H meetings` }
  if (diff > 0.4)
    return { label: "Home H2H edge", icon: "↑", severity: "medium", description: `Home scores more than away by ${diff.toFixed(1)} goals/game historically` }
  if (diff < -1.0)
    return { label: "Away dominates H2H goals", icon: "↓↓", severity: "high", description: `Away team outscores home by ${Math.abs(diff).toFixed(1)} goals/game in H2H meetings` }
  if (diff < -0.4)
    return { label: "Away H2H goal edge", icon: "↓", severity: "medium", description: `Away scores more than home by ${Math.abs(diff).toFixed(1)} goals/game historically` }
  return { label: "H2H goals even", icon: "=", severity: "neutral", description: "Goals roughly even in historical H2H meetings" }
}

export function h2hRecencyLabel(premium: number): SignalLabel {
  // premium = (last 3 win rate) - (overall win rate), from home perspective
  if (premium > 0.25)
    return { label: "Recent H2H improving", icon: "↑", severity: "medium", description: "Home side has done better in recent meetings than H2H overall suggests" }
  if (premium < -0.25)
    return { label: "Recent H2H declining", icon: "↓", severity: "medium", description: "Home side has done worse in recent meetings than the H2H history suggests" }
  return { label: "H2H trend stable", icon: "=", severity: "neutral", description: "Recent meetings in line with overall H2H record" }
}

// ─── Season goals averages ────────────────────────────────────────────────────

export function goalsForAvgLabel(avg: number): SignalLabel {
  if (avg > 2.2)
    return { label: "Strong attack", icon: "⚽⚽", severity: "high", description: `${avg.toFixed(2)} goals scored per game this season` }
  if (avg > 1.6)
    return { label: "Good attack", icon: "⚽", severity: "medium", description: `${avg.toFixed(2)} goals per game — above average output` }
  if (avg < 1.0)
    return { label: "Weak attack", icon: "↓", severity: "medium", description: `Only ${avg.toFixed(2)} goals per game — struggling to score` }
  return { label: "Average attack", icon: "=", severity: "neutral", description: `${avg.toFixed(2)} goals per game this season` }
}

export function goalsAgainstAvgLabel(avg: number): SignalLabel {
  if (avg < 0.8)
    return { label: "Solid defence", icon: "🛡", severity: "high", description: `Only ${avg.toFixed(2)} goals conceded per game — very tight` }
  if (avg < 1.2)
    return { label: "Good defence", icon: "↑", severity: "medium", description: `${avg.toFixed(2)} goals conceded per game — above average` }
  if (avg > 2.0)
    return { label: "Leaky defence", icon: "↓↓", severity: "high", description: `${avg.toFixed(2)} goals conceded per game — vulnerable at the back` }
  if (avg > 1.6)
    return { label: "Weak defence", icon: "↓", severity: "medium", description: `${avg.toFixed(2)} goals conceded per game — defensive issues` }
  return { label: "Average defence", icon: "=", severity: "neutral", description: `${avg.toFixed(2)} goals conceded per game` }
}

// ─── Relegation / title pressure ─────────────────────────────────────────────

export function pointsToRelegationLabel(pts: number): SignalLabel {
  if (pts <= 2)
    return { label: "Relegation battle", icon: "🔴", severity: "high", description: `Only ${pts} point${pts === 1 ? "" : "s"} above the drop zone — must-win territory` }
  if (pts <= 5)
    return { label: "Danger zone", icon: "⚠", severity: "high", description: `${pts} points above relegation — under serious threat` }
  if (pts <= 10)
    return { label: "Relegation concern", icon: "↓", severity: "medium", description: `${pts} points above the drop — within range` }
  return { label: "Safe", icon: "✓", severity: "neutral", description: `${pts} points above relegation — comfortable position` }
}

export function pointsToTitleLabel(pts: number): SignalLabel {
  if (pts === 0)
    return { label: "Title leader", icon: "★", severity: "high", description: "This team is currently top of the league" }
  if (pts <= 3)
    return { label: "Title race", icon: "↑↑", severity: "high", description: `${pts} point${pts === 1 ? "" : "s"} off the top — deep in title contention` }
  if (pts <= 7)
    return { label: "Title outsider", icon: "↑", severity: "medium", description: `${pts} points off the lead — still in contention` }
  return { label: "Out of title race", icon: "=", severity: "neutral", description: `${pts} points behind the leaders` }
}

// ─── Referee over 2.5 ────────────────────────────────────────────────────────

export function refereeOver25Label(pct: number): SignalLabel {
  if (pct > 0.65)
    return { label: "Goals-friendly ref", icon: "⚽", severity: "medium", description: `${(pct * 100).toFixed(0)}% of matches with this referee go over 2.5 goals` }
  if (pct < 0.40)
    return { label: "Tight-game ref", icon: "−", severity: "low", description: `Only ${(pct * 100).toFixed(0)}% of this referee's matches go over 2.5 — tends toward low-scoring games` }
  return { label: "Average O/U rate", icon: "=", severity: "neutral", description: `${(pct * 100).toFixed(0)}% over 2.5 with this referee — typical` }
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
  specialist: "Specialist Markets",
  live: "Live",
}

