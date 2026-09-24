/**
 * /admin/feeds — pure, client-safe view helpers (#139 UX fix round, 2026-09-24). Re-exported from
 * src/lib/admin-feeds.ts (the server loader). No imports: safe in client components and the Overview.
 */

/**
 * The engine's status check (feed_health) runs every 5 min. Older than this, its colours are not a
 * claim we can make: /admin/feeds turns every block and count grey ("unknown"). Lives here, not in
 * the client board, because a server component cannot read a constant out of a "use client" file.
 */
export const STATUS_STALE_MIN = 15;

/** One row of book_footprint: requests we sent one book in one clock hour, and how many we refused. */
export interface FootprintHour {
  book: string;
  hour: string;
  requests: number;
  refused: number;
}

// ── Request budget, in plain words (#139 UX fix round, 2026-09-24) ─────────────────────────────
//
// feed_health's reason "request budget spent — N requests refused this hour" fired next to
// under-budget numbers (Tonybet 73/150, Coolbet 352/500), because it only looks at THIS hour's
// `refused` counter. Two things put refusals into an hour whose budget was NOT spent:
//   1. footprint.py adds a refusal to the hour in which the counter is FLUSHED, not the hour it
//      happened. Tonybet 2026-09-24: 150/150 at 18:00–19:00, refused at 18:59:57 (VPS log
//      "footprint REFUSED Tonybet: db=150 … cap=150"), recorded under 19:00 (81 requests).
//   2. Coolbet shows 2–22 refusals in most hours at 150–460 of 500, one refusal per error, and no
//      "footprint REFUSED Coolbet" line in the VPS logs — so they come from a process elsewhere
//      counting against a different number. Not a spent shared budget.
// So the page reads book_footprint itself and says which hour actually ran out, when it reset,
// and what this hour stands at. Pure, so it is testable and the Overview can reuse it.

export interface BudgetView {
  book: string;
  cap: number | null;
  /** This clock hour. */
  hourStart: string;
  requests: number;
  refused: number;
  /** true when this hour's requests reached the budget: new requests are refused until resetAt. */
  spentNow: boolean;
  /** Start of the next clock hour (UTC) — when the budget resets. */
  resetAt: string;
  /** The most recent earlier hour (last 24 h) whose requests reached the budget. */
  lastSpent: { hourStart: string; requests: number } | null;
  /** Refusals booked in an hour below budget; `late` = they belong to the spent hour just before. */
  strayRefusals: { n: number; late: boolean } | null;
}

const hh = (iso: string) => `${String(new Date(iso).getUTCHours()).padStart(2, "0")}:00`;

export function budgetView(book: string, cap: number | null | undefined, hours: FootprintHour[], now: number): BudgetView {
  const hourStart = new Date(Math.floor(now / 3_600_000) * 3_600_000);
  const key = (iso: string) => Math.floor(new Date(iso).getTime() / 3_600_000);
  const mine = hours.filter((h) => h.book === book);
  const cur = mine.find((h) => key(h.hour) === key(hourStart.toISOString()));
  const c = cap ?? null;
  const requests = cur?.requests ?? 0;
  const refused = cur?.refused ?? 0;
  const spentNow = c != null && requests >= c;
  const earlier = mine
    .filter((h) => key(h.hour) < key(hourStart.toISOString()) && c != null && h.requests >= c && now - new Date(h.hour).getTime() <= 25 * 3_600_000)
    .sort((a, b) => (a.hour < b.hour ? 1 : -1))[0];
  const prevSpent = !!earlier && key(earlier.hour) === key(hourStart.toISOString()) - 1;
  return {
    book,
    cap: c,
    hourStart: hourStart.toISOString(),
    requests,
    refused,
    spentNow,
    resetAt: new Date(hourStart.getTime() + 3_600_000).toISOString(),
    lastSpent: earlier ? { hourStart: new Date(earlier.hour).toISOString(), requests: earlier.requests } : null,
    strayRefusals: !spentNow && refused > 0 ? { n: refused, late: prevSpent } : null,
  };
}

/** One or two plain sentences: which window ran out, when it resets, where this hour stands. */
export function budgetSentence(b: BudgetView): string {
  if (b.cap == null) return `${b.requests} requests this hour (no budget set for ${b.book}).`;
  const now = `This hour (${hh(b.hourStart)}–${hh(b.resetAt)} UTC): ${b.requests}/${b.cap}.`;
  if (b.spentNow) {
    return `Budget ran out this hour (${b.requests}/${b.cap}) — every further request is refused until it resets at ${hh(b.resetAt)} UTC.`;
  }
  const parts: string[] = [];
  if (b.lastSpent) {
    const end = hh(new Date(new Date(b.lastSpent.hourStart).getTime() + 3_600_000).toISOString());
    parts.push(`Budget last ran out ${hh(b.lastSpent.hourStart)}–${end} UTC (${b.lastSpent.requests}/${b.cap}); it reset at ${end}.`);
  }
  parts.push(now);
  if (b.strayRefusals) {
    parts.push(
      b.strayRefusals.late
        ? `The ${b.strayRefusals.n} refusals booked this hour happened at the end of the hour before and were logged a moment late.`
        : `${b.strayRefusals.n} requests were refused this hour although only ${b.requests} of ${b.cap} are used — the shared hourly budget is not what refused them (cause not yet known).`,
    );
  }
  return parts.join(" ");
}

/** The engine's reason text for a refusal-only warning ("request budget spent — N requests refused this hour"). */
export const BUDGET_REASON_RE = /^request budget spent/i;

// ── Data-quality groups (#139 UX fix round) ─────────────────────────────────────────────────────
// The four things the checks catch, in the owner's words. The Overview reuses this grouping.
export const DQ_GROUPS = [
  "Price far from the other books",
  "Wrong match on the board",
  "Home/away or over/under swapped",
  "Results disagree",
] as const;

export function dqGroupLabel(check_name: string): string {
  switch (check_name) {
    case "single_market_off":
      return DQ_GROUPS[0];
    case "wrong_fixture_board":
      return DQ_GROUPS[1];
    case "mirrored_1x2":
    case "swapped_two_way":
      return DQ_GROUPS[2];
    case "results_disagree":
    case "results_corrected":
      return DQ_GROUPS[3];
    default:
      return check_name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
}
