"use client";

// /admin/bots — one family section and its bot rows (#139, bots-board-ux-spec §2.1, §4, §6).
//
// A row is a CSS grid (not a <table>) so the answer — verdict, forest bar, N · ROI, last
// pick, capabilities — fits the 1,216 px content width with no horizontal scroll. Below
// `lg` the same row renders as a card. Every state is icon + word; colour is never the
// only carrier (§12).

import type { KeyboardEvent, ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  Brain,
  Crosshair,
  Equal,
  FlaskConical,
  Globe,
  Hourglass,
  Minus,
  Radar,
  Send,
  ShieldQuestion,
  Timer,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { BotCapabilitiesRow } from "@/lib/bot-board";
import {
  FAMILY_INFO,
  METRIC_LABEL,
  METRIC_PILL,
  METRIC_SHORT,
  MIN_N,
  type Accent,
  type BotView,
  type ControlRef,
  type FamilyInfo,
  type Metric,
  type Verdict,
} from "./bot-board-model";
import { ciHalf, count, fmtRuleVersion, minutesAgo, pct, relTime, tStat, utcStamp } from "./bot-board-format";
import { ForestAxis, ForestBar, WeeklyStrip } from "./bot-viz";
import { ControlsCell } from "./bot-controls-cell";
import { ControlStrip } from "./control-strip";
import type { SortDir, SortKey } from "./board-toolbar";

// ─── tokens ──────────────────────────────────────────────────────────────────

export const ACCENT: Record<Accent, { bar: string; text: string }> = {
  teal: { bar: "border-l-method-consensus", text: "text-method-consensus" },
  violet: { bar: "border-l-method-sharp", text: "text-method-sharp" },
  sky: { bar: "border-l-method-model", text: "text-method-model" },
  amber: { bar: "border-l-warning", text: "text-warning" },
  amberStrong: { bar: "border-l-warning", text: "text-warning" },
};

export function FamilyIcon({ icon, className }: { icon: FamilyInfo["icon"]; className?: string }) {
  const p = { className, "aria-hidden": true as const, size: 16 };
  switch (icon) {
    case "flask": return <FlaskConical {...p} />;
    case "crosshair": return <Crosshair {...p} />;
    case "radar": return <Radar {...p} />;
    case "brain": return <Brain {...p} />;
    case "timer": return <Timer {...p} />;
    case "control": return <Equal {...p} />;
    default: return <AlertTriangle {...p} />;
  }
}

const VERDICT_UI: Record<Verdict, { label: string; cls: string; Icon: typeof TrendingUp; title: string }> = {
  beats: {
    label: "Beats close",
    cls: "text-success bg-success/10 border-success/40",
    Icon: TrendingUp,
    title: `At least ${MIN_N} measured picks and t ≥ 2: priced better than the close. Not a promotion by itself.`,
  },
  loses: {
    label: "Loses to close",
    cls: "text-danger bg-danger/10 border-danger/40",
    Icon: TrendingDown,
    title: `At least ${MIN_N} measured picks and t ≤ −2: priced worse than the close.`,
  },
  inconclusive: {
    label: "Inconclusive",
    cls: "text-warning bg-warning/10 border-warning/30",
    Icon: Minus,
    title: `At least ${MIN_N} measured picks but |t| < 2: cannot be told from zero yet.`,
  },
  early: {
    label: "Too early",
    cls: "text-muted-foreground bg-muted/40 border-border",
    Icon: Hourglass,
    title: `Fewer than ${MIN_N} measured picks — no verdict.`,
  },
  noclv: {
    label: "No CLV",
    cls: "text-muted-foreground border-dashed border-border",
    Icon: Timer,
    title: "In-play: there is no closing line, so the bot is judged on lift (not computed yet).",
  },
};

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const u = VERDICT_UI[verdict];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${u.cls}`} title={u.title}>
      <u.Icon size={14} aria-hidden="true" />
      {u.label}
    </span>
  );
}

export function ControlLine({ v }: { v: BotView }) {
  if (!v.control) return null;
  const { cmp, t, caveats } = v.control;
  const cls = cmp === "equal" ? "text-warning" : cmp === "above" ? "text-success" : "text-danger";
  const text = cmp === "equal" ? "≈ junk control" : cmp === "above" ? "above junk control" : "below junk control";
  const title =
    `Difference from the junk-anchored control on the same market mix, t ${t.toFixed(1)}. ` +
    (cmp === "equal" ? "|t| < 2: cannot be told apart from the junk control. " : "") +
    "The arms share matches, so the combined standard error is approximate." +
    (caveats.length ? ` Caveats: ${caveats.join("; ")}.` : "");
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`} title={title}>
      <span className="whitespace-nowrap">{text}</span>
      {caveats.length > 0 && <span className="text-muted-foreground">({caveats.length === 1 ? "caveat" : `${caveats.length} caveats`} ⓘ)</span>}
    </span>
  );
}

