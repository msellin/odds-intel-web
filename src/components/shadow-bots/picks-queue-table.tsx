"use client";

// The Pick queue table (#139 IA move P6, 2026-09-24): the shared DataTable over buildPickRows()'s
// rows — search, filter chips (verdict · bot · market), sort, paging, CSV. The cells live
// in picks-row.tsx. With no sort chosen the rows keep buildPickRows' order: verdict band first
// (Place before Thin before Skip before Blocked), the lead bot's picks first inside a band, then
// kickoff — so the top of the table is always "what to place now".

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/oi/data-table";
import { PICK_VERDICT_RANK, type PickVerdict } from "@/lib/shadow-bots/verdict";
import { botShortLabel, formatPickLabel } from "@/lib/shadow-bots/labels";
import {
  ActionCell,
  BotCell,
  DecisionAgeCell,
  GateCell,
  KickoffCell,
  MatchCell,
  PickCell,
  pickRowClassName,
  PriceCell,
  ShownAgeCell,
  VERDICT_LABEL,
  VerdictCell,
  type PickRowData,
} from "@/components/shadow-bots/picks-row";

function marketGroup(market: string): string {
  const m = market.toLowerCase();
  if (m === "1x2") return "Match result";
  if (m === "1x2_1h") return "1st-half result";
  if (m.startsWith("over_under_")) return "Goals over/under";
  if (m === "btts") return "Both teams score";
  return market;
}

const columns: ColumnDef<PickRowData>[] = [
  {
    id: "kickoff",
    accessorFn: (r) => r.pick.kickoff,
    header: "Kickoff",
    cell: ({ row }) => <KickoffCell r={row.original} />,
    meta: { csv: (r) => r.pick.kickoff },
  },
  {
    id: "match",
    accessorFn: (r) => `${r.pick.home} v ${r.pick.away} · ${r.pick.country ?? ""} ${r.pick.league ?? ""}`,
    header: "Match",
    cell: ({ row }) => <MatchCell r={row.original} />,
    enableSorting: false,
    meta: { csv: (r) => `${r.pick.home} v ${r.pick.away}` },
  },
  {
    id: "market",
    accessorFn: (r) => marketGroup(r.pick.market),
    header: "Pick",
    cell: ({ row }) => <PickCell r={row.original} />,
    meta: { label: "Pick", csv: (r) => formatPickLabel(r.pick.market, r.pick.selection) },
  },
  {
    id: "bot",
    accessorFn: (r) => botShortLabel(r.pick.bot_name),
    header: "Bot",
    cell: ({ row }) => <BotCell r={row.original} />,
  },
  {
    id: "verdict",
    accessorFn: (r) => r.verdict.verdict,
    header: () => (
      <span title="Place = the price clears the bot's own bar and is fresh · Thin = above break-even but below the bar · Skip = too low, stale or no bettable price · Blocked = kickoff is under 3 minutes away">
        Verdict
      </span>
    ),
    cell: ({ row }) => <VerdictCell r={row.original} />,
    sortingFn: (a, b) => PICK_VERDICT_RANK[a.original.verdict.verdict] - PICK_VERDICT_RANK[b.original.verdict.verdict],
    meta: { label: "Verdict", csv: (r) => `${r.verdict.verdict} (${r.verdict.reason})` },
  },
  {
    id: "price",
    accessorFn: (r) => (r.inplay ? r.pick.odds_at_pick : (r.best?.odds ?? null)),
    header: () => <span title="The best price right now at a book we can actually bet at (CB = Coolbet, UB = Unibet)">Best price now</span>,
    cell: ({ row }) => <PriceCell r={row.original} />,
    sortUndefined: "last",
    meta: { align: "right", label: "Best price now" },
  },
  {
    id: "edge",
    accessorFn: (r) => (r.inplay ? null : r.verdict.liveEdge),
    header: () => <span title="The bot's chance minus the chance the price implies, at the price shown now">Edge now</span>,
    cell: ({ row }) => <GateCell r={row.original} kind="liveEdge" />,
    meta: { align: "right", label: "Edge now" },
  },
  {
    id: "_actions",
    header: "Action",
    cell: ({ row }) => <ActionCell r={row.original} />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "gateFloor",
    accessorFn: (r) => (r.inplay ? null : r.verdict.gateFloor),
    header: () => <span title="The lowest price the bot itself would bet at (its edge bar, raised to the placer's minimum odds)">Min price</span>,
    cell: ({ row }) => <GateCell r={row.original} kind="gateFloor" />,
    meta: { align: "right", label: "Min price" },
  },
  {
    id: "breakEven",
    accessorFn: (r) => (r.inplay ? null : r.verdict.breakEven),
    header: () => <span title="Below this price the bet loses money on the bot's own numbers">Break-even</span>,
    cell: ({ row }) => <GateCell r={row.original} kind="breakEven" />,
    meta: { align: "right", label: "Break-even" },
  },
  {
    id: "decision",
    accessorFn: (r) => r.pick.decision_quote_age_min,
    header: () => <span title="How old the price was when the bot decided. Old = over the engine's own freshness limit; the row is greyed.">Bot&apos;s price age</span>,
    cell: ({ row }) => <DecisionAgeCell r={row.original} />,
    meta: { align: "right", label: "Bot's price age (min)" },
  },
  {
    id: "shownAge",
    accessorFn: (r) => r.bestAgeMin,
    header: () => <span title="How old the price in 'Best price now' is">Price age</span>,
    cell: ({ row }) => <ShownAgeCell r={row.original} />,
    meta: { align: "right", label: "Price age (min)" },
  },
];

export function PicksQueueTable({ rows }: { rows: PickRowData[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Search team, league…"
      facets={[
        { column: "verdict", label: "Verdict", format: (v) => VERDICT_LABEL[v as PickVerdict] ?? v },
        { column: "bot", label: "Bot" },
        { column: "market", label: "Market" },
      ]}
      rowClassName={pickRowClassName}
      exportName="pick-queue"
      emptyText="No picks waiting — no active bot has a pending pick with a future kickoff."
      pageSize={50}
      dense
    />
  );
}

