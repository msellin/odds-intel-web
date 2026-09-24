"use client";

// The Real money danger-zone card (#139 phase A, spec §3.4): the numbered layer ladder in gate
// order and the computed CAN STAKE line — the web counterpart of `coolbet_control --status`.
// Publishing lives in a DIFFERENT card on purpose (I10: placement and publishing are separate
// switches with opposite failure defaults).

import { Button } from "@/components/ui/button";
import { heartbeatStatus, PLACER_LABEL } from "@/lib/bot-controls/ladder";
import { TAKES_EFFECT } from "@/lib/bot-controls/types";
import { useControls } from "./controls-context";
import { relTime, utcStamp } from "./bot-board-format";
import { LadderList } from "./ladder-list";
import { PauseReason } from "./pause-reason";

export function RealMoneyCard({ highlight }: { highlight: boolean }) {
  const ctl = useControls();
  const { state, ladder, now } = ctl;
  const f = state.fleet.row;
  const paused = ctl.current("placement_paused", null);
  const armed = ctl.current("real_money_disarm", null);
  const pausePending = ctl.pending("placement_paused", null);
  const disarmPending = ctl.pending("real_money_disarm", null);
  const unknownFleet = paused === null || armed === null;
  const open = ladder.canStake === "yes";
  return (
    <section
      id="real-money"
      aria-labelledby="real-money-title"
      className={`scroll-mt-20 rounded-xl border p-4 transition-shadow ${open ? "border-red-500/70 bg-red-500/10" : "border-red-500/40 bg-card/40"} ${highlight ? "ring-2 ring-red-400/70" : ""}`}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="real-money-title" className="text-base font-semibold">Real money</h2>
          <p className="text-xs text-muted-foreground">Six gates in order, plus one information line (7). Money moves only when every gate is open.</p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        <LadderList ladder={ladder} />

        <div className="space-y-3">
          {/* Layer 3 — kill switch */}
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">3 · Placement</div>
              <span className={`text-xs ${paused === null ? "text-amber-300" : paused ? "text-sky-300" : "text-amber-400"}`}>
                {paused === null ? "Unknown" : paused ? "Paused" : "Running"}
                {pausePending && " …"}
              </span>
            </div>
            {paused && (
              <div className="mt-1.5 space-y-1">
                <PauseReason reason={f?.placement_paused_reason ?? null} compact />
                <p className="text-xs text-muted-foreground">since {relTime(f?.placement_paused_at, now)} ago</p>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {paused !== true && (
                <Button size="sm" variant="outline" disabled={pausePending} onClick={() => ctl.request({ control: "placement_paused", bot: null, value: true })}>
                  Pause placement
                </Button>
              )}
              {paused !== false && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paused === null || pausePending}
                  title={paused === null ? "state unreadable" : "Typed confirmation + reason"}
                  onClick={() => ctl.request({ control: "placement_paused", bot: null, value: false })}
                >
                  Resume…
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{TAKES_EFFECT.placement_paused}</p>
          </div>

          {/* Layer 4 — arming */}
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">4 · Armed</div>
              <span className={`text-xs ${armed === null ? "text-amber-300" : armed ? "font-semibold text-red-400" : "text-muted-foreground"}`}>
                {armed === null ? "Unknown" : armed ? "ARMED" : "Not armed"}
                {disarmPending && " …"}
              </span>
            </div>
            {armed && f?.real_money_armed_reason && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={f.real_money_armed_reason}>
                “{f.real_money_armed_reason}” · since {utcStamp(f.real_money_armed_at)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {/* Disarm: one click, any superadmin, available even when the state is unknown. */}
              {armed !== false && (
                <Button size="sm" variant="destructive" disabled={disarmPending} onClick={() => ctl.request({ control: "real_money_disarm", bot: null, value: false })}>
                  Disarm
                </Button>
              )}
              {armed !== true &&
                (state.viewer.isOwner ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/60 text-red-300 disabled:opacity-80"
                    disabled={armed === null}
                    title={armed === null ? "state unreadable" : "Owner only — two steps: typed phrase, then a reason"}
                    onClick={ctl.openArm}
                  >
                    Arm… (owner)
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground" title="Arming is owner-only (OWNER_USER_IDS)">Arm: owner only</span>
                ))}
            </div>
            {unknownFleet && <p className="mt-1.5 text-xs text-amber-300">Fleet state unreadable — starting anything is disabled; stopping still works.</p>}
          </div>

          {/* Layer 5 — the Mac executors (display only; the web cannot reach launchd) */}
          <Executors />
        </div>
      </div>
    </section>
  );
}

function Executors() {
  const { state, now } = useControls();
  const rows = state.heartbeats.rows;
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3 text-xs">
      <div className="text-sm font-medium">5 · Executors on the Mac <span className="font-normal text-muted-foreground">(read-only)</span></div>
      {state.heartbeats.error ? (
        <p className="mt-1 text-amber-300">Heartbeat unreadable — Unknown.</p>
      ) : rows.length === 0 ? (
        <p className="mt-1 text-muted-foreground">
          Not reported — no placer on the Mac has checked in yet. <span className="opacity-70">(placer_heartbeats; on the Mac: coolbet_control --status)</span>
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {rows.map((h) => {
            const st = heartbeatStatus(h, now, false);
            return (
              <li key={h.placer} className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span>{PLACER_LABEL[h.placer] ?? h.placer}</span>
                <span className={st === "alive" ? (h.execute_requested ? "text-red-300" : "text-foreground") : "text-muted-foreground"} title={h.last_seen_at ? utcStamp(h.last_seen_at) : undefined}>
                  {st === "alive" ? "Alive" : "Stale"} · {h.execute_requested ? "--execute" : "dry-run"} · {relTime(h.last_seen_at, now)} ago
                </span>
                {h.refused_reason && <span className="basis-full truncate text-muted-foreground" title={h.refused_reason}>gate: {h.refused_reason}</span>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1.5 text-muted-foreground">
        This page cannot start or stop the placers on the Mac; it only shows whether they ran recently. A placer counts as running only
        while its last check-in is under 75 minutes old. <span className="opacity-70">(launchd)</span>
      </p>
    </div>
  );
}
