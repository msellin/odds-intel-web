"use client";

// Fleet Controls card (#139 phase A, spec §3.4): the switches that are NOT money. Since IA move P2
// (2026-09-24) it holds only the customer picks channel: the Coolbet footprint pause moved to
// /admin/feeds (footprint-control.tsx) — it is a collection lever, not a bot one. Each row is a
// title + one-line description + "what reads this / takes effect" on the left and the control on
// the right (Vercel's settings pattern). The customer channel and real-money placement live in
// DIFFERENT cards on purpose (I10) — the layout itself says they are not one switch.

import { TAKES_EFFECT } from "@/lib/bot-controls/types";
import { ControlSwitch } from "./control-switch";
import { useControls } from "./controls-context";
import { relTime } from "./bot-board-format";
import { actorWord } from "./activity-timeline";

const GROUP = "font-mono text-xs uppercase tracking-wider text-muted-foreground";

function Row({ title, desc, meta, control }: { title: string; desc: string; meta: React.ReactNode; control: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function FleetControlsCard() {
  const { state, now } = useControls();
  const f = state.fleet.row;
  const lastPub = state.changes.rows.find((c) => c.control === "publishing_paused" && c.outcome === "applied");
  return (
    <section id="controls" aria-labelledby="controls-title" className="scroll-mt-20 rounded-xl border border-border bg-card/40 px-4 pt-3">
      <h2 id="controls-title" className="text-base font-semibold">Publishing</h2>
      {state.fleet.error && <p className="mt-1 text-xs text-amber-300">Fleet state unreadable ({state.fleet.error}) — shown as Unknown; starting anything is disabled.</p>}

      <div className="mt-2">
        <div className={GROUP}>Picks · customers</div>
        <div className="divide-y divide-border/60">
          <Row
            title="Picks channel"
            desc="Sending to @oddsintelpicks. Pausing stops sending only — /picks and the pre-registered ledger keep recording."
            meta={
              <>
                {f?.publishing_paused && <>Paused{f.publishing_paused_reason ? `: “${f.publishing_paused_reason}”` : ""} · </>}
                {TAKES_EFFECT.publishing_paused}
                {lastPub && <> · last change {relTime(lastPub.created_at, now)} ago by {actorWord(lastPub.actor)}</>}
              </>
            }
            control={<ControlSwitch control="publishing_paused" invert label="Picks channel" onWord="Sending" offWord="Paused" />}
          />
        </div>
      </div>
    </section>
  );
}
