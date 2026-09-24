"use client";

// The /admin/bots control plumbing (#139 phase A, spec §2.6/§2.7). One provider owns the control
// state the server read, the confirmation dialogs, the pending/optimistic look and the toasts, so
// every switch on the page (fleet card, real-money card, table, detail sheet, armed banner) goes
// through the same rules:
//
//  * SAFE direction (pause, disarm, OFF, resume publishing): (a) confirm, then OPTIMISTIC — the
//    switch flips at once in a pending look; `applied` → re-read; `conflict` → roll back and say
//    who changed it; error → roll back with the message. Works even when the state is unknown.
//  * START direction (resume placement, € ON, /picks ON, pausing the customer channel, arming):
//    (b) typed confirmation + reason, NO optimistic state — the control changes only after the
//    server applied it and the page re-read. Disabled while the state is unknown.
//  * Read-only design preview: every request is answered with a toast; nothing is sent.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BotView } from "./bot-board-model";
import { ConfirmControlDialog, type ConfirmSpec } from "./confirm-control-dialog";
import { ArmDialog } from "./arm-dialog";
import { useToast } from "./toast";
import { specFor } from "./control-specs";
import { newRequestId, postArm, postControl } from "@/lib/bot-controls/client";
import { computeLadder, type Ladder } from "@/lib/bot-controls/ladder";
import {
  TAKES_EFFECT,
  isStartDirection,
  type ControlResult,
  type ControlState,
  type PageControl,
  type PlacerRow,
} from "@/lib/bot-controls/types";

export interface Intent {
  control: PageControl;
  bot: string | null;
  value: boolean;
}

const keyOf = (control: PageControl, bot: string | null) => `${control}:${bot ?? ""}`;

interface Ctx {
  state: ControlState;
  now: number;
  ladder: Ladder;
  capable: Set<string> | null;
  readOnly: boolean;
  placerBy: Map<string, PlacerRow>;
  /** Current value as the page should show it (optimistic override while pending). null = unknown. */
  current: (control: PageControl, bot: string | null) => boolean | null;
  pending: (control: PageControl, bot: string | null) => boolean;
  request: (i: Intent) => void;
  openArm: () => void;
  /** Display name for a bot id (falls back to the id). */
  nameOf: (bot: string) => string;
}

const C = createContext<Ctx | null>(null);

export function useControls(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("useControls outside ControlsProvider");
  return c;
}

function hhmm(iso: string | null | undefined) {
  return iso ? new Date(iso).toISOString().slice(11, 16) + " UTC" : "";
}

