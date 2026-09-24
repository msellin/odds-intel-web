"use client";

// The bot sheet's Picks tab (#139 IA move P7, 2026-09-24) — the per-bot ledger that used to live on
// /admin/shadow-bots/[bot], rebuilt on the unified bot_ledger and the shared DataTable (search,
// result / bet-made facets, sortable columns, CSV export). Pages of 50, newest first, with
// "Load 50 older picks" until the ledger is exhausted.
//
// Columns, and why each family sees only its own:
//  * Bet made — was real money staked on THIS pick: our price + the venue (real_bets,
//    placed_real IS NOT FALSE). Its own column, never squeezed into the Result cell (the
//    2026-09-10 overlay bug). Hidden for forward-test arms: their ledger rows carry no bot id,
//    so a placement cannot be linked — the tab says that instead of showing a column of "no".
//  * Now CB / Now UB / Now EB — the latest Coolbet, Unibet-Site (the PLACEABLE unibet.ee feed,
//    never the Kambi API) and Epicbet price, for pending pre-match picks only. Not for in-play
//    bots: a pre-match quote says nothing about a bet placed during the match.
//  * CLV — the family's ONE admissible metric (mc-CLV or Pin-CLV); none at all for in-play
//    (no closing line — they are judged on lift). #139 finding (b): the old page showed in-play
//    bots a pre-match CLV and a model-edge "Min odds"; neither exists here.

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Circle, Dot, Loader2, X } from "lucide-react";
import { DataTable } from "@/components/oi/data-table";
import type { BotPickRow } from "@/lib/bot-board";
import { SNAPSHOT_BOOKS, type SnapshotBook } from "@/lib/bot-snapshot-books";
import { METRIC_SHORT, type BotView } from "./bot-board-model";
import { count, dayMonth, fmtMarkets, fmtRuleVersion, odds2, pct, utcStamp } from "./bot-board-format";
import type { LedgerState } from "./bot-drawer";

const BOOK_COL: Record<SnapshotBook, { head: string; title: string; cls: string }> = {
  Coolbet: { head: "Now CB", title: "Coolbet's latest pre-match price (last 12 h). Pending picks only.", cls: "text-method-model" },
  "Unibet-Site": {
    head: "Now UB",
    title: "Unibet's latest price from the PLACEABLE unibet.ee site feed (never the Kambi API, which unibet.ee left on 2026-09-06). Pending picks only.",
    cls: "text-method-consensus",
  },
  Epicbet: { head: "Now EB", title: "Epicbet's latest price (30-minute ingest). Pending picks only.", cls: "text-method-sharp" },
};

function ResultTag({ result }: { result: string | null }) {
  if (result === "won") return <span className="inline-flex items-center gap-1 text-success"><Check size={12} aria-hidden="true" />won</span>;
  if (result === "lost") return <span className="inline-flex items-center gap-1 text-danger"><X size={12} aria-hidden="true" />lost</span>;
  if (result === "pending") return <span className="inline-flex items-center gap-1 text-muted-foreground"><Dot size={14} aria-hidden="true" />pending</span>;
  if (result === "void" || result === "push") return <span className="inline-flex items-center gap-1 text-muted-foreground"><Circle size={10} aria-hidden="true" />{result}</span>;
  return <span className="text-foreground">{result ?? "—"}</span>;
}

function kickoffLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${dayMonth(d)} ${d.toISOString().slice(11, 16)}`;
}

function marketSel(r: BotPickRow): string {
  const m = r.market ? fmtMarkets([r.market]) : "—";
  const s = r.selection ? r.selection.charAt(0).toUpperCase() + r.selection.slice(1) : "";
  return `${m} ${s}`.trim();
}

const matchText = (r: BotPickRow) => (r.home_team && r.away_team ? `${r.home_team} – ${r.away_team}` : `match ${r.match_id ? r.match_id.slice(0, 8) : "—"}`);

export function PicksTable({ v, ledger, onMore }: { v: BotView; ledger: LedgerState | undefined; onMore?: () => void }) {
  const metric = v.metric.metric;
  const inplay = metric === "lift" || v.family === "inplay";
  const scored = v.sb?.scored_rule_version ?? null;
  const loaded = ledger && !ledger.loading ? ledger : null;
  const rows = useMemo(() => loaded?.rows ?? [], [loaded]);
  const clvOf = (r: BotPickRow) => (metric === "clv_pinnacle" ? r.clv_pinnacle : metric === "clv_mc" ? r.clv_mc : null);
  // A column of dashes says nothing — hide it and say why (e.g. bot_v10_1x2: the sim ledger has
  // had no clv_pinnacle_devig since 5 Sep, while its scoreboard n=330 is older).
  const anyClv = !inplay && rows.some((r) => clvOf(r) != null);
  const linked = loaded?.placementLinked !== false;
  const placedUnknown = !!loaded?.placedError;
  const anyPriceRow = !inplay && rows.some((r) => r.now != null);
  const placedN = rows.filter((r) => r.placed).length;

  const columns = useMemo<ColumnDef<BotPickRow>[]>(() => {
    const cols: ColumnDef<BotPickRow>[] = [
      {
        id: "kickoff",
        header: "Kickoff",
        accessorFn: (r) => (r.kickoff ? new Date(r.kickoff).getTime() : 0),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground" title={utcStamp(row.original.kickoff)}>
            {kickoffLabel(row.original.kickoff)}
          </span>
        ),
        meta: { csv: (r) => r.kickoff ?? "" },
      },
      {
        id: "match",
        header: "Match",
        accessorFn: matchText,
        cell: ({ row }) => {
          const r = row.original;
          const old = scored != null && r.source === "forward_test" && r.rule_version !== scored;
          return (
            <span className="block max-w-[14rem] truncate" title={matchText(r)}>
              {r.home_team && r.away_team ? matchText(r) : <span className="font-mono text-muted-foreground">{matchText(r)}</span>}
              {old && (
                <span className="ml-1 rounded bg-muted px-1 font-mono text-xs" title={`Earlier rule version ${r.rule_version ?? ""} — not scored`}>
                  {fmtRuleVersion(r.rule_version)?.split(" ·")[0] ?? "old"}
                </span>
              )}
            </span>
          );
        },
      },
      { id: "pick", header: "Pick", accessorFn: marketSel, cell: ({ getValue }) => <span className="whitespace-nowrap">{String(getValue())}</span> },
      { id: "odds", header: "Odds", accessorFn: (r) => r.odds, cell: ({ row }) => odds2(row.original.odds), meta: { align: "right" } },
      {
        id: "book",
        header: "Book",
        accessorFn: (r) => r.bookmaker?.replace(/-Site$/, "") ?? "—",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{String(getValue())}</span>,
      },
    ];
    if (linked) {
      cols.push({
        id: "bet",
        header: () => (
          <span title="Real money actually staked on this pick: the price we got and the venue (real_bets). Blank = no real bet — the Book column is only the price the bot quoted.">Bet made</span>
        ),
        accessorFn: (r) => (placedUnknown ? "unknown" : r.placed ? "placed" : "no bet"),
        cell: ({ row }) => {
          const p = row.original.placed;
          if (placedUnknown) return <span className="text-warning" title={loaded?.placedError ?? undefined}>Unknown</span>;
          if (!p) return <span className="text-muted-foreground/60" title="No real bet on this pick">—</span>;
          return (
            <span
              className="block whitespace-nowrap leading-tight"
              title={`Real money staked${p.odds ? ` @ ${p.odds.toFixed(2)}` : ""}${p.bookmaker ? ` at ${p.bookmaker}` : ""}${p.stake ? ` · stake €${p.stake}` : ""}${p.placedReal == null ? " · legacy reconciled bet" : ""}`}
            >
              <span className="font-mono text-xs font-semibold tabular-nums text-success">€ {p.odds ? p.odds.toFixed(2) : "real"}</span>
              <span className="block truncate text-[11px] text-success/70">{p.bookmaker ?? "—"}</span>
            </span>
          );
        },
        meta: { label: "Bet made", csv: (r) => (r.placed ? `${r.placed.odds ?? ""} ${r.placed.bookmaker ?? ""}`.trim() : "") },
      });
    }
    if (anyPriceRow) {
      for (const book of SNAPSHOT_BOOKS) {
        const c = BOOK_COL[book];
        cols.push({
          id: `now_${book}`,
          header: () => <span title={c.title}>{c.head}</span>,
          accessorFn: (r) => r.now?.[book]?.odds ?? null,
          cell: ({ row }) => {
            const n = row.original.now;
            if (n == null) return null; // settled / started: a finished match has no current price
            const q = n[book];
            if (!q) return <span className="text-muted-foreground/60" title={`No ${book} price for this selection in the last 12 h`}>—</span>;
            return (
              <span className={c.cls} title={`${book} ${q.odds.toFixed(2)} · ${utcStamp(q.ts)}`}>
                {q.odds.toFixed(2)}
              </span>
            );
          },
          sortUndefined: "last",
          meta: { align: "right", label: c.head },
        });
      }
    }
    if (anyClv) {
      cols.push({
        id: "clv",
        header: METRIC_SHORT[metric],
        accessorFn: (r) => clvOf(r),
        cell: ({ row }) => {
          const x = clvOf(row.original);
          return x == null ? <span className="text-muted-foreground/60">—</span> : <span className={x >= 0 ? "text-success" : "text-danger"}>{pct(x)}</span>;
        },
        meta: { align: "right" },
      });
    }
    cols.push({
      id: "result",
      header: "Result",
      accessorFn: (r) => r.result ?? "—",
      cell: ({ row }) => <span className="whitespace-nowrap"><ResultTag result={row.original.result} /></span>,
    });
    return cols;
    // clvOf / matchText are pure functions of `metric`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, placedUnknown, anyPriceRow, anyClv, metric, scored, loaded?.placedError]);

  if (!ledger || ledger.loading) {
    return (
      <div className="space-y-2" aria-label="Loading picks">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-muted/40" />)}
      </div>
    );
  }
  if (ledger.error) return <p className="break-words text-sm text-warning">Could not read the ledger: {ledger.error}</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No picks yet.</p>;

  return (
    <div className="space-y-2">
      <ul className="space-y-1 text-xs text-muted-foreground">
        {inplay && <li>In-play bot: no closing line, so no CLV column, and no current pre-match price — it is judged on lift (not computed yet).</li>}
        {!inplay && !anyClv && (
          <li className="text-warning">No {METRIC_SHORT[metric]} recorded on any of these {rows.length} picks — the column is hidden. The scoreboard figure comes from older picks.</li>
        )}
        {!linked && <li>Forward-test picks are not linked to real bets (the ledger carries no bot id), so there is no Bet made column.</li>}
        {linked && !placedUnknown && <li>{placedN > 0 ? `${placedN} of these ${rows.length} picks had real money on them.` : `No real money on any of these ${rows.length} picks.`}</li>}
        {placedUnknown && <li className="text-warning">Placements unreadable ({loaded?.placedError}) — Bet made shows Unknown, not “no”.</li>}
        {loaded?.pricesError && <li className="text-warning">Current prices unreadable ({loaded.pricesError}).</li>}
      </ul>
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search team, market…"
        facets={[
          { column: "result", label: "Result" },
          ...(linked && !placedUnknown ? [{ column: "bet", label: "Bet made" }] : []),
        ]}
        pageSize={0}
        maxHeight="60dvh"
        dense
        exportName={`${v.name}-picks`}
        rowClassName={(r) => (scored != null && r.source === "forward_test" && r.rule_version !== scored ? "opacity-50" : "")}
        emptyText="No picks yet."
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {count(rows.length)} loaded, newest first{v.sb?.picks_total != null ? ` · ${count(v.sb.picks_total)} on the scoreboard` : ""}
        </span>
        {ledger.hasMore ? (
          <button
            type="button"
            onClick={onMore}
            disabled={ledger.loadingMore || !onMore}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {ledger.loadingMore && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            Load 50 older picks
          </button>
        ) : (
          <span>That is the whole ledger.</span>
        )}
      </div>
      {ledger.moreError && <p className="text-xs text-warning">Could not load older picks: {ledger.moreError}</p>}
    </div>
  );
}
