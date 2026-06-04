/**
 * WC-E3-E4 — /world-cup/insights
 *
 * Lists the Gemini-generated analytical articles stored in `wc_articles`.
 * Engine job `scripts/generate_wc_insights.py` writes one row per article
 * daily at 08:00 UTC during the WC window. The page renders title +
 * description + generated_at and links to /world-cup/insights/[slug].
 */
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowRight, Trophy } from "lucide-react";

import { createSupabaseServer } from "@/lib/supabase-server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddsintel.app";

export const metadata: Metadata = {
  title: "FIFA World Cup 2026 — Data Insights & Analysis | OddsIntel",
  description:
    "Data-driven analytical articles about FIFA World Cup 2026 — group of death, biggest underdogs, squad value vs model, and the top-5 favourites to win the trophy.",
  alternates: { canonical: `${SITE}/world-cup/insights` },
  openGraph: {
    title: "FIFA World Cup 2026 — Data Insights",
    description:
      "Analytical articles built on 10,000 Monte Carlo simulations of WC2026.",
    url: `${SITE}/world-cup/insights`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FIFA World Cup 2026 — Data Insights",
    description: "Group of death · Cinderella story · squad value vs model · top-5 favourites.",
  },
};

interface ArticleRow {
  slug: string;
  title: string;
  description: string;
  generated_at: string;
}

async function loadArticles(): Promise<ArticleRow[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("wc_articles")
    .select("slug, title, description, generated_at")
    .order("generated_at", { ascending: false });

  if (error || !data) return [];
  return data as ArticleRow[];
}

function formatGeneratedAt(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default async function WCInsightsIndexPage() {
  const articles = await loadArticles();
  const hasData = articles.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Data insights
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          FIFA World Cup 2026 — analytical reads
        </h1>
        <p className="mt-1 max-w-xl text-xs text-muted-foreground sm:text-sm">
          Short, data-driven articles built on our 10,000-simulation Monte Carlo
          model + international ELO + squad market value. Each piece cites the
          actual numbers — no hot takes, no clichés.
        </p>
        <Link
          href="/world-cup"
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:text-sm"
        >
          ← Back to World Cup hub
        </Link>
      </section>

      {!hasData && (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          <Trophy className="mx-auto mb-2 size-5 text-[color:var(--color-tournament-gold)]/70" />
          Insight articles refresh daily once the tournament Monte Carlo has run. Check back soon.
        </div>
      )}

      {hasData && (
        <ul className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {articles.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/world-cup/insights/${a.slug}`}
                className="group flex h-full flex-col gap-2 rounded-xl border border-white/[0.08] bg-card/40 p-4 transition-colors hover:border-[color:var(--color-tournament-gold)]/40 hover:bg-card/70 sm:p-5"
              >
                <h2 className="text-base font-semibold leading-snug text-foreground group-hover:text-[color:var(--color-tournament-gold)] sm:text-lg">
                  {a.title}
                </h2>
                <p className="line-clamp-3 text-xs text-muted-foreground sm:text-sm">
                  {a.description}
                </p>
                <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground/70 sm:text-xs">
                  <span>Updated {formatGeneratedAt(a.generated_at)}</span>
                  <span className="inline-flex items-center gap-1 text-[color:var(--color-tournament-gold)] opacity-0 transition-opacity group-hover:opacity-100">
                    Read
                    <ArrowRight className="size-3" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
