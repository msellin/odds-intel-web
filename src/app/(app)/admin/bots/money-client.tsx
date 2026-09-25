"use client";

// Client half of the Real money view on /admin/bots (money-view.tsx; was /admin/real-bets, #139 P5,
// moved by #162 W6.8): the charts and the tables. Client-side because recharts,
// the DataTable and the formatter functions cannot cross the server/client boundary.

import type { ColumnDef } from "@tanstack/react-table";
import { ChartCard, type RangeOption } from "@/components/oi/charts";
import { DataTable } from "@/components/oi/data-table";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { fmtEur, fmtInt, fmtPct } from "@/components/oi/format";
import type { MoneyBet } from "@/lib/admin-money";
import { CONFIRM_LABEL, confirmState, marketGroup, marketLabel, moneyBotLabel, type ConfirmState } from "@/lib/admin-money-format";

/** Plain words for the bet ("Match result: Away", "Under 2.5 goals"); the raw codes stay in the tooltip and CSV. */
const betLabel = (b: MoneyBet) => marketLabel(b.market, b.selection);

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
  /** Display name (bots.display_name via prettyDisplayName). */
  bot: string;
  /** bots.name — secondary text, and a CSV column. */
  botId: string | null;
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
        description="Real money, settled bets only, by the day they settled, since the first real bet. The dashed line is what the same picks made on paper, where a real bet was placed from one."
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
          { key: "pnl", label: "Won or lost", color: "var(--color-success)", signed: true },
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
const CONFIRM_TONE: Record<ConfirmState, Tone> = { confirmed: "success", legacy: "neutral", waiting: "info", unconfirmed: "warning" };
const CONFIRM_TIP: Record<ConfirmState, string> = {
  confirmed: "Matched to a ticket on the bookmaker account.",
  legacy: "Logged before 10 Sep, when the account check did not exist yet — nothing to do.",
  waiting: "Logged by hand in the last 24 h; the account check has not had its chance yet.",
  unconfirmed: "Logged by hand more than 24 h ago and the account check found no matching ticket. Check it at the bookmaker.",
};

/** The bot's name in plain words. The id (bots.name) is hover text and a CSV column, never on screen. */
function BotName({ label, id }: { label: string; id: string | null }) {
  return (
    <div className="min-w-0 truncate text-xs" title={id ?? undefined}>
      {label}
    </div>
  );
}

function betColumns(now: number): ColumnDef<MoneyBet>[] {
  const confirmLabel = (b: MoneyBet) => CONFIRM_LABEL[confirmState(b, now)];
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
    {
      id: "bot",
      accessorFn: (b) => moneyBotLabel(b),
      header: "Bot",
      cell: ({ row }) => <BotName label={moneyBotLabel(row.original)} id={row.original.bot} />,
      // CSV keeps the id beside the name so an export can be joined back to the DB
      meta: { csv: (b) => (b.bot ? `${moneyBotLabel(b)} (${b.bot})` : moneyBotLabel(b)) },
    },
    // the facet chips read this accessor, so it is the plain group ("Handicap"), not the code
    { id: "market", accessorFn: (b) => marketGroup(b.market), header: "Market", cell: ({ row }) => <span className="whitespace-nowrap text-xs" title={`${row.original.market} · ${row.original.selection}`}>{betLabel(row.original)}</span>, meta: { csv: (b) => `${b.market} ${b.selection}` } },
    { id: "book", accessorFn: (b) => b.bookmaker, header: "Book", cell: ({ getValue }) => <span className="text-xs">{String(getValue())}</span> },
    { id: "odds", accessorFn: (b) => b.actualOdds, header: "Odds", meta: { align: "right" }, cell: ({ row }) => odds(row.original.actualOdds) },
    {
      id: "slip",
      accessorFn: (b) => b.slippagePct,
      header: () => <span>Price moved</span>,
      meta: { tip: "How much the price moved between the pick and placing the bet (slippage): price shown → price we got.", align: "right", label: "Price moved" },
      cell: ({ row }) => {
        const s = row.original.slippagePct;
        return <span title={`Price shown ${odds(row.original.capturedOdds)} → taken ${odds(row.original.actualOdds)}`}>{s == null ? "—" : fmtPct(s / 100)}</span>;
      },
    },
    {
      id: "edge",
      accessorFn: (b) => b.edgePctTaken,
      header: () => <span>Expected advantage</span>,
      meta: { tip: "The expected advantage (edge) at the price we took: our probability × odds − 1.", align: "right", label: "Expected advantage" },
      cell: ({ row }) => fmtPct(row.original.edgePctTaken),
    },
    {
      id: "clv",
      accessorFn: (b) => b.clv,
      header: () => <span>vs final price</span>,
      meta: { tip: "Price vs the final price (CLV): our odds ÷ the same bookmaker's last price before kickoff − 1. Above 0 = we got a better price than the final one. Blank when that bookmaker had no price within 60 min of kickoff.", align: "right", label: "vs final price" },
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
      header: () => <span>vs sharpest final</span>,
      meta: { tip: "Against the sharpest bookmaker's final price with its margin removed (Pinnacle closing-line value) — the strictest yardstick.", align: "right", label: "vs sharpest final" },
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
      header: "Profit",
      meta: { align: "right" },
      cell: ({ row }) => <span className={signTone(row.original.pnl)}>{row.original.result === "pending" ? "—" : fmtEur(row.original.pnl, { signed: true })}</span>,
    },
    {
      id: "confirmed",
      accessorFn: confirmLabel,
      header: () => <span>Confirmed</span>,
      meta: { tip: "Has the account check matched this bet to a ticket on the bookmaker account? Bets logged before 10 Sep are old entries — the check did not exist yet.", label: "Confirmed" },
      cell: ({ row }) => {
        const st = confirmState(row.original, now);
        return (
          <StatusBadge tone={CONFIRM_TONE[st]} dot={false} title={CONFIRM_TIP[st]}>
            {CONFIRM_LABEL[st]}
          </StatusBadge>
        );
      },
    },
  ];
}

