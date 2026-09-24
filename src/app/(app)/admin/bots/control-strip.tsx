"use client";

// The junk-control reference strip on top of the forward-test section (#139, bots-board-ux-spec).
// Split out of bot-row.tsx.

import type { BotView } from "./bot-board-model";
import { ciHalf, count, pct } from "./bot-board-format";
import { RulePill, onKeyOpen, type RowCtx } from "./bot-row";

const MARKET_NAME: Record<string, string> = { "1x2": "1×2", over_under_25: "O/U 2.5" };

export function ControlStrip({ v, ctx }: { v: BotView; ctx: RowCtx }) {
  const open = () => ctx.onOpen(v.name);
  const m = v.metric;
  const split = ctx.control?.byMarket ? [...ctx.control.byMarket.entries()] : [];
  return (
    <div className="xl:px-4 xl:pb-3">
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => onKeyOpen(e, open)}
        title={v.name}
        aria-label="Junk control — open details"
        className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2 outline-none hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-mono text-xs uppercase tracking-wider text-warning">Reference</span>
        <span className="text-sm font-medium">Junk control</span>
        <span className="text-sm tabular-nums text-warning">
          {pct(m.mean)} <span className="text-xs text-muted-foreground">{ciHalf(m.se)}</span>
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">n {count(m.n)}</span>
        {split.map(([mk, x]) => (
          <span key={mk} className="text-xs tabular-nums text-muted-foreground">
            {MARKET_NAME[mk] ?? mk} <span className="text-warning/90">{pct(x.mean)}</span> (n {count(x.n)})
          </span>
        ))}
        <RulePill v={v} />
        <span className="basis-full text-xs text-muted-foreground">
          A deliberately junk-anchored arm. Each mc-CLV bar draws it as a dashed line on that bot&apos;s own market mix — a bot that cannot be told apart from it is not showing skill.
        </span>
      </div>
    </div>
  );
}
