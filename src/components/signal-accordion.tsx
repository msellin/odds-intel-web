"use client";

/**
 * SUX-5: Signal Group Accordion
 * Accordion cards showing signal groups in priority order:
 *   1. Market (bookmaker disagreement, overnight move, volatility)
 *   2. Form & Strength (ELO, form, goals)
 *   3. Context (fixture importance, referee, league meta)
 *   4. News & Injuries (injury counts, news score)
 */

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
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
  injuryRecurrenceLabel,
  squadDisruptionLabel,
  h1ShotDominanceLabel,
  refereeCardsLabel,
  refereeOver25Label,
  h2hEdgeLabel,
  h2hGoalDiffLabel,
  h2hRecencyLabel,
  eloDiffLabel,
  eloStrengthLabel,
  leagueAvgGoalsLabel,
  leagueOver25PctLabel,
  leagueBttsPctLabel,
  sharpConsensusLabel,
  playersDoubtfulLabel,
  injuryUncertaintyLabel,
  managerChangeDaysLabel,
  venueSurfaceLabel,
  goalsForAvgLabel,
  goalsAgainstAvgLabel,
  pointsToRelegationLabel,
  pointsToTitleLabel,
  pinnacleImpliedLabel,
  pinnacleLineMoveLabel,
  pinnacleAHLineLabel,
  pinnacleAHMoveLabel,
  ahBookmakerDisagreementLabel,
  pinnacleOULabel,
  pinnacleBTTSLabel,
  restDaysNormLabel,
  fixtureUrgencyLabel,
  turfFamiliarityLabel,
  formVsEloLabel,
  bookmakerCountLabel,
  leagueEloVarianceLabel,
  leagueEloRangeLabel,
  SIGNAL_GROUP_LABELS,
  type SignalSeverity,
} from "@/lib/signal-labels";

