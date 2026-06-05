/**
 * GROWTH-VS-PAGES (2026-06-05) — /vs/[competitor] long-form comparison page.
 *
 * Static-rendered at build time via generateStaticParams over VS_SLUGS.
 * Each page is a self-contained Linear/Notion-style competitor comparison
 * targeting high-intent "[competitor] alternative" / "[competitor] vs"
 * search queries.
 *
 * Editorial pattern enforced by vs-competitors.ts: every page must have a
 * non-empty `whereTheyWin` array. Pages that fake "we win on everything"
 * lose credibility — honest gaps are the wedge.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getVsCompetitor,
  VS_SLUGS,
  VS_COMPETITORS,
  type VsFeature,
} from "@/lib/vs-competitors";

export async function generateStaticParams() {
  return VS_SLUGS.map((competitor) => ({ competitor }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const { competitor } = await params;
  const c = getVsCompetitor(competitor);
  if (!c) return { title: "Comparison not found — OddsIntel" };

  const title = `OddsIntel vs ${c.name} — Honest Comparison`;
  const description = `${c.name}: ${c.oneliner} How it compares to OddsIntel for football value bets, CLV tracking, and Telegram delivery. Honest pros and cons.`;
  const url = `https://oddsintel.app/vs/${c.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

function CellGlyph({ value }: { value: VsFeature["competitor"] }) {
  if (value === "✅")
    return <span className="font-mono text-green-400" aria-label="Yes">✓</span>;
  if (value === "⏳")
    return <span className="font-mono text-amber-300" aria-label="On roadmap">⏳</span>;
  if (value === "~")
    return <span className="font-mono text-amber-300/80" aria-label="Partial">~</span>;
  if (typeof value === "string" && value.startsWith("✅"))
    return <span className="font-mono text-green-400" aria-label="Yes">{value}</span>;
  if (typeof value === "string" && value.startsWith("~"))
    return <span className="font-mono text-amber-300/80" aria-label="Partial">{value}</span>;
  if (typeof value === "string" && value !== "❌")
    return <span className="font-mono text-muted-foreground/60">{value}</span>;
  return <span className="font-mono text-muted-foreground/30" aria-label="No">✗</span>;
}

export default async function VsCompetitorPage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  const c = getVsCompetitor(competitor);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link href="/vs" className="hover:text-foreground">Comparisons</Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="text-foreground/80">vs {c.name}</span>
      </nav>

      {/* Hero */}
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          OddsIntel vs {c.tier}
        </p>
        <h1 className="text-balance text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-4xl">
          OddsIntel vs <span className="text-green-400">{c.name}</span>
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">{c.oneliner}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-xs text-muted-foreground/80 sm:text-sm">
          <span>Category: <span className="text-foreground/80">{c.tier}</span></span>
          <span>Traffic: <span className="text-foreground/80">{c.traffic}</span></span>
          <span>Pricing: <span className="text-foreground/80">{c.pricing}</span></span>
          <a
            href={c.homeUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-1 text-muted-foreground/80 hover:text-foreground"
          >
            {c.homeUrl.replace(/^https?:\/\//, "")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </header>

      <Separator className="my-8 opacity-30" />

      {/* Where they win — honest gaps first (credibility play) */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          Where {c.name} wins
        </h2>
        <p className="text-sm text-muted-foreground">
          Every honest comparison should name the competitor&apos;s genuine
          advantages. Here are theirs.
        </p>
        <ul className="space-y-2.5 pl-4">
          {c.whereTheyWin.map((point, i) => (
            <li
              key={i}
              className="list-disc text-sm leading-relaxed text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: point.replace(
                  /\*\*(.+?)\*\*/g,
                  "<strong class=\"text-foreground/90 font-medium\">$1</strong>"
                ),
              }}
            />
          ))}
        </ul>
      </section>

      <Separator className="my-8 opacity-30" />

      {/* Where OddsIntel wins */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          Where <span className="text-green-400">OddsIntel</span> wins
        </h2>
        <ul className="space-y-2.5 pl-4">
          {c.oddsIntelWins.map((point, i) => (
            <li
              key={i}
              className="list-disc text-sm leading-relaxed text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: point.replace(
                  /\*\*(.+?)\*\*/g,
                  "<strong class=\"text-foreground/90 font-medium\">$1</strong>"
                ),
              }}
            />
          ))}
        </ul>
      </section>

      <Separator className="my-8 opacity-30" />

      {/* Feature matrix */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Feature comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-muted/30">
                <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground w-[60%]">
                  Feature
                </th>
                <th className="py-3 px-3 text-center text-xs font-medium text-foreground/80 w-[20%]">
                  {c.name}
                </th>
                <th className="py-3 pl-3 pr-4 text-center text-xs font-medium w-[20%] bg-green-500/[0.06]">
                  <span className="text-green-400">OddsIntel</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {c.matrix.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 pl-4 pr-2 text-sm text-foreground/80">
                    {row.label}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <CellGlyph value={row.competitor} />
                  </td>
                  <td className="py-2.5 pl-3 pr-4 bg-green-500/[0.04] text-center">
                    <CellGlyph value={row.oddsintel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pt-2 text-xs text-muted-foreground/70">
          ✓ = have it · ⏳ = on roadmap · ~ = partial · ✗ = doesn&apos;t offer.
          Verified 2026-06-05 from each site&apos;s public surface.
        </p>
      </section>

      <Separator className="my-8 opacity-30" />

      {/* Verdict — who should pick what */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Which one is right for you?</h2>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-sm font-semibold text-foreground/90">
            Pick <span className="text-foreground">{c.name}</span> if...
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {c.verdict.pickThem}
          </p>
        </div>

        <div className="rounded-xl border border-green-500/25 bg-green-500/[0.04] px-5 py-4">
          <p className="text-sm font-semibold text-foreground/90">
            Pick <span className="text-green-400">OddsIntel</span> if...
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {c.verdict.pickUs}
          </p>
        </div>
      </section>

      <Separator className="my-8 opacity-30" />

      {/* FAQ — JSON-LD friendly */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">FAQ</h2>
        <div className="space-y-3">
          {c.faq.map((item, i) => (
            <details
              key={i}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3"
            >
              <summary className="cursor-pointer list-none font-medium text-foreground">
                {item.q}
                <span className="float-right text-muted-foreground/60 group-open:rotate-90 transition-transform">
                  ›
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <Separator className="my-8 opacity-30" />

      {/* CTA */}
      <section className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] px-6 py-7 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Try OddsIntel free
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Fixtures, scores, and a daily AI value pick — free forever. Pro
          from €4.99/mo unlocks full odds + Telegram alerts.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="h-12 bg-green-500 px-8 text-base font-bold text-black shadow-lg shadow-green-500/20 hover:bg-green-400"
            nativeButton={false}
            render={<Link href="/signup" />}
          >
            Start Free
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-12 px-8 text-base border border-white/[0.15] text-foreground hover:bg-white/[0.05]"
            nativeButton={false}
            render={<Link href="/methodology" />}
          >
            See methodology →
          </Button>
        </div>
      </section>

      {/* Other comparisons cross-link */}
      <section className="mt-10">
        <p className="mb-3 text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
          Other comparisons
        </p>
        <div className="flex flex-wrap gap-2">
          {VS_COMPETITORS.filter((other) => other.slug !== c.slug).map((other) => (
            <Link
              key={other.slug}
              href={`/vs/${other.slug}`}
              className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-green-500/30 hover:text-foreground"
            >
              OddsIntel vs {other.name} →
            </Link>
          ))}
        </div>
      </section>

      {/* JSON-LD for FAQ rich snippets in Google search */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: c.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
