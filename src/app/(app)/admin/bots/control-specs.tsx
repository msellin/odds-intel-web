"use client";

// Title, consequence and strength of the confirmation for each (control, direction) — #139
// phase A, spec §3.7. Split out of controls-context.tsx. Owner-facing text: a plain sentence
// first, the code reference muted after.

import type { ConfirmSpec } from "./confirm-control-dialog";
import type { Intent } from "./controls-context";
import { LadderList } from "./ladder-list";
import { PauseReason } from "./pause-reason";
import type { Ladder } from "@/lib/bot-controls/ladder";
import {
  MIN_REASON,
  PHRASE_PAUSE_PICKS,
  PHRASE_RESUME,
  PHRASE_RESUME_STRATEGIC,
  TAKES_EFFECT,
  isStartDirection,
  isStrategicPause,
  type ControlState,
} from "@/lib/bot-controls/types";

/** Title, consequence and strength for each (control, direction). */
export function specFor(i: Intent, ctx: { name: string | null; state: ControlState; ladder: Ladder }): ConfirmSpec {
  const f = ctx.state.fleet.row;
  const start = isStartDirection(i.control, i.value);
  const base = { takesEffect: TAKES_EFFECT[i.control], minReason: start ? MIN_REASON : undefined };
  switch (i.control) {
    case "placement_paused":
      if (i.value) {
        return {
          ...base,
          strength: "a",
          title: "Pause real-money placement?",
          consequence: <p>Every placer refuses at its next check. Publishing picks is not affected.</p>,
          confirmLabel: "Pause placement",
        };
      }
      return {
        ...base,
        strength: "b",
        title: "Resume real-money placement?",
        consequence: (
          <>
            <p>Why it is paused:</p>
            <PauseReason reason={f?.placement_paused_reason ?? null} />
            <p>Resuming stakes nothing by itself — arming, the per-bot switches and a live Mac placer are separate layers:</p>
            <LadderList ladder={ctx.ladder} compact />
          </>
        ),
        phrase: isStrategicPause(f?.placement_paused_reason) ? PHRASE_RESUME_STRATEGIC : PHRASE_RESUME,
        danger: true,
        confirmLabel: "Resume placement",
      };
    case "real_money_disarm":
      return {
        ...base,
        strength: "a",
        title: "Disarm real money?",
        consequence: <p>No placer may stake at its next check, whatever else is on. Re-arming is the owner&apos;s two-step action.</p>,
        confirmLabel: "Disarm",
      };
    case "publishing_paused":
      if (i.value) {
        return {
          ...base,
          strength: "b",
          title: "Stop sending picks to @oddsintelpicks?",
          consequence: (
            <p>
              Customers get nothing on Telegram until this is resumed. Recording never stops — /picks and the pre-registered ledger keep
              filling, and picks made while paused are never sent later. Real-money placement is not affected.
            </p>
          ),
          phrase: PHRASE_PAUSE_PICKS,
          confirmLabel: "Pause the channel",
        };
      }
      return {
        ...base,
        strength: "a",
        title: "Resume sending picks to @oddsintelpicks?",
        consequence: <p>Qualifying picks post again from the next :05/:35 run.</p>,
        confirmLabel: "Resume sending",
      };
    case "daemons_paused":
      return {
        ...base,
        strength: "a",
        title: i.value ? "Pause the Coolbet collection footprint?" : "Resume Coolbet collection?",
        consequence: (
          <p>
            {i.value
              ? "Coolbet HTTP collection (explorer, feed watchdog, in-play collector) skips its next ticks. This is not a money switch."
              : "Coolbet collection resumes on the next tick."}
          </p>
        ),
        confirmLabel: i.value ? "Pause collection" : "Resume collection",
      };
    case "placer_enabled":
      if (!i.value) {
        return {
          ...base,
          strength: "a",
          title: `Turn off real money for ${ctx.name}?`,
          consequence: <p>This bot is excluded at the next eligibility read. Its picks keep being recorded.</p>,
          confirmLabel: "Turn off",
        };
      }
      return {
        ...base,
        strength: "b",
        title: `Turn on real money for ${ctx.name}?`,
        consequence: (
          <>
            <p>
              This selects the bot to bet. <strong className="text-foreground">This alone stakes nothing</strong> — every other layer must
              be open too:
            </p>
            <LadderList ladder={ctx.ladder} compact />
          </>
        ),
        phrase: i.bot ?? "",
        danger: true,
        confirmLabel: "Turn on real money",
      };
    case "show_on_picks":
      if (!i.value) {
        return {
          ...base,
          strength: "a",
          title: `Hide ${ctx.name} from /picks?`,
          consequence: <p>Its picks disappear from /picks and /api/v1/upcoming on the next render. Telegram is not affected.</p>,
          confirmLabel: "Hide from /picks",
        };
      }
      return {
        ...base,
        strength: "b",
        title: `Show ${ctx.name} on /picks?`,
        consequence: (
          <p>
            Customers see its picks on /picks immediately. The Telegram channel does NOT follow this switch — it posts bots that
            have earned the “calibrated” label — and /performance is not affected either.{" "}
            <span className="text-xs opacity-70">(maturity_label = calibrated)</span>
          </p>
        ),
        phrase: i.bot ?? "",
        confirmLabel: "Show on /picks",
      };
  }
}
