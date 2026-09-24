"use client";

// Pause / resume / run now for one feed (#107 FEEDS-DASHBOARD phase B). Posts to
// /api/admin/feed-control, which only records the request (feed_controls + an audit row in
// feed_actions); the engine enforces a pause within 30 s and starts a run-now within 30 s. So the
// card shows "queued" until the next status refresh confirms it.
//
// #139 UX fix round (2026-09-24): the native prompt()/confirm() are gone — they failed in the
// preview ("prompt() is not supported"), gave no feedback and said nothing about real bets. Each
// action now opens the same styled confirmation the /admin/bots switches use (ConfirmControlDialog,
// strength "a": the safe direction, optional reason), saying what stops, when it takes effect and
// that real bets are NOT affected; the outcome lands as a toast. Run now while the book's hourly
// request budget is spent says it will be refused request by request until the budget resets.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hourglass, Pause, Play, RotateCw } from "lucide-react";
import { ConfirmControlDialog, type ConfirmSpec } from "../bots/confirm-control-dialog";
import { useToast } from "../bots/toast";
import type { BudgetView } from "@/lib/admin-feeds-model";

export type FeedAction = "pause" | "resume" | "run_now";

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
};

/** Which books real money is placed at — for them, the "does not stop real bets" line links the kill switch. */
const BET_BOOKS = new Set(["Coolbet", "Unibet", "Unibet-Site"]);

/** The dialog text for one action on one feed. Exported so the Jobs drawer uses the same words. */
export function feedActionSpec(
  action: FeedAction,
  f: { label: string; book?: string | null; schedule?: string | null },
  budget: BudgetView | null,
): ConfirmSpec {
  const realBets = (
    <p>
      This does <span className="text-foreground">not</span> stop real bets
      {f.book && BET_BOOKS.has(f.book) ? (
        <>
          {" "}— bets at {f.book === "Unibet-Site" ? "Unibet" : f.book} are stopped by the{" "}
          <Link href="/admin/bots#real-money" className="underline underline-offset-2 hover:text-foreground">
            placement kill switch
          </Link>
          .
        </>
      ) : (
        "."
      )}
    </p>
  );
  if (action === "pause") {
    return {
      strength: "a",
      title: `Pause ${f.label}?`,
      consequence: (
        <>
          <p>
            Its scheduled runs are skipped (not counted as failures) until you resume it, so no new data comes from this feed. Every other feed keeps
            running.
          </p>
          {realBets}
        </>
      ),
      takesEffect: "within 30 seconds — the engine checks every 30 s. A run already in progress finishes first.",
      confirmLabel: "Pause",
    };
  }
  if (action === "resume") {
    return {
      strength: "a",
      title: `Resume ${f.label}?`,
      consequence: <p>Its scheduled runs start again{f.schedule ? ` (${f.schedule})` : ""}.</p>,
      takesEffect: "within 30 seconds; the next run starts at its next scheduled slot.",
      confirmLabel: "Resume",
    };
  }
  const spent = budget?.spentNow && budget.cap != null;
  return {
    strength: "a",
    title: `Run ${f.label} now?`,
    consequence: (
      <>
        <p>Starts one extra run now, outside its schedule. The scheduled runs carry on as normal.</p>
        {spent && (
          <p className="text-warning">
            {budget.book}&apos;s request budget for this hour is used up ({budget.requests}/{budget.cap}), so this run will be refused request by
            request and bring back nothing until the budget resets at {hhmm(budget.resetAt)}.
          </p>
        )}
      </>
    ),
    takesEffect: "the engine starts it within 30 seconds; the result shows at the next status check (every 5 min).",
    confirmLabel: spent ? "Run anyway" : "Run now",
  };
}

const DONE: Record<FeedAction, (label: string) => { title: string; body: string }> = {
  pause: (l) => ({ title: `${l} paused`, body: "Takes effect within 30 s. Real bets are not affected." }),
  resume: (l) => ({ title: `${l} resumed`, body: "Runs again from its next scheduled slot." }),
  run_now: (l) => ({ title: `Run of ${l} queued`, body: "Starts within 30 s; this card updates at the next status check." }),
};

/** Posts one feed action; used by the feed cards and by the Jobs drawer. */
export function useFeedAction(feedId: string, label: string) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: FeedAction, reason: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/feed-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feed_id: feedId, action, reason: reason || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = j.error ?? `failed (HTTP ${r.status})`;
        setError(`Not done: ${msg}`);
        toast({ tone: "error", title: `Could not ${action === "run_now" ? "start a run of" : action} ${label}`, body: msg });
        return false;
      }
      toast({ tone: "ok", ...DONE[action](label) });
      router.refresh();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Not done: ${msg}`);
      toast({ tone: "error", title: `Could not reach the server`, body: msg });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}

export function FeedControls({
  feedId,
  label,
  book,
  schedule,
  controls,
  paused,
  runNowPending,
  budget,
  preview,
}: {
  feedId: string;
  label: string;
  book: string | null;
  schedule: string | null;
  controls: string[];
  paused: boolean;
  runNowPending: boolean;
  budget: BudgetView | null;
  /** Design preview: the dialog opens, only Confirm is disabled. */
  preview: boolean;
}) {
  const { run, busy, error, setError } = useFeedAction(feedId, label);
  const [open, setOpen] = useState<FeedAction | null>(null);

  if (!controls.length) return null;

  const spec = open ? feedActionSpec(open, { label, book, schedule }, budget) : null;
  const btn =
    "inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
  const openFor = (a: FeedAction) => {
    setError(null);
    setOpen(a);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {controls.includes("pause") &&
        (paused ? (
          <button type="button" className={`${btn} border-success/40 text-success`} disabled={busy} onClick={() => openFor("resume")}>
            <Play size={12} aria-hidden="true" /> Resume
          </button>
        ) : (
          <button type="button" className={`${btn} border-warning/40 text-warning`} disabled={busy} onClick={() => openFor("pause")}>
            <Pause size={12} aria-hidden="true" /> Pause
          </button>
        ))}
      {controls.includes("run_now") && (
        <button type="button" className={btn} disabled={busy || paused || runNowPending} onClick={() => openFor("run_now")}>
          {runNowPending ? (
            <>
              <Hourglass size={12} aria-hidden="true" /> Run queued
            </>
          ) : (
            <>
              <RotateCw size={12} aria-hidden="true" /> Run now
            </>
          )}
        </button>
      )}
      {controls.includes("run_now") && paused && <span className="text-[11px] text-muted-foreground">Run now: resume the feed first.</span>}
      {controls.includes("run_now") && runNowPending && !paused && (
        <span className="text-[11px] text-muted-foreground">A run is already queued — the engine starts it within 30 s.</span>
      )}
      <ConfirmControlDialog
        spec={spec}
        open={!!open}
        busy={busy}
        error={error}
        readOnlyReason={preview ? "Design preview — nothing is sent. On the live admin this records the request and the engine carries it out." : null}
        onCancel={() => setOpen(null)}
        onConfirm={async (reason) => {
          if (open && (await run(open, reason))) setOpen(null);
        }}
      />
    </div>
  );
}
