"use client";

// A pause reason in plain words first, the raw stored text muted after (#139 review P2: the raw
// "OWN-PATH-VERDICT 2026-09-14: kill criterion met…" string is a code reference, not a sentence).

import { isStrategicPause } from "@/lib/bot-controls/types";

export function pauseSummary(reason: string | null | undefined): string {
  if (!reason) return "Paused — no reason was recorded.";
  if (isStrategicPause(reason)) {
    return "Strategic stop: automated betting with our own money was closed on purpose after the numbers said it does not pay. It is not a technical fault — do not clear it when fixing a login or feed problem.";
  }
  if (/daemon self-pause/i.test(reason)) return "Paused automatically by the placer after repeated errors; it clears itself once the session works again.";
  if (/telegram|\/pause/i.test(reason)) return "Paused by the operator from Telegram.";
  if (/admin\/bots|via web/i.test(reason)) return "Paused by the operator from this page.";
  return "Paused by the operator.";
}

export function PauseReason({ reason, compact = false }: { reason: string | null; compact?: boolean }) {
  return (
    <div className={`rounded-md border-l-2 border-amber-500/60 bg-muted/40 px-2.5 py-1.5 ${compact ? "text-xs" : "text-sm"}`}>
      <p className="text-foreground">{pauseSummary(reason)}</p>
      {reason && (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Recorded reason</summary>
          <p className="mt-0.5 max-h-28 overflow-y-auto break-words font-mono opacity-80">{reason}</p>
        </details>
      )}
    </div>
  );
}
