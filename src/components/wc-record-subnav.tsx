/**
 * Sub-nav strip for the WC predictions-record cluster of pages.
 *
 * Three siblings:
 *   - /world-cup/predictions-record           (C1 — Summary)
 *   - /world-cup/predictions-record/clv       (C2 — CLV vs Market)
 *   - /world-cup/predictions-record/leaderboard (C3 — vs Other Models)
 *
 * Server component. The active tab is determined from the `active` prop the
 * parent page passes in — we don't read pathname client-side because all three
 * pages are async server components and we want zero client JS for the strip.
 *
 * Mobile-first: scrolls horizontally on <375px screens (where 3 tabs at full
 * label can otherwise wrap awkwardly).
 */

import Link from "next/link";
import { Target, LineChart, Trophy } from "lucide-react";

export type WCRecordTab = "summary" | "clv" | "leaderboard";

interface TabSpec {
  id: WCRecordTab;
  href: string;
  label: string;
  icon: typeof Target;
}

const TABS: TabSpec[] = [
  {
    id: "summary",
    href: "/world-cup/predictions-record",
    label: "Summary",
    icon: Target,
  },
  {
    id: "clv",
    href: "/world-cup/predictions-record/clv",
    label: "CLV vs Market",
    icon: LineChart,
  },
  {
    id: "leaderboard",
    href: "/world-cup/predictions-record/leaderboard",
    label: "vs Other Models",
    icon: Trophy,
  },
];

export function WCRecordSubNav({ active }: { active: WCRecordTab }) {
  return (
    <nav
      aria-label="Predictions record sections"
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2"
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm",
              "min-h-[40px] sm:min-h-[44px]",
              isActive
                ? "border border-[color:var(--color-tournament-gold)]/40 bg-[color:var(--color-tournament-gold)]/10 text-foreground"
                : "border border-white/[0.06] bg-card/30 text-muted-foreground hover:border-white/[0.16] hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="size-3.5 sm:size-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
