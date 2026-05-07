"use client";

import { useState, useEffect } from "react";
import { Lock, Users } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface CommunityVoteProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchStatus: string;
  isAuthenticated?: boolean;
}

type Vote = "home" | "draw" | "away";

interface VoteCounts {
  home: number;
  draw: number;
  away: number;
  total: number;
}

export function CommunityVote({
  matchId,
  homeTeam,
  awayTeam,
  matchStatus,
  isAuthenticated,
}: CommunityVoteProps) {
  const { user } = useAuth();
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [counts, setCounts] = useState<VoteCounts>({ home: 0, draw: 0, away: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isLocked = matchStatus === "live" || matchStatus === "finished";
  const canVote = !!user && !myVote && !isLocked;
  // Show percentages once there are any votes, or the match is live/finished
  const showResults = !!myVote || isLocked || counts.total > 0;

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    supabase
      .from("match_votes")
      .select("vote")
      .eq("match_id", matchId)
      .then(({ data }) => {
        if (data) {
          const c = { home: 0, draw: 0, away: 0, total: 0 };
          for (const row of data as { vote: Vote }[]) {
            c[row.vote]++;
            c.total++;
          }
          setCounts(c);
        }
        setLoaded(true);
      });

    if (user) {
      supabase
        .from("match_votes")
        .select("vote")
        .eq("user_id", user.id)
        .eq("match_id", matchId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setMyVote((data as { vote: Vote }).vote);
        });
    }
  }, [user, matchId]);

  const handleVote = async (vote: Vote) => {
    if (!canVote || loading) return;
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.from("match_votes").insert({
      user_id: user!.id,
      match_id: matchId,
      vote,
    });

    if (!error) {
      setMyVote(vote);
      setCounts((prev) => ({
        ...prev,
        [vote]: prev[vote] + 1,
        total: prev.total + 1,
      }));
    }
    setLoading(false);
  };

  if (!loaded) return null;

  // Hide entirely when locked with no votes — empty 0%/0%/0% looks broken
  if (isLocked && counts.total === 0 && !myVote) return null;

  const pct = (v: Vote) =>
    counts.total > 0 ? Math.round((counts[v] / counts.total) * 100) : 0;

  const options: { vote: Vote; label: string }[] = [
    { vote: "home", label: homeTeam },
    { vote: "draw", label: "Draw" },
    { vote: "away", label: awayTeam },
  ];

  // Not signed in — compact one-liner
  if (!user) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-card/40 px-4 py-3">
        <Users className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <span className="text-xs text-muted-foreground">
          {counts.total > 0
            ? `${counts.total} user${counts.total !== 1 ? "s" : ""} have predicted this match`
            : "Be the first to predict this match"}
        </span>
        <Link
          href="/signup"
          className="ml-auto shrink-0 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Sign up to vote →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Users className="h-3 w-3" />
          Community Prediction
        </p>
        <div className="flex items-center gap-2">
          {isLocked && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Lock className="h-2.5 w-2.5" />
              Locked at kickoff
            </span>
          )}
          {counts.total > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {counts.total} vote{counts.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const isMyVote = myVote === opt.vote;
          const percentage = pct(opt.vote);

          return (
            <button
              key={opt.vote}
              onClick={() => handleVote(opt.vote)}
              disabled={!canVote || loading}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg border px-3 py-3 transition-all overflow-hidden",
                isMyVote
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : canVote
                    ? "border-white/[0.06] bg-muted/20 hover:border-emerald-500/30 hover:bg-emerald-500/5"
                    : "border-white/[0.06] bg-muted/10 cursor-default"
              )}
            >
              {/* Result bar background — shown whenever showResults is true */}
              {showResults && (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-500",
                    isMyVote ? "bg-emerald-500/10" : "bg-white/[0.03]"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              )}
              <span className="relative text-xs text-muted-foreground truncate max-w-full">
                {opt.label}
              </span>
              {showResults ? (
                <span
                  className={cn(
                    "relative font-mono text-sm font-bold",
                    isMyVote ? "text-emerald-400" : "text-foreground"
                  )}
                >
                  {percentage}%
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/50">Vote</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
