import type { PublicMatch } from "./engine-data";

export type InterestLevel = "hot" | "warm" | "neutral";

/**
 * Compute match interest level from public match data.
 *
 * - "hot"     (fire): has odds data from bookmakers
 * - "warm"    (bolt): match is live/in-progress
 * - "neutral" (dash): fixture only, no odds
 */
export function interestScore(match: PublicMatch): InterestLevel {
  if (match.hasOdds) return "hot";
  if (match.status === "live") return "warm";
  return "neutral";
}

export function interestIndicator(level: InterestLevel): string {
  switch (level) {
    case "hot":
      return "\u{1F525}";
    case "warm":
      return "\u26A1";
    case "neutral":
      return "\u2014";
  }
}
