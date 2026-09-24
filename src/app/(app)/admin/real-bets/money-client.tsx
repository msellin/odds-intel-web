"use client";

// Client half of /admin/real-bets (#139 P5): the charts and the tables. Client-side because recharts,
// the DataTable and the formatter functions cannot cross the server/client boundary.

import type { ColumnDef } from "@tanstack/react-table";
import { ChartCard, type RangeOption } from "@/components/oi/charts";
import { DataTable } from "@/components/oi/data-table";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { fmtEur, fmtInt, fmtPct } from "@/components/oi/format";
import type { MoneyBet } from "@/lib/admin-money";

export interface DayPoint {
  day: string;
  real: number | null;
  paper: number | null;
  [k: string]: string | number | null;
}
export interface WeekPoint {
  week: string;
  staked: number;
  pnl: number;
  bets: number;
  [k: string]: string | number | null;
}
export interface BotMoneyRow {
  bot: string;
  bets: number;
  settled: number;
  open: number;
  staked: number;
  pnl: number;
  roi: number | null;
  clv: number | null;
  clvN: number;
  won: number;
  lost: number;
}
export interface DailyRow {
  day: string;
  bets: number;
  settled: number;
  staked: number;
  pnl: number;
  roi: number | null;
}

const num = (v: number | string | null | undefined) => (typeof v === "number" ? v : null);
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const odds = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));
const signTone = (v: number | null | undefined) => (v == null || v === 0 ? "" : v > 0 ? "text-success" : "text-danger");

export function MoneyCharts({ daily, weekly }: { daily: DayPoint[]; weekly: WeekPoint[] }) {
  const dayRanges: RangeOption[] = [
    { value: "30d", label: "30d", last: 30 },
    { value: "90d", label: "90d", last: 90 },
    { value: "all", label: "All", last: Math.max(1, daily.length) },
  ];
  const weekRanges: RangeOption[] = [
    { value: "8w", label: "8w", last: 8 },
    { value: "26w", label: "26w", last: 26 },
    { value: "all", label: "All", last: Math.max(1, weekly.length) },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <ChartCard
        title="Profit and loss, running total"
        description="Real money, settled bets only, by the day they settled. The dashed line is what the same picks made on paper, where a real bet was placed from one."
        kind="line"
        data={daily}
        xKey="day"
        series={[
          { key: "real", label: "Real money", color: "var(--chart-3)" },
          { key: "paper", label: "Same picks on paper", color: "var(--chart-2)", dashed: true },
        ]}
        ranges={dayRanges}
        defaultRange="all"
        xFmt={dayLabel}
        fmt={(v) => fmtEur(num(v), { signed: true })}
        yFmt={(v) => fmtEur(v)}
        zeroLine
        height={260}
        empty="No settled real bets in this range."
      />
      <ChartCard
        title="Staked and won or lost, per week"
        description="Weeks start on Monday (UTC), grouped by when the bet was placed. Profit counts the settled bets of that week; this week is still running."
        kind="bar"
        data={weekly}
        xKey="week"
        series={[
          { key: "staked", label: "Staked", color: "var(--chart-2)" },
          { key: "pnl", label: "P/L (green win · red loss)", color: "var(--color-success)", signed: true },
        ]}
        ranges={weekRanges}
        defaultRange="26w"
        xFmt={dayLabel}
        fmt={(v, k) => fmtEur(num(v), { signed: k === "pnl" })}
        yFmt={(v) => fmtEur(v)}
        zeroLine
        height={260}
        empty="No real bets in this range."
      />
    </div>
  );
}

const RESULT_TONE: Record<string, Tone> = { won: "success", lost: "danger", void: "neutral", pending: "info" };
const RESULT_LABEL: Record<string, string> = { won: "Won", lost: "Lost", void: "Void", pending: "Open" };
const confirmLabel = (b: MoneyBet) => (b.placedReal === true ? "Confirmed on the account" : "Logged by hand, not confirmed");

