"use client";

// Title, consequence and strength of the confirmation for each (control, direction) — #139
// phase A, spec §3.7. Split out of controls-context.tsx. Owner-facing text: a plain sentence
// first, the code reference muted after.

import type { ConfirmSpec } from "./confirm-control-dialog";
import type { Intent } from "./controls-context";
import { LadderList } from "./ladder-list";
import { PauseReason } from "./pause-reason";
import type { Ladder } from "@/lib/bot-controls/ladder";
import type { BotView } from "./bot-board-model";
import { channelLines } from "./channel-reasons";
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
export function specFor(i: Intent, ctx: { name: string | null; view?: BotView | null; state: ControlState; ladder: Ladder }): ConfirmSpec {
  const f = ctx.state.fleet.row;
  const start = isStartDirection(i.control, i.value);
  const base = { takesEffect: TAKES_EFFECT[i.control], minReason: start ? MIN_REASON : undefined };
  // The bot a per-bot dialog is about: its display name large, its id as the phrase to type.
  const subject = i.bot ? { name: ctx.name ?? i.bot, id: i.bot } : undefined;
  // The same one-line channel reasons the sheet shows (channel-reasons.ts) — never a blanket rule.
  const lines = ctx.view
    ? channelLines(ctx.view, {
        showOnPicks: i.value,
        vip: (ctx.state.bots.rows.find((b) => b.name === i.bot) as { vip?: boolean | null } | undefined)?.vip ?? null,
        publishingPaused: f?.publishing_paused ?? null,
      })
    : null;
  // Inside the /picks dialog the "does not follow this switch" is said once, up front.
  const noSwitch = (t: string) => t.replace(" The /picks switch does not change this.", "");
  switch (i.control) {
    case "placement_paused":
      if (i.value) {
        return {
          ...base,
          strength: "a",
          title: "Pause real-money placement?",
          consequence: (
            <>
              <p className="font-medium text-foreground">
                Kill switch — stops all automatic real bets. Hand-placed bets from the Pick queue are separate.
              </p>
              <p>
                Every automatic placer (the Coolbet UI placer and the best-price router on the Mac) refuses at its next check.
                Bets you place yourself at the bookmaker are not blocked, and recording them from the Pick queue still works.
                Publishing picks is not affected.
              </p>
            </>
          ),
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
        title: i.value ? "Pause Coolbet sweeping?" : "Resume Coolbet sweeping?",
        consequence: (
          <p>
            {i.value
              ? "We stop reading odds from Coolbet (pre-match and live) until you resume. Real bets are not affected — use the placement kill switch for that."
              : "We start reading odds from Coolbet again on the next tick."}
          </p>
        ),
        confirmLabel: i.value ? "Pause sweeping" : "Resume sweeping",
      };
    case "placer_enabled":
      if (!i.value) {
        return {
          ...base,
          strength: "a",
          subject,
          title: "Turn off real money for this bot?",
          consequence: <p>This bot is excluded at the next eligibility read. Its picks keep being recorded.</p>,
          confirmLabel: "Turn off",
        };
      }
      return {
        ...base,
        strength: "b",
        subject,
        title: "Turn on real money for this bot?",
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
          subject,
          title: "Hide this bot from /picks?",
          consequence: (
            <>
              <p>Its picks disappear from /picks and /api/v1/upcoming on the next render.</p>
              {lines && <p>Telegram does not follow this switch: {noSwitch(lines.telegram.text)}</p>}
            </>
          ),
          confirmLabel: "Hide from /picks",
        };
      }
      return {
        ...base,
        strength: "b",
        subject,
        title: "Show this bot on /picks?",
        consequence: (
          <>
            <p>Customers see its picks on /picks immediately.</p>
            {lines ? (
              <ul className="list-disc space-y-1 pl-5">
                <li>Telegram does not follow this switch. {noSwitch(lines.telegram.text)}</li>
                <li>/performance does not follow it either. {noSwitch(lines.performance.text)}</li>
              </ul>
            ) : (
              <p>Telegram and /performance do not follow this switch.</p>
            )}
          </>
        ),
        phrase: i.bot ?? "",
        confirmLabel: "Show on /picks",
      };
  }
}
