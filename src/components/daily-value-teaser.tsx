"use client";

import { useState } from "react";
import { Zap, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface FreePick {
  id: string;
  match: string;
  league: string;
  market: string;
  selection: string;
  odds: number;
  edge: number;
  result: string;
}

interface DailyValueTeaserProps {
  pick: FreePick | null;       // top bet, fetched server-side
  totalCount: number;          // total bets today, fetched server-side
  alreadyUnlocked: boolean;    // server-side check against daily_unlocks
  isPro?: boolean;
}

export function DailyValueTeaser({
  pick,
  totalCount,
  alreadyUnlocked,
  isPro = false,
}: DailyValueTeaserProps) {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(alreadyUnlocked);

  const handleUnlock = async () => {
    if (!user || unlocked) return;
    const supabase = createSupabaseBrowser();
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("daily_unlocks").insert({
      user_id: user.id,
      unlock_date: today,
      feature: "value_bet",
    });
    setUnlocked(true);
  };

  if (!pick) return null;

  // Pro/Elite — compact redirect to value bets
  if (isPro && user) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Zap className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {totalCount} value {totalCount === 1 ? "opportunity" : "opportunities"}
              </span>{" "}
              detected today
            </span>
          </div>
          <Link
            href="/value-bets"
            className="flex items-center justify-center gap-1.5 shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-amber-400"
          >
            View all picks
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Anonymous — compact inline teaser
  if (!user) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Zap className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="font-medium text-foreground truncate">{pick.match}</span>
              <span className="hidden sm:inline text-muted-foreground">·</span>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate">
                {pick.selection}
              </span>
              <span className="hidden sm:inline font-mono text-xs text-muted-foreground">
                @ {pick.odds.toFixed(2)}
              </span>
              <span className="font-mono font-bold text-amber-400">
                +{pick.edge.toFixed(1)}%
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
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
          <Link
            href="/signup"
            className="flex items-center justify-center gap-1.5 shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-amber-400"
          >
            Sign up free · 1 pick/day
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Free signed-in user — show with unlock mechanic
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Today&apos;s Free Value Pick
            </span>
          </div>
          <Link
            href="/value-bets"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-amber-400 transition-colors"
          >
            All picks on Pro
            <Lock className="h-3 w-3" />
          </Link>
        </div>

        {unlocked ? (
          <div className="rounded-lg border border-amber-500/20 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{pick.match}</p>
                <p className="text-xs text-muted-foreground">{pick.league}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-lg font-bold text-amber-400">
                  +{pick.edge.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">edge</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                {pick.market}
              </span>
              <span className="font-medium text-foreground">{pick.selection}</span>
              <span className="font-mono text-muted-foreground">@ {pick.odds.toFixed(2)}</span>
              <span
                className={cn(
                  "ml-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
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
        ) : (
          <button
            onClick={handleUnlock}
            className="w-full rounded-lg border border-dashed border-amber-500/30 bg-black/20 p-4 text-center transition-colors hover:border-amber-500/50 hover:bg-black/30"
          >
            <Lock className="mx-auto h-5 w-5 text-amber-400/60 mb-2" />
            <p className="text-sm font-medium text-foreground">
              Tap to reveal today&apos;s top value pick
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              1 free pick per day — upgrade to Pro for all picks
            </p>
          </button>
        )}
      </div>
    </div>
  );
}
