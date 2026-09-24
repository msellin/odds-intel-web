"use client";

// /admin/bots — fleet KPI strip (#139, bots-board-ux-spec §3). Six tiles in the
// /performance hero style: placement, real money (a whole red tile when ARMED — must be
// impossible to miss), active bots, the verdict mix, picks in 7 days, and "needs a look".
// Unknown fleet state is shown as Unknown, never as Off (honesty rule 6).

import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import type { BotCapabilitiesRow } from "@/lib/bot-board";
import type { BotView, Issue, Verdict } from "./bot-board-model";
import { count } from "./bot-board-format";
import { VERDICT_BG, VerdictStackBar } from "./bot-viz";

const LABEL = "font-mono text-xs uppercase tracking-wider text-muted-foreground";

function Tile({ label, children, sub, className = "" }: { label: string; children: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`bg-card px-4 py-3 ${className}`}>
      <div className={LABEL}>{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-2xl font-semibold tabular-nums">{children}</div>
      {sub != null && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const VERDICT_WORD: Record<Verdict, string> = {
  beats: "beat",
  loses: "lose",
  inconclusive: "inconclusive",
  early: "too early",
  noclv: "no CLV",
};

export function FleetStrip({
  fleet,
  caps,
  active,
  hasControl,
  issues,
  capsMissing,
  onOpenBot,
}: {
  fleet: BotCapabilitiesRow | undefined;
  caps: BotCapabilitiesRow[];
  /** Active bots EXCLUDING the control. */
  active: BotView[];
  hasControl: boolean;
  issues: Issue[];
  capsMissing: boolean;
  onOpenBot: (name: string) => void;
}) {
  const [showIssues, setShowIssues] = useState(false);
  const known = !capsMissing && !!fleet;
  const paused = known ? fleet.fleet_placement_paused : null;
  const armed = known ? fleet.fleet_real_money_armed : null;
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
  const danger = issues.some((i) => i.severity === "danger");

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.08]">
      <div className="grid grid-cols-2 gap-px md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Placement" sub={paused == null ? "state unreadable" : paused ? "placer idle" : "placer live"}>
          {paused == null ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><HelpCircle size={20} aria-hidden="true" />Unknown</span>
          ) : paused ? (
            <span className="inline-flex items-center gap-1.5 text-sky-400"><PauseCircle size={20} aria-hidden="true" />Paused</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-400"><PlayCircle size={20} aria-hidden="true" />Running</span>
          )}
        </Tile>
        <Tile
          label="Real money"
          className={armed ? "bg-red-500/10 ring-1 ring-inset ring-red-500/50" : ""}
          sub={known ? `${n("place_enabled")} enabled · ${n("place_capable")} capable` : "capabilities unreadable"}
        >
          {armed == null ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><HelpCircle size={20} aria-hidden="true" />Unknown</span>
          ) : armed ? (
            <span className="inline-flex items-center gap-1.5 text-red-400"><ShieldAlert size={20} aria-hidden="true" />ARMED</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><ShieldOff size={20} aria-hidden="true" />Off</span>
          )}
        </Tile>
        <Tile label="Active bots" sub={known ? `${n("publish")} published · ${n("telegram")} on Telegram` : "—"}>
          {active.length}
          {hasControl && <span className="text-sm font-normal text-muted-foreground">+ control</span>}
        </Tile>
        <Tile label="Verdicts" sub={legend} className="order-5 col-span-2 md:col-span-1 xl:order-none">
          <div className="w-full py-2"><VerdictStackBar counts={verdicts} /></div>
        </Tile>
        <Tile label="Picks · 7d" sub={`across ${firing} bot${firing === 1 ? "" : "s"}`}>
          {count(picks7)}
        </Tile>
        <div className="order-6 col-span-2 bg-card px-4 py-3 md:col-span-1 xl:order-none">
          <div className={LABEL}>Needs a look</div>
          {issues.length === 0 ? (
            <div className="mt-1 inline-flex items-center gap-1.5 text-2xl font-semibold text-emerald-400">
              <CheckCircle2 size={20} aria-hidden="true" />All clear
            </div>
          ) : (
            <>
              <div className={`mt-1 inline-flex items-center gap-1.5 text-2xl font-semibold tabular-nums ${danger ? "text-red-400" : "text-amber-400"}`}>
                <AlertTriangle size={20} aria-hidden="true" />
                {issues.length}
              </div>
              <div className="mt-1 text-xs">
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
              </div>
              {showIssues && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {issues.slice(1).map((i) => (
                    <li key={i.text}><IssueText issue={i} onOpenBot={onOpenBot} /></li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function IssueText({ issue, onOpenBot }: { issue: Issue; onOpenBot: (name: string) => void }) {
  const cls = issue.severity === "danger" ? "text-red-400" : "text-amber-300";
  if (!issue.bot) return <span className={cls}>{issue.text}</span>;
  return (
    <button type="button" onClick={() => onOpenBot(issue.bot as string)} className={`text-left underline-offset-2 hover:underline ${cls}`}>
      {issue.text}
    </button>
  );
}
