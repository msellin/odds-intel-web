"use client";

// /admin/bots board — #139 UNIFIED-BOT-MODEL phase 1, redesigned 2026-09-24 per
// odds-intel-engine dev/active/bots-board-ux-spec.md (owner: the old table read "like a
// book with no images and just small text").
//
// One row per ACTIVE bot, whatever ledger it writes, grouped by family. Each family is
// judged on ONE admissible metric; the verdict reads that metric only, in five states
// (beats / loses / inconclusive / too early / no CLV). The junk-anchored control is not a
// peer section — it is the dashed reference line on every mc-CLV plot and a reference strip
// on top of the forward test, because a bot sitting on that line is showing no skill.
//
// Files: bot-board-format.ts (text), bot-board-model.ts (verdicts, sorting, issues),
// bot-viz.tsx (forest bar, 12-week strip), bot-row.tsx (sections/rows), fleet-strip.tsx,
// bot-drawer.tsx, retired-list.tsx.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Banknote, Globe, Info, Send, Wallet } from "lucide-react";
import type { BotBoardData, BotLedgerRow, BotMarketStatsRow, BotWeeklyRow, RetiredInfo } from "@/lib/bot-board";
import {
  CONTROL_BOT,
  FAMILY_ORDER,
  buildView,
  controlRef,
  isActive,
  needsALook,
  sortBots,
  type BotView,
  type RetiredView,
} from "./bot-board-model";
import { hhmmUtc, relTime, utcStamp } from "./bot-board-format";
import { FamilySection, type RowCtx } from "./bot-row";
import { FleetStrip } from "./fleet-strip";
import { BotDrawer, type LedgerState } from "./bot-drawer";
import { RetiredList } from "./retired-list";

type Filter = "all" | "published" | "capable";

const HOW_TO_READ = [
  "Each bot is judged on one number for its family — mc-CLV, Pinnacle CLV, or (in-play) nothing yet.",
  "The bar is the 95% range on a shared −8% … +8% scale (arrowheads = runs past it). Left of zero = we priced worse than the close.",
  "Dashed amber line = a deliberately junk-anchored bot on the same markets. A bot that cannot be told apart from it is not showing skill.",
  "No verdict below 30 measured picks. ROI is a flat 1-unit stake, for comparison only — uncoloured below 300 settled.",
  "Pre-registered bots are scored on their current rule version only.",
];