export function EarlyProgress({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
      <span className="relative h-1 w-16 overflow-hidden rounded-full bg-muted/60" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 bg-muted-foreground/60" style={{ width: `${Math.min(100, (n / MIN_N) * 100)}%` }} />
      </span>
      <span>
        {n} / {MIN_N}
        {n === 0 && " · no measured CLV yet"}
      </span>
    </div>
  );
}

export function VerdictCell({ v }: { v: BotView }) {
  return (
    <div className="space-y-1">
      <VerdictChip verdict={v.verdict} />
      {v.verdict === "early" ? (
        <EarlyProgress n={v.metric.n ?? 0} />
      ) : v.verdict !== "noclv" ? (
        <div className="text-xs tabular-nums text-muted-foreground">{tStat(v.metric.t)}</div>
      ) : null}
      <ControlLine v={v} />
    </div>
  );
}

// ─── CLV cell ────────────────────────────────────────────────────────────────

function meanTone(v: BotView): string {
  if (v.verdict === "early" || v.metric.mean == null) return "text-muted-foreground";
  return v.metric.mean >= 0 ? "text-success" : "text-danger";
}

/** Flat-stake ROI is noise at small n — colour it only from this many settled picks. */
export const ROI_COLOUR_MIN = 300;

export function roiTone(settled: number, roi: number | null | undefined): string {
  if (settled < ROI_COLOUR_MIN || roi == null) return "text-muted-foreground";
  return roi >= 0 ? "text-success" : "text-danger";
}

export function hitVsBreakEven(v: BotView): string {
  const won = v.sb?.won ?? 0;
  const lost = v.sb?.lost ?? 0;
  if (won + lost === 0) return "no settled picks";
  const hit = `hit ${Math.round((won / (won + lost)) * 100)}%`;
  return v.breakEven != null ? `${hit} vs ${Math.round(v.breakEven * 100)}% needed to break even` : `${hit} (break-even not available)`;
}

export function ClvCell({ v, withAxis = false }: { v: BotView; withAxis?: boolean }) {
  if (v.metric.metric === "lift") {
    const settled = v.sb?.settled ?? 0;
    return (
      <div className="text-xs text-muted-foreground">
        <div className="text-sm tabular-nums">
          ROI <span className={roiTone(settled, v.sb?.roi_unit)}>{settled > 0 ? pct(v.sb?.roi_unit) : "—"}</span>
          <span className="text-xs text-muted-foreground"> · {hitVsBreakEven(v)}</span>
        </div>
        No closing line — judged on lift (not computed yet)
      </div>
    );
  }
  if (v.metric.mean == null || !v.metric.n) {
    return <div className="text-xs text-muted-foreground">no measured CLV yet</div>;
  }
  return (
    <div className="flex items-end gap-3">
      <div className="w-[64px] shrink-0 text-right">
        <div className={`text-sm font-semibold tabular-nums ${meanTone(v)}`}>{pct(v.metric.mean)}</div>
        <div className="text-xs tabular-nums text-muted-foreground">{ciHalf(v.metric.se) || "no CI"}</div>
      </div>
      <div className="min-w-0 flex-1">
        {withAxis && <ForestAxis />}
        <ForestBar mean={v.metric.mean} se={v.metric.se} n={v.metric.n} metric={v.metric.metric} verdict={v.verdict} control={v.controlLine} />
      </div>
    </div>
  );
}

// ─── strip / N·ROI / last / caps ─────────────────────────────────────────────

function StripCell({ v }: { v: BotView }) {
  const p7 = v.sb?.picks_7d ?? 0;
  // picks_7d is a ROLLING 7 days, not the calendar week the last bar shows — say so.
  if (!v.weeks) return <div className="text-xs tabular-nums text-muted-foreground">{count(p7)} picks · last 7 d</div>;
  return (
    <div className="space-y-0.5">
      <WeeklyStrip weeks={v.weeks} metric={v.metric.metric} compact />
      <div className="text-xs tabular-nums text-muted-foreground">{count(p7)} in last 7 d</div>
    </div>
  );
}

