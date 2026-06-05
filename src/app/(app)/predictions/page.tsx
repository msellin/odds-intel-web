import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, TrendingUp } from "lucide-react";
import {
  PREDICTION_LEAGUES,
  getPredictionLeagueCounts,
  getAllPredictionLeagues,
} from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";

// ISR — re-render at most once per hour. From a crawler's perspective this is
// indistinguishable from a fully static page; the fixture counts stay fresh enough
// that they aren't misleading between fixture-fetch runs (04:00 UTC daily).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Football Predictions This Week — OddsIntel",
  description:
    "AI-powered football match predictions for Premier League, La Liga, Bundesliga, Serie A and 100+ leagues. Model probabilities and value picks for every fixture.",
  alternates: { canonical: "https://oddsintel.app/predictions" },
};

export default async function PredictionsIndexPage() {
  // GROWTH-SEO-EXPAND-LEAGUES (2026-06-05): featured 8 stay in the hero grid;
  // the rest land below in a "More leagues" section grouped alphabetically by
  // country. Fail-soft: if the RPC isn't available, the page still renders the
  // featured 8 (counts come from the same call cycle but a degraded count map
  // just shows 0s, not a 500).
  const [counts, allLeagues] = await Promise.all([
    getPredictionLeagueCounts(),
    getAllPredictionLeagues(),
  ]);

  const nonFeatured = allLeagues
    .filter((l) => !l.featured && (counts[l.leagueId] ?? 0) >= 1)
    .sort((a, b) => {
      // Country-first sort, then by upcoming-fixture volume desc within country
      if (a.country !== b.country) return a.country.localeCompare(b.country);
      return (counts[b.leagueId] ?? 0) - (counts[a.leagueId] ?? 0);
    });

  // Group by country for the "more leagues" section
  const byCountry = new Map<string, typeof nonFeatured>();
  for (const l of nonFeatured) {
    const arr = byCountry.get(l.country) ?? [];
    arr.push(l);
    byCountry.set(l.country, arr);
  }
  const countryGroups = Array.from(byCountry.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="size-4" />
          <span className="text-sm">Predictions</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Football Predictions This Week
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI model predictions for upcoming fixtures across {allLeagues.length} leagues.
          Poisson + XGBoost ensemble, updated daily.
        </p>
      </div>

      {/* Featured league hero grid — curated 8 stay in the spotlight */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Featured leagues
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PREDICTION_LEAGUES.map((league) => {
            const count = counts[league.leagueId] ?? 0;
            return (
              <Link
                key={league.slug}
                href={`/predictions/${league.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-card/40 px-4 py-3.5 transition-colors hover:bg-white/[0.04] hover:border-white/10"
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {getCountryFlag(league.country)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-foreground/90">
                    {league.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{league.country}</p>
                </div>
                {count > 0 && (
                  <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* GROWTH-SEO-EXPAND-LEAGUES: more leagues, grouped by country for crawlable
          internal-link density. Compact list (not card grid) so 90+ leagues
          don't drown the featured ones. */}
      {countryGroups.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            More leagues ({nonFeatured.length})
          </h2>
          <div className="space-y-5 rounded-xl border border-white/[0.06] bg-card/30 p-5">
            {countryGroups.map(([country, leagues]) => (
              <div key={country}>
                <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground">
                  <span aria-hidden="true">{getCountryFlag(country)}</span>
                  {country}
                </h3>
                <ul className="flex flex-wrap gap-x-3 gap-y-1.5 pl-6 text-xs">
                  {leagues.map((l) => {
                    const count = counts[l.leagueId] ?? 0;
                    return (
                      <li key={l.slug}>
                        <Link
                          href={`/predictions/${l.slug}`}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {l.name}
                          {count > 0 && (
                            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                              ({count})
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground/60 text-center pb-4">
        Predictions use a Poisson + XGBoost blend calibrated against market odds.{" "}
        <Link href="/how-it-works" className="underline underline-offset-2 hover:text-muted-foreground">
          How it works
        </Link>
        .
      </p>
    </div>
  );
}
