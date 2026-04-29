"use client";

/**
 * SUX-9: Signal Delta — "what changed since last visit"
 * Tracks last-visited timestamp per match in localStorage.
 * On return visits, shows which signals updated since last view.
 * Creates habit + return visits.
 */

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import type { MatchSignalRow } from "@/lib/engine-data";

interface SignalDeltaProps {
  matchId: string;
  signals: MatchSignalRow[];
  homeTeam: string;
  awayTeam: string;
}

interface DeltaItem {
  signalName: string;
  displayName: string;
  capturedAt: string;
}

const STORAGE_KEY = (matchId: string) => `oi_match_visit_${matchId}`;

// Human-readable names for signal names
const SIGNAL_DISPLAY: Record<string, string> = {
  bookmaker_disagreement: "Bookmaker disagreement",
  overnight_line_move: "Overnight line move",
  odds_volatility: "Odds volatility",
  form_slope_home: "Home form trend",
  form_slope_away: "Away form trend",
  news_impact_score: "News impact",
  injury_count_home: "Home injuries",
  injury_count_away: "Away injuries",
  fixture_importance: "Fixture importance",
  importance_diff: "Stakes asymmetry",
  referee_cards_avg: "Referee tendency",
  elo_home: "Home ELO",
  elo_away: "Away ELO",
  elo_diff: "ELO differential",
  lineup_confirmed: "Lineups confirmed",
};

function toDisplayName(signalName: string, homeTeam: string, awayTeam: string): string {
  const mapped = SIGNAL_DISPLAY[signalName];
  if (mapped) return mapped;
  if (signalName.endsWith("_home")) return `${homeTeam} — ${signalName.replace("_home", "").replace(/_/g, " ")}`;
  if (signalName.endsWith("_away")) return `${awayTeam} — ${signalName.replace("_away", "").replace(/_/g, " ")}`;
  return signalName.replace(/_/g, " ");
}

export function SignalDelta({ matchId, signals, homeTeam, awayTeam }: SignalDeltaProps) {
  const [changes, setChanges] = useState<DeltaItem[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = STORAGE_KEY(matchId);
    const lastVisit = localStorage.getItem(key);

    if (lastVisit) {
      const lastVisitTime = new Date(lastVisit);
      // Find signals that were captured after last visit
      const updated = signals
        .filter((s) => new Date(s.captured_at) > lastVisitTime)
        .map((s) => ({
          signalName: s.signal_name,
          displayName: toDisplayName(s.signal_name, homeTeam, awayTeam),
          capturedAt: s.captured_at,
        }));

      // Deduplicate by signal name (keep most recent)
      const seen = new Set<string>();
      const deduped = updated.filter((item) => {
        if (seen.has(item.signalName)) return false;
        seen.add(item.signalName);
        return true;
      });

      if (deduped.length > 0) {
        setChanges(deduped.slice(0, 5)); // max 5 shown
      }
    }

    // Update last-visit timestamp
    localStorage.setItem(key, new Date().toISOString());
  }, [matchId, signals, homeTeam, awayTeam]);

  if (!changes.length || dismissed) return null;

  // Format relative time
  const mostRecentUpdate = changes.reduce((latest, item) => {
    return new Date(item.capturedAt) > new Date(latest.capturedAt) ? item : latest;
  });
  const minutesAgo = Math.round(
    (Date.now() - new Date(mostRecentUpdate.capturedAt).getTime()) / 60000
  );
  const timeStr =
    minutesAgo < 60
      ? `${minutesAgo}m ago`
      : `${Math.floor(minutesAgo / 60)}h ago`;

  return (
    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <RefreshCw className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-sky-400">
            {changes.length} signal{changes.length !== 1 ? "s" : ""} updated since your last visit · {timeStr}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {changes.map((item) => (
              <span
                key={item.signalName}
                className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300 font-medium"
              >
                {item.displayName}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
