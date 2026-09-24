"use client";

// /admin/bots — fleet KPI strip (#139, bots-board-ux-spec §3; design system §5 since 2026-09-24:
// six StatCards). Placement, real money (the WHOLE card goes red when ARMED — must be impossible
// to miss), active bots, the verdict mix, picks in 7 days, and "needs a look".
// Unknown fleet state is shown as Unknown, never as Off (honesty rule 6). The Placement and Real
// money cards scroll to the Real money card — they never toggle anything.

import { useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ShieldOff,
  Zap,
} from "lucide-react";
import { Sparkline, StatCard } from "@/components/oi/stat-card";
import { TONE_TEXT, type Tone } from "@/components/oi/status-badge";
import type { BotCapabilitiesRow } from "@/lib/bot-board";
import type { BotView, Issue, Verdict } from "./bot-board-model";
import { count } from "./bot-board-format";
import { useControls } from "./controls-context";
import { VERDICT_BG, VerdictStackBar } from "./bot-viz";

const VERDICT_WORD: Record<Verdict, string> = {
  beats: "beat",
  loses: "lose",
  inconclusive: "can't tell",
  early: "too early",
  noclv: "no CLV",
};

/** A StatCard that jumps to the Real money card. Nothing is toggled. */
function Jump({ onJump, children }: { onJump?: () => void; children: ReactNode }) {
  if (!onJump) return <>{children}</>;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onJump();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onJump}
      onKeyDown={onKey}
      title="Show the controls for this — nothing is toggled"
      className="cursor-pointer rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring [&>*]:h-full"
    >
      {children}
    </div>
  );
}

const Word = ({ tone, icon, children }: { tone: Tone; icon: ReactNode; children: ReactNode }) => (
  <span className={`inline-flex items-center gap-1.5 ${TONE_TEXT[tone]}`}>
    {icon}
    {children}
  </span>
);

