"use client";

// /admin/feeds chart (#139 admin redesign, 2026-09-24): coverage per book, today vs yesterday.
// feed_book_stats keeps ONLY today and yesterday (the engine rewrites it every 5 min), so there is
// no longer history to draw — the chart says so rather than pretending to be a trend. Client-side
// because recharts and the formatters cannot cross the server/client boundary.

import { ChartCard } from "@/components/oi/charts";
import type { FeedBookStats } from "@/lib/engine-data";

const BOOK_LABEL: Record<string, string> = {
  "Unibet-Site": "Unibet",
  "Betfair-Exchange": "Betfair",
  Pinnacle: "Sharpest book",
};
const ORDER = ["Coolbet", "Epicbet", "Unibet-Site", "Tonybet", "Betfair-Exchange", "Pinnacle"];

const rank = (b: string) => (ORDER.includes(b) ? ORDER.indexOf(b) : ORDER.length);
const share = (n: number | null | undefined, d: number | null | undefined) => (d ? Math.round((1000 * (n ?? 0)) / d) / 10 : null);
const pct = (v: number | string | null | undefined) => (typeof v === "number" ? `${v.toFixed(0)}%` : "—");

export function CoverageChart({ books, error }: { books: FeedBookStats[]; error: string | null }) {
  const data = [...books]
    .sort((a, b) => rank(a.book) - rank(b.book))
    .map((b) => ({
      book: BOOK_LABEL[b.book] ?? b.book,
      today: share(b.priced_today, b.fixtures_today),
      yesterday: share(b.priced_yesterday, b.fixtures_yesterday),
    }));
  const fx = books[0];
  return (
    <ChartCard
      title="Coverage per book, today vs yesterday"
      description={`Share of the day's matches each book priced at least once${fx?.fixtures_today ? ` (${fx.fixtures_today} matches today, ${fx.fixtures_yesterday ?? "?"} yesterday)` : ""}. Only these two days are kept, so this is a comparison, not a trend.`}
      kind="bar"
      data={data}
      xKey="book"
      series={[
        { key: "yesterday", label: "Yesterday", color: "var(--chart-2)" },
        { key: "today", label: "Today (so far)", color: "var(--color-method-consensus)" },
      ]}
      fmt={pct}
      yFmt={(v) => `${v}%`}
      height={260}
      empty={error ? `Unreadable: ${error}` : "No coverage numbers yet — the engine writes them every 5 minutes."}
      footer="The sharpest book (Pinnacle) comes through API-Football. Betfair counts every match the exchange lists, including ones with little money on them — its block's details show the usable ones."
    />
  );
}
