import type { Metadata } from "next";
import Link from "next/link";
import { getRecapIndex } from "@/lib/engine-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Match Recaps — AI Betting Analysis & CLV Reports | OddsIntel",
  description:
    "Post-match analysis for hundreds of football matches. See how our AI model predicted each game, what closing-line value our bots captured, and the key signals that drove each pick.",
  alternates: { canonical: "https://oddsintel.app/recaps" },
};

function resultLabel(result: string | null, scoreHome: number | null, scoreAway: number | null) {
  const score =
    scoreHome != null && scoreAway != null ? `${scoreHome}–${scoreAway}` : null;
  if (result === "home") return { label: "H", color: "text-green-400", score };
  if (result === "away") return { label: "A", color: "text-red-400", score };
  if (result === "draw") return { label: "D", color: "text-yellow-400", score };
  return { label: "?", color: "text-muted-foreground", score };
}

function clvBadge(avgClv: number | null) {
  if (avgClv == null) return null;
  const pct = (avgClv * 100).toFixed(1);
  const color =
    avgClv >= 0.03 ? "text-green-400" : avgClv >= 0 ? "text-yellow-400" : "text-red-400";
  return <span className={`text-xs font-mono ${color}`}>{avgClv >= 0 ? "+" : ""}{pct}% CLV</span>;
}

export default async function RecapsIndexPage() {
  const recaps = await getRecapIndex(72, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Match Recaps</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Post-match analysis: AI predictions vs actual results, closing-line value, and signal breakdown.
        </p>
      </div>

      {recaps.length === 0 ? (
        <p className="text-muted-foreground">No settled A-tier matches yet.</p>
      ) : (
        <div className="grid gap-2">
          {recaps.map((r) => {
            const { label, color, score } = resultLabel(r.result, r.scoreHome, r.scoreAway);
            const dateStr = new Date(r.kickoff).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <Link
                key={r.matchId}
                href={`/recaps/${r.matchId}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/40 hover:bg-card/80 transition-colors"
              >
                {/* Result badge */}
                <span className={`w-6 text-center text-sm font-bold shrink-0 ${color}`}>
                  {label}
                </span>

                {/* Score */}
                <span className="w-12 text-center text-sm font-mono text-muted-foreground shrink-0">
                  {score ?? "–"}
                </span>

                {/* Teams */}
                <span className="flex-1 font-medium text-sm truncate">
                  {r.homeTeam} vs {r.awayTeam}
                </span>

                {/* Meta */}
                <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  <span className="hidden sm:block truncate max-w-32">
                    {r.leagueCountry} / {r.leagueName}
                  </span>
                  {r.betCount > 0 && (
                    <span className="text-xs text-muted-foreground">{r.betCount} bets</span>
                  )}
                  {clvBadge(r.avgClv)}
                  <span className="hidden md:block">{dateStr}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing the last 6 months of settled matches our model covered (A-tier: XGBoost ran).{" "}
        <Link href="/methodology" className="underline hover:text-foreground">
          How our model works →
        </Link>
      </p>
    </div>
  );
}
