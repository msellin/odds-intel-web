/**
 * WC-E3-E4 — /world-cup/insights/[slug]
 *
 * Server-rendered article page. Reads one row from `wc_articles` by slug,
 * renders the markdown body, and emits per-article SEO + Article JSON-LD.
 *
 * The four valid slugs (kept in sync with scripts/generate_wc_insights.py):
 *   - group-of-death
 *   - cinderella-story
 *   - squad-value-vs-model
 *   - champions-favourites
 *
 * Unknown slugs ⇒ notFound(). If a slug isn't yet in `wc_articles` (engine
 * hasn't run today) we still render a "coming soon" placeholder so internal
 * links don't 404 during the deploy gap.
 */
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, Trophy } from "lucide-react";

import { createSupabaseServer } from "@/lib/supabase-server";
import { renderMarkdown } from "@/lib/markdown-mini";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oddsintel.app";

// The four valid slugs — must match scripts/generate_wc_insights.py ALL_SLUGS.
const VALID_SLUGS = [
  "group-of-death",
  "cinderella-story",
  "squad-value-vs-model",
  "champions-favourites",
] as const;

type Slug = (typeof VALID_SLUGS)[number];

// Static fallback metadata so we have something to show even before the
// engine job has run (or if Supabase is briefly unreachable during build).
const FALLBACK_META: Record<Slug, { title: string; description: string }> = {
  "group-of-death": {
    title: "Group of Death — Toughest WC2026 Group | OddsIntel",
    description:
      "Which is the toughest group at FIFA World Cup 2026? We rank all 12 groups by variance in advancement probability — lowest variance ⇒ tightest race.",
  },
  "cinderella-story": {
    title: "Cinderella Story — Biggest WC2026 Underdogs | OddsIntel",
    description:
      "Which nations punch above their ELO weight at FIFA World Cup 2026? Our Monte Carlo simulation surfaces the surprise candidates.",
  },
  "squad-value-vs-model": {
    title: "Most Expensive Squad Doesn't Always Win — WC2026 | OddsIntel",
    description:
      "Does the most expensive squad always win the World Cup group? We compare transfermarkt squad value against our model's advancement probability.",
  },
  "champions-favourites": {
    title: "Top 5 WC2026 Title Favourites — Why Our Model Likes Them | OddsIntel",
    description:
      "Our top-5 picks to win FIFA World Cup 2026, with the data behind each pick — Monte Carlo winner %, ELO, and route to the final.",
  },
};

interface ArticleRow {
  slug: Slug;
  title: string;
  description: string;
  body_md: string;
  generated_at: string;
}

export async function generateStaticParams(): Promise<Array<{ slug: Slug }>> {
  return VALID_SLUGS.map((s) => ({ slug: s }));
}

async function loadArticle(slug: string): Promise<ArticleRow | null> {
  if (!VALID_SLUGS.includes(slug as Slug)) return null;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("wc_articles")
    .select("slug, title, description, body_md, generated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as ArticleRow;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug as Slug)) {
    return {
      title: "Insight not found — FIFA World Cup 2026 | OddsIntel",
      description: "This World Cup insight article does not exist.",
    };
  }
  const article = await loadArticle(slug);
  const fb = FALLBACK_META[slug as Slug];
  const title = article?.title ?? fb.title;
  const description = article?.description ?? fb.description;
  const url = `${SITE}/world-cup/insights/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
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

export default async function WCInsightArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug as Slug)) {
    notFound();
  }

  const article = await loadArticle(slug);
  const url = `${SITE}/world-cup/insights/${slug}`;

  // JSON-LD structured data (Article) for SEO. Only emit when we have the
  // full article — falls back to a lighter blob when only metadata exists.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article?.title ?? FALLBACK_META[slug as Slug].title,
    description: article?.description ?? FALLBACK_META[slug as Slug].description,
    url,
    author: { "@type": "Organization", name: "OddsIntel" },
    publisher: {
      "@type": "Organization",
      name: "OddsIntel",
      url: SITE,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
  if (article?.generated_at) {
    jsonLd.datePublished = article.generated_at;
    jsonLd.dateModified = article.generated_at;
  }

  return (
    <article className="space-y-4 sm:space-y-6">
      <script
        type="application/ld+json"
        // SAFETY: jsonLd is built from static + DB-string fields only; serialize
        // with replace to neutralise </script> escape attempts.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            World Cup 2026 · Data insight
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          {article?.title ?? FALLBACK_META[slug as Slug].title.replace(" | OddsIntel", "")}
        </h1>
        <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
          {article?.description ?? FALLBACK_META[slug as Slug].description}
        </p>
        {article?.generated_at && (
          <p className="mt-2 text-[11px] text-muted-foreground/70 sm:text-xs">
            Updated {formatGeneratedAt(article.generated_at)} · refreshes daily
            during the WC window
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs sm:text-sm">
          <Link
            href="/world-cup/insights"
            className="text-muted-foreground hover:text-foreground"
          >
            ← All insights
          </Link>
          <Link
            href="/world-cup"
            className="text-muted-foreground hover:text-foreground"
          >
            World Cup hub
          </Link>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      {article ? (
        <section
          className="prose prose-invert max-w-none rounded-xl border border-white/[0.08] bg-card/40 p-4 text-sm leading-relaxed text-foreground sm:p-6 sm:text-base
                     [&_p]:my-3 [&_p]:text-muted-foreground
                     [&_strong]:font-semibold [&_strong]:text-foreground
                     [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5
                     [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5
                     [&_li]:my-1 [&_li]:text-muted-foreground"
          // SAFETY: markdown is generated by our own Gemini job, stored in
          // wc_articles, and rendered via renderMarkdown which escapes HTML
          // entities and only emits a whitelisted set of tags.
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body_md) }}
        />
      ) : (
        <section className="rounded-xl border border-dashed border-white/[0.08] bg-card/40 p-6 text-center text-sm text-muted-foreground">
          <Trophy className="mx-auto mb-2 size-5 text-[color:var(--color-tournament-gold)]/70" />
          This article refreshes daily during the WC window. Check back once the next Monte Carlo snapshot lands.
        </section>
      )}

      {/* ── Footer nav ───────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-card/40 p-4 text-xs text-muted-foreground sm:text-sm">
        <Link href="/world-cup/insights" className="hover:text-foreground">
          ← All insights
        </Link>
        <Link
          href="/world-cup/who-can-win"
          className="hover:text-[color:var(--color-tournament-gold)]"
        >
          Who can win? →
        </Link>
      </nav>
    </article>
  );
}
