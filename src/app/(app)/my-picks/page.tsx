"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Flame,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

interface PickRow {
  id: string;
  match_id: string;
  selection: "home" | "draw" | "away";
  odds: number | null;
  stake: number | null;
  result: string;
  created_at: string;
  match: {
    date: string;
    home_team: { name: string }[] | { name: string };
    away_team: { name: string }[] | { name: string };
    league: { name: string; country: string }[] | { name: string; country: string };
  }[] | {
    date: string;
    home_team: { name: string }[] | { name: string };
    away_team: { name: string }[] | { name: string };
    league: { name: string; country: string }[] | { name: string; country: string };
  };
}

interface PickDisplay {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  selection: string;
  selectionLabel: string;
  odds: number | null;
  result: string;
  date: string;
}

interface Stats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  hitRate: number;
  streak: number;
  streakType: "W" | "L" | "";
}

export default function MyPicksPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [picks, setPicks] = useState<PickDisplay[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    won: 0,
    lost: 0,
    pending: 0,
    hitRate: 0,
    streak: 0,
    streakType: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowser();
    supabase
      .from("user_picks")
      .select(
        `id, match_id, selection, odds, stake, result, created_at,
         match:match_id(date,
           home_team:home_team_id(name),
           away_team:away_team_id(name),
           league:league_id(name, country)
         )`
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!data) {
          setLoading(false);
          return;
        }

        const formatted: PickDisplay[] = (data as PickRow[]).map((row) => {
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

          const homeTeam = ht?.name || "Unknown";
          const awayTeam = at?.name || "Unknown";
          const selectionLabel =
            row.selection === "home"
              ? homeTeam
              : row.selection === "draw"
                ? "Draw"
                : awayTeam;

          return {
            id: row.id,
            matchId: row.match_id,
            homeTeam,
            awayTeam,
            league: lg ? `${lg.country} / ${lg.name}` : "Unknown",
            selection: row.selection,
            selectionLabel,
            odds: row.odds ? Number(row.odds) : null,
            result: row.result || "pending",
            date: match?.date || row.created_at,
          };
        });

        setPicks(formatted);

        // Calculate stats
        const settled = formatted.filter((p) => p.result === "won" || p.result === "lost");
        const won = settled.filter((p) => p.result === "won").length;
        const lost = settled.filter((p) => p.result === "lost").length;
        const pending = formatted.filter((p) => p.result === "pending").length;

        // Calculate streak
        let streak = 0;
        let streakType: "W" | "L" | "" = "";
        for (const p of formatted) {
          if (p.result === "pending") continue;
          if (!streakType) {
            streakType = p.result === "won" ? "W" : "L";
            streak = 1;
          } else if (
            (streakType === "W" && p.result === "won") ||
            (streakType === "L" && p.result === "lost")
          ) {
            streak++;
          } else {
            break;
          }
        }

        setStats({
          total: formatted.length,
          won,
          lost,
          pending,
          hitRate: settled.length > 0 ? Math.round((won / settled.length) * 100) : 0,
          streak,
          streakType,
        });

        setLoading(false);
      });
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">
            My Picks
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your predictions and build your record
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total Picks
            </p>
            <p className="font-mono text-2xl font-bold text-foreground">
              {stats.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Hit Rate
            </p>
            <p className="font-mono text-2xl font-bold text-foreground">
              {stats.hitRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              W / L
            </p>
            <p className="font-mono text-2xl font-bold">
              <span className="text-emerald-400">{stats.won}</span>
              <span className="text-muted-foreground/50"> / </span>
              <span className="text-red-400">{stats.lost}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Streak
            </p>
            <p
              className={cn(
                "font-mono text-2xl font-bold",
                stats.streakType === "W"
                  ? "text-emerald-400"
                  : stats.streakType === "L"
                    ? "text-red-400"
                    : "text-muted-foreground"
              )}
            >
              {stats.streak > 0 ? `${stats.streak}${stats.streakType}` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion nudge */}
      {stats.total >= 5 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm">
          <span className="text-amber-400 font-medium">
            Your accuracy: {stats.hitRate}%
          </span>
          <span className="text-muted-foreground">
            {" "}— see how our AI model compares.{" "}
          </span>
          <Link
            href="/signup"
            className="text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Upgrade to Elite
          </Link>
        </div>
      )}

      {/* Picks list */}
      {picks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-foreground">
              No picks yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Go to any match and make your prediction to start tracking your
              record.
            </p>
            <Link
              href="/matches"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Browse Matches
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {/* Header */}
          <div className="grid grid-cols-12 items-center border-b border-white/[0.06] bg-muted/30 px-4 py-2.5 gap-2">
            <div className="col-span-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Date
            </div>
            <div className="col-span-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Match
            </div>
            <div className="col-span-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Pick
            </div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Odds
            </div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Result
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {picks.map((pick) => (
              <Link
                key={pick.id}
                href={`/matches/${pick.matchId}`}
                className="grid grid-cols-12 items-center px-4 py-2.5 gap-2 hover:bg-white/[0.02] transition-colors"
              >
                <div className="col-span-2 font-mono text-xs text-muted-foreground">
                  {new Date(pick.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                <div className="col-span-4 text-sm text-foreground truncate">
                  {pick.homeTeam} vs {pick.awayTeam}
                </div>
                <div className="col-span-2 text-sm text-foreground truncate">
                  {pick.selectionLabel}
                </div>
                <div className="col-span-2 text-center font-mono text-sm text-muted-foreground">
                  {pick.odds ? pick.odds.toFixed(2) : "—"}
                </div>
                <div className="col-span-2 text-center">
                  <span
                    className={cn(
                      "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
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
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
