"use client";

import { useState, useTransition } from "react";

/**
 * Real-money placement toggle for one Coolbet UI-placer bot
 * (COOLBET-PLACER-CONTROL-2026-09-08).
 *
 * Flips `coolbet_placer_bots.ui_place_enabled` via POST /api/admin/coolbet-placer-bots.
 * The engine placer reads that flag each run (intersected with its code-level
 * PLACEABLE_BOTS whitelist) to decide what stakes REAL money.
 *
 * Because turning a bot ON commits real money, OFF→ON is a DELIBERATE two-step
 * action: the first click arms a confirm ("Enable real money?"), the second
 * commits. ON→OFF is the safe direction and applies immediately. The switch is
 * optimistic and reverts on a failed request.
 */
export function CoolbetPlacerToggle({
  botName,
  initialEnabled,
}: {
  botName: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit(next: boolean) {
    setError(null);
    const prev = enabled;
    setEnabled(next); // optimistic
    setConfirming(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/coolbet-placer-bots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_name: botName, ui_place_enabled: next }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `HTTP ${res.status}`);
        }
      } catch (e) {
        setEnabled(prev); // revert
        setError(e instanceof Error ? e.message : "failed");
      }
    });
  }

  function onClick() {
    if (enabled) {
      commit(false); // ON → OFF, immediate (safe direction)
    } else if (confirming) {
      commit(true); // second click confirms
    } else {
      setConfirming(true); // OFF → ON, arm confirm
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={enabled}
        title={
          enabled
            ? "Real-money placement is ON — click to disable"
            : confirming
              ? "Click again to confirm enabling REAL-MONEY placement"
              : "Real-money placement is OFF — click to enable"
        }
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          pending ? "opacity-60" : ""
        } ${
          enabled
            ? "bg-emerald-500/80"
            : confirming
              ? "bg-rose-500/70 ring-2 ring-rose-400/60"
              : "bg-neutral-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>

      <div className="flex flex-col leading-tight">
        <span
          className={`text-[11px] font-medium ${
            enabled ? "text-emerald-400" : "text-neutral-500"
          }`}
        >
          {enabled ? "Real-money placement ON" : "Real-money placement OFF"}
        </span>
        {confirming && !enabled && (
          <span className="text-[10px] font-medium text-rose-300">
            click again to confirm — this stakes real money
          </span>
        )}
        {confirming && !enabled && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="mt-0.5 self-start text-[10px] text-neutral-500 underline hover:text-neutral-300"
          >
            cancel
          </button>
        )}
        {error && (
          <span className="text-[10px] text-rose-400">error: {error}</span>
        )}
      </div>
    </div>
  );
}
