"use client";

import { useState, useEffect } from "react";
import { Zap, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TeaserBet {
  id: string;
  match: string;
  league: string;
  market: string;
  selection: string;
  odds: number;
  edge: number;
  result: string;
}

export function DailyValueTeaser() {
  const { user } = useAuth();
  const [teaser, setTeaser] = useState<TeaserBet | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [totalBets, setTotalBets] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Fetch today's top bet
    supabase
      .from("simulated_bets")
      .select(
        `id, market, selection, odds_at_pick, edge_percent, result,
         match:match_id(date,
           home_team:home_team_id(name),
           away_team:away_team_id(name),
           league:league_id(name, country)
         )`
      )
      .gte("pick_time", todayStart.toISOString())
      .order("edge_percent", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTotalBets(data.length);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = data[0] as any;
          const match = Array.isArray(row.match) ? row.match[0] : row.match;
          const ht = match?.home_team
            ? Array.isArray(match.home_team) ? match.home_team[0] : match.home_team
            : null;
          const at = match?.away_team
            ? Array.isArray(match.away_team) ? match.away_team[0] : match.away_team
            : null;
          const lg = match?.league
            ? Array.isArray(match.league) ? match.league[0] : match.league
            : null;

          setTeaser({
            id: row.id,
            match: `${ht?.name || "?"} vs ${at?.name || "?"}`,
            league: lg ? `${lg.country} / ${lg.name}` : "",
            market: row.market,
            selection: row.selection,
            odds: Number(row.odds_at_pick),
            edge: Number(row.edge_percent),
            result: row.result || "pending",
          });
        }
        setLoading(false);
      });

    // Check if user already used today's unlock
    if (user) {
      const today = now.toISOString().split("T")[0];
      supabase
        .from("daily_unlocks")
        .select("id")
        .eq("user_id", user.id)
        .eq("unlock_date", today)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setUnlocked(true);
        });
    }
  }, [user]);

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

  if (loading || !teaser) return null;

  // Anonymous — compact inline teaser
  if (!user) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: pick info */}
          <div className="flex items-center gap-3 min-w-0">
            <Zap className="h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <span className="font-medium text-foreground truncate">
                {teaser.match}
              </span>
              <span className="hidden sm:inline text-muted-foreground">·</span>
              <span className="hidden sm:inline text-xs text-muted-foreground truncate">
                {teaser.selection}
              </span>
              <span className="hidden sm:inline font-mono text-xs text-muted-foreground">
                @ {teaser.odds.toFixed(2)}
              </span>
              <span className="font-mono font-bold text-amber-400">
                +{teaser.edge.toFixed(1)}%
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  teaser.result === "won"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : teaser.result === "lost"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
                )}
              >
                {teaser.result}
              </span>
            </div>
          </div>

          {/* Right: CTA */}
          <Link
            href="/signup"
            className="flex items-center justify-center gap-1.5 shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-amber-400"
          >
            Sign up free{totalBets > 1 ? ` · ${totalBets} picks` : ""}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  // Signed in — show teaser with unlock
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
          {totalBets > 1 && (
            <Link
              href="/value-bets"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-amber-400 transition-colors"
            >
              See all {totalBets} picks
              <ArrowRight className="h-3 w-3" />
              <Lock className="h-3 w-3" />
            </Link>
          )}
        </div>

        {unlocked ? (
          // Revealed pick
          <div className="rounded-lg border border-amber-500/20 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {teaser.match}
                </p>
                <p className="text-xs text-muted-foreground">{teaser.league}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-lg font-bold text-amber-400">
                  +{teaser.edge.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">edge</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                {teaser.market}
              </span>
              <span className="font-medium text-foreground">{teaser.selection}</span>
              <span className="font-mono text-muted-foreground">
                @ {teaser.odds.toFixed(2)}
              </span>
              <span
                className={cn(
                  "ml-auto rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  teaser.result === "won"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : teaser.result === "lost"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
                )}
              >
                {teaser.result}
              </span>
            </div>
          </div>
        ) : (
          // Locked — click to reveal
          <button
            onClick={handleUnlock}
            className="w-full rounded-lg border border-dashed border-amber-500/30 bg-black/20 p-4 text-center transition-colors hover:border-amber-500/50 hover:bg-black/30"
          >
            <Lock className="mx-auto h-5 w-5 text-amber-400/60 mb-2" />
            <p className="text-sm font-medium text-foreground">
              Tap to reveal today&apos;s top value pick
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              1 free unlock per day — all {totalBets} picks available on Pro
            </p>
          </button>
        )}
      </div>
    </div>
  );
}
