"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase-server";
import { WC_FIRST_KICKOFF_ISO } from "@/lib/world-cup";

// ─── OddsIntel vs You — per-fixture 1X2 pick ────────────────────────────────

export type WCPick = "1" | "X" | "2";

export interface SavePickResult {
  ok: boolean;
  error?: string;
}

/**
 * Save (or replace) a user's 1X2 pick for one WC fixture. Lock window: the
 * user can change their pick until the actual fixture kickoff time. We
 * re-fetch the match row server-side rather than trusting the client kickoff
 * value.
 */
export async function saveWcPick(matchId: string, pick: WCPick): Promise<SavePickResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to lock a pick." };

  // Re-fetch fixture kickoff. The fixture-specific lock fires once the match
  // actually kicks off — separate from the global bracket lock.
  const { data: match } = await supabase
    .from("matches")
    .select("date, status")
    .eq("id", matchId)
    .single();
  if (!match) return { ok: false, error: "Match not found." };

  const kickoff = new Date(match.date).getTime();
  if (Date.now() >= kickoff || match.status === "finished") {
    return { ok: false, error: "Pick is locked — match already started." };
  }

  // Upsert via the unique (user_id, match_id) key.
  const { error } = await supabase
    .from("wc_user_picks")
    .upsert(
      {
        user_id: user.id,
        match_id: matchId,
        pick,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,match_id" }
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/world-cup");
  return { ok: true };
}

// ─── Bracket: save a single slot ─────────────────────────────────────────────

export type BracketRound = "r32" | "r16" | "qf" | "sf" | "final" | "champion";

export interface SaveBracketResult {
  ok: boolean;
  error?: string;
}

function bracketLocked(): boolean {
  return Date.now() >= new Date(WC_FIRST_KICKOFF_ISO).getTime();
}

/**
 * Save (or replace) one bracket slot. Lock fires at the global WC kickoff
 * (2026-06-11 19:00 UTC). After lock, all writes refuse.
 */
export async function saveBracketPick(
  round: BracketRound,
  position: number,
  teamId: string
): Promise<SaveBracketResult> {
  if (bracketLocked()) return { ok: false, error: "Bracket is locked." };

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to play." };

  const { error } = await supabase
    .from("wc_bracket_picks")
    .upsert(
      {
        user_id: user.id,
        round,
        position,
        picked_team_id: teamId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,round,position" }
    );
  if (error) return { ok: false, error: error.message };

  // Touch meta so leaderboard shows this user as "active"
  await supabase
    .from("wc_bracket_meta")
    .upsert(
      { user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  revalidatePath("/world-cup/bracket");
  return { ok: true };
}

/**
 * Lock the bracket — recorded for audit. After global lock fires, this is a
 * no-op (the bracket is implicitly locked anyway). Optionally accept the
 * golden-boot pick.
 */
export async function lockBracket(goldenBootPlayer?: string): Promise<SaveBracketResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to play." };

  const { error } = await supabase
    .from("wc_bracket_meta")
    .upsert(
      {
        user_id: user.id,
        locked_at: new Date().toISOString(),
        golden_boot_player: goldenBootPlayer ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/world-cup/bracket");
  return { ok: true };
}
