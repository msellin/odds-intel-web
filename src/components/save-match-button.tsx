"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

interface SaveMatchButtonProps {
  matchId: string;
  className?: string;
}

export function SaveMatchButton({ matchId, className }: SaveMatchButtonProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowser();
    supabase
      .from("saved_matches")
      .select("id")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSaved(true);
      });
  }, [user, matchId]);

  if (!user) return null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);

    const supabase = createSupabaseBrowser();

    if (saved) {
      await supabase
        .from("saved_matches")
        .delete()
        .eq("user_id", user.id)
        .eq("match_id", matchId);
      setSaved(false);
    } else {
      await supabase.from("saved_matches").insert({
        user_id: user.id,
        match_id: matchId,
      });
      setSaved(true);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-white/10",
        className
      )}
      title={saved ? "Remove from watchlist" : "Save to watchlist"}
    >
      <Bookmark
        className={cn(
          "h-3.5 w-3.5 transition-colors",
          saved
            ? "fill-emerald-400 text-emerald-400"
            : "text-muted-foreground/40 hover:text-emerald-400/60"
        )}
      />
    </button>
  );
}