const ROI_TITLE = `Settled picks · ROI on a flat 1-unit stake per pick AT OUR BOOKS (best of Coolbet / Epicbet / Tonybet / Unibet-Site at pick time) — comparable across bots, not their real staking. Second line: the same at the best price available on ALL books, the figure /performance shows (one definition, view bot_performance — #159). Coloured only from ${ROI_COLOUR_MIN} settled picks; below that it is noise.`;

export function NRoiCell({ v }: { v: BotView }) {
  const settled = v.sb?.settled ?? 0;
  const roi = v.sb?.roi_unit;
  const tone = roiTone(settled, roi);
  return (
    <div title={ROI_TITLE}>
      <div className="text-sm tabular-nums whitespace-nowrap">
        <span className="text-foreground">{count(settled)}</span>
        <span className="text-muted-foreground"> · </span>
        <span className={tone}>{settled > 0 ? pct(roi) : "—"}</span>
      </div>
      {settled > 0 && v.sb?.roi_public != null && (
        <div className="text-xs tabular-nums text-muted-foreground" title="Best price available on all books at pick time — the /performance figure">
          all books {pct(v.sb.roi_public)}
        </div>
      )}
      {(v.sb?.pending ?? 0) > 0 && <div className="text-xs tabular-nums text-muted-foreground">+{count(v.sb?.pending)} pending</div>}
    </div>
  );
}

export function LastPick({ iso, now, active }: { iso: string | null | undefined; now: number; active: boolean }) {
  const m = minutesAgo(iso, now);
  const stale = active && m != null && m > 7 * 1440;
  const cls = m == null ? "text-muted-foreground" : m < 1440 ? "text-foreground" : stale ? "text-danger" : "text-warning";
  return (
    <span className={`inline-flex items-center gap-1 text-sm tabular-nums whitespace-nowrap ${cls}`} title={iso ? utcStamp(iso) : "No picks yet"}>
      {stale && <AlertCircle size={14} aria-label="silent for more than 7 days" />}
      {relTime(iso, now)}
    </span>
  );
}

const CAP_ICON = "inline-flex h-5 w-5 items-center justify-center rounded-full";

export function capList(caps: BotCapabilitiesRow | undefined, pulse: boolean) {
  if (!caps) return [];
  const out: { key: string; icon: ReactNode; word: string; title: string; cls: string }[] = [];
  if (caps.publish) out.push({ key: "publish", icon: <Globe size={12} />, word: "Published", title: "Published on /picks and the public track record", cls: "bg-method-consensus/15 text-method-consensus ring-1 ring-method-consensus/30" });
  if (caps.telegram) out.push({ key: "telegram", icon: <Send size={12} />, word: "Telegram", title: "Sent to the Telegram channel", cls: "bg-info/15 text-info ring-1 ring-info/30" });
  if (caps.place_capable && !caps.place_enabled) out.push({ key: "capable", icon: <Wallet size={12} />, word: "Real-money capable", title: "A placer could stake real money on it — switched off", cls: "bg-warning/10 text-warning ring-1 ring-warning/30" });
  if (caps.place_enabled) out.push({ key: "on", icon: <Banknote size={12} />, word: "Real money ON", title: "Real-money placement is switched ON for this bot", cls: `bg-danger/20 text-danger ring-2 ring-danger/60 ${pulse ? "motion-safe:animate-pulse" : ""}` });
  return out;
}

export function CapsCell({ caps, pulse }: { caps: BotCapabilitiesRow | undefined; pulse: boolean }) {
  if (!caps) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="bot_capabilities has no row for this bot (or could not be read)">
        <ShieldQuestion size={14} aria-hidden="true" /> ?
      </span>
    );
  }
  // Money state is shown by the € switch (placement-path rule + eligibility row), so the icon
  // row keeps only publish / Telegram — the older bot_capabilities money flags could disagree.
  const list = capList(caps, pulse).filter((c) => c.key === "publish" || c.key === "telegram");
  return (
    <div className="flex flex-wrap items-center gap-1">
      {caps.collect === false && (
        <span className="rounded-md border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-xs text-danger">Not collecting</span>
      )}
      {list.map((c) => (
        <span key={c.key} className={`${CAP_ICON} ${c.cls}`} title={c.title} aria-label={c.word} role="img">
          {c.icon}
        </span>
      ))}
      {list.length === 0 && caps.collect !== false && (
        <span className="text-sm text-muted-foreground" title="Collecting only (paper)">–</span>
      )}
    </div>
  );
}

// ─── bot cell ────────────────────────────────────────────────────────────────

