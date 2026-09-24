"use client";

// Pause / resume / run now for one feed (#107 FEEDS-DASHBOARD phase B). Posts to
// /api/admin/feed-control, which only records the request; the engine enforces a
// pause within 30 s and starts a run-now within 30 s. So the card shows "queued"
// until the next status refresh confirms it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hourglass, Pause, Play, RotateCw } from "lucide-react";

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
    "inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {controls.includes("pause") &&
        (paused ? (
          <button className={`${btn} border-success/40 text-success`} disabled={busy} onClick={() => act("resume")}>
            <Play size={12} aria-hidden="true" /> Resume
          </button>
        ) : (
          <button className={`${btn} border-warning/40 text-warning`} disabled={busy} onClick={() => act("pause")}>
            <Pause size={12} aria-hidden="true" /> Pause
          </button>
        ))}
      {controls.includes("run_now") && (
        <button className={btn} disabled={busy || paused || runNowPending} onClick={() => act("run_now")}
          title={paused ? "Resume first" : undefined}>
          {runNowPending ? (
            <>
              <Hourglass size={12} aria-hidden="true" /> Run queued
            </>
          ) : (
            <>
              <RotateCw size={12} aria-hidden="true" /> Run now
            </>
          )}
        </button>
      )}
      {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
    </div>
  );
}
