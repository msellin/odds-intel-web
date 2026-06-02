/**
 * Server-side bracket loaders. Client components must import types from
 * `wc-bracket-types.ts` — this file pulls in supabase-server which itself
 * depends on `next/headers` (server-only).
 */

import { createClient } from "@supabase/supabase-js";

import { createSupabaseServer } from "./supabase-server";
import { WC_FIRST_KICKOFF_ISO } from "./world-cup";
import type {
  BracketRound,
  BracketPick,
  BracketMeta,
  GroupPick,
} from "./wc-bracket-types";

/** Service-role client — bypasses RLS. Server-only. Used for share-link reads
 * where the bearer (the share_token in the URL) is the authorisation. */
function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!
  );
}

export type { BracketRound, BracketPick, BracketMeta, GroupPick };
export {
  ROUND_POINTS,
  ROUND_SLOTS,
  ROUND_LABELS,
  ROUNDS_ORDER,
  GROUP_POSITION_POINTS,
  PERFECT_GROUP_BONUS,
  MAX_PER_GROUP_SCORE,
  MAX_GROUP_STANDINGS_SCORE,
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
      .select(
        `user_id, golden_boot_player, locked_at, current_score, current_rank,
         group_standings_score, total_score, current_percentile`
      )
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
        groupStandingsScore:
          (metaRes.data.group_standings_score as number | undefined) ?? 0,
        totalScore: (metaRes.data.total_score as number | undefined) ?? 0,
        currentPercentile:
          metaRes.data.current_percentile != null
            ? Number(metaRes.data.current_percentile)
            : null,
      }
    : null;

  return { picks, meta, isAuthed: true };
}

/** Load the signed-in user's group-standings picks. Returns []
 * for anonymous viewers. */
export async function loadUserGroupPicks(): Promise<GroupPick[]> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wc_group_predictions")
    .select("group_letter, position, picked_team_id")
    .eq("user_id", user.id);
  if (error || !data) return [];

  return (data as { group_letter: string; position: number; picked_team_id: string }[]).map(
    (r) => ({
      groupLetter: r.group_letter,
      position: r.position,
      pickedTeamId: r.picked_team_id,
    })
  );
}

export interface LeaderboardEntry {
  /** Either user_id (humans) or a synthetic key (`ai:<label>`) for AI ghosts. */
  key: string;
  /** user_id for humans; null for AI ghosts. */
  userId: string | null;
  /** display_name for humans; null for AI ghosts. */
  displayName: string | null;
  /** True for AI ghosts. Render a 🤖 badge; not eligible for prizes. */
  isAi: boolean;
  /** AI strategy label (e.g. "OddsIntel Elite AI"). Null for humans. */
  aiLabel: string | null;
  bracketScore: number;
  groupScore: number;
  totalScore: number;
  currentRank: number | null;
  currentPercentile: number | null;
  lockedAt: string | null;
  /** True when this row represents the signed-in user (pinning). */
  isCurrentUser?: boolean;
}

interface LeaderboardLoadOpts {
  limit?: number;
  /** When set, marks the matching row with `isCurrentUser: true` and ensures
   * it appears in the returned slice (pinned at the end if outside top N). */
  currentUserId?: string | null;
}

/** Threshold below which we render "Top X%" instead of "#rank". */
export const PERCENTILE_DISPLAY_THRESHOLD = 200;

/**
 * Combined leaderboard — humans AND AI ghosts in one ranking by total_score.
 *
 * AI rows are marked with `isAi: true` so the UI can render a 🤖 badge and a
 * "not eligible for prizes" footnote. The data layer does NOT filter AI out —
 * the prize-eligibility filter lives in any later admin query (e.g.
 * `WHERE ai_label IS NULL` for the top-3-humans prize check).
 *
 * When `currentUserId` is set:
 *   • the matching row is flagged `isCurrentUser: true`
 *   • if that row is outside the top N, it's appended at the end so the UI
 *     can pin it without a second fetch
 */
