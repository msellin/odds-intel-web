"use client";

import { useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillingToggle } from "@/components/billing-toggle";
import { useAuth } from "@/components/auth-provider";

const proFeatures = [
  "Everything in Free",
  "Odds comparison — 13 bookmakers",
  "Odds movement chart",
  "AI injury & suspension alerts",
  "Confirmed lineups + formation view",
  "Post-match stats & xG",
  "Telegram alerts on new picks",
];

const eliteFeatures = [
  "Everything in Pro",
  "Full value bets list — every edge pick today",
  "Exact model probability % per pick",
  "Edge % vs each bookmaker",
  "CLV tracking — beat the closing line",
  "AI explanation for every value bet",
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
  const { openUpgradeModal } = useAuth();
  const [annual, setAnnual] = useState(false);
  const [upgrading, setUpgrading] = useState<"pro" | "elite" | null>(null);

  const openCheckout = async (tier: "pro" | "elite") => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    if (res.status === 401) {
      window.location.href = `/login?plan=${tier}`;
      return;
    }
    if (res.status === 403) {
      // ANON-AUTH: backend returns 403 anonymous_upgrade_required when an
      // anon user tries to checkout. Surface the upgrade modal in-place so
      // they can convert + then immediately retry Stripe.
      const data = await res.json().catch(() => ({}));
      if (data.error === "anonymous_upgrade_required") {
        openUpgradeModal("stripe_checkout_blocked");
        return;
      }
    }
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleUpgrade = async (tier: "pro" | "elite") => {
    posthog.capture("upgrade_clicked", { tier, source: "pricing_cards" });
    setUpgrading(tier);
    try {
      await openCheckout(tier);
    } finally {
      setUpgrading(null);
    }
  };

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
        <div className="relative flex flex-col rounded-xl border-2 border-green-500 bg-card/60 p-7 pt-9 shadow-2xl shadow-green-500/5 sm:pt-7">
          {/* GROWTH-MOBILE-FIRST-AUDIT P0-3 (2026-06-05): badge can clip behind the
              sticky nav on mobile when scrolling past. Solution: on mobile,
              push the badge inside the card (no negative top offset) and
              compensate with extra pt-9 on the card so it doesn't crowd
              the price below. Desktop keeps the floating -top-3 look. */}
          <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-green-500 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-black sm:-top-3 sm:top-auto z-10">
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
            <Button
              className="w-full bg-green-500 font-bold text-black hover:bg-green-400 disabled:opacity-60"
              onClick={() => handleUpgrade("pro")}
              disabled={!!upgrading}
            >
              {upgrading === "pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get Pro"}
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
            <Button
              className="w-full bg-amber-500 text-black hover:bg-amber-400 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => handleUpgrade("elite")}
              disabled={!!upgrading}
            >
              {upgrading === "elite" ? "Loading…" : "Get Elite"}
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Founding members lock in €9.99/mo · Annual €119.99/yr
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