export function FleetStrip({
  fleet,
  caps,
  active,
  hasControl,
  issues,
  capsMissing,
  onOpenBot,
  onJump,
}: {
  fleet: BotCapabilitiesRow | undefined;
  caps: BotCapabilitiesRow[];
  /** Active bots EXCLUDING the control. */
  active: BotView[];
  hasControl: boolean;
  issues: Issue[];
  capsMissing: boolean;
  onOpenBot: (name: string) => void;
  onJump?: () => void;
}) {
  const [showIssues, setShowIssues] = useState(false);
  const known = !capsMissing && !!fleet;
  // #139 review item 9: pause / arm come from ONE source everywhere — the control state the page
  // read from coolbet_session_state (via the controls provider), not the older bot_capabilities.
  const ctl = useControls();
  const paused = ctl.current("placement_paused", null);
  const armed = ctl.current("real_money_disarm", null);
  const exec = ctl.ladder.layers.find((l) => l.key === "executors");
  const elig = ctl.ladder.layers.find((l) => l.key === "eligible");
  const placerWord = !exec ? "" : exec.state === "unknown" ? `placer: ${exec.value.toLowerCase()}` : exec.state === "open" ? "placer alive" : `placer ${exec.value.toLowerCase().startsWith("stale") ? "stale" : "dry-run only"}`;
  const activeNames = new Set(active.map((v) => v.name));
  const activeCaps = caps.filter((c) => activeNames.has(c.bot_name));
  const n = (k: keyof BotCapabilitiesRow) => activeCaps.filter((c) => c[k] === true).length;

  const verdicts: Record<string, number> = {};
  for (const v of active) verdicts[v.verdict] = (verdicts[v.verdict] ?? 0) + 1;
  const legend = (
    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5">
      {(["beats", "loses", "inconclusive", "early", "noclv"] as Verdict[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className={`inline-block h-2 w-2 rounded-full ${VERDICT_BG[k]}`} aria-hidden="true" />
          {verdicts[k] ?? 0} {VERDICT_WORD[k]}
        </span>
      ))}
    </span>
  );

  const picks7 = active.reduce((s, v) => s + (v.sb?.picks_7d ?? 0), 0);
  const firing = active.filter((v) => (v.sb?.picks_7d ?? 0) > 0).length;
  // Picks per week across the active fleet (bot_weekly) — null when 411 is not readable.
  const weekTotals = active.some((v) => v.weeks)
    ? Array.from({ length: 12 }, (_, i) => active.reduce((s, v) => s + (v.weeks?.[i]?.picks ?? 0), 0))
    : null;
  const danger = issues.some((i) => i.severity === "danger");
  const icon20 = (I: typeof HelpCircle) => <I size={20} aria-hidden="true" />;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Jump onJump={onJump}>
        <StatCard
          label="Placement"
          icon={paused ? PauseCircle : PlayCircle}
          tone={paused == null ? "warning" : paused ? "info" : "warning"}
          unknown={paused == null}
          value={
            paused ? (
              <Word tone="info" icon={icon20(PauseCircle)}>Paused</Word>
            ) : (
              <Word tone="warning" icon={icon20(PlayCircle)}>Running</Word>
            )
          }
          foot={paused == null ? "state unreadable" : placerWord}
        />
      </Jump>
      <Jump onJump={onJump}>
        <StatCard
          label="Real money"
          icon={armed ? ShieldAlert : ShieldOff}
          tone={armed == null ? "warning" : armed ? "danger" : "neutral"}
          danger={armed === true}
          unknown={armed == null}
          value={
            armed ? (
              <Word tone="danger" icon={icon20(ShieldAlert)}>ARMED</Word>
            ) : (
              <Word tone="neutral" icon={icon20(ShieldOff)}>Off</Word>
            )
          }
          foot={elig ? (elig.state === "unknown" ? "selection unreadable" : `${elig.value} for real money`) : "—"}
        />
      </Jump>
      <StatCard
        label="Active bots"
        icon={Bot}
        tone="info"
        value={
          <>
            {active.length}
            {hasControl && <span className="ml-1.5 text-sm font-normal text-muted-foreground">+ control</span>}
          </>
        }
        foot={known ? `${n("publish")} on /picks · ${n("telegram")} on Telegram` : "capabilities unreadable"}
      />
      <div className="order-5 col-span-2 md:col-span-1 xl:order-none [&>*]:h-full">
        <StatCard
          label="Verdicts"
          icon={ListChecks}
          tone="success"
          value={
            <span>
              {verdicts.beats ?? 0}
              <span className="ml-1 text-sm font-normal text-muted-foreground">of {active.length} beat the close</span>
            </span>
          }
          spark={<div className="w-full min-w-24 flex-1 pb-1.5"><VerdictStackBar counts={verdicts} /></div>}
          foot={legend}
        />
      </div>
      <StatCard
        label="Picks · 7d"
        icon={Zap}
        tone="model"
        value={count(picks7)}
        spark={weekTotals ? <Sparkline values={weekTotals} tone="model" kind="bars" /> : undefined}
        foot={`across ${firing} bot${firing === 1 ? "" : "s"}${weekTotals ? " · bars = 12 weeks" : ""}`}
      />
      <div className="order-6 col-span-2 md:col-span-1 xl:order-none [&>*]:h-full">
        <StatCard
          label="Needs a look"
          icon={issues.length === 0 ? CheckCircle2 : AlertTriangle}
          tone={issues.length === 0 ? "success" : danger ? "danger" : "warning"}
          value={
            issues.length === 0 ? (
              <Word tone="success" icon={icon20(CheckCircle2)}>All clear</Word>
            ) : (
              <Word tone={danger ? "danger" : "warning"} icon={icon20(AlertTriangle)}>{issues.length}</Word>
            )
          }
          foot={
            issues.length === 0 ? undefined : (
              <>
                <IssueText issue={issues[0]} onOpenBot={onOpenBot} />
                {issues.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowIssues((s) => !s)}
                    className="ml-1 text-muted-foreground underline-offset-2 hover:underline"
                    aria-expanded={showIssues}
                  >
                    {showIssues ? "less" : `+${issues.length - 1} more`}
                  </button>
                )}
                {showIssues && (
                  <ul className="mt-1 space-y-0.5">
                    {issues.slice(1).map((i) => (
                      <li key={i.text}><IssueText issue={i} onOpenBot={onOpenBot} /></li>
                    ))}
                  </ul>
                )}
              </>
            )
          }
        />
      </div>
    </div>
  );
}

function IssueText({ issue, onOpenBot }: { issue: Issue; onOpenBot: (name: string) => void }) {
  const cls = issue.severity === "danger" ? "text-danger" : "text-warning";
  if (!issue.bot) return <span className={cls}>{issue.text}</span>;
  return (
    <button type="button" onClick={() => onOpenBot(issue.bot as string)} className={`text-left underline-offset-2 hover:underline ${cls}`}>
      {issue.text}
    </button>
  );
}
