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
// Phase A layout: (shared admin shell: sidebar + status) → armed bar → header with actions → KPI strip
// → Publishing card (the customer picks channel; the Coolbet footprint pause moved to /admin/feeds) → Real money card (the layer ladder + CAN STAKE,
// deliberately a DIFFERENT card, I10) → filter bar → table with inline switches and a row ⋯
// menu → right-hand detail Sheet with tabs. Filters, search and the open bot live in the URL.
//
// Files: bot-board-format.ts (text), bot-board-model.ts (verdicts, sorting, issues),
// bot-viz.tsx (forest bar, 12-week strip), bot-row.tsx (sections/rows), fleet-strip.tsx,
// bot-drawer.tsx + bot-sheet.tsx (detail), retired-list.tsx, and the control panel:
// controls-context.tsx, control-switch.tsx, bot-controls-cell.tsx, fleet-controls-card.tsx,
// real-money-card.tsx, ladder-list.tsx, confirm-control-dialog.tsx, arm-dialog.tsx,
// activity-timeline.tsx, armed-bar.tsx, toast.tsx. The sidebar is the shared admin shell
// (src/components/admin/, rendered by admin/layout.tsx).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Copy, History, Info, MoreHorizontal, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/oi/panel";
import { StatCard } from "@/components/oi/stat-card";
import { StatusBadge } from "@/components/oi/status-badge";
import type { BotBoardData, BotFunnelRow, BotMarketStatsRow, BotPicksResult, BotRuleRow, BotWeeklyRow, RetiredInfo } from "@/lib/bot-board";
import type { ControlState } from "@/lib/bot-controls/types";
import { placementPathReason } from "@/lib/bot-controls/placement-path";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { withUnpickedBots,
  CONTROL_BOT,
  FAMILY_INFO,
  FAMILY_ORDER,
  buildView,
  controlRef,
  isActive,
  needsALook,
  quietInfo,
  sortBots,
  type BotView,
  type Issue,
  type RetiredView,
  reviewFlagIssues,
} from "./bot-board-model";
import { hhmmUtc, relTime, timeAgo, utcStamp } from "./bot-board-format";
import { FamilySection, type RowCtx } from "./bot-row";
import { FleetStrip } from "./fleet-strip";
import { type LedgerState } from "./bot-drawer";
import { BotSheet, SHEET_TABS, type SheetTab } from "./bot-sheet";
import { RetiredList } from "./retired-list";
import { ControlsProvider, useControls } from "./controls-context";
import { ArmedBar } from "./armed-bar";
import { FleetControlsCard } from "./fleet-controls-card";
import { RealMoneyCard } from "./real-money-card";
import { ActivitySheet } from "./activity-timeline";
import { useToast } from "./toast";
import { HowToRead } from "./how-to-read";
import { picksTelegramMismatch } from "./bot-controls-cell";
import {
  FacetChip,
  QuickViews,
  ResetButton,
  SORT_DEFAULT_DIR,
  SORT_LABEL,
  SearchBox,
  SortMenu,
  type FacetOption,
  type SortDir,
  type SortKey,
} from "./board-toolbar";
import { sorter } from "./bot-sort";

type Filter = "all" | "published" | "capable" | "silent" | "look";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["published", "On /picks"],
  ["capable", "Real-money capable"],
  ["silent", "Silent"],
  ["look", "Bot issues"],
];

const VERDICT_FACET: Record<string, string> = {
  beats: "Beats the close",
  loses: "Loses to the close",
  inconclusive: "Can't tell yet",
  early: "Too early (< 30 picks)",
  noclv: "In-play (no CLV)",
};

const listParam = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);


/** Ledger cache key: the full ledger, or the server-side "Bet made only" filter of it. */
const ledgerKey = (name: string, placedOnly: boolean) => (placedOnly ? `placed:${name}` : name);

