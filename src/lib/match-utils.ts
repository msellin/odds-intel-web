import type { PublicMatch } from "./engine-data";

export type InterestLevel = "hot" | "warm" | "neutral";

// Leagues in tiers 1-3 where we have model data (Poisson model coverage).
// A match is "hot" if it has odds AND is in a covered league tier.
const COVERED_TIERS = new Set([1, 2, 3]);

/**
 * Compute match interest level from public match data.
 *
 * - "hot"     (fire): has odds AND league tier 1-3 (model data available)
 * - "warm"    (bolt): has odds but no model coverage, OR match is live/in-progress
 * - "neutral" (dash): fixture only, no odds, no model data
 */
export function interestScore(match: PublicMatch): InterestLevel {
  const isLive = match.status === "live";
  const hasModelCoverage = COVERED_TIERS.has(match.tier);

  if (match.hasOdds && hasModelCoverage) return "hot";
  if (match.hasOdds || isLive) return "warm";
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
