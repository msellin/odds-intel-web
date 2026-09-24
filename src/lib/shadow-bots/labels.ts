/**
 * Display-only labels for /admin/shadow-bots. Nothing here decides which bots
 * exist — that is `bots WHERE retired_at IS NULL` (see queries.ts). A bot with
 * no entry here still renders, under its DB name minus the `bot_` prefix, so
 * adding a bot never requires a frontend change (visibility invariant,
 * dev/active/own-implementation-plan.md).
 */
export const BOT_SHORT_LABELS: Record<string, string> = {
  bot_coolbet_1x2_model_v1: "CB 1x2 model",
  bot_coolbet_ou_model_v1: "CB O/U model",
  bot_ou35_model_v1: "O/U 3.5 model",
  bot_coolbet_trigger_sharp_1x2_v1: "CB 1x2 sharp",
  bot_coolbet_trigger_sharp_ou_v1: "CB O/U sharp",
  bot_unibet_trigger_sharp_1x2_v1: "UB 1x2 sharp",
  bot_unibet_trigger_sharp_ou_v1: "UB O/U sharp",
  bot_trigger_1x2_sharp_v1: "1x2 sharp (all books)",
  bot_trigger_ou_sharp_v1: "O/U sharp (all books)",
  bot_trigger_1x2_sharp_tight_v1: "1x2 sharp TIGHT",
  // V10-SPLIT-BY-MARKET (migration 375, 2026-09-22). One "v10 reference" became
  // two, because the two markets measured on OPPOSITE sides of zero.
  // These are the ADMIN short labels (compact, for a dense operator table);
  // `bots.display_name` is the customer-facing name on /performance.
  bot_v10_1x2: "v10 1x2",
  bot_v10_ou: "v10 O/U",
  bot_high_roi_global_v2: "high-ROI global",
  bot_sharp_forward_test_v1: "PICKS forward test",
  bot_sharp_1x2_v1: "PICKS sharp 1x2",
  bot_sharp_ou_v1: "PICKS sharp O/U",
};

export function botShortLabel(name: string): string {
  return BOT_SHORT_LABELS[name] ?? name.replace(/^bot_/, "");
}

/** Canonical human label for a (market, selection) pair. */
export function formatPickLabel(market: string, selection: string): string {
  const m = (market ?? "").toLowerCase();
  const sel = (selection ?? "").toLowerCase();
  if (m === "1x2") {
    if (sel === "home") return "Home";
    if (sel === "draw") return "Draw";
    if (sel === "away") return "Away";
  }
  if (m === "1x2_1h") {
    return `1H ${sel.charAt(0).toUpperCase()}${sel.slice(1)}`;
  }
  if (m === "btts") return sel === "yes" ? "BTTS yes" : "BTTS no";
  if (m.startsWith("over_under_")) {
    const line = m.replace("over_under_", "").replace(/^(\d)(\d)$/, "$1.$2");
    return sel === "over" ? `Over ${line}` : `Under ${line}`;
  }
  return `${market} ${sel}`;
}

/** Book chip text. Only Coolbet and Unibet-Site have a placement path. */
export const BOOK_CHIP: Record<string, { chip: string; placeable: boolean; realBetsName: string }> = {
  Coolbet: { chip: "CB", placeable: true, realBetsName: "Coolbet" },
  // real_bets.bookmaker is 'Unibet' (accessible_bookmakers row); settlement maps
  // it to the 'Unibet-Site' snapshot feed for own-book CLV (settlement.py
  // _BOOK_FEED). The quote we show is always the Unibet-Site feed.
  "Unibet-Site": { chip: "UB", placeable: true, realBetsName: "Unibet" },
  Epicbet: { chip: "EB", placeable: false, realBetsName: "Epicbet" },
};

/**
 * Compact age for a table cell: `—` · `12m` · `4h` · `3d`.
 *
 * Minutes up to 2 h, hours up to 48 h, days beyond. NULL renders `—` and MUST
 * NOT be styled as fresh anywhere — see `quoteFreshness()` in verdict.ts, which
 * gives NULL its own UNKNOWN state. A negative age (clock skew between the
 * engine host and this one) clamps to `0m` rather than printing `-3m`.
 */
export function formatAge(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return "—";
  if (min <= 0) return "0m";
  if (min < 120) return `${Math.round(min)}m`;
  if (min < 2880) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

/**
 * The in-play rig's CONTROL arm — same two triggers, priced off API-Football's
 * live aggregate instead of the book's on-screen board (migration 357). Its
 * price is a feed nobody can bet, so it is marked CONTROL and never offers a
 * Place action: the gap between the arms is the measurement, not a strategy.
 */
export const INPLAY_CONTROL_BOTS = new Set(["bot_inplay_slowstate_afctl_v1"]);

export function isInplayControlBot(botName: string | null | undefined): boolean {
  return botName != null && INPLAY_CONTROL_BOTS.has(botName);
}

/** `true` when `validTo` is in the future and within `days` of `now`. */
export function expiresWithinDays(
  validTo: string | null | undefined,
  days: number,
  now: number = Date.now(),
): boolean {
  if (!validTo) return false;
  const t = Date.parse(validTo);
  if (!Number.isFinite(t)) return false;
  return t >= now && t - now <= days * 86400_000;
}

/** Promo type → short chip text. Unknown types fall through to the raw value. */
export const PROMO_TYPE_LABEL: Record<string, string> = {
  odds_boost: "odds boost",
  free_bet: "free bet",
  acca_insurance: "acca ins.",
  deposit_bonus: "deposit",
  cashback: "cashback",
  other: "other",
};
