"use client";

import type { PublicMatch, MatchH2H, TeamStanding } from "@/lib/engine-data";
import { interestScore, interestIndicator } from "@/lib/match-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, Lock, History, TableIcon } from "lucide-react";
import Link from "next/link";

interface MatchDetailFreeProps {
  match: PublicMatch;
  bookmakerCount: number;
  h2h?: MatchH2H | null;
  homeStanding?: TeamStanding | null;
  awayStanding?: TeamStanding | null;
}

function FormBadge({ form }: { form: string }) {
  if (!form) return null;
  return (
    <div className="flex gap-1">
      {form.split("").map((c, i) => (
        <span
          key={i}
          className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${
            c === "W"
              ? "bg-emerald-500/20 text-emerald-400"
              : c === "L"
                ? "bg-red-500/20 text-red-400"
                : "bg-muted/40 text-muted-foreground"
          }`}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function MatchDetailFree({
  match,
  bookmakerCount,
  h2h,
  homeStanding,
  awayStanding,
}: MatchDetailFreeProps) {
  const interest = interestScore(match);
  const indicator = interestIndicator(interest);

  return (
    <div className="space-y-6">
      {/* Best Odds Summary */}
      {match.hasOdds && match.bestHome > 0 ? (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Best Available Odds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-muted/30 py-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Home
                </p>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {match.bestHome.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/30 py-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Draw
                </p>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {match.bestDraw.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/30 py-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Away
                </p>
                <p className="font-mono text-2xl font-bold text-foreground">
                  {match.bestAway.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="py-5 text-center text-sm text-muted-foreground">
            Odds not yet available for this match.
          </CardContent>
        </Card>
      )}

      {/* H2H */}
      {h2h && (h2h.homeWins + h2h.draws + h2h.awayWins) > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Head to Head
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">{h2h.homeWins}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate max-w-[80px]">
                  {match.homeTeam.split(" ").slice(-1)[0]}
                </p>
              </div>
              <div className="flex-1 flex rounded overflow-hidden h-2">
                {h2h.homeWins > 0 && (
                  <div
                    className="bg-blue-500/70"
                    style={{
                      width: `${(h2h.homeWins / (h2h.homeWins + h2h.draws + h2h.awayWins)) * 100}%`,
                    }}
                  />
                )}
                {h2h.draws > 0 && (
                  <div
                    className="bg-muted/50"
                    style={{
                      width: `${(h2h.draws / (h2h.homeWins + h2h.draws + h2h.awayWins)) * 100}%`,
                    }}
                  />
                )}
                {h2h.awayWins > 0 && (
                  <div
                    className="bg-amber-500/70"
                    style={{
                      width: `${(h2h.awayWins / (h2h.homeWins + h2h.draws + h2h.awayWins)) * 100}%`,
                    }}
                  />
                )}
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-foreground">{h2h.awayWins}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate max-w-[80px]">
                  {match.awayTeam.split(" ").slice(-1)[0]}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-muted-foreground">{h2h.draws}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">D</p>
              </div>
            </div>

            {/* Recent meetings */}
            {h2h.recent.length > 0 && (
              <div className="space-y-1.5">
                {h2h.recent.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-[72px] shrink-0 font-mono">
                      {m.date ? new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                    </span>
                    <span className="flex-1 text-right truncate text-foreground/80">{m.homeTeam}</span>
                    <span className="font-mono font-bold text-foreground shrink-0 w-[42px] text-center">
                      {m.scoreHome !== null && m.scoreAway !== null
                        ? `${m.scoreHome}–${m.scoreAway}`
                        : "vs"}
                    </span>
                    <span className="flex-1 truncate text-foreground/80">{m.awayTeam}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Standings */}
      {(homeStanding || awayStanding) && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              League Table
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Home", standing: homeStanding, team: match.homeTeam },
                { label: "Away", standing: awayStanding, team: match.awayTeam },
              ]
                .filter((r) => r.standing)
                .map(({ label, standing, team }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">{team}</span>
                      <FormBadge form={standing!.form} />
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-mono font-bold text-foreground w-6 text-center">
                        #{standing!.rank}
                      </span>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>
                          <span className="text-foreground font-medium">{standing!.points}</span> pts
                        </span>
                        <span>
                          {standing!.wins}W {standing!.draws}D {standing!.losses}L
                        </span>
                        <span>
                          {standing!.goalsFor}:{standing!.goalsAgainst}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Availability */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Data Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{indicator}</span>
              <span className="text-sm capitalize text-foreground font-medium">
                {interest}
              </span>
            </div>
            {bookmakerCount > 0 && (
              <Badge variant="outline" className="text-xs border-border">
                {bookmakerCount} bookmaker{bookmakerCount !== 1 ? "s" : ""} tracked
              </Badge>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {interest === "hot"
              ? "This match has odds coverage from multiple bookmakers."
              : interest === "warm"
                ? "This match is live. Odds data may update during play."
                : "No odds data available yet — enrichment data shown above is from our match database."}
          </p>
        </CardContent>
      </Card>

      {/* Pro teaser */}
      {match.hasOdds && bookmakerCount > 1 && (
        <div className="relative overflow-hidden rounded-xl border border-border bg-card">
          {/* Blurred skeleton content */}
          <div className="p-5 blur-[6px] pointer-events-none select-none">
            <p className="text-sm font-medium mb-3">Full Odds Comparison</p>
            <div className="space-y-2.5">
              {Array.from({ length: Math.min(bookmakerCount, 4) }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-1.5">
                  <div className="h-3.5 w-20 rounded bg-muted/60" />
                  <div className="h-3.5 w-14 rounded bg-muted/40 ml-auto" />
                  <div className="h-3.5 w-14 rounded bg-muted/40" />
                  <div className="h-3.5 w-14 rounded bg-muted/40" />
                </div>
              ))}
            </div>
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <div className="text-center space-y-3 px-6">
              <Lock className="h-5 w-5 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Compare odds from {bookmakerCount} bookmakers
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                See which bookmaker offers the best price for every market.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Sign Up Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
