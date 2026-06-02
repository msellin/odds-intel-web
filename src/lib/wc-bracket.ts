/**
 * Server-side bracket loaders. Client components must import types from
 * `wc-bracket-types.ts` — this file pulls in supabase-server which itself
 * depends on `next/headers` (server-only).
 */

import { createSupabaseServer } from "./supabase-server";
import { WC_FIRST_KICKOFF_ISO } from "./world-cup";
import type { BracketRound, BracketPick, BracketMeta } from "./wc-bracket-types";

export type { BracketRound, BracketPick, BracketMeta };
export {
  ROUND_POINTS,
  ROUND_SLOTS,
  ROUND_LABELS,
  ROUNDS_ORDER,
} from "./wc-bracket-types";

/** Did the global lock fire? */
export function isBracketLocked(nowMs: number = Date.now()): boolean {
  return nowMs >= new Date(WC_FIRST_KICKOFF_ISO).getTime();
}

export async function loadUserBracket(): Promise<{
  picks: BracketPick[];
  meta: BracketMeta | null;
  isAuthed: boolean;
}> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { picks: [], meta: null, isAuthed: false };

  const [picksRes, metaRes] = await Promise.all([
    supabase
      .from("wc_bracket_picks")
      .select("round, position, picked_team_id")
      .eq("user_id", user.id),
    supabase
      .from("wc_bracket_meta")
      .select("user_id, golden_boot_player, locked_at, current_score, current_rank")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const picks: BracketPick[] = (picksRes.data ?? []).map(
    (r: { round: string; position: number; picked_team_id: string }) => ({
      round: r.round as BracketRound,
      position: r.position,
      pickedTeamId: r.picked_team_id,
    })
  );

  const meta: BracketMeta | null = metaRes.data
    ? {
        userId: metaRes.data.user_id as string,
        goldenBootPlayer: (metaRes.data.golden_boot_player as string | null) ?? null,
        lockedAt: (metaRes.data.locked_at as string | null) ?? null,
        currentScore: (metaRes.data.current_score as number) ?? 0,
        currentRank: (metaRes.data.current_rank as number | null) ?? null,
      }
    : null;

  return { picks, meta, isAuthed: true };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  currentScore: number;
  currentRank: number | null;
  lockedAt: string | null;
}

/**
 * Top N bracket players by score. Uses anon-readable `wc_bracket_meta` joined
 * with `profiles.display_name` (also anon-readable). RLS is honoured.
 */
export async function loadBracketLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("wc_bracket_meta")
    .select(
      `user_id, current_score, current_rank, locked_at,
       profiles:user_id(display_name)`
    )
    .order("current_score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = {
    user_id: string;
    current_score: number;
    current_rank: number | null;
    locked_at: string | null;
    profiles:
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null;
  };

  return (data as Row[]).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      userId: r.user_id,
      displayName: p?.display_name ?? null,
      currentScore: r.current_score ?? 0,
      currentRank: r.current_rank,
      lockedAt: r.locked_at,
    };
  });
}
