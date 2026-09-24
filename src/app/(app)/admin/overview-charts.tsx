"use client";

// The Overview's interactive charts (#139, owner 2026-09-24: "graphs, bars, columns"). Client-side
// because recharts and the formatters (functions) cannot cross the server/client boundary.

import { ChartCard, DonutCard, type Series, type Slice } from "@/components/oi/charts";
import { FAMILY_INFO, type Verdict } from "./bots/bot-board-model";
import type { OverviewData } from "@/lib/admin-overview";
import { RETIRED_SERIES } from "@/lib/admin-overview-shared";
import { fmtEur, fmtInt, fmtPct } from "@/components/oi/format";

// Family colours: the /picks method hue per method (sharp = violet, consensus = teal, model = sky);
// the second family of a method is the same hue at a clearly different lightness, so the two can
// be told apart in a stacked bar without breaking the "one hue per method" rule.
const FAMILY_COLOR: Record<string, string> = {
  forward_test: "var(--color-method-consensus)",
  // UX test 2026-09-24: the two sharp and the two model families were hard to tell apart —
  // same method hue, but now far apart in lightness AND nudged in hue.
  sharp_trigger: "oklch(0.80 0.12 295)",
  sharp_generator: "oklch(0.55 0.23 325)",
  model_shadow: "oklch(0.80 0.11 225)",
  model_sim: "oklch(0.52 0.19 262)",
  inplay: "var(--chart-3)",
  unknown: "var(--chart-5)",
  [RETIRED_SERIES]: "oklch(0.40 0.01 260)",
};
const familyLabel = (f: string) => (f === RETIRED_SERIES ? "Retired bots" : FAMILY_INFO[f]?.title ?? f);

/** The smallest range that still contains every week with data (so a chart is not 3/4 empty). */
function fitRange(rows: Record<string, number | string | null>[], keys: string[]): string {
  const first = rows.findIndex((r) => keys.some((k) => r[k] != null && r[k] !== 0));
  const span = first < 0 ? 12 : rows.length - first;
  return span <= 4 ? "4w" : span <= 8 ? "8w" : "12w";
}
const ZERO_IN_VIEW: [(m: number) => number, (M: number) => number] = [(m) => Math.min(0, m), (M) => Math.max(0, M)];

const RANGES = [
  { value: "4w", label: "4w", last: 4 },
  { value: "8w", label: "8w", last: 8 },
  { value: "12w", label: "12w", last: 12 },
];

const wk = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const num = (v: number | string | null | undefined) => (typeof v === "number" ? v : null);
const pct = (v: number | string | null | undefined) => fmtPct(num(v));
const eur = (v: number | string | null | undefined) => fmtEur(num(v));
const units = (v: number | string | null | undefined) => (typeof v === "number" ? `${v > 0 ? "+" : v < 0 ? "\u2212" : ""}${Math.abs(v).toFixed(1)}u` : "—");

const VERDICT_SLICES: { key: Verdict; label: string; color: string }[] = [
  { key: "beats", label: "Beats the closing price", color: "var(--color-success)" },
  { key: "loses", label: "Worse than the closing price", color: "var(--color-danger)" },
  { key: "inconclusive", label: "Can't tell yet", color: "var(--color-warning)" },
  { key: "early", label: "Too early (under 30 picks)", color: "var(--color-info)" },
  { key: "noclv", label: "In-play (no closing price)", color: "var(--muted-foreground)" },
];

