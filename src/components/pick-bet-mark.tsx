"use client";

import { useState, useTransition } from "react";

/**
 * "I placed this bet" checkbox for a single pick. Superadmin-facing surface —
 * operator ticks off shadow-bot picks they've placed manually so they don't
 * double-place or forget which ones are still open.
 *
 * Optimistic toggle: flip state first, POST to /api/me/pick-marks, revert
 * if the request fails.
 *
 * `compact` renders a bare checkbox for dense admin tables (shadow-bots
 * upcoming grid); default renders a labeled pill for wider layouts.
 */
export function PickBetMark({
  pickId,
  initialMarked,
  compact = false,
}: {
  pickId: string;
  initialMarked: boolean;
  compact?: boolean;
}) {
  const [marked, setMarked] = useState(initialMarked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !marked;
    setMarked(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/me/pick-marks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pickId, marked: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        setMarked(!next);
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  };

  if (compact) {
    return (
      <label
        className={`inline-flex cursor-pointer select-none items-center justify-center ${
          pending ? "opacity-70" : ""
        }`}
        title={error ?? (marked ? "Bet placed — click to unmark" : "Mark this pick as bet placed")}
      >
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer accent-emerald-500"
          checked={marked}
          onChange={toggle}
          disabled={pending}
        />
      </label>
    );
  }

  return (
    <label
      className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
        marked
          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
          : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/25 hover:text-neutral-200"
      } ${pending ? "opacity-70" : ""}`}
      title={error ?? "Mark this pick as bet placed"}
    >
      <input
        type="checkbox"
        className="h-3 w-3 accent-emerald-500"
        checked={marked}
        onChange={toggle}
        disabled={pending}
      />
      <span>{marked ? "Bet placed" : "Mark bet"}</span>
    </label>
  );
}
