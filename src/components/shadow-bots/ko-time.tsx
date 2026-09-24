"use client";

import { useEffect, useState } from "react";

/**
 * Kickoff as "relative · local". The server renders UTC (no operator timezone
 * server-side); after mount this swaps to the browser's local time and a
 * relative "in 2h 05m", refreshed once a minute. suppressHydrationWarning
 * covers the swap.
 */
export function KoTime({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const d = new Date(iso);
  const utc = d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  if (now == null) {
    return (
      <span className="whitespace-nowrap font-mono text-xs text-muted-foreground" suppressHydrationWarning>
        {utc} UTC
      </span>
    );
  }
  const mins = Math.round((d.getTime() - now) / 60000);
  const rel =
    mins < 0 ? "started" : mins < 60 ? `in ${mins}m` : `in ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
  const local = d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <span className="flex flex-col whitespace-nowrap font-mono text-xs leading-tight" suppressHydrationWarning title={`${utc} UTC`}>
      <span className="text-foreground">{rel}</span>
      <span className="text-[11px] text-muted-foreground">{local}</span>
    </span>
  );
}
