import type { PublicMatch, MatchH2H, TeamStanding } from "@/lib/engine-data";
import { interestScore, interestIndicator } from "@/lib/match-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3, History, TableIcon, Zap, Info, Lock } from "lucide-react";
import Link from "next/link";

function Tooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border/60 bg-popover p-3 text-xs text-muted-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        {content}
      </span>
    </span>
  );
}

interface MatchDetailFreeProps {
  match: PublicMatch;
  bookmakerCount: number;
  h2h?: MatchH2H | null;
  homeStanding?: TeamStanding | null;
  awayStanding?: TeamStanding | null;
  hasInjuries?: boolean;
  hasLineups?: boolean;
  hasStats?: boolean;
  isAuthenticated?: boolean;
  isPro?: boolean;
  /** Hide odds card (when odds are shown elsewhere, e.g. Odds tab) */
  hideOdds?: boolean;
  /** Hide data coverage card */
  hideCoverage?: boolean;
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
  hasInjuries,
  hasLineups,
  hasStats,
  isAuthenticated,
  isPro,
  hideOdds,
  hideCoverage,
}: MatchDetailFreeProps) {
  const interest = interestScore(match);
  const indicator = interestIndicator(interest);

  return (
    <div className="space-y-3">
      {/* Best Odds Summary */}
      {!hideOdds && match.hasOdds && match.bestHome > 0 ? (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Best Available Odds
              <Tooltip content={
                <span>
                  <span className="mb-1 block font-semibold text-foreground">Decimal odds explained</span>
                  The highest odds available across all bookmakers we track. Higher = better return.
                  <span className="mt-1.5 block"><strong className="text-foreground/80">2.00</strong> — doubles your stake (even money)</span>
                  <span className="block"><strong className="text-foreground/80">1.50</strong> — 50% profit on stake</span>
                  <span className="mt-1.5 block text-muted-foreground/70">Pro tier shows the full comparison across all {`bookmakers`} so you always get the best price.</span>
                </span>
              }>
                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
              </Tooltip>
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
      ) : !hideOdds ? (
        <Card className="border-border bg-card">
          <CardContent className="py-5 text-center text-sm text-muted-foreground">
            Odds not yet available for this match.
          </CardContent>
        </Card>
      ) : null}

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

      {/* Data Coverage + Pro hints */}
      {!hideCoverage && <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Data Coverage
            <Tooltip content={
              <span>
                <span className="mb-1 block font-semibold text-foreground">What is data coverage?</span>
                Our model ingests up to 58 signals per match — form, ELO, H2H, injuries, referee stats, market signals and more. Coverage grade reflects how many signals are available:
                <span className="mt-1.5 block"><strong className="text-foreground/80">Grade A</strong> — European top leagues, full signal set</span>
                <span className="block"><strong className="text-foreground/80">Grade B</strong> — Global leagues with ELO data</span>
                <span className="block"><strong className="text-foreground/80">Grade C/D</strong> — Limited data, prediction only</span>
              </span>
            }>
              <Info className="ml-1 h-3.5 w-3.5 cursor-help text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <Tooltip content={
              <span>
                <span className="mb-1 block font-semibold text-foreground">Match interest score</span>
                <span className="block">🔥 <strong className="text-foreground/80">Hot</strong> — odds available, high data coverage</span>
                <span className="block">⚡ <strong className="text-foreground/80">Notable</strong> — some signals detected</span>
                <span className="block">— <strong className="text-foreground/80">Low</strong> — limited data, treat prediction with caution</span>
              </span>
            }>
              <div className="flex cursor-help items-center gap-2">
                <span className="text-xl">{indicator}</span>
                <span className="text-sm capitalize text-foreground font-medium">
                  {interest}
                </span>
              </div>
            </Tooltip>
            {bookmakerCount > 0 && (
              <Badge variant="outline" className="text-xs border-border">
                {bookmakerCount} bookmaker{bookmakerCount !== 1 ? "s" : ""} tracked
              </Badge>
            )}
          </div>

          {/* Pro locked hints — only show if there's actually data behind the lock and user is not already Pro */}
          {!isPro && (bookmakerCount > 1 || hasInjuries || hasLineups || hasStats) && (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <Zap className="h-3 w-3 text-amber-400" />
                Pro data available for this match
              </p>
              <div className="flex flex-wrap gap-2">
                {bookmakerCount > 1 && (
                  <span className="flex items-center gap-1 rounded border border-white/[0.06] bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    {bookmakerCount} bookmakers odds
                  </span>
                )}
                {hasInjuries && (
                  <span className="flex items-center gap-1 rounded border border-white/[0.06] bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    Injury list
                  </span>
                )}
                {hasLineups && (
                  <span className="flex items-center gap-1 rounded border border-white/[0.06] bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    Confirmed lineups
                  </span>
                )}
                {hasStats && (
                  <span className="flex items-center gap-1 rounded border border-white/[0.06] bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    Match stats
                  </span>
                )}
              </div>
              <Link
                href={isAuthenticated ? "/profile" : "/signup"}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {isAuthenticated ? "Upgrade to Pro →" : "Unlock with Pro →"}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>}

    </div>
  );
}