/** `now` comes from the server render so the "waiting / not confirmed" split cannot differ on hydration. */
export function BetLogTable({ bets, now, exportName = "real-bets" }: { bets: MoneyBet[]; now: number; exportName?: string }) {
  return (
    <DataTable
      data={bets}
      columns={betColumns(now)}
      searchPlaceholder="Search match, league, bot…"
      facets={[
        { column: "bot", label: "Bot" },
        { column: "result", label: "Result", format: (v) => RESULT_LABEL[v] ?? v },
        { column: "market", label: "Market" },
        { column: "confirmed", label: "Confirmed" },
      ]}
      exportName={exportName}
      exportLabel="Export all real bets"
      emptyText="No real bets logged yet."
      dense
    />
  );
}

/** The reconciliation to-do: a short table, no paging, same columns. */
export function ToDoTable({ bets, now }: { bets: MoneyBet[]; now: number }) {
  return (
    <DataTable
      data={bets}
      columns={betColumns(now)}
      searchPlaceholder={null}
      pageSize={0}
      exportName="real-bets-unconfirmed"
      exportLabel="Export unconfirmed bets"
      maxHeight="40dvh"
      dense
    />
  );
}

export function BotMoneyTable({ rows }: { rows: BotMoneyRow[] }) {
  const cols: ColumnDef<BotMoneyRow>[] = [
    {
      accessorKey: "bot",
      header: "Bot",
      cell: ({ row }) => <BotName label={row.original.bot} id={row.original.botId} />,
      meta: { csv: (r) => (r.botId ? `${r.bot} (${r.botId})` : r.bot) },
    },
    { accessorKey: "bets", header: "Bets", meta: { align: "right" }, cell: ({ getValue }) => fmtInt(getValue() as number) },
    { accessorKey: "open", header: "Open", meta: { align: "right" }, cell: ({ getValue }) => ((getValue() as number) > 0 ? fmtInt(getValue() as number) : "—") },
    { accessorKey: "staked", header: "Staked (settled)", meta: { align: "right" }, cell: ({ getValue }) => fmtEur(getValue() as number) },
    {
      accessorKey: "pnl",
      header: "Profit",
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
      header: () => <span>vs final price</span>,
      meta: { tip: "Average price vs the final price (closing-line value) at the bookmaker we bet at, all time. Greyed under 30 bets — too few to trust.", align: "right", label: "vs final price" },
      cell: ({ row }) => (
        <span className={row.original.clvN < 30 ? "text-muted-foreground" : signTone(row.original.clv)} title={row.original.clvN < 30 ? "Too few bets to trust" : undefined}>
          {fmtPct(row.original.clv)}
          <span className="ml-1 text-[10px] text-muted-foreground">({fmtInt(row.original.clvN)} {row.original.clvN === 1 ? "bet" : "bets"})</span>
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
  return <DataTable data={rows} columns={cols} searchPlaceholder="Search bots…" pageSize={0} exportName="real-bets-by-bot" exportLabel="Export results by bot" initialSort={[{ id: "bets", desc: true }]} />;
}

export function DailyTable({ rows }: { rows: DailyRow[] }) {
  const cols: ColumnDef<DailyRow>[] = [
    { accessorKey: "day", header: "Day (UTC)", cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span> },
    { accessorKey: "bets", header: "Bets", meta: { align: "right" } },
    { accessorKey: "settled", header: "Settled", meta: { align: "right" } },
    { accessorKey: "staked", header: "Staked", meta: { align: "right" }, cell: ({ getValue }) => fmtEur(getValue() as number) },
    {
      accessorKey: "pnl",
      header: "Profit",
      meta: { align: "right" },
      cell: ({ row }) => <span className={signTone(row.original.pnl)}>{row.original.settled > 0 ? fmtEur(row.original.pnl, { signed: true }) : "—"}</span>,
    },
    { accessorKey: "roi", header: "Return", meta: { align: "right" }, cell: ({ row }) => fmtPct(row.original.roi) },
  ];
  return <DataTable data={rows} columns={cols} searchPlaceholder={null} pageSize={0} exportName="real-bets-daily" exportLabel="Export day by day" maxHeight="50dvh" dense />;
}