export function RulePill({ v }: { v: BotView }) {
  const rv = fmtRuleVersion(v.sb?.scored_rule_version);
  if (!rv) return null;
  const earlier = v.sb?.earlier_version_picks ?? 0;
  const cfgRv = v.configRuleVersion ? fmtRuleVersion(v.configRuleVersion) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span
        className="rounded bg-method-consensus/10 px-1.5 font-mono text-xs text-method-consensus"
        title={`Pre-registered: scored on ${v.sb?.scored_rule_version} only. A rule change starts a new population.`}
      >
        {rv}
      </span>
      {cfgRv && (
        <span
          className="rounded bg-warning/10 px-1.5 font-mono text-xs text-warning"
          title={`The running config is ${v.configRuleVersion}, but the scoreboard scores ${v.sb?.scored_rule_version} (the version on the latest pick). The rules shown describe the config, not necessarily the scored picks.`}
        >
          config {cfgRv.split(" ·")[0]} · scoring {rv.split(" ·")[0]}
        </span>
      )}
      {earlier > 0 && <span className="text-xs text-muted-foreground">+{count(earlier)} earlier picks not pooled</span>}
    </div>
  );
}

function IdentityLine({ v, configError }: { v: BotView; configError: boolean }) {
  if (configError) return <div className="text-xs text-warning">config unavailable</div>;
  if (!v.cfg) return <div className="text-xs text-warning">no config — family unknown</div>;
  return (
    <div className="line-clamp-2 text-xs text-muted-foreground" title={v.identity}>
      {v.identity || "—"}
    </div>
  );
}

function NameLine({ v }: { v: BotView }) {
  return (
    <div className="line-clamp-2 text-sm font-medium text-foreground" title={`${v.displayName} (${v.name})${v.identity ? ` — ${v.identity}` : ""}`}>
      {v.displayName}
    </div>
  );
}

// ─── row ─────────────────────────────────────────────────────────────────────

// The table layout only from `xl` (≥1280 px): at 1024 the fixed columns clipped Caps and the
// axis ticks collided. Below xl every row is a card.
// #139 phase A (control-panel spec §3.5): the 80 px Caps column became the ~168 px Controls
// column — the /picks and € switches, the read-only Telegram / performance icons and the row ⋯
// menu. The capability icons still appear in the detail sheet header.
export const ROW_GRID =
  "xl:grid xl:grid-cols-[minmax(170px,1.3fr)_128px_minmax(200px,1.6fr)_104px_92px_56px_236px] xl:items-center xl:gap-x-4";

export interface RowCtx {
  now: number;
  control: ControlRef | null;
  pulse: boolean;
  configError: boolean;
  onOpen: (name: string, tab?: string) => void;
}

export function onKeyOpen(e: KeyboardEvent, open: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    open();
  }
}

export function BotRow({ v, ctx, active = true }: { v: BotView; ctx: RowCtx; active?: boolean }) {
  const open = () => ctx.onOpen(v.name);
  const openTab = (tab?: string) => ctx.onOpen(v.name, tab);
  return (
    <div
      role="button"
      tabIndex={0}
      data-bot-row={v.name}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return; // keys inside a switch / menu are theirs
        onKeyOpen(e, open);
      }}
      title={v.name}
      aria-label={`${v.displayName} — open details`}
      className="group cursor-pointer rounded-lg border border-border bg-card p-3 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring xl:rounded-none xl:border-0 xl:border-t xl:bg-transparent xl:px-4 xl:py-3"
    >
      {/* desktop */}
      <div className={`hidden ${ROW_GRID}`}>
        <div className="min-w-0 space-y-0.5">
          <NameLine v={v} />
          <IdentityLine v={v} configError={ctx.configError} />
          <RulePill v={v} />
        </div>
        <VerdictCell v={v} />
        <ClvCell v={v} />
        <StripCell v={v} />
        <NRoiCell v={v} />
        <LastPick iso={v.sb?.last_pick_at} now={ctx.now} active={active} />
        <ControlsCell v={v} now={ctx.now} onOpen={openTab} />
      </div>
      {/* card (below xl) */}
      <div className="space-y-2 xl:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <NameLine v={v} />
            <IdentityLine v={v} configError={ctx.configError} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CapsCell caps={v.caps} pulse={ctx.pulse} />
            <LastPick iso={v.sb?.last_pick_at} now={ctx.now} active={active} />
          </div>
        </div>
        <RulePill v={v} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <VerdictChip verdict={v.verdict} />
          <ControlLine v={v} />
          {v.verdict === "early" ? (
            <EarlyProgress n={v.metric.n ?? 0} />
          ) : v.verdict !== "noclv" ? (
            <span className="text-xs tabular-nums text-muted-foreground">{tStat(v.metric.t)}</span>
          ) : null}
        </div>
        <ClvCell v={v} withAxis />
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1"><StripCell v={v} /></div>
          <NRoiCell v={v} />
        </div>
        <div className="border-t border-border/60 pt-2">
          <ControlsCell v={v} now={ctx.now} onOpen={openTab} />
        </div>
      </div>
    </div>
  );
}

