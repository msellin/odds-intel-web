"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

/**
 * The same refresh, made visible for a PageHeader's actions (#139 admin redesign). Answer-first fix
 * round (2026-09-25): "Checked 08:47 · every 60 s" beside "status checked 12 min ago" read as live
 * data — it only ever said when the PAGE was drawn. It now says both: "Page refreshed 08:47 · data
 * from 08:37" (`dataAt` = the newest time the underlying data was written; omitted → page time only).
 * `checkedAt` is the server's render clock. Refreshes every `intervalMs`; click to refresh now.
 */
export function AutoRefreshBadge({ intervalMs = 60_000, checkedAt, dataAt }: { intervalMs?: number; checkedAt: number; dataAt?: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  const hhmm = new Date(checkedAt).toISOString().slice(11, 16);
  const dataHhmm = dataAt ? new Date(dataAt).toISOString().slice(11, 16) : null;
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      title={`Refresh now — the page reloads itself every ${Math.round(intervalMs / 1000)} s; the data underneath is written by the engine on its own schedule. Times are UTC.`}
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <span className="tabular-nums">
        Page refreshed {hhmm}
        {dataHhmm && <> · data from {dataHhmm}</>}
      </span>
      <RefreshCw size={12} aria-hidden="true" />
    </button>
  );
}
