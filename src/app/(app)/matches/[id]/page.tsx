import { getMatchById } from "@/lib/engine-data";
import { MatchDetailLive } from "@/components/match-detail-live";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Calendar, Shield } from "lucide-react";
import Link from "next/link";

const TIER_LABELS: Record<number, { label: string; cls: string }> = {
  1: { label: "Tier 1", cls: "border-green-500/30 text-green-400" },
  2: { label: "Tier 2", cls: "border-blue-500/30 text-blue-400" },
  3: { label: "Tier 3", cls: "border-zinc-500/30 text-zinc-400" },
};

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = getMatchById(id);

  if (!match) {
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
              No detailed data available for this match. It may have been removed
              or hasn&apos;t been analyzed yet.
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

  const kickoffDate = new Date(match.kickoff);
  const dateStr = kickoffDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = kickoffDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const tierInfo = TIER_LABELS[match.tier] ?? {
    label: `Tier ${match.tier}`,
    cls: "border-border text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href="/matches"
            className="hover:text-foreground transition-colors"
          >
            Matches
          </Link>
          <span>/</span>
          <span>Detail</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {match.homeTeam}{" "}
              <span className="text-muted-foreground font-normal">vs</span>{" "}
              {match.awayTeam}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs border-border gap-1.5"
              >
                {match.league}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs ${tierInfo.cls}`}
              >
                {tierInfo.label}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="font-mono">{dateStr}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{timeStr}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* ── Live Data Content ─────────────────────────────────────── */}
      <MatchDetailLive match={match} />
    </div>
  );
}
