// ANON-AUTH PHASE 2: lazy anonymous user creation on first save action.
//
// Pattern: visitors browse oddsintel.app with no session. The moment they
// try to PERSIST something (favorite a team, save a tracker pick, etc.) we
// silently create a Supabase anonymous user behind the scenes and use its
// user.id for the write. They never see a signup form — their data is just
// saved against their anon identity. Phase 3 prompts them to upgrade later.
//
// Idempotent: if a session already exists (anon OR real), returns the
// existing user without creating a new one.

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { captureEvent } from "@/components/posthog-provider";

export type AnonCreateSource =
  | "favorite_match"
  | "favorite_team"
  | "tracker_pick"
  | "saved_match"
  | "wc_bracket"
  | "match_note"      // currently blocked at RLS — included for completeness
  | "match_vote"      // currently blocked at RLS — included for completeness
  | "other";

interface EnsureAnonUserResult {
  user: User | null;
  created: boolean;       // true if we just created the anon user
  wasAnonymous: boolean;  // true if returning an existing anon user
  error?: string;
}

/**
 * Returns a usable user.id for write operations:
 *   - If a session exists (anon OR real), returns that user.
 *   - If no session, calls signInAnonymously() and returns the new user.
 *
 * Call this immediately before any DB write that requires user_id, then
 * use result.user.id (NOT useAuth().user — the auth state listener hasn't
 * propagated yet on the same tick).
 *
 * source: short tag describing what triggered creation. Stored as a PostHog
 * event property so we can attribute anon signups to their activation hook.
 */
export async function ensureAnonUser(
  supabase: SupabaseClient,
  source: AnonCreateSource
): Promise<EnsureAnonUserResult> {
  const { data: { user: existing } } = await supabase.auth.getUser();
  if (existing) {
    return {
      user: existing,
      created: false,
      wasAnonymous: Boolean(existing.is_anonymous),
    };
  }

  captureEvent("anon_user_create_attempt", { source });

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    captureEvent("anon_user_create_error", {
      source,
      error_message: error?.message ?? "no_user_returned",
    });
    return {
      user: null,
      created: false,
      wasAnonymous: false,
      error: error?.message ?? "Could not create anonymous session",
    };
  }

  captureEvent("anon_user_created", { source });
  return { user: data.user, created: true, wasAnonymous: true };
}
