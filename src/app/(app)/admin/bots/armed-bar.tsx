"use client";

// /admin/bots' own REAL MONEY ARMED bar, with the inline Disarm (#139 phase A, spec §3.1 — Stripe's
// test-mode bar, inverted). It lives here, not in the shared admin shell, because Disarm goes
// through this page's controls context (optimistic write + audit + toast). The shared shell
// (src/components/admin/admin-shell.tsx) shows the same bar on every OTHER admin page, linking here.

import { ShieldAlert } from "lucide-react";
import { useControls } from "./controls-context";
import { hhmmUtc } from "./bot-board-format";

export function ArmedBar() {
  const ctl = useControls();
  if (ctl.current("real_money_disarm", null) !== true) return null;
  const f = ctl.state.fleet.row;
  const armedBy = ctl.state.changes.rows.find((c) => c.control === "real_money_armed" && c.outcome === "applied" && c.new_value === true)?.actor;
  return (
    <div role="alert" className="-mx-3 -mt-4 mb-4 flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-600 px-4 py-1.5 text-sm font-medium text-white sm:-mx-4 lg:-mx-6 lg:-mt-6">
      <ShieldAlert size={16} aria-hidden="true" />
      REAL MONEY ARMED{f?.real_money_armed_at ? ` since ${hhmmUtc(f.real_money_armed_at)} UTC` : ""}
      {armedBy ? ` by ${armedBy}` : ""}
      <button
        type="button"
        disabled={ctl.pending("real_money_disarm", null)}
        onClick={() => ctl.request({ control: "real_money_disarm", bot: null, value: false })}
        className="rounded-md bg-white/15 px-2.5 py-0.5 text-white ring-1 ring-white/40 hover:bg-white/25 disabled:opacity-60"
      >
        Disarm
      </button>
    </div>
  );
}
