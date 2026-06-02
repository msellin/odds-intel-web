/**
 * Server-side bracket loaders. Client components must import types from
 * `wc-bracket-types.ts` — this file pulls in supabase-server which itself
 * depends on `next/headers` (server-only).
 */

import { createClient } from "@supabase/supabase-js";

import { createSupabaseServer } from "./supabase-server";
import { WC_FIRST_KICKOFF_ISO } from "./world-cup";
import type { BracketRound, BracketPick, BracketMeta } from "./wc-bracket-types";

/** Service-role client — bypasses RLS. Server-only. Used for share-link reads
 * where the bearer (the share_token in the URL) is the authorisation. */
function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );
}

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

// ─── Shared bracket loader (token-bearer authorisation) ─────────────────────

export interface SharedBracket {
  ownerUserId: string;
  displayName: string | null;
  picks: BracketPick[];
  meta: BracketMeta;
  totalBrackets: number;
}

/**
 * Load any user's bracket by share_token. Uses service-role to bypass RLS —
 * the unguessable UUID token in the URL is the authorisation bearer. The
 * caller (the share page or OG image route) is responsible for not exposing
 * tokens in places they shouldn't appear (logs, analytics URLs, etc.).
 *
 * Returns null when token doesn't match any meta row.
 */
export async function loadBracketByShareToken(
  token: string
): Promise<SharedBracket | null> {
  // UUID shape gate first — prevent malformed tokens from hitting the DB.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(token)) return null;

  const admin = createSupabaseAdmin();

  const { data: metaRow, error: metaErr } = await admin
    .from("wc_bracket_meta")
    .select(
      `user_id, golden_boot_player, locked_at, current_score, current_rank,
       profiles:user_id(display_name)`
    )
    .eq("share_token", token)
    .maybeSingle();
  if (metaErr || !metaRow) return null;

  const userId = metaRow.user_id as string;
  const profile = Array.isArray(metaRow.profiles)
    ? metaRow.profiles[0]
    : metaRow.profiles;

  const [picksRes, countRes] = await Promise.all([
    admin
      .from("wc_bracket_picks")
      .select("round, position, picked_team_id")
      .eq("user_id", userId),
    admin
      .from("wc_bracket_meta")
      .select("user_id", { count: "exact", head: true }),
  ]);

  const picks: BracketPick[] = (picksRes.data ?? []).map(
    (r: { round: string; position: number; picked_team_id: string }) => ({
      round: r.round as BracketRound,
      position: r.position,
      pickedTeamId: r.picked_team_id,
    })
  );

  const meta: BracketMeta = {
    userId,
    goldenBootPlayer:
      ((metaRow as { golden_boot_player: string | null }).golden_boot_player as string | null) ?? null,
    lockedAt: ((metaRow as { locked_at: string | null }).locked_at as string | null) ?? null,
    currentScore: ((metaRow as { current_score: number }).current_score as number) ?? 0,
    currentRank: ((metaRow as { current_rank: number | null }).current_rank as number | null) ?? null,
  };

  return {
    ownerUserId: userId,
    displayName: (profile?.display_name as string | null) ?? null,
    picks,
    meta,
    totalBrackets: countRes.count ?? 0,
  };
}

export interface SharedBracketTeam {
  id: string;
  name: string;
  country: string | null;
  logo: string | null;
}

/**
 * Fetch the teams referenced by a bracket's picks. Used by the share page +
 * OG image route to render names + flag emojis next to each slot. Always uses
 * the public anon client (teams table is public-read).
 */
export async function loadTeamsByIds(
  ids: string[]
): Promise<Record<string, SharedBracketTeam>> {
  if (ids.length === 0) return {};
  const unique = Array.from(new Set(ids));
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("teams")
    .select("id, name, country, logo_url")
    .in("id", unique);
  const out: Record<string, SharedBracketTeam> = {};
  for (const t of (data as { id: string; name: string; country: string | null; logo_url: string | null }[]) ?? []) {
    out[t.id] = {
      id: t.id,
      name: t.name,
      country: t.country,
      logo: t.logo_url,
    };
  }
  return out;
}
