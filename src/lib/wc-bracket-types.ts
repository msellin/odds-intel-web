/**
 * Pure types / constants for the World Cup bracket. Safe to import from
 * client components — does NOT depend on supabase-server.
 *
 * Scoring + slot layout split out from `wc-bracket.ts` (which holds the
 * server-only loaders).
 */

export type BracketRound = "r32" | "r16" | "qf" | "sf" | "final" | "champion";

export const ROUND_POINTS: Record<BracketRound, number> = {
  r32: 1,
  r16: 2,
  qf: 4,
  sf: 8,
  final: 16,
  champion: 32,
};

export const ROUND_SLOTS: Record<BracketRound, number> = {
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
  champion: 1,
};

export const ROUND_LABELS: Record<BracketRound, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
  champion: "Champion",
};

export const ROUNDS_ORDER: BracketRound[] = ["r32", "r16", "qf", "sf", "final", "champion"];

export interface BracketPick {
  round: BracketRound;
  position: number;
  pickedTeamId: string;
}

export interface BracketMeta {
  userId: string;
  goldenBootPlayer: string | null;
  lockedAt: string | null;
  currentScore: number;
  currentRank: number | null;
}
