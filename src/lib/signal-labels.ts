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

// ─── League stats ─────────────────────────────────────────────────────────────

export function leagueAvgGoalsLabel(avg: number): SignalLabel {
  if (avg > 3.0)
    return { label: "High scoring", icon: "⚽⚽", severity: "medium", description: "League averages many goals per game" }
  if (avg > 2.4)
    return { label: "Average goals", icon: "⚽", severity: "neutral", description: "Typical goal rate for this league" }
  return { label: "Low scoring", icon: "−", severity: "low", description: "Tight league — goals at a premium" }
}

// ─── Consolidated entry point ─────────────────────────────────────────────────

/**
 * Translate any signal name + value into a human-readable label.
 * Returns null for unknown signals so callers can skip gracefully.
 */
export function signalLabel(name: string, value: number): SignalLabel | null {
  switch (name) {
    case "form_slope_home":
    case "form_slope_away":
      return formSlopeLabel(value)

    case "odds_volatility":
      return oddsVolatilityLabel(value)

    case "overnight_line_move":
      return overnightMoveLabel(value)

    case "bookmaker_disagreement":
      return bookmakerDisagreementLabel(value)

    case "fixture_importance":
    case "fixture_importance_home":
    case "fixture_importance_away":
      return fixtureImportanceLabel(value)

    case "importance_diff":
      return importanceDiffLabel(value)

    case "news_impact_score":
      return newsImpactLabel(value)

    case "injury_count_home":
    case "injury_count_away":
      return injuryCountLabel(value)

    case "referee_cards_avg":
      return refereeCardsLabel(value)

    case "h2h_win_pct":
      return h2hEdgeLabel(value, 10) // can't know total here; callers should use h2hEdgeLabel directly

    case "elo_home":
    case "elo_away":
      return eloStrengthLabel(value)

    case "elo_diff":
      return eloDiffLabel(value)

    case "league_avg_goals":
      return leagueAvgGoalsLabel(value)

    default:
      return null
  }
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

/**
 * The 9 pulse signals used for SUX-1/2/3 badges (matches PULSE_SIGNAL_NAMES in engine-data.ts).
 */
export const PULSE_SIGNALS = [
  "bookmaker_disagreement",
  "importance_diff",
  "overnight_line_move",
  "odds_volatility",
  "form_slope_home",
  "form_slope_away",
  "injury_count_home",
  "injury_count_away",
  "news_impact_score",
] as const

export type PulseSignalName = (typeof PULSE_SIGNALS)[number]
