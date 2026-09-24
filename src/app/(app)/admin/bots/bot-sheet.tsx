"use client";

// Bot detail Sheet (#139 phase A, control-panel spec §3.6) — replaces the hand-rolled drawer.
// Right-hand Sheet (full-width on phones), sticky header, five tabs:
//   Overview · Settings (the Collect → Publish → Real money capability ladder, each switch with its
//   evidence next to it, then the read-only configuration from code) · Performance · Picks ·
//   Activity (control_changes for this bot).
// The URL carries ?bot=<name>&tab=<tab>, so the Telegram notice can deep-link here.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { placementPathReason } from "@/lib/bot-controls/placement-path";
import { fetchAudit } from "@/lib/bot-controls/client";
import { TAKES_EFFECT, type ControlChange } from "@/lib/bot-controls/types";
import type { BotMarketStatsRow } from "@/lib/bot-board";
import { METRIC_SHORT, MIN_N, otherMetric, type BotView } from "./bot-board-model";
import { ciHalf, count, dayMonth, pct, tStat } from "./bot-board-format";
import { DrawerHeader, Evidence, RecentPicks, WhatItBets, type LedgerState } from "./bot-drawer";
import { VerdictChip } from "./bot-row";
import { MoneySwitch, PicksSwitch, isRetired, picksTelegramMismatch, picksUnavailable } from "./bot-controls-cell";
import { useControls } from "./controls-context";
import { LadderList } from "./ladder-list";
import { ActivityTimeline } from "./activity-timeline";

export const SHEET_TABS = ["overview", "settings", "performance", "picks", "activity"] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

const LABEL = "font-mono text-xs uppercase tracking-widest text-muted-foreground";
const PUBLIC_LABELS = new Set(["calibrated", "beta"]);