export function OverviewCharts({ d }: { d: OverviewData }) {
  const famSeries: Series[] = d.families.map((f) => ({ key: f, label: familyLabel(f), color: FAMILY_COLOR[f] ?? "var(--chart-5)" }));
  const clvSeries: Series[] = d.clvFamilies.map((f) => ({ key: f, label: familyLabel(f), color: FAMILY_COLOR[f] ?? "var(--chart-5)" }));
  const feedCount = (s: string) => d.feeds.rows.filter((f) => f.status === s).length;
  // stale status check: show every feed as Unknown, never a green "fresh" (same rule as /admin/feeds)
  const feedCountRaw = feedCount;
  const staleCount = (s: string) => (s === "unknown" ? d.feeds.rows.length : 0);
  const fc = d.feedsStale ? staleCount : feedCountRaw;
  const feedSlices: Slice[] = [
    { key: "ok", label: "Fresh", value: fc("ok"), color: "var(--color-success)", href: "/admin/feeds" },
    { key: "warn", label: "Needs a look", value: fc("warn"), color: "var(--color-warning)", href: "/admin/feeds" },
    { key: "fail", label: "Stopped", value: fc("fail"), color: "var(--color-danger)", href: "/admin/feeds" },
    { key: "paused", label: "Paused", value: fc("paused"), color: "var(--color-info)", href: "/admin/feeds" },
    { key: "unknown", label: "Unknown", value: fc("unknown"), color: "var(--muted-foreground)", href: "/admin/feeds" },
  ];
  const verdictSlices: Slice[] = VERDICT_SLICES.map((s) => ({ ...s, value: d.bots.verdicts[s.key], href: "/admin/bots" }));
  const beats = d.bots.verdicts.beats;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Picks per week, by bot family"
            description="Every active bot, whichever ledger it writes. Pre-registered tests count their current rule only. This week is still running. Turn on “Retired bots” in the legend to see picks from bots retired since."
            kind="bar"
            stacked
            data={d.picksByFamily}
            xKey="week"
            series={famSeries}
            defaultHidden={[RETIRED_SERIES]}
            ranges={RANGES}
            defaultRange={fitRange(d.picksByFamily, d.families.filter((f) => f !== RETIRED_SERIES))}
            xFmt={wk}
            fmt={(v) => fmtInt(num(v))}
            height={280}
          />
        </div>
        <DonutCard
          title="Bot verdicts"
          description="Does each active bot get better prices than the market closes at? Same rule as /admin/bots."
          slices={verdictSlices}
          center={`${beats}/${d.bots.active}`}
          centerLabel="beat the close"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="Are our prices better than the closing price?"
            description="Each week, how much better (above 0) or worse (below 0) than the closing price the active pre-match bots of each family got — the fairest single test of a betting edge. Weeks with fewer than 5 closing prices are left blank."
            kind="line"
            data={d.clvByFamily}
            xKey="week"
            series={clvSeries}
            ranges={RANGES}
            defaultRange={fitRange(d.clvByFamily, d.clvFamilies)}
            xFmt={wk}
            yFmt={(v) => fmtPct(v, 1)}
            yDomain={ZERO_IN_VIEW}
            fmt={pct}
            zeroLine
            height={260}
            footer="Margin-corrected CLV, weighted by picks within a family (high-volume bots weigh more). Model · simulated bots are judged on Pinnacle's price instead and in-play bots have no closing price, so neither is drawn. This week is still running."
          />
        </div>
        <DonutCard title="Feeds right now" description="Every odds sweeper and data feed, checked every 5 minutes." slices={feedSlices} center={d.feedsStale ? "?" : `${feedCount("ok")}/${d.feeds.rows.length}`} centerLabel={d.feedsStale ? "status check stale" : "fresh"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Flat-stake P/L, cumulative, by family"
          description="Running total since 12 weeks ago, as if we bet 1 unit on every settled pick of today's active bots. Units, not money. “Retired bots” can be turned on in the legend."
          kind="area"
          data={d.pnlByFamily}
          xKey="week"
          series={famSeries}
          defaultHidden={[RETIRED_SERIES]}
          ranges={RANGES}
          defaultRange={fitRange(d.pnlByFamily, d.families.filter((f) => f !== RETIRED_SERIES))}
          xFmt={wk}
          fmt={units}
          yDomain={ZERO_IN_VIEW}
          yFmt={(v) => `${v.toFixed(0)}u`}
          zeroLine
          height={260}
        />
        <ChartCard
          title="Real bets per week"
          description="What we actually staked, and won or lost, in euros. Profit counts settled bets only."
          kind="bar"
          data={d.realBets.rows as unknown as Record<string, number | string | null>[]}
          xKey="week"
          series={[
            { key: "staked", label: "Staked", color: "var(--chart-2)" },
            { key: "pnl", label: "P/L (green win · red loss)", color: "var(--color-success)", signed: true },
          ]}
          ranges={RANGES}
          defaultRange="12w"
          xFmt={wk}
          fmt={eur}
          yFmt={(v) => fmtEur(v)}
          zeroLine
          height={260}
          empty={d.realBets.error ? `Unreadable: ${d.realBets.error}` : "No real bets in this range — placement is paused."}
        />
      </div>
    </>
  );
}
