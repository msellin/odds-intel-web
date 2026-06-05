import Link from "next/link";
import type { Metadata } from "next";
import { PricingCards } from "@/components/pricing-cards";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MarketingNav } from "@/components/marketing-nav";

export const metadata: Metadata = {
  title: "Pricing — OddsIntel",
  description:
    "Simple, honest pricing. Free forever for fixtures, scores, and a daily AI pick. Pro €4.99/mo for full odds + Telegram alerts. Elite €14.99/mo for the full value-bet engine with CLV tracking.",
  alternates: { canonical: "https://oddsintel.app/pricing" },
};

// Pricing FAQ — questions specifically about plans, billing, and tier
// boundaries. The product / methodology FAQ lives on the landing page
// instead. Keep these focused on "what do I get and what does it cost."
const pricingFaq = [
  {
    q: "Is the free plan really free forever?",
    a: "Yes. No credit card, no trial period that expires. The free tier gives you fixtures across 280+ leagues, live scores, personalisation, and 1 AI value pick per day — permanently.",
  },
  {
    q: "What are the founding member rates?",
    a: "The first 500 Pro subscribers lock in €3.99/mo forever (vs the regular €4.99/mo). The first 200 Elite subscribers lock in €9.99/mo forever. Your rate never increases as long as you stay subscribed.",
  },
  {
    q: "Annual or monthly — which makes sense?",
    a: "Annual saves 33% (~4 months free) and is the right call if you've tried the product for a few weeks and want to commit. Monthly is the safe default — same product, no commitment, cancel any time.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancellation is a single click in your account settings. You keep paid access until the end of the current billing period; no refunds for partial months, no questions, no friction.",
  },
  {
    q: "Do you offer refunds?",
    a: "We don't operate a written guarantee, but if you signed up by mistake or had a real problem we couldn't help with, get in touch and we'll sort it. We'd rather refund than have an unhappy subscriber.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards via Stripe. We don't store card details — Stripe handles that. EU customers see prices in EUR; charges are processed in EUR via Stripe.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingNav />

      {/* ───────── Hero ───────── */}
      <section className="pt-16 pb-10 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="text-balance text-3xl font-black leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Honest pricing.{" "}
            <span className="text-green-500">No tricks.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-base text-muted-foreground sm:text-lg">
            Free forever for fixtures + scores + a daily AI pick. Paid tiers unlock the full edge math, value-bet feed, and Telegram delivery.
          </p>
          <p className="mt-3 text-xs text-muted-foreground/80">
            No credit card to sign up. Cancel any time. Founding-rate locks for early subscribers.
          </p>
        </div>
      </section>

      {/* ───────── Pricing Cards ───────── */}
      <section className="py-8" id="plans">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <PricingCards />
        </div>
      </section>

      <Separator />

      {/* ───────── Why the tiers ───────── */}
      <section className="bg-card/20 py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Three tiers, three jobs
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick the tier that matches what you actually want to do.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5">
              <p className="font-semibold text-foreground">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mr-3">Free</span>
                I just want to know who&apos;s playing
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Fixtures across 280+ leagues, live scores, the single best
                available odds per match, basic stats, and one AI value pick
                per day so you can see the model in action. Plenty for the
                casual punter — and the lead-magnet for everything else.
              </p>
            </div>
            <div className="rounded-xl border border-green-500/30 bg-green-500/[0.04] px-6 py-5">
              <p className="font-semibold text-foreground">
                <span className="font-mono text-[10px] uppercase tracking-widest text-green-400 mr-3">Pro</span>
                I want context on every match I bet
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Full 13-bookmaker odds comparison, odds-movement chart, injury
                + suspension reports, confirmed lineups + formations, post-match
                xG and shot stats, plus Telegram alerts when the model finds
                new picks. This is the depth most serious recreational bettors
                actually need.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] px-6 py-5">
              <p className="font-semibold text-foreground">
                <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 mr-3">Elite</span>
                I want the full value-bet engine
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Every value pick the model finds today — not just one — with
                exact model probability, edge % vs each bookmaker, CLV
                tracking (did we beat the closing line?), per-pick AI
                explanation, and the full performance breakdown by strategy.
                The premium tier benchmark in our space is €59/mo (WinnerOdds);
                we&apos;re at €14.99 because we&apos;re still in beta and want the
                track-record to compound publicly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Pricing FAQ ───────── */}
      <section className="py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Pricing questions
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Product / methodology questions live on the{" "}
              <Link href="/#faq" className="underline underline-offset-2 hover:text-foreground">
                main landing page
              </Link>.
            </p>
          </div>
          <div className="space-y-3">
            {pricingFaq.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5"
              >
                <p className="font-medium text-foreground">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ───────── Footer ───────── */}
      <footer className="py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="font-mono text-base font-black uppercase italic tracking-tight text-white whitespace-nowrap">
            ODDS<span className="text-green-500 ml-[0.15em]">INTEL</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} OddsIntel</span>
            <Link href="/" className="transition-colors hover:text-green-400">Home</Link>
            <Link href="/methodology" className="transition-colors hover:text-green-400">Methodology</Link>
            <Link href="/performance" className="transition-colors hover:text-green-400">Performance</Link>
            <Link href="/changelog" className="transition-colors hover:text-green-400">Changelog</Link>
            <Link href="/terms" className="transition-colors hover:text-green-400">Terms of Service</Link>
            <Link href="/privacy" className="transition-colors hover:text-green-400">Privacy Policy</Link>
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-6 py-3 text-center text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Responsible Gambling:</span>{" "}
            Betting involves risk. Data provides intelligence, not certainty. 18+ Only.
          </div>
        </div>
      </footer>
    </div>
  );
}
