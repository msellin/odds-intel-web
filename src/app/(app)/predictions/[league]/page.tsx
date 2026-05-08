// ISR — re-render at most once an hour. Same SEO profile as a static page (Vercel
// serves cached HTML), but lets odds + predictions stay fresh between fixture-fetch runs.
export const revalidate = 3600;

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, TrendingUp, Calendar } from "lucide-react";
import {
  getLeaguePredictions,
  PREDICTION_LEAGUES,
} from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";
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

function TeamCrest({ logo, name }: { logo: string | null; name: string }) {
  if (logo) {
    return (
      <div className="relative size-6 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
        <Image
          src={logo}
          alt={name}
          fill
          sizes="24px"
          className="object-contain p-0.5"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className="size-6 shrink-0 rounded-full bg-white/[0.08] flex items-center justify-center">
      <span className="text-[10px] font-bold text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
    </div>
  );
}

function MatchCard({ match }: { match: LeaguePredictionMatch }) {
  const kickoff = new Date(match.kickoff);
  const timeStr = kickoff.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
  const hasPrediction = match.homeProb !== null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group flex h-full flex-col rounded-xl border border-white/[0.06] bg-card/40 p-3.5 transition-colors hover:bg-white/[0.04] hover:border-white/10"
    >
      {/* Time + model badge */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground/60 tabular-nums">{timeStr} UTC</span>
        {match.modelCall && match.confidence && (
          <ModelCallBadge call={match.modelCall} confidence={match.confidence} />
        )}
      </div>

      {/* Teams w/ crests */}
      <div className="mb-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <TeamCrest logo={match.homeLogo} name={match.homeTeam} />
          <span className={`truncate text-sm font-semibold ${match.modelCall === "home" ? "text-foreground" : "text-foreground/90"}`}>
            {match.homeTeam}
          </span>
          {match.homeProb !== null && (
            <span className={`ml-auto text-xs tabular-nums ${match.modelCall === "home" ? "text-emerald-400" : "text-muted-foreground/60"}`}>
              {match.homeProb}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TeamCrest logo={match.awayLogo} name={match.awayTeam} />
          <span className={`truncate text-sm font-semibold ${match.modelCall === "away" ? "text-foreground" : "text-foreground/90"}`}>
            {match.awayTeam}
          </span>
          {match.awayProb !== null && (
            <span className={`ml-auto text-xs tabular-nums ${match.modelCall === "away" ? "text-sky-400" : "text-muted-foreground/60"}`}>
              {match.awayProb}%
            </span>
          )}
        </div>
        {match.drawProb !== null && (
          <div className="flex items-center gap-2 pl-8">
            <span className="text-xs text-muted-foreground/40">Draw</span>
            <span className={`ml-auto text-xs tabular-nums ${match.modelCall === "draw" ? "text-amber-400" : "text-muted-foreground/40"}`}>
              {match.drawProb}%
            </span>
          </div>
        )}
      </div>

      {/* Probability bar (single stacked bar, more compact than 3 separate bars) */}
      {hasPrediction && (
        <div className="mb-2 flex h-1 overflow-hidden rounded-full bg-muted/30">
          <div className="bg-emerald-500/70" style={{ width: `${match.homeProb}%` }} />
          <div className="bg-amber-500/60" style={{ width: `${match.drawProb}%` }} />
          <div className="bg-sky-500/70" style={{ width: `${match.awayProb}%` }} />
        </div>
      )}

      {/* Odds row */}
      {match.bestHomeOdds ? (
        <div className="mt-auto flex items-center gap-2 pt-1 text-[11px] text-muted-foreground/50">
          <span className="text-muted-foreground/40">Best odds</span>
          <span className="font-mono tabular-nums">{match.bestHomeOdds?.toFixed(2)}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="font-mono tabular-nums">{match.bestDrawOdds?.toFixed(2)}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="font-mono tabular-nums">{match.bestAwayOdds?.toFixed(2)}</span>
        </div>
      ) : !hasPrediction ? (
        <p className="mt-auto pt-1 text-[11px] text-muted-foreground/40">Predictions update closer to kick-off</p>
      ) : null}

      {/* Preview teaser */}
      {match.previewTeaser && (
        <p className="mt-2.5 border-t border-white/[0.04] pt-2.5 text-[11px] leading-relaxed text-muted-foreground/60 line-clamp-2">
          {match.previewTeaser}
        </p>
      )}
    </Link>
  );
}

function formatDateGroupKey(iso: string): string {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

function formatDateGroupLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

function groupMatchesByDay(matches: LeaguePredictionMatch[]): Array<[string, LeaguePredictionMatch[]]> {
  const groups = new Map<string, LeaguePredictionMatch[]>();
  for (const m of matches) {
    const key = formatDateGroupKey(m.kickoff);
    const existing = groups.get(key) ?? [];
    existing.push(m);
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
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

      <div className="mx-auto max-w-5xl space-y-6">
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
        <div className="flex items-start gap-3">
          <span className="mt-1 text-3xl leading-none" aria-hidden="true">
            {getCountryFlag(data.leagueCountry)}
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {data.leagueName} Predictions
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.leagueCountry} · {data.matches.length} upcoming fixtures
              {withPreds.length > 0 && ` · ${withPreds.length} with model predictions`}
            </p>
          </div>
        </div>

        {/* Match list — grouped by day, 2-column on lg+ */}
        {noMatches ? (
          <div className="rounded-xl border border-white/[0.06] bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">No upcoming fixtures in the next 3 weeks.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Fixtures are loaded daily. Check back tomorrow.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupMatchesByDay(data.matches).map(([dayKey, dayMatches]) => (
              <section key={dayKey}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                  <Calendar className="size-3" />
                  {formatDateGroupLabel(dayKey)}
                  <span className="text-muted-foreground/40 normal-case tracking-normal">· {dayMatches.length}</span>
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {dayMatches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </section>
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
