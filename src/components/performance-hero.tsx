/**
 * /performance hero — reworked 2026-07-06 to match the landing page's
 * verification narrative instead of the previous 8-tile spreadsheet.
 *
 * Reason: a smart non-technical visitor landing on /performance
 * previously saw "TOTAL SETTLED 3,617" as the first number — an ops
 * metric, not the ROI story. On iPhone SE the ROI wasn't even in the
 * first phone-height. Plus a purple "Model v2 · B-ML3 meta-model"
 * banner and a "next upgrade · log-loss chips" callout that read as
 * internal changelog leaked onto the marketing surface.
 *
 * Now: same visual language as the landing — big single ROI, a 4-tile
 * strip covering the same metrics the landing exposes (all-time ROI,
 * 30d ROI, Median CLV, Beat-the-close), the equity sparkline, and one
 * subtle system-status line at the bottom. The Model V2 banner and
 * NextModelCallout are gone; if we want to bring them back for Elite
 * users behind a tier gate we can, but the audit called them the
 * single biggest jargon offender on the public surface.
 */
import type {
  TrackRecordStats,
  DashboardCache,
  ModelV2Stats,
  CalibratedHeadlineStats,
} from "@/lib/engine-data";
import { EquitySparkline } from "@/components/equity-sparkline";

interface Props {
  stats: TrackRecordStats;
  cache: DashboardCache | null;
  botsTracked?: number | null;
  /** Retained in the signature so `PerformanceClient` doesn't need
   *  churning while this hero rework settles; unused in the current
   *  render. If Model-V2 provenance ends up wanted for Elite users
   *  it can come back behind a tier gate. */
  modelV2Stats?: ModelV2Stats | null;
  activeBotCount?: number | null;
  retiredBotCount?: number | null;
  calibrated?: CalibratedHeadlineStats | null;
}

function fmtRoi(r: number | null): string {
  if (r == null) return "—";
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)}%`;
}

function fmtDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function PerformanceHero({
  stats,
  cache,
  activeBotCount,
  retiredBotCount,
  calibrated,
}: Props) {
  const daysRunning = Math.floor(
    (Date.now() - new Date("2026-05-01").getTime()) / 86400000,
  );
  const allTimeSettled = stats.settledBets;

  const cal = calibrated?.allTime;
  const cal30 = calibrated?.last30d;
  const calRoi = cal?.roiPct ?? null;
  const calN = cal?.n ?? 0;
  const calSince = cal?.sinceDate ?? "2026-05-04";
  const cal30Roi = cal30?.roiPct ?? null;
  const cal30N = cal30?.n ?? 0;
  const clvMedian = cal?.medianClvPct ?? null;
  const clvPinMedian = cal?.medianClvPinPct ?? null;
  const clvBeat = cal?.clvBeatPct ?? null;

  return (
    <div className="space-y-6">
      {/* ── Big ROI hero — matches landing page language ─────────────── */}
      <section className="text-center pt-4 pb-4 sm:pt-6 sm:pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
          Verified football track record
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          <span className="sr-only">Performance — </span>
          <span
            className={
              calRoi == null
                ? "text-muted-foreground"
                : calRoi >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
            }
          >
            {fmtRoi(calRoi)} ROI
          </span>
        </h1>
        <p className="mt-2 text-lg text-neutral-400 sm:text-2xl">
          across {calN.toLocaleString()} verified pre-match picks
        </p>
        <p className="mt-2 text-xs text-neutral-500 sm:text-sm">
          Calibrated cohort · 1X2 + OU 2.5 + BTTS · since {fmtDate(calSince)}
        </p>
      </section>

      {/* ── 4-tile metric strip (matches landing exactly) ────────────── */}
      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.08]">
        <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
          <Metric
            label="ROI · all-time"
            value={fmtRoi(calRoi)}
            sub={`${calN.toLocaleString()} bets`}
            accent={calRoi != null && calRoi > 0 ? "positive" : null}
          />
          <Metric
            label="ROI · last 30d"
            value={fmtRoi(cal30Roi)}
            sub={`${cal30N.toLocaleString()} bets`}
            accent={
              cal30Roi != null && cal30Roi > 0
                ? "positive"
                : cal30Roi != null && cal30Roi < 0
                  ? "negative"
                  : null
            }
          />
          <Metric
            label="Median CLV"
            value={
              clvMedian != null
                ? `${clvMedian > 0 ? "+" : ""}${clvMedian.toFixed(2)}%`
                : "—"
            }
            sub={
              clvPinMedian != null
                ? `${clvPinMedian >= 0 ? "+" : ""}${clvPinMedian.toFixed(1)}% vs Pinnacle`
                : "vs closing line"
            }
            accent={clvMedian != null && clvMedian > 0 ? "positive" : null}
          />
          <Metric
            label="Beat the close"
            value={clvBeat != null ? `${clvBeat.toFixed(0)}%` : "—"}
            sub="of picks"
            accent={clvBeat != null && clvBeat >= 50 ? "positive" : null}
          />
        </div>
      </section>

      {/* ── Equity sparkline ─────────────────────────────────────────── */}
      <EquitySparkline curve={cache?.daily_pnl_curve_30d ?? null} />

      {/* ── System status — one small line at the bottom ─────────────
          Trivia that used to occupy 4 hero tiles is compressed here.
          Retired-bot count is intentionally kept — it's the strongest
          signal that we actually cull failed experiments. */}
      <p className="text-center font-mono text-[11px] uppercase tracking-widest text-neutral-500">
        {allTimeSettled.toLocaleString()} bets logged
        {activeBotCount != null && (
          <>
            <span className="mx-2 text-neutral-700">·</span>
            {activeBotCount} strategies live
          </>
        )}
        {retiredBotCount != null && (
          <>
            <span className="mx-2 text-neutral-700">·</span>
            {retiredBotCount} retired
          </>
        )}
        <span className="mx-2 text-neutral-700">·</span>
        {daysRunning} days running
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "positive" | "negative" | null;
}) {
  return (
    <div className="bg-neutral-950 px-4 py-5">
      <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          accent === "positive"
            ? "text-emerald-400"
            : accent === "negative"
              ? "text-red-400"
              : "text-neutral-100"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
