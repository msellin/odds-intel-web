"use client";

import { useState, useTransition } from "react";

/**
 * Tri-state pick review marker for the shadow-bots upcoming picks table.
 *
 * States (cycle on click: 0 → 1 → 2 → 0):
 *   0 = untouched  — empty circle (neutral)
 *   1 = reviewed   — eye icon (amber) — looked at, possibly waiting for better odds
 *   2 = bet placed — checkmark (emerald) — manually placed at a book
 *
 * Optimistic update: state flips immediately, POST to /api/me/pick-marks,
 * reverts on failure.
 */

type MarkState = 0 | 1 | 2;

function StateIcon({ state, pending }: { state: MarkState; pending: boolean }) {
  const base = `h-4 w-4 rounded-sm transition-colors ${pending ? "opacity-50" : ""}`;
  if (state === 0) {
    return (
      <svg className={`${base} text-neutral-600 hover:text-neutral-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="8" cy="8" r="6" />
      </svg>
    );
  }
  if (state === 1) {
    return (
      <svg className={`${base} text-amber-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <ellipse cx="8" cy="8" rx="7" ry="4.5" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg className={`${base} text-emerald-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="3,8 6.5,11.5 13,4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TITLES: Record<MarkState, string> = {
  0: "Not reviewed — click to mark as reviewed",
  1: "Reviewed — click to mark as bet placed",
  2: "Bet placed — click to reset",
};

export function PickBetMark({
  pickId,
  initialState = 0,
}: {
  pickId: string;
  initialState?: MarkState;
}) {
  const [state, setState] = useState<MarkState>(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cycle = () => {
    const next: MarkState = state === 0 ? 1 : state === 1 ? 2 : 0;
    setState(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/me/pick-marks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pickId, state: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        setState(state);
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={cycle}
      disabled={pending}
      className="flex cursor-pointer items-center justify-center rounded p-0.5 hover:bg-white/[0.04]"
      title={error ?? TITLES[state]}
    >
      <StateIcon state={state} pending={pending} />
    </button>
  );
}
