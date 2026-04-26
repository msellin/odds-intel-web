import { matchDetails } from "@/lib/mock-data";
import type { MatchDetail } from "@/lib/types";
import { MatchDetailTabs } from "@/components/match-detail-tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, Shield } from "lucide-react";
import Link from "next/link";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data: MatchDetail | undefined = matchDetails[id];

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <h1 className="text-2xl font-bold">Match not found</h1>
        <p className="text-muted-foreground">
          No detailed data available for this match.
        </p>
        <Link
          href="/"
          className="text-sm text-blue-400 hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { match, referee } = data;
  const { homeTeam, awayTeam, league } = match;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span>Match Detail</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {homeTeam.name}{" "}
              <span className="text-muted-foreground font-normal">vs</span>{" "}
              {awayTeam.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs border-border gap-1.5"
              >
                {league.flag} {league.name}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="font-mono">{match.date}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{match.kickoff}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {referee.name}
              </span>
              <span className="mx-1.5">|</span>
              <span className="font-mono text-amber-400">
                {referee.yellowsPerGame}
              </span>{" "}
              cards/game
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* ── Tabbed Content ────────────────────────────────────────── */}
      <MatchDetailTabs data={data} />
    </div>
  );
}
