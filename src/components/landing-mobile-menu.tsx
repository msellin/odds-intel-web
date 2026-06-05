/**
 * GROWTH-MOBILE-FIRST-AUDIT P0-1 (2026-06-05) — mobile drawer for the
 * landing-page nav.
 *
 * Before this component, landing nav links (Matches / Live / Accuracy /
 * Pricing) all used `hidden sm:block` — they vanished on mobile with no
 * hamburger replacement. Mobile visitors literally could not navigate
 * to /pricing from the landing.
 *
 * Pattern: small client component, hamburger button visible only on
 * mobile (sm:hidden), drawer slides down from the top below the nav,
 * closes on link click or backdrop tap. No external sheet/drawer lib —
 * uses a controlled boolean + Tailwind transitions.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/matches", label: "Matches" },
  { href: "/live", label: "Live" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/pricing", label: "Pricing" },
  { href: "/value-bets", label: "Value bets" },
  { href: "/methodology", label: "Methodology" },
  { href: "/performance", label: "Performance" },
];

export function LandingMobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] text-foreground transition-colors hover:bg-white/[0.06]"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {open && (
        <>
          {/* Backdrop — taps close the menu */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-14 z-40 bg-background/70 backdrop-blur-sm"
          />
          {/* Drawer */}
          <nav
            className="fixed inset-x-0 top-14 z-50 border-b border-white/[0.08] bg-background/95 backdrop-blur-xl"
            aria-label="Mobile navigation"
          >
            <ul className="mx-auto flex max-w-7xl flex-col px-4 py-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center text-base font-medium text-foreground/85 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
