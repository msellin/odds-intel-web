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
// Value import, separate from the `import type` above: CALIBRATED_SINCE is a
// runtime constant, not a type.
import { CALIBRATED_SINCE } from "@/lib/engine-data";

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
  const cal = calibrated?.allTime;
  // PERF-COHORT-RECONCILE (2026-08-21): "bets logged" in the hero must match
  // the ROI headline n above and the ledger row count below. All three now
  // read from the same calibrated cohort. `stats.settledBets` is the wider
  // all-time-all-bots count and was creating a 4192 vs 1208 vs history-row-
  // count mismatch on the same page — fall back to it only when calibrated
  // is missing (cold cache).
  const allTimeSettled = cal?.n ?? stats.settledBets;
  const cal30 = calibrated?.last30d;
  const calRoi = cal?.roiPct ?? null;
  const calN = cal?.n ?? 0;
  const obtainableRoi = cal?.obtainableRoiPct ?? null;
  const obtainableN = cal?.obtainableN ?? 0;
  // DUPLICATED-RULES-REMAINING-2026-09-06: was a bare "2026-05-04". The
  // cohort start is exported as CALIBRATED_SINCE; five copies of the literal
  // agreed only by coincidence, and the day one moved was the day the public
  // cohort silently split in two.
  const calSince = cal?.sinceDate ?? CALIBRATED_SINCE;
  const cal30Roi = cal30?.roiPct ?? null;
  const cal30N = cal30?.n ?? 0;
  // CLV locals removed with the tiles — see CLV-PUBLIC-WITHDRAWN below.

  return (
    <div className="space-y-6">
      {/* ── Big ROI hero — matches landing page language ─────────────── */}
      <section className="text-center pt-4 pb-4 sm:pt-6 sm:pb-6">
        {/* PERF-HEADLINE-IS-THE-RETIRED-ENGINE-2026-09-21. This said "Verified
            football track record" over a number computed on ONE of our two
            engines. V10-HAS-NO-EDGE (2026-09-16) concluded the performance page
            "cannot lead with this bot", and the sharp rule that produced 91 of
            the last 101 published picks writes to picks_forward_test, not
            simulated_bets, so it is structurally invisible here. Same rule as
            PICKS-SHOW-BOTH-BOTS: per-method statements, neither arm borrowing
            the other's record. */}
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400">
          Probability model · open ledger
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          <span className="sr-only">Performance — </span>
          {calN.toLocaleString()} picks, logged before kickoff
        </h1>
        <p className="mt-2 text-lg text-neutral-400 sm:text-2xl">
          Every one recorded before the match and settled against official scores.
        </p>
        <p className="mt-2 text-xs text-neutral-500 sm:text-sm">
          Model engine only · 1X2 + OU 2.5 · BTTS retired Sep 2026 · since {fmtDate(calSince)}
        </p>
        {/* PERF-CLAIM-NOTHING (2026-09-22, owner: "we should just fix it and
            claim nothing").
            
            This led with "+8.17% ROI" under "verified track record". The
            relabel of 2026-09-21 made that number honestly ATTRIBUTED — model
            engine, not the sharp rule — but left it a performance CLAIM, and
            the claim is the part that is not supported:
            
              * residual_test.py (1x2) and residual_test_ou.py (O/U), 2026-09-16:
                alpha = 0.0000 on every arm and every line. Model AUC 0.5796
                against the market's 0.6011 — worse than the price it is betting
                into — and residual AUC 0.4429, i.e. below chance.
              * V10-HAS-NO-EDGE concluded verbatim that this is "not a number to
                correct, it is a number to retire".
              * Measured 2026-09-22 against the market on the same bets: over 90
                days the picks land 3.0pp above implied probability at z = +1.17,
                which is not distinguishable from zero.
            
            So the headline is now a COUNT, which is a fact, and the ROI stays
            below as ledger data rather than as the thing the page asserts. The
            product here is auditability — an open ledger is worth publishing
            even when, especially when, it does not show an edge. Removing the
            numbers entirely would be the opposite of the pitch; removing the
            claim is the point. */}
        <p className="mx-auto mt-4 max-w-xl text-balance text-xs leading-relaxed text-neutral-400">
          <span className="font-semibold text-neutral-300">We are not claiming an edge.</span>{" "}
          Measured against the closing market on the same bets, this model&rsquo;s picks
          are not statistically distinguishable from the price they were taken at.
          The ledger below is published in full so you can check that yourself —
          including the periods where it lost. Most picks published today come from
          a separate sharp-edge rule, tracked from zero since 14 Sep, which makes no
          claim either and does not borrow these numbers.
        </p>
      </section>

      {/* ── 4-tile metric strip (matches landing exactly) ────────────── */}
      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.08]">
        {/* CLV-PUBLIC-WITHDRAWN (2026-09-07): was 4-up ending in the two CLV
            tiles; withdrawing them left the row visibly empty. Now 3-up, with
            the sample size promoted from small print — an ROI without its n is
            the number people should distrust. */}
        <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
          <Metric
            label="Model ROI · all-time (not a claim)"
            value={fmtRoi(calRoi)}
            sub={`${calN.toLocaleString()} bets`}
            accent={calRoi != null && calRoi > 0 ? "positive" : null}
          />
          <Metric
            label="Model ROI · last 30d"
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
            label="Model picks logged"
            value={calN ? calN.toLocaleString() : "—"}
            sub={`since ${calSince}`}
          />
          {/* CLV-PUBLIC-WITHDRAWN (2026-09-06). "Median CLV" and "Beat the
              close" were removed from the public surface. They were WRONG, not
              merely unflattering: both read simulated_bets.clv_pinnacle, which
              settlement.py writes RAW (odds_at_pick / pinnacle_closing - 1) —
              no de-vig, priced at odds_at_pick, a MAX high-water mark rather
              than an executable quote. Measured on the public cohort:

                published "% vs Pinnacle"   +9.49% median
                honest (de-vig, executable) -3.22% median
                published "Beat the close"  78%
                honest                       36%

              "Beat the close: 78%" was the worst of it — a concrete, checkable
              claim wrong by a factor of two, and the first thing a sharp reader
              would test.

              Withdrawn rather than restated, for two reasons. The corrected
              figure is negative, and separately we cannot yet show the metric
              is meaningful on our own data: CLV-EXECUTABLE-PRICE-SUBSET
              measured CLV predicting realised return at r=+0.0375 (NOT
              significant) on the bets that carry a real executable price.
              Publishing a metric we cannot validate is premature in either
              direction.

              ROI is UNAFFECTED and stays — it is a different number, computed
              from stake and pnl, and it does not touch clv_pinnacle.

              The engine keeps computing and storing CLV; only the public
              surface is withdrawn. Restore when the number is both positive and
              demonstrated to predict return. */}
        </div>
      </section>

      {/* Equity sparkline removed 2026-08-21 (PERF-CHART-CONSOLIDATE) —
          the single big chart with 7d/30d/90d toggle lower on the page
          replaces both the sparkline here and the 90d card. */}

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
