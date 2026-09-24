"use client";

// Arm real money — owner-only, two steps (#139 phase A; owner decisions 1 and 2, spec §16).
//
//   Step 1: the live layer checklist, and the owner types ARM REAL MONEY.
//   Step 2: a written reason (>= 20 characters). Confirm → POST /api/admin/bots/controls/arm →
//           admin_arm_real_money (owner re-checked server-side; phrase, reason and expected state
//           re-checked in the DB). The operator chat is notified.
//
// No Telegram code (decision 1). Arming never expires (decision 2). Never optimistic: the tile
// turns red only after the server applied it and the page re-read the state.

import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MAX_REASON, MIN_ARM_REASON, PHRASE_ARM, TAKES_EFFECT } from "@/lib/bot-controls/types";
import type { Ladder } from "@/lib/bot-controls/ladder";
import { LadderList } from "./ladder-list";

export function ArmDialog({
  open,
  ladder,
  busy,
  error,
  onCancel,
  onConfirm,
  readOnlyReason = null,
}: {
  open: boolean;
  readOnlyReason?: string | null;
  ladder: Ladder;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string, phrase: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      {open && <Body ladder={ladder} busy={busy} error={error} onCancel={onCancel} onConfirm={onConfirm} readOnlyReason={readOnlyReason} />}
    </Dialog>
  );
}

function Body({
  ladder,
  busy,
  error,
  onCancel,
  onConfirm,
  readOnlyReason,
}: {
  readOnlyReason: string | null;
  ladder: Ladder;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string, phrase: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [phrase, setPhrase] = useState("");
  const [reason, setReason] = useState("");
  const phraseOk = phrase.trim() === PHRASE_ARM;
  const reasonOk = reason.trim().length >= MIN_ARM_REASON;
  const paused = ladder.layers.find((l) => l.key === "pause")?.state === "blocked";
  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-red-400">
          <ShieldAlert size={18} aria-hidden="true" /> Arm real money — step {step} of 2
        </DialogTitle>
        <DialogDescription render={<div />} className="space-y-2 text-sm text-muted-foreground">
          <p>
            Arming is the fleet master key: while armed, any bot whose € switch is on may stake at the next placement check
            — if placement is not paused and a placer is running on the Mac. It does not expire. Disarming is one click.
          </p>
          {paused && <p className="text-amber-300">Placement is paused, so arming alone stakes nothing yet (legal, but flagged).</p>}
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2">
        <LadderList ladder={ladder} compact />
      </div>
      <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Takes effect:</span> {TAKES_EFFECT.real_money_arm}
      </p>
      {step === 1 ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (phraseOk) setStep(2);
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium">
              Type <code className="rounded bg-muted px-1 font-mono text-xs">{PHRASE_ARM}</code> to continue
            </span>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={PHRASE_ARM}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!phraseOk}>
              Continue
            </Button>
          </DialogFooter>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (reasonOk && !busy && !readOnlyReason) onConfirm(reason.trim(), phrase.trim());
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium">
              Why are you arming? <span className="font-normal text-muted-foreground">(required, at least {MIN_ARM_REASON} characters)</span>
            </span>
            <Textarea
              value={reason}
              maxLength={MAX_REASON}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Written to the audit log and sent to the operator chat"
              disabled={busy}
            />
            <span className="block text-right text-xs tabular-nums text-muted-foreground">
              {reason.trim().length} / {MIN_ARM_REASON}+
            </span>
          </label>
          {readOnlyReason && <p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">{readOnlyReason}</p>}
          {error && (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-sm text-red-300">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={busy}>
              Back
            </Button>
            <Button type="submit" disabled={!reasonOk || busy || !!readOnlyReason} aria-busy={busy} className="bg-red-600 text-white hover:bg-red-600/90">
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              Arm real money
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}
