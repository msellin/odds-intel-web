/**
 * [[#157]] "The work done" + the collapsed RETIRED section on /performance.
 *
 * Kept visibly apart from the headline: the hero ROI is today's BETA + CALIBRATED strategies only;
 * everything here is every strategy we ever scored, retired included. Retired picks keep counting
 * in these totals (anything recorded is counted) and never in the active ROI. Figures come from
 * lib/performance-work-done.ts (engine views over bot_performance — the ONE ROI/CLV computation).
 *
 * Why families and not every bot: 70 retired strategies is a wall nobody reads. Each FAMILY row
 * sums EVERY retired bot in it, losers included, so nothing is hidden; up to 2 representatives per
 * family are picked by sample size and close coverage only — never by result (migration 446).
 */
import type { WorkDone, RetiredRecord, RetiredBot } from "@/lib/performance-work-done";

const int = (n: number) => n.toLocaleString("en-US");
const pct = (v: number | null, digits = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
const tone = (v: number | null) =>
  v == null ? "text-neutral-500" : v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-neutral-300";
const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";

function flags(r: { nSwapWindow: number; nOuCalBug: number; nPreMidJuly: number }): string[] {
  const out: string[] = [];
  if (r.nSwapWindow > 0) out.push(`${int(r.nSwapWindow)} in the 1X2 swap window`);
  if (r.nOuCalBug > 0) out.push(`${int(r.nOuCalBug)} in the O/U calibration-bug window`);
  if (r.nPreMidJuly > 0) out.push(`${int(r.nPreMidJuly)} before mid-July (weaker closes)`);
  return out;
}

function Clv({ clv, n, inplay }: { clv: number | null; n: number; inplay?: boolean }) {
  if (inplay) return <span className="text-neutral-500">n/a (in-play)</span>;
  if (n === 0 || clv == null) return <span className="text-neutral-500">—</span>;
  return (
    <span className={tone(clv)}>
      {pct(clv)} <span className="text-neutral-500">(n {int(n)})</span>
    </span>
  );
}

function FamilyRow({ f, reps }: { f: RetiredRecord; reps: RetiredBot[] }) {
  const fl = flags(f);
  const more = f.bots - reps.length;
  return (
    <div className="border-t border-white/[0.05] px-5 py-3">
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 sm:grid-cols-[1fr_5rem_6rem_9rem]">
        <div>
          <p className="text-sm font-medium text-neutral-100">{f.title}</p>
          <p className="text-[11px] text-neutral-500">
            {f.bots} {f.bots === 1 ? "strategy" : "strategies"} · {int(f.picks)} picks · {int(f.won)}W–{int(f.lost)}L
          </p>
        </div>
        <p className={`font-mono text-sm tabular-nums sm:text-right ${tone(f.roi)}`}>
          <span className="text-[10px] text-neutral-500 sm:hidden">ROI </span>
          {pct(f.roi)}
        </p>
        <p className="hidden font-mono text-sm tabular-nums text-neutral-400 sm:block sm:text-right">
          {int(f.settled)}
        </p>
        <p className="col-span-2 font-mono text-[12px] tabular-nums sm:col-span-1 sm:text-right">
          <span className="text-[10px] text-neutral-500 sm:hidden">CLV </span>
          <Clv clv={f.clv} n={f.clvN} inplay={f.key === "inplay"} />
        </p>
      </div>
      {fl.length > 0 && <p className="mt-1 text-[11px] text-amber-400/80">Flagged picks: {fl.join(" · ")}</p>}
      {reps.length > 0 && (
        <ul className="mt-2 space-y-1 border-l border-white/[0.06] pl-3">
          {reps.map((b) => (
            <li key={b.key} className="text-[12px] text-neutral-400">
              <span className="text-neutral-200">{b.displayName ?? b.key}</span>
              <span className="text-neutral-500"> · {int(b.settled)} settled · retired {day(b.retiredAt)} · </span>
              ROI <span className={tone(b.roi)}>{pct(b.roi)}</span>
              <span className="text-neutral-500"> · </span>
              CLV <Clv clv={b.clv} n={b.clvN} inplay={b.group === "inplay"} />
            </li>
          ))}
          {more > 0 && (
            <li className="text-[11px] text-neutral-500">
              + {more} more retired {more === 1 ? "strategy" : "strategies"} in this family, counted in the row above.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function PerformanceWorkDone({ data }: { data: WorkDone | null }) {
  if (!data) return null;
  const { lesson } = data;
  return (
    <section className="mt-4 space-y-3">
      {/* WORK DONE — every strategy ever scored. Deliberately NOT the headline ROI. */}
      <div className="rounded-xl border border-white/[0.08] bg-neutral-950/60 p-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">The work behind it</p>
        <p className="mt-2 text-sm text-neutral-200">
          <span className="font-mono font-bold tabular-nums">{int(data.picks)}</span> picks tested across{" "}
          <span className="font-mono font-bold tabular-nums">{data.strategies}</span> strategies since{" "}
          {monthYear(data.since)} ({int(data.distinctSelections)} distinct selections, {int(data.settled)} settled).{" "}
          <span className="font-mono tabular-nums">{data.retired}</span> strategies were retired,{" "}
          {data.notPublicActive} are still in internal testing, and {data.publicActive} are on this page.
        </p>
        <p className="mt-2 text-[11px] text-neutral-500">
          The ROI at the top is today&apos;s proven strategies only. Retired picks count here and in the
          section below — never in that number, whether they won or lost.
        </p>
      </div>

      {/* RETIRED — collapsed by default */}
      <details className="group rounded-xl border border-white/[0.08] bg-neutral-950/60 overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 hover:bg-white/[0.02]">
          <div>
            <p className="text-sm font-semibold text-neutral-100">Show retired strategies ({data.retired})</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {int(data.retiredPicks)} picks, grouped by family, losers included.
            </p>
          </div>
          <span className="text-neutral-500 transition-transform group-open:rotate-180">▾</span>
        </summary>

        {lesson.modelN > 0 && lesson.sharpN > 0 && (
          <p className="border-t border-white/[0.05] px-5 py-3 text-[12px] text-neutral-300">
            <span className="font-semibold text-neutral-100">What the trigger bots taught us:</span> the same
            soft-book prices beat the sharp closing line by{" "}
            <span className={tone(lesson.sharpClv)}>{pct(lesson.sharpClv)}</span> (n {int(lesson.sharpN)}) when
            they were chosen against the sharp line, and{" "}
            <span className={tone(lesson.modelClv)}>{pct(lesson.modelClv)}</span> (n {int(lesson.modelN)}) when
            they were chosen against our model. What decides the bet is the yardstick, not the bookmaker.
          </p>
        )}

        <div className="hidden border-t border-white/[0.05] px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[1fr_5rem_6rem_9rem]">
          <span>Family</span>
          <span className="text-right">ROI</span>
          <span className="text-right">Settled</span>
          <span className="text-right">CLV</span>
        </div>
        {data.families.map((f) => (
          <FamilyRow key={f.key} f={f} reps={data.representatives.filter((b) => b.group === f.key)} />
        ))}

        <p className="border-t border-white/[0.05] px-5 py-3 text-[11px] leading-relaxed text-neutral-500">
          Same basis as every row above: flat 1 unit per pick at the best price available when the pick
          was made (all books); in-play picks at their own in-play price. CLV = the pick&apos;s price
          against the sharp closing line (in-play picks have none). Flags: the 1X2 swap window is
          10 May–14 Sep, when our served match-result model partly mixed up home and away; the O/U
          calibration bug ran 3–13 Sep; closing lines before mid-July are weaker evidence. Flagged
          picks are counted, not removed. Named strategies are the largest per family with a good
          closing-line record, never picked by result.
        </p>
      </details>
    </section>
  );
}
