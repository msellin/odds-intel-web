"use client";

// /admin/models client view ([[#153]]): three tables on one page — MODELS (forward accuracy, a window
// switch 7 / 30 / 90 days), BOTS (which model each active bot prices from, its rule and record) and
// HISTORY (each rule / model version a bot's picks carry, plus the older hand-written change log).
// Clicking a model filters the bot table to the bots that use it; a bot row opens its sheet on
// /admin/bots. Plain words first: "vs guessing" and "vs Pinnacle" are the two questions a number answers.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { X } from "lucide-react";
import { DataTable } from "@/components/oi/data-table";
import { Panel, PanelHeader } from "@/components/oi/panel";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { fmtInt, fmtPct } from "@/components/oi/format";
import {
  FAMILY_LABEL,
  familyOfBot,
  familyOfModel,
  tradesMarket,
  LEVEL_BAND,
  type AccuracyRow,
  type ModelFamily,
  type ModelsData,
} from "@/lib/admin-models-shared";

const WINDOWS = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
] as const;

const MARKET_WORD: Record<string, string> = {
  "1x2": "1X2",
  over_under_15: "O/U 1.5",
  over_under_25: "O/U 2.5",
  over_under_35: "O/U 3.5",
};

const MIN_N = 20; // a row with fewer settled matches is noise — hidden unless searched for

const ll = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(3));
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "—");

/** Positive = the model is better (lower log-loss) than the reference. */
function Gap({ base: refLl, own, n }: { base: number | null; own: number | null; n?: number }) {
  if (refLl == null || own == null) return <span className="text-muted-foreground">—</span>;
  const g = refLl - own;
  const tone = g > LEVEL_BAND ? "text-success" : g < -LEVEL_BAND ? "text-danger" : "text-muted-foreground";
  const word = g > LEVEL_BAND ? "better" : g < -LEVEL_BAND ? "worse" : "level";
  return (
    <span className={`whitespace-nowrap tabular-nums ${tone}`} title={`reference ${ll(refLl)} · this model ${ll(own)}`}>
      {word} {g >= 0 ? "+" : "−"}
      {Math.abs(g).toFixed(3)}
      {n != null && <span className="ml-1 text-[11px] text-muted-foreground">({fmtInt(n)})</span>}
    </span>
  );
}

const MARKET_ORDER = ["1x2", "over_under_15", "over_under_25", "over_under_35"];

interface ModelRow extends AccuracyRow {
  family: ModelFamily;
  bots: number;
}

interface BotRow {
  name: string;
  display: string;
  status: string;
  vip: boolean;
  family: ModelFamily;
  probSource: string;
  markets: string;
  rule: string;
  odds: string;
  ruleVersion: string;
  settled: number;
  clv: number | null;
  roi: number | null;
  lastPick: string | null;
}

const STATUS_TONE: Record<string, Tone> = { active: "success", testing: "info", experimental: "neutral", vip: "model" };

