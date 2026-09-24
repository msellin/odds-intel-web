"use client";

// /admin/ops (Jobs) chart (#139 admin redesign, 2026-09-24): failed job runs per day, 14 days
// (pipeline_runs keeps about two weeks). Client-side because recharts and the formatters cannot
// cross the server/client boundary.

import { ChartCard } from "@/components/oi/charts";
import { fmtInt } from "@/components/oi/format";
import type { FailDay } from "@/lib/admin-jobs";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function FailuresChart({ days, error, truncated }: { days: FailDay[]; error: string | null; truncated: boolean }) {
  return (
    <ChartCard
      title="Failed job runs per day"
      description="How many scheduled runs failed each day (bars), and how many different jobs they belong to. A tall bar with few jobs is one job failing over and over; today is still running."
      kind="bar"
      data={days as unknown as Record<string, number | string | null>[]}
      xKey="day"
      series={[
        { key: "failed", label: "Failed runs", color: "var(--color-danger)" },
        { key: "jobs", label: "Jobs with a failure", color: "var(--color-warning)" },
      ]}
      ranges={[
        { value: "7d", label: "7d", last: 7 },
        { value: "14d", label: "14d", last: 14 },
      ]}
      defaultRange="14d"
      xFmt={day}
      fmt={(v) => fmtInt(typeof v === "number" ? v : null)}
      height={260}
      empty={error ? `Unreadable: ${error}` : "No failed runs in this range."}
      footer={truncated ? "More than 5,000 failed runs in 14 days — only the newest 5,000 are counted, so older bars read low." : "Backfill micro-jobs are left out (they run every few minutes and would drown the rest)."}
    />
  );
}