export function ControlsProvider({
  state,
  views,
  capable,
  now,
  children,
}: {
  state: ControlState;
  /** Active + retired bot views, for display names in dialogs. */
  views: BotView[];
  /** Active bots with a placement path (null = config unreadable). */
  capable: string[] | null;
  now: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [busyKeys, setBusyKeys] = useState<Record<string, true>>({});
  const [dialog, setDialog] = useState<{ intent: Intent; spec: ConfirmSpec } | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [armOpen, setArmOpen] = useState(false);

  // A fresh server read replaces every optimistic guess.
  useEffect(() => {
    setOptimistic({});
  }, [state]);

  const readOnly = state.viewer.readOnly;
  const placerBy = useMemo(() => new Map(state.placers.rows.map((p) => [p.bot_name, p])), [state.placers.rows]);
  const botBy = useMemo(() => new Map(state.bots.rows.map((b) => [b.name, b])), [state.bots.rows]);
  const nameBy = useMemo(() => new Map(views.map((v) => [v.name, v.displayName])), [views]);
  const capableSet = useMemo(() => (capable ? new Set(capable) : null), [capable]);
  const ladder = useMemo(() => computeLadder(state, capable, now), [state, capable, now]);

  const serverValue = useCallback(
    (control: PageControl, bot: string | null): boolean | null => {
      const f = state.fleet.row;
      switch (control) {
        case "placement_paused":
          return f?.placement_paused ?? null;
        case "publishing_paused":
          return f?.publishing_paused ?? null;
        case "daemons_paused":
          return f?.daemons_paused ?? null;
        case "real_money_disarm":
          return f?.real_money_armed ?? null;
        case "placer_enabled":
          if (state.placers.error || !bot) return null;
          return placerBy.get(bot)?.ui_place_enabled ?? null;
        case "show_on_picks":
          if (state.bots.error || !bot) return null;
          return botBy.has(bot) ? botBy.get(bot)?.show_on_picks ?? false : null;
      }
    },
    [state, placerBy, botBy],
  );

  const current = useCallback(
    (control: PageControl, bot: string | null) => {
      const k = keyOf(control, bot);
      return k in optimistic ? optimistic[k] : serverValue(control, bot);
    },
    [optimistic, serverValue],
  );
  const pending = useCallback((control: PageControl, bot: string | null) => !!busyKeys[keyOf(control, bot)], [busyKeys]);

  const report = useCallback(
    (intent: Intent, r: ControlResult, takesEffect: string) => {
      const label = intent.bot ? nameBy.get(intent.bot) ?? intent.bot : null;
      if (r.outcome === "applied") {
        toast({
          tone: r.notify === "failed" ? "warn" : "ok",
          title: `Applied${label ? ` · ${label}` : ""}`,
          body: `Takes effect: ${takesEffect}${r.notify === "failed" ? " — but the Telegram notice failed." : ""}`,
        });
      } else if (r.outcome === "noop") {
        toast({ tone: "info", title: "Already in that state — nothing changed" });
      } else if (r.outcome === "conflict") {
        toast({
          tone: "warn",
          title: `Changed by ${r.changed_by ?? "someone else"}${r.changed_at ? ` at ${hhmm(r.changed_at)}` : ""} — refreshed`,
          body: "Nothing was applied. Check the current state and try again.",
        });
      } else {
        toast({ tone: "error", title: "Not applied", body: r.refusal ?? r.error ?? "refused" });
      }
      router.refresh();
    },
    [nameBy, router, toast],
  );

  const execute = useCallback(
    async (intent: Intent, reason: string, confirmText: string) => {
      const start = isStartDirection(intent.control, intent.value);
      const k = keyOf(intent.control, intent.bot);
      const expected = serverValue(intent.control, intent.bot);
      const body = {
        control: intent.control,
        bot_name: intent.bot,
        value: intent.value,
        reason: reason || null,
        confirm_text: confirmText || null,
        expected,
        request_id: newRequestId(),
      };
      if (start) {
        setDialogBusy(true);
        setDialogError(null);
        const r = await postControl(body);
        setDialogBusy(false);
        if (r.outcome === "refused" || r.error) {
          setDialogError(r.refusal ?? r.error ?? "refused");
          return;
        }
        setDialog(null);
        report(intent, r, TAKES_EFFECT[intent.control]);
        return;
      }
      // safe direction: optimistic
      setDialog(null);
      setOptimistic((o) => ({ ...o, [k]: intent.value }));
      setBusyKeys((b) => ({ ...b, [k]: true }));
      const r = await postControl(body);
      setBusyKeys((b) => {
        const n = { ...b };
        delete n[k];
        return n;
      });
      if (r.outcome !== "applied") {
        setOptimistic((o) => {
          const n = { ...o };
          delete n[k];
          return n;
        });
      }
      report(intent, r, TAKES_EFFECT[intent.control]);
    },
    [report, serverValue],
  );

  // In the design preview the dialogs open (so they can be reviewed) and only the final
  // Confirm is disabled; the write routes refuse in preview mode regardless.
  const request = useCallback(
    (intent: Intent) => {
      const spec = specFor(intent, {
        name: intent.bot ? nameBy.get(intent.bot) ?? intent.bot : null,
        state,
        ladder,
      });
      setDialogError(null);
      setDialog({ intent, spec });
    },
    [state, nameBy, ladder],
  );

  const openArm = useCallback(() => {
    setDialogError(null);
    setArmOpen(true);
  }, []);
  const nameOf = useCallback((bot: string) => nameBy.get(bot) ?? bot, [nameBy]);

  const confirmArm = useCallback(
    async (reason: string, phrase: string) => {
      setDialogBusy(true);
      setDialogError(null);
      const r = await postArm({ reason, confirm_text: phrase, expected: false, request_id: newRequestId() });
      setDialogBusy(false);
      if (r.outcome === "refused" || r.error) {
        setDialogError(r.refusal ?? r.error ?? "refused");
        return;
      }
      setArmOpen(false);
      report({ control: "real_money_disarm", bot: null, value: true }, r, TAKES_EFFECT.real_money_arm);
    },
    [report],
  );

  const value: Ctx = { state, now, ladder, capable: capableSet, readOnly, placerBy, current, pending, request, openArm, nameOf };

  return (
    <C.Provider value={value}>
      {children}
      <ConfirmControlDialog
        spec={dialog?.spec ?? null}
        open={!!dialog}
        readOnlyReason={readOnly ? state.viewer.readOnlyReason ?? "Preview — read-only" : null}
        busy={dialogBusy}
        error={dialogError}
        onCancel={() => setDialog(null)}
        onConfirm={(reason, typed) => dialog && execute(dialog.intent, reason, typed)}
      />
      <ArmDialog open={armOpen} ladder={ladder} readOnlyReason={readOnly ? state.viewer.readOnlyReason ?? "Preview — read-only" : null} busy={dialogBusy} error={dialogError} onCancel={() => setArmOpen(false)} onConfirm={confirmArm} />
    </C.Provider>
  );
}
