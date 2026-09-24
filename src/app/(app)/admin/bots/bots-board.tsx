"use client";

// /admin/bots board — #139 UNIFIED-BOT-MODEL phase 1, redesigned 2026-09-24 per
// odds-intel-engine dev/active/bots-board-ux-spec.md (owner: the old table read "like a
// book with no images and just small text"), and turned into the control panel in phase A
// (dev/active/bots-control-panel-spec.md; owner: "control all the stuff via the bots page …
// more like a real admin dashboard").
//
// One row per ACTIVE bot, whatever ledger it writes, grouped by family. Each family is
// judged on ONE admissible metric; the verdict reads that metric only, in five states
// (beats / loses / inconclusive / too early / no CLV). The junk-anchored control is not a
// peer section — it is the dashed reference line on every mc-CLV plot and a reference strip
// on top of the forward test, because a bot sitting on that line is showing no skill.
//
// Phase A layout: admin shell (sidebar + status + armed bar) → header with actions → KPI strip
// → Controls card (customers / collection) → Real money card (the layer ladder + CAN STAKE,
// deliberately a DIFFERENT card, I10) → filter bar → table with inline switches and a row ⋯
// menu → right-hand detail Sheet with tabs. Filters, search and the open bot live in the URL.
//
// Files: bot-board-format.ts (text), bot-board-model.ts (verdicts, sorting, issues),
// bot-viz.tsx (forest bar, 12-week strip), bot-row.tsx (sections/rows), fleet-strip.tsx,
// bot-drawer.tsx + bot-sheet.tsx (detail), retired-list.tsx, and the control panel:
// controls-context.tsx, control-switch.tsx, bot-controls-cell.tsx, fleet-controls-card.tsx,
// real-money-card.tsx, ladder-list.tsx, confirm-control-dialog.tsx, arm-dialog.tsx,
// activity-timeline.tsx, admin-shell.tsx, toast.tsx.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Copy, History, Info, MoreHorizontal, Search, ArrowUpRight } from "lucide-react";
import type { BotBoardData, BotLedgerRow, BotMarketStatsRow, BotWeeklyRow, RetiredInfo } from "@/lib/bot-board";
import type { ControlState } from "@/lib/bot-controls/types";
import { placementPathReason } from "@/lib/bot-controls/placement-path";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CONTROL_BOT,
  FAMILY_ORDER,
  buildView,
  controlRef,
  isActive,
  needsALook,
  sortBots,
  type BotView,
  type Issue,
  type RetiredView,
} from "./bot-board-model";
import { hhmmUtc, relTime, utcStamp } from "./bot-board-format";
import { FamilySection, type RowCtx } from "./bot-row";
import { FleetStrip } from "./fleet-strip";
import { type LedgerState } from "./bot-drawer";
import { BotSheet, SHEET_TABS, type SheetTab } from "./bot-sheet";
import { RetiredList } from "./retired-list";
import { ControlsProvider, useControls } from "./controls-context";
import { AdminShell } from "./admin-shell";
import { FleetControlsCard } from "./fleet-controls-card";
import { RealMoneyCard } from "./real-money-card";
import { ActivitySheet } from "./activity-timeline";
import { useToast } from "./toast";
import { HowToRead } from "./how-to-read";
import { picksTelegramMismatch } from "./bot-controls-cell";

type Filter = "all" | "published" | "capable" | "silent" | "look";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["published", "Published"],
  ["capable", "Real-money capable"],
  ["silent", "Silent"],
  ["look", "Needs a look"],
];


export function BotsBoard({ data, controls }: { data: BotBoardData; controls: ControlState }) {
  const { scoreboard, config, capabilities, now } = data;
  const cfgBy = useMemo(() => new Map(config.rows.map((c) => [c.bot_name, c])), [config.rows]);
  const activeNames = useMemo(() => new Set(scoreboard.rows.filter(isActive).map((s) => s.bot_name)), [scoreboard.rows]);
  // Active bots with a placement path — the same rule the engine gate applies (placement-path.ts).
  const capable = useMemo(
    () =>
      config.error
        ? null
        : config.rows
            .filter((c) => activeNames.has(c.bot_name) && placementPathReason(c.family, c.ledger, c.books) == null)
            .map((c) => c.bot_name),
    [config, activeNames],
  );
  const views = useMemo(
    () => scoreboard.rows.map((sb) => buildView(sb.bot_name, sb, cfgBy.get(sb.bot_name), capabilities.rows.find((c) => c.bot_name === sb.bot_name), { control: null, weekly: null, markets: null, now, active: isActive(sb) })),
    [scoreboard.rows, cfgBy, capabilities.rows, now],
  );
  return (
    <ControlsProvider state={controls} views={views} capable={capable} now={now}>
      <AdminShell active="/admin/bots">
        <Board data={data} />
      </AdminShell>
    </ControlsProvider>
  );
}

