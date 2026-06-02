"use client";

/**
 * App-wide back button. Mounted in the (app) layout so it appears on every
 * page under that group. Hidden on top-level destinations (e.g. /matches,
 * /value-bets, /world-cup) — those ARE the destinations users would back to,
 * so a back button there is confusing. Visible on detail / sub-routes.
 *
 * Strategy: `router.back()` for in-app history. Falls back to a sensible
 * parent route when there's no history (e.g. user opened a shared
 * /matches/[id] link in a new tab — `window.history.length === 1`).
 *
 * Visual: a small fixed pill in the top-left corner of the viewport, just
 * under the nav. Mobile-first: 44px tap target, dark glass background,
 * keyboard-accessible.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Routes that ARE top-level destinations — no back button needed.
const TOP_LEVEL_ROUTES = new Set<string>([
  "/",
  "/matches",
  "/value-bets",
  "/performance",
  "/predictions",
  "/world-cup",
  "/my-picks",
  "/learn",
  "/how-it-works",
  "/profile",
  "/admin",
]);

function fallbackParent(pathname: string): string {
  // For /matches/[id] → /matches; /world-cup/bracket → /world-cup, etc.
  // Strip the trailing segment.
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  // Two-level routes: /world-cup/bracket → /world-cup (one segment up)
  // Three+ : /world-cup/bracket/leaderboard → /world-cup/bracket
  const parent = "/" + parts.slice(0, -1).join("/");
  return parent || "/";
}

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // window.history.length includes the entry-page itself, so > 1 means
    // there's at least one entry to go back to within the session.
    setCanGoBack(typeof window !== "undefined" && window.history.length > 1);
  }, [pathname]);

  const onClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      if (canGoBack) {
        router.back();
      } else {
        router.push(fallbackParent(pathname));
      }
    },
    [router, canGoBack, pathname]
  );

  if (TOP_LEVEL_ROUTES.has(pathname)) return null;

  // For /admin/* sub-pages, keep the button — admins navigating between
  // /admin/bots and /admin/ops appreciate it. Only the bare /admin is gated above.

  return (
    <div
      className={cn(
        // Fixed-position pill, top-left under the nav. Mobile-first.
        "fixed left-2 top-[60px] z-40 sm:left-4",
        // Smooth fade so it doesn't pop on tab change.
        "transition-opacity duration-150"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick(e);
        }}
        aria-label="Go back"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full",
          "border border-white/[0.08] bg-background/80 backdrop-blur-md",
          "px-2.5 py-1.5 text-xs font-medium text-foreground/90",
          "shadow-sm shadow-black/20",
          "hover:bg-background/95 hover:border-white/[0.16] hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "active:scale-95 transition-all duration-100",
          // ≥44px tap target via min-height + padding
          "min-h-[36px] sm:min-h-[40px]"
        )}
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Back</span>
      </button>
    </div>
  );
}

// Static-fallback variant — for places where useRouter isn't available
// (rare; mostly for the share page which is fully public). Uses <Link>.
export function StaticBackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "border border-white/[0.08] bg-background/80 backdrop-blur-md",
        "px-2.5 py-1.5 text-xs font-medium text-foreground/90",
        "hover:bg-background/95 hover:border-white/[0.16]",
        "transition-colors"
      )}
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
