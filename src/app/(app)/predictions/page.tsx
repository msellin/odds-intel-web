import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, TrendingUp } from "lucide-react";
import { PREDICTION_LEAGUES } from "@/lib/engine-data";
import { getCountryFlag } from "@/lib/country-flags";

export const metadata: Metadata = {
  title: "Football Predictions This Week — OddsIntel",
  description:
    "AI-powered football match predictions for Premier League, La Liga, Bundesliga, Serie A and more. Model probabilities and value picks for every fixture.",
  alternates: { canonical: "https://oddsintel.app/predictions" },
};

export default function PredictionsIndexPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="size-4" />
          <span className="text-sm">Predictions</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Football Predictions This Week
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI model predictions for upcoming fixtures. Poisson + XGBoost ensemble, updated daily.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PREDICTION_LEAGUES.map((league) => (
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
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

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