export function BotsBoard({ data }: { data: BotBoardData }) {
  const { scoreboard, config, capabilities, retired, weekly, marketStats, now } = data;
  const [tab, setTab] = useState<"active" | "retired">("active");
  const [filter, setFilter] = useState<Filter>("all");
  const [help, setHelp] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<Record<string, LedgerState>>({});
  const opener = useRef<HTMLElement | null>(null);

  const cfgBy = useMemo(() => new Map(config.rows.map((c) => [c.bot_name, c])), [config.rows]);
  const capsBy = useMemo(() => new Map(capabilities.rows.map((c) => [c.bot_name, c])), [capabilities.rows]);
  const sbBy = useMemo(() => new Map(scoreboard.rows.map((s) => [s.bot_name, s])), [scoreboard.rows]);
  const weeklyBy = useMemo(() => {
    if (weekly.error) return null; // 411 not deployed → strip falls back to text
    const m = new Map<string, BotWeeklyRow[]>();
    for (const r of weekly.rows) m.set(r.bot_name, [...(m.get(r.bot_name) ?? []), r]);
    return m;
  }, [weekly]);
  const marketsBy = useMemo(() => {
    if (marketStats.error) return null; // 411 not deployed → pooled control, with a caveat
    const m = new Map<string, BotMarketStatsRow[]>();
    for (const r of marketStats.rows) m.set(r.bot_name, [...(m.get(r.bot_name) ?? []), r]);
    return m;
  }, [marketStats]);
  const control = useMemo(
    () => controlRef(sbBy.get(CONTROL_BOT), marketsBy ? marketsBy.get(CONTROL_BOT) ?? [] : null),
    [sbBy, marketsBy],
  );

  const allActive = useMemo(
    () =>
      scoreboard.rows
        .filter(isActive)
        .map((sb) =>
          buildView(sb.bot_name, sb, cfgBy.get(sb.bot_name), capsBy.get(sb.bot_name), { control, weekly: weeklyBy, markets: marketsBy, now, active: true }),
        ),
    [scoreboard.rows, cfgBy, capsBy, control, weeklyBy, marketsBy, now],
  );
  const controlView = allActive.find((v) => v.name === CONTROL_BOT);
  const active = useMemo(() => allActive.filter((v) => v.name !== CONTROL_BOT), [allActive]);

  const retiredViews: RetiredView[] = useMemo(() => {
    const byName = new Map<string, { sbName: string; info?: RetiredInfo }>();
    for (const r of retired.rows) byName.set(r.name, { sbName: r.name, info: r });
    for (const sb of scoreboard.rows) if (sb.retired_at && !byName.has(sb.bot_name)) byName.set(sb.bot_name, { sbName: sb.bot_name });
    return [...byName.entries()]
      .map(([name, { info }]) => {
        const sb = sbBy.get(name);
        const view = buildView(name, sb, cfgBy.get(name), capsBy.get(name), { control, weekly: weeklyBy, markets: marketsBy, now, active: false });
        return { view, info, retiredAt: info?.retired_at ?? sb?.retired_at ?? null, hadPicks: (sb?.picks_total ?? 0) > 0 };
      })
      .sort((a, b) => (b.retiredAt ?? "").localeCompare(a.retiredAt ?? ""));
  }, [retired.rows, scoreboard.rows, sbBy, cfgBy, capsBy, control, weeklyBy, marketsBy, now]);

  const filtered = useMemo(
    () =>
      active.filter((v) =>
        filter === "published" ? v.caps?.publish === true : filter === "capable" ? v.caps?.place_capable === true || v.caps?.place_enabled === true : true,
      ),
    [active, filter],
  );

  const groups = useMemo(() => {
    const m = new Map<string, BotView[]>();
    for (const v of filtered) m.set(v.family, [...(m.get(v.family) ?? []), v]);
    return FAMILY_ORDER.filter((f) => m.has(f) || (f === "forward_test" && controlView && filter === "all")).map((f) => ({
      family: f,
      bots: (m.get(f) ?? []).sort(sortBots),
    }));
  }, [filtered, controlView, filter]);

  const fleet = capabilities.rows[0];
  const pulse = fleet?.fleet_real_money_armed === true && fleet?.fleet_placement_paused === false;
  const issues = useMemo(
    () =>
      needsALook(
        active,
        fleet,
        [
          { view: "bot_scoreboard", error: scoreboard.error },
          { view: "bot_config", error: config.error },
          { view: "bot_capabilities", error: capabilities.error },
        ],
        now,
      ),
    [active, fleet, scoreboard.error, config.error, capabilities.error, now],
  );

  const exportedAt = useMemo(
    () => config.rows.reduce<string | null>((mx, c) => (c.exported_at && (!mx || c.exported_at > mx) ? c.exported_at : mx), null),
    [config.rows],
  );

  const open = useCallback(
    (name: string) => {
      opener.current = (document.activeElement as HTMLElement | null) ?? null;
      setSelected(name);
      const cur = ledgers[name];
      if (cur && (cur.loading || !cur.error)) return; // cached (refetch only after an error)
      setLedgers((prev) => ({ ...prev, [name]: { loading: true } }));
      fetch(`/api/admin/bot-ledger?bot=${encodeURIComponent(name)}`)
        .then(async (r) => {
          const j = (await r.json()) as { rows?: BotLedgerRow[]; error?: string | null };
          setLedgers((prev) => ({
            ...prev,
            [name]: { loading: false, rows: j.rows ?? [], error: r.ok ? j.error ?? null : j.error ?? `HTTP ${r.status}` },
          }));
        })
        .catch((e: unknown) => {
          setLedgers((prev) => ({ ...prev, [name]: { loading: false, rows: [], error: e instanceof Error ? e.message : String(e) } }));
        });
    },
    [ledgers],
  );

  const close = useCallback(() => setSelected(null), []);

  // Return focus to the row that opened the drawer once the drawer has unmounted (§12).
  // An effect rather than requestAnimationFrame: rAF does not fire in a hidden tab.
  useEffect(() => {
    if (selected || !opener.current) return;
    const el = opener.current;
    opener.current = null;
    if (document.contains(el)) el.focus();
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const selectedView = useMemo(() => {
    if (!selected) return null;
    return allActive.find((v) => v.name === selected) ?? retiredViews.find((r) => r.view.name === selected)?.view ?? null;
  }, [selected, allActive, retiredViews]);

  const ctx: RowCtx = { now, control, pulse, configError: config.error !== null, onOpen: open };
  const viewsMissing = scoreboard.error !== null;

  const tabCls = (on: boolean) =>
    `min-h-10 -mb-px border-b-2 px-3 py-2 text-sm ${on ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;
  const pillCls = (on: boolean) =>
    `min-h-10 rounded-full border px-3 py-1.5 text-sm ${on ? "border-foreground/40 bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-5">
      {/* title row */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold">Bots</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setHelp((h) => !h)}
            aria-expanded={help}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 hover:bg-accent hover:text-foreground"
          >
            <Info size={16} aria-hidden="true" /> How to read this
          </button>
          {exportedAt && (
            <span className="tabular-nums" title={`config exported ${utcStamp(exportedAt)} (${relTime(exportedAt, now)} ago)`}>
              data {hhmmUtc(exportedAt)}
            </span>
          )}
        </div>
      </div>
      {help && (
        <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <ul className="list-disc space-y-1 pl-4">
            {HOW_TO_READ.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="text-foreground">Capability icons:</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30"><Globe size={12} /></Legend>Published</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30"><Send size={12} /></Legend>Telegram</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30"><Wallet size={12} /></Legend>Real-money capable</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-red-500/20 text-red-300 ring-2 ring-red-500/60"><Banknote size={12} /></Legend>Real money ON</span>
            <span>– = collecting only (paper)</span>
          </div>
        </div>
      )}

      {viewsMissing && (
        <div className="flex gap-3 rounded-xl border border-amber-500/50 bg-amber-500/5 px-4 py-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
          <div className="space-y-1.5">
            <div className="font-semibold text-amber-400">Unified bot views not deployed yet</div>
            <p className="text-sm text-muted-foreground">
              This page reads <code>bot_scoreboard</code>, <code>bot_config</code>, <code>bot_capabilities</code> and <code>bot_ledger</code>{" "}
              (engine migration 410 + <code>scripts/export_bot_config.py</code>). It fills in by itself once they exist.
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {[scoreboard.error, config.error, capabilities.error].filter(Boolean).map((e) => (
                <li key={e as string} className="break-words">{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {viewsMissing ? (
        <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.08]">
          <div className="grid grid-cols-2 gap-px md:grid-cols-3 xl:grid-cols-6">
            {["Placement", "Real money", "Active bots", "Verdicts", "Picks · 7d", "Needs a look"].map((l) => (
              <div key={l} className="bg-card px-4 py-3">
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{l}</div>
                <div className="mt-1 text-2xl font-semibold text-muted-foreground">—</div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <FleetStrip
          fleet={fleet}
          caps={capabilities.rows}
          active={active}
          hasControl={!!controlView}
          issues={issues}
          capsMissing={capabilities.error !== null}
          onOpenBot={open}
        />
      )}

      {/* tabs + filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
          <div className="flex gap-1" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "active"} onClick={() => setTab("active")} className={tabCls(tab === "active")}>
              Active <span className="tabular-nums text-muted-foreground">{active.length + (controlView ? 1 : 0)}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "retired"} onClick={() => setTab("retired")} className={tabCls(tab === "retired")}>
              Retired <span className="tabular-nums text-muted-foreground">{retiredViews.length}</span>
            </button>
          </div>
          {tab === "active" && (
            <div className="flex flex-wrap gap-2 pb-2">
              {(
                [
                  ["all", "All"],
                  ["published", "Published"],
                  ["capable", "Real-money capable"],
                ] as [Filter, string][]
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={pillCls(filter === k)}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === "active" ? (
        groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {viewsMissing ? "No bots to show until the views are deployed." : filter === "all" ? "bot_scoreboard has no active bots." : "No active bot matches this filter."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <FamilySection
                key={g.family}
                family={g.family}
                bots={g.bots}
                ctx={ctx}
                controlBot={g.family === "forward_test" && filter === "all" ? controlView : undefined}
              />
            ))}
          </div>
        )
      ) : (
        <RetiredList rows={retiredViews} ctx={ctx} error={retired.error} />
      )}

      {selectedView && (
        <BotDrawer
          v={selectedView}
          now={now}
          ledger={ledgers[selectedView.name]}
          fleetPaused={fleet?.fleet_placement_paused ?? null}
          pulse={pulse}
          onClose={close}
        />
      )}
    </div>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${cls}`} aria-hidden="true">{children}</span>;
}
