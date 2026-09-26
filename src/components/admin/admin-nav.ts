// The admin sidebar's contents — every route under src/app/(app)/admin/**/page.tsx, grouped.
// `unused` marks routes the owner dropped from the index on 2026-09-23 (ADMIN-REDO, #107): they
// still work, so they stay reachable, but read as secondary. CS2, LoL and Tennis were DELETED
// 2026-09-24 (#139 IA P8; owner: delete LoL + Tennis; CS2 read tables that no longer exist).

import {
  Activity,
  Bot,
  BrainCircuit,
  History,
  ListChecks,
  LayoutDashboard,
  Rss,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  unused?: boolean;
}

export interface AdminNavGroup {
  label: string | null;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { label: null, items: [{ href: "/admin", label: "Overview", Icon: LayoutDashboard }] },
  {
    label: "Bots & money",
    items: [
      { href: "/admin/bots", label: "Bots", Icon: Bot },
      // IA §3.1 (2026-09-24): "Pick queue" = today's picks to act on (URL kept: 65 smoke pins +
      // bookmarks). "Real bets" (/admin/real-bets) was dropped 2026-09-26 (#162 W6.8, owner: not
      // used): the money ledger is the "Real money" tab of Bots (/admin/bots?section=money, also in
      // the ⌘K Actions); the old URL redirects there.
      { href: "/admin/shadow-bots", label: "Where to bet", Icon: ListChecks },
      // #153 (2026-09-26): which models exist, how accurate each is, which bot uses which
      { href: "/admin/models", label: "Models", Icon: BrainCircuit },
    ],
  },
  {
    label: "Data & ops",
    items: [
      { href: "/admin/feeds", label: "Feeds", Icon: Rss },
      { href: "/admin/ops", label: "Jobs", Icon: Activity },
      { href: "/admin/activity", label: "Activity", Icon: History },
    ],
  },
];

/** Overview matches only itself; every other item also owns its sub-routes (/admin/shadow-bots/[bot]). */
export function isActiveAdminItem(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeAdminGroup(pathname: string): string | null {
  for (const g of ADMIN_NAV) for (const i of g.items) if (isActiveAdminItem(i.href, pathname)) return g.label;
  return null;
}

export function activeAdminItem(pathname: string): AdminNavItem | null {
  for (const g of ADMIN_NAV) for (const i of g.items) if (isActiveAdminItem(i.href, pathname)) return i;
  return null;
}
