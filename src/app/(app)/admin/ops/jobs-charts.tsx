"use client";

// /admin/ops (Jobs) chart (#139 admin redesign, 2026-09-24): failed job runs per day, 14 days, split
// fixed-later (grey) vs still failing (red). Round 6 (2026-09-25): the title carries its period
// ("· last 14 days", via the range's `long`).
// (pipeline_runs keeps about two weeks). Client-side because recharts and the formatters cannot
// cross the server/client boundary.

import { ChartCard } from "@/components/oi/charts";
import { fmtInt } from "@/components/oi/format";
import type { FailDay } from "@/lib/admin-jobs";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function FailuresChart({ days, error, truncated }: { days: FailDay[]; error: string | null; truncated: boolean }) {
  // Answer-first fix round (2026-09-25): red bars every day beside "1 job failing" read as a
  // fortnight of outage. Most failed runs succeed on their next try, so they are grey; red is only a
  // run that is still part of a job's current failure.
  return (
    <ChartCard
      title="Failed runs per day"
      description="Scheduled runs that failed each day. Grey: the job worked again on a later run — nothing to do. Red: part of a job that is still failing now (see the list below). Today is still running."
      kind="bar"
      stacked
      data={days as unknown as Record<string, number | string | null>[]}
      xKey="day"
      series={[
        { key: "fixed", label: "Fixed on a later run", color: "var(--muted-foreground)" },
        { key: "still", label: "Still failing", color: "var(--color-danger)" },
      ]}
      ranges={[
        { value: "7d", label: "7d", last: 7, long: "last 7 days" },
        { value: "14d", label: "14d", last: 14, long: "last 14 days" },
      ]}
      defaultRange="14d"
      xFmt={day}
      fmt={(v) => fmtInt(typeof v === "number" ? v : null)}
      height={240}
      empty={error ? `Unreadable: ${error}` : "No failed runs in this range."}
      footer={truncated ? "More than 5,000 failed runs in 14 days — only the newest 5,000 are counted, so older bars read low." : "Frequent small fill-in jobs are left out (they run every few minutes and would drown the rest)."}
    />
  );
}
