/**
 * GROWTH-UNIFIED-NAV (2026-06-05) — single source of truth for nav links.
 *
 * Before this file, nav link lists were duplicated across:
 *   1. src/components/nav.tsx               (app primaryLinks)
 *   2. src/components/landing-mobile-menu.tsx (LINKS)
 *   3. src/app/page.tsx                     (inline landing nav)
 *   4. src/app/pricing/page.tsx             (inline pricing nav)
 *   5. src/app/privacy/page.tsx             (inline marketing nav)
 *   6. src/app/changelog/page.tsx           (inline marketing nav)
 *   7. src/app/terms/page.tsx               (inline marketing nav)
 *
 * Adding a new page meant touching 4-5 of those manually, and they had
 * already drifted (app nav = 8 entries, landing inline = 5, mobile-menu = 7,
 * pricing inline = 3). This file is the canonical list; consumers import
 * MARKETING_LINKS or APP_LINKS and render their own UI.
 *
 * The two lists are intentionally separate:
 *   - MARKETING_LINKS: short — what we want anonymous landing visitors to
 *     see in a 5-link nav (Matches / Live / Accuracy / Pricing). Each
 *     link has to earn its slot.
 *   - APP_LINKS: comprehensive — the in-app primary nav used by signed-in
 *     users (includes Performance / Predictions / WC etc).
 */

export interface NavLink {
  href: string;
  label: string;
}

/** Links shown on landing + pricing + legal pages (anonymous visitors). */
export const MARKETING_LINKS: NavLink[] = [
  { href: "/matches", label: "Matches" },
  { href: "/live", label: "Live" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/pricing", label: "Pricing" },
];

/** Extended marketing links — used by the mobile drawer where vertical
 *  space is cheap. Same as MARKETING_LINKS plus secondary destinations
 *  that we don't want cluttering the desktop nav. */
export const MARKETING_LINKS_MOBILE: NavLink[] = [
  ...MARKETING_LINKS,
  { href: "/value-bets", label: "Value bets" },
  { href: "/methodology", label: "Methodology" },
  { href: "/performance", label: "Performance" },
];
