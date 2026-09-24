"use client";

// The numbered real-money layer ladder + CAN STAKE line (#139 phase A, spec §3.4). Pure display;
// used by the Real money card, the confirmation dialogs and the bot sheet.

import { AlertTriangle, Ban, CircleDot, HelpCircle, Info, LockOpen, ShieldAlert } from "lucide-react";
import type { Layer, Ladder } from "@/lib/bot-controls/ladder";

// Colour = what money can do at this layer (#139 UX fix round, 2026-09-24). A BLOCKED layer used
// to be green, and green reads as "go" — the opposite of what it means. Now:
//   open    → red, unlocked padlock: money can flow through this layer
//   blocked → neutral grey, Ban: this layer stops money. Off is not good or bad, it is off.
//   unknown → amber, ?: unreadable — never treated as off
//   info    → muted dot: not a gate
// The sr-only word keeps the state readable without colour.
const STATE_UI: Record<Layer["state"], { Icon: typeof Info; cls: string; word: string }> = {
  open: { Icon: LockOpen, cls: "text-danger", word: "open — money can pass" },
  blocked: { Icon: Ban, cls: "text-muted-foreground", word: "blocks" },
  unknown: { Icon: HelpCircle, cls: "text-warning", word: "unknown" },
  info: { Icon: CircleDot, cls: "text-muted-foreground/70", word: "information" },
};

export function LadderList({ ladder, compact = false }: { ladder: Ladder; compact?: boolean }) {
  return (
    <div className="space-y-1.5">
      <ol className={`divide-y divide-border/60 ${compact ? "text-xs" : "text-sm"}`}>
        {ladder.layers.map((l) => {
          const u = STATE_UI[l.state];
          return (
            <li key={l.key} className={`grid grid-cols-[1.25rem_minmax(0,9rem)_1fr] items-start gap-x-2 ${compact ? "py-1" : "py-1.5"}`}>
              <span className="font-mono text-muted-foreground tabular-nums">{l.n}</span>
              <span className="text-muted-foreground">{l.title}</span>
              <span className={`inline-flex min-w-0 items-start gap-1.5 ${u.cls}`}>
                <u.Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="text-foreground">{l.value}</span>
                  <span className="sr-only"> ({u.word})</span>
                  {!compact && l.detail && <span className="block line-clamp-2 text-xs text-muted-foreground" title={l.detail}>{l.detail}</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <CanStakeLine ladder={ladder} />
    </div>
  );
}

export function CanStakeLine({ ladder }: { ladder: Ladder }) {
  if (ladder.canStake === "unknown") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-sm font-semibold text-warning">
        <AlertTriangle size={16} aria-hidden="true" /> CAN STAKE: UNKNOWN — layer{ladder.unknownAt.length === 1 ? "" : "s"} {ladder.unknownAt.join(", ")} unreadable
        {ladder.blockedAt.length > 0 && <span className="font-normal text-muted-foreground">(also blocked at {ladder.blockedAt.join(", ")})</span>}
      </div>
    );
  }
  if (ladder.canStake === "yes") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-danger/20 px-2.5 py-1.5 text-sm font-semibold text-danger">
        <ShieldAlert size={16} aria-hidden="true" /> CAN STAKE: YES — {ladder.stakingBots.length} bot{ladder.stakingBots.length === 1 ? "" : "s"}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm font-semibold text-foreground">
      <Ban size={16} className="text-muted-foreground" aria-hidden="true" /> CAN STAKE: NO — blocked at layer{ladder.blockedAt.length === 1 ? "" : "s"}{" "}
      {ladder.blockedAt.join(", ")}
    </div>
  );
}