function betColumns(): ColumnDef<MoneyBet>[] {
  return [
    {
      id: "placed",
      accessorFn: (b) => b.placedAt,
      header: "Placed (UTC)",
      cell: ({ row }) => <span className="whitespace-nowrap text-xs">{when(row.original.placedAt)}</span>,
      meta: { csv: (b) => b.placedAt },
    },
    {
      id: "match",
      accessorFn: (b) => `${b.match} ${b.league}`,
      header: "Match",
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <div className="truncate">{row.original.match}</div>
          <div className="truncate text-xs text-muted-foreground">{row.original.league}</div>
        </div>
      ),
      meta: { csv: (b) => b.match },
    },
    { id: "bot", accessorFn: (b) => b.bot ?? "(no bot)", header: "Bot", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
    { id: "market", accessorFn: (b) => b.market, header: "Market", cell: ({ row }) => <span className="whitespace-nowrap text-xs">{row.original.market} · {row.original.selection}</span>, meta: { csv: (b) => `${b.market} ${b.selection}` } },
    { id: "book", accessorFn: (b) => b.bookmaker, header: "Book", cell: ({ getValue }) => <span className="text-xs">{String(getValue())}</span> },
    { id: "odds", accessorFn: (b) => b.actualOdds, header: "Odds", meta: { align: "right" }, cell: ({ row }) => odds(row.original.actualOdds) },
    {
      id: "slip",
      accessorFn: (b) => b.slippagePct,
      header: "Slip",
      meta: { align: "right", label: "Slippage" },
      cell: ({ row }) => {
        const s = row.original.slippagePct;
        return <span title={`Price shown ${odds(row.original.capturedOdds)} → taken ${odds(row.original.actualOdds)}`}>{s == null ? "—" : fmtPct(s / 100)}</span>;
      },
    },
    {
      id: "edge",
      accessorFn: (b) => b.edgePctTaken,
      header: () => <span title="The edge at the price we took: our probability × odds − 1">Edge</span>,
      meta: { align: "right", label: "Edge" },
      cell: ({ row }) => fmtPct(row.original.edgePctTaken),
    },
    {
      id: "clv",
      accessorFn: (b) => b.clv,
      header: () => <span title="Did we beat the price the same book closed at? (our odds ÷ its last price before kickoff) − 1. Blank when that book had no price within 60 min of kickoff.">CLV</span>,
      meta: { align: "right", label: "CLV" },
      cell: ({ row }) => {
        const b = row.original;
        return (
          <span className={signTone(b.clv)} title={b.closingBookmaker ? `Close at ${b.closingBookmaker}, ${b.closingMinutesBeforeKo ?? "?"} min before kickoff` : undefined}>
            {fmtPct(b.clv)}
          </span>
        );
      },
    },
    {
      id: "clvPin",
      accessorFn: (b) => b.clvPinnacle,
      header: () => <span title="Against Pinnacle's fair closing price (margin removed) — the sharpest yardstick.">Pinnacle CLV</span>,
      meta: { align: "right", label: "Pinnacle CLV" },
      cell: ({ row }) => <span className={signTone(row.original.clvPinnacle)}>{fmtPct(row.original.clvPinnacle)}</span>,
    },
    { id: "stake", accessorFn: (b) => b.stake, header: "Stake", meta: { align: "right" }, cell: ({ row }) => fmtEur(row.original.stake) },
    {
      id: "result",
      accessorFn: (b) => b.result,
      header: "Result",
      cell: ({ row }) => <StatusBadge tone={RESULT_TONE[row.original.result] ?? "neutral"}>{RESULT_LABEL[row.original.result] ?? row.original.result}</StatusBadge>,
    },
    {
      id: "pnl",
      accessorFn: (b) => b.pnl,
      header: "P/L",
      meta: { align: "right" },
      cell: ({ row }) => <span className={signTone(row.original.pnl)}>{row.original.result === "pending" ? "—" : fmtEur(row.original.pnl, { signed: true })}</span>,
    },
    {
      id: "confirmed",
      accessorFn: confirmLabel,
      header: "Confirmed",
      cell: ({ row }) =>
        row.original.placedReal === true ? (
          <StatusBadge tone="success" dot={false}>
            Confirmed
          </StatusBadge>
        ) : (
          <StatusBadge tone="warning" dot={false} title="Logged by hand; the account check has not matched it to a ticket yet.">
            By hand
          </StatusBadge>
        ),
    },
  ];
}

