export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, TrendingUp, Calendar } from "lucide-react";
import {
  getLeaguePredictions,
  PREDICTION_LEAGUES,
} from "@/lib/engine-data";
import type { LeaguePredictionMatch } from "@/lib/engine-data";

export async function generateStaticParams() {
  return PREDICTION_LEAGUES.map((l) => ({ league: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>;
}): Promise<Metadata> {
  const { league: slug } = await params;
  const meta = PREDICTION_LEAGUES.find((l) => l.slug === slug);
  const name = meta?.name ?? slug.replace(/-/g, " ");
  const title = `${name} Predictions This Week — OddsIntel`;
  const description = `AI model predictions for ${name} fixtures this week. Win probabilities, model calls and value picks powered by Poisson + XGBoost.`;
  const url = `https://oddsintel.app/predictions/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

function ModelCallBadge({ call, confidence }: { call: "home" | "draw" | "away"; confidence: number }) {
  const colors = {
    home: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    draw: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    away: "bg-sky-500/15 text-sky-400 border-sky-500/20",
  };
  const labels = { home: "Home Win", draw: "Draw", away: "Away Win" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[call]}`}>
      {labels[call]} <span className="opacity-60">·</span> {confidence}%
    </span>
  );
}

function ProbBar({ label, value, active }: { label: string; value: number | null; active: boolean }) {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-8 shrink-0 text-muted-foreground/60">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div
          className={`h-full rounded-full ${active ? "bg-violet-500" : "bg-muted-foreground/30"}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className={`w-8 text-right tabular-nums ${active ? "text-foreground" : "text-muted-foreground/60"}`}>{value}%</span>
    </div>
  );
}

function MatchCard({ match }: { match: LeaguePredictionMatch }) {
  const kickoff = new Date(match.kickoff);
  const dateStr = kickoff.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
  const timeStr = kickoff.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-xl border border-white/[0.06] bg-card/40 p-4 transition-colors hover:bg-white/[0.04] hover:border-white/10"
    >
      {/* Date + time */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <Calendar className="size-3" />
        {dateStr} · {timeStr} UTC
      </div>

      {/* Teams */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">
            {match.homeTeam} <span className="text-muted-foreground/30 font-normal">vs</span> {match.awayTeam}
          </p>
        </div>
        {match.modelCall && match.confidence && (
          <ModelCallBadge call={match.modelCall} confidence={match.confidence} />
        )}
      </div>

      {/* Probability bars */}
      {match.homeProb !== null && (
        <div className="mb-3 space-y-1.5">
          <ProbBar label="H" value={match.homeProb} active={match.modelCall === "home"} />
          <ProbBar label="D" value={match.drawProb} active={match.modelCall === "draw"} />
          <ProbBar label="A" value={match.awayProb} active={match.modelCall === "away"} />
        </div>
      )}

      {/* Odds row */}
      {match.bestHomeOdds && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
          <span>Best odds:</span>
          <span className="font-mono">{match.bestHomeOdds?.toFixed(2)}</span>
          <span>/</span>
          <span className="font-mono">{match.bestDrawOdds?.toFixed(2)}</span>
          <span>/</span>
          <span className="font-mono">{match.bestAwayOdds?.toFixed(2)}</span>
        </div>
      )}

      {/* Preview teaser */}
      {match.previewTeaser && (
        <p className="mt-3 border-t border-white/[0.04] pt-3 text-xs leading-relaxed text-muted-foreground/70 line-clamp-2">
          {match.previewTeaser}
        </p>
      )}
    </Link>
  );
}

export default async function LeaguePredictionsPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const data = await getLeaguePredictions(slug);

  if (!data) notFound();

  const noMatches = data.matches.length === 0;
  const withPreds = data.matches.filter((m) => m.modelCall !== null);

  // FAQ schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How does OddsIntel predict ${data.leagueName} matches?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `OddsIntel uses a Poisson + XGBoost ensemble trained on historical match data. The model estimates goal expectation from team form, ELO ratings, and head-to-head records, then blends model probability with bookmaker-implied probability for calibrated outputs.`,
        },
      },
      {
        "@type": "Question",
        name: "Are these predictions guaranteed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Football predictions are probabilistic. A 65% model call means the model estimates a 65% chance, not a certainty. Our track record shows win rates, ROI, and CLV over time.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/predictions" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <TrendingUp className="size-3" />
            Predictions
          </Link>
          <ChevronLeft className="size-3 rotate-180" />
          <span className="text-foreground/60">{data.leagueName}</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {data.leagueName} Predictions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.leagueCountry} · {data.matches.length} upcoming fixtures
            {withPreds.length > 0 && ` · ${withPreds.length} with model predictions`}
          </p>
        </div>

        {/* Match list */}
        {noMatches ? (
          <div className="rounded-xl border border-white/[0.06] bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">No upcoming fixtures in the next 3 weeks.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Fixtures are loaded daily. Check back tomorrow.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}

        {/* Methodology note */}
        <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">About These Predictions</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Probabilities from a Poisson goals model (Dixon-Coles corrected) blended with XGBoost trained on 96K matches.
            Model output is shrunk toward market-implied probability — higher trust in market for top leagues (Premier League, La Liga).
            See{" "}
            <Link href="/how-it-works" className="underline underline-offset-2 hover:text-foreground transition-colors">
              methodology
            </Link>{" "}
            or the full{" "}
            <Link href="/track-record" className="underline underline-offset-2 hover:text-foreground transition-colors">
              track record
            </Link>.
          </p>
        </div>

        {/* Back link */}
        <Link
          href="/predictions"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pb-4"
        >
          <ChevronLeft className="size-3" />
          All leagues
        </Link>
      </div>
    </>
  );
}
