"use client";

// control_changes as a vertical timeline (#139 phase A, spec §3.6 tab 5; Stripe's "Events").
// Every writer is here — the page, Telegram, the engine setters and migrations — so the log does
// not lie by omission. Refused and conflict outcomes are shown muted with their refusal text.

import { useEffect, useState } from "react";
import { Bot, Database, Globe, Send, Terminal, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchAudit } from "@/lib/bot-controls/client";
import { CONTROL_LABEL, type ChangeSource, type ControlChange } from "@/lib/bot-controls/types";
import { timeAgo, utcStamp } from "./bot-board-format";
import { useControls } from "./controls-context";

/** Who made a change, in words (the raw actor stays in the title). */
export function actorWord(actor: string): string {
  const m = /^migration:(\d+)$/.exec(actor);
  if (m) return `database change ${m[1]}`;
  if (actor.startsWith("telegram:")) return "Telegram";
  if (actor.startsWith("engine:")) return `the engine (${actor.slice(7).split(".").pop()})`;
  return actor;
}

const SOURCE: Record<ChangeSource, { Icon: LucideIcon; word: string }> = {
  web: { Icon: Globe, word: "web" },
  telegram: { Icon: Send, word: "telegram" },
  engine: { Icon: Bot, word: "engine" },
  cli: { Icon: Terminal, word: "cli" },
  migration: { Icon: Database, word: "migration" },
};

function show(control: string, v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "boolean") return String(v);
  switch (control) {
    case "placement_paused":
    case "publishing_paused":
      return v ? "paused" : "running";
    case "daemons_paused":
      return v ? "paused" : "collecting";
    case "real_money_armed":
      return v ? "ARMED" : "not armed";
    default:
      return v ? "on" : "off";
  }
}

export function ActivityTimeline({
  rows,
  now,
  showBot = true,
  error,
}: {
  rows: ControlChange[];
  now: number;
  showBot?: boolean;
  error?: string | null;
}) {
  const { nameOf } = useControls();
  if (error) return <p className="text-sm text-amber-300">Could not read the audit log: {error}</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No control changes recorded.</p>;
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {rows.map((c) => {
        const s = SOURCE[c.source] ?? SOURCE.engine;
        const muted = c.outcome === "refused" || c.outcome === "conflict";
        return (
          <li key={c.id} className={`relative ${muted ? "opacity-70" : ""}`}>
            <span className="absolute -left-[1.4rem] top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background">
              <s.Icon size={11} aria-hidden="true" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="font-medium">{CONTROL_LABEL[c.control] ?? c.control}</span>
              {showBot && c.bot_name && (
                <span className="text-xs text-muted-foreground" title={c.bot_name}>
                  {nameOf(c.bot_name)}
                </span>
              )}
              <span className="tabular-nums">
                {c.old_value === null || c.old_value === undefined
                  ? c.source === "migration"
                    ? `starting state: ${show(c.control, c.new_value)}`
                    : `set to ${show(c.control, c.new_value)}`
                  : `${show(c.control, c.old_value)} → ${show(c.control, c.new_value)}`}
              </span>
              {c.outcome !== "applied" && (
                <span
                  className={`rounded px-1.5 text-xs ${c.outcome === "refused" ? "bg-red-500/10 text-red-300" : c.outcome === "conflict" ? "bg-amber-500/10 text-amber-300" : "bg-muted text-muted-foreground"}`}
                >
                  {c.outcome}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="rounded border border-border px-1">{s.word}</span>
              <span className="break-all" title={c.actor}>{actorWord(c.actor)}</span>
              <span title={utcStamp(c.created_at)}>{timeAgo(c.created_at, now)}</span>
            </div>
            {c.reason && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-xs" title={c.reason}>“{c.reason}”</p>}
            {c.refusal && <p className="mt-0.5 break-words text-xs text-red-300/90">{c.refusal}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** Full control log in a right-hand Sheet (page header → Activity). */
export function ActivitySheet({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const { state } = useControls();
  const [rows, setRows] = useState<ControlChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    fetchAudit(undefined, 200).then((r) => {
      if (!live) return;
      setRows(r.rows);
      setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle>Control activity</SheetTitle>
          <SheetDescription>Every change to a control — from this page, Telegram, the engine and migrations — newest first. Append-only.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ActivityTimeline rows={rows ?? state.changes.rows} now={now} error={rows === null ? state.changes.error : error} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
