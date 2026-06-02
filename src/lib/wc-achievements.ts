/**
 * WC-ACHIEVEMENTS (2026-06-02): server-side loaders for WC achievement
 * badges. The detection job lives in odds-intel-engine; the FE only reads
 * the materialised rows in `wc_user_achievements`.
 *
 * Public-read RLS (migration 172) means anon viewers can read any user's
 * achievements — required so the leaderboard renders badges next to every
 * row. Writes only happen server-side via the service-role detection job.
 */

import { createSupabaseServer } from "./supabase-server";
import type { UserAchievement } from "@/components/wc-achievement-badge";

interface AchievementRow {
  user_id: string;
  slug: string;
  earned_at: string;
  detail: Record<string, unknown> | null;
}

/** Load one user's achievements. Returns [] for unauthenticated viewers
 * with no matching rows. */
export async function loadUserAchievements(
  userId: string
): Promise<UserAchievement[]> {
  if (!userId) return [];
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("wc_user_achievements")
    .select("slug, earned_at, detail")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });

  // Pre-migration safety — table missing or RLS rejecting = no badges.
  if (error || !data) return [];

  return (data as Pick<AchievementRow, "slug" | "earned_at" | "detail">[]).map(
    (r) => ({
      slug: r.slug,
      earnedAt: r.earned_at,
      detail: r.detail,
    })
  );
}

/** Batched load — one query for many users. Returns a Map keyed by user_id.
 * Users without any achievements simply do not appear in the map (callers
 * must default to [] when looking up). */
export async function loadLeaderboardAchievements(
  userIds: string[]
): Promise<Map<string, UserAchievement[]>> {
  const out = new Map<string, UserAchievement[]>();
  if (!userIds || userIds.length === 0) return out;

  // De-dupe + filter falsy ids (AI ghost rows pass null user_id).
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return out;

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("wc_user_achievements")
    .select("user_id, slug, earned_at, detail")
    .in("user_id", unique)
    .order("earned_at", { ascending: false });

  if (error || !data) return out;

  for (const r of data as AchievementRow[]) {
    const existing = out.get(r.user_id) ?? [];
    existing.push({
      slug: r.slug,
      earnedAt: r.earned_at,
      detail: r.detail,
    });
    out.set(r.user_id, existing);
  }
  return out;
}
