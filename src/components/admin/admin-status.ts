// The fleet statuses shown in the admin sidebar (placement / real money / picks channel / Coolbet
// sweeping). The 4th line (IA move P2, 2026-09-24) keeps the footprint pause visible on every page
// now that its switch lives on /admin/feeds.
// Read server-side in admin/layout.tsx (loadFleetStatus) and passed down; refreshed whenever a page
// calls router.refresh() — the bots control panel does after every write.

import type { FleetState } from "@/lib/bot-controls/types";

export type StatusTone = "ok" | "warn" | "danger" | "unknown" | "idle";
export interface StatusDot {
  label: string;
  word: string;
  tone: StatusTone;
}

export const DOT_CLS: Record<StatusTone, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  danger: "bg-red-500",
  unknown: "bg-amber-300/60 ring-1 ring-amber-300",
  idle: "bg-sky-400",
};

export const WORD_CLS: Record<StatusTone, string> = {
  ok: "",
  warn: "",
  idle: "",
  danger: "font-semibold text-red-400",
  unknown: "text-amber-300",
};

export function fleetStatus(f: FleetState | null): StatusDot[] {
  const paused = f?.placement_paused ?? null;
  const armed = f?.real_money_armed ?? null;
  const pub = f?.publishing_paused ?? null;
  const foot = f?.daemons_paused ?? null;
  return [
    { label: "Placement", word: paused == null ? "Unknown" : paused ? "Paused" : "Running", tone: paused == null ? "unknown" : paused ? "idle" : "warn" },
    { label: "Real money", word: armed == null ? "Unknown" : armed ? "ARMED" : "Off", tone: armed == null ? "unknown" : armed ? "danger" : "ok" },
    { label: "Picks channel", word: pub == null ? "Unknown" : pub ? "Paused" : "Sending", tone: pub == null ? "unknown" : pub ? "warn" : "ok" },
    { label: "Coolbet sweeping", word: foot == null ? "Unknown" : foot ? "Paused" : "Collecting", tone: foot == null ? "unknown" : foot ? "idle" : "ok" },
  ];
}
