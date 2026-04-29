"use client";

import { useMemo } from "react";
import type { MatchSignalRow } from "@/lib/engine-data";

interface SignalTimelineProps {
  signals: MatchSignalRow[];
  homeTeam: string;
  awayTeam: string;
}

// Group signals by hour bucket to form "pipeline run" clusters
function bucketByHour(signals: MatchSignalRow[]): { label: string; iso: string; items: MatchSignalRow[] }[] {
  const buckets = new Map<string, { label: string; iso: string; items: MatchSignalRow[] }>();

  for (const sig of signals) {
    const d = new Date(sig.captured_at);
    const hourKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
    if (!buckets.has(hourKey)) {
      const timeLabel = d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Tallinn",
      });
      buckets.set(hourKey, { label: timeLabel, iso: sig.captured_at, items: [] });
    }
    buckets.get(hourKey)!.items.push(sig);
  }

  return Array.from(buckets.values());
}

function signalDisplayName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function valueDisplay(name: string, value: number): string {
  if (name.includes("pct") || name.includes("prob") || name.includes("implied")) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (name.includes("odds") || name === "overnight_line_move") {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(3)}`;
  }
  if (name.includes("count") || name.includes("days") || name.includes("rank") || name.includes("position")) {
    return Math.round(value).toString();
  }
  return value.toFixed(2);
}

const GROUP_COLORS: Record<string, string> = {
  market: "text-blue-400",
  quality: "text-green-400",
  context: "text-amber-400",
  injuries: "text-red-400",
  news: "text-violet-400",
};

export function SignalTimeline({ signals, homeTeam, awayTeam }: SignalTimelineProps) {
  const buckets = useMemo(() => bucketByHour(signals), [signals]);

  if (buckets.length === 0) return null;

  // Next pipeline run estimate: ~2h from last capture
  const lastCapture = signals[signals.length - 1]?.captured_at;
  const nextRun = lastCapture
    ? new Date(new Date(lastCapture).getTime() + 2 * 60 * 60 * 1000)
    : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
          Signal Timeline
        </h3>
        {nextRun && (
          <span className="text-[10px] text-muted-foreground/50">
            Next update ~{nextRun.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Tallinn" })}
          </span>
        )}
      </div>

      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-0 top-2 bottom-2 w-px bg-white/[0.08]" />

        <div className="space-y-4">
          {buckets.map((bucket) => (
            <div key={bucket.iso} className="relative">
              {/* Time dot */}
              <div className="absolute -left-4 top-1 size-2 rounded-full border border-white/[0.15] bg-muted" />

              <div className="text-[10px] font-bold text-muted-foreground/50 mb-1.5">
                {bucket.label}
              </div>

              <div className="space-y-1">
                {bucket.items.slice(0, 6).map((sig, i) => (
                  <div key={`${sig.signal_name}-${i}`} className="flex items-center justify-between gap-3">
                    <span className={`text-[11px] ${GROUP_COLORS[sig.signal_group] ?? "text-muted-foreground"}`}>
                      {signalDisplayName(sig.signal_name)}
                    </span>
                    <span className="font-mono text-[11px] text-foreground/70 tabular-nums">
                      {valueDisplay(sig.signal_name, sig.signal_value)}
                    </span>
                  </div>
                ))}
                {bucket.items.length > 6 && (
                  <span className="text-[10px] text-muted-foreground/40">
                    +{bucket.items.length - 6} more signals
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Upcoming marker */}
          {nextRun && (
            <div className="relative opacity-40">
              <div className="absolute -left-4 top-1 size-2 rounded-full border border-dashed border-white/[0.3] bg-transparent" />
              <div className="text-[10px] font-bold text-muted-foreground/50 mb-1">
                {nextRun.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Tallinn" })} (upcoming)
              </div>
              <p className="text-[10px] text-muted-foreground/40">
                Next pipeline run — odds refresh + late injury news
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground/40">
        {homeTeam} vs {awayTeam} · {signals.length} signal captures
      </p>
    </div>
  );
}