export async function loadBracketLeaderboard(
  optsOrLimit: number | LeaderboardLoadOpts = 100
): Promise<LeaderboardEntry[]> {
  const opts: LeaderboardLoadOpts =
    typeof optsOrLimit === "number" ? { limit: optsOrLimit } : optsOrLimit;
  const limit = opts.limit ?? 100;
  const currentUserId = opts.currentUserId ?? null;

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("wc_bracket_meta")
    .select(
      `user_id, ai_label, current_score, group_standings_score, total_score,
       current_rank, current_percentile, locked_at,
       profiles:user_id(display_name)`
    )
    .order("total_score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const out: LeaderboardEntry[] = (data as Row[]).map((r) =>
    rowToEntry(r, currentUserId)
  );

  // Pin signed-in user to the returned set when they're outside the top N.
  if (currentUserId && !out.some((e) => e.userId === currentUserId)) {
    const { data: mine } = await supabase
      .from("wc_bracket_meta")
      .select(
        `user_id, ai_label, current_score, group_standings_score, total_score,
         current_rank, current_percentile, locked_at,
         profiles:user_id(display_name)`
      )
      .eq("user_id", currentUserId)
      .maybeSingle();
    if (mine) out.push(rowToEntry(mine as unknown as Row, currentUserId));
  }

  return out;
}

// Helper kept module-scope so the public loader stays under complexity cap.
interface Row {
  user_id: string | null;
  ai_label: string | null;
  current_score: number | null;
  group_standings_score: number | null;
  total_score: number | null;
  current_rank: number | null;
  current_percentile: number | string | null;
  locked_at: string | null;
  profiles:
    | { display_name: string | null }
    | { display_name: string | null }[]
    | null;
}

function rowToEntry(r: Row, currentUserId: string | null): LeaderboardEntry {
  const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  const isAi = !!r.ai_label;
  return {
    key: isAi ? `ai:${r.ai_label}` : (r.user_id as string),
    userId: r.user_id,
    displayName: p?.display_name ?? null,
    isAi,
    aiLabel: r.ai_label,
    bracketScore: r.current_score ?? 0,
    groupScore: r.group_standings_score ?? 0,
    totalScore: r.total_score ?? 0,
    currentRank: r.current_rank,
    currentPercentile:
      r.current_percentile == null ? null : Number(r.current_percentile),
    lockedAt: r.locked_at,
    isCurrentUser: currentUserId != null && r.user_id === currentUserId,
  };
}

// ─── Activity tiles on /world-cup header ────────────────────────────────────

export interface WCActivityStats {
  bracketsLockedIn: number;        // distinct entries with at least one pick (humans + AI)
  picksMadeToday: number;          // group + bracket + 1x2 picks in last 24h
  groupStandingsPredicted: number; // distinct entries with at least one group pick
}

/**
 * Activity counters for the /world-cup header tiles. Counts AI ghosts
 * alongside humans — the tiles read "🎯 N brackets locked in" and we want to
 * be honest about every entry on the leaderboard.
 */
export async function loadWcActivityStats(): Promise<WCActivityStats> {
  const supabase = await createSupabaseServer();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Distinct entries with at least one bracket pick. Counts the meta table
  // rows since the scoring job seeds one per entry — cheap O(N) count.
  const bracketsP = supabase
    .from("wc_bracket_meta")
    .select("id", { count: "exact", head: true });

  // Picks made today across all three picks tables.
  const groupTodayP = supabase
    .from("wc_group_predictions")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", since24h);

  const bracketTodayP = supabase
    .from("wc_bracket_picks")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", since24h);

  const userPicksTodayP = supabase
    .from("wc_user_picks")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", since24h);

  // Distinct entries with at least one group-standings pick. We use a
  // grouped query so the count is over distinct keys (user_id OR ai_label),
  // not over rows — 12 group rows per entry would otherwise inflate this.
  const groupEntriesP = supabase
    .from("wc_group_predictions")
    .select("user_id, ai_label");

  const [brackets, groupToday, bracketToday, userPicksToday, groupEntries] =
    await Promise.all([
      bracketsP,
      groupTodayP,
      bracketTodayP,
      userPicksTodayP,
      groupEntriesP,
    ]);

  let distinctGroupEntries = 0;
  if (groupEntries.data) {
    const seen = new Set<string>();
    for (const r of groupEntries.data as {
      user_id: string | null;
      ai_label: string | null;
    }[]) {
      const k = r.user_id ?? (r.ai_label ? `ai:${r.ai_label}` : null);
      if (k) seen.add(k);
    }
    distinctGroupEntries = seen.size;
  }

  return {
    bracketsLockedIn: brackets.count ?? 0,
    picksMadeToday:
      (groupToday.count ?? 0) +
      (bracketToday.count ?? 0) +
      (userPicksToday.count ?? 0),
    groupStandingsPredicted: distinctGroupEntries,
  };
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