interface SignalAccordionProps {
  signals: MatchSignalRow[];
  isPro: boolean;
  isElite: boolean;
  homeTeam: string;
  awayTeam: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalItem {
  label: string;
  icon: string;
  value: string;
  severity: SignalSeverity;
  description: string;
}

interface SignalGroup {
  id: string;
  title: string;
  icon: string;
  color: string; // tailwind border-l color class
  items: SignalItem[];
  requiresPro?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const SEVERITY_DOT: Record<SignalSeverity, string> = {
  neutral: "bg-muted-foreground/40",
  low: "bg-sky-400/60",
  medium: "bg-amber-400",
  high: "bg-emerald-400",
  negative: "bg-rose-400",
};

const SEVERITY_LABEL_COLOR: Record<SignalSeverity, string> = {
  neutral: "text-muted-foreground",
  low: "text-sky-400",
  medium: "text-amber-400",
  high: "text-emerald-400",
  negative: "text-rose-400",
};

// ─── Build signal groups from flat EAV rows ───────────────────────────────────

function buildGroups(
  signals: MatchSignalRow[],
  homeTeam: string,
  awayTeam: string
): SignalGroup[] {
  const byName: Record<string, number> = {};
  for (const s of signals) byName[s.signal_name] = Number(s.signal_value);

  const has = (name: string) => byName[name] !== undefined;
  const get = (name: string, fallback = 0) => byName[name] ?? fallback;

  // ── Market group ────────────────────────────────────────────────────────────
  const marketItems: SignalItem[] = [];
  if (has("bookmaker_count_active")) {
    const cnt = Math.round(get("bookmaker_count_active"));
    const l = bookmakerCountLabel(cnt);
    marketItems.push({ ...l, value: `${cnt} bookmakers` });
  }
  if (has("bookmaker_disagreement")) {
    const l = bookmakerDisagreementLabel(get("bookmaker_disagreement"));
    marketItems.push({ ...l, value: fmt(get("bookmaker_disagreement"), 3) });
  }
  if (has("overnight_line_move")) {
    const l = overnightMoveLabel(get("overnight_line_move"));
    marketItems.push({ ...l, value: fmt(get("overnight_line_move"), 3) });
  }
  if (has("odds_volatility")) {
    const l = oddsVolatilityLabel(get("odds_volatility"));
    marketItems.push({ ...l, value: fmt(get("odds_volatility"), 4) });
  }
  if (has("market_implied_home") && has("market_implied_draw") && has("market_implied_away")) {
    marketItems.push({
      label: "Market implied",
      icon: "📊",
      severity: "neutral",
      description: `Home ${pct(get("market_implied_home"))} / Draw ${pct(get("market_implied_draw"))} / Away ${pct(get("market_implied_away"))}`,
      value: "",
    });
  }
  if (has("sharp_consensus_home")) {
    const l = sharpConsensusLabel(get("sharp_consensus_home"), "home");
    marketItems.push({ ...l, value: fmt(get("sharp_consensus_home"), 4) });
  }
  if (has("sharp_consensus_draw")) {
    const l = sharpConsensusLabel(get("sharp_consensus_draw"), "draw");
    marketItems.push({ ...l, value: fmt(get("sharp_consensus_draw"), 4) });
  }
  if (has("sharp_consensus_away")) {
    const l = sharpConsensusLabel(get("sharp_consensus_away"), "away");
    marketItems.push({ ...l, value: fmt(get("sharp_consensus_away"), 4) });
  }
  if (has("pinnacle_implied_home") && has("pinnacle_implied_draw") && has("pinnacle_implied_away")) {
    marketItems.push({
      label: "Pinnacle fair odds",
      icon: "📌",
      severity: "neutral",
      description: `Pinnacle vig-removed: Home ${pct(get("pinnacle_implied_home"))} / Draw ${pct(get("pinnacle_implied_draw"))} / Away ${pct(get("pinnacle_implied_away"))}`,
      value: "",
    });
  }
  if (has("pinnacle_line_move_home")) {
    const l = pinnacleLineMoveLabel(get("pinnacle_line_move_home"), "home");
    marketItems.push({ ...l, value: `${get("pinnacle_line_move_home") > 0 ? "+" : ""}${(get("pinnacle_line_move_home") * 100).toFixed(1)}pp` });
  }
  if (has("pinnacle_line_move_draw")) {
    const l = pinnacleLineMoveLabel(get("pinnacle_line_move_draw"), "draw");
    marketItems.push({ ...l, value: `${get("pinnacle_line_move_draw") > 0 ? "+" : ""}${(get("pinnacle_line_move_draw") * 100).toFixed(1)}pp` });
  }
  if (has("pinnacle_line_move_away")) {
    const l = pinnacleLineMoveLabel(get("pinnacle_line_move_away"), "away");
    marketItems.push({ ...l, value: `${get("pinnacle_line_move_away") > 0 ? "+" : ""}${(get("pinnacle_line_move_away") * 100).toFixed(1)}pp` });
  }
  if (has("pinnacle_implied_over25")) {
    const l = pinnacleOULabel(get("pinnacle_implied_over25"));
    marketItems.push({ ...l, value: `Over ${pct(get("pinnacle_implied_over25"))}` });
  }

  // ── Form & Strength group ───────────────────────────────────────────────────
  const formItems: SignalItem[] = [];
  if (has("elo_diff")) {
    const l = eloDiffLabel(get("elo_diff"));
    const eloH = get("elo_home");
    const eloA = get("elo_away");
    formItems.push({
      ...l,
      value: `${fmt(eloH, 0)} vs ${fmt(eloA, 0)}`,
      description: `${homeTeam}: ${eloStrengthLabel(eloH).label} · ${awayTeam}: ${eloStrengthLabel(eloA).label}`,
    });
  }
  if (has("form_slope_home")) {
    const l = formSlopeLabel(get("form_slope_home"));
    formItems.push({ ...l, value: fmt(get("form_slope_home"), 2), description: `${homeTeam}: ${l.description}` });
  }
  if (has("form_slope_away")) {
    const l = formSlopeLabel(get("form_slope_away"));
    formItems.push({ ...l, value: fmt(get("form_slope_away"), 2), description: `${awayTeam}: ${l.description}` });
  }
  if (has("form_ppg_home") && has("form_ppg_away")) {
    formItems.push({
      label: "Points per game",
      icon: "📈",
      severity: "neutral",
      value: "",
      description: `${homeTeam}: ${fmt(get("form_ppg_home"))} PPG · ${awayTeam}: ${fmt(get("form_ppg_away"))} PPG (10-match rolling)`,
    });
  }
  if (has("h2h_win_pct") && has("h2h_total")) {
    const l = h2hEdgeLabel(get("h2h_win_pct"), get("h2h_total"));
    formItems.push({
      ...l,
      value: `${Math.round(get("h2h_win_pct") * 100)}% (${Math.round(get("h2h_total"))} meetings)`,
      description: `${homeTeam} home H2H win rate`,
    });
  }
  if (has("h2h_avg_goal_diff")) {
    const l = h2hGoalDiffLabel(get("h2h_avg_goal_diff"));
    formItems.push({ ...l, value: `${get("h2h_avg_goal_diff") > 0 ? "+" : ""}${get("h2h_avg_goal_diff").toFixed(2)}` });
  }
  if (has("h2h_recency_premium")) {
    const l = h2hRecencyLabel(get("h2h_recency_premium"));
    formItems.push({ ...l, value: `${get("h2h_recency_premium") > 0 ? "+" : ""}${(get("h2h_recency_premium") * 100).toFixed(1)}pp` });
  }
  if (has("goals_for_avg_home") && has("goals_against_avg_home")) {
    const lf = goalsForAvgLabel(get("goals_for_avg_home"));
    formItems.push({
      ...lf,
      value: `${fmt(get("goals_for_avg_home"))} scored / ${fmt(get("goals_against_avg_home"))} conceded`,
      description: `${homeTeam}: season average per game`,
    });
  }
  if (has("goals_for_avg_away") && has("goals_against_avg_away")) {
    const lf = goalsForAvgLabel(get("goals_for_avg_away"));
    formItems.push({
      ...lf,
      value: `${fmt(get("goals_for_avg_away"))} scored / ${fmt(get("goals_against_avg_away"))} conceded`,
      description: `${awayTeam}: season average per game`,
    });
  }
  if (has("goals_for_venue_home") && has("goals_against_venue_home")) {
    formItems.push({
      label: "Home venue record",
      icon: "🏠",
      severity: "neutral",
      value: `${fmt(get("goals_for_venue_home"))} / ${fmt(get("goals_against_venue_home"))}`,
      description: `${homeTeam} at home: ${fmt(get("goals_for_venue_home"))} scored, ${fmt(get("goals_against_venue_home"))} conceded per game`,
    });
  }
  if (has("goals_for_venue_away") && has("goals_against_venue_away")) {
    formItems.push({
      label: "Away venue record",
      icon: "✈",
      severity: "neutral",
      value: `${fmt(get("goals_for_venue_away"))} / ${fmt(get("goals_against_venue_away"))}`,
      description: `${awayTeam} away: ${fmt(get("goals_for_venue_away"))} scored, ${fmt(get("goals_against_venue_away"))} conceded per game`,
    });
  }
  if (has("rest_days_home") && has("rest_days_away")) {
    formItems.push({
      label: "Rest days",
      icon: "🛌",
      severity: "neutral",
      value: "",
      description: `${homeTeam}: ${Math.round(get("rest_days_home"))} days · ${awayTeam}: ${Math.round(get("rest_days_away"))} days since last match`,
    });
  }
  if (has("rest_days_norm_home")) {
    const lh = restDaysNormLabel(get("rest_days_norm_home"));
    formItems.push({ ...lh, value: fmt(get("rest_days_norm_home"), 2), description: `${homeTeam} rest: ${lh.description}` });
  }
  if (has("rest_days_norm_away")) {
    const la = restDaysNormLabel(get("rest_days_norm_away"));
    formItems.push({ ...la, value: fmt(get("rest_days_norm_away"), 2), description: `${awayTeam} rest: ${la.description}` });
  }
  if (has("form_vs_elo_expectation_home")) {
    const l = formVsEloLabel(get("form_vs_elo_expectation_home"));
    formItems.push({ ...l, value: fmt(get("form_vs_elo_expectation_home"), 2), description: `${homeTeam}: ${l.description}` });
  }
  if (has("form_vs_elo_expectation_away")) {
    const l = formVsEloLabel(get("form_vs_elo_expectation_away"));
    formItems.push({ ...l, value: fmt(get("form_vs_elo_expectation_away"), 2), description: `${awayTeam}: ${l.description}` });
  }

  // ── Context group ───────────────────────────────────────────────────────────
  const contextItems: SignalItem[] = [];
  if (has("importance_diff")) {
    const l = importanceDiffLabel(get("importance_diff"));
    contextItems.push({ ...l, value: fmt(get("importance_diff"), 2) });
  } else if (has("fixture_importance")) {
    const l = fixtureImportanceLabel(get("fixture_importance"));
    contextItems.push({ ...l, value: fmt(get("fixture_importance"), 2) });
  }
  if (has("fixture_importance_home") && has("fixture_importance_away")) {
    contextItems.push({
      label: "Urgency per team",
      icon: "🏆",
      severity: "neutral",
      value: "",
      description: `${homeTeam}: ${pct(get("fixture_importance_home"))} · ${awayTeam}: ${pct(get("fixture_importance_away"))}`,
    });
  }
  if (has("referee_cards_avg")) {
    const l = refereeCardsLabel(get("referee_cards_avg"));
    contextItems.push({ ...l, value: `${fmt(get("referee_cards_avg"), 1)} cards/game` });
  }
  if (has("referee_home_win_pct")) {
    contextItems.push({
      label: "Referee home win %",
      icon: "👮",
      severity: "neutral",
      value: pct(get("referee_home_win_pct")),
      description: "Historical home win rate with this referee",
    });
  }
  if (has("referee_over25_pct")) {
    const l = refereeOver25Label(get("referee_over25_pct"));
    contextItems.push({ ...l, value: pct(get("referee_over25_pct")) });
  }
  if (has("venue_surface_artificial")) {
    const l = venueSurfaceLabel(get("venue_surface_artificial") === 1);
    contextItems.push({ ...l, value: get("venue_surface_artificial") === 1 ? "Artificial" : "Grass" });
  }
  if (has("points_to_relegation_home")) {
    const l = pointsToRelegationLabel(Math.round(get("points_to_relegation_home")));
    contextItems.push({ ...l, value: `${Math.round(get("points_to_relegation_home"))} pts`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("points_to_relegation_away")) {
    const l = pointsToRelegationLabel(Math.round(get("points_to_relegation_away")));
    contextItems.push({ ...l, value: `${Math.round(get("points_to_relegation_away"))} pts`, description: `${awayTeam}: ${l.description}` });
  }
  if (has("points_to_title_home")) {
    const l = pointsToTitleLabel(Math.round(get("points_to_title_home")));
    contextItems.push({ ...l, value: `${Math.round(get("points_to_title_home"))} pts`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("points_to_title_away")) {
    const l = pointsToTitleLabel(Math.round(get("points_to_title_away")));
    contextItems.push({ ...l, value: `${Math.round(get("points_to_title_away"))} pts`, description: `${awayTeam}: ${l.description}` });
  }
  if (has("league_home_win_pct")) {
    contextItems.push({
      label: "League home win %",
      icon: "🏟",
      severity: "neutral",
      value: pct(get("league_home_win_pct")),
      description: `Draw rate: ${pct(get("league_draw_pct", 0))} (last 200 matches in league)`,
    });
  }
  if (has("league_avg_goals")) {
    const l = leagueAvgGoalsLabel(get("league_avg_goals"));
    contextItems.push({ ...l, value: `${fmt(get("league_avg_goals"), 2)} goals/match` });
  }
  if (has("league_over25_pct")) {
    const l = leagueOver25PctLabel(get("league_over25_pct"));
    contextItems.push({ ...l, value: pct(get("league_over25_pct")) });
  }
  if (has("league_btts_pct")) {
    const l = leagueBttsPctLabel(get("league_btts_pct"));
    contextItems.push({ ...l, value: pct(get("league_btts_pct")) });
  }
  if (has("league_elo_variance")) {
    const l = leagueEloVarianceLabel(get("league_elo_variance"));
    contextItems.push({ ...l, value: `±${fmt(get("league_elo_variance"), 0)}` });
  }
  if (has("league_elo_range")) {
    const l = leagueEloRangeLabel(get("league_elo_range"));
    contextItems.push({ ...l, value: `${fmt(get("league_elo_range"), 0)} pts range` });
  }
  if (has("fixture_urgency_home")) {
    const l = fixtureUrgencyLabel(get("fixture_urgency_home"));
    contextItems.push({ ...l, value: fmt(get("fixture_urgency_home"), 2), description: `${homeTeam}: ${l.description}` });
  }
  if (has("fixture_urgency_away")) {
    const l = fixtureUrgencyLabel(get("fixture_urgency_away"));
    contextItems.push({ ...l, value: fmt(get("fixture_urgency_away"), 2), description: `${awayTeam}: ${l.description}` });
  }
  if (has("games_remaining_home") && has("games_remaining_away")) {
    contextItems.push({
      label: "Games remaining",
      icon: "📅",
      severity: "neutral",
      value: "",
      description: `${homeTeam}: ${Math.round(get("games_remaining_home"))} · ${awayTeam}: ${Math.round(get("games_remaining_away"))} games left this season`,
    });
  }
  if (has("away_team_turf_games_ytd")) {
    const l = turfFamiliarityLabel(Math.round(get("away_team_turf_games_ytd")));
    contextItems.push({ ...l, value: `${Math.round(get("away_team_turf_games_ytd"))} games`, description: `${awayTeam}: ${l.description}` });
  }

  // ── News & Injuries group ───────────────────────────────────────────────────
  const infoItems: SignalItem[] = [];
  if (has("news_impact_score")) {
    const l = newsImpactLabel(get("news_impact_score"));
    infoItems.push({ ...l, value: fmt(get("news_impact_score"), 2) });
  }
  if (has("injury_count_home")) {
    const l = injuryCountLabel(get("injury_count_home"));
    infoItems.push({ ...l, value: `${Math.round(get("injury_count_home"))}`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("injury_count_away")) {
    const l = injuryCountLabel(get("injury_count_away"));
    infoItems.push({ ...l, value: `${Math.round(get("injury_count_away"))}`, description: `${awayTeam}: ${l.description}` });
  }
  if (has("players_out_home") && get("players_out_home") > 0) {
    infoItems.push({
      label: "Players out",
      icon: "🚑",
      severity: "medium",
      value: `${Math.round(get("players_out_home"))}`,
      description: `${homeTeam}: ${Math.round(get("players_out_home"))} confirmed absences`,
    });
  }
  if (has("players_out_away") && get("players_out_away") > 0) {
    infoItems.push({
      label: "Players out",
      icon: "🚑",
      severity: "medium",
      value: `${Math.round(get("players_out_away"))}`,
      description: `${awayTeam}: ${Math.round(get("players_out_away"))} confirmed absences`,
    });
  }
  if (has("players_doubtful_home") && get("players_doubtful_home") > 0) {
    const l = playersDoubtfulLabel(get("players_doubtful_home"));
    infoItems.push({ ...l, value: `${Math.round(get("players_doubtful_home"))}`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("players_doubtful_away") && get("players_doubtful_away") > 0) {
    const l = playersDoubtfulLabel(get("players_doubtful_away"));
    infoItems.push({ ...l, value: `${Math.round(get("players_doubtful_away"))}`, description: `${awayTeam}: ${l.description}` });
  }
  if (has("injury_uncertainty_home") && get("injury_uncertainty_home") > 0) {
    const l = injuryUncertaintyLabel(get("injury_uncertainty_home"));
    infoItems.push({ ...l, value: `${Math.round(get("injury_uncertainty_home"))}`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("injury_uncertainty_away") && get("injury_uncertainty_away") > 0) {
    const l = injuryUncertaintyLabel(get("injury_uncertainty_away"));
    infoItems.push({ ...l, value: `${Math.round(get("injury_uncertainty_away"))}`, description: `${awayTeam}: ${l.description}` });
  }
  if (has("injury_recurrence_home")) {
    const l = injuryRecurrenceLabel(get("injury_recurrence_home"));
    infoItems.push({ ...l, value: fmt(get("injury_recurrence_home"), 1), description: `${homeTeam}: ${l.description}` });
  }
  if (has("injury_recurrence_away")) {
    const l = injuryRecurrenceLabel(get("injury_recurrence_away"));
    infoItems.push({ ...l, value: fmt(get("injury_recurrence_away"), 1), description: `${awayTeam}: ${l.description}` });
  }
  if (has("squad_disruption_home")) {
    const l = squadDisruptionLabel(get("squad_disruption_home"));
    infoItems.push({ ...l, value: `${Math.round(get("squad_disruption_home"))}`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("squad_disruption_away")) {
    const l = squadDisruptionLabel(get("squad_disruption_away"));
    infoItems.push({ ...l, value: `${Math.round(get("squad_disruption_away"))}`, description: `${awayTeam}: ${l.description}` });
  }
  if (has("h1_shot_dominance_home")) {
    const l = h1ShotDominanceLabel(get("h1_shot_dominance_home"));
    infoItems.push({ ...l, value: `${Math.round(get("h1_shot_dominance_home") * 100)}%`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("h1_shot_dominance_away")) {
    const l = h1ShotDominanceLabel(get("h1_shot_dominance_away"));
    infoItems.push({ ...l, value: `${Math.round(get("h1_shot_dominance_away") * 100)}%`, description: `${awayTeam}: ${l.description}` });
  }
  if (has("manager_change_home_days")) {
    const l = managerChangeDaysLabel(Math.round(get("manager_change_home_days")));
    infoItems.push({ ...l, value: `${Math.round(get("manager_change_home_days"))}d ago`, description: `${homeTeam}: ${l.description}` });
  }
  if (has("manager_change_away_days")) {
    const l = managerChangeDaysLabel(Math.round(get("manager_change_away_days")));
    infoItems.push({ ...l, value: `${Math.round(get("manager_change_away_days"))}d ago`, description: `${awayTeam}: ${l.description}` });
  }

  // ── Specialist Markets group (Pinnacle AH + BTTS) ───────────────────────────
  const specialistItems: SignalItem[] = [];
  if (has("pinnacle_ah_line")) {
    const l = pinnacleAHLineLabel(get("pinnacle_ah_line"));
    specialistItems.push({ ...l, value: `${get("pinnacle_ah_line") > 0 ? "+" : ""}${get("pinnacle_ah_line")}` });
  }
  if (has("pinnacle_ah_line_move")) {
    const l = pinnacleAHMoveLabel(get("pinnacle_ah_line_move"));
    specialistItems.push({ ...l, value: `${get("pinnacle_ah_line_move") > 0 ? "+" : ""}${get("pinnacle_ah_line_move")}` });
  }
  if (has("ah_bookmaker_disagreement")) {
    const l = ahBookmakerDisagreementLabel(get("ah_bookmaker_disagreement"));
    specialistItems.push({ ...l, value: fmt(get("ah_bookmaker_disagreement"), 3) });
  }
  if (has("pinnacle_btts_yes_prob")) {
    const l = pinnacleBTTSLabel(get("pinnacle_btts_yes_prob"));
    specialistItems.push({ ...l, value: pct(get("pinnacle_btts_yes_prob")) });
  }

  return [
    { id: "market", title: SIGNAL_GROUP_LABELS.market, icon: "📊", color: "border-l-sky-500", items: marketItems },
    { id: "form", title: SIGNAL_GROUP_LABELS.quality, icon: "⚡", color: "border-l-emerald-500", items: formItems },
    { id: "context", title: SIGNAL_GROUP_LABELS.context, icon: "🏟", color: "border-l-amber-500", items: contextItems },
    { id: "info", title: SIGNAL_GROUP_LABELS.information, icon: "📰", color: "border-l-rose-500", items: infoItems },
    { id: "specialist", title: SIGNAL_GROUP_LABELS.specialist, icon: "🎯", color: "border-l-violet-500", items: specialistItems },
  ].filter((g) => g.items.length > 0);
}

// ─── Accordion item ──────────────────────────────────────────────────────────

function AccordionSection({
  group,
  isOpen,
  onToggle,
  isPro,
}: {
  group: SignalGroup;
  isOpen: boolean;
  onToggle: () => void;
  isPro: boolean;
}) {
  const isLocked = group.requiresPro && !isPro;

  return (
    <div className={cn("rounded-lg border border-border/40 bg-card overflow-hidden border-l-2", group.color)}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="text-base">{group.icon}</span>
        <span className="text-sm font-semibold flex-1">{group.title}</span>
        {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
          {group.items.length}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border/30">
          {isLocked ? (
            <div className="flex items-center gap-3 px-4 py-4">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                Upgrade to Pro to see {group.title} signals
              </p>
              <a href="/profile" className="ml-auto text-xs font-semibold text-primary hover:underline shrink-0">
                Upgrade →
              </a>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {group.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", SEVERITY_DOT[item.severity])} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-semibold", SEVERITY_LABEL_COLOR[item.severity])}>
                      {item.icon} {item.label}
                      {item.value && (
                        <span className="font-mono font-normal text-muted-foreground ml-2">{item.value}</span>
                      )}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SignalAccordion({
  signals,
  isPro,
  isElite: _isElite,
  homeTeam,
  awayTeam,
}: SignalAccordionProps) {
  const groups = buildGroups(signals, homeTeam, awayTeam);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(["market"]));

  if (!groups.length) return null;

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isPro) {
    // Free: show accordion structure with lock overlays
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold">Signal Groups</h3>
          <span className="text-[10px] text-muted-foreground">Pro feature</span>
        </div>
        {groups.map((group) => (
          <AccordionSection
            key={group.id}
            group={{ ...group, requiresPro: true }}
            isOpen={openIds.has(group.id)}
            onToggle={() => toggle(group.id)}
            isPro={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold mb-1">Signal Groups</h3>
      {groups.map((group) => (
        <AccordionSection
          key={group.id}
          group={group}
          isOpen={openIds.has(group.id)}
          onToggle={() => toggle(group.id)}
          isPro={isPro}
        />
      ))}
    </div>
  );
}
