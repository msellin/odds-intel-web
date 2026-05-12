"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
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

  if (!user) return null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    const supabase = createSupabaseBrowser();

    if (isFavorited) {
      await supabase
        .from("user_match_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("match_id", matchId);
      onToggle(matchId, false);
    } else {
      await supabase
        .from("user_match_favorites")
        .insert({ user_id: user.id, match_id: matchId });
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
