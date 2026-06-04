"use client";

/**
 * WC-E1 — sortable Monte Carlo table for /world-cup/who-can-win
 *
 * Client component because we want click-to-sort without round-tripping.
 * Initial sort is provided server-side (desc by p_winner) so the first paint
 * is already meaningful; click any column header to re-sort.
 *
 * The advance % cell renders a small horizontal bar coloured by the
 * advance probability: green = high (>=60%), gold = mid (~30-60%), muted = low.
 * Visual scan signal matches the tournament-green / tournament-gold palette
 * used throughout the WC surface so users can read the row at a glance.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";

import { displayProb } from "@/lib/probability-display";
import type { WhoCanWinRow } from "@/app/(app)/world-cup/who-can-win/page";

type SortKey =
  | "teamName"
  | "group"
  | "elo"
  | "pAdvance"
  | "pR16"
  | "pQF"
  | "pSF"
  | "pFinal"
  | "pWinner";

type SortDir = "asc" | "desc";

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right" | "center" }> = [
  { key: "teamName", label: "Team", align: "left" },
  { key: "group", label: "Group", align: "center" },
  { key: "elo", label: "ELO", align: "right" },
  { key: "pAdvance", label: "Advance", align: "right" },
  { key: "pR16", label: "R16", align: "right" },
  { key: "pQF", label: "QF", align: "right" },
  { key: "pSF", label: "SF", align: "right" },
  { key: "pFinal", label: "Final", align: "right" },
  { key: "pWinner", label: "Winner", align: "right" },
];

function advanceBarTone(p: number): string {
  if (p >= 0.6) return "bg-[color:var(--color-tournament-green)]/80";
  if (p >= 0.35) return "bg-[color:var(--color-tournament-gold)]/80";
  return "bg-white/15";
}

export function WhoCanWinTable({ rows }: { rows: WhoCanWinRow[] }) {
  // Default sort matches server-side ordering (winner desc).
  const [sortKey, setSortKey] = useState<SortKey>("pWinner");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];

      // Mixed-type safe compare.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Numeric defaults DESC (high prob first); text defaults ASC.
      const numeric = key !== "teamName" && key !== "group";
      setSortDir(numeric ? "desc" : "asc");
    }
  }

  return (
    <section
      aria-label="Tournament probabilities per team"
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              {COLUMNS.map((c) => {
                const isActive = c.key === sortKey;
                const Icon = !isActive
                  ? ArrowUpDown
                  : sortDir === "asc"
                  ? ArrowUp
                  : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={`px-2 py-2.5 sm:px-3 sm:py-3 ${
                      c.align === "right"
                        ? "text-right"
                        : c.align === "center"
                        ? "text-center"
                        : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(c.key)}
                      aria-label={`Sort by ${c.label}`}
                      className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
                        isActive ? "text-foreground" : ""
                      } ${c.align === "right" ? "flex-row-reverse" : ""}`}
                    >
                      <span>{c.label}</span>
                      <Icon className="size-3 opacity-70" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const isTop5 = idx < 5 && sortKey === "pWinner" && sortDir === "desc";
              return (
                <tr
                  key={r.teamId}
                  className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                    isTop5 ? "bg-[color:var(--color-tournament-gold)]/[0.03]" : ""
                  }`}
                >
                  <td className="px-2 py-2.5 sm:px-3 sm:py-3">
                    <Link
                      href={`/world-cup/teams/${r.slug}`}
                      className="group flex items-center gap-2 text-foreground hover:text-[color:var(--color-tournament-gold)]"
                    >
                      {r.flag ? (
                        <span aria-hidden className="text-lg leading-none">
                          {r.flag}
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className="inline-flex size-5 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-muted-foreground"
                        >
                          {r.teamName.charAt(0)}
                        </span>
                      )}
                      <span className="truncate font-medium">{r.teamName}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono text-[11px] tabular-nums text-muted-foreground sm:px-3 sm:py-3 sm:text-xs">
                    {r.group}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted-foreground sm:px-3 sm:py-3">
                    {r.elo != null ? Math.round(r.elo) : "—"}
                  </td>
                  <td className="px-2 py-2.5 text-right sm:px-3 sm:py-3">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono tabular-nums">
                        {displayProb(r.pAdvance)}
                      </span>
                      <span
                        role="img"
                        aria-label={`Advance probability ${displayProb(r.pAdvance)}`}
                        className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.04] sm:w-20"
                      >
                        <span
                          className={`block h-full ${advanceBarTone(r.pAdvance)}`}
                          style={{ width: `${Math.max(2, Math.min(100, r.pAdvance * 100))}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted-foreground sm:px-3 sm:py-3">
                    {displayProb(r.pR16)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted-foreground sm:px-3 sm:py-3">
                    {displayProb(r.pQF)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted-foreground sm:px-3 sm:py-3">
                    {displayProb(r.pSF)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono tabular-nums text-muted-foreground sm:px-3 sm:py-3">
                    {displayProb(r.pFinal)}
                  </td>
                  <td className="px-2 py-2.5 text-right font-mono font-semibold tabular-nums text-[color:var(--color-tournament-gold)] sm:px-3 sm:py-3">
                    {displayProb(r.pWinner)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
