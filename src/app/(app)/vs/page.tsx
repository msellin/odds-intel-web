/**
 * GROWTH-VS-PAGES (2026-06-05) — /vs index page.
 *
 * Lists every published comparison. Light, fast, SEO-indexable. Also
 * targets the search "OddsIntel comparison" / "OddsIntel alternatives"
 * naturally since this is the canonical landing for cross-product comparison.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { VS_COMPETITORS } from "@/lib/vs-competitors";

export const metadata: Metadata = {
  title: "OddsIntel vs Competitors — Honest Comparisons",
  description:
    "Side-by-side comparisons of OddsIntel against WinnerOdds, InPlayGuru, DeepBetting, Forebet, Oddspedia, SportBot AI, soccer-rating, soccerbot.ai. Honest pros and cons, feature matrix, verdict for each.",
  alternates: { canonical: "https://oddsintel.app/vs" },
};

export default function VsIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="text-foreground/80">Comparisons</span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-balance text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-4xl">
          OddsIntel vs the competition
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Honest side-by-side comparisons against the products people most
          often ask us about. We name what each competitor genuinely does
          better than us, not just the easy wins.
        </p>
      </header>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {VS_COMPETITORS.map((c) => (
          <Link
            key={c.slug}
            href={`/vs/${c.slug}`}
            className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-green-500/30 hover:bg-green-500/[0.03]"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              {c.tier}
            </p>
            <p className="mt-2 text-base font-bold text-foreground">
              OddsIntel vs <span className="text-green-400">{c.name}</span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {c.oneliner}
            </p>
            <p className="mt-3 text-xs font-medium text-green-400 group-hover:text-green-300">
              Read the comparison →
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground/70">
        Verified 2026-06-05 from each site&apos;s public surface. Spotted
        something out of date?{" "}
        <a
          href="mailto:margus@dolmit.com"
          className="text-foreground/80 underline underline-offset-2 hover:text-foreground"
        >
          Tell us
        </a>
        .
      </p>
    </div>
  );
}
