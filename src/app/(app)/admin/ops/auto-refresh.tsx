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
 * The same refresh, made visible for a PageHeader's actions (#139 admin redesign): "Checked 19:45
 * UTC · every 60 s", and a button to refresh now. `checkedAt` is the server's render clock.
 */
export function AutoRefreshBadge({ intervalMs = 60_000, checkedAt }: { intervalMs?: number; checkedAt: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  const hhmm = new Date(checkedAt).toISOString().slice(11, 16);
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      title="Refresh now"
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-50" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      <span className="tabular-nums">
        Checked {hhmm} UTC · every {Math.round(intervalMs / 1000)} s
      </span>
      <RefreshCw size={12} aria-hidden="true" />
    </button>
  );
}
