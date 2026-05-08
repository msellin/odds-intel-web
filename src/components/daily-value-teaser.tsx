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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Zap className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-sm text-muted-foreground truncate">
              <span className="font-medium text-foreground">
                {totalCount} value {totalCount === 1 ? "opportunity" : "opportunities"}
              </span>{" "}
              detected today
            </span>
          </div>
          <Link
            href="/value-bets"
            className="flex items-center gap-1 shrink-0 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            View all
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
        <div className="flex items-center justify-between gap-3">
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
              <span className="font-mono font-bold text-amber-400 shrink-0">
                +{(pick.edge * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <Link
            href="/signup"
            className="flex items-center gap-1 shrink-0 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            Sign up free
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Free signed-in user — compact single-row, same height as anon/pro variants
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
      {unlocked ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Zap className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="font-medium text-foreground truncate">{pick.match}</span>
              <span className="hidden sm:inline text-muted-foreground">·</span>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate">{pick.selection}</span>
              <span className="hidden sm:inline font-mono text-xs text-muted-foreground">@ {pick.odds.toFixed(2)}</span>
              <span className="font-mono font-bold text-amber-400 shrink-0">+{(pick.edge * 100).toFixed(1)}%</span>
              <span
                className={cn(
                  "hidden sm:inline rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
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
            href="/value-bets"
            className="flex items-center gap-1 shrink-0 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
          >
            All picks
            <Lock className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Zap className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground">Today&apos;s free value pick</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">1 per day · Pro unlocks all</span>
            </div>
          </div>
          <button
            onClick={handleUnlock}
            className="flex items-center gap-1.5 shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <Lock className="h-3 w-3" />
            Reveal
          </button>
        </div>
      )}
    </div>
  );
}
