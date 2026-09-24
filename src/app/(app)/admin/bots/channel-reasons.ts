// Where a bot's picks go, and WHY — one plain sentence per channel (#139 UX fix round, 2026-09-24).
//
// Before this the sheet said "the channel posts bots that earned the calibrated label" for EVERY
// bot, which is wrong for the forward test: a "testing" forward-test arm showed "Telegram: Yes"
// right under that sentence. There are two different publishers, with two different rules, and
// this file is the one place that states them. Every line is derived from the same data the
// channels use; nothing here decides anything.
//
// The real rules (engine, verified 2026-09-24):
//  * Telegram, forward test — job_publish_picks_forward_test (workers/scheduler.py, :05/:35) posts
//    every pick of a PUBLISHED arm (scripts/publish_picks_forward_test.py PUBLISHED_ARMS = live +
//    consensus_anchor), except consensus grade D, which is recorded but never sent. The maturity
//    label plays no part. bot_config.telegram = arm published AND not retired
//    (scripts/export_bot_config.py _forward_test_rows).
//  * Telegram, customer model bots (simulated_bets) — the model signaler
//    (workers/automation/coolbet_signaler.py is_public_eligible) posts a pick when a "calibrated"
//    bot holds it (any calibrated bot on the same match · market · selection) in 1X2 / O/U 2.5 /
//    BTTS. bot_config.telegram = live AND maturity_label = 'calibrated'. The /picks switch plays
//    no part.
//  * Own-money book (shadow_bets: sharp triggers, model-paper, in-play) — never reaches customers.
//  * The Picks-channel pause (coolbet_session_state.publishing_paused) stops BOTH Telegram senders;
//    recording and /picks continue.
//  * /picks — forward test: published arms, fixed by the pre-registration; model bots: the
//    bots.show_on_picks switch; own-money bots: never.
//  * /performance — src/app/(app)/performance/page.tsx: forward-test arms from their own ledger
//    once they have published picks; other bots when maturity_label is 'calibrated' or 'beta'
//    (PUBLIC_MATURITY_LABELS), or the paid-tier VIP bot (bots.vip, settled picks only).

import type { BotView } from "./bot-board-model";

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

const PERF_LABELS = new Set(["calibrated", "beta"]);

const q = (label: string | null | undefined) => (label ? `“${label}”` : "none");

function isGradeD(v: BotView): boolean {
  return (v.cfg?.gates ?? []).some((g) => g.name === "send" && g.value === "recorded, not sent");
}

