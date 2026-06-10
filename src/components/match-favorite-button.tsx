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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const isFavorited = favoriteMatchIds.has(matchId);

  // ANON-AUTH PHASE 2: button is visible to everyone now. First click by an
  // unauthenticated visitor silently creates a Supabase anonymous user, then
  // performs the favorite write against that user.id. They never see a
  // signup form — their favorites just start being saved.

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    const supabase = createSupabaseBrowser();

    let activeUserId = user?.id;
    if (!activeUserId) {
      const result = await ensureAnonUser(supabase, "favorite_match");
      if (!result.user) {
        // Anon creation failed (rate limit, network, etc.). Bail silently;
        // the button just won't toggle. We don't surface a sign-in prompt
        // here because the design intent is "saving should feel free".
        setLoading(false);
        return;
      }
      activeUserId = result.user.id;
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
