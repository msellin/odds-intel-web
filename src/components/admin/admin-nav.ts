// The admin sidebar's contents — every route under src/app/(app)/admin/**/page.tsx, grouped.
// `unused` marks routes the owner dropped from the index on 2026-09-23 (ADMIN-REDO, #107): they
// still work, so they stay reachable, but read as secondary.

import {
  Activity,
  Bot,
  Crosshair,
  Ghost,
  LayoutDashboard,
  Receipt,
  Rss,
  Swords,
  Trophy,
  Wallet,
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
      { href: "/admin/shadow-bots", label: "Shadow bots", Icon: Ghost },
      { href: "/admin/real-bets", label: "Real bets", Icon: Receipt, unused: true },
      { href: "/admin/place", label: "Place", Icon: Wallet, unused: true },
    ],
  },
  {
    label: "Data & ops",
    items: [
      { href: "/admin/feeds", label: "Feeds", Icon: Rss },
      { href: "/admin/ops", label: "Ops", Icon: Activity },
    ],
  },
  {
    label: "Other sports",
    items: [
      { href: "/admin/cs2", label: "CS2", Icon: Crosshair, unused: true },
      { href: "/admin/lol", label: "LoL", Icon: Swords, unused: true },
      { href: "/admin/tennis", label: "Tennis", Icon: Trophy, unused: true },
    ],
  },
];

/** Overview matches only itself; every other item also owns its sub-routes (/admin/shadow-bots/[bot]). */
export function isActiveAdminItem(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeAdminItem(pathname: string): AdminNavItem | null {
  for (const g of ADMIN_NAV) for (const i of g.items) if (isActiveAdminItem(i.href, pathname)) return i;
  return null;
}
