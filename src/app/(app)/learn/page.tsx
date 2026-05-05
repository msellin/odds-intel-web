import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { GLOSSARY_TERMS } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "Betting Glossary — OddsIntel",
  description:
    "Learn betting terminology: Expected Value, CLV, Kelly Criterion, xG, Poisson, BTTS, value betting and more. Clear explanations for smarter football betting.",
  alternates: { canonical: "https://oddsintel.app/learn" },
};

export default function LearnIndexPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <BookOpen className="size-4" />
          <span className="text-sm">Betting Glossary</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Learn the Language of Smart Betting
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {GLOSSARY_TERMS.length} terms — from first principles to advanced strategy.
          Understanding these concepts is the foundation of profitable betting.
        </p>
      </div>

      {/* Term cards */}
      <div className="space-y-2">
        {GLOSSARY_TERMS.map((term) => (
          <Link
            key={term.slug}
            href={`/learn/${term.slug}`}
            className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-card/40 px-4 py-3.5 transition-colors hover:bg-white/[0.04] hover:border-white/10"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground group-hover:text-foreground/90">
                {term.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {term.shortDef}
              </p>
            </div>
            <ChevronRight className="ml-3 size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground/60 text-center pb-4">
        OddsIntel applies these concepts to every match. See them in action on the{" "}
        <Link href="/matches" className="underline underline-offset-2 hover:text-muted-foreground">
          matches page
        </Link>.
      </p>
    </div>
  );
}
