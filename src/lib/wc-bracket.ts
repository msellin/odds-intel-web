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

export type {
  BracketRound,
  BracketPick,
  BracketMeta,
  GroupPick,
  BracketSlotAssignment,
  BracketRoundState,
  BracketRoundLockState,
};
export {
  ROUND_POINTS,
  ROUND_SLOTS,
  ROUND_LABELS,
  ROUNDS_ORDER,
  KNOCKOUT_ROUNDS_ORDER,
  PRIOR_ROUND_LABEL,
  GROUP_POSITION_POINTS,
  PERFECT_GROUP_BONUS,
  MAX_PER_GROUP_SCORE,
  MAX_GROUP_STANDINGS_SCORE,
} from "./wc-bracket-types";

import type {
  BracketSlotAssignment,
  BracketRoundState,
  BracketRoundLockState,
} from "./wc-bracket-types";
import {
  KNOCKOUT_ROUNDS_ORDER,
  ROUND_SLOTS,
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

// ─── Stage-gated bracket state (WC-BRACKET-STAGE-GATED — 2026-06-02) ────────

/**
 * Load the full per-round bracket state: slot assignments, lock state, and
 * round-level kickoff/settlement progress. Anonymous-readable — the slot
 * map is public (it's just AF's published knockout schedule).
 *
 * Returns one entry per knockout round (r32, r16, qf, sf, final). Each
 * entry includes ALL its slots — slots with no seeded `match_id` are
 * returned with state="unseeded" so the FE can render "Opens after the
 * prior round" placeholders.
 */
export async function loadBracketState(
  nowMs: number = Date.now()
): Promise<BracketRoundState[]> {
  const supabase = await createSupabaseServer();
  const { data: slotData, error: slotErr } = await supabase
    .from("wc_bracket_slot_assignments")
    .select(
      `round, position, match_id, locked_at,
       matches:match_id(
         id, date, status, result,
         home_team_id, away_team_id,
         home_team:home_team_id(id, name),
         away_team:away_team_id(id, name)
       )`
    );

  // Pre-migration safety — table missing or RLS rejecting = empty bracket.
  if (slotErr || !slotData) return emptyBracketState();

  type MatchEmbed = {
    id: string;
    date: string;
    status: string;
    result: string | null;
    home_team_id: string;
    away_team_id: string;
    home_team: { id: string; name: string } | { id: string; name: string }[] | null;
    away_team: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  type SlotRow = {
    round: string;
    position: number;
    match_id: string | null;
    locked_at: string | null;
    // Supabase returns a single row as either an object or a single-element
    // array depending on how it infers the FK; both shapes are valid here.
    matches: MatchEmbed | MatchEmbed[] | null;
  };

  const byRound = new Map<string, BracketSlotAssignment[]>();
  for (const r of slotData as unknown as SlotRow[]) {
    const m = Array.isArray(r.matches) ? r.matches[0] ?? null : r.matches;
    const hTeam = m ? (Array.isArray(m.home_team) ? m.home_team[0] : m.home_team) : null;
    const aTeam = m ? (Array.isArray(m.away_team) ? m.away_team[0] : m.away_team) : null;
    const slot: BracketSlotAssignment = {
      round: r.round as Exclude<BracketSlotAssignment["round"], "champion">,
      position: r.position,
      matchId: r.match_id,
      lockedAt: r.locked_at,
      homeTeam: hTeam ?? null,
      awayTeam: aTeam ?? null,
      status: m?.status ?? null,
      result: m?.result ?? null,
      kickoff: m?.date ?? null,
    };
    const arr = byRound.get(r.round) ?? [];
    arr.push(slot);
    byRound.set(r.round, arr);
  }

  const out: BracketRoundState[] = [];
  for (const round of KNOCKOUT_ROUNDS_ORDER) {
    const slots = (byRound.get(round) ?? []).sort((a, b) => a.position - b.position);
    // Pad missing positions with empty placeholders so the FE always renders
    // the full skeleton even if migration seeding hasn't run.
    const filled: BracketSlotAssignment[] = [];
    for (let i = 0; i < ROUND_SLOTS[round]; i++) {
      const existing = slots.find((s) => s.position === i);
      filled.push(
        existing ?? {
          round,
          position: i,
          matchId: null,
          lockedAt: null,
          homeTeam: null,
          awayTeam: null,
          status: null,
          result: null,
          kickoff: null,
        }
      );
    }
    out.push({ round, state: deriveLockState(filled, nowMs), lockedAt: firstLockedAt(filled), slots: filled });
  }
  return out;
}

function emptyBracketState(): BracketRoundState[] {
  return KNOCKOUT_ROUNDS_ORDER.map((round) => ({
    round,
    state: "unseeded" as BracketRoundLockState,
    lockedAt: null,
    slots: Array.from({ length: ROUND_SLOTS[round] }, (_, i) => ({
      round,
      position: i,
      matchId: null,
      lockedAt: null,
      homeTeam: null,
      awayTeam: null,
      status: null,
      result: null,
      kickoff: null,
    })),
  }));
}

function firstLockedAt(slots: BracketSlotAssignment[]): string | null {
  for (const s of slots) {
    if (s.lockedAt) return s.lockedAt;
  }
  return null;
}

function deriveLockState(
  slots: BracketSlotAssignment[],
  nowMs: number
): BracketRoundLockState {
  // Any slot with no match_id → unseeded (still waiting on AF).
  if (slots.some((s) => !s.matchId)) return "unseeded";
  const lockTs = slots
    .map((s) => (s.lockedAt ? new Date(s.lockedAt).getTime() : null))
    .filter((t): t is number => t != null);
  const lockMs = lockTs.length ? Math.min(...lockTs) : null;
  if (lockMs == null || nowMs < lockMs) return "open";
  // Past lock — check if every slot has a finished match.
  const allDone = slots.every((s) => s.status === "finished");
  return allDone ? "settled" : "locked";
}

/** Convenience — returns the round currently active for picks (first round
 *  in "open" state), or null if none. */
export function currentOpenRound(states: BracketRoundState[]): BracketRoundState | null {
  return states.find((s) => s.state === "open") ?? null;
}

/** Convenience — returns the next round expected to open, for activity tile
 *  copy. Returns null when bracket is fully settled. */
export function nextRound(states: BracketRoundState[]): BracketRoundState | null {
  return (
    states.find((s) => s.state === "open") ??
    states.find((s) => s.state === "unseeded") ??
    null
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
  /** WC-BRACKET-STAGE-GATED: round currently open for picks (or null). */
  currentBracketRound?: {
    round: string;     // 'r32' | 'r16' | 'qf' | 'sf' | 'final'
    label: string;     // human label
    locksAt: string;   // ISO
  } | null;
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

  // WC-BRACKET-STAGE-GATED: surface the round currently open for picks.
  // Single query — cheap.
  let currentBracketRound: WCActivityStats["currentBracketRound"] = null;
  try {
    const states = await loadBracketState();
    const open = states.find((s) => s.state === "open");
    if (open && open.lockedAt) {
      currentBracketRound = {
        round: open.round,
        label: open.round.toUpperCase(),
        locksAt: open.lockedAt,
      };
    }
  } catch {
    // Migration 171 not applied yet — silently omit the tile.
  }

  return {
    bracketsLockedIn: brackets.count ?? 0,
    picksMadeToday:
      (groupToday.count ?? 0) +
      (bracketToday.count ?? 0) +
      (userPicksToday.count ?? 0),
    groupStandingsPredicted: distinctGroupEntries,
    currentBracketRound,
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
