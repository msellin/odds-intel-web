"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Loader2,
  Share2,
  Bot,
  Check,
  X as XIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
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

interface ModelPred {
  match_id: string;
  market: string;
  model_probability: number;
}

interface PickDisplay {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  selection: "home" | "draw" | "away";
  selectionLabel: string;
  odds: number | null;
  stake: number | null;
  result: string;
  date: string;
  modelProb: number | null;      // model probability for this selection
  modelAgreed: boolean | null;   // did model pick same direction (prob > 50%)?
}

interface Stats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  hitRate: number;
  streak: number;
  streakType: "W" | "L" | "";
  roi: number;          // % ROI on settled picks with odds
  units: number;        // net units (1u stake assumed when no stake stored)
  modelHitRate: number; // model's hit rate on same settled picks
  modelAgreements: number; // how many picks model agreed on
}

function selectionToMarket(s: "home" | "draw" | "away"): string {
  return s === "home" ? "1x2_home" : s === "draw" ? "1x2_draw" : "1x2_away";
}

export default function MyPicksPage() {
  const { user, loading: authLoading, openLoginModal } = useAuth();
  const [picks, setPicks] = useState<PickDisplay[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    won: 0,
    lost: 0,
    pending: 0,
    hitRate: 0,
    streak: 0,
    streakType: "",
    roi: 0,
    units: 0,
    modelHitRate: 0,
    modelAgreements: 0,
  });
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      openLoginModal();
    }
  }, [user, authLoading, openLoginModal]);

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
      .then(async ({ data }) => {
        if (!data) {
          setLoading(false);
          return;
        }

        const rows = data as PickRow[];

        // Fetch model predictions for these match_ids
        const matchIds = [...new Set(rows.map((r) => r.match_id))];
        let modelPreds: ModelPred[] = [];
        if (matchIds.length > 0) {
          const { data: preds } = await supabase
            .from("predictions")
            .select("match_id, market, model_probability")
            .in("match_id", matchIds)
            .eq("source", "ensemble")
            .in("market", ["1x2_home", "1x2_draw", "1x2_away"]);
          modelPreds = (preds ?? []) as ModelPred[];
        }

        // Build map: match_id + market → model_probability
        const predMap = new Map<string, number>();
        for (const p of modelPreds) {
          predMap.set(`${p.match_id}::${p.market}`, Number(p.model_probability));
        }

        const formatted: PickDisplay[] = rows.map((row) => {
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
            row.selection === "home" ? homeTeam
            : row.selection === "draw" ? "Draw"
            : awayTeam;

          const market = selectionToMarket(row.selection);
          const modelProb = predMap.get(`${row.match_id}::${market}`) ?? null;
          const modelAgreed = modelProb !== null ? modelProb > 0.5 : null;

          return {
            id: row.id,
            matchId: row.match_id,
            homeTeam,
            awayTeam,
            league: lg ? `${lg.country} / ${lg.name}` : "Unknown",
            selection: row.selection,
            selectionLabel,
            odds: row.odds ? Number(row.odds) : null,
            stake: row.stake ? Number(row.stake) : null,
            result: row.result || "pending",
            date: match?.date || row.created_at,
            modelProb: modelProb !== null ? Math.round(modelProb * 100) : null,
            modelAgreed,
          };
        });

        setPicks(formatted);

        // Compute stats
        const settled = formatted.filter((p) => p.result === "won" || p.result === "lost");
        const won = settled.filter((p) => p.result === "won").length;
        const lost = settled.filter((p) => p.result === "lost").length;
        const pending = formatted.filter((p) => p.result === "pending").length;

        // ROI and units (use 1u stakes when no stake stored)
        let totalStaked = 0;
        let totalReturn = 0;
        let unitsNet = 0;
        for (const p of settled) {
          const u = p.stake ?? 1;
          const o = p.odds ?? 2.0;
          totalStaked += u;
          if (p.result === "won") {
            totalReturn += u * o;
            unitsNet += (o - 1);
          } else {
            unitsNet -= 1;
          }
        }
        const roi = totalStaked > 0
          ? Math.round(((totalReturn - totalStaked) / totalStaked) * 1000) / 10
          : 0;

        // Model comparison — only settled picks where model had a prediction
        const settledWithModel = settled.filter((p) => p.modelAgreed !== null);
        const modelWon = settledWithModel.filter(
          (p) => (p.modelAgreed && p.result === "won") || (!p.modelAgreed && p.result === "lost")
        ).length;
        const modelHitRate = settledWithModel.length > 0
          ? Math.round((modelWon / settledWithModel.length) * 100)
          : 0;

        // Streak
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
          roi,
          units: Math.round(unitsNet * 10) / 10,
          modelHitRate,
          modelAgreements: settledWithModel.length,
        });

        setLoading(false);
      });
  }, [user]);

  const handleShare = async (pick: PickDisplay) => {
    const params = new URLSearchParams({
      home: pick.homeTeam,
      away: pick.awayTeam,
      league: pick.league,
      selection: pick.selection,
      ...(pick.odds ? { odds: String(pick.odds) } : {}),
      ...(pick.modelProb ? { model_prob: String(pick.modelProb) } : {}),
      result: pick.result,
    });
    const shareUrl = `${window.location.origin}/api/og/pick?${params.toString()}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${pick.homeTeam} vs ${pick.awayTeam} — My Pick: ${pick.selectionLabel}`,
          url: `${window.location.origin}/matches/${pick.matchId}`,
        });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    // Fallback: copy match URL
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/matches/${pick.matchId}`);
      setCopiedId(pick.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.open(shareUrl, "_blank");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!user) return null;

  const hasSettled = stats.won + stats.lost > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-xl font-bold tracking-tight">My Picks</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your predictions and compare against the model
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hit Rate</p>
            <p className="font-mono text-2xl font-bold text-foreground">
              {hasSettled ? `${stats.hitRate}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ROI</p>
            <p className={cn(
              "font-mono text-2xl font-bold",
              stats.roi > 0 ? "text-emerald-400" : stats.roi < 0 ? "text-red-400" : "text-muted-foreground"
            )}>
              {hasSettled ? `${stats.roi > 0 ? "+" : ""}${stats.roi}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Units</p>
            <p className={cn(
              "font-mono text-2xl font-bold",
              stats.units > 0 ? "text-emerald-400" : stats.units < 0 ? "text-red-400" : "text-muted-foreground"
            )}>
              {hasSettled ? `${stats.units > 0 ? "+" : ""}${stats.units}u` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">W / L</p>
            <p className="font-mono text-2xl font-bold">
              <span className="text-emerald-400">{stats.won}</span>
              <span className="text-muted-foreground/50"> / </span>
              <span className="text-red-400">{stats.lost}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Model vs You comparison */}
      {stats.modelAgreements >= 5 && (
        <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="size-4 text-violet-400" />
            <h2 className="text-sm font-semibold">Model vs You</h2>
            <span className="ml-auto text-xs text-muted-foreground/60">
              {stats.modelAgreements} settled picks with model data
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Hit Rate</p>
              <p className={cn(
                "font-mono text-xl font-bold mt-1",
                stats.hitRate >= 50 ? "text-emerald-400" : "text-red-400"
              )}>
                {stats.hitRate}%
              </p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Model Hit Rate</p>
              <p className={cn(
                "font-mono text-xl font-bold mt-1",
                stats.modelHitRate >= 50 ? "text-violet-400" : "text-muted-foreground"
              )}>
                {stats.modelHitRate}%
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-muted-foreground">
            {stats.hitRate > stats.modelHitRate
              ? `You're beating the model by ${stats.hitRate - stats.modelHitRate}pp on these picks.`
              : stats.hitRate < stats.modelHitRate
                ? `Model outperforms by ${stats.modelHitRate - stats.hitRate}pp. Check where you diverge.`
                : "You and the model are even on these picks."}
          </p>
        </div>
      )}

      {/* Model nudge when approaching 50 picks */}
      {stats.total >= 10 && stats.total < 50 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm">
          <span className="text-amber-400 font-medium">{stats.total} picks logged.</span>
          <span className="text-muted-foreground"> At 50 picks your ROI becomes statistically meaningful. Keep going.</span>
        </div>
      )}

      {/* Picks list */}
      {picks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-foreground">No picks yet</p>
            <p className="mt-2 text-xs text-muted-foreground max-w-xs mx-auto">
              Open any match, scroll to the <strong className="text-foreground/70">Make Your Pick</strong> section, and tap Home / Draw / Away.
            </p>
            <Link
              href="/matches"
              className="mt-5 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Browse Today&apos;s Matches
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          {/* Table header */}
          <div className="grid grid-cols-12 items-center border-b border-white/[0.06] bg-muted/30 px-4 py-2.5 gap-2">
            <div className="col-span-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Date</div>
            <div className="col-span-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Match</div>
            <div className="col-span-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Pick</div>
            <div className="col-span-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Odds</div>
            <div className="col-span-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Model</div>
            <div className="col-span-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Result</div>
            <div className="col-span-1 text-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">Share</div>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {picks.map((pick) => (
              <div key={pick.id} className="grid grid-cols-12 items-center px-4 py-2.5 gap-2 hover:bg-white/[0.02] transition-colors">
                <Link href={`/matches/${pick.matchId}`} className="col-span-2 font-mono text-xs text-muted-foreground">
                  {new Date(pick.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </Link>
                <Link href={`/matches/${pick.matchId}`} className="col-span-3 text-sm text-foreground truncate">
                  {pick.homeTeam} vs {pick.awayTeam}
                </Link>
                <div className="col-span-2 text-sm text-foreground truncate">{pick.selectionLabel}</div>
                <div className="col-span-1 text-center font-mono text-sm text-muted-foreground">
                  {pick.odds ? pick.odds.toFixed(2) : "—"}
                </div>

                {/* Model column */}
                <div className="col-span-2 flex items-center justify-center gap-1">
                  {pick.modelProb !== null ? (
                    <>
                      <span className="text-xs text-muted-foreground tabular-nums">{pick.modelProb}%</span>
                      {pick.modelAgreed ? (
                        <Check className="size-3 text-emerald-400 shrink-0" />
                      ) : (
                        <XIcon className="size-3 text-red-400/70 shrink-0" />
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/30">—</span>
                  )}
                </div>

                {/* Result */}
                <div className="col-span-1 text-center">
                  <span className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    pick.result === "won" ? "bg-emerald-500/20 text-emerald-400"
                    : pick.result === "lost" ? "bg-red-500/20 text-red-400"
                    : "bg-amber-500/20 text-amber-400"
                  )}>
                    {pick.result === "pending" ? "—" : pick.result}
                  </span>
                </div>

                {/* Share button */}
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => handleShare(pick)}
                    className="rounded p-1 text-muted-foreground/30 transition-colors hover:text-muted-foreground"
                    title="Copy match link"
                  >
                    {copiedId === pick.id ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Share2 className="size-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak + pending footer */}
      {(stats.streak > 0 || stats.pending > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {stats.streak > 0 && (
            <span className="flex items-center gap-1">
              {stats.streakType === "W"
                ? <TrendingUp className="size-3 text-emerald-400" />
                : <TrendingDown className="size-3 text-red-400" />}
              {stats.streak}-{stats.streakType} streak
            </span>
          )}
          {stats.pending > 0 && (
            <span>{stats.pending} pending result{stats.pending !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}
    </div>
  );
}
