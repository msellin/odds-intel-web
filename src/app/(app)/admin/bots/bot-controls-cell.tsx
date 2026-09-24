"use client";

// Per-bot controls in the table (#139 phase A, spec §3.5): the "/picks" switch (B4a), the "€"
// real-money eligibility switch (B6), the read-only Telegram / performance state, and the row ⋯
// menu. Every disabled control carries a tooltip that says why AND what would change it.

import { Banknote, Copy, Eye, Globe, Lock, MoreHorizontal, Send, Trophy } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { placementPathReason } from "@/lib/bot-controls/placement-path";
import type { BotControlRow } from "@/lib/bot-controls/types";
import { channelLines } from "./channel-reasons";
import { picksTelegramMismatch, picksUnavailable, type BotView } from "./bot-board-model";

// Moved to the pure view model 2026-09-24 so /admin (the attention inbox) uses the same rule.
export { picksTelegramMismatch, picksUnavailable };
import { ControlSwitch } from "./control-switch";
import { useControls } from "./controls-context";
import { useToast } from "./toast";

const STALE_H = 36;

export function configStale(v: BotView, now: number): boolean {
  const at = v.cfg?.exported_at;
  return !at || now - new Date(at).getTime() > STALE_H * 3600_000;
}

export function isRetired(v: BotView): boolean {
  return !!v.sb?.retired_at || v.sb?.is_active === false;
}

/** Why the /picks switch is not offered for this bot, or null when it is. Plain words first,
 *  the code reference after (`ref`, shown muted). */

/** Short visible word for a bot that cannot stake at all (#139 review item 10). */
export function moneyUnavailableLabel(v: BotView): string {
  const fam = v.cfg?.family ?? v.family;
  if (fam === "inplay") return "In-play";
  if (fam === "forward_test" || fam === "control") return "Publish-only";
  return "No placer";
}