function Board({ data }: { data: BotBoardData }) {
  const { scoreboard, config, capabilities, retired, weekly, marketStats, now } = data;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ctl = useControls();
  const toast = useToast();

  const tab = params.get("view") === "retired" ? "retired" : "active";
  const filter = (FILTERS.some(([k]) => k === params.get("f")) ? params.get("f") : "all") as Filter;
  const q = params.get("q") ?? "";
  const selected = params.get("bot");
  const sheetTab = (SHEET_TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as SheetTab) : "overview";

  const [help, setHelp] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [ledgers, setLedgers] = useState<Record<string, LedgerState>>({});
  const [search, setSearch] = useState(q);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || (k === "f" && v === "all") || (k === "view" && v === "active")) next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Debounced search → URL.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams({ q: search || null }), 250);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

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

  // ONE source for pause / arm (#139 review item 9): the control state, not bot_capabilities.
  const livePaused = ctl.current("placement_paused", null);
  const liveArmed = ctl.current("real_money_disarm", null);
  const fleetCaps = capabilities.rows[0];
  const fleet = useMemo(
    () => (fleetCaps ? { ...fleetCaps, fleet_placement_paused: livePaused, fleet_real_money_armed: liveArmed } : undefined),
    [fleetCaps, livePaused, liveArmed],
  );
  const pulse = liveArmed === true && livePaused === false;
  const issues: Issue[] = useMemo(() => {
    const base = needsALook(
      active,
      fleet,
      [
        { view: "bot_scoreboard", error: scoreboard.error },
        { view: "bot_config", error: config.error },
        { view: "bot_capabilities", error: capabilities.error },
      ],
      now,
    );
    // The Ludogorets shape (mig 356, I14): /picks and Telegram disagree for a bot.
    for (const v of active) {
      if (picksTelegramMismatch(v, ctl.current("show_on_picks", v.name))) {
        base.push({ bot: v.name, text: `${v.displayName}: /picks ≠ Telegram`, severity: "warn" });
      }
    }
    return base;
  }, [active, fleet, scoreboard.error, config.error, capabilities.error, now, ctl]);
  const lookBots = useMemo(() => new Set(issues.map((i) => i.bot).filter(Boolean) as string[]), [issues]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return active.filter((v) => {
      if (needle && !v.name.toLowerCase().includes(needle) && !v.displayName.toLowerCase().includes(needle)) return false;
      switch (filter) {
        case "published":
          return v.caps?.publish === true;
        case "capable":
          return ctl.capable?.has(v.name) === true || v.caps?.place_enabled === true;
        case "silent":
          return v.silent;
        case "look":
          return lookBots.has(v.name);
        default:
          return true;
      }
    });
  }, [active, filter, q, ctl.capable, lookBots]);

  const groups = useMemo(() => {
    const m = new Map<string, BotView[]>();
    for (const v of filtered) m.set(v.family, [...(m.get(v.family) ?? []), v]);
    const showControl = !!controlView && filter === "all" && !q;
    return FAMILY_ORDER.filter((f) => m.has(f) || (f === "forward_test" && showControl)).map((f) => ({
      family: f,
      bots: (m.get(f) ?? []).sort(sortBots),
    }));
  }, [filtered, controlView, filter, q]);

  const exportedAt = useMemo(
    () => config.rows.reduce<string | null>((mx, c) => (c.exported_at && (!mx || c.exported_at > mx) ? c.exported_at : mx), null),
    [config.rows],
  );
  const configStale = !!exportedAt && now - new Date(exportedAt).getTime() > 36 * 3600_000;

  const loadLedger = useCallback(
    (name: string) => {
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

  // The open bot lives in the URL (?bot=&tab=), so a deep link from Telegram opens it.
  useEffect(() => {
    if (selected) loadLedger(selected);
  }, [selected, loadLedger]);

  const open = useCallback((name: string, t?: string) => setParams({ bot: name, tab: t && t !== "overview" ? t : null }), [setParams]);
  const close = useCallback(() => setParams({ bot: null, tab: null }), [setParams]);

  const selectedView = useMemo(() => {
    if (!selected) return null;
    return allActive.find((v) => v.name === selected) ?? retiredViews.find((r) => r.view.name === selected)?.view ?? null;
  }, [selected, allActive, retiredViews]);

  // Linear-style keyboard: j/k move the row focus, Enter opens (row handler), Esc closes (Sheet).
  // No keyboard shortcut starts anything money-related.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (selected || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu]"))) return;
      if (e.key !== "j" && e.key !== "k") return;
      const rows = [...document.querySelectorAll<HTMLElement>("[data-bot-row]")].filter((el) => el.offsetParent !== null);
      if (rows.length === 0) return;
      const i = rows.findIndex((el) => el === document.activeElement);
      const next = e.key === "j" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i === -1 ? 0 : i - 1);
      rows[next].focus();
      rows[next].scrollIntoView({ block: "nearest" });
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const jump = useCallback(() => {
    document.getElementById("real-money")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlight(true);
    setTimeout(() => setHighlight(false), 1600);
  }, []);

  const copyState = useCallback(() => {
    const s = ctl.state;
    const json = JSON.stringify(
      {
        at: new Date(now).toISOString(),
        fleet: s.fleet.row,
        can_stake: ctl.ladder.canStake,
        blocked_at: ctl.ladder.blockedAt,
        eligibility: s.placers.rows.map((p) => ({ bot: p.bot_name, on: p.ui_place_enabled, locked: !!p.locked_reason })),
        executors: s.heartbeats.rows.map((h) => ({ placer: h.placer, last_seen_at: h.last_seen_at, execute: h.execute_requested })),
      },
      null,
      2,
    );
    navigator.clipboard?.writeText(json).then(
      () => toast({ tone: "info", title: "Page state copied as JSON" }),
      () => toast({ tone: "error", title: "Could not copy" }),
    );
  }, [ctl, now, toast]);

  const ctx: RowCtx = { now, control, pulse, configError: config.error !== null, onOpen: open };
  const viewsMissing = scoreboard.error !== null;

  const tabCls = (on: boolean) =>
    `min-h-10 -mb-px border-b-2 px-3 py-2 text-sm ${on ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;
  const pillCls = (on: boolean) =>
    `min-h-9 rounded-full border px-3 py-1 text-sm ${on ? "border-foreground/40 bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold">Bots</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {active.length} active{controlView ? " · 1 control" : ""}
            {exportedAt && (
              <span title={`config exported ${utcStamp(exportedAt)} (${relTime(exportedAt, now)} ago)`}> · data {hhmmUtc(exportedAt)}</span>
            )}
            {ctl.readOnly && <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300">Design preview · controls read-only</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <button type="button" onClick={() => setActivityOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 hover:bg-accent hover:text-foreground">
            <History size={16} aria-hidden="true" /> Activity
          </button>
          <button
            type="button"
            onClick={() => setHelp((h) => !h)}
            aria-expanded={help}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 hover:bg-accent hover:text-foreground"
          >
            <Info size={16} aria-hidden="true" /> How to read this
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-foreground">
              <MoreHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={copyState}>
                <Copy /> Copy page state as JSON
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/admin/feeds" />}>
                <ArrowUpRight /> Open /admin/feeds
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/admin/shadow-bots" />}>
                <ArrowUpRight /> Open /admin/shadow-bots
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {help && <HowToRead />}

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
      {configStale && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Config export stale ({relTime(exportedAt, now)} old). Real-money ON and /picks ON are disabled until export_bot_config runs — they depend on it.
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
          onOpenBot={(n) => open(n)}
          onJump={jump}
        />
      )}

      {/* Publishing and placement are in DIFFERENT cards on purpose (I10). */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FleetControlsCard />
        <RealMoneyCard highlight={highlight} />
      </div>

      {/* tabs + filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
          <div className="flex gap-1" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "active"} onClick={() => setParams({ view: "active" })} className={tabCls(tab === "active")}>
              Active <span className="tabular-nums text-muted-foreground">{active.length + (controlView ? 1 : 0)}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "retired"} onClick={() => setParams({ view: "retired" })} className={tabCls(tab === "retired")}>
              Retired <span className="tabular-nums text-muted-foreground">{retiredViews.length}</span>
            </button>
          </div>
        </div>
        {tab === "active" && (
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setParams({ f: k })} aria-pressed={filter === k} className={pillCls(filter === k)}>
                {l}
                {k === "look" && issues.length > 0 && <span className="ml-1 tabular-nums text-amber-300">{lookBots.size}</span>}
              </button>
            ))}
            <label className="relative ml-auto w-full sm:w-64">
              <span className="sr-only">Search bots</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name…"
                className="h-9 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          </div>
        )}
      </div>

      {tab === "active" ? (
        groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {viewsMissing ? "No bots to show until the views are deployed." : filter === "all" && !q ? "bot_scoreboard has no active bots." : "No active bot matches this filter."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <FamilySection
                key={g.family}
                family={g.family}
                bots={g.bots}
                ctx={ctx}
                controlBot={g.family === "forward_test" && filter === "all" && !q ? controlView : undefined}
              />
            ))}
          </div>
        )
      ) : (
        <RetiredList rows={retiredViews} ctx={ctx} error={retired.error} />
      )}

      <BotSheet
        v={selectedView}
        tab={sheetTab}
        onTab={(t) => setParams({ tab: t === "overview" ? null : t })}
        now={now}
        ledger={selectedView ? ledgers[selectedView.name] : undefined}
        markets={selectedView && marketsBy ? marketsBy.get(selectedView.name) ?? [] : null}
        fleetPaused={livePaused}
        pulse={pulse}
        onClose={close}
      />
      <ActivitySheet open={activityOpen} onClose={() => setActivityOpen(false)} now={now} />
    </div>
  );
}
