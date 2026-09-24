"use client";

// The ONE admin sidebar (owner, 2026-09-24: "all of the pages should have the left menu, the left
// menu should be a single component and we should only render the middle block"). Rendered once
// by src/app/(app)/admin/layout.tsx through AdminShell; pages never import it. Used twice inside
// the shell: the fixed desktop column (optionally an icon rail) and the mobile drawer.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ADMIN_NAV, isActiveAdminItem } from "./admin-nav";
import { DOT_CLS, WORD_CLS, type StatusDot } from "./admin-status";

export function AdminSidebar({
  status,
  rail = false,
  onToggleRail,
}: {
  status: StatusDot[];
  /** Icon-only rail (desktop collapsed). */
  rail?: boolean;
  /** Desktop only — the drawer has no rail. */
  onToggleRail?: () => void;
}) {
  const pathname = usePathname() ?? "";
  return (
    <div className="flex h-full flex-col px-2 py-4">
      <div className={`mb-4 ${rail ? "px-1 text-center" : "px-2"}`}>
        <div className="text-sm font-semibold">{rail ? "OI" : "OddsIntel"}</div>
        <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Admin</div>
      </div>

      <nav aria-label="Admin" className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {ADMIN_NAV.map((g, gi) => (
          <div key={g.label ?? gi}>
            {g.label &&
              (rail ? (
                <div className="mx-2 mb-1 border-t border-border" aria-hidden="true" />
              ) : (
                <div className="mb-1 px-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground/80">{g.label}</div>
              ))}
            <ul className="space-y-0.5">
              {g.items.map(({ href, label, Icon, unused }) => {
                const on = isActiveAdminItem(href, pathname);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={on ? "page" : undefined}
                      title={rail ? `${label}${unused ? " (unused)" : ""}` : undefined}
                      className={`flex items-center gap-2.5 rounded-md border-l-2 py-1.5 text-sm ${rail ? "justify-center px-0" : "px-2"} ${
                        on
                          ? "border-l-foreground bg-accent text-foreground"
                          : `border-l-transparent hover:bg-accent/50 hover:text-foreground ${unused ? "text-muted-foreground/60" : "text-muted-foreground"}`
                      }`}
                    >
                      <Icon size={16} aria-hidden="true" className="shrink-0" />
                      {rail ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
                      {!rail && unused && <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/50">unused</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-3 border-t border-border pt-3">
        {!rail && <div className="mb-1.5 px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Status</div>}
        <ul className={`space-y-1 text-sm ${rail ? "flex flex-col items-center" : "px-2"}`} aria-label="Status">
          {status.map((d) => (
            <li key={d.label} className="flex items-center gap-2" title={rail ? `${d.label}: ${d.word}` : undefined}>
              <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_CLS[d.tone]}`} aria-hidden="true" />
              {rail ? (
                <span className="sr-only">{`${d.label}: ${d.word}`}</span>
              ) : (
                <>
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className={`ml-auto ${WORD_CLS[d.tone]}`}>{d.word}</span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className={`mt-3 flex items-center gap-1 ${rail ? "flex-col" : "justify-between px-1"}`}>
          <Link
            href="/"
            title="Back to the public site"
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {rail ? <span className="sr-only">Public site</span> : "Public site"}
          </Link>
          {onToggleRail && (
            <button
              type="button"
              onClick={onToggleRail}
              aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
              title={rail ? "Expand sidebar" : "Collapse sidebar"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {rail ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
