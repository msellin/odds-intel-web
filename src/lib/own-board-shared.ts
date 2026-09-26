/** [[#182]] OWN board types + pure helpers, safe for the client bundle (own-board.ts is server-only). */
export interface BoardPrice {
  odds: number;
  age_min: number;
  edge: number | null;
  /** null = clears every gate now; otherwise the first failing reason. */
  refusal: string | null;
  anchor: string;
  p_fair: number | null;
  /** This book's own bar: (1 + floor) / its anchor (each book's anchor leaves the book out). */
  take_at?: number | null;
}
export interface BoardBot {
  bot: string;
  display: string;
  status: string | null;
  vip: boolean;
  /** 'shadow' | 'sim' | 'forward_test' — which ledger the pick lives in. */
  source: string;
  pick_id: string;
  pick_time: string;
}
export interface BoardRow {
  match_id: string;
  market: string;
  selection: string;
  kickoff: string;
  home: string | null;
  away: string | null;
  league: string | null;
  bots: BoardBot[];
  n_bots: number;
  p_fair: number | null;
  fair_odds: number | null;
  /** The STRICTEST book's bar — a price at or above it clears the edge floor at every book. */
  take_at: number | null;
  pin_age_min: number | null;
  anchor_source: string;
  anchor_books: number;
  prices: Record<string, BoardPrice>;
  best_book: string | null;
  best_odds: number | null;
  best_edge: number | null;
  clears: boolean;
  computed_at: string;
}
export interface OwnBoardData {
  rows: BoardRow[];
  /** `${match_id}|${market}|${selection}` already in real_bets (any time, not paper). */
  placed: string[];
  error: string | null;
}

export const boardKey = (r: { match_id: string; market: string; selection: string }) =>
  `${r.match_id}|${r.market}|${r.selection.toLowerCase()}`;

