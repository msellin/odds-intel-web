// /admin/bots — sorting within a family (#139 design system §7, 2026-09-24). Pure. "verdict" is
// the board's original order (sortBots: beats → loses → inconclusive → too early → no CLV, silent
// last). Every other key puts missing values LAST in both directions, so "sort by CLV" never
// floats a bot with no measured CLV to the top by treating it as 0.

import { sortBots, type BotView } from "./bot-board-model";
import type { SortDir, SortKey } from "./board-toolbar";

function value(v: BotView, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return v.displayName.toLowerCase();
    case "clv":
      return v.metric.metric === "lift" || !v.metric.n ? null : v.metric.mean;
    case "p7":
      return v.sb?.picks_7d ?? null;
    case "settled":
      return v.sb?.settled ?? null;
    case "roi":
      return (v.sb?.settled ?? 0) > 0 ? v.sb?.roi_unit ?? null : null;
    case "last":
      return v.sb?.last_pick_at ? new Date(v.sb.last_pick_at).getTime() : null;
    default:
      return null;
  }
}

export function sorter(key: SortKey, dir: SortDir): (a: BotView, b: BotView) => number {
  if (key === "verdict") return dir === "asc" ? sortBots : (a, b) => sortBots(b, a);
  const sign = dir === "asc" ? 1 : -1;
  return (a, b) => {
    const va = value(a, key);
    const vb = value(b, key);
    if (va == null && vb == null) return sortBots(a, b);
    if (va == null) return 1;
    if (vb == null) return -1;
    const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return c !== 0 ? sign * c : sortBots(a, b);
  };
}
