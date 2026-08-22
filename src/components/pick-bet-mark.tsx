"use client";

import { useState, useTransition } from "react";

/**
 * "I placed this bet" checkbox for a single pick on /picks. Signed-in only —
 * the parent gates rendering. Optimistic toggle: flip state first, POST to
 * /api/me/pick-marks, revert if the request fails.
 */
export function PickBetMark({
  pickId,
  initialMarked,
}: {
  pickId: string;
  initialMarked: boolean;
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
