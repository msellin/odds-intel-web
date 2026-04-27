"use client";

import type { LiveMatch } from "@/lib/engine-data";
import { TierGate } from "@/components/tier-gate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function MatchDetailLive({ match }: { match: LiveMatch }) {
  const hasOver25 = match.odds.some((o) => o.over25 > 0);

  return (
    <div className="space-y-6">
      {/* ── Odds Comparison ─────────────────────────────────────── */}
      <TierGate requiredTier="analyst" featureName="Odds Comparison">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">1X2 Odds Comparison</CardTitle>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Updated {timeAgo(match.scrapedAt)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Operator</TableHead>
                    <TableHead className="text-xs text-center">Home</TableHead>
                    <TableHead className="text-xs text-center">Draw</TableHead>
                    <TableHead className="text-xs text-center">Away</TableHead>
                    {hasOver25 && (
                      <>
                        <TableHead className="text-xs text-center">
                          O 2.5
                        </TableHead>
                        <TableHead className="text-xs text-center">
                          U 2.5
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {match.odds.map((o) => {
                    const isBestHome =
                      o.home > 0 && o.home === match.bestHome;
                    const isBestDraw =
                      o.draw > 0 && o.draw === match.bestDraw;
                    const isBestAway =
                      o.away > 0 && o.away === match.bestAway;

                    // Best over/under across operators
                    const bestOver =
                      hasOver25
                        ? Math.max(
                            ...match.odds
                              .filter((x) => x.over25 > 0)
                              .map((x) => x.over25)
                          )
                        : 0;
                    const bestUnder =
                      hasOver25
                        ? Math.max(
                            ...match.odds
                              .filter((x) => x.under25 > 0)
                              .map((x) => x.under25)
                          )
                        : 0;

                    const isBestOver = o.over25 > 0 && o.over25 === bestOver;
                    const isBestUnder =
                      o.under25 > 0 && o.under25 === bestUnder;

                    return (
                      <TableRow key={o.operator} className="border-border">
                        <TableCell className="text-xs font-medium py-2">
                          {o.operator}
                        </TableCell>
                        <TableCell
                          className={`text-center font-mono text-xs py-2 ${
                            isBestHome ? "text-green-400 font-bold" : ""
                          }`}
                        >
                          {o.home > 0 ? o.home.toFixed(2) : "-"}
                        </TableCell>
                        <TableCell
                          className={`text-center font-mono text-xs py-2 ${
                            isBestDraw ? "text-green-400 font-bold" : ""
                          }`}
                        >
                          {o.draw > 0 ? o.draw.toFixed(2) : "-"}
                        </TableCell>
                        <TableCell
                          className={`text-center font-mono text-xs py-2 ${
                            isBestAway ? "text-green-400 font-bold" : ""
                          }`}
                        >
                          {o.away > 0 ? o.away.toFixed(2) : "-"}
                        </TableCell>
                        {hasOver25 && (
                          <>
                            <TableCell
                              className={`text-center font-mono text-xs py-2 ${
                                isBestOver ? "text-green-400 font-bold" : ""
                              }`}
                            >
                              {o.over25 > 0 ? o.over25.toFixed(2) : "-"}
                            </TableCell>
                            <TableCell
                              className={`text-center font-mono text-xs py-2 ${
                                isBestUnder ? "text-green-400 font-bold" : ""
                              }`}
                            >
                              {o.under25 > 0 ? o.under25.toFixed(2) : "-"}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TierGate>

    </div>
  );
}