/** A short visible label that opens its explanation on tap / click (not a hover-only title). */
export function InfoChip({ label, text, codeRef, tone = "muted" }: { label: string; text: string; codeRef?: string; tone?: "muted" | "teal" }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Popover>
        <PopoverTrigger
          className={`inline-flex h-6 items-center rounded-md border px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            tone === "teal" ? "border-teal-500/30 bg-teal-500/10 text-teal-300" : "border-dashed border-border text-muted-foreground"
          }`}
        >
          {label}
        </PopoverTrigger>
        <PopoverContent className="w-64 text-xs" side="top">
          <p>{text}</p>
          {codeRef && <p className="font-mono text-[11px] text-muted-foreground">{codeRef}</p>}
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Reason the € switch cannot be turned ON (null = it can), per spec §1.2 B6 + owner decision 4. */
export function moneyOnBlocked(v: BotView, now: number, capable: Set<string> | null): string | null {
  if (isRetired(v)) return "Retired bots never bet — un-retire it first.";
  const why = placementPathReason(v.cfg?.family ?? v.family, v.cfg?.ledger, v.cfg?.books);
  if (why) return `No placement path: ${why}.`;
  if (configStale(v, now)) return `The bot settings snapshot is older than ${STALE_H} h, so the page cannot confirm this bot can be placed. (bot_config export)`;
  if (capable && !capable.has(v.name)) return "Not in the capable set the page read.";
  return null;
}

export function PicksSwitch({ v, now, showWord = false }: { v: BotView; now: number; showWord?: boolean }) {
  const na = picksUnavailable(v);
  if (na) return <InfoChip label={na.label} text={na.text} codeRef={na.ref} tone={na.kind === "rule" ? "teal" : "muted"} />;
  const onBlocked = isRetired(v) ? "Retired bots are not shown on /picks." : configStale(v, now) ? `The bot settings snapshot is older than ${STALE_H} h. (bot_config export)` : null;
  return <ControlSwitch control="show_on_picks" bot={v.name} label={`Show ${v.displayName} on /picks`} disabledReason={onBlocked} size="sm" showWord={showWord} />;
}

export function MoneySwitch({ v, now, showWord = false }: { v: BotView; now: number; showWord?: boolean }) {
  const ctl = useControls();
  const why = placementPathReason(v.cfg?.family ?? v.family, v.cfg?.ledger, v.cfg?.books);
  if (ctl.state.placers.error) {
    return <ControlSwitch control="placer_enabled" bot={v.name} label={`Real money for ${v.displayName}`} size="sm" showWord={showWord} />;
  }
  const row = ctl.placerBy.get(v.name);
  if (!row) {
    return why ? (
      <InfoChip label={moneyUnavailableLabel(v)} text={`This bot cannot bet real money: ${why}.`} codeRef="placement_gate.placement_path_reason" />
    ) : (
      <InfoChip
        label="No switch"
        text="Our placers could place this bot, but it has no real-money switch yet. Switches are added by a reviewed database change and start OFF."
        codeRef="coolbet_placer_bots row (migration)"
      />
    );
  }
  return (
    <ControlSwitch
      control="placer_enabled"
      bot={v.name}
      label={`Real money for ${v.displayName}`}
      lockedReason={row.locked_reason}
      disabledReason={moneyOnBlocked(v, now, ctl.capable)}
      size="sm"
      showWord={showWord}
    />
  );
}

/** Read-only Telegram / performance state. The tooltip is the same one-line reason the sheet
 *  shows (channel-reasons.ts) — never a blanket rule that is wrong for the forward test. */
export function ReadOnlyPublishIcons({ v }: { v: BotView }) {
  const ctl = useControls();
  const vip = (ctl.state.bots.rows.find((b) => b.name === v.name) as (BotControlRow & { vip?: boolean | null }) | undefined)?.vip ?? null;
  const lines = channelLines(v, { showOnPicks: ctl.current("show_on_picks", v.name), vip, publishingPaused: ctl.current("publishing_paused", null) });
  const tg = lines.telegram.on === true;
  const perf = lines.performance.on === true;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${tg ? "bg-info/15 text-info ring-1 ring-info/30" : "text-muted-foreground/40"}`}
        title={lines.telegram.text}
        role="img"
        aria-label={`Telegram ${tg ? "yes" : "no"}`}
      >
        <Send size={11} />
      </span>
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${perf ? "bg-success/15 text-success ring-1 ring-success/30" : "text-muted-foreground/40"}`}
        title={lines.performance.text}
        role="img"
        aria-label={`/performance ${perf ? "yes" : "no"}`}
      >
        <Trophy size={11} />
      </span>
    </span>
  );
}

/** "/picks ≠ Telegram": the Ludogorets shape (migration 356, I14). */

export function RowMenu({ v, onOpen }: { v: BotView; onOpen: (tab?: string) => void }) {
  const ctl = useControls();
  const toast = useToast();
  const picksNa = picksUnavailable(v);
  const hasRow = ctl.placerBy.has(v.name);
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${v.displayName}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-100 outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100 xl:data-[popup-open]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => onOpen("overview")}>
            <Eye /> Open details
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!!picksNa} onClick={() => onOpen("settings")}>
            <Globe /> Show on /picks…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasRow} title={hasRow ? undefined : "No eligibility row"} onClick={() => onOpen("settings")}>
            <Banknote /> Real money…
          </DropdownMenuItem>
          <DropdownMenuItem disabled title="Phase B">
            <Lock /> Retire… (phase B)
          </DropdownMenuItem>
          <DropdownMenuItem disabled title="Phase B">
            <Lock /> Change label… (phase B)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard?.writeText(v.name).then(
                () => toast({ tone: "info", title: `Copied ${v.name}` }),
                () => toast({ tone: "error", title: "Could not copy" }),
              );
            }}
          >
            <Copy /> Copy bot name
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

export function ControlsCell({ v, now, onOpen }: { v: BotView; now: number; onOpen: (tab?: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex min-w-9 justify-center">
        <PicksSwitch v={v} now={now} />
      </span>
      <span className="inline-flex min-w-9 justify-center">
        <MoneySwitch v={v} now={now} />
      </span>
      <ReadOnlyPublishIcons v={v} />
      <span className="ml-auto">
        <RowMenu v={v} onOpen={onOpen} />
      </span>
    </div>
  );
}
