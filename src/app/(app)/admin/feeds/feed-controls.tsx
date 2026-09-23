"use client";

// Pause / resume / run now for one feed (#107 FEEDS-DASHBOARD phase B). Posts to
// /api/admin/feed-control, which only records the request; the engine enforces a
// pause within 30 s and starts a run-now within 30 s. So the card shows "queued"
// until the next status refresh confirms it.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FeedControls({
  feedId,
  label,
  controls,
  paused,
  runNowPending,
}: {
  feedId: string;
  label: string;
  controls: string[];
  paused: boolean;
  runNowPending: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!controls.length) return null;

  async function act(action: "pause" | "resume" | "run_now") {
    let reason: string | null = null;
    if (action === "pause") {
      reason = window.prompt(`Pause "${label}"?\nReason (optional, shown on the card):`, "");
      if (reason === null) return; // cancelled
    } else if (action === "run_now") {
      if (!window.confirm(`Run "${label}" now?`)) return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/feed-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_id: feedId, action, reason }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j.error ?? `failed (${r.status})`);
      } else {
        setMsg(
          action === "run_now"
            ? "queued — starts within 30 s"
            : action === "pause"
              ? "paused — takes effect within 30 s"
              : "resumed",
        );
        router.refresh();
      }
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {controls.includes("pause") &&
        (paused ? (
          <button className={`${btn} border-emerald-500/40 text-emerald-500`} disabled={busy} onClick={() => act("resume")}>
            ▶ Resume
          </button>
        ) : (
          <button className={`${btn} border-amber-500/40 text-amber-500`} disabled={busy} onClick={() => act("pause")}>
            ❚❚ Pause
          </button>
        ))}
      {controls.includes("run_now") && (
        <button className={btn} disabled={busy || paused || runNowPending} onClick={() => act("run_now")}
          title={paused ? "Resume first" : undefined}>
          {runNowPending ? "⏳ Run queued" : "↻ Run now"}
        </button>
      )}
      {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
    </div>
  );
}
