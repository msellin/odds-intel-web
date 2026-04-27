"use client";

import type { PublicMatch } from "@/lib/engine-data";
import { interestScore, interestIndicator } from "@/lib/match-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, Lock } from "lucide-react";
import Link from "next/link";

interface MatchDetailFreeProps {
  match: PublicMatch;
  bookmakerCount: number;
}

export function MatchDetailFree({ match, bookmakerCount }: MatchDetailFreeProps) {
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
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No odds data available for this match yet.
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
                : "No odds or model data available for this match yet."}
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
