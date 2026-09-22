/**
 * Bookmaker names as a READER should see them.
 *
 * Mirrors `workers/utils/book_display.py` — keep the two in step.
 *
 * WHY. Owner, 2026-09-22: "we should name it Unibet, not Unibet-Site...
 * everywhere. its weird with that Site suffix." Right — `-Site` is an internal
 * distinction and means nothing to a customer.
 *
 * ⚠️ DISPLAY ONLY. NEVER RENAME THE KEY. Three Unibet feeds exist in
 * odds_snapshots and two carry data:
 *
 *   Unibet        1,228,791 rows  last 2026-09-12  API-Football feed, dead
 *   Unibet-Site     750,729 rows  last TODAY       our direct scrape, LIVE
 *   Unibet-Kambi    109,785 rows  last 2026-09-15  retired, prices read up to
 *                                                  +23.5% higher than the site
 *
 * Collapsing those identities in the data would merge our live feed into a dead
 * one and destroy every join that keys on the raw string. Only the rendered
 * label changes.
 */
const DISPLAY: Record<string, string> = {
  "Unibet-Site": "Unibet",
};

/** The name to show a customer. Unknown keys pass through unchanged. */
export function displayBook(name: string | null | undefined): string {
  if (!name) return "";
  return DISPLAY[name] ?? name;
}
