import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getMatchRecapData } from "@/lib/engine-data";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const recap = await getMatchRecapData(id);
  if (!recap) return { title: "Match Recap | OddsIntel" };

  const dateStr = new Date(recap.kickoff).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const score =
    recap.scoreHome != null && recap.scoreAway != null
      ? ` ${recap.scoreHome}–${recap.scoreAway}`
      : "";
  const title = `${recap.homeTeam} vs ${recap.awayTeam}${score} — ${dateStr} | OddsIntel`;

  let description = `AI prediction and betting analysis for ${recap.homeTeam} vs ${recap.awayTeam} (${recap.leagueCountry} / ${recap.leagueName}, ${dateStr}).`;
  if (recap.modelHome != null) {
    description += ` Our model gave ${recap.homeTeam} a ${recap.modelHome}% win probability.`;
  }
  if (recap.bets.length > 0) {
    description += ` ${recap.bets.length} paper bet${recap.bets.length > 1 ? "s" : ""} tracked.`;
  }

  return {
    title,
    description,
    alternates: { canonical: `https://oddsintel.app/recaps/${id}` },
    openGraph: {
      title,
      description,
      url: `https://oddsintel.app/recaps/${id}`,
      type: "article",
    },
  };
}

function clvBar(clv: number | null, label: string) {
  if (clv == null) return null;
  const pct = clv * 100;
  const color = pct >= 2 ? "bg-green-500" : pct >= 0 ? "bg-yellow-500" : "bg-red-500";
  const width = Math.min(Math.abs(pct) * 5, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-muted-foreground">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`w-16 text-right font-mono ${pct >= 0 ? "text-green-400" : "text-red-400"}`}>
        {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
      </span>
    </div>
  );
}

function probBar(prob: number | null, label: string, isWinner: boolean) {
  if (prob == null) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-12 ${isWinner ? "text-green-400 font-semibold" : "text-muted-foreground"}`}>
        {label}
      </span>
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${isWinner ? "bg-green-500" : "bg-border"}`}
          style={{ width: `${prob}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-muted-foreground">{prob}%</span>
    </div>
  );
}

function signalLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function RecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recap = await getMatchRecapData(id);
  if (!recap) notFound();

  const finished = recap.status === "finished";
  const dateStr = new Date(recap.kickoff).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const actualResult = recap.result; // "home" | "draw" | "away" | null
  const wonBets = recap.bets.filter((b) => b.result === "won").length;
  const lostBets = recap.bets.filter((b) => b.result === "lost").length;
  const totalPnl = recap.bets.reduce((s, b) => s + b.pnl, 0);
  const settledBets = recap.bets.filter((b) => b.result !== "pending");
  const avgClv =
    settledBets.filter((b) => b.clv != null).length > 0
      ? settledBets.reduce((s, b) => s + (b.clv ?? 0), 0) /
        settledBets.filter((b) => b.clv != null).length
      : null;

  const gradeColor =
    recap.dataGrade === "A"
      ? "text-green-400"
      : recap.dataGrade === "B"
      ? "text-yellow-400"
      : "text-muted-foreground";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted-foreground flex items-center gap-1">
        <Link href="/recaps" className="hover:text-foreground">Recaps</Link>
        <span>/</span>
        <span className="truncate">{recap.homeTeam} vs {recap.awayTeam}</span>
      </nav>

      {/* Hero */}
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-xs text-muted-foreground mb-3">
          {recap.leagueCountry} / {recap.leagueName} · {dateStr}
        </p>

        <div className="flex items-center justify-between gap-4">
          {/* Home */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            {recap.logoHome ? (
              <Image src={recap.logoHome} alt={recap.homeTeam} width={48} height={48} className="object-contain" unoptimized />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
                {recap.homeTeam[0]}
              </div>
            )}
            <span className="text-sm font-semibold text-center leading-tight">{recap.homeTeam}</span>
          </div>

          {/* Score */}
          <div className="text-center shrink-0">
            {finished && recap.scoreHome != null ? (
              <span className="text-4xl font-bold font-mono">
                {recap.scoreHome}–{recap.scoreAway}
              </span>
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">vs</span>
            )}
            {finished && (
              <p className="text-xs text-muted-foreground mt-1">
                {actualResult === "home"
                  ? `${recap.homeTeam} won`
                  : actualResult === "away"
                  ? `${recap.awayTeam} won`
                  : "Draw"}
              </p>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            {recap.logoAway ? (
              <Image src={recap.logoAway} alt={recap.awayTeam} width={48} height={48} className="object-contain" unoptimized />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
                {recap.awayTeam[0]}
              </div>
            )}
            <span className="text-sm font-semibold text-center leading-tight">{recap.awayTeam}</span>
          </div>
        </div>

        {recap.dataGrade && (
          <p className="text-xs mt-4 text-center">
            <span className={`font-semibold ${gradeColor}`}>Grade {recap.dataGrade}</span>
            <span className="text-muted-foreground ml-1">
              · {recap.dataGrade === "A" ? "XGBoost + Poisson ensemble" : recap.dataGrade === "B" ? "Poisson model" : "API-Football prediction"}
            </span>
          </p>
        )}
      </div>

      {/* Model Prediction */}
      {(recap.modelHome != null || recap.modelDraw != null || recap.modelAway != null) && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Model Prediction</h2>
          <div className="space-y-2">
            {probBar(recap.modelHome, recap.homeTeam.split(" ")[0], actualResult === "home")}
            {probBar(recap.modelDraw, "Draw", actualResult === "draw")}
            {probBar(recap.modelAway, recap.awayTeam.split(" ")[0], actualResult === "away")}
          </div>
          <p className="text-xs text-muted-foreground">
            Ensemble win probabilities computed pre-match.
            {recap.dataGrade === "A" && " XGBoost + Poisson blend."}
          </p>
        </div>
      )}

      {/* Closing Line Value */}
      {(recap.pseudoClvHome != null || recap.pseudoClvDraw != null || recap.pseudoClvAway != null) && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Closing Line Value</h2>
            <Link href="/learn" className="text-xs text-muted-foreground hover:text-foreground underline">
              What is CLV?
            </Link>
          </div>
          <div className="space-y-2">
            {clvBar(recap.pseudoClvHome, "Home")}
            {clvBar(recap.pseudoClvDraw, "Draw")}
            {clvBar(recap.pseudoClvAway, "Away")}
          </div>
          <p className="text-xs text-muted-foreground">
            Positive CLV = opening odds were better than closing odds. Sharp money moved against you.
          </p>
        </div>
      )}

      {/* Bets Tracked */}
      {recap.bets.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Bets Tracked</h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{wonBets}W / {lostBets}L</span>
              <span className={totalPnl >= 0 ? "text-green-400" : "text-red-400"}>
                {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}u P&L
              </span>
              {avgClv != null && (
                <span className={avgClv >= 0 ? "text-green-400" : "text-red-400"}>
                  avg {avgClv >= 0 ? "+" : ""}{(avgClv * 100).toFixed(2)}% CLV
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 pr-3">Bot</th>
                  <th className="text-left pb-2 pr-3">Market</th>
                  <th className="text-left pb-2 pr-3">Pick</th>
                  <th className="text-right pb-2 pr-3">Odds</th>
                  <th className="text-right pb-2 pr-3">CLV</th>
                  <th className="text-right pb-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recap.bets.map((b) => (
                  <tr key={b.id}>
                    <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-24">{b.botName}</td>
                    <td className="py-1.5 pr-3 uppercase text-muted-foreground">{b.market}</td>
                    <td className="py-1.5 pr-3 capitalize">{b.selection}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{b.oddsAtPick.toFixed(2)}</td>
                    <td className={`py-1.5 pr-3 text-right font-mono ${b.clv != null && b.clv >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {b.clv != null ? `${b.clv >= 0 ? "+" : ""}${(b.clv * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className={`py-1.5 text-right font-semibold ${b.result === "won" ? "text-green-400" : b.result === "lost" ? "text-red-400" : "text-muted-foreground"}`}>
                      {b.result === "won" ? "W" : b.result === "lost" ? "L" : b.result === "void" ? "V" : "?"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Paper bets — tracked by our automated bots. Not real money.
          </p>
        </div>
      )}

      {/* Key Signals */}
      {recap.signals.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Key Pre-Match Signals</h2>
          <div className="grid grid-cols-2 gap-2">
            {recap.signals.map((s) => (
              <div key={s.signalName} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{signalLabel(s.signalName)}</span>
                <span className="text-sm font-mono">{s.signalValue.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center space-y-2">
        <p className="text-sm font-medium">See predictions before they settle</p>
        <p className="text-xs text-muted-foreground">
          We track 280+ leagues. Sign up free to get today&apos;s value bets and AI predictions before kickoff.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Get free predictions
        </Link>
      </div>

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `${recap.homeTeam} vs ${recap.awayTeam}`,
            startDate: recap.kickoff,
            sport: "Football",
            competitor: [
              { "@type": "SportsTeam", name: recap.homeTeam },
              { "@type": "SportsTeam", name: recap.awayTeam },
            ],
            ...(finished && recap.scoreHome != null
              ? {
                  result: `${recap.scoreHome}–${recap.scoreAway}`,
                }
              : {}),
          }),
        }}
      />
    </div>
  );
}
