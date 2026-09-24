"use client";

// The admin app shell: armed bar, sidebar, content column. Rendered ONCE by
// src/app/(app)/admin/layout.tsx — so it persists across admin navigations and only {children}
// (the page's middle block) changes. The public site Nav/main are skipped for /admin by
// src/components/public-chrome.tsx, so this is a full-height app shell.
//
// Desktop (lg+): fixed sidebar column, collapsible to an icon rail (remembered per browser).
// Top bar on every width (admin-topbar.tsx): breadcrumb, ⌘K search, attention bell; below lg it
// also carries the menu button that opens the same sidebar as a drawer, and the status dots.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";
import type { FleetState } from "@/lib/bot-controls/types";
import type { AttentionItem } from "@/lib/admin-attention";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";
import type { PaletteBot } from "./command-palette";
import { activeAdminGroup, activeAdminItem } from "./admin-nav";
import { fleetStatus } from "./admin-status";

const RAIL_KEY = "admin-sidebar-rail";

export function AdminShell({
  fleet,
  attention,
  bots,
  children,
}: {
  fleet: FleetState | null;
  /** The Overview's attention items (null = could not be computed). */
  attention: AttentionItem[] | null;
  /** Active bots for the ⌘K palette. */
  bots: PaletteBot[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const status = fleetStatus(fleet);
  const [rail, setRail] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      setRail(localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      /* storage blocked — default expanded */
    }
  }, []);
  const toggleRail = () =>
    setRail((r) => {
      try {
        localStorage.setItem(RAIL_KEY, r ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !r;
    });

  // Close the drawer on navigation and on Escape.
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const current = activeAdminItem(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <ArmedBar fleet={fleet} pathname={pathname} />
      <div className="flex min-h-0 flex-1">
        <aside className={`hidden shrink-0 border-r border-border bg-card/40 lg:block ${rail ? "w-14" : "w-[232px]"}`}>
          <div className="sticky top-0 h-dvh">
            <AdminSidebar status={status} rail={rail} onToggleRail={toggleRail} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <AdminTopbar
            current={current}
            group={activeAdminGroup(pathname)}
            attention={attention}
            bots={bots}
            status={status}
            onMenu={() => setDrawer(true)}
            drawerOpen={drawer}
          />

          <main className="px-3 py-4 sm:px-4 lg:px-6 lg:py-6">{children}</main>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu" id="admin-drawer">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[260px] max-w-[85vw] border-r border-border bg-background shadow-xl">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close admin menu"
              className="absolute right-2 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <X size={16} aria-hidden="true" />
            </button>
            <AdminSidebar status={status} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full-width red bar whenever real money is ARMED, on every admin page. /admin/bots renders its own
 * bar with the inline Disarm (it owns the controls context and confirm flow), so this one steps
 * aside there and elsewhere links to it.
 */
function ArmedBar({ fleet, pathname }: { fleet: FleetState | null; pathname: string }) {
  if (fleet?.real_money_armed !== true || pathname === "/admin/bots") return null;
  const since = fleet.real_money_armed_at ? ` since ${new Date(fleet.real_money_armed_at).toISOString().slice(11, 16)} UTC` : "";
  return (
    <div role="alert" className="flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-600 px-4 py-1.5 text-sm font-medium text-white">
      <ShieldAlert size={16} aria-hidden="true" />
      REAL MONEY ARMED{since}
      <Link href="/admin/bots" className="rounded-md bg-white/15 px-2.5 py-0.5 text-white ring-1 ring-white/40 hover:bg-white/25">
        Disarm on Bots
      </Link>
    </div>
  );
}
