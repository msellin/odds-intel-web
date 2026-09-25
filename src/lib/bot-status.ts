// ONE STATUS DECIDES DISTRIBUTION ([[#155]], owner 2026-09-25).
//
// A bot's status (`bots.maturity_label`; `retired_at` = retired) is the ONLY per-bot input that decides
// where its picks go. This file is the web face of the engine's single source — the view
// `bot_distribution` + function `bot_public_status` (engine migrations 437 / 442) and
// workers/utils/bot_status.py. Smoke ONE-STATUS-DECIDES-DISTRIBUTION pins the three to each other.
//
//   EXPERIMENTAL  admins only (/admin/bots) · nothing sent · nothing public
//   TESTING       /performance row marked TESTING · SENT to /picks + the public Telegram channel ·
//                 own record · NOT in the headline totals
//   BETA          sent · own record · headline totals
//   CALIBRATED    same as BETA, with the strongest evidence
//   ⭐ VIP        a CHANNEL on top of a public status ("VIP · TESTING"): live picks to the paid channel
//                 only, the public sees settled picks, own record, never the headline
//
// `bots.show_on_picks` / `bots.show_on_performance` are DERIVED from the status by an engine trigger
// (an update that contradicts the status is rejected) — never read them as a separate decision.

/** Statuses that put a bot on /performance and (unless VIP) send its picks. */
export const PUBLIC_STATUSES = ["testing", "beta", "calibrated"] as const;
/** Statuses whose picks count in the headline totals (VIP bots never do). */
export const HEADLINE_STATUSES = ["calibrated", "beta"] as const;

export type BotStatus = "experimental" | "testing" | "beta" | "calibrated" | "retired";

interface StatusInput {
  maturityLabel?: string | null;
  retiredAt?: string | null;
  isVip?: boolean | null;
}

export function botStatus(b: StatusInput): BotStatus {
  if (b.retiredAt || b.maturityLabel === "retired") return "retired";
  const l = b.maturityLabel ?? "experimental";
  return (["experimental", "testing", "beta", "calibrated"] as const).includes(l as never) ? (l as BotStatus) : "experimental";
}

/** On /performance (VIP bots included — settled picks only). = bot_distribution.on_performance */
export function onPerformance(b: StatusInput): boolean {
  return (PUBLIC_STATUSES as readonly string[]).includes(botStatus(b));
}

/** Sent to /picks and the public Telegram channel. = bot_distribution.sent_public */
export function sendsPublic(b: StatusInput): boolean {
  return onPerformance(b) && b.isVip !== true;
}

/** Counted in the headline totals. = bot_distribution.in_headline */
export function inHeadline(b: StatusInput): boolean {
  return (HEADLINE_STATUSES as readonly string[]).includes(botStatus(b)) && b.isVip !== true;
}

/** The label a reader sees: "TESTING", "VIP · TESTING", … = bot_distribution.label */
export function statusLabel(b: StatusInput): string {
  const s = botStatus(b).toUpperCase();
  return b.isVip === true ? `VIP · ${s}` : s;
}
