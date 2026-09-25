// Where a bot's picks go, and WHY — one plain sentence per channel (#139 UX fix round, 2026-09-24).
//
// [[#155]] ONE STATUS DECIDES DISTRIBUTION (owner, 2026-09-25) — rewritten. The bot's STATUS
// (maturity_label) is the only per-bot input for every customer channel; this file states the rule
// and derives every line from the status (lib/bot-status.ts = engine view bot_distribution):
//  * EXPERIMENTAL — admins only: not on /picks, not on Telegram, not on /performance.
//  * TESTING / BETA / CALIBRATED — sent to /picks AND the public Telegram channel, listed on
//    /performance with its own record. Only BETA / CALIBRATED count in the headline totals.
//    Engine senders read the same view: the model signaler (coolbet_signaler, any SENT bot on the
//    same match · market · selection, 1X2 / O/U 2.5 / BTTS) and the forward-test publisher
//    (arm_bot_sends — grade D's bot is EXPERIMENTAL, so it is recorded, never sent).
//  * VIP — a channel on top of a public status ("VIP · TESTING"): never on the public channel or
//    /picks; its settled picks are on /performance; never in the headline.
//  * Own-money book (shadow_bets: sharp triggers, model-paper, in-play) — never reaches customers,
//    whatever the status.
//  * The Picks-channel pause (publishing_paused) stops BOTH Telegram senders; recording and /picks go on.
// The old per-bot "Show on /picks" switch is gone: bots.show_on_picks is DERIVED from the status by
// an engine trigger (migration 442) that rejects an update against the status.

import type { BotView } from "./bot-board-model";
import { botStatus, inHeadline, onPerformance, sendsPublic, statusLabel } from "@/lib/bot-status";

export interface ChannelLine {
  /** null = unknown (the data the channel reads could not be read). */
  on: boolean | null;
  text: string;
}

export interface ChannelLines {
  telegram: ChannelLine;
  picks: ChannelLine;
  performance: ChannelLine;
}

const CHANGE = "Change the status to change this — there is no separate switch.";

export function channelLines(
  v: BotView,
  opts: {
    /** Unused since #155 (bots.show_on_picks is derived from the status); kept for callers. */
    showOnPicks?: boolean | null;
    /** bots.vip (migration 420); undefined/null = not read. */
    vip?: boolean | null;
    /** coolbet_session_state.publishing_paused (null = unreadable). */
    publishingPaused: boolean | null;
  },
): ChannelLines {
  const label = v.sb?.maturity_label ?? null;
  const retired = !!v.sb?.retired_at || v.sb?.is_active === false;
  const fam = v.family;
  const b = { maturityLabel: label, retiredAt: retired ? (v.sb?.retired_at ?? "retired") : null, isVip: opts.vip === true };
  const st = botStatus(b);
  const shown = statusLabel(b);
  // No bot_config row yet (a bot registered after the last daily export): the page cannot tell which
  // book it writes — say so, never guess.
  const noCfg = !v.cfg && fam !== "control";
  const ownBook = !noCfg && fam !== "forward_test" && fam !== "control" && v.cfg?.ledger !== "simulated_bets";
  const paused = opts.publishingPaused === true ? " Sending is paused for the whole channel right now (Picks channel card)." : "";
  const sends = sendsPublic(b);

  let telegram: ChannelLine;
  let picks: ChannelLine;
  let performance: ChannelLine;
  if (retired) {
    telegram = { on: false, text: "Not on Telegram because the bot is retired." };
    picks = { on: false, text: "Not on /picks because the bot is retired." };
    performance = { on: false, text: "Not on /performance because the bot is retired (its record stays in the retired list)." };
    return { telegram, picks, performance };
  }
  if (fam === "control") {
    telegram = { on: false, text: "Not on Telegram because this is the deliberately bad reference bot — it is never published." };
    picks = { on: false, text: "Not on /picks because the reference bot is never published." };
    performance = { on: false, text: "Not on /performance because the reference bot is never published." };
    return { telegram, picks, performance };
  }
  if (noCfg) {
    const t = `This bot's settings have not been exported yet (daily export), so the page cannot tell whether it bets in a customer book. Its status is ${shown}.`;
    return { telegram: { on: null, text: t }, picks: { on: null, text: t }, performance: { on: null, text: t } };
  }
  if (ownBook) {
    telegram = { on: false, text: "Not on Telegram because it bets in our own-money book (paper or real), which never reaches customers." };
    picks = { on: false, text: "Not on /picks because it bets in our own-money book, which never reaches customers." };
    performance = { on: false, text: "Not on /performance because it bets in our own-money book." };
    return { telegram, picks, performance };
  }

  // Customer ledgers (model bots in simulated_bets, forward-test arms): the STATUS decides.
  if (opts.vip === true) {
    telegram = { on: false, text: `Not on the public Telegram channel because it is a VIP bot (${shown}) — its picks are delivered privately.` };
    picks = { on: false, text: `Not on /picks because it is a VIP bot (${shown}) — its live picks are the paid product.` };
  } else if (sends) {
    const what = fam === "forward_test"
      ? "the forward-test publisher posts its picks (at :05 and :35)"
      : "the channel posts customer-model picks a sent bot holds (match result, goals 2.5, both teams to score)";
    telegram = { on: true, text: `On Telegram because its status is ${shown} — testing, beta and calibrated bots are sent; ${what}.${paused}` };
    picks = { on: true, text: `On /picks because its status is ${shown} — every sent pick is also on /picks.` };
  } else {
    telegram = { on: false, text: `Not on Telegram because its status is ${shown} — experimental bots are admins only. ${CHANGE}` };
    picks = { on: false, text: `Not on /picks because its status is ${shown} — experimental bots are admins only. ${CHANGE}` };
  }
  if (onPerformance(b)) {
    performance = {
      on: true,
      text: `On /performance, marked ${shown}, with its own record${inHeadline(b) ? " — and counted in the headline totals (beta / calibrated)" : ` — NOT in the headline totals (${st === "testing" ? "testing bots have to earn beta first" : "VIP bots never are"})`}.${opts.vip === true ? " Settled picks only." : ""}`,
    };
  } else {
    performance = { on: false, text: `Not on /performance because its status is ${shown} — experimental bots are admins only. ${CHANGE}` };
  }
  return { telegram, picks, performance };
}
