"use client";

/**
 * WC-GROUP-PREDICTOR (2026-06-02) — Group-standings picker.
 *
 * UX choice: ordered list with up/down arrow buttons + a "Save group" CTA.
 *   • No drag-and-drop libraries (mobile-tap reliability beats fancy DnD).
 *   • 375px-first layout — every control has a 44×44 hit target.
 *   • The 4 teams are pre-loaded; the user reorders them. Position is implied
 *     by list index (top = 1st, bottom = 4th).
 *   • Save-per-group rather than save-on-every-tap so users can experiment
 *     without writing 4 rows per swap.
 */

import { useMemo, useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Check, Lock, Loader2 } from "lucide-react";

import { flagForTeam } from "@/lib/wc-flags";
import { saveGroupStandings } from "@/app/(app)/world-cup/actions";

interface Team {
  id: string;
  name: string;
  logo: string | null;
}

interface InitialGroup {
  letter: string;           // "A".."L"
  teams: Team[];            // 4 teams (any order)
  initialOrder: string[];   // 4 teamIds in user's saved order (or default)
}

interface Props {
  groups: InitialGroup[];
  isAuthed: boolean;
  isLocked: boolean;
}

const POSITION_LABELS = ["1st", "2nd", "3rd", "4th"];
const POSITION_POINTS = [5, 3, 2, 1];

export function WCGroupStandingsPicker({ groups, isAuthed, isLocked }: Props) {
  const [orders, setOrders] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    for (const g of groups) o[g.letter] = g.initialOrder.slice();
    return o;
  });
  const [savingLetter, setSavingLetter] = useState<string | null>(null);
  const [savedLetters, setSavedLetters] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const teamsByLetter = useMemo(() => {
    const m: Record<string, Record<string, Team>> = {};
    for (const g of groups) {
      m[g.letter] = Object.fromEntries(g.teams.map((t) => [t.id, t]));
    }
    return m;
  }, [groups]);

  const move = (letter: string, idx: number, dir: -1 | 1) => {
    if (isLocked) return;
    setOrders((prev) => {
      const arr = prev[letter].slice();
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...prev, [letter]: arr };
    });
    // Reset "saved" indicator on edit.
    setSavedLetters((prev) => {
      if (!prev.has(letter)) return prev;
      const next = new Set(prev);
      next.delete(letter);
      return next;
    });
  };

  const onSave = (letter: string) => {
    if (isLocked || !isAuthed) return;
    const order = orders[letter];
    if (!order || order.length !== 4) return;
    setSavingLetter(letter);
    setErrors((p) => ({ ...p, [letter]: "" }));
    startTransition(async () => {
      const res = await saveGroupStandings(letter, {
        1: order[0],
        2: order[1],
        3: order[2],
        4: order[3],
      });
      if (!res.ok) {
        setErrors((p) => ({ ...p, [letter]: res.error ?? "Could not save." }));
      } else {
        setSavedLetters((prev) => {
          const next = new Set(prev);
          next.add(letter);
          return next;
        });
      }
      setSavingLetter(null);
    });
  };

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300">
          <Lock className="size-4 shrink-0" />
          <span>Group picks are locked — the tournament has started.</span>
        </div>
      )}
      {!isAuthed && (
        <div className="rounded-xl border border-white/[0.08] bg-card/40 px-3 py-2.5 text-xs text-muted-foreground">
          Sign in to save your group-standings picks.
        </div>
      )}

      {groups.map((g) => {
        const order = orders[g.letter] ?? g.initialOrder;
        const saved = savedLetters.has(g.letter);
        const saving = savingLetter === g.letter && pending;
        const err = errors[g.letter];

        return (
          <section
            key={g.letter}
            className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card/40"
          >
            <header className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-[color:var(--color-tournament-gold)]/15 text-[11px] font-bold text-[color:var(--color-tournament-gold)]">
                  {g.letter}
                </span>
                <h3 className="text-sm font-semibold text-foreground">
                  Group {g.letter}
                </h3>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Reorder · top = 1st place
              </span>
            </header>

            <ul className="divide-y divide-white/[0.04]">
              {order.map((teamId, idx) => {
                const t = teamsByLetter[g.letter]?.[teamId];
                if (!t) return null;
                const flag = flagForTeam(t.name);
                return (
                  <li
                    key={teamId}
                    className="flex items-center gap-2 px-3 py-2.5 sm:gap-3"
                  >
                    <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono font-semibold tabular-nums text-foreground">
                        {POSITION_LABELS[idx]}
                      </span>
                      <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
                        +{POSITION_POINTS[idx]}pt
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        {flag && <span aria-hidden>{flag}</span>}
                        <span className="truncate">{t.name}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${t.name} up`}
                        disabled={isLocked || idx === 0}
                        onClick={() => move(g.letter, idx, -1)}
                        className="inline-flex size-11 items-center justify-center rounded-md border border-white/[0.08] bg-background/60 text-muted-foreground hover:border-white/[0.16] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${t.name} down`}
                        disabled={isLocked || idx === order.length - 1}
                        onClick={() => move(g.letter, idx, 1)}
                        className="inline-flex size-11 items-center justify-center rounded-md border border-white/[0.08] bg-background/60 text-muted-foreground hover:border-white/[0.16] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              {err ? (
                <span className="text-[11px] text-rose-400">{err}</span>
              ) : saved ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                  <Check className="size-3" /> Locked in
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Max 16pt (incl. +5 perfect-group bonus)
                </span>
              )}
              <button
                type="button"
                onClick={() => onSave(g.letter)}
                disabled={isLocked || !isAuthed || saving}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-[color:var(--color-tournament-gold)] px-3 text-xs font-bold text-background hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Saving
                  </>
                ) : saved ? (
                  <>
                    <Check className="size-3.5" /> Saved
                  </>
                ) : (
                  <>Save group {g.letter}</>
                )}
              </button>
            </footer>
          </section>
        );
      })}
    </div>
  );
}