// ─── section ─────────────────────────────────────────────────────────────────

export function MetricPill({ metric }: { metric: Metric }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs uppercase text-muted-foreground" title={METRIC_LABEL[metric]}>
      {METRIC_PILL[metric]}
    </span>
  );
}

export const HEAD = "font-mono text-xs uppercase tracking-wider text-muted-foreground";

export interface SortCtl {
  key: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}

/** A column header that sorts (DataTable's look: label + arrow, faint arrow when unsorted). */
function SortHead({ k, sort, children, title, className = "" }: { k: SortKey; sort?: SortCtl; children: ReactNode; title?: string; className?: string }) {
  if (!sort) return <div className={`${HEAD} ${className}`} title={title}>{children}</div>;
  const on = sort.key === k;
  const Icon = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => sort.onSort(k)}
      title={title}
      aria-label={`Sort by ${typeof children === "string" ? children : k}`}
      aria-pressed={on}
      className={`inline-flex items-center gap-1 text-left hover:text-foreground ${HEAD} ${on ? "text-foreground" : ""} ${className}`}
    >
      {children}
      <Icon size={12} className={on ? "" : "opacity-40"} aria-hidden="true" />
    </button>
  );
}

function ColumnHeader({ metric, hasControl, sort }: { metric: Metric; hasControl: boolean; sort?: SortCtl }) {
  return (
    <div className={`sticky top-0 z-10 hidden border-t border-border bg-muted/40 px-4 py-2 backdrop-blur ${ROW_GRID}`}>
      <div><SortHead k="name" sort={sort}>Bot</SortHead></div>
      <div><SortHead k="verdict" sort={sort}>Verdict</SortHead></div>
      <div className="flex items-end gap-3">
        <div className="w-[64px] shrink-0 text-right">
          {metric === "lift" ? (
            <span className={HEAD}>Record</span>
          ) : (
            <SortHead k="clv" sort={sort} className="justify-end">{METRIC_SHORT[metric]}</SortHead>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {metric !== "lift" && (
            <>
              <ForestAxis />
              {metric === "clv_anchor" && hasControl && (
                <div className="mt-0.5 text-xs text-warning/90" title="Each row's dashed line is the junk control on that bot's own market mix.">
                  <span className="font-mono">┊</span> junk control, same markets
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div><SortHead k="p7" sort={sort} title="Sort by picks in the last 7 days">Weeks</SortHead></div>
      <div className="flex flex-wrap items-center gap-x-1" title={ROI_TITLE}>
        <SortHead k="settled" sort={sort}>Settled</SortHead>
        <span className={HEAD}>·</span>
        <SortHead k="roi" sort={sort}>ROI</SortHead>
      </div>
      <div><SortHead k="last" sort={sort}>Last</SortHead></div>
      <div className={`flex items-center gap-2 ${HEAD}`} title="/picks switch · real-money (€) switch · Telegram · /performance">
        <span className="min-w-9 text-center">/picks</span>
        <span className="min-w-9 text-center">€</span>
        <span>TG · Perf</span>
      </div>
    </div>
  );
}

export function FamilySection({
  family,
  bots,
  ctx,
  controlBot,
  sort,
}: {
  family: string;
  bots: BotView[];
  ctx: RowCtx;
  controlBot?: BotView;
  sort?: SortCtl;
}) {
  const info = FAMILY_INFO[family];
  const acc = ACCENT[info.accent];
  return (
    <section className="space-y-2 xl:space-y-0 xl:overflow-clip xl:rounded-xl xl:border xl:border-border xl:bg-card">
      <header className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] ${acc.bar} py-1 pl-3 pr-2 xl:py-3 xl:pr-4`}>
        <FamilyIcon icon={info.icon} className={acc.text} />
        <h2 className="text-base font-semibold">{info.title}</h2>
        <p className="text-sm text-muted-foreground">{info.subtitle}</p>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {bots.length} bot{bots.length === 1 ? "" : "s"} · judged on
          </span>
          <MetricPill metric={info.metric} />
        </div>
      </header>
      {controlBot && <ControlStrip v={controlBot} ctx={ctx} />}
      <ColumnHeader metric={info.metric} hasControl={ctx.control != null} sort={sort} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:block">
        {bots.map((v) => (
          <BotRow key={v.name} v={v} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}
