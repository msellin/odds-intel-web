import {
  getPublicMatchById,
  getPublicMatchBookmakerCount,
  getMatchById,
  getMatchStats,
  getOddsMovement,
} from "@/lib/engine-data";
import type { LiveMatch, MatchStatsData, OddsMovementPoint } from "@/lib/engine-data";
import { MatchDetailFree } from "@/components/match-detail-free";
import { MatchDetailLive } from "@/components/match-detail-live";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, Shield, MapPin, User } from "lucide-react";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Always fetch public match data (works without auth)
  const publicMatch = await getPublicMatchById(id);

  if (!publicMatch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6">
        <div className="rounded-xl border border-border/50 bg-card px-8 py-10 text-center space-y-4 max-w-md w-full">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-muted bg-muted/30 mx-auto">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">
              Match not found
            </h1>
            <p className="text-sm text-muted-foreground">
              No data available for this match. It may have been removed or
              hasn&apos;t been analyzed yet.
            </p>
          </div>
          <Link
            href="/matches"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Matches
          </Link>
        </div>
      </div>
    );
  }

  // Try to get authenticated data for pro users
  let liveMatch: LiveMatch | null = null;
  let matchStats: MatchStatsData | null = null;
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      liveMatch = await getMatchById(id);
      matchStats = await getMatchStats(id);
    }
  } catch {
    // Not authenticated — free content only
  }

  // Odds movement is public data (fetched for everyone, display gated client-side)
  const oddsMovement: OddsMovementPoint[] = await getOddsMovement(id);

  // Bookmaker count for the pro teaser
  const bookmakerCount = publicMatch.hasOdds
    ? await getPublicMatchBookmakerCount(id)
    : 0;

  const kickoffDate = new Date(publicMatch.kickoff);
  const dateStr = kickoffDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = kickoffDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href="/matches"
            className="hover:text-foreground transition-colors"
          >
            Matches
          </Link>
          <span>/</span>
          <span className="text-foreground">Detail</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            {/* Score for finished matches */}
            {publicMatch.score_home != null && publicMatch.score_away != null ? (
              <div className="flex items-center gap-4 mb-2">
                <span className="text-lg font-semibold text-foreground">{publicMatch.homeTeam}</span>
                <span className="font-mono text-3xl font-bold text-foreground tabular-nums">
                  {publicMatch.score_home} – {publicMatch.score_away}
                </span>
                <span className="text-lg font-semibold text-foreground">{publicMatch.awayTeam}</span>
              </div>
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {publicMatch.homeTeam}{" "}
                <span className="text-muted-foreground font-normal">vs</span>{" "}
                {publicMatch.awayTeam}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs border-border gap-1.5"
              >
                {publicMatch.league}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="font-mono">{dateStr}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{timeStr}</span>
              </span>
              {publicMatch.venue_name && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{publicMatch.venue_name}</span>
                </span>
              )}
              {publicMatch.referee && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{publicMatch.referee}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Free content — always visible */}
      <MatchDetailFree match={publicMatch} bookmakerCount={bookmakerCount} />

      {/* Pro content — only if authenticated with full odds data */}
      {liveMatch && liveMatch.odds.length > 0 && (
        <MatchDetailLive
          match={liveMatch}
          matchStats={matchStats}
          oddsMovement={oddsMovement}
        />
      )}
    </div>
  );
}
