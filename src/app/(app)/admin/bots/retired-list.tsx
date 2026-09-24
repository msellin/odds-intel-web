"use client";

// /admin/bots — Retired tab (#139, bots-board-ux-spec §11). Grouped by retirement month
// (latest open), default filter "Had picks"; bots that never produced a pick collapse into
// one expandable line. Each row keeps the final verdict + forest bar + N · ROI, shows the
// retired date instead of last pick, and the reason as readable text with a `more` toggle.

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { FAMILY_INFO, type RetiredView } from "./bot-board-model";
import { monthLabel, utcStamp, dayMonth } from "./bot-board-format";
import { ACCENT, ClvCell, HEAD, NRoiCell, ROW_GRID, VerdictCell, onKeyOpen, type RowCtx } from "./bot-row";
import { ForestAxis } from "./bot-viz";

function Reason({ text }: { text: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="flex items-start gap-1 text-xs text-foreground/90">
      <span className={open ? "" : "line-clamp-1"}>{text}</span>
      {text.length > 90 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="shrink-0 text-muted-foreground underline-offset-2 hover:underline"
          aria-expanded={open}
        >
          {open ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

function RetiredHeader() {
  return (
    <div className={`hidden border-t border-border px-4 py-2 ${ROW_GRID}`}>
      <div className={HEAD}>Bot</div>
      <div className={HEAD}>Final verdict</div>
      <div className="flex items-end gap-3">
        <div className={`w-[64px] shrink-0 text-right ${HEAD}`}>CLV</div>
        <div className="min-w-0 flex-1"><ForestAxis /></div>
      </div>
      <div />
      <div className={HEAD}>Settled · ROI</div>
      <div className={HEAD}>Retired</div>
      <div />
    </div>
  );
}

function RetiredRow({ r, ctx }: { r: RetiredView; ctx: RowCtx }) {
  const v = r.view;
  const acc = ACCENT[FAMILY_INFO[v.family].accent];
  const open = () => ctx.onOpen(v.name);
  const retired = r.retiredAt ? dayMonth(new Date(r.retiredAt)) : "—";
  const collecting = v.caps?.writing_7d === true;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => onKeyOpen(e, open)}
      title={v.name}
      aria-label={`${v.displayName} (retired) — open details`}
      className={`cursor-pointer space-y-2 border-l-[3px] ${acc.bar} rounded-lg border border-border bg-card p-3 outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-t xl:bg-transparent xl:px-4 xl:py-3`}
    >
      <div className={`space-y-2 xl:space-y-0 ${ROW_GRID}`}>
        <div className="min-w-0 space-y-0.5">
          <div className="line-clamp-2 text-sm font-medium" title={`${v.displayName} (${v.name})`}>{v.displayName}</div>
          <div className="line-clamp-2 text-xs text-muted-foreground" title={v.identity}>
            {FAMILY_INFO[v.family].title}
            {v.identity ? ` · ${v.identity}` : ""}
          </div>
          {collecting && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
              title="Retired bots keep collecting picks on purpose (owner decision), so their record stays measurable. Wrote a pick in the last 7 days."
            >
              <Activity size={12} aria-hidden="true" /> still collecting
            </span>
          )}
        </div>
        <VerdictCell v={v} />
        <div className="xl:hidden"><ClvCell v={v} withAxis /></div>
        <div className="hidden xl:block"><ClvCell v={v} /></div>
        <div className="hidden xl:block" />
        <NRoiCell v={v} />
        <div className="text-sm tabular-nums text-muted-foreground" title={utcStamp(r.retiredAt)}>
          <span className="xl:hidden">Retired </span>
          {retired}
        </div>
        <div className="hidden xl:block" />
      </div>
      <Reason text={r.info?.retired_reason} />
    </div>
  );
}

export function RetiredList({ rows, ctx, error }: { rows: RetiredView[]; ctx: RowCtx; error: string | null }) {
  const [filter, setFilter] = useState<"had" | "all">("had");
  const [showNever, setShowNever] = useState(false);
  const never = rows.filter((r) => !r.hadPicks);
  const shown = filter === "had" ? rows.filter((r) => r.hadPicks) : rows;
  const months = useMemo(() => {
    const m = new Map<string, RetiredView[]>();
    for (const r of shown) {
      const k = monthLabel(r.retiredAt);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    // Retired-but-still-collecting bots first: their record is still moving.
    const live = (r: RetiredView) => (r.view.caps?.writing_7d ? 0 : 1);
    return [...m.entries()].map(([k, list]) => [k, [...list].sort((a, b) => live(a) - live(b))] as const);
  }, [shown]);

  const pill = (on: boolean) =>
    `min-h-10 rounded-full border px-3 py-1.5 text-sm ${on ? "border-foreground/40 bg-accent text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-warning">Retirement reasons unavailable ({error}).</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={pill(filter === "had")} onClick={() => setFilter("had")} aria-pressed={filter === "had"}>
          Had picks ({rows.length - never.length})
        </button>
        <button type="button" className={pill(filter === "all")} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>
          All ({rows.length})
        </button>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No retired bots found.</p>}
      {months.map(([month, list], i) => (
        <details key={month} open={i === 0} className="group rounded-xl border border-border bg-card/40">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-base font-semibold">
            {month} <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
          </summary>
          <RetiredHeader />
          <div className="grid grid-cols-1 gap-3 px-3 pb-3 md:grid-cols-2 xl:block xl:px-0 xl:pb-0">
            {list.map((r) => (
              <RetiredRow key={r.view.name} r={r} ctx={ctx} />
            ))}
          </div>
        </details>
      ))}
      {filter === "had" && never.length > 0 && (
        <div className="rounded-xl border border-dashed border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setShowNever((s) => !s)}
            aria-expanded={showNever}
            className="min-h-10 text-sm text-muted-foreground hover:text-foreground"
          >
            {never.length} retired bots never produced a pick {showNever ? "▾" : "▸"}
          </button>
          {showNever && (
            <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {never.map((r) => (
                <li key={r.view.name} className="min-w-0">
                  <button type="button" onClick={() => ctx.onOpen(r.view.name)} className="truncate text-left hover:underline" title={r.info?.retired_reason ?? r.view.name}>
                    {r.view.displayName}
                  </button>
                  <span className="text-xs text-muted-foreground"> · {r.retiredAt ? dayMonth(new Date(r.retiredAt)) : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
