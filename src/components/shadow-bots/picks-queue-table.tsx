"use client";

// The Pick queue table (#139 IA move P6, 2026-09-24): the shared DataTable over buildPickRows()'s
// rows — search, filter chips (verdict · bot · market), sort, paging, CSV. The cells live
// in picks-row.tsx. With no sort chosen the rows keep buildPickRows' order: verdict band first
// (Place before Thin before Skip before Blocked), pre-match before in-play, the lead bot's picks
// first inside a band, then the higher edge, then kickoff — so the top of the table is always
// "what to place now". One row per match + market + selection; the other bots that raised it
// are listed in the Bot cell. In-play rows (never placeable) are hidden until the "Show in-play"
// chip is pressed. The Action column is the LAST column and sticky, so it is visible at every width.

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/oi/data-table";
import { PICK_VERDICT_RANK, type PickVerdict } from "@/lib/shadow-bots/verdict";
import { formatPickLabel } from "@/lib/shadow-bots/labels";
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
  VERDICT_LABEL,
  reasonText,
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
    // every grouped bot's name is searchable, not only the row's lead bot
    accessorFn: (r) =>
      `${r.pick.home} v ${r.pick.away} · ${r.pick.country ?? ""} ${r.pick.league ?? ""} · ${[r, ...r.siblings].map((s) => s.botLabel).join(" ")}`,
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
    id: "verdict",
    accessorFn: (r) => r.verdict.verdict,
    header: () => (
      <span title="Place = the price clears the bot's own bar and is fresh · Thin = above break-even but below the bar · Skip = too low, stale or no bettable price · Blocked = kickoff is under 3 minutes away">
        Verdict
      </span>
    ),
    cell: ({ row }) => <VerdictCell r={row.original} />,
    sortingFn: (a, b) => PICK_VERDICT_RANK[a.original.verdict.verdict] - PICK_VERDICT_RANK[b.original.verdict.verdict],
    meta: { label: "Verdict", csv: (r) => `${VERDICT_LABEL[r.verdict.verdict]} (${reasonText(r)})` },
  },
  {
    id: "price",
    accessorFn: (r) => (r.inplay ? r.pick.odds_at_pick : (r.best?.odds ?? null)),
    header: () => (
      <span title="The best price right now across ALL the books we can bet at (CB = Coolbet, UB = Unibet) — not necessarily the book the bot priced its pick at; when it differs, that book's price is shown underneath. Also shows how old the price is.">
        Best price now
      </span>
    ),
    cell: ({ row }) => <PriceCell r={row.original} />,
    sortUndefined: "last",
    meta: {
      align: "right",
      label: "Best price now",
      csv: (r) =>
        r.inplay
          ? r.pick.odds_at_pick
          : r.best
            ? `${r.best.odds.toFixed(2)} ${r.best.book}${r.bestAgeMin == null ? "" : ` (${Math.round(r.bestAgeMin)} min old)`}`
            : "",
    },
  },
  {
    id: "edge",
    accessorFn: (r) => (r.inplay ? null : r.shownEdge),
    header: () => (
      <span title="The bot's chance minus the chance the price implies, at the best price now. Only shown when that price reaches the bot's minimum; “below min” = profitable but not a bet the bot would make.">
        Edge now
      </span>
    ),
    cell: ({ row }) => <GateCell r={row.original} kind="liveEdge" />,
    meta: { align: "right", label: "Edge now" },
  },
  {
    id: "gateFloor",
    accessorFn: (r) => (r.inplay ? null : r.verdict.gateFloor),
    header: () => <span title="The lowest price the bot itself would bet at (its edge bar, raised to the placer's minimum odds)">Min price</span>,
    cell: ({ row }) => <GateCell r={row.original} kind="gateFloor" />,
    meta: { align: "right", label: "Min price" },
  },
  {
    id: "bot",
    accessorFn: (r) => r.botLabel,
    header: "Bot",
    cell: ({ row }) => <BotCell r={row.original} />,
    meta: { csv: (r) => [r, ...r.siblings].map((s) => `${s.botLabel} (${s.pick.bot_name})`).join("; ") },
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
    header: () => (
      <span title="How old the price was when the bot DECIDED (not the price shown now). Over the engine's own 60-minute limit it is marked, and the row is greyed.">
        Age at pick
      </span>
    ),
    cell: ({ row }) => <DecisionAgeCell r={row.original} />,
    meta: { align: "right", label: "Price age at pick (min)" },
  },
  {
    id: "_actions",
    header: "Action",
    cell: ({ row }) => <ActionCell r={row.original} />,
    enableSorting: false,
    enableHiding: false,
    // Sticky on the right: at 1440 px the table is wider than the panel, and the action (the one
    // thing the page is for) ran off the edge (UX fix round, 2026-09-24).
    // md+ only: on a phone a sticky 170 px column would cover most of the table.
    meta: { className: "md:sticky md:right-0 md:z-[1] md:bg-card md:shadow-[inset_1px_0_0_0_var(--color-border)]" },
  },
];

export function PicksQueueTable({ rows }: { rows: PickRowData[] }) {
  // In-play rows can never be placed (no in-play placer), so they are hidden by default — they
  // sat above placeable pre-match rows and made "best first" false (UX fix round, 2026-09-24).
  const [showInplay, setShowInplay] = useState(false);
  const inplayN = useMemo(() => rows.filter((r) => r.inplay).length, [rows]);
  const data = useMemo(() => (showInplay ? rows : rows.filter((r) => !r.inplay)), [rows, showInplay]);
  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search team, league, bot…"
      facets={[
        { column: "verdict", label: "Verdict", format: (v) => VERDICT_LABEL[v as PickVerdict] ?? v },
        { column: "bot", label: "Bot" },
        { column: "market", label: "Market" },
      ]}
      toolbar={
        inplayN > 0 ? (
          <button
            type="button"
            aria-pressed={showInplay}
            onClick={() => setShowInplay((v) => !v)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs hover:bg-accent hover:text-foreground ${showInplay ? "border-border bg-accent text-foreground" : "border-dashed border-border text-muted-foreground"}`}
            title="In-play picks are measured, never placed — there is no way to bet them in play."
          >
            {showInplay ? `Hide in-play (${inplayN})` : `Show in-play (${inplayN}, can't be placed)`}
          </button>
        ) : null
      }
      rowClassName={pickRowClassName}
      exportName="pick-queue"
      emptyText="No picks waiting — no active bot has a pending pick with a future kickoff."
      pageSize={50}
      dense
    />
  );
}