export function BetLogTable({ bets, exportName = "real-bets" }: { bets: MoneyBet[]; exportName?: string }) {
  return (
    <DataTable
      data={bets}
      columns={betColumns()}
      searchPlaceholder="Search match, league, bot…"
      facets={[
        { column: "bot", label: "Bot" },
        { column: "result", label: "Result", format: (v) => RESULT_LABEL[v] ?? v },
        { column: "market", label: "Market" },
        { column: "confirmed", label: "Confirmed" },
      ]}
      exportName={exportName}
      emptyText="No real bets logged yet."
      dense
    />
  );
}

/** The reconciliation to-do: a short table, no paging, same columns. */
export function ToDoTable({ bets }: { bets: MoneyBet[] }) {
  return <DataTable data={bets} columns={betColumns()} searchPlaceholder={null} pageSize={0} exportName="real-bets-unconfirmed" maxHeight="40dvh" dense />;
}

export function BotMoneyTable({ rows }: { rows: BotMoneyRow[] }) {
  const cols: ColumnDef<BotMoneyRow>[] = [
    { accessorKey: "bot", header: "Bot", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
    { accessorKey: "bets", header: "Bets", meta: { align: "right" }, cell: ({ getValue }) => fmtInt(getValue() as number) },
    { accessorKey: "open", header: "Open", meta: { align: "right" }, cell: ({ getValue }) => ((getValue() as number) > 0 ? fmtInt(getValue() as number) : "—") },
    { accessorKey: "staked", header: "Staked (settled)", meta: { align: "right" }, cell: ({ getValue }) => fmtEur(getValue() as number) },
    {
      accessorKey: "pnl",
      header: "P/L",
      meta: { align: "right" },
      cell: ({ row }) => <span className={signTone(row.original.pnl)}>{row.original.settled > 0 ? fmtEur(row.original.pnl, { signed: true }) : "—"}</span>,
    },
    {
      accessorKey: "roi",
      header: "Return",
      meta: { align: "right", label: "Return on stake" },
      cell: ({ row }) => <span className={signTone(row.original.roi)}>{fmtPct(row.original.roi)}</span>,
    },
    {
      accessorKey: "clv",
      header: () => <span title="Average closing-line value at the book we bet at. Under 30 bets it is too few to trust.">Avg CLV</span>,
      meta: { align: "right", label: "Avg CLV" },
      cell: ({ row }) => (
        <span className={row.original.clvN < 30 ? "text-muted-foreground" : signTone(row.original.clv)} title={`${row.original.clvN} bets with a closing price${row.original.clvN < 30 ? " — too few to trust" : ""}`}>
          {fmtPct(row.original.clv)}
          <span className="ml-1 text-[10px] text-muted-foreground">n={row.original.clvN}</span>
        </span>
      ),
    },
    {
      id: "wl",
      accessorFn: (r) => `${r.won}/${r.lost}`,
      header: "Won / lost",
      meta: { align: "right" },
      enableSorting: false,
    },
  ];
  return <DataTable data={rows} columns={cols} searchPlaceholder="Search bots…" pageSize={0} exportName="real-bets-by-bot" initialSort={[{ id: "bets", desc: true }]} />;
}

export function DailyTable({ rows }: { rows: DailyRow[] }) {
  const cols: ColumnDef<DailyRow>[] = [
    { accessorKey: "day", header: "Day (UTC)", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
    { accessorKey: "bets", header: "Bets", meta: { align: "right" } },
    { accessorKey: "settled", header: "Settled", meta: { align: "right" } },
    { accessorKey: "staked", header: "Staked", meta: { align: "right" }, cell: ({ getValue }) => fmtEur(getValue() as number) },
    {
      accessorKey: "pnl",
      header: "P/L",
      meta: { align: "right" },
      cell: ({ row }) => <span className={signTone(row.original.pnl)}>{row.original.settled > 0 ? fmtEur(row.original.pnl, { signed: true }) : "—"}</span>,
    },
    { accessorKey: "roi", header: "Return", meta: { align: "right" }, cell: ({ row }) => fmtPct(row.original.roi) },
  ];
  return <DataTable data={rows} columns={cols} searchPlaceholder={null} pageSize={0} exportName="real-bets-daily" maxHeight="50dvh" dense />;
}
