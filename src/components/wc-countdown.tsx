"use client";

import { useEffect, useState } from "react";

interface WCCountdownProps {
  targetIso: string;
  /** Visual style — "card" for hero panel, "inline" for sticky banner. */
  variant?: "card" | "inline";
  /** Shown after the timer hits zero. */
  liveLabel?: string;
}

function formatParts(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3600),
    mins: Math.floor((totalSec % 3600) / 60),
    secs: totalSec % 60,
  };
}

/**
 * Live countdown that ticks every second on the client. SSR-safe — first
 * render uses the same `target - Date.now()` computation, so hydration sees
 * a one-tick delta at most (no flash, no mismatch warning).
 */
export function WCCountdown({ targetIso, variant = "card", liveLabel = "Kicked off" }: WCCountdownProps) {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = Math.max(0, target - now);
  const parts = formatParts(ms);

  if (ms === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-tournament-green,#06d6a0)]/15 px-2.5 py-1 text-xs font-semibold text-[color:var(--color-tournament-green,#06d6a0)]">
        <span className="size-1.5 animate-pulse rounded-full bg-[color:var(--color-tournament-green,#06d6a0)]" />
        {liveLabel}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
        {parts.days > 0 ? `${parts.days}d ` : ""}
        {parts.hours.toString().padStart(2, "0")}h{" "}
        {parts.mins.toString().padStart(2, "0")}m{" "}
        <span className="text-muted-foreground">{parts.secs.toString().padStart(2, "0")}s</span>
      </span>
    );
  }

  return (
    <div className="inline-flex items-baseline gap-3 rounded-xl border border-white/[0.08] bg-card/60 px-4 py-3 shadow-lg backdrop-blur-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Kick-off in
      </span>
      <div className="flex items-baseline gap-1.5 font-mono text-base font-bold tabular-nums text-foreground sm:text-lg">
        {parts.days > 0 && (
          <>
            <span>{parts.days}</span>
            <span className="text-[10px] font-medium text-muted-foreground">d</span>
          </>
        )}
        <span>{parts.hours.toString().padStart(2, "0")}</span>
        <span className="text-[10px] font-medium text-muted-foreground">h</span>
        <span>{parts.mins.toString().padStart(2, "0")}</span>
        <span className="text-[10px] font-medium text-muted-foreground">m</span>
        <span className="text-[color:var(--color-tournament-gold,#ffd166)]">
          {parts.secs.toString().padStart(2, "0")}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">s</span>
      </div>
    </div>
  );
}
