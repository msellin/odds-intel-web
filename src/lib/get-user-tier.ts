import { cookies } from "next/headers";

export type UserTierResult = {
  tier: "free" | "pro" | "elite";
  is_superadmin: boolean;
  isPro: boolean;
  isElite: boolean;
  isPreview: boolean;
};

/**
 * Fetch and resolve the effective tier for a user.
 * For superadmins, checks for a `preview_tier` cookie and overrides tier if set.
 * All other users get their real DB tier.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserTier(userId: string, supabase: any): Promise<UserTierResult> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, is_superadmin")
    .eq("id", userId)
    .single();

  const isSuperadmin = profile?.is_superadmin === true;
  const dbTier = (profile?.tier as "free" | "pro" | "elite") ?? "free";

  let effectiveTier: "free" | "pro" | "elite" = isSuperadmin ? "elite" : dbTier;
  let isPreview = false;

  if (isSuperadmin) {
    const cookieStore = await cookies();
    const previewTier = cookieStore.get("preview_tier")?.value;
    if (previewTier && (["free", "pro", "elite"] as string[]).includes(previewTier)) {
      effectiveTier = previewTier as "free" | "pro" | "elite";
      isPreview = true;
    }
  }

  const isElite = effectiveTier === "elite";
  const isPro = effectiveTier === "pro" || effectiveTier === "elite";

  return { tier: effectiveTier, is_superadmin: isSuperadmin, isPro, isElite, isPreview };
}