export function BotSheet({
  v,
  tab,
  onTab,
  now,
  ledger,
  markets,
  fleetPaused,
  pulse,
  onClose,
}: {
  v: BotView | null;
  tab: SheetTab;
  onTab: (t: SheetTab) => void;
  now: number;
  ledger: LedgerState | undefined;
  markets: BotMarketStatsRow[] | null;
  fleetPaused: boolean | null;
  pulse: boolean;
  onClose: () => void;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  return (
    <Sheet open={!!v} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        {v && (
          <>
            <SheetTitle className="sr-only">{v.displayName} details</SheetTitle>
            <SheetDescription className="sr-only">Evidence, controls, configuration, picks and activity for {v.name}</SheetDescription>
            <DrawerHeader v={v} fleetPaused={fleetPaused} pulse={pulse} closeBtn={closeBtn} onClose={onClose} />
            <Tabs value={tab} onValueChange={(t) => onTab(t as SheetTab)} className="gap-0">
              <div className="overflow-x-auto border-b border-border bg-background px-4 sm:px-5">
                <TabsList variant="line" className="h-10">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="picks">Picks</TabsTrigger>
                  <TabsTrigger value="activity">
                    Activity <ActivityCount name={v.name} />
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <TabsContent value="overview">
                  <Evidence v={v} now={now} withOther={false} />
                </TabsContent>
                <TabsContent value="settings">
                  <SettingsTab v={v} now={now} />
                </TabsContent>
                <TabsContent value="performance">
                  <PerformanceTab v={v} markets={markets} />
                </TabsContent>
                <TabsContent value="picks">
                  <section className="space-y-2">
                    <h3 className={LABEL}>Recent picks{ledger && !ledger.loading && !ledger.error ? ` (${ledger.rows.length})` : ""}</h3>
                    <RecentPicks v={v} ledger={ledger} />
                  </section>
                </TabsContent>
                <TabsContent value="activity">{tab === "activity" && <BotActivity name={v.name} now={now} />}</TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActivityCount({ name }: { name: string }) {
  const { state } = useControls();
  const n = state.changes.rows.filter((c) => c.bot_name === name).length;
  if (!n) return null;
  return <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{n}</span>;
}

function BotActivity({ name, now }: { name: string; now: number }) {
  const { state } = useControls();
  const preloaded = state.changes.rows.filter((c) => c.bot_name === name);
  const [rows, setRows] = useState<ControlChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchAudit(name, 100).then((r) => {
      if (!live) return;
      setRows(r.rows);
      setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [name]);
  return <ActivityTimeline rows={rows ?? preloaded} now={now} showBot={false} error={rows === null ? state.changes.error : error} />;
}

function Card({ title, state, children }: { title: string; state: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="text-xs">{state}</div>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

function Line({ label, control, children }: { label: string; control?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        {children && <div className="text-xs text-muted-foreground">{children}</div>}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  );
}

function EvidenceChip({ v }: { v: BotView }) {
  return (
    <span className="inline-flex items-center gap-1.5" title="The family's admissible metric — the evidence next to the switch">
      <VerdictChip verdict={v.verdict} />
      <span className="text-xs tabular-nums text-muted-foreground">
        n {count(v.metric.n)}
        {(v.metric.n ?? 0) < MIN_N ? ` of ${MIN_N}` : ""}
      </span>
    </span>
  );
}

function SettingsTab({ v, now }: { v: BotView; now: number }) {
  const ctl = useControls();
  const retired = isRetired(v);
  const writing = v.caps?.writing_7d === true;
  const showOnPicks = ctl.current("show_on_picks", v.name);
  const picksNa = picksUnavailable(v);
  const mismatch = picksTelegramMismatch(v, showOnPicks);
  const label = v.sb?.maturity_label ?? null;
  const onPerf = PUBLIC_LABELS.has(label ?? "");
  const pathWhy = placementPathReason(v.cfg?.family ?? v.family, v.cfg?.ledger, v.cfg?.books);
  const row = ctl.placerBy.get(v.name);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Collect → Publish → Real money. Each capability is its own switch, with its own failure default; turning one on never turns
        on the next.
      </p>

      <Card
        title="1 · Collect"
        state={retired ? <span className="text-muted-foreground">Retired</span> : <span className="text-emerald-400">Active</span>}
      >
        <Line label={retired ? "Retired" : "Collecting picks"}>
          {retired
            ? writing
              ? "Still recording picks in the last 7 days — retired bots keep recording on purpose, so their record stays measurable."
              : "No picks in the last 7 days."
            : "Recording picks."}
          {!retired && v.cfg?.ledger && <span className="ml-1 opacity-70">({v.cfg.ledger}{v.cfg.writer_job ? ` · ${v.cfg.writer_job}` : ""})</span>}
        </Line>
        <Line label="Retire / un-retire" control={<span className="text-xs text-muted-foreground">Coming next</span>}>
          Not on this page yet — today a bot is retired by a database change. The page gets it next, with a preview of what retiring stops.
        </Line>
      </Card>

      <Card title="2 · Publish" state={<EvidenceChip v={v} />}>
        <Line label="Show on /picks" control={<PicksSwitch v={v} now={now} showWord />}>
          {picksNa ? picksNa.text : `Changes only what customers see on /picks. ${TAKES_EFFECT.show_on_picks}`}
        </Line>
        <Line
          label="Telegram channel"
          control={<span className={`text-xs ${v.caps?.telegram ? "text-sky-300" : "text-muted-foreground"}`}>{v.caps?.telegram == null ? "Unknown" : v.caps.telegram ? "Yes" : "No"}</span>}
        >
          The channel posts bots that earned the “calibrated” label (this bot: {label ?? "none"}). It does not follow the /picks switch and cannot be changed here yet.{" "}
          <span className="opacity-70">(maturity_label)</span>
        </Line>
        <Line label="/performance" control={<span className="text-xs text-muted-foreground">{onPerf ? "Yes" : "No"}</span>}>
          Listed when the bot&apos;s label is “calibrated” or “beta” — never because of the /picks switch.{" "}
          <span className="opacity-70">(maturity_label · I12)</span>
        </Line>
        {mismatch && (
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            /picks and Telegram disagree: {showOnPicks ? "shown on /picks but not sent to Telegram" : "sent to Telegram but hidden from /picks"}.
            Customers see different things in the two places. <span className="opacity-70">(migration 356, “Ludogorets”)</span>
          </div>
        )}
      </Card>

      <Card
        title="3 · Real money"
        state={
          pathWhy ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground"><CircleSlash size={12} aria-hidden="true" /> No placement path</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-300"><CheckCircle2 size={12} aria-hidden="true" /> Has a placement path</span>
          )
        }
      >
        <Line label="Placement path (code)">
          {pathWhy
            ? `This bot cannot bet real money: ${pathWhy}.`
            : "Our placers can technically place this bot's picks (before kick-off, at Coolbet or Unibet). Which bots qualify is decided in code."}
        </Line>
        <Line label="Real-money eligible (€)" control={<MoneySwitch v={v} now={now} showWord />}>
          {row?.locked_reason ? (
            <span className="inline-flex items-start gap-1 text-amber-200">
              <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> Locked: {row.locked_reason}
            </span>
          ) : row ? (
            <>This alone stakes nothing — it is 1 of 6 layers. {TAKES_EFFECT.placer_enabled}</>
          ) : pathWhy ? (
            "Not real-money capable."
          ) : (
            "No real-money switch yet — switches are added by a reviewed database change and start OFF."
          )}
        </Line>
        {row?.note && <p className="text-xs text-muted-foreground">Note: {row.note}</p>}
        <div className="rounded-md border border-border/60 p-2">
          <LadderList ladder={ctl.ladder} compact />
        </div>
      </Card>

      <div className="pt-2">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={LABEL}>Configuration (from code)</h3>
          <span className="text-xs text-muted-foreground">read-only · changing it is a code change + deploy</span>
        </div>
        <WhatItBets v={v} now={now} />
      </div>
    </div>
  );
}

function PerformanceTab({ v, markets }: { v: BotView; markets: BotMarketStatsRow[] | null }) {
  const other = otherMetric(v.sb, v.metric.metric);
  const weeks = v.weeks ?? [];
  return (
    <div className="space-y-4">
      {other && other.n != null && other.n > 0 ? (
        <section className="space-y-1">
          <h3 className={LABEL}>Other metrics</h3>
          <div className="text-sm tabular-nums">
            {METRIC_SHORT[other.metric]} {pct(other.mean)} {ciHalf(other.se)} · {tStat(other.t)} · n {count(other.n)}
          </div>
          <p className="text-xs text-muted-foreground">Not used for the verdict — this family is judged on {METRIC_SHORT[v.metric.metric]}.</p>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No second CLV metric recorded for this bot.</p>
      )}

      {markets && markets.length > 0 && (
        <section className="space-y-1">
          <h3 className={LABEL}>By market</h3>
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">Market</th>
                <th className="py-1 pr-2 text-right font-normal">Settled</th>
                <th className="py-1 pr-2 text-right font-normal">Hit</th>
                <th className="py-1 text-right font-normal">mc-CLV</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.market ?? "?"} className="border-t border-border">
                  <td className="py-1 pr-2">{m.market ?? "—"}</td>
                  <td className="py-1 pr-2 text-right">{count(m.settled)}</td>
                  <td className="py-1 pr-2 text-right">{m.settled ? `${Math.round(((m.won ?? 0) / m.settled) * 100)}%` : "—"}</td>
                  <td className="py-1 text-right">{m.clv_mc_n ? pct(m.clv_mc_mean) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {weeks.length > 0 && (
        <section className="space-y-1">
          <h3 className={LABEL}>Weekly · 12 weeks</h3>
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">Week of</th>
                <th className="py-1 pr-2 text-right font-normal">Picks</th>
                <th className="py-1 pr-2 text-right font-normal">CLV n</th>
                <th className="py-1 text-right font-normal">{METRIC_SHORT[v.metric.metric]}</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.start} className="border-t border-border">
                  <td className="py-1 pr-2">{dayMonth(new Date(w.start))}</td>
                  <td className="py-1 pr-2 text-right">{count(w.picks)}</td>
                  <td className="py-1 pr-2 text-right">{count(w.clvN)}</td>
                  <td className="py-1 text-right">{w.clvMean == null ? "—" : pct(w.clvMean)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