export function channelLines(
  v: BotView,
  opts: {
    /** bots.show_on_picks as the page read it (null = unreadable). */
    showOnPicks: boolean | null;
    /** bots.vip (migration 420); undefined/null = not read. */
    vip?: boolean | null;
    /** coolbet_session_state.publishing_paused (null = unreadable). */
    publishingPaused: boolean | null;
  },
): ChannelLines {
  const label = v.sb?.maturity_label ?? null;
  const retired = !!v.sb?.retired_at || v.sb?.is_active === false;
  const fam = v.family;
  // No bot_config row yet (a bot registered after the last daily export, e.g. #141's new 1X2
  // bots on their first day): the page cannot tell which book it writes — say so, never guess.
  const noCfg = !v.cfg && fam !== "control";
  const ownBook = !noCfg && fam !== "forward_test" && fam !== "control" && v.cfg?.ledger !== "simulated_bets";
  const tg = v.caps?.telegram ?? null;
  const paused = opts.publishingPaused === true ? " Sending is paused for the whole channel right now (Picks channel card)." : "";

  // ── Telegram ──
  let telegram: ChannelLine;
  if (retired) telegram = { on: false, text: "Not on Telegram because the bot is retired." };
  else if (fam === "control") telegram = { on: false, text: "Not on Telegram because this is the deliberately bad reference bot — it is never published." };
  else if (opts.vip === true) telegram = { on: false, text: "Not on the public Telegram channel because it is the paid-tier (VIP) bot — its picks are delivered privately." };
  else if (tg == null) telegram = { on: null, text: "Unknown — the bot's channel settings could not be read." };
  else if (noCfg) telegram = { on: tg, text: `${tg ? "On" : "Not on"} Telegram — this bot's settings have not been exported yet (daily export), so the page cannot show why.` };
  else if (fam === "forward_test") {
    telegram = tg
      ? { on: true, text: `On Telegram because it is a published arm of the pre-registered forward test: the forward-test publisher posts every pick it makes (at :05 and :35). Its label (${q(label)}) plays no part.${paused}` }
      : isGradeD(v)
        ? { on: false, text: "Not on Telegram because grade D (weak) picks are recorded for the test but never sent." }
        : { on: false, text: "Not on Telegram because its forward-test arm is not one of the published arms." };
  } else if (!ownBook) {
    telegram = tg
      ? { on: true, text: `On Telegram because its label is “calibrated” — the channel posts customer-model picks that a calibrated bot holds (match result, goals 2.5, both teams to score).${paused}` }
      : { on: false, text: `Not on Telegram because its label is ${q(label)} — the channel only posts customer-model picks held by a “calibrated” bot. The /picks switch does not change this.` };
  } else {
    telegram = tg
      ? { on: true, text: `On Telegram (the exported settings say so).${paused}` }
      : { on: false, text: "Not on Telegram because it bets in our own-money book (paper or real), which never reaches customers." };
  }

  // ── /picks ──
  let picks: ChannelLine;
  if (retired) picks = { on: false, text: "Not on /picks because the bot is retired." };
  else if (fam === "control") picks = { on: false, text: "Not on /picks because the reference bot is never published." };
  else if (fam === "forward_test") {
    const pub = v.caps?.publish ?? null;
    picks =
      pub == null
        ? { on: null, text: "Unknown — the bot's channel settings could not be read." }
        : pub
          ? { on: true, text: "On /picks because it is a published arm of the pre-registered forward test — fixed in advance, not a switch." }
          : { on: false, text: isGradeD(v) ? "Not on /picks because grade D (weak) picks are recorded, never published." : "Not on /picks because its forward-test arm is not published." };
  } else if (ownBook) picks = { on: false, text: "Not on /picks because it bets in our own-money book, which never reaches customers." };
  else if (opts.vip === true) picks = { on: false, text: "Not on /picks because it is the paid-tier (VIP) bot — its live picks are the paid product." };
  else if (opts.showOnPicks == null) picks = { on: null, text: "Unknown — the /picks switch could not be read." };
  else picks = opts.showOnPicks
    ? { on: true, text: "On /picks because its /picks switch is on." }
    : { on: false, text: "Not on /picks because its /picks switch is off." };

  // ── /performance ──
  let performance: ChannelLine;
  if (retired) performance = { on: false, text: "Not on /performance because the bot is retired (its record stays in the retired list)." };
  else if (fam === "control") performance = { on: false, text: "Not on /performance because the reference bot is never published." };
  else if (fam === "forward_test") {
    const pub = v.caps?.publish ?? null;
    performance = pub
      ? { on: true, text: "On /performance because published forward-test arms always show their own record there." }
      : { on: false, text: "Not on /performance because this arm publishes nothing, so it has no public record." };
  } else if (opts.vip === true) {
    performance = { on: true, text: "On /performance because it is the paid-tier (VIP) bot — settled picks only, whatever its label." };
  } else if (PERF_LABELS.has(label ?? "")) {
    performance = { on: true, text: `On /performance because its label is ${q(label)} — calibrated and beta bots are listed. The /picks switch does not change this.` };
  } else {
    performance = { on: false, text: `Not on /performance because its label is ${q(label)} — only “calibrated” and “beta” bots are listed.` };
  }

  return { telegram, picks, performance };
}
