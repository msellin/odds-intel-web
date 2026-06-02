"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface WCGroupTabsProps {
  labels: string[];
  /** Render-prop: a child node per label, in the same order. */
  panels: ReactNode[];
}

/**
 * Mobile-first group navigation:
 *   - mobile (<768px): horizontal scroll-snap carousel of group cards;
 *     tabs at top scroll the snap container into the chosen card.
 *   - desktop (≥768px): tab click swaps the visible panel; a single 2-column
 *     grid renders below.
 *
 * Mobile uses CSS scroll-snap rather than JS gestures so the experience
 * remains hardware-smooth on older phones.
 *
 * Accessibility: tabs use `role="tab"` / `aria-selected`. Keyboard ←/→ cycles.
 */
export function WCGroupTabs({ labels, panels }: WCGroupTabsProps) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);

  // Programmatic scroll on tab change (mobile only — the snap container only
  // exists at <md). We feature-detect by checking the ref.
  useEffect(() => {
    const container = mobileScrollRef.current;
    if (!container) return;
    const child = container.children[active] as HTMLElement | undefined;
    if (!child) return;
    // smooth scroll into view horizontally
    container.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  }, [active]);

  // Keep active tab in view inside the tab rail (handy on mobile with 12 groups)
  useEffect(() => {
    const btn = tabRefs.current[active];
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive((i) => Math.min(labels.length - 1, i + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(labels.length - 1);
    }
  };

  return (
    <div>
      {/* Tab rail — sticky on scroll so it stays available */}
      <div
        role="tablist"
        aria-label="Group"
        onKeyDown={onKeyDown}
        className="sticky top-0 z-20 -mx-4 mb-3 flex gap-1 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border sm:border-white/[0.06] sm:bg-card/40"
      >
        {labels.map((l, i) => {
          const isActive = i === active;
          return (
            <button
              key={l}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`wc-group-panel-${l}`}
              id={`wc-group-tab-${l}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                isActive
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>

      {/* Mobile: horizontal scroll-snap carousel — one group fully visible per snap */}
      <div
        ref={mobileScrollRef}
        className="wc-snap-x -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:hidden"
      >
        {panels.map((p, i) => (
          <div
            key={labels[i]}
            id={`wc-group-panel-${labels[i]}`}
            role="tabpanel"
            aria-labelledby={`wc-group-tab-${labels[i]}`}
            className="wc-snap-item w-[88vw] shrink-0"
          >
            {p}
          </div>
        ))}
      </div>

      {/* Desktop: 2-column grid showing the active panel + its sibling */}
      <div className="hidden grid-cols-1 gap-4 md:grid lg:grid-cols-2">
        {panels.map((p, i) => (
          <div
            key={labels[i]}
            id={`wc-group-panel-${labels[i]}-desktop`}
            role="tabpanel"
            aria-labelledby={`wc-group-tab-${labels[i]}`}
            hidden={i !== active && !(i === active + 1 && i < panels.length)}
            className={i === active || i === active + 1 ? "wc-fade-in" : ""}
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
