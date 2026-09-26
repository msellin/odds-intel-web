/**
 * [[#182]] The OWN board — "where do I put my real money right now?" (owner, 2026-09-26).
 *
 * Reads the engine's private table `own_bet_board` (migrations 470/471), written every 10 min by
 * workers/jobs/own_bet_board.py: every pending pre-match pick of a live bot, grouped per
 * (match, market, selection), priced at each book we can bet from Estonia, against the v2 anchor
 * (Pinnacle + Betfair Exchange; a conflict between them = no price; else a >= 5-book consensus that
 * never contains the book being priced). No maths here — the engine owns every number; this file only
 * reads and shapes. Also reads which of these selections are already in real_bets, so a placed bet
 * shows as placed.
 */
import { createServerServiceClient } from "@/lib/supabase-server";
import { readAdminFixture } from "@/lib/admin-fixture";

import { boardKey, type BoardRow, type OwnBoardData } from "@/lib/own-board-shared";
export type { BoardBot, BoardPrice, BoardRow, OwnBoardData } from "@/lib/own-board-shared";
export { boardKey } from "@/lib/own-board-shared";

export async function loadOwnBoard(): Promise<OwnBoardData> {
  const fx = await readAdminFixture<OwnBoardData>("own_board");
  if (fx) return fx;
  const db = createServerServiceClient();
  const { data, error } = await db
    .from("own_bet_board")
    .select("*")
    .order("clears", { ascending: false })
    .order("best_edge", { ascending: false, nullsFirst: false })
    .limit(1000);
  const rows = (data ?? []) as BoardRow[];
  const ids = [...new Set(rows.map((r) => r.match_id))];
  const placed: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: rb } = await db
      .from("real_bets")
      .select("match_id, market, selection")
      .in("match_id", ids.slice(i, i + 200))
      .not("placed_real", "is", false);
    for (const b of rb ?? []) placed.push(boardKey(b as { match_id: string; market: string; selection: string }));
  }
  return { rows, placed, error: error?.message ?? null };
}
