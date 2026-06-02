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

/** Rounds that have explicit positional slots in `wc_bracket_slot_assignments`.
 *  Champion is excluded — it's derived from the (final, 0) pick. */
export const KNOCKOUT_ROUNDS_ORDER: Exclude<BracketRound, "champion">[] = [
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
];

/** Friendly label for the prior round (used in "Opens after {prior}" copy). */
export const PRIOR_ROUND_LABEL: Record<Exclude<BracketRound, "champion">, string> = {
  r32: "the group stage settles",
  r16: "Round of 32 finishes",
  qf: "Round of 16 finishes",
  sf: "the quarter-finals finish",
  final: "the semi-finals finish",
};

// ── Stage-gated (WC-BRACKET-STAGE-GATED — 2026-06-02) ─────────────────────

/** Lifecycle state of a knockout round, surfaced by the FE renderer. */
export type BracketRoundLockState =
  | "unseeded" // round hasn't been seeded by AF yet — render greyed out
  | "open"     // seeded, locked_at is in the future — user can pick
  | "locked"   // locked_at in the past, not all matches finished
  | "settled"; // every slot's match has settled

export interface BracketSlotAssignment {
  round: Exclude<BracketRound, "champion">;
  position: number;
  matchId: string | null;
  /** ISO timestamp — null until AF seeds the round. */
  lockedAt: string | null;
  /** Home/away team data (null when slot unseeded). */
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  /** Match status: 'scheduled' | 'live' | 'finished' | 'cancelled' | null. */
  status: string | null;
  /** Settled result: 'home' | 'away' | 'draw' | null. */
  result: string | null;
  /** Match kickoff in ISO. Null if unseeded. */
  kickoff: string | null;
}

export interface BracketRoundState {
  round: Exclude<BracketRound, "champion">;
  state: BracketRoundLockState;
  /** ISO timestamp for the round's lock — first kickoff in this round. */
  lockedAt: string | null;
  /** Slot assignments in the round; always emits the full slot count, even
   *  when match_id is null (FE renders "coming soon" placeholders). */
  slots: BracketSlotAssignment[];
}

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
  groupStandingsScore?: number;
  totalScore?: number;
  currentPercentile?: number | null;
}

// ── Group-standings predictor (WC-GROUP-PREDICTOR — 2026-06-02) ────────────

export interface GroupPick {
  groupLetter: string;       // 'A' .. 'L'
  position: number;          // 1..4 (1st .. 4th)
  pickedTeamId: string;
}

// Per-group scoring (server-authoritative — keep in sync with
// workers/jobs/wc_bracket_scoring.py).
export const GROUP_POSITION_POINTS: Record<number, number> = {
  1: 5,
  2: 3,
  3: 2,
  4: 1,
};
export const PERFECT_GROUP_BONUS = 5;
export const MAX_PER_GROUP_SCORE = 16;   // 5+3+2+1 + 5
export const MAX_GROUP_STANDINGS_SCORE = 192; // 16 × 12 groups
