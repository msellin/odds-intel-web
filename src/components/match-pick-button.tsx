"use client";

import { useState, useEffect } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MatchPickButtonProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  matchStatus: string;
}

type Selection = "home" | "draw" | "away";

interface UserPick {
  id: string;
  selection: Selection;
  odds: number | null;
  result: string;
}

export function MatchPickButton({
  matchId,
  homeTeam,
  awayTeam,
  bestHome,
  bestDraw,
  bestAway,
  matchStatus,
}: MatchPickButtonProps) {
  const { user } = useAuth();
  const [pick, setPick] = useState<UserPick | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }
    const supabase = createSupabaseBrowser();
    supabase
      .from("user_picks")
      .select("id, selection, odds, result")
      .eq("user_id", user.id)
      .eq("match_id", matchId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPick(data as UserPick);
        setInitialLoading(false);
      });
  }, [user, matchId]);

  if (!user) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Track your predictions and build your record
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          Sign up to make picks
        </Link>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isFinished = matchStatus === "finished" || matchStatus === "ft";
  const isLive = matchStatus === "live";
  const canPick = !pick && !isFinished && !isLive;

  const handlePick = async (selection: Selection) => {
    if (!canPick || loading) return;
    setLoading(true);

    const odds =
      selection === "home" ? bestHome : selection === "draw" ? bestDraw : bestAway;

    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase
      .from("user_picks")
      .insert({
        user_id: user.id,
        match_id: matchId,
        selection,
        odds: odds || null,
        result: "pending",
      })
      .select("id, selection, odds, result")
      .single();

    if (!error && data) {
      setPick(data as UserPick);
    }
    setLoading(false);
  };

  const getSelectionLabel = (s: Selection) =>
    s === "home" ? homeTeam : s === "draw" ? "Draw" : awayTeam;

  const getSelectionOdds = (s: Selection) =>
    s === "home" ? bestHome : s === "draw" ? bestDraw : bestAway;

  // Already picked — show the pick
  if (pick) {
    const resultColor =
      pick.result === "won"
        ? "border-emerald-500/30 bg-emerald-500/10"
        : pick.result === "lost"
          ? "border-red-500/30 bg-red-500/10"
          : "border-amber-500/30 bg-amber-500/10";

    return (
      <div className={cn("rounded-lg border p-4", resultColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Your pick: {getSelectionLabel(pick.selection)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {pick.odds && (
              <span className="font-mono text-sm text-muted-foreground">
                @ {Number(pick.odds).toFixed(2)}
              </span>
            )}
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                pick.result === "won"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : pick.result === "lost"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-amber-500/20 text-amber-400"
              )}
            >
              {pick.result}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!canPick) {
    return null;
  }

  const options: { selection: Selection; label: string }[] = [
    { selection: "home", label: homeTeam },
    { selection: "draw", label: "Draw" },
    { selection: "away", label: awayTeam },
  ];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-card/40 p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Make your prediction
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const odds = getSelectionOdds(opt.selection);
          return (
            <button
              key={opt.selection}
              onClick={() => handlePick(opt.selection)}
              disabled={loading}
              className="flex flex-col items-center gap-1 rounded-lg border border-white/[0.06] bg-muted/20 px-3 py-3 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5"
            >
              <span className="text-xs text-muted-foreground truncate max-w-full">
                {opt.label}
              </span>
              {odds > 0 && (
                <span className="font-mono text-sm font-bold text-foreground">
                  {odds.toFixed(2)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {loading && (
        <div className="flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
