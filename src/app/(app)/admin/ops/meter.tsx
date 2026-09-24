// Coverage meter for /admin/ops (Jobs) and /admin/feeds (#139 admin redesign, 2026-09-24): label,
// "x / total (pct)" and a thin bar, with a one-line plain note. Replaces ops' old Stat tiles. Server
// component (no hooks), so it renders inside client components too.
//
// Honesty: a missing value renders "—" and an empty grey bar, never 0%.

import type { ReactNode } from "react";
import { fmtInt } from "@/components/oi/format";

type MeterTone = "success" | "warning" | "danger" | "info" | "neutral";

const BAR: Record<MeterTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground/60",
};
const TEXT: Record<MeterTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-foreground",
};

export function Meter({
  label,
  value,
  total,
  note,
  tone = "info",
  suffix,
}: {
  label: ReactNode;
  value: number | null | undefined;
  /** Without a total the row shows the count only (no bar). */
  total?: number | null;
  note?: ReactNode;
  tone?: MeterTone;
  suffix?: ReactNode;
}) {
  const has = value != null && Number.isFinite(value);
  const pct = has && total ? Math.min(1, (value as number) / total) : null;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0">{label}</span>
        <span className={`shrink-0 font-mono text-xs tabular-nums ${has ? TEXT[tone] : "text-muted-foreground"}`}>
          {has ? fmtInt(value) : "—"}
          {total ? <span className="text-muted-foreground"> / {fmtInt(total)}</span> : null}
          {pct != null && <span className="text-muted-foreground"> · {Math.round(pct * 100)}%</span>}
          {suffix}
        </span>
      </div>
      {total ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {pct != null && <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${(pct * 100).toFixed(1)}%` }} />}
        </div>
      ) : null}
      {note && <p className="mt-1 text-xs leading-snug text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Tone for a coverage share: ≥ good → success, ≥ warn → warning, else danger. */
export function shareTone(value: number | null | undefined, total: number | null | undefined, good = 0.7, warn = 0.4): MeterTone {
  if (value == null || !total) return "neutral";
  const s = value / total;
  return s >= good ? "success" : s >= warn ? "warning" : "danger";
}
