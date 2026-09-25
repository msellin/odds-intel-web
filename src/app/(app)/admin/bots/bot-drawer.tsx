"use client";

// /admin/bots — detail panels (#139, bots-board-ux-spec §8). Since control-panel phase A these
// pieces render inside the right-hand Sheet with tabs (bot-sheet.tsx); the hand-rolled drawer
// shell is gone (Sheet brings focus trap, Esc and return focus). Leads with the evidence
// (verdict, metric, ROI tiles + the forest bar and 12-week strip), then what the bot bets
// as three fact cards, with the raw gates and sources collapsed. Recent picks show team
// names (migration 411's bot_ledger_display) and ONLY the family's admissible CLV — none
// at all for in-play (honesty rules 2 and 4); since IA move P7 that table is picks-table.tsx.

import { type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import type { BotPickRow } from "@/lib/bot-board";
import {
  FAMILY_INFO,
  METRIC_LABEL,
  METRIC_SHORT,
  MIN_N,
  otherMetric,
  type BotView,
} from "./bot-board-model";
import {
  ciHalf,
  count,
  dayMonth,
  floorColLabel,
  fmtBooksLong,
  fmtMarkets,
  fmtOddsBand,
  fmtRuleVersion,
  gateLabel,
  gateValue,
  isShownAbove,
  odds2,
  parseFloor,
  pct,
  pctPlain,
  timeAgo,
  tStat,
  utcStamp,
} from "./bot-board-format";
import { placementPathReason } from "@/lib/bot-controls/placement-path";
import { useControls } from "./controls-context";
import { ControlLine, LastPick, MetricPill, ROI_COLOUR_MIN, VerdictChip, capList, roiTone } from "./bot-row";
import { ForestAxis, ForestBar, WeeklyStrip } from "./bot-viz";

/** One bot's loaded Picks-tab pages (IA move P7: paged, with "Bet made" + current prices). */
export type LedgerState =
  | { loading: true }
  | {
      loading: false;
      rows: BotPickRow[];
      error: string | null;
      /** real_bets unreadable → "Bet made" shows Unknown. */
      placedError?: string | null;
      pricesError?: string | null;
      /** false: the ledger has no bot_id (forward-test arms) — placements cannot be linked. */
      placementLinked?: boolean;
      hasMore?: boolean;
      /** Picks with a real bet over the WHOLE ledger (null = unknown). */
      placedPicks?: number | null;
      /** This state is the server-side "Bet made only" filter. */
      placedOnly?: boolean;
      loadingMore?: boolean;
      moreError?: string | null;
    };

const LABEL = "font-mono text-xs uppercase tracking-widest text-muted-foreground";

const ANCHOR_PILL: Record<string, { text: string; cls: string }> = {
  model: { text: "Model", cls: "border-method-model/40 bg-method-model/10 text-method-model" },
  sharp: { text: "Sharp", cls: "border-method-sharp/40 bg-method-sharp/10 text-method-sharp" },
  consensus: { text: "Consensus", cls: "border-method-consensus/40 bg-method-consensus/10 text-method-consensus" },
  junk: { text: "Junk", cls: "border-warning/40 bg-warning/10 text-warning" },
};

function MiniTile({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <div className={LABEL}>{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{children}</div>
      {sub != null && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function FactCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className={LABEL}>{label}</div>
      <div className="mt-1 space-y-0.5 text-sm">{children}</div>
    </div>
  );
}

function PriceFacts({ v }: { v: BotView }) {
  const cfg = v.cfg;
  const f = parseFloor(cfg?.edge_floor);
  const odds = fmtOddsBand(cfg?.odds_min, cfg?.odds_max);
  const oddsLine = odds ? odds.charAt(0).toUpperCase() + odds.slice(1) : "Any odds";
  let floor: ReactNode;
  switch (f.kind) {
    case "none":
      floor = <div>No edge floor — trigger-based</div>;
      break;
    case "flat":
      floor = (
        <div title={cfg?.edge_floor ?? undefined}>
          {f.value <= 0 ? "Any positive edge" : `Edge ≥ ${pctPlain(f.value)}`}
          {f.value > 0 && (
            <div className="text-xs text-muted-foreground">probability × odds must exceed {(1 + f.value).toFixed(2)}</div>
          )}
        </div>
      );
      break;
    case "selection":
      floor = (
        <ul className="space-y-0.5">
          {f.lines.map((l) => (
            <li key={l.label}>
              {l.label}: edge ≥ {pctPlain(l.value)}
            </li>
          ))}
        </ul>
      );
      break;
    case "tiered":
      floor = (
        <div className="space-y-2">
          {f.tables.map((t, i) => (
            <div key={t.label ?? i}>
              {t.label && <div className="text-xs text-muted-foreground">{t.label}</div>}
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-0.5 pr-2 text-left font-normal">League tier</th>
                    {t.cols.map((c) => (
                      <th key={c} className="py-0.5 pl-2 text-right font-normal">{floorColLabel(c)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r) => (
                    <tr key={r.tier} className="border-t border-border/60">
                      <td className="py-0.5 pr-2">{r.tier}</td>
                      {r.cells.map((c, j) => (
                        <td key={j} className="py-0.5 pl-2 text-right">{c == null ? "—" : pctPlain(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      );
      break;
    case "raw":
      floor = <div className="break-words font-mono text-xs">{f.text}</div>;
      break;
  }
  return (
    <FactCard label="Price">
      {floor}
      <div>{oddsLine}</div>
    </FactCard>
  );
}

/** The header's real-money word, from the SAME sources as the € switch (#139 review item 7):
 *  the placement-path rule + the eligibility row — never the older bot_capabilities flags. */
function MoneyWord({ v }: { v: BotView }) {
  const ctl = useControls();
  const why = placementPathReason(v.cfg?.family ?? v.family, v.cfg?.ledger, v.cfg?.books);
  const row = ctl.placerBy.get(v.name);
  const on = ctl.current("placer_enabled", v.name);
  if (ctl.state.placers.error) return <span className="text-warning">Real money: unknown</span>;
  if (row?.locked_reason) return <span className="text-muted-foreground">Real money: locked off</span>;
  if (row && on) return <span className="font-medium text-danger">Real money: selected (ON)</span>;
  if (row) return <span className="text-warning">Real money: can be selected — OFF</span>;
  if (!why) return <span className="text-muted-foreground">Real money: placeable, no switch yet</span>;
  return <span className="text-muted-foreground">Real money: not placeable</span>;
}

export function DrawerHeader({ v, fleetPaused, pulse, closeBtn, onClose }: {
  v: BotView;
  fleetPaused: boolean | null;
  pulse: boolean;
  closeBtn: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { sb, cfg, caps } = v;
  const info = FAMILY_INFO[v.family];
  const anchor = ANCHOR_PILL[cfg?.anchor ?? ""] ?? { text: "No anchor", cls: "border-border text-muted-foreground" };
  const rv = fmtRuleVersion(sb?.scored_rule_version);
  const capWords = capList(caps, pulse);
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 font-mono text-xs uppercase ${anchor.cls}`}>{anchor.text}</span>
            <h2 className="text-lg font-semibold leading-tight">{v.displayName}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{v.name}</span>
            <span>· {info.title}</span>
            {rv && <span className="rounded bg-method-consensus/10 px-1.5 font-mono text-xs text-method-consensus" title={sb?.scored_rule_version ?? undefined}>{rv}</span>}
          </div>
        </div>
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          <X size={20} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {!caps ? (
          <span className="text-muted-foreground">Capabilities unknown</span>
        ) : (
          <>
            {capWords.filter((c) => c.key === "publish" || c.key === "telegram").map((c) => (
              <span key={c.key} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${c.cls}`} aria-hidden="true">{c.icon}</span>
                {c.word}
              </span>
            ))}
            <MoneyWord v={v} />
            {fleetPaused === true && <span className="text-muted-foreground">· placement paused</span>}
            {caps.collect === false && <span className="text-danger">Not collecting</span>}
            {capWords.length === 0 && caps.collect !== false && <span className="text-muted-foreground">Collecting only (paper)</span>}
          </>
        )}
      </div>
    </div>
  );
}

export function Evidence({ v, now, withOther = true }: { v: BotView; now: number; withOther?: boolean }) {
  const { sb } = v;
  const m = v.metric;
  const other = otherMetric(sb, m.metric);
  const settled = sb?.settled ?? 0;
  const won = sb?.won ?? 0;
  const lost = sb?.lost ?? 0;
  const inplay = m.metric === "lift";
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        <MiniTile label="Verdict" sub={<ControlLine v={v} />}>
          <VerdictChip verdict={v.verdict} />
        </MiniTile>
        {inplay ? (
          <MiniTile
            label="Hit rate"
            sub={v.breakEven != null ? `${Math.round(v.breakEven * 100)}% needed to break even (mean 1/odds) · lift not computed yet` : "break-even not available · lift not computed yet"}
          >
            <span className="text-muted-foreground">{won + lost > 0 ? `${Math.round((won / (won + lost)) * 100)}%` : "—"}</span>
          </MiniTile>
        ) : (
          <MiniTile
            label={METRIC_SHORT[m.metric]}
            sub={m.n ? `${tStat(m.t)} · n ${count(m.n)}${(m.n ?? 0) < MIN_N ? ` of ${MIN_N}` : ""}` : "no measured CLV yet"}
          >
            <span className={v.verdict === "early" || m.mean == null ? "text-muted-foreground" : m.mean >= 0 ? "text-success" : "text-danger"}>
              {pct(m.mean)}
            </span>{" "}
            <span className="text-sm font-normal text-muted-foreground">{ciHalf(m.se)}</span>
          </MiniTile>
        )}
        <MiniTile label="ROI · flat · at our books" sub={`${count(settled)} settled${settled < ROI_COLOUR_MIN ? ` · uncoloured below ${ROI_COLOUR_MIN}` : ""}`}>
          <span className={roiTone(settled, sb?.roi_unit)}>
            {settled > 0 ? pct(sb?.roi_unit) : "—"}
          </span>
        </MiniTile>
        {/* [[#159]] the PUBLIC basis beside it — the exact figure /performance shows for this bot
            (both from the view bot_performance). */}
        <MiniTile label="ROI · flat · all books" sub="best price available at pick time — as /performance">
          <span className={roiTone(settled, sb?.roi_public)}>
            {settled > 0 && sb?.roi_public != null ? pct(sb.roi_public) : "—"}
          </span>
        </MiniTile>
      </div>

      {!inplay && m.mean != null && (m.n ?? 0) > 0 && (
        <div className="rounded-lg border border-border bg-card px-3 py-1.5">
          <ForestAxis />
          <ForestBar mean={m.mean} se={m.se} n={m.n} metric={m.metric} verdict={v.verdict} control={v.controlLine} height={30} />
          <div className="text-xs text-muted-foreground">
            95% range of {METRIC_SHORT[m.metric]}. Left of zero = priced worse than the close.
            {v.controlLine && (
              <span className="text-warning/90">
                {" "}Dashed = junk control {pct(v.controlLine.mean)} {v.controlLine.sameMarket ? "on the same markets" : "(pooled across markets)"}.
              </span>
            )}
          </div>
          {v.control && v.control.caveats.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
              {v.control.caveats.map((c) => <li key={c}>Control comparison: {c}</li>)}
            </ul>
          )}
        </div>
      )}

      {v.weeks && (
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <div className={LABEL}>Picks per week · 12 weeks</div>
          <div className="mt-2">
            <WeeklyStrip weeks={v.weeks} metric={m.metric} width={480} height={56} fluid />
          </div>
          <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
            <span>w/c {dayMonth(new Date(v.weeks[0].start))}</span>
            <span>w/c {dayMonth(new Date(v.weeks[v.weeks.length - 1].start))}</span>
          </div>
        </div>
      )}

      {sb ? (
        <div className="space-y-0.5 text-sm">
          <div>
            <span className="font-medium">{count(sb.picks_total)}</span> picks · {count(won)} W / {count(lost)} L · {count(sb.void)} void ·{" "}
            {count(sb.pending)} pending
          </div>
          <div className="text-muted-foreground">
            first pick {sb.first_pick_at ? dayMonth(new Date(sb.first_pick_at)) : "—"} · last{" "}
            <LastPick iso={sb.last_pick_at} now={now} active={!sb.retired_at} /> ago · {count(sb.picks_7d)} in 7 d
          </div>
          <div className="text-xs text-muted-foreground">
            {(sb.clv_outlier_n ?? 0) > 0 && <>{count(sb.clv_outlier_n)} CLV outlier{sb.clv_outlier_n === 1 ? "" : "s"} excluded (|CLV| &gt; 100% on either CLV metric) · </>}
            {(sb.earlier_version_picks ?? 0) > 0 && <>{count(sb.earlier_version_picks)} earlier-version picks not pooled · </>}
            maturity: {sb.maturity_label ?? "—"} · ledger: {sb.source ?? "—"}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No scoreboard row — this bot has no picks in bot_ledger.</p>
      )}

      {withOther && other && other.n != null && other.n > 0 && (
        <details className="rounded-lg border border-border px-3 py-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Other metrics</summary>
          <div className="mt-2 space-y-1">
            <div className="tabular-nums">
              {METRIC_SHORT[other.metric]} {pct(other.mean)} {ciHalf(other.se)} · {tStat(other.t)} · n {count(other.n)}
            </div>
            <p className="text-xs text-muted-foreground">
              Not used for the verdict — this family is judged on {METRIC_SHORT[m.metric]}.
            </p>
          </div>
        </details>
      )}
    </section>

  );
}

export function WhatItBets({ v, now }: { v: BotView; now: number }) {
  const { cfg } = v;
  const m = v.metric;
  const books = fmtBooksLong(cfg);
  const gates = (cfg?.gates ?? []).filter((g) => !isShownAbove(g.name));
  return (
    <section className="space-y-3">
      <h3 className={LABEL}>What it bets</h3>
      {cfg ? (
        <>
          {cfg.description && <p className="text-sm">{cfg.description}</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <FactCard label="Markets">{fmtMarkets(cfg.markets) || "—"}</FactCard>
            <FactCard label="Books">
              {books.list ? (
                <details>
                  <summary className="cursor-pointer">{books.summary}</summary>
                  <div className="mt-1 text-xs text-muted-foreground">{books.list.join(", ")}</div>
                </details>
              ) : (
                <div>{books.summary}</div>
              )}
            </FactCard>
            <PriceFacts v={v} />
          </div>
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <div>
              Probability: <span className="text-foreground">{cfg.prob_source ?? "—"}</span> · anchor:{" "}
              <span className="text-foreground">{cfg.anchor ?? "none"}</span>
            </div>
            <div>
              Runs: <span className="text-foreground">{cfg.cadence ?? "—"}</span>
              {cfg.writer_job && <> by <span className="text-foreground">{cfg.writer_job}</span></>}
            </div>
            <div className="flex items-center gap-2">Judged on <MetricPill metric={m.metric} /> <span className="text-xs">{METRIC_LABEL[m.metric]}</span></div>
          </div>
          {gates.length > 0 && (
            <details className="rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm">Gates ({gates.length})</summary>
              <div className="mt-2 divide-y divide-border/60">
                {gates.map((g, i) => (
                  <details key={`${g.name}-${i}`} className="group py-1">
                    <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] gap-3 text-sm">
                      <span className="text-muted-foreground" title={g.name}>{gateLabel(g.name)}</span>
                      <span className="text-right break-words">{gateValue(g.name, g.value)}</span>
                    </summary>
                    <div className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                      {g.name} · source: {g.source ?? "—"}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          )}
          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm">Sources &amp; export</summary>
            <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Ledger</dt><dd className="break-all font-mono">{cfg.ledger ?? "—"}</dd>
              <dt className="text-muted-foreground">Writer job</dt><dd className="break-all font-mono">{cfg.writer_job ?? "—"}</dd>
              <dt className="text-muted-foreground">Edge floor (raw)</dt><dd className="break-all font-mono">{cfg.edge_floor ?? "—"}</dd>
              <dt className="text-muted-foreground">Floor source</dt><dd className="break-all font-mono">{cfg.edge_floor_source ?? "—"}</dd>
              <dt className="text-muted-foreground">Books source</dt><dd className="break-all font-mono">{cfg.books_source ?? "—"}</dd>
              <dt className="text-muted-foreground">Exported</dt><dd className="font-mono">{utcStamp(cfg.exported_at)} ({timeAgo(cfg.exported_at, now)})</dd>
            </dl>
          </details>
        </>
      ) : (
        <p className="text-sm text-warning">No bot_config row — the export has not described this bot.</p>
      )}
    </section>

  );
}
