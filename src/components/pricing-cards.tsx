"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillingToggle } from "@/components/billing-toggle";

const proFeatures = [
  "Everything in Free",
  "Odds comparison — 13 bookmakers",
  "Odds movement chart",
  "AI injury & suspension alerts",
  "Confirmed lineups + formation view",
  "Post-match stats & xG",
];

const eliteFeatures = [
  "Everything in Pro",
  "All AI value bets — full daily list",
  "AI probability & market edge %",
  "CLV tracking — beat the closing line",
  "Track record & ROI analytics",
  "AI strategy performance data",
];

const freeFeatures = [
  "All fixtures + live scores",
  "Favourite teams & My Matches",
  "Prediction tracker & hit rate",
  "1 AI value pick per day",
  "Match notes & community voting",
  "Saved matches watchlist",
];

export function PricingCards() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div className="mb-6 flex justify-center">
        <BillingToggle annual={annual} onChange={setAnnual} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Free */}
        <div className="relative flex flex-col rounded-xl border border-white/[0.06] bg-card/20 p-7">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Free</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-foreground">€0</span>
            <span className="text-sm text-muted-foreground">/mo</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Track picks, personalise your feed, 1 AI value pick daily</p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {freeFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button className="w-full" variant="outline" nativeButton={false} render={<Link href="/signup" />}>
              Start Free
            </Button>
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-xl border-2 border-green-500 bg-card/60 p-7 shadow-2xl shadow-green-500/5">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black">
            Most Popular
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pro</div>
          <div className="mt-2 flex items-baseline gap-1">
            {annual ? (
              <>
                <span className="text-4xl font-bold text-foreground">€39.99</span>
                <span className="text-sm text-muted-foreground">/yr</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold text-foreground">€4.99</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </>
            )}
          </div>
          <div className="mt-1">
            {annual ? (
              <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
                €3.33/mo — save 33%
              </span>
            ) : (
              <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
                Founders lock in €3.99/mo
              </span>
            )}
          </div>
          {!annual && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Annual: €39.99/yr (€3.33/mo)
            </p>
          )}
          <ul className="mt-5 flex-1 space-y-2.5">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button className="w-full bg-green-500/40 font-bold text-black/60 cursor-not-allowed" disabled>
              Coming Soon
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Founding member rates locked for early subscribers
            </p>
          </div>
        </div>

        {/* Elite */}
        <div className="relative flex flex-col rounded-xl border border-amber-500/30 bg-card/20 p-7">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Elite</div>
          <div className="mt-2 flex items-baseline gap-1">
            {annual ? (
              <>
                <span className="text-4xl font-bold text-foreground">€119.99</span>
                <span className="text-sm text-muted-foreground">/yr</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold text-foreground">€14.99</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </>
            )}
          </div>
          <div className="mt-1">
            {annual ? (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                €10.00/mo — save 33%
              </span>
            ) : (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                Founders lock in €9.99/mo
              </span>
            )}
          </div>
          {!annual && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Annual: €119.99/yr (€10.00/mo)
            </p>
          )}
          <ul className="mt-5 flex-1 space-y-2.5">
            {eliteFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-amber-400/70" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <Button className="w-full border-amber-500/30 text-amber-400/50 cursor-not-allowed opacity-60" variant="outline" disabled>
              Coming Soon
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Pro features ship first — Elite launching soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
