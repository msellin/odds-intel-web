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
  bot_v10_all: "v10 reference",
  bot_high_roi_global_v2: "high-ROI global",
  bot_sharp_forward_test_v1: "PICKS forward test",
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
