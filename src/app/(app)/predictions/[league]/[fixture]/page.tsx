/**
 * GROWTH-SEO-CONTENT-ENGINE Phase 1 (2026-06-05) — per-fixture prediction page.
 *
 * URL shape:   /predictions/[league-slug]/[fixture-slug]
 * Example:     /predictions/premier-league/manchester-city-vs-arsenal-2026-12-08
 *
 * The free-tier SEO surface targeting "[home] vs [away] prediction" long-tail
 * Google searches. Forebet / PredictZ / WinDrawWin all built their 18M / 3.5M /
 * 2.2M monthly visits on this exact pattern.
 *
 * Content-rich enough to avoid thin-content demotion: we reuse the AI-generated
 * match_previews body (~200 words of unique copy per fixture), the model's
 * confidence per outcome, recent form, and an SEO-friendly "Why this matters"
 * explainer below the fold.
 *
 * ISR (revalidate hourly) — same SEO profile as static + lets the model
 * confidence refresh between fetch_predictions runs.
 *
 * SportsEvent + FAQPage JSON-LD for Google rich snippets.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Calendar, MapPin } from "lucide-react";
import {
  resolveFixtureSlug,
  getPublicMatchById,
  getMatchPreview,
  getPredictionFixturesForSitemap,
  getPredictionLeagueBySlug,
  getPublishedPicksForMatch,
} from "@/lib/engine-data";
import { TeamCrest } from "@/components/team-crest";
import { Check, X } from "lucide-react";

export const revalidate = 3600; // 1h ISR — same window as fixture data refresh

// Don't statically pre-generate at build time (thousands of fixtures × 8 leagues
// would balloon the build). Let Next ISR generate-on-demand and cache.
export const dynamicParams = true;

export async function generateStaticParams() {
  // Build-time params kept narrow — just upcoming fixtures so the top SEO
  // surfaces ship in the build. Rest hydrate on first hit via ISR.
  const all = await getPredictionFixturesForSitemap();
  return all
    .filter((f) => f.status === "scheduled")
    .slice(0, 200)
    .map((f) => ({ league: f.leagueSlug, fixture: f.fixtureSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string; fixture: string }>;
}): Promise<Metadata> {
  const { league, fixture } = await params;
  const resolved = await resolveFixtureSlug(league, fixture);
  if (!resolved) return { title: "Prediction not found — OddsIntel" };
  const match = await getPublicMatchById(resolved.matchId);
  if (!match) return { title: "Prediction not found — OddsIntel" };

  const leagueMeta = await getPredictionLeagueBySlug(league);
  const home = match.homeTeam;
  const away = match.awayTeam;
  const kickoff = new Date(match.kickoff);
  const dateStr = kickoff.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const leagueName = leagueMeta?.name ?? match.league ?? "Football";

  // GROWTH-SEO-PAST-FIXTURE-RECAPS (2026-06-05) — Phase 3: distinct metadata
  // for finished matches so search results and OG cards show "Result: 2-1"
  // rather than "Prediction" copy that's no longer relevant.
  const isFinished =
    match.status === "finished" || match.status === "ft" ||
    (match.score_home != null && match.score_away != null);
  const scoreStr =
    isFinished && match.score_home != null && match.score_away != null
      ? `${match.score_home}-${match.score_away}`
      : null;
  const title = isFinished && scoreStr
    ? `${home} ${scoreStr} ${away} Result + Recap — ${dateStr} ${leagueName} | OddsIntel`
    : `${home} vs ${away} Prediction — ${dateStr} ${leagueName} | OddsIntel`;
  const description = isFinished && scoreStr
    ? `${home} ${scoreStr} ${away} full-time. See whether the OddsIntel AI model called it right and how the result compared to model probabilities.`
    : `AI prediction for ${home} vs ${away} (${leagueName}, ${dateStr}). Model probability, recent form, key signals. Powered by Poisson + XGBoost.`;
  const url = `https://oddsintel.app/predictions/${league}/${fixture}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

function ConfidenceBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  const pct = Math.round(prob * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground/80">{label}</span>
        <span className="font-mono text-foreground">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function FixturePredictionPage({
  params,
}: {
  params: Promise<{ league: string; fixture: string }>;
}) {
  const { league, fixture } = await params;
  const resolved = await resolveFixtureSlug(league, fixture);
  if (!resolved) notFound();

  const [match, preview, publishedPicks] = await Promise.all([
    getPublicMatchById(resolved.matchId),
    getMatchPreview(resolved.matchId),
    getPublishedPicksForMatch(resolved.matchId),
  ]);
  if (!match) notFound();

  const leagueMeta = await getPredictionLeagueBySlug(league);
  const leagueName = leagueMeta?.name ?? match.league ?? "Football";
  const kickoff = new Date(match.kickoff);
  const dateStr = kickoff.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const timeStr = kickoff.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });

  // GROWTH-SEO-PAST-FIXTURE-RECAPS (2026-06-05) — Phase 3 of the SEO content
  // engine. Once a match finishes, the page transforms: scoreline + hit/miss
  // verdict on every published market the model called, with retrospective
  // framing. The accuracy compounds in SEO value — Google indexes the "did
  // the model call this right" content, which is more valuable post-result
  // than the pre-match prediction was.
  const isFinished =
    match.status === "finished" || match.status === "ft" ||
    (match.score_home != null && match.score_away != null);
  const hasScore = match.score_home != null && match.score_away != null;

  // Roll up picks into a tidy display set: market label, model selection,
  // model confidence, outcome (hit/miss/void/null). Only finished + outcome'd
  // picks get rendered; pending picks are filtered out (would be misleading).
  type RecapPick = {
    marketLabel: string;
    selectionLabel: string;
    confidencePct: number;
    outcome: "hit" | "miss" | "void";
  };
  const MARKET_LABELS: Record<string, string> = {
    "1x2": "Match Winner",
    "over_under_15": "Over/Under 1.5",
    "over_under_25": "Over/Under 2.5",
    "btts": "Both Teams To Score",
  };
  const SELECTION_LABELS: Record<string, string> = {
    home: match.homeTeam,
    away: match.awayTeam,
    draw: "Draw",
    over_1_5: "Over 1.5",
    under_1_5: "Under 1.5",
    over_2_5: "Over 2.5",
    under_2_5: "Under 2.5",
    yes: "Yes",
    no: "No",
  };
  const recapPicks: RecapPick[] = publishedPicks
    .filter((p) => p.outcome === "hit" || p.outcome === "miss" || p.outcome === "void")
    .map((p) => {
      // selection comes in like "over_1.5" — normalise to lookup key
      const key = p.selection.replace(/\./g, "_").toLowerCase();
      return {
        marketLabel: MARKET_LABELS[p.market] ?? p.market,
        selectionLabel: SELECTION_LABELS[key] ?? p.selection,
        confidencePct: Math.round(p.modelProbability * 100),
        outcome: p.outcome as "hit" | "miss" | "void",
      };
    });
  const hitCount = recapPicks.filter((p) => p.outcome === "hit").length;
  const settledCount = recapPicks.filter((p) => p.outcome !== "void").length;

  // Model probabilities stored as 0-100 (per PublicMatch interface comment).
  // Convert to 0-1 for the bars + format pcts as whole numbers for display.
  const homePct = match.modelHome ?? null;
  const drawPct = match.modelDraw ?? null;
  const awayPct = match.modelAway ?? null;
  const hasModel = homePct !== null && drawPct !== null && awayPct !== null;
  const homeProb = hasModel ? homePct! / 100 : 0;
  const drawProb = hasModel ? drawPct! / 100 : 0;
  const awayProb = hasModel ? awayPct! / 100 : 0;
  const modelCall: "home" | "draw" | "away" | null = hasModel
    ? (homePct! >= drawPct! && homePct! >= awayPct! ? "home"
      : awayPct! >= drawPct! ? "away" : "draw")
    : null;
  const modelConfidence = hasModel
    ? Math.round(Math.max(homePct!, drawPct!, awayPct!))
    : null;
  const callTeam = modelCall === "home" ? match.homeTeam
    : modelCall === "away" ? match.awayTeam
    : modelCall === "draw" ? "Draw" : null;

  // JSON-LD payload — SportsEvent for Google rich snippets
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.homeTeam} vs ${match.awayTeam}`,
    startDate: kickoff.toISOString(),
    sport: "Soccer",
    homeTeam: { "@type": "SportsTeam", name: match.homeTeam },
    awayTeam: { "@type": "SportsTeam", name: match.awayTeam },
    organizer: { "@type": "Organization", name: leagueName },
  };
  if (match.venue_name) {
    jsonLd.location = { "@type": "Place", name: match.venue_name };
  }
  // Phase 3: finished-event status so Google can distinguish upcoming from
  // past in rich-snippet rendering ("Result" vs "Prediction" chip).
  if (isFinished) {
    jsonLd.eventStatus = "https://schema.org/EventScheduled";
    if (hasScore) {
      jsonLd.description = `${match.homeTeam} ${match.score_home}-${match.score_away} ${match.awayTeam}`;
    }
  }

  // Pre-format the percent values used in the FAQ answer so the literal copy
  // doesn't have stray non-null-asserted expressions (cleaner + safer).
  const homePctRound = hasModel ? Math.round(homePct!) : null;
  const drawPctRound = hasModel ? Math.round(drawPct!) : null;
  const awayPctRound = hasModel ? Math.round(awayPct!) : null;

  // Phase 3: FAQ pivots for finished fixtures — first question becomes the
  // result + verdict instead of a prediction. Keeps the schema usable for
  // Google rich snippets on both upcoming AND past fixtures.
  const finishedFirstQ = isFinished && hasScore
    ? {
        "@type": "Question",
        name: `What was the result of ${match.homeTeam} vs ${match.awayTeam}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Final score: ${match.homeTeam} ${match.score_home}-${match.score_away} ${match.awayTeam}.${
            settledCount > 0
              ? ` OddsIntel's AI model went ${hitCount}/${settledCount} on its published picks for this match.`
              : ""
          }`,
        },
      }
    : {
        "@type": "Question",
        name: `Who will win ${match.homeTeam} vs ${match.awayTeam}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: hasModel
            ? `OddsIntel's AI model picks ${callTeam} with ${modelConfidence}% confidence. Home ${homePctRound}%, draw ${drawPctRound}%, away ${awayPctRound}%.`
            : "The OddsIntel model has not yet generated a prediction for this fixture. Predictions are typically published 24 hours before kickoff.",
        },
      };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      finishedFirstQ,
      {
        "@type": "Question",
        name: `When ${isFinished ? "was" : "is"} ${match.homeTeam} vs ${match.awayTeam} kickoff?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${dateStr} at ${timeStr} UTC.`,
        },
      },
      {
        "@type": "Question",
        name: "How is the OddsIntel prediction calculated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A Poisson + XGBoost ensemble model trained on 10+ years of historical match data. The model accounts for team form, ELO, head-to-head history, injuries, lineups when available, and current market odds. Full methodology: oddsintel.app/methodology.",
        },
      },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="text-muted-foreground/40">/</span>
        <Link href="/predictions" className="hover:text-foreground">Predictions</Link>
        <span className="text-muted-foreground/40">/</span>
        <Link href={`/predictions/${league}`} className="hover:text-foreground">
          {leagueName}
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground/80 truncate">{match.homeTeam} vs {match.awayTeam}</span>
      </nav>

      {/* Hero */}
      <header className="mb-6 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" aria-hidden />
          <span>{dateStr} · {timeStr} UTC</span>
          {match.venue_name && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <MapPin className="size-3.5" aria-hidden />
              <span className="truncate">{match.venue_name}</span>
            </>
          )}
        </div>
        <h1 className="text-balance text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-4xl">
          {match.homeTeam} vs {match.awayTeam}
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          {isFinished ? "Result + AI recap" : "AI prediction"} · {leagueName}
        </p>
      </header>

      {/* GROWTH-SEO-PAST-FIXTURE-RECAPS (Phase 3) — finished-match recap.
          Replaces "this is what we predicted" copy with the actual result
          + retrospective verdict on each market the model called. Renders
          ABOVE the team-vs-team card so the scoreline lands in the
          screenful that gets indexed + previewed in OG cards. */}
      {isFinished && hasScore && (
        <section className="mb-6 rounded-2xl border border-green-500/20 bg-green-500/[0.04] px-5 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-green-400/80">
            Full time
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <p className="text-5xl font-black tracking-tight text-foreground tabular-nums">
              {match.score_home}–{match.score_away}
            </p>
            <p className="text-sm text-muted-foreground">
              {match.homeTeam} vs {match.awayTeam}
            </p>
          </div>
          {settledCount > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              The OddsIntel AI model went{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {hitCount}/{settledCount}
              </span>{" "}
              on its published picks for this match.
              {hitCount === settledCount && settledCount > 0 && " — clean sweep ✓"}
              {hitCount === 0 && settledCount > 0 && " — the model called this one wrong."}
            </p>
          )}
          {recapPicks.length > 0 && (
            <ul className="mt-4 space-y-2">
              {recapPicks.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-card/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      {p.marketLabel}
                    </p>
                    <p className="truncate font-medium text-foreground">
                      Model: <span className="text-foreground/90">{p.selectionLabel}</span>{" "}
                      <span className="text-muted-foreground/60 tabular-nums">({p.confidencePct}%)</span>
                    </p>
                  </div>
                  {p.outcome === "hit" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-green-400">
                      <Check className="size-3" aria-hidden /> Right
                    </span>
                  )}
                  {p.outcome === "miss" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-400">
                      <X className="size-3" aria-hidden /> Wrong
                    </span>
                  )}
                  {p.outcome === "void" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      Void
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {recapPicks.length === 0 && settledCount === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              The model did not have a settled published pick for this match.
            </p>
          )}
        </section>
      )}

      {/* Team-vs-team card */}
      <section className="mb-6 rounded-2xl border border-white/[0.06] bg-card/40 px-5 py-5">
        <div className="grid grid-cols-7 items-center gap-3">
          <div className="col-span-3 flex items-center gap-2.5">
            <TeamCrest logo={match.logoHome} name={match.homeTeam} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{match.homeTeam}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Home</p>
            </div>
          </div>
          <div className="col-span-1 text-center text-xs text-muted-foreground/60">vs</div>
          <div className="col-span-3 flex items-center justify-end gap-2.5">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold text-foreground">{match.awayTeam}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Away</p>
            </div>
            <TeamCrest logo={match.logoAway} name={match.awayTeam} />
          </div>
        </div>
      </section>

      {/* Model prediction (or retrospective view if finished) */}
      <section className="mb-6 space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          {isFinished ? "What the model thought before kickoff" : "Our model says"}
        </h2>
        {hasModel ? (
          <>
            <div className="rounded-xl border border-green-500/25 bg-green-500/[0.05] px-5 py-4">
              <p className="text-xs text-muted-foreground">
                Highest-probability outcome
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {callTeam} <span className="text-green-400">{modelConfidence}%</span>
              </p>
            </div>
            <div className="space-y-3 rounded-xl border border-white/[0.06] bg-card/30 px-5 py-4">
              <ConfidenceBar label={`${match.homeTeam} win`} prob={homeProb} color="bg-emerald-500/60" />
              <ConfidenceBar label="Draw" prob={drawProb} color="bg-amber-500/60" />
              <ConfidenceBar label={`${match.awayTeam} win`} prob={awayProb} color="bg-sky-500/60" />
            </div>
            <p className="text-xs text-muted-foreground">
              Probabilities from our Poisson + XGBoost ensemble. They reflect
              what the model thinks will happen — not what we&apos;d bet at the
              current odds.{" "}
              <Link href="/accuracy" className="text-foreground underline underline-offset-2 hover:text-green-400">
                See how accurate the model has been →
              </Link>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            The model hasn&apos;t generated a prediction for this fixture yet.
            Predictions are typically published 24 hours before kickoff.
          </p>
        )}
      </section>

      {/* AI preview — the unique content block. Two paragraphs of Gemini-generated copy
          per fixture. Critical for SEO depth (Google penalises thin programmatic pages). */}
      {preview?.previewText && (
        <section className="mb-6 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Matchup preview</h2>
          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-card/30 px-5 py-5 text-sm leading-relaxed text-muted-foreground">
            {preview.previewText.split(/\n\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>
      )}

      {/* How OddsIntel works — recurring SEO content block (same text on every fixture
          page is fine; Google treats this as boilerplate, not as duplicate content) */}
      <section className="mb-6 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-5">
        <h2 className="text-lg font-semibold text-foreground">
          How OddsIntel predicts football matches
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          OddsIntel runs a Poisson + XGBoost ensemble trained on 10+ years of
          historical match data. The model factors in ELO ratings, recent form,
          head-to-head record, confirmed lineups + injuries when available,
          and current market prices. We publish CLV (closing line value) on
          every value bet — the metric that distinguishes a profitable model
          from a lucky one.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Accuracy is not the same as profitability. Even an 80%-accurate pick
          at 1.10 odds loses money long-term. See our{" "}
          <Link href="/accuracy" className="text-foreground underline underline-offset-2 hover:text-foreground/80">
            live accuracy track record
          </Link>{" "}
          and{" "}
          <Link href="/methodology" className="text-foreground underline underline-offset-2 hover:text-foreground/80">
            full methodology
          </Link>
          .
        </p>
      </section>

      {/* Cross-links to drive internal-link compounding */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/matches/${match.id}`}
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-green-500/30 hover:bg-green-500/[0.03]"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Live odds + lineups</p>
          <p className="mt-1 font-semibold text-foreground">Open match detail →</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Compare 13 bookmaker odds, see confirmed lineups + injuries,
            track in-play if live.
          </p>
        </Link>
        <Link
          href={`/predictions/${league}`}
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-green-500/30 hover:bg-green-500/[0.03]"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground">More {leagueName}</p>
          <p className="mt-1 font-semibold text-foreground">All {leagueName} predictions →</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every upcoming {leagueName} fixture with model probability + value bet status.
          </p>
        </Link>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] px-6 py-6 text-center">
        <p className="text-lg font-bold text-foreground">
          Want value bets — not just predictions?
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Predictions tell you what we think will happen. Value bets tell you
          where the bookmaker has it wrong. Free forever for fixtures, scores,
          and one daily AI value pick.
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/value-bets"
            className="inline-flex h-11 items-center justify-center rounded-md bg-green-500 px-6 text-sm font-bold text-black shadow-md shadow-green-500/20 hover:bg-green-400"
          >
            See today&apos;s value bets →
          </Link>
          <Link
            href="/learn/closing-line-value"
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/[0.15] px-6 text-sm font-medium text-foreground hover:bg-white/[0.05]"
          >
            Why CLV beats accuracy →
          </Link>
        </div>
      </section>

      {/* JSON-LD structured data — SportsEvent + FAQ for Google rich snippets */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Back-to-league link for thumb-zone navigation */}
      <div className="mt-8 flex justify-center">
        <Link
          href={`/predictions/${league}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden /> Back to {leagueName} predictions
        </Link>
      </div>
    </article>
  );
}
