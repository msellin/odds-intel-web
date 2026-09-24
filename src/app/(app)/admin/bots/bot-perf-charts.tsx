"use client";

// Bot sheet → Performance tab charts (#139 design system §6, 2026-09-24): weekly CLV on the
// family's ONE admissible metric, and cumulative flat-stake P/L in units. Both from bot_weekly
// (migration 411), the same 12 ISO weeks as the row's strip. Client-side because recharts and the
// formatters cannot cross the server/client boundary.
//
// Honesty: a week with fewer than 5 measured picks is a GAP, never a point (a two-pick week can
// read ±20% and means nothing). In-play bots get NO CLV chart — there is no closing line; they
// are judged on lift — and the tab says so instead of drawing an empty axis.

import { ChartCard } from "@/components/oi/charts";
import type { BotWeeklyRow } from "@/lib/bot-board";
import { METRIC_LABEL, METRIC_SHORT, weekStart, type BotView } from "./bot-board-model";

const RANGES = [
  { value: "4w", label: "4w", last: 4 },
  { value: "8w", label: "8w", last: 8 },
  { value: "12w", label: "12w", last: 12 },
];
const MIN_WEEK_N = 5;
const MINUS = "−";

const wk = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const signed = (v: number, dp: number, unit: string) => `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v).toFixed(dp)}${unit}`;
const num = (v: number | string | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function BotPerfCharts({ v, weekly }: { v: BotView; weekly: BotWeeklyRow[] | null }) {
  const metric = v.metric.metric;
  const inplay = metric === "lift" || v.family === "inplay";
  const weeks = v.weeks;

  if (!weeks || weekly == null) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
        Weekly figures unavailable (view <code>bot_weekly</code>, migration 411, could not be read) — no charts.
      </p>
    );
  }

  const byWeek = new Map<number, BotWeeklyRow>();
  for (const r of weekly) byWeek.set(weekStart(new Date(r.week).getTime()), r);
  const data: { week: string; clv: number | null; n: number; pnl: number; cum: number; settled: number }[] = [];
  for (const w of weeks) {
    const r = byWeek.get(w.start);
    const raw = Number(r?.pnl_unit ?? 0);
    const pnl = Number.isFinite(raw) ? raw : 0;
    const prev = data.length ? data[data.length - 1].cum : 0;
    data.push({
      week: new Date(w.start).toISOString().slice(0, 10),
      clv: !inplay && w.clvN >= MIN_WEEK_N && w.clvMean != null ? w.clvMean * 100 : null,
      n: w.clvN,
      pnl: Math.round(pnl * 100) / 100,
      cum: Math.round((prev + pnl) * 100) / 100,
      settled: Number(r?.settled ?? 0),
    });
  }
  const cum = data.length ? data[data.length - 1].cum : 0;
  const anySettled = data.some((d) => d.settled > 0);
  const measuredWeeks = data.filter((d) => d.clv != null).length;
  const clvEmpty =
    weeks.some((w) => w.clvN > 0)
      ? `No week has ${MIN_WEEK_N} or more measured picks yet — too few to plot.`
      : `No measured ${METRIC_SHORT[metric]} in the last 12 weeks.`;

  return (
    <div className="space-y-3">
      {inplay ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          No CLV chart: in-play picks have no closing line, so this bot is judged on lift (hit rate against the
          de-vigged price), which is not computed yet.
        </p>
      ) : (
        <ChartCard
          title={`Weekly ${METRIC_SHORT[metric]}`}
          description={`${METRIC_LABEL[metric]}. Above zero = we priced better than the close.`}
          kind="line"
          data={data}
          xKey="week"
          series={[{ key: "clv", label: METRIC_SHORT[metric], color: "var(--color-method-model)" }]}
          ranges={RANGES}
          defaultRange="12w"
          xFmt={wk}
          // The smallest range that holds every point AND zero (= the close): a CLV axis without
          // zero reads as "fine" when every week is negative. 1-decimal ticks — whole-percent ticks
          // repeated ("−2%, −2%") on a narrow range. The dashed zero SERIES this replaces drew dots.
          yDomain={[(m: number) => Math.min(0, m), (M: number) => Math.max(0, M)]}
          yFmt={(y) => signed(y, 1, "%")}
          zeroLine
          fmt={(val) => (num(val) == null ? "—" : signed(num(val) as number, 1, "%"))}
          height={200}
          empty={clvEmpty}
          footer={`Weeks with fewer than ${MIN_WEEK_N} measured picks are gaps, not zeros (${measuredWeeks} of 12 weeks plotted). The verdict uses all measured picks, not these weekly points.`}
        />
      )}
      <ChartCard
        title="Cumulative P/L · flat stake"
        description="1 unit on every pick, so bots compare fairly — not the real staking."
        kind="area"
        data={data}
        xKey="week"
        series={[{ key: "cum", label: "Cumulative P/L", color: cum >= 0 ? "var(--color-success)" : "var(--color-danger)" }]}
        ranges={RANGES}
        defaultRange="12w"
        xFmt={wk}
        yFmt={(y) => signed(y, 1, "u")}
        fmt={(val) => (num(val) == null ? "—" : signed(num(val) as number, 1, "u"))}
        zeroLine
        height={200}
        empty={anySettled ? "Flat so far — every settled pick netted zero." : "No settled picks in the last 12 weeks."}
        footer="By the week the pick was made; a pick counts 0 until it settles. Starts at 0 twelve weeks ago — the all-time ROI is on the Overview tab. P/L is noisy: at a few hundred picks it cannot tell skill from luck, CLV can."
      />
    </div>
  );
}
