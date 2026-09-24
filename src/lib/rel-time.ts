/**
 * ONE relative-time format for every admin page (#139 UX fix round, 2026-09-24).
 *
 * Before this, /admin/bots' Activity drawer and /admin/activity rendered the same audit rows
 * with different wording, and callers glued " ago" onto a helper that can return a date — so an
 * old row read "12 Sep ago". Two functions, both pure and client-safe:
 *
 *   timeAgo(iso, now)  → "just now" · "25 min ago" · "6 h ago" · "2 d ago" · "12 Sep"   (a moment)
 *   relSpan(iso, now)  → "just now" · "25 min"     · "6 h"     · "2 d"     · "12 Sep"   (a duration,
 *                        for "since …", "… old", "last pick …")
 *
 * Thresholds: minutes below 90, hours below 36, days below 14, then the calendar date (UTC).
 * `now` is passed in (react-hooks/purity: the render clock is read once, in the data layer).
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : (now - t) / 60000;
}

function dateWord(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** A duration: "just now" · "25 min" · "6 h" · "2 d" · "12 Sep" ("never" when unknown). */
export function relSpan(iso: string | null | undefined, now: number): string {
  const m = minutesSince(iso, now);
  if (m == null) return "never";
  if (m < 1) return "just now";
  if (m < 90) return `${Math.round(m)} min`;
  if (m < 60 * 36) return `${Math.round(m / 60)} h`;
  if (m < 1440 * 14) return `${Math.round(m / 1440)} d`;
  return dateWord(iso as string);
}

/** A moment: "just now" · "25 min ago" · "6 h ago" · "2 d ago" · "12 Sep" ("never" when unknown). */
export function timeAgo(iso: string | null | undefined, now: number): string {
  const s = relSpan(iso, now);
  return /^\d+ (min|h|d)$/.test(s) ? `${s} ago` : s;
}
