"use client";

// Every on/off control on /admin/bots renders through this (#139 phase A, spec §3.8): the
// pending (optimistic, safe direction only), locked, unknown and read-only states live in one
// place so no screen can show a dangerous control in a state it does not have.
//
// Unknown is written "Unknown" in amber — never "Off" — and the START direction is disabled;
// the STOP direction stays available as an explicit button (stop works even when unreadable).

import { HelpCircle, Loader2, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isStartDirection, type PageControl } from "@/lib/bot-controls/types";
import { useControls } from "./controls-context";

export function ControlSwitch({
  control,
  bot = null,
  invert = false,
  label,
  onWord = "On",
  offWord = "Off",
  disabledReason = null,
  lockedReason = null,
  size = "default",
  showWord = true,
}: {
  control: PageControl;
  bot?: string | null;
  /** Switch ON = the DB value FALSE (e.g. "Picks channel ON" = publishing_paused false). */
  invert?: boolean;
  label: string;
  onWord?: string;
  offWord?: string;
  /** A reason the control cannot be used at all (shown as the tooltip). */
  disabledReason?: string | null;
  lockedReason?: string | null;
  size?: "sm" | "default";
  showWord?: boolean;
}) {
  const ctl = useControls();
  const value = ctl.current(control, bot);
  const pending = ctl.pending(control, bot);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (lockedReason) {
    return (
      <span
        onClick={stop}
        className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
        title={`Locked OFF: ${lockedReason}`}
        aria-label={`${label}: locked off`}
      >
        <Lock size={12} aria-hidden="true" /> {showWord && "Locked"}
      </span>
    );
  }

  if (value === null) {
    // Which DB value is the safe one for this control? (pause/disarm/OFF)
    const stopValue = control === "placement_paused" || control === "daemons_paused" || control === "publishing_paused" ? true : false;
    return (
      <span onClick={stop} className="inline-flex items-center gap-1.5 text-xs">
        <span className="inline-flex items-center gap-1 text-amber-300" title="State unreadable — starting anything is disabled">
          <HelpCircle size={14} aria-hidden="true" /> Unknown
        </span>
        {stopValue !== null && !disabledReason && (
          <button
            type="button"
            onClick={() => ctl.request({ control, bot, value: stopValue })}
            className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {control === "real_money_disarm" ? "Disarm" : control === "placer_enabled" || control === "show_on_picks" ? "Force off" : "Pause"}
          </button>
        )}
      </span>
    );
  }

  const checked = invert ? !value : value;
  const nextValue = (nextChecked: boolean) => (invert ? !nextChecked : nextChecked);
  const startBlocked = (nextChecked: boolean) => isStartDirection(control, nextValue(nextChecked)) && !!disabledReason;
  const disabled = pending || (!!disabledReason && isStartDirection(control, nextValue(!checked)));
  const title = disabledReason && isStartDirection(control, nextValue(!checked))
      ? disabledReason
      : `${label}: ${checked ? onWord : offWord}`;

  return (
    <span onClick={stop} onKeyDown={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5" title={title}>
      <Switch
        size={size}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        aria-busy={pending || undefined}
        className={pending ? "opacity-60" : undefined}
        onCheckedChange={(next) => {
          if (startBlocked(next)) return;
          ctl.request({ control, bot, value: nextValue(next) });
        }}
      />
      {pending && <Loader2 size={12} className="animate-spin text-muted-foreground" aria-hidden="true" />}
      {showWord && <span className={`text-xs ${checked ? "text-foreground" : "text-muted-foreground"}`}>{checked ? onWord : offWord}</span>}
    </span>
  );
}
