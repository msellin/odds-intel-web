import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BookOpen } from "lucide-react";
import { getTermBySlug, GLOSSARY_TERMS, ALL_SLUGS } from "@/lib/glossary";

export async function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ term: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}): Promise<Metadata> {
  const { term: slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) return { title: "Term Not Found — OddsIntel" };

  const title = `${term.title} — OddsIntel Betting Glossary`;
  const description = term.shortDef;
  const url = `https://oddsintel.app/learn/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  };
}

function renderBody(body: string) {
  // Very simple: split on double newlines for paragraphs, handle **bold**
  const paragraphs = body.split(/\n\n+/);
  return paragraphs.map((p, i) => {
    // Handle bullet lists
    if (p.includes("\n- ") || p.startsWith("- ")) {
      const lines = p.split("\n").filter(Boolean);
      const items = lines
        .filter((l) => l.startsWith("- "))
        .map((l) => l.slice(2));
      const pre = lines.filter((l) => !l.startsWith("- "));
      return (
        <div key={i}>
          {pre.map((l, j) => (
            <p key={j} className="mb-2 text-sm leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: renderInline(l) }} />
          ))}
          <ul className="mt-2 space-y-1 pl-4">
            {items.map((item, j) => (
              <li key={j} className="text-sm leading-relaxed text-muted-foreground list-disc" dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
            ))}
          </ul>
        </div>
      );
    }
    // Regular paragraph
    return (
      <p
        key={i}
        className="text-sm leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: renderInline(p) }}
      />
    );
  });
}

function renderInline(text: string): string {
  // **bold** → <strong>
  return text.replace(/\*\*(.+?)\*\*/g, "<strong class=\"text-foreground/90 font-medium\">$1</strong>");
}

export default async function TermPage({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term: slug } = await params;
  const term = getTermBySlug(slug);

  if (!term) notFound();

  const related = (term.relatedTerms ?? [])
    .map((s) => GLOSSARY_TERMS.find((t) => t.slug === s))
    .filter(Boolean) as typeof GLOSSARY_TERMS;

  // FAQ schema
  const faqSchema = term.faqItems && term.faqItems.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: term.faqItems.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }
    : null;

  return (
    <>
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/learn" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <BookOpen className="size-3" />
            Betting Glossary
          </Link>
          <ChevronLeft className="size-3 rotate-180" />
          <span className="text-foreground/60">{term.title}</span>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {term.title}
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {term.shortDef}
          </p>
        </div>

        {/* Body */}
        <div className="space-y-4 rounded-xl border border-white/[0.06] bg-card/40 p-5">
          {renderBody(term.body)}
        </div>

        {/* FAQ */}
        {term.faqItems && term.faqItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Common Questions</h2>
            <div className="space-y-2">
              {term.faqItems.map((item, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
                  <p className="text-sm font-medium text-foreground">{item.q}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related */}
        {related.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Related Terms</h2>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/learn/${r.slug}`}
                  className="rounded-lg border border-white/[0.06] bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-white/10"
                >
                  {r.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="pb-4">
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-3" />
            All terms
          </Link>
        </div>
      </div>
    </>
  );
}
