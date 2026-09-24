"use client";

// /admin/bots table toolbar (#139 design system §7, 2026-09-24). The bot table is NOT a
// `DataTable`: it is grouped by family (each family has its own judged-on metric and column
// header), rows carry live money switches that must not trigger row navigation, the forest bars
// share one x-axis per family, and below xl every row turns into a card. DataTable has none of
// grouping, per-group headers or a card layout. So the table keeps its own rows and this toolbar
// copies DataTable's look and behaviour exactly — search box, dashed facet chips with counts and
// a checkbox list, Reset, and sorting (column headers on desktop, a Sort menu everywhere) — so
// the page reads as the same system. Sorting applies WITHIN each family; the families keep order.

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, PlusCircle, Search, X } from "lucide-react";

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export function FacetChip({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FacetOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const first = options.find((o) => o.value === selected[0]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <PlusCircle size={13} aria-hidden="true" />
        {label}
        {selected.length > 0 && (
          <span className="rounded bg-accent px-1.5 text-foreground">{selected.length === 1 ? first?.label ?? selected[0] : `${selected.length} selected`}</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-60 rounded-lg border border-border bg-popover p-1 shadow-xl" role="listbox" aria-label={label} aria-multiselectable="true">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className={`flex size-3.5 items-center justify-center rounded-sm border text-[10px] ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} aria-hidden="true">
                  {on ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{o.count}</span>
              </button>
            );
          })}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-md border-t border-border px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-accent">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative w-full sm:w-56">
      <span className="sr-only">{placeholder}</span>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-border bg-muted/30 pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
      Reset <X size={12} aria-hidden="true" />
    </button>
  );
}

/** Quick views (the old filter pills): one choice, wraps on a phone. */
export function QuickViews<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Show" className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`h-7 rounded-md px-2.5 text-xs transition-colors ${o.value === value ? "bg-accent text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
          {o.badge != null && o.badge > 0 && <span className="ml-1 tabular-nums text-warning">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export type SortKey = "verdict" | "name" | "clv" | "p7" | "settled" | "roi" | "last";
export type SortDir = "asc" | "desc";

export const SORT_LABEL: Record<SortKey, string> = {
  verdict: "Verdict (default)",
  name: "Name",
  clv: "CLV (judged metric)",
  p7: "Picks · 7 days",
  settled: "Settled picks",
  roi: "ROI (flat stake)",
  last: "Last pick",
};

/** Natural first direction per key: names A→Z, numbers and recency high→low. */
export const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  verdict: "asc",
  name: "asc",
  clv: "desc",
  p7: "desc",
  settled: "desc",
  roi: "desc",
  last: "desc",
};

export function SortMenu({ sort, dir, onChange }: { sort: SortKey; dir: SortDir; onChange: (s: SortKey, d: SortDir) => void }) {
  return (
    <div className="inline-flex h-8 items-center gap-1 rounded-lg border border-border pl-2.5 pr-1 text-xs text-muted-foreground">
      <label className="flex items-center gap-1.5">
        Sort
        <select
          value={sort}
          onChange={(e) => {
            const s = e.target.value as SortKey;
            onChange(s, SORT_DEFAULT_DIR[s]);
          }}
          className="h-7 rounded-md bg-transparent pr-1 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k} className="bg-popover">
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => onChange(sort, dir === "asc" ? "desc" : "asc")}
        aria-label={dir === "asc" ? "Ascending — switch to descending" : "Descending — switch to ascending"}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
      >
        {dir === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
      </button>
    </div>
  );
}
