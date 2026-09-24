"use client";

// Coolbet footprint pause on /admin/feeds (#139 IA move P2, 2026-09-24). It moved here from the
// /admin/bots Controls card: it is a collection lever used when Imperva starts blocking us — the
// same job as the per-feed pause below — so the operator reaching for it is looking at a red
// Coolbet block, not at bot verdicts.
//
// Same plumbing as every switch on /admin/bots: ControlsProvider → POST /api/admin/bots/controls
// → the audited `admin_set_control` (a control_changes row per change). Owner decision
// 2026-09-24: it stops odds SWEEPING only (explorer, in-play collector, feed watchdog), never a real-money placer — the kill switch on
// /admin/bots does that. The sidebar's "Coolbet sweeping" status line keeps its state visible on
// every page.

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { TAKES_EFFECT, type ControlState } from "@/lib/bot-controls/types";
import { ControlsProvider, useControls } from "../bots/controls-context";
import { ControlSwitch } from "../bots/control-switch";
import { ToastProvider } from "../bots/toast";
import { relTime } from "../bots/bot-board-format";
import { actorWord } from "../bots/activity-timeline";

export function FootprintControl({ state, now, children }: { state: ControlState; now: number; children?: ReactNode }) {
  return (
    <ToastProvider>
      <ControlsProvider state={state} views={[]} capable={null} now={now}>
        <FootprintRow>{children}</FootprintRow>
      </ControlsProvider>
    </ToastProvider>
  );
}

// Restyled 2026-09-24 (#139 admin redesign): a Panel in the Coolbet area of /admin/feeds, with the
// Coolbet request budget and closing capture (passed in as children) under the switch — the
// numbers the operator reads before reaching for it.
function FootprintRow({ children }: { children?: ReactNode }) {
  const { state, now } = useControls();
  const f = state.fleet.row;
  const last = state.changes.rows.find((c) => c.control === "daemons_paused" && c.outcome === "applied");
  return (
    <section id="coolbet-footprint" aria-labelledby="footprint-title" className="scroll-mt-20 rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h2 id="footprint-title" className="text-sm font-medium">
            Coolbet sweeping <span className="font-normal text-muted-foreground">(footprint pause)</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Pausing stops us reading odds from Coolbet (pre-match and live), to lower our footprint when Coolbet starts blocking us.
            It does <span className="text-foreground">not</span> stop real bets — that is the{" "}
            <Link href="/admin/bots#real-money" className="underline underline-offset-2 hover:text-foreground">
              placement kill switch
              <ArrowUpRight size={12} className="ml-0.5 inline" aria-hidden="true" />
            </Link>
            .
          </p>
          <p className="text-xs text-muted-foreground">
            {state.fleet.error && <span className="text-warning">State unreadable ({state.fleet.error}) · </span>}
            {f?.daemons_paused && <span className="text-info">Paused{f.daemons_paused_reason ? `: “${f.daemons_paused_reason}”` : ""} · </span>}
            {TAKES_EFFECT.daemons_paused}
            {last && <> · last change {relTime(last.created_at, now)} ago by {actorWord(last.actor)}</>}
          </p>
        </div>
        <div className="shrink-0">
          <ControlSwitch control="daemons_paused" invert label="Coolbet sweeping" onWord="Collecting" offWord="Paused" />
        </div>
      </div>
      {children ? <div className="mt-3 border-t border-border/60 px-4 py-3">{children}</div> : <div className="pb-4" />}
    </section>
  );
}
