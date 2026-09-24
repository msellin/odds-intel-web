/**
 * Which bots HAVE a real-money placement path — the page's copy of the engine rule
 * `workers/automation/placement_gate.placement_path_reason` (#139, owner decision 4 as corrected
 * 2026-09-24). Used only to explain, next to each bot, why the € switch is or is not offered.
 * The engine gate and the DB function (migration 413) enforce the same rule; smoke
 * CONTROL-PLACEMENT-PATH-RULE-AGREES keeps the three copies in step.
 *
 * The rule: the picks live in shadow_bets (the placers load shadow_bets_unique by bot name, for
 * any bot), they are pre-match (not the in-play family), they are priced at a book a placer
 * supports (Coolbet: UI placer + router; Unibet-Site: the router's Unibet arm), and the bot is not
 * a publish-only pre-registered test or its control. simulated_bets bots are not capable: the only
 * placer for that ledger (the old API placer) is not a supported executor any more.
 */

export const PLACER_BOOKS = ["Coolbet", "Unibet-Site"] as const;
export const PLACEMENT_LEDGER = "shadow_bets";
export const NO_PLACEMENT_FAMILIES: Record<string, string> = {
  inplay: "in-play — the placers are pre-match only",
  forward_test: "publish-only pre-registered test — it is never staked",
  control: "publish-only pre-registered control — it is never staked",
};

/** null when the bot has a placement path; otherwise why not (shown next to the switch). */
export function placementPathReason(
  family: string | null | undefined,
  ledger: string | null | undefined,
  books: string[] | null | undefined,
): string | null {
  if (family && family in NO_PLACEMENT_FAMILIES) return NO_PLACEMENT_FAMILIES[family];
  if (ledger === "simulated_bets") return "no real-money placer reads simulated_bets (the old API placer is not a supported executor)";
  if (ledger !== PLACEMENT_LEDGER) return `no placer reads this ledger${ledger ? ` (${ledger})` : ""}`;
  if (!(books ?? []).some((b) => (PLACER_BOOKS as readonly string[]).includes(b))) {
    return "priced only at books no placer supports (placers: Coolbet, Unibet-Site)";
  }
  return null;
}
