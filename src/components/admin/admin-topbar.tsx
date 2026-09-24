"use client";

// The admin top bar (#139 admin visual direction §3/§8), on every admin page, every width:
//   [menu (below lg)] Admin › Section    ……    [Search… ⌘K] [bell]
// The bell lists the SAME attention items as the Overview inbox (one loader, cached 60 s in the
// layout) — red dot for anything urgent, amber for warnings only, nothing when all is clear.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Menu, Search } from "lucide-react";
import type { AttentionItem } from "@/lib/admin-attention";
import type { AdminNavItem } from "./admin-nav";
import { CommandPalette, type PaletteBot } from "./command-palette";
import { DOT_CLS, type StatusDot } from "./admin-status";

const SEV_DOT: Record<AttentionItem["severity"], string> = { danger: "bg-danger", warn: "bg-warning", info: "bg-info" };

export function AdminTopbar({
  current,
  group,
  attention,
  bots,
  status,
  onMenu,
  drawerOpen,
}: {
  current: AdminNavItem | null;
  group: string | null;
  attention: AttentionItem[] | null;
  bots: PaletteBot[];
  status: StatusDot[];
  onMenu: () => void;
  drawerOpen: boolean;
}) {
  const [palette, setPalette] = useState(false);
  const [bell, setBell] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === "Escape") setBell(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!bell) return;
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBell(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [bell]);

  const urgent = attention?.filter((a) => a.severity === "danger").length ?? 0;
  const count = attention?.length ?? 0;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background/85 px-2 backdrop-blur sm:px-3 lg:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open admin menu"
          aria-expanded={drawerOpen}
          aria-controls="admin-drawer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent lg:hidden"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            <li className="hidden sm:block">
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                Admin
              </Link>
            </li>
            {group && (
              <li className="hidden items-center gap-1.5 text-muted-foreground md:flex">
                <ChevronRight size={14} aria-hidden="true" />
                {group}
              </li>
            )}
            {current && current.href !== "/admin" && (
              <li className="flex min-w-0 items-center gap-1.5">
                <ChevronRight size={14} className="hidden text-muted-foreground sm:block" aria-hidden="true" />
                <span className="truncate font-medium" aria-current="page">
                  {current.label}
                </span>
              </li>
            )}
            {current?.href === "/admin" && (
              <li className="flex items-center gap-1.5">
                <ChevronRight size={14} className="hidden text-muted-foreground sm:block" aria-hidden="true" />
                <span className="font-medium" aria-current="page">Overview</span>
              </li>
            )}
          </ol>
        </nav>

        {/* status dots only where the sidebar (which lists them in words) is hidden */}
        <ul className="flex items-center gap-1.5 lg:hidden" aria-label="Status">
          {status.map((d) => (
            <li key={d.label} title={`${d.label}: ${d.word}`}>
              <span className={`block h-2 w-2 rounded-full ${DOT_CLS[d.tone]}`} aria-hidden="true" />
              <span className="sr-only">{`${d.label}: ${d.word}`}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setPalette(true)}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:w-56 sm:px-2.5"
          aria-label="Search pages, bots and actions (Ctrl or Cmd + K)"
        >
          <Search size={14} aria-hidden="true" />
          <span className="hidden flex-1 text-left sm:inline">Search…</span>
          <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
        </button>

        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBell((b) => !b)}
            aria-expanded={bell}
            aria-haspopup="dialog"
            aria-label={attention == null ? "Attention: unknown" : count ? `${count} thing${count === 1 ? "" : "s"} need attention, ${urgent} urgent` : "Nothing needs attention"}
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent"
          >
            <Bell size={15} aria-hidden="true" />
            {count > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums text-white ${urgent ? "bg-danger" : "bg-warning"}`}
                aria-hidden="true"
              >
                {count}
              </span>
            )}
          </button>
          {bell && (
            <div role="dialog" aria-label="Needs attention" className="absolute right-0 top-10 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-popover shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium">Needs attention</span>
                <span className="text-xs text-muted-foreground">{attention == null ? "unknown" : count ? `${count} open · ${urgent} urgent` : "all clear"}</span>
              </div>
              {attention == null ? (
                <p className="px-3 py-4 text-sm text-warning">Could not check right now — open the Overview.</p>
              ) : count === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">Nothing needs an action.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
                  {attention.slice(0, 8).map((a) => (
                    <li key={a.id}>
                      <Link href={a.href} onClick={() => setBell(false)} className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SEV_DOT[a.severity]}`} aria-hidden="true" />
                        <span className="min-w-0">{a.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin#attention" onClick={() => setBell(false)} className="block border-t border-border px-3 py-2 text-center text-xs text-primary hover:bg-accent/50">
                Open the full list on Overview
              </Link>
            </div>
          )}
        </div>
      </header>
      <CommandPalette open={palette} onClose={() => setPalette(false)} bots={bots} />
    </>
  );
}
