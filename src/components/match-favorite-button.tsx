"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { ensureAnonUser } from "@/lib/anon-auth";
import { captureEvent } from "@/components/posthog-provider";
import { cn } from "@/lib/utils";

interface MatchFavoriteButtonProps {
  matchId: string;
  favoriteMatchIds: Set<string>;
  onToggle: (matchId: string, isFavorited: boolean) => void;
  className?: string;
}

export function MatchFavoriteButton({
  matchId,
  favoriteMatchIds,
  onToggle,
  className,
}: MatchFavoriteButtonProps) {
  const { user, isAnonymous, openUpgradeModal } = useAuth();
  const [loading, setLoading] = useState(false);
  const isFavorited = favoriteMatchIds.has(matchId);

  // ANON-AUTH PHASE 2: button is visible to everyone now. First click by an
  // unauthenticated visitor silently creates a Supabase anonymous user, then
  // performs the favorite write against that user.id. They never see a
  // signup form — their favorites just start being saved.
  // PHASE 3: once the anon user crosses 3 favorites, surface the upgrade modal.

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    const supabase = createSupabaseBrowser();

    let activeUserId = user?.id;
    let justCreatedAnon = false;
    if (!activeUserId) {
      const result = await ensureAnonUser(supabase, "favorite_match");
      if (!result.user) {
        setLoading(false);
        return;
      }
      activeUserId = result.user.id;
      justCreatedAnon = result.created;
    }

    if (isFavorited) {
      await supabase
        .from("user_match_favorites")
        .delete()
        .eq("user_id", activeUserId)
        .eq("match_id", matchId);
      captureEvent("favorite_match_removed");
      onToggle(matchId, false);
    } else {
      await supabase
        .from("user_match_favorites")
        .insert({ user_id: activeUserId, match_id: matchId });
      captureEvent("favorite_match_added");
      onToggle(matchId, true);

      // PHASE 3 trigger: after the 3rd favorite (counting the one just added),
      // nudge anonymous users to upgrade. Only for anon users — and not for
      // the brand-new anon user we just created on this same click (let them
      // get to 3 organically).
      const newCount = favoriteMatchIds.size + 1;
      if (
        newCount === 3 &&
        (isAnonymous || justCreatedAnon)
      ) {
        captureEvent("anon_upgrade_trigger_fired", { trigger: "3rd_favorite" });
        // Tiny delay so the star animation lands before the modal opens.
        setTimeout(() => openUpgradeModal("3rd_favorite"), 350);
      }
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center rounded p-1.5 transition-colors hover:bg-white/10 disabled:opacity-50",
        className
      )}
      title={isFavorited ? "Unfollow this match" : "Follow this match"}
    >
      <Star
        className={cn(
          "h-3 w-3 transition-colors",
          isFavorited
            ? "fill-amber-400 text-amber-400"
            : "text-muted-foreground/30 hover:text-amber-400/60"
        )}
      />
    </button>
  );
}
