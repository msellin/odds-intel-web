"use client";

import { useState, useTransition } from "react";

/**
 * Global "calm Imperva" switch for the Coolbet footprint daemons
 * (COOLBET-DAEMONS-PAUSE-2026-09-09).
 *
 * Flips `coolbet_session_state.daemons_paused` via POST
 * /api/admin/coolbet-daemons-pause. The Mac footprint daemons (odds-snapshot,
 * feed-watchdog, mac-daemon tick) poll it and skip their Coolbet HTTP work while
 * paused — dropping the request footprint that provokes Imperva's "STAY COOL"
 * wall, without an SSH to the operator's Mac.
 *
 * Distinct from the per-bot real-money toggles below it: pausing daemons stops
 * COLLECTION (and placement, since the placer tick is skipped too); it does not
 * change what would place once collection resumes. Both directions apply
 * immediately (neither commits money), and the UI reverts on a failed request.
 */
export function CoolbetDaemonsPause({
  initialPaused,
  initialReason,
}: {
  initialPaused: boolean;
  initialReason: string | null;
}) {
  const [paused, setPaused] = useState(initialPaused);
  const [reason, setReason] = useState<string | null>(initialReason);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit(next: boolean) {
    setError(null);
    const prevPaused = paused;
    const prevReason = reason;
    setPaused(next); // optimistic
    setReason(next ? "paused from /admin/shadow-bots" : null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/coolbet-daemons-pause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paused: next,
            reason: next ? "paused from /admin/shadow-bots" : undefined,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
      } catch (e) {
        setPaused(prevPaused); // revert
        setReason(prevReason);
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-amber-500/25 bg-amber-500/[0.04] px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            paused ? "bg-amber-400" : "bg-emerald-400"
          }`}
          aria-hidden
        />
        <div className="leading-tight">
          <div className="text-xs font-semibold text-neutral-100">
            Coolbet daemons:{" "}
            <span className={paused ? "text-amber-300" : "text-emerald-300"}>
              {paused ? "PAUSED" : "running"}
            </span>
          </div>
          <div
            className="text-[11px] text-neutral-500"
            title="Sets coolbet_session_state.daemons_paused. The Mac footprint daemons (odds-snapshot, feed-watchdog, mac-daemon tick) poll it and skip all Coolbet HTTP while paused — drops the request footprint that provokes Imperva. Use when the 'STAY COOL' wall appears."
          >
            {paused
              ? reason ?? "footprint paused — Imperva relief"
              : "pause to reduce the Imperva footprint (ⓘ)"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {error && <span className="text-[11px] text-rose-400">{error}</span>}
        <button
          type="button"
          disabled={pending}
          onClick={() => commit(!paused)}
          className={`rounded px-3 py-1 text-xs font-semibold transition ${
            paused
              ? "bg-emerald-500/90 text-emerald-950 hover:bg-emerald-400"
              : "bg-amber-500/90 text-amber-950 hover:bg-amber-400"
          } disabled:opacity-50`}
        >
          {pending ? "…" : paused ? "Resume daemons" : "Pause daemons"}
        </button>
      </div>
    </div>
  );
}
