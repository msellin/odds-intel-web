"use client";

import { Star } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  /** The full league string, e.g. "England / Premier League" */
  value: string;
  className?: string;
}

export function FavoriteButton({ value, className }: FavoriteButtonProps) {
  const { user, profile, refreshProfile } = useAuth();

  if (!user || !profile) return null;

  const isFavorited = (profile.preferred_leagues ?? []).some((l) =>
    value.toLowerCase().includes(l.toLowerCase())
  );

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const supabase = createSupabaseBrowser();
    // Extract just the league name from "Country / League Name"
    const leagueName = value.includes(" / ")
      ? value.split(" / ").slice(1).join(" / ")
      : value;
    const current = profile.preferred_leagues ?? [];
    const updated = isFavorited
      ? current.filter((l) => !value.toLowerCase().includes(l.toLowerCase()))
      : [...current, leagueName];

    await supabase
      .from("profiles")
      .update({ preferred_leagues: updated })
      .eq("id", user.id);

    await refreshProfile();
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-white/10",
        className
      )}
      title={isFavorited ? `Remove from favourites` : `Add to favourites`}
    >
      <Star
        className={cn(
          "h-3.5 w-3.5 transition-colors",
          isFavorited
            ? "fill-amber-400 text-amber-400"
            : "text-muted-foreground/40 hover:text-amber-400/60"
        )}
      />
    </button>
  );
}
