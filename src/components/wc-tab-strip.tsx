import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export interface WCTab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional override — if set, the tab links here instead of `?tab=<id>`. */
  href?: string;
}

interface WCTabStripProps {
  tabs: WCTab[];
  active: string;
  /** Base path the tab links append `?tab=` onto. */
  basePath?: string;
}

/**
 * Top-level tab navigation for /world-cup.
 *
 * Server-rendered: each tab is a `<Link>` to `?tab=<id>` so the page state is
 * deep-linkable, sharable, and SEO-friendly. No client-only state — the page
 * itself reads the query param and renders the right panel.
 *
 * Mobile:
 *   - horizontal scroll-snap row
 *   - active tab scroll-snap-aligns center
 *   - right-edge gradient fade hints at off-screen tabs
 *   - sticky with backdrop blur so the strip stays visible while scrolling
 *
 * Desktop (>=md):
 *   - single row, no scroll, underline indicates active
 */
export function WCTabStrip({ tabs, active, basePath = "/world-cup" }: WCTabStripProps) {
  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-white/[0.06] bg-background/85 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:border-white/[0.06] sm:bg-card/40">
      <div className="relative">
        {/* right-edge fade affordance (mobile only, hidden when nothing offscreen) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden"
        />
        <nav
          role="tablist"
          aria-label="World Cup sections"
          className="wc-snap-x flex gap-1 overflow-x-auto px-3 py-2 sm:gap-2 sm:px-2"
        >
          {tabs.map((t) => {
            const isActive = t.id === active;
            const href = t.href ?? (t.id === "overview" ? basePath : `${basePath}?tab=${t.id}`);
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                href={href}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "page" : undefined}
                scroll={false}
                className={`wc-snap-item inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:rounded-lg sm:px-4 sm:text-sm ${
                  isActive
                    ? "bg-[color:var(--color-tournament-gold)]/15 text-[color:var(--color-tournament-gold)] ring-1 ring-inset ring-[color:var(--color-tournament-gold)]/30"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                }`}
                style={isActive ? { scrollSnapAlign: "center" } : undefined}
              >
                <Icon className="size-3.5 sm:size-4" />
                <span className="whitespace-nowrap">{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
