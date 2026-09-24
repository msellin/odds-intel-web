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

// ─── tokens ──────────────────────────────────────────────────────────────────

export const ACCENT: Record<Accent, { bar: string; text: string }> = {
  teal: { bar: "border-l-teal-400", text: "text-teal-300" },
  violet: { bar: "border-l-violet-400", text: "text-violet-300" },
  sky: { bar: "border-l-sky-400", text: "text-sky-300" },
  amber: { bar: "border-l-amber-400", text: "text-amber-300" },
  amberStrong: { bar: "border-l-amber-500", text: "text-amber-400" },
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
    cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/40",
    Icon: TrendingUp,
    title: `At least ${MIN_N} measured picks and t ≥ 2: priced better than the close. Not a promotion by itself.`,
  },
  loses: {
    label: "Loses to close",
    cls: "text-red-400 bg-red-500/10 border-red-500/40",
    Icon: TrendingDown,
    title: `At least ${MIN_N} measured picks and t ≤ −2: priced worse than the close.`,
  },
  inconclusive: {
    label: "Inconclusive",
    cls: "text-amber-300 bg-amber-500/10 border-amber-500/30",
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
  const cls = cmp === "equal" ? "text-amber-300" : cmp === "above" ? "text-emerald-400" : "text-red-400";
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
  return v.metric.mean >= 0 ? "text-emerald-400" : "text-red-400";
}

/** Flat-stake ROI is noise at small n — colour it only from this many settled picks. */
export const ROI_COLOUR_MIN = 300;

export function roiTone(settled: number, roi: number | null | undefined): string {
  if (settled < ROI_COLOUR_MIN || roi == null) return "text-muted-foreground";
  return roi >= 0 ? "text-emerald-400" : "text-red-400";
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

const ROI_TITLE = `Settled picks · ROI on a flat 1-unit stake per pick — comparable across bots, not their real staking. Coloured only from ${ROI_COLOUR_MIN} settled picks; below that it is noise.`;

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
      {(v.sb?.pending ?? 0) > 0 && <div className="text-xs tabular-nums text-muted-foreground">+{count(v.sb?.pending)} pending</div>}
    </div>
  );
}

export function LastPick({ iso, now, active }: { iso: string | null | undefined; now: number; active: boolean }) {
  const m = minutesAgo(iso, now);
  const stale = active && m != null && m > 7 * 1440;
  const cls = m == null ? "text-muted-foreground" : m < 1440 ? "text-foreground" : stale ? "text-red-400" : "text-amber-300";
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
  if (caps.publish) out.push({ key: "publish", icon: <Globe size={12} />, word: "Published", title: "Published on /picks and the public track record", cls: "bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30" });
  if (caps.telegram) out.push({ key: "telegram", icon: <Send size={12} />, word: "Telegram", title: "Sent to the Telegram channel", cls: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" });
  if (caps.place_capable && !caps.place_enabled) out.push({ key: "capable", icon: <Wallet size={12} />, word: "Real-money capable", title: "A placer could stake real money on it — switched off", cls: "bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30" });
  if (caps.place_enabled) out.push({ key: "on", icon: <Banknote size={12} />, word: "Real money ON", title: "Real-money placement is switched ON for this bot", cls: `bg-red-500/20 text-red-300 ring-2 ring-red-500/60 ${pulse ? "motion-safe:animate-pulse" : ""}` });
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
        <span className="rounded-md border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-xs text-red-400">Not collecting</span>
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
        className="rounded bg-teal-500/10 px-1.5 font-mono text-xs text-teal-300"
        title={`Pre-registered: scored on ${v.sb?.scored_rule_version} only. A rule change starts a new population.`}
      >
        {rv}
      </span>
      {cfgRv && (
        <span
          className="rounded bg-amber-500/10 px-1.5 font-mono text-xs text-amber-300"
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
  if (configError) return <div className="text-xs text-amber-300">config unavailable</div>;
  if (!v.cfg) return <div className="text-xs text-amber-300">no config — family unknown</div>;
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

function ColumnHeader({ metric, hasControl }: { metric: Metric; hasControl: boolean }) {
  return (
    <div className={`sticky top-0 z-10 hidden border-t border-border bg-background/95 px-4 py-2 backdrop-blur ${ROW_GRID}`}>
      <div className={HEAD}>Bot</div>
      <div className={HEAD}>Verdict</div>
      <div className="flex items-end gap-3">
        <div className={`w-[64px] shrink-0 text-right ${HEAD}`}>{metric === "lift" ? "Record" : metric === "clv_pinnacle" ? "Pin-CLV" : "mc-CLV"}</div>
        <div className="min-w-0 flex-1">
          {metric !== "lift" && (
            <>
              <ForestAxis />
              {metric === "clv_mc" && hasControl && (
                <div className="mt-0.5 text-xs text-amber-300/90" title="Each row's dashed line is the junk control on that bot's own market mix.">
                  <span className="font-mono">┊</span> junk control, same markets
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className={HEAD}>Weeks</div>
      <div className={HEAD} title={ROI_TITLE}>Settled · ROI</div>
      <div className={HEAD}>Last</div>
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
}: {
  family: string;
  bots: BotView[];
  ctx: RowCtx;
  controlBot?: BotView;
}) {
  const info = FAMILY_INFO[family];
  const acc = ACCENT[info.accent];
  return (
    <section className="space-y-2 xl:space-y-0 xl:overflow-clip xl:rounded-xl xl:border xl:border-border xl:bg-card/40">
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
      <ColumnHeader metric={info.metric} hasControl={ctx.control != null} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:block">
        {bots.map((v) => (
          <BotRow key={v.name} v={v} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}
