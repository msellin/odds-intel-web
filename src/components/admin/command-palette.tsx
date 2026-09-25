"use client";

// ⌘K / Ctrl-K command palette for the admin (#139 admin visual direction §8). Built from plain
// elements — no cmdk dependency. Sections: Pages (ADMIN_NAV), Bots (names passed from the layout,
// each opens its sheet on /admin/bots), Actions. Actions only NAVIGATE to the place where the
// change is made; they never toggle a switch themselves — every control keeps its own confirm
// dialog and audit row.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Bot, CornerDownLeft, Search, Zap } from "lucide-react";
import { ADMIN_NAV } from "./admin-nav";
import type { AttentionItem } from "@/lib/admin-attention";

export interface PaletteBot {
  name: string;
  label: string;
}

interface Entry {
  id: string;
  section: "Needs attention" | "Pages" | "Bots" | "Actions";
  label: string;
  hint?: string;
  href: string;
  /** Extra words that should find this entry (not shown). */
  keywords?: string;
}

/** The live fleet state, so actions say what they would actually do right now. */
export interface PaletteFleet {
  placementPaused: boolean | null;
  armed: boolean | null;
  picksPaused: boolean | null;
  sweepingPaused: boolean | null;
}

function word(v: boolean | null, onTrue: string, onFalse: string): string {
  return v == null ? "" : v ? onTrue : onFalse;
}

function actions(f: PaletteFleet): Entry[] {
  return [
  {
    id: "a-pause",
    section: "Actions",
    label: f.placementPaused ? "Real-money betting is stopped — open to restart it" : "Stop all real-money betting now",
    hint: "Bots · Real money",
    href: "/admin/bots#real-money",
    keywords: "stop kill emergency halt off turn off real money betting automatic placement switch",
  },
  {
    id: "a-arm",
    section: "Actions",
    label: f.armed ? "Switch real money off (it is ON)" : "Switch real money on (owner only; it is off)",
    hint: "Bots · Real money",
    href: "/admin/bots#real-money",
    keywords: "arm disarm stop money on off",
  },
  {
    id: "a-picks",
    section: "Actions",
    label: `${word(f.picksPaused, "Resume", "Pause")} the picks channel${word(f.picksPaused, " (paused now)", " (sending now)")}`.replace(/^ the/, "Pause / resume the"),
    hint: "Bots · Publishing",
    href: "/admin/bots#controls",
    keywords: "telegram customers channel stop mute publish",
  },
  {
    id: "a-footprint",
    section: "Actions",
    label: `Turn Coolbet collection ${word(f.sweepingPaused, "on (it is off now)", "off (it is on now)")}`.replace(/ $/, " on / off"),
    hint: "Feeds",
    href: "/admin/feeds#coolbet-footprint",
    keywords: "footprint sweeping imperva blocked odds collection stop pause resume",
  },
  { id: "a-feed", section: "Actions", label: "Pause or re-run one odds feed", hint: "Feeds", href: "/admin/feeds" },
  {
    id: "a-money",
    section: "Actions",
    label: "Real money: profit and loss, every real bet, bets to check",
    hint: "Bots · Real money",
    href: "/admin/bots?section=money",
    keywords: "real bets ledger pnl profit loss staked daily limit reconcile unconfirmed promotions",
  },
  { id: "a-place", section: "Actions", label: "Place a bet by hand from today's picks", hint: "Pick queue", href: "/admin/shadow-bots" },
  { id: "a-attention", section: "Actions", label: "What needs my attention?", hint: "Overview", href: "/admin#attention" },
  { id: "a-activity", section: "Actions", label: "Who changed what?", hint: "Activity", href: "/admin/activity", keywords: "history audit log changes" },
  ];
}

export function CommandPalette({ open, onClose, bots, fleet, attention = null }: { open: boolean; onClose: () => void; bots: PaletteBot[]; fleet: PaletteFleet; attention?: AttentionItem[] | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = ADMIN_NAV.flatMap((g) =>
      g.items.map((i) => ({ id: `p-${i.href}`, section: "Pages" as const, label: i.label, hint: g.label ?? undefined, href: i.href })),
    );
    const botEntries: Entry[] = bots.map((b) => ({
      id: `b-${b.name}`,
      section: "Bots",
      label: b.label,
      hint: b.label === b.name ? undefined : b.name,
      href: `/admin/bots?bot=${encodeURIComponent(b.name)}`,
    }));
    // the open problems (the Overview's attention items) are searchable too: "failing", "unibet", "money"
    // (strict owner test 2026-09-25: "failing" found nothing)
    const problems: Entry[] = (attention ?? []).map((a) => ({
      id: `n-${a.id}`,
      section: "Needs attention",
      label: a.title,
      hint: a.area.charAt(0).toUpperCase() + a.area.slice(1),
      href: a.href,
      keywords: `problem issue attention ${a.severity === "danger" ? "urgent" : "check"} failing failed down stopped broken ${a.detail ?? ""}`,
    }));
    return [...problems, ...pages, ...actions(fleet), ...botEntries];
  }, [bots, fleet, attention]);

  const filtered = useMemo(() => {
    // "1x2" must find "1×2 NEW+ EV5": fold the multiplication sign (and case) on both sides
    const fold = (t: string) => t.toLowerCase().replace(/×/g, "x");
    const n = fold(q.trim());
    // every word must match somewhere in label / hint / keywords / id ("ev5" finds "1x2 NEW+ EV5")
    const words = n.split(/\s+/).filter(Boolean);
    const hay = (e: Entry) => fold(`${e.label} ${e.hint ?? ""} ${e.keywords ?? ""} ${e.id}`);
    const hits = n ? entries.filter((e) => words.every((w) => hay(e).includes(w))) : entries.filter((e) => e.section !== "Bots" && e.section !== "Needs attention");
    return hits.slice(0, 40);
  }, [entries, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  const go = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    router.push(e.href);
  };

  let lastSection = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search the admin">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(filtered[sel]);
              }
            }}
            placeholder="Search pages, bots and actions…"
            aria-label="Search pages, bots and actions"
            aria-controls="palette-list"
            aria-activedescendant={filtered[sel] ? `pal-${filtered[sel].id}` : undefined}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</li>}
          {filtered.map((e, i) => {
            const header = e.section !== lastSection ? e.section : null;
            lastSection = e.section;
            const Icon = e.section === "Bots" ? Bot : e.section === "Actions" ? Zap : e.section === "Needs attention" ? AlertTriangle : ArrowRight;
            return (
              <li key={e.id} role="presentation">
                {header && <div className="px-2 pb-1 pt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{header}</div>}
                <button
                  id={`pal-${e.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(e)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm ${i === sel ? "bg-accent text-foreground" : "text-muted-foreground"}`}
                >
                  <Icon size={14} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{e.label}</span>
                  {e.hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{e.hint}</span>}
                  {i === sel && <CornerDownLeft size={12} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
