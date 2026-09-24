"use client";

// Admin shell (#139 phase A, spec §3.1): sidebar with the admin sections and a STATUS block
// (placement / real money / picks channel, each dot + word), and a full-width red bar across the
// top whenever real money is ARMED, with an inline Disarm (Stripe's test-mode bar, inverted).
//
// Scope note: the spec puts this in a shared `admin/layout.tsx` for every admin page. In phase A
// it wraps /admin/bots only (the other admin pages are outside this change); lifting it into the
// layout is a move, not a rewrite. Below `lg` the sidebar becomes a scrollable tab bar with the
// three status dots at its end.

import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, Bot, Ghost, LayoutDashboard, Rss, ShieldAlert } from "lucide-react";
import { useControls } from "./controls-context";
import { hhmmUtc } from "./bot-board-format";

const NAV = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard },
  { href: "/admin/bots", label: "Bots", Icon: Bot },
  { href: "/admin/feeds", label: "Feeds", Icon: Rss },
  { href: "/admin/shadow-bots", label: "Shadow", Icon: Ghost },
  { href: "/admin/ops", label: "Ops", Icon: Activity },
];

type Dot = { label: string; word: string; tone: "ok" | "warn" | "danger" | "unknown" | "idle" };
const DOT_CLS: Record<Dot["tone"], string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  danger: "bg-red-500",
  unknown: "bg-amber-300/60 ring-1 ring-amber-300",
  idle: "bg-sky-400",
};

function useStatus(): Dot[] {
  const ctl = useControls();
  const paused = ctl.current("placement_paused", null);
  const armed = ctl.current("real_money_disarm", null);
  const pub = ctl.current("publishing_paused", null);
  return [
    { label: "Placement", word: paused == null ? "Unknown" : paused ? "Paused" : "Running", tone: paused == null ? "unknown" : paused ? "idle" : "warn" },
    { label: "Real money", word: armed == null ? "Unknown" : armed ? "ARMED" : "Off", tone: armed == null ? "unknown" : armed ? "danger" : "ok" },
    { label: "Picks channel", word: pub == null ? "Unknown" : pub ? "Paused" : "Sending", tone: pub == null ? "unknown" : pub ? "warn" : "ok" },
  ];
}

export function AdminShell({ active, children }: { active: string; children: ReactNode }) {
  const ctl = useControls();
  const status = useStatus();
  const armed = ctl.current("real_money_disarm", null) === true;
  const f = ctl.state.fleet.row;
  const armedBy = ctl.state.changes.rows.find((c) => c.control === "real_money_armed" && c.outcome === "applied" && c.new_value === true)?.actor;
  return (
    // Full-bleed: the (app) layout centres content at max-w-7xl, which leaves no room for a
    // sidebar next to the 1,216 px bot table. From lg the shell spans the viewport instead.
    <div className="lg:ml-[calc(50%-50vw)] lg:w-screen">
      {armed && (
        <div role="alert" className="flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-600 px-4 py-1.5 text-sm font-medium text-white">
          <ShieldAlert size={16} aria-hidden="true" />
          REAL MONEY ARMED{f?.real_money_armed_at ? ` since ${hhmmUtc(f.real_money_armed_at)} UTC` : ""}
          {armedBy ? ` by ${armedBy}` : ""}
          <button
            type="button"
            disabled={ctl.pending("real_money_disarm", null)}
            onClick={() => ctl.request({ control: "real_money_disarm", bot: null, value: false })}
            className="rounded-md bg-white/15 px-2.5 py-0.5 text-white ring-1 ring-white/40 hover:bg-white/25 disabled:opacity-60"
          >
            Disarm
          </button>
        </div>
      )}
      <div className="lg:flex">
        <aside className="hidden w-[232px] shrink-0 border-r border-border bg-card/40 lg:block">
          <div className="sticky top-0 flex h-[100dvh] flex-col px-3 py-4">
            <div className="mb-4 px-2">
              <div className="text-sm font-semibold">OddsIntel</div>
              <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Admin</div>
            </div>
            <nav aria-label="Admin" className="space-y-0.5">
              {NAV.map(({ href, label, Icon }) => {
                const on = href === active;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-sm ${on ? "border-l-foreground bg-accent text-foreground" : "border-l-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
                  >
                    <Icon size={16} aria-hidden="true" /> {label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border pt-3">
              <div className="mb-1.5 px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Status</div>
              <ul className="space-y-1 px-2 text-sm">
                {status.map((d) => (
                  <li key={d.label} className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${DOT_CLS[d.tone]}`} aria-hidden="true" />
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className={`ml-auto ${d.tone === "danger" ? "font-semibold text-red-400" : d.tone === "unknown" ? "text-amber-300" : ""}`}>{d.word}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* below lg: horizontal tab bar + three status dots */}
          <div className="flex items-center gap-2 border-b border-border lg:hidden">
            <nav aria-label="Admin" className="flex min-w-0 flex-1 overflow-x-auto">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={href === active ? "page" : undefined}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${href === active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {/* below lg: the three statuses, labelled (dots alone said nothing) */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border py-2 text-xs lg:hidden" aria-label="Status">
            {status.map((d) => (
              <li key={d.label} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${DOT_CLS[d.tone]}`} aria-hidden="true" />
                <span className="text-muted-foreground">{d.label}</span>
                <span className={d.tone === "danger" ? "font-semibold text-red-400" : d.tone === "unknown" ? "text-amber-300" : ""}>{d.word}</span>
              </li>
            ))}
          </ul>
          <div className="px-0 py-4 lg:px-6 lg:py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