export function ModelsView({ d }: { d: ModelsData }) {
  const [win, setWin] = useState<(typeof WINDOWS)[number]["key"]>("30d");
  const [family, setFamily] = useState<ModelFamily | null>(null);

  const active = useMemo(() => new Map(d.bots.rows.filter((b) => !b.retired_at).map((b) => [b.name, b])), [d.bots.rows]);
  const perf = useMemo(() => new Map(d.performance.rows.map((p) => [p.bot_name, p])), [d.performance.rows]);

  const botRows: BotRow[] = useMemo(
    () =>
      d.config.rows
        .filter((c) => active.has(c.bot_name))
        .map((c) => {
          const b = active.get(c.bot_name)!;
          const p = perf.get(c.bot_name);
          return {
            name: c.bot_name,
            display: b.display_name || c.bot_name,
            status: b.maturity_label ?? "—",
            vip: !!b.vip,
            family: familyOfBot(c.prob_source),
            probSource: c.prob_source ?? "—",
            markets: (c.markets ?? []).join(", "),
            rule: c.edge_floor ?? "—",
            odds: c.odds_min != null || c.odds_max != null ? `${c.odds_min ?? "…"}–${c.odds_max ?? "…"}` : "—",
            ruleVersion: b.rule_version ?? "—",
            settled: p?.settled ?? 0,
            clv: p?.clv_n ? p.clv_public : null,
            roi: p?.settled ? p.roi_public : null,
            lastPick: p?.last_pick_at ?? null,
          };
        }),
    [d.config.rows, active, perf],
  );

  const modelRows: ModelRow[] = useMemo(
    () =>
      d.accuracy.rows
        .filter((r) => r.win === win && r.n >= MIN_N)
        .map((r) => {
          const fam = familyOfModel(r.model);
          return { ...r, family: fam, bots: botRows.filter((b) => b.family === fam && tradesMarket(b.markets, r.market)).length };
        })
        // pre-sorted: 1X2 first, then the O/U lines, best log-loss first within a market (the table's
        // alphanumeric sort would put "1x2" after "over_under_*")
        .sort((a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market) || a.logloss - b.logloss),
    [d.accuracy.rows, win, botRows],
  );

  const modelCols: ColumnDef<ModelRow>[] = [
    {
      accessorKey: "model",
      header: "Model",
      meta: { label: "Model" },
      cell: ({ row }) => (
        <span className="block min-w-[12rem]">
          <span className="block text-sm">{FAMILY_LABEL[row.original.family]}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{row.original.model}</span>
        </span>
      ),
    },
    {
      accessorKey: "market",
      header: "Market",
      meta: { label: "Market", csv: (r) => MARKET_WORD[r.market] ?? r.market },
      cell: ({ row }) => <span className="whitespace-nowrap text-sm">{MARKET_WORD[row.original.market] ?? row.original.market}</span>,
    },
    {
      accessorKey: "n",
      header: "Matches",
      meta: { label: "Matches", align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{fmtInt(row.original.n)}</span>,
    },
    {
      accessorKey: "logloss",
      header: "Log-loss",
      meta: { label: "Log-loss", align: "right", tip: "How surprised the model was by the results — lower is better. 1X2 guessing is about 1.07, Pinnacle about 0.97." },
      cell: ({ row }) => <span className="tabular-nums">{ll(row.original.logloss)}</span>,
    },
    {
      id: "vs_base",
      header: "vs guessing",
      accessorFn: (r) => (r.base_logloss == null ? null : r.base_logloss - r.logloss),
      meta: { label: "vs guessing", align: "right", tip: "Against always predicting the average outcome rates of the same matches. 'Worse' means the model is worse than knowing nothing about the teams." },
      cell: ({ row }) => <Gap base={row.original.base_logloss} own={row.original.logloss} />,
    },
    {
      id: "vs_pin",
      header: "vs Pinnacle",
      accessorFn: (r) => (r.pin_logloss == null || r.logloss_pin_rows == null ? null : r.pin_logloss - r.logloss_pin_rows),
      meta: { label: "vs Pinnacle", align: "right", tip: "On the matches Pinnacle also priced (count in brackets): the model's log-loss against Pinnacle's de-vigged price. This is the honest benchmark — beating it is rare." },
      cell: ({ row }) =>
        row.original.family === "pinnacle" ? (
          <span className="text-muted-foreground">(benchmark)</span>
        ) : (
          <Gap base={row.original.pin_logloss} own={row.original.logloss_pin_rows} n={row.original.pin_n} />
        ),
    },
    {
      accessorKey: "brier",
      header: "Brier",
      meta: { label: "Brier", align: "right", className: "hidden lg:table-cell", tip: "Squared error of the probabilities — lower is better." },
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.brier.toFixed(3)}</span>,
    },
    {
      accessorKey: "bots",
      header: "Bots",
      meta: { label: "Bots using it", align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.bots || "—"}</span>,
    },
    {
      accessorKey: "last_kickoff",
      header: "Last match",
      meta: { label: "Last match", className: "hidden md:table-cell" },
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{day(row.original.last_kickoff)}</span>,
    },
  ];

  const botCols: ColumnDef<BotRow>[] = [
    {
      accessorKey: "display",
      header: "Bot",
      meta: { label: "Bot" },
      cell: ({ row }) => (
        <Link href={`/admin/bots?bot=${encodeURIComponent(row.original.name)}`} className="block min-w-[11rem] hover:underline">
          <span className="block text-sm">{row.original.display}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{row.original.name}</span>
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      meta: { label: "Status" },
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          <StatusBadge tone={STATUS_TONE[row.original.status] ?? "neutral"}>{row.original.status}</StatusBadge>
          {row.original.vip && <StatusBadge tone="model">VIP</StatusBadge>}
        </span>
      ),
    },
    {
      id: "family",
      accessorFn: (r) => FAMILY_LABEL[r.family],
      header: "Model",
      meta: { label: "Model" },
      cell: ({ row }) => (
        <span className="block min-w-[10rem] text-sm" title={row.original.probSource}>
          {FAMILY_LABEL[row.original.family]}
          <span className="block text-[11px] text-muted-foreground line-clamp-1">{row.original.probSource}</span>
        </span>
      ),
    },
    { accessorKey: "markets", header: "Markets", meta: { label: "Markets", className: "hidden lg:table-cell" }, cell: ({ row }) => <span className="text-xs">{row.original.markets || "—"}</span> },
    {
      accessorKey: "rule",
      header: "Edge rule",
      meta: { label: "Edge rule", className: "hidden md:table-cell", tip: "The minimum edge the bot needs before it picks, as exported from the code (bot_config)." },
      cell: ({ row }) => <span className="block max-w-[14rem] text-xs line-clamp-2">{row.original.rule}</span>,
    },
    { accessorKey: "odds", header: "Odds", meta: { label: "Odds range", className: "hidden md:table-cell" }, cell: ({ row }) => <span className="whitespace-nowrap text-xs tabular-nums">{row.original.odds}</span> },
    { accessorKey: "ruleVersion", header: "Rule", meta: { label: "Rule version", tip: "Bumped whenever the bot's pick rule changes; every pick records the version it was made under." }, cell: ({ row }) => <span className="font-mono text-xs">{row.original.ruleVersion}</span> },
    { accessorKey: "settled", header: "Settled", meta: { label: "Settled", align: "right" }, cell: ({ row }) => <span className="tabular-nums">{fmtInt(row.original.settled)}</span> },
    {
      accessorKey: "clv",
      header: "CLV",
      meta: { label: "CLV", align: "right", tip: "Beat-the-close against the sharp anchor (Pinnacle, else the 5-book consensus) — the one CLV every page uses." },
      cell: ({ row }) => <span className={`tabular-nums ${(row.original.clv ?? 0) > 0 ? "text-success" : (row.original.clv ?? 0) < 0 ? "text-danger" : ""}`}>{fmtPct(row.original.clv)}</span>,
    },
    { accessorKey: "roi", header: "ROI", meta: { label: "ROI", align: "right", className: "hidden sm:table-cell" }, cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{fmtPct(row.original.roi)}</span> },
  ];

  const botsShown = family ? botRows.filter((b) => b.family === family) : botRows;

  const histRows = useMemo(
    () =>
      d.ruleHistory.rows
        .filter((h) => active.has(h.bot_name))
        .map((h) => ({ ...h, display: active.get(h.bot_name)?.display_name || h.bot_name })),
    [d.ruleHistory.rows, active],
  );
  type HistRow = (typeof histRows)[number];
  const histCols: ColumnDef<HistRow>[] = [
    { accessorKey: "display", header: "Bot", meta: { label: "Bot" }, cell: ({ row }) => <span className="text-sm">{row.original.display}</span> },
    { accessorKey: "rule_version", header: "Rule", meta: { label: "Rule version" }, cell: ({ row }) => <span className="font-mono text-xs">{row.original.rule_version ?? "before tagging"}</span> },
    { accessorKey: "model_version", header: "Model version", meta: { label: "Model version" }, cell: ({ row }) => <span className="font-mono text-xs">{row.original.model_version ?? "—"}</span> },
    { accessorKey: "first_pick", header: "From", meta: { label: "First pick" }, cell: ({ row }) => <span className="font-mono text-[11px]">{day(row.original.first_pick)}</span> },
    { accessorKey: "last_pick", header: "To", meta: { label: "Last pick" }, cell: ({ row }) => <span className="font-mono text-[11px]">{day(row.original.last_pick)}</span> },
    { accessorKey: "picks", header: "Picks", meta: { label: "Picks", align: "right" }, cell: ({ row }) => <span className="tabular-nums">{fmtInt(row.original.picks)}</span> },
  ];

  const err = (e: string | null) => e && <p className="px-4 pt-2 text-xs text-danger">Could not read: {e}</p>;

  return (
    <div className="space-y-4 lg:space-y-6">
      <Panel id="models">
        <PanelHeader
          title="Models — how accurate on settled matches"
          description="Only probabilities written before kickoff count. Lower log-loss is better. Each model is compared with guessing (the average outcome rates) and with Pinnacle's price on the same matches. Rows with fewer than 20 matches are hidden."
          actions={
            <div className="flex rounded-md border border-border p-0.5 text-xs">
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWin(w.key)}
                  className={`rounded px-2 py-1 ${win === w.key ? "bg-muted font-medium" : "text-muted-foreground"}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          }
        />
        {err(d.accuracy.error)}
        <div className="p-4 pt-3">
          <DataTable
            data={modelRows}
            columns={modelCols}
            searchPlaceholder="Search models…"
            facets={[{ column: "market", label: "Market", format: (v) => MARKET_WORD[v] ?? v }]}
            pageSize={0}
            onRowClick={(r) => setFamily((f) => (f === r.family ? null : r.family))}
            rowClassName={(r) => (family === r.family ? "bg-muted/60" : "")}
            emptyText={d.accuracy.rows.length ? "No model has 20+ settled matches in this window." : "No scorecard yet — the engine job model_accuracy runs daily at 02:40 UTC."}
            exportName="models"
            dense
          />
        </div>
      </Panel>

      <Panel id="bots">
        <PanelHeader
          title={family ? `Bots using: ${FAMILY_LABEL[family]}` : "Bots — which model each one prices from"}
          description="Every active bot, the probability source it picks from (exported from the code daily), its edge rule, rule version and its record. Click a model above to filter; click a bot to open its sheet."
          actions={
            family && (
              <button type="button" onClick={() => setFamily(null)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                <X size={12} aria-hidden="true" /> Show all
              </button>
            )
          }
        />
        {err(d.config.error || d.bots.error || d.performance.error)}
        <div className="p-4 pt-3">
          <DataTable
            data={botsShown}
            columns={botCols}
            searchPlaceholder="Search bots…"
            facets={[
              { column: "family", label: "Model" },
              { column: "status", label: "Status" },
            ]}
            initialSort={[{ id: "settled", desc: true }]}
            pageSize={0}
            exportName="bots-by-model"
            dense
          />
        </div>
      </Panel>

      <Panel id="history">
        <PanelHeader
          title="History — when a bot's rule or model changed"
          description="Each rule version and model version the active bots' picks carry, with the first and last pick made under it. Rule versions are stamped on every pick since 25 Sep; older picks read 'before tagging'."
        />
        {err(d.ruleHistory.error)}
        <div className="p-4 pt-3">
          <DataTable
            data={histRows}
            columns={histCols}
            searchPlaceholder="Search a bot…"
            facets={[{ column: "display", label: "Bot" }]}
            initialSort={[{ id: "last_pick", desc: true }]}
            pageSize={25}
            exportName="bot-rule-history"
            dense
          />
        </div>
        {d.changeLog.rows.length > 0 && (
          <details className="border-t border-border px-4 py-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Older hand-written change log ({d.changeLog.rows.length} entries, to {day(d.changeLog.rows[0]?.effective_from)})</summary>
            <ul className="mt-2 space-y-1">
              {d.changeLog.rows.map((c, i) => (
                <li key={`${c.bot_name}-${c.effective_from}-${i}`}>
                  <span className="font-mono text-[11px] text-muted-foreground">{day(c.effective_from)}</span> {c.bot_name} — {c.change_ref}
                  {c.rationale && <span className="text-muted-foreground"> · {c.rationale}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        {err(d.changeLog.error)}
      </Panel>
    </div>
  );
}
