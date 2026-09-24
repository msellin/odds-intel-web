"use client";

// One confirmation dialog, two strengths (#139 phase A, spec §3.7).
//
//  (a) the SAFE direction — pause, disarm, OFF, resume publishing: one line of consequence, an
//      optional reason, Confirm. Never blocked by unreadable state.
//  (b) the START direction — resume placement, real-money eligibility ON, show on /picks ON,
//      pausing the customer channel: imperative title, the consequence block, a REQUIRED reason
//      and a typed confirmation whose placeholder shows the exact text. Confirm stays disabled
//      until both are valid; the money variant is red. There is no optimistic state for (b): the
//      control changes only after the server says `applied` and the page re-reads.

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MAX_REASON } from "@/lib/bot-controls/types";

export interface ConfirmSpec {
  strength: "a" | "b";
  title: string;
  consequence: ReactNode;
  /** When-it-takes-effect line (spec §2.4). */
  takesEffect: string;
  /** (b) only: the exact text the operator must type. */
  phrase?: string;
  /** (b) only: minimum reason length (the DB enforces the same). */
  minReason?: number;
  /** Red confirm button (money / destructive). */
  danger?: boolean;
  confirmLabel: string;
  /** Per-bot dialogs: the bot's display name (shown large) and its id (the phrase to type). */
  subject?: { name: string; id: string };
}

export function ConfirmControlDialog({
  spec,
  open,
  busy,
  error,
  onCancel,
  onConfirm,
  readOnlyReason = null,
}: {
  spec: ConfirmSpec | null;
  open: boolean;
  /** Design preview: the dialog opens, only Confirm is disabled. */
  readOnlyReason?: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string, confirmText: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      {spec && (
        // key: a fresh form for every request, so a half-typed phrase never carries over.
        <Body key={`${spec.title}-${spec.subject?.id ?? ""}-${spec.phrase ?? ""}`} spec={spec} busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm} readOnlyReason={readOnlyReason} />
      )}
    </Dialog>
  );
}

function Body({
  spec,
  busy,
  error,
  onCancel,
  onConfirm,
  readOnlyReason,
}: {
  spec: ConfirmSpec;
  readOnlyReason: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string, confirmText: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const b = spec.strength === "b";
  const min = spec.minReason ?? 0;
  const reasonOk = !b || reason.trim().length >= min;
  const phraseOk = !b || !spec.phrase || typed.trim() === spec.phrase;
  const ready = reasonOk && phraseOk && !busy && !readOnlyReason;
  return (
    <DialogContent className={`max-h-[calc(100dvh-2rem)] overflow-y-auto ${b ? "sm:max-w-lg" : "sm:max-w-md"}`} showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>{spec.title}</DialogTitle>
        {spec.subject && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-base font-semibold text-foreground">{spec.subject.name}</div>
            <div className="font-mono text-xs text-muted-foreground">bot id: {spec.subject.id}</div>
          </div>
        )}
        <DialogDescription render={<div />} className="space-y-2 text-sm text-muted-foreground">
          {spec.consequence}
        </DialogDescription>
      </DialogHeader>
      <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Takes effect:</span> {spec.takesEffect}
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onConfirm(reason.trim(), typed.trim());
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium">
            Reason{" "}
            {b ? (
              <span className="font-normal text-muted-foreground">(required, at least {min} characters)</span>
            ) : (
              <span className="font-normal text-muted-foreground">(optional)</span>
            )}
          </span>
          <Textarea
            value={reason}
            maxLength={MAX_REASON}
            onChange={(e) => setReason(e.target.value)}
            placeholder={b ? "Why — this is written to the audit log and sent to the operator chat" : "Optional note for the audit log"}
            disabled={busy}
          />
          {b && (
            <span className="block text-right text-xs tabular-nums text-muted-foreground">
              {reason.trim().length} / {min}+
            </span>
          )}
        </label>
        {b && spec.phrase && (
          <label className="block space-y-1 text-sm">
            <span className="font-medium">
              {spec.subject && spec.phrase === spec.subject.id ? (
                <>
                  Type the bot&apos;s id to confirm: <code className="rounded bg-muted px-1 font-mono text-xs">{spec.phrase}</code>
                </>
              ) : (
                <>
                  Type <code className="rounded bg-muted px-1 font-mono text-xs">{spec.phrase}</code> to confirm
                </>
              )}
            </span>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={spec.phrase}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="font-mono"
            />
          </label>
        )}
        {readOnlyReason && <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">{readOnlyReason}</p>}
        {error && (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-sm text-danger">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!ready}
            aria-busy={busy}
            className={spec.danger ? "bg-red-600 text-white hover:bg-red-600/90" : undefined}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {spec.confirmLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