async function fetchPicks(name: string, offset: number, placedOnly = false): Promise<Extract<LedgerState, { loading: false }>> {
  try {
    const r = await fetch(`/api/admin/bot-ledger?bot=${encodeURIComponent(name)}&limit=50&offset=${offset}${placedOnly ? "&placed=1" : ""}`);
    const j = (await r.json()) as Partial<BotPicksResult> & { error?: string | null };
    return {
      loading: false,
      rows: j.rows ?? [],
      error: r.ok ? j.error ?? null : j.error ?? `HTTP ${r.status}`,
      placedError: j.placedError ?? null,
      pricesError: j.pricesError ?? null,
      placementLinked: j.placementLinked ?? true,
      hasMore: j.hasMore ?? false,
      placedPicks: j.placedPicks ?? null,
      placedOnly: j.placedOnly ?? placedOnly,
    };
  } catch (e) {
    return { loading: false, rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function BotsBoard({ data, controls }: { data: BotBoardData; controls: ControlState }) {
  const { config, capabilities, now } = data;
  // + registered active bots that have not picked yet (no bot_scoreboard row) — withUnpickedBots
  const scoreboard = useMemo(
    () => ({ ...data.scoreboard, rows: withUnpickedBots(data.scoreboard.rows, config.rows, controls.bots.error ? [] : controls.bots.rows) }),
    [data.scoreboard, config.rows, controls.bots],
  );
  const boardData = useMemo(() => ({ ...data, scoreboard }), [data, scoreboard]);
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
      {/* Sidebar + status come from the shared admin layout (src/app/(app)/admin/layout.tsx). */}
      <ArmedBar />
      <Board data={boardData} />
    </ControlsProvider>
  );
}

function Board({ data }: { data: BotBoardData }) {
  const { scoreboard, config, capabilities, retired, weekly, marketStats, reviewFlags, funnel, byRule, now } = data;
  const pathname = usePathname();
  const params = useSearchParams();
  const ctl = useControls();
  const toast = useToast();

  const tab = params.get("view") === "retired" ? "retired" : "active";
  const filter = (FILTERS.some(([k]) => k === params.get("f")) ? params.get("f") : "all") as Filter;
  const q = params.get("q") ?? "";
  const selected = params.get("bot");
  const famParam = params.get("fam");
  const verParam = params.get("ver");
  const famSel = useMemo(() => listParam(famParam), [famParam]);
  const verSel = useMemo(() => listParam(verParam), [verParam]);
  const sortParam = params.get("sort");
  const sortKey = (sortParam && sortParam in SORT_LABEL ? sortParam : "verdict") as SortKey;
  const sortDir = (params.get("dir") === "asc" || params.get("dir") === "desc" ? params.get("dir") : SORT_DEFAULT_DIR[sortKey]) as SortDir;
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
        if (v == null || v === "" || (k === "f" && v === "all") || (k === "view" && v === "active") || (k === "sort" && v === "verdict")) next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      // SPEED (owner 2026-09-24: "bots page is super slow"): the filters, search, sort, open bot
      // and sheet tab live in the URL so links work — but router.replace() re-ran this
      // force-dynamic page on the SERVER (every bot view + control read, ~300 KB payload) on every
      // click and search keystroke. The native History API updates the URL and useSearchParams
      // with no server round trip (Next.js ≥ 14.1). router.refresh() after a control write still
      // re-reads, which is the one time fresh data is needed.
      window.history.replaceState(null, "", s ? `${pathname}?${s}` : pathname);
    },
    [params, pathname],
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
  const funnelBy = useMemo(() => {
    if (funnel.error) return null; // migration 456 not deployed → the panel says so
    const m = new Map<string, BotFunnelRow[]>();
    for (const r of funnel.rows) m.set(r.bot, [...(m.get(r.bot) ?? []), r]);
    return m;
  }, [funnel]);
  const byRuleBy = useMemo(() => {
    if (byRule.error) return null; // migration 461 not deployed → the table is simply absent
    const m = new Map<string, BotRuleRow[]>();
    for (const r of byRule.rows) m.set(r.bot_name, [...(m.get(r.bot_name) ?? []), r]);
    return m;
  }, [byRule]);
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
  // Bots whose real money is locked (coolbet_placer_bots.locked_reason): with a retired source,
  // their silence is by design — information, not an issue (quietByDesign).
  const lockedBots = useMemo(
    () => new Set(ctl.state.placers.rows.filter((p) => !!p.locked_reason).map((p) => p.bot_name)),
    [ctl.state.placers.rows],
  );
  const quiet = useMemo(() => quietInfo(active, lockedBots), [active, lockedBots]);
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
      { lockedBots },
    );
    // The Ludogorets shape (mig 356, I14): /picks and Telegram disagree for a bot.
    for (const v of active) {
      if (picksTelegramMismatch(v, ctl.current("show_on_picks", v.name))) {
        base.push({ bot: v.name, text: `${v.displayName}: /picks ≠ Telegram`, severity: "warn" });
      }
    }
    // [[#155]] "review this bot" — n >= 50 settled, sharp-anchor CLV CI entirely below 0 (a flag, the
    // owner decides; never automatic retirement). Same helper as the Overview inbox.
    const nameOf = (bot: string) => active.find((v) => v.name === bot)?.displayName ?? bot;
    if (reviewFlags.error) base.push({ text: `Review flags unreadable (${reviewFlags.error})`, severity: "warn" });
    else base.push(...reviewFlagIssues(reviewFlags.rows, nameOf));
    return base;
  }, [active, fleet, scoreboard.error, config.error, capabilities.error, now, ctl, lockedBots, reviewFlags]);
  const lookBots = useMemo(() => new Set(issues.map((i) => i.bot).filter(Boolean) as string[]), [issues]);

  const filtered = useMemo(() => {
    // "1x2" finds "1×2 …": fold the multiplication sign and case on both sides
    const fold = (t: string) => t.toLowerCase().replace(/×/g, "x");
    const needle = fold(q.trim());
    return active.filter((v) => {
      if (needle && !fold(v.name).includes(needle) && !fold(v.displayName).includes(needle) && !fold(v.identity).includes(needle)) return false;
      if (famSel.length && !famSel.includes(v.family)) return false;
      if (verSel.length && !verSel.includes(v.verdict)) return false;
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
  }, [active, filter, q, ctl.capable, lookBots, famSel, verSel]);

  const groups = useMemo(() => {
    const m = new Map<string, BotView[]>();
    for (const v of filtered) m.set(v.family, [...(m.get(v.family) ?? []), v]);
    const showControl = !!controlView && filter === "all" && !q && !famSel.length && !verSel.length;
    const cmp = sortKey === "verdict" && sortDir === "asc" ? sortBots : sorter(sortKey, sortDir);
    return FAMILY_ORDER.filter((f) => m.has(f) || (f === "forward_test" && showControl)).map((f) => ({
      family: f,
      bots: (m.get(f) ?? []).sort(cmp),
    }));
  }, [filtered, controlView, filter, q, sortKey, sortDir, famSel, verSel]);
  const noFacets = filter === "all" && !q && !famSel.length && !verSel.length;

  const famOptions: FacetOption[] = useMemo(
    () =>
      FAMILY_ORDER.map((f) => ({ value: f as string, label: FAMILY_INFO[f].title, count: active.filter((v) => v.family === f).length })).filter((o) => o.count > 0),
    [active],
  );
  const verOptions: FacetOption[] = useMemo(
    () => Object.entries(VERDICT_FACET).map(([k, label]) => ({ value: k, label, count: active.filter((v) => v.verdict === k).length })).filter((o) => o.count > 0),
    [active],
  );
  const onSort = useCallback(
    (k: SortKey) => {
      const dir = k === sortKey ? (sortDir === "asc" ? "desc" : "asc") : SORT_DEFAULT_DIR[k];
      setParams({ sort: k, dir: dir === SORT_DEFAULT_DIR[k] && k === "verdict" ? null : dir });
    },
    [sortKey, sortDir, setParams],
  );

  const exportedAt = useMemo(
    () => config.rows.reduce<string | null>((mx, c) => (c.exported_at && (!mx || c.exported_at > mx) ? c.exported_at : mx), null),
    [config.rows],
  );
  const configStale = !!exportedAt && now - new Date(exportedAt).getTime() > 36 * 3600_000;

  // "Bet made only" in the Picks tab — a SERVER-side filter over the whole ledger (#139 UX fix
  // round), cached separately from the full ledger. Not in the URL: it is a view of one tab.
  const [placedOnly, setPlacedOnly] = useState(false);

  const loadLedger = useCallback(
    (name: string, onlyPlaced = false) => {
      const key = ledgerKey(name, onlyPlaced);
      const cur = ledgers[key];
      if (cur && (cur.loading || !cur.error)) return; // cached (refetch only after an error)
      setLedgers((prev) => ({ ...prev, [key]: { loading: true } }));
      fetchPicks(name, 0, onlyPlaced).then((r) => setLedgers((prev) => ({ ...prev, [key]: r })));
    },
    [ledgers],
  );

  // "Load 50 older picks" in the sheet's Picks tab (IA move P7: the full ledger, a page at a time).
  const loadMore = useCallback(
    (name: string, onlyPlaced = false) => {
      const key = ledgerKey(name, onlyPlaced);
      const cur = ledgers[key];
      if (!cur || cur.loading || cur.loadingMore || !cur.hasMore) return;
      setLedgers((prev) => ({ ...prev, [key]: { ...cur, loadingMore: true, moreError: null } }));
      fetchPicks(name, cur.rows.length, onlyPlaced).then((r) =>
        setLedgers((prev) => {
          const base = prev[key];
          if (!base || base.loading) return prev;
          if (r.error) return { ...prev, [key]: { ...base, loadingMore: false, moreError: r.error } };
          return {
            ...prev,
            [key]: {
              ...base,
              rows: [...base.rows, ...r.rows],
              hasMore: r.hasMore,
              loadingMore: false,
              placedError: base.placedError ?? r.placedError,
              pricesError: base.pricesError ?? r.pricesError,
            },
          };
        }),
      );
    },
    [ledgers],
  );

  // The open bot lives in the URL (?bot=&tab=), so a deep link from Telegram opens it.
  useEffect(() => {
    if (selected) loadLedger(selected, placedOnly);
  }, [selected, placedOnly, loadLedger]);

  const open = useCallback(
    (name: string, t?: string) => {
      setPlacedOnly(false);
      setParams({ bot: name, tab: t && t !== "overview" ? t : null });
    },
    [setParams],
  );
  const close = useCallback(() => {
    setPlacedOnly(false);
    setParams({ bot: null, tab: null });
  }, [setParams]);

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
  // Placement stat card → straight to the kill switch (#139 UX fix round, item 10): scroll the
  // Pause / Resume box into the middle of the screen and focus its first enabled button, so on a
  // phone one tap from the top of the page lands on the control. Focus only — nothing is pressed.
  const jumpKill = useCallback(() => {
    const box = document.getElementById("kill-switch");
    if (!box) return jump();
    const btn = box.querySelector<HTMLButtonElement>("[data-kill-switch-action]:not(:disabled)");
    (btn ?? box).scrollIntoView({ behavior: "smooth", block: "center" });
    btn?.focus({ preventScroll: true });
    setHighlight(true);
    setTimeout(() => setHighlight(false), 1600);
  }, [jump]);

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
  const actionCls =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Bots & money"
        title="Bots"
        meta={
          <span className="tabular-nums">
            {active.length} active{controlView ? " · 1 control" : ""}
            {exportedAt && (
              <span title={`config exported ${utcStamp(exportedAt)} (${timeAgo(exportedAt, now)})`}> · data {hhmmUtc(exportedAt)}</span>
            )}
            {ctl.readOnly && (
              <span className="ml-2 align-middle">
                <StatusBadge tone="warning">Design preview · controls read-only</StatusBadge>
              </span>
            )}
          </span>
        }
        actions={
          <>
            <button type="button" onClick={() => setActivityOpen(true)} className={actionCls}>
              <History size={13} aria-hidden="true" /> Activity
            </button>
            <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} className={actionCls}>
              <Info size={13} aria-hidden="true" /> How to read
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                <MoreHorizontal size={14} />
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
          </>
        }
      />

      {help && <HowToRead />}

      {viewsMissing && (
        <div className="flex gap-3 rounded-xl border border-warning/50 bg-warning/5 px-4 py-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1.5">
            <div className="font-semibold text-warning">Unified bot views not deployed yet</div>
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
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Config export stale ({relTime(exportedAt, now)} old). Real-money ON and /picks ON are disabled until export_bot_config runs — they depend on it.
        </div>
      )}

      {viewsMissing ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {["Kill switch", "Real money", "Active bots", "Verdicts", "Picks · 7 days", "Bot issues"].map((l) => (
            <StatCard key={l} label={l} value="—" unknown foot="views not deployed" />
          ))}
        </div>
      ) : (
        <FleetStrip
          fleet={fleet}
          caps={capabilities.rows}
          active={active}
          hasControl={!!controlView}
          issues={issues}
          quiet={quiet}
          capsMissing={capabilities.error !== null}
          onOpenBot={(n) => open(n)}
          onJump={jump}
          onJumpKill={jumpKill}
        />
      )}

      {/* Publishing and placement are in DIFFERENT cards on purpose (I10). */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <FleetControlsCard />
        <RealMoneyCard highlight={highlight} />
      </div>

      {/* tabs + toolbar (DataTable's look — see board-toolbar.tsx for why this is not a DataTable) */}
      <div className="space-y-3">
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
            <SearchBox value={search} onChange={setSearch} placeholder="Search bots…" />
            <FacetChip label="Family" options={famOptions} selected={famSel} onChange={(n) => setParams({ fam: n.join(",") || null })} />
            <FacetChip label="Verdict" options={verOptions} selected={verSel} onChange={(n) => setParams({ ver: n.join(",") || null })} />
            <QuickViews
              options={FILTERS.map(([k, l]) => ({ value: k, label: l, badge: k === "look" ? lookBots.size : undefined }))}
              value={filter}
              onChange={(k) => setParams({ f: k })}
            />
            {!noFacets && (
              <ResetButton
                onClick={() => {
                  setSearch("");
                  setParams({ q: null, f: null, fam: null, ver: null });
                }}
              />
            )}
            <div className="ml-auto">
              <SortMenu sort={sortKey} dir={sortDir} onChange={(k, d) => setParams({ sort: k, dir: k === "verdict" && d === "asc" ? null : d })} />
            </div>
          </div>
        )}
      </div>

      {tab === "active" ? (
        groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {viewsMissing ? "No bots to show until the views are deployed." : noFacets ? "bot_scoreboard has no active bots." : "No active bot matches these filters."}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <FamilySection
                key={g.family}
                family={g.family}
                bots={g.bots}
                ctx={ctx}
                controlBot={g.family === "forward_test" && noFacets ? controlView : undefined}
                sort={{ key: sortKey, dir: sortDir, onSort }}
              />
            ))}
            <p className="px-1 text-xs text-muted-foreground tabular-nums">
              {filtered.length === active.length ? `${active.length} bots` : `${filtered.length} of ${active.length} bots`} · sorted by {SORT_LABEL[sortKey].replace(" (default)", "").toLowerCase()} within each family
            </p>
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
        ledger={selectedView ? ledgers[ledgerKey(selectedView.name, placedOnly)] : undefined}
        onMore={selectedView ? () => loadMore(selectedView.name, placedOnly) : undefined}
        placedOnly={placedOnly}
        onPlacedOnly={setPlacedOnly}
        markets={selectedView && marketsBy ? marketsBy.get(selectedView.name) ?? [] : null}
        weekly={selectedView && weeklyBy ? weeklyBy.get(selectedView.name) ?? ([] as BotWeeklyRow[]) : null}
        funnel={selectedView && funnelBy ? funnelBy.get(selectedView.name) ?? [] : null}
        byRule={selectedView && byRuleBy ? byRuleBy.get(selectedView.name) ?? [] : null}
        fleetPaused={livePaused}
        pulse={pulse}
        onClose={close}
      />
      <ActivitySheet open={activityOpen} onClose={() => setActivityOpen(false)} now={now} />
    </div>
  );
}
