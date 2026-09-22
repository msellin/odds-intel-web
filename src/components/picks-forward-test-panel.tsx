import Link from "next/link";
import { getPicksForwardTestSummary } from "@/lib/engine-data";

/**
 * PICKS-ON-PERFORMANCE-2026-09-14 — the published picks, on the page that is
 * supposed to be about published performance.
 *
 * WHY THIS IS NOT A LEADERBOARD ROW. `bot_sharp_forward_test_v1` writes no
 * `simulated_bets`; it reads through to `picks_forward_test`. The leaderboard is
 * built on `simulated_bets`, so the one thing readers actually receive was the
 * one thing that page could not render — while an OWN paper instrument WAS
 * rendering there, through a one-character `experiment`/`experimental` typo.
 *
 * WHY IT DELIBERATELY SHOWS NO HEADLINE ROI. At the time of writing this reads
 * +25.8% on FOUR settled picks. That number is noise, and a page that leads with
 * it teaches the reader to judge us by the statistic that cannot resolve:
 * per-bet return variance is ~1.32, so confirming a true +3% ROI at 80% power
 * needs ≈15,600 bets. The pre-registered instrument is MARGIN-CORRECTED CLV,
 * which converges ~200× faster — so that is what leads, with its n beside it.
 *
 * And the backtest (+5.5%, CI [−0.7, +11.7]) is NEVER shown here. It is a prior,
 * not a result, and the pre-registration is explicit that it is not shown to
 * readers. The previous published track record was inflated by a calibration
 * bug precisely because a modelled number reached a customer surface unlabelled.
 */
/** `sharp_edge_v3_2026_09_14` -> `v3`. Readers should not have to parse a slug,
 *  but the version MUST be visible: two rules with different n and different
 *  results are two different claims, and an unlabelled number invites pooling. */
function shortVersion(ruleVersion: string): string {
  const m = /_v(\d+)_/.exec(ruleVersion);
  return m ? `v${m[1]}` : ruleVersion;
}

export default async function PicksForwardTestPanel() {
  const summary = await getPicksForwardTestSummary();
  if (!summary || summary.current.published === 0) return null;
  const s = summary.current;
  const closed = summary.closed.filter((c) => c.published > 0);

  const started = new Date(s.startedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
  const pct = (v: number | null) =>
    v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

  // 95% CI on the primary instrument. Shown ALWAYS, including when it spans
  // zero — an interval that contains zero is the honest reading at this n, and
  // hiding it would leave a point estimate looking like a finding.
  let clvCi: string | null = null;
  if (s.clvMarginCorrected != null && s.clvMcSd != null && s.nClvMc > 1) {
    const se = s.clvMcSd / Math.sqrt(s.nClvMc);
    clvCi = `[${((s.clvMarginCorrected - 1.96 * se) * 100).toFixed(1)}, ${((s.clvMarginCorrected + 1.96 * se) * 100).toFixed(1)}]`;
  }

  return (
    <section className="mb-6 rounded-lg border border-sky-500/20 bg-sky-500/[0.03] px-4 py-3">
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold text-neutral-100">Published picks</h2>
        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-sky-300">
          rule {shortVersion(s.ruleVersion)} · tracking from {started}
        </span>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-neutral-400">
        These are the picks sent to the Telegram channel and shown on{" "}
        <Link href="/picks" className="text-sky-400 hover:underline">/picks</Link>.
        They are priced against a margin-stripped fair line rather than against our
        own model. <strong className="text-neutral-300">No past performance is claimed
        for this method</strong> — it starts at zero on the date above, and the
        numbers below are the live result so far, win or lose.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Published" value={String(s.published)} />
        <Stat label="Settled" value={`${s.settled}${s.pending ? ` · ${s.pending} pending` : ""}`} />
        <Stat
          label={`Closing-line value (n=${s.nClvMc})`}
          value={pct(s.clvMarginCorrected)}
          sub={clvCi ? `95% CI ${clvCi}` : undefined}
          emphasis
        />
        <Stat
          label="P&L (units)"
          value={`${s.pnlUnits >= 0 ? "+" : ""}${s.pnlUnits.toFixed(2)}`}
          sub={s.settled > 0 ? `${s.won}/${s.settled} won` : undefined}
        />
      </div>

      {/* FORWARD-TEST-VERSIONS-DO-NOT-VANISH (2026-09-15). Earlier rule versions
          keep their numbers, in public, for as long as the method exists.
          Before this the panel showed only the newest version, so each bump
          erased the previous record — and the bumps come fast (v1 to v3 inside
          two days). A track record that resets whenever the number turns bad is
          not a track record. These are NEVER added to the figures above: a rule
          change starts a new test with its own n, and pooling them would fire a
          pre-registered checkpoint early on a mixture of rules. */}
      {closed.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="mb-2 text-[11px] text-neutral-500">
            <strong className="text-neutral-400">Earlier versions of this rule.</strong>{" "}
            Each one is a separate test with its own sample — shown in full, not
            added to the numbers above and not removed when a new version starts.
          </p>
          <div className="space-y-1">
            {closed.map((c) => (
              <div
                key={c.ruleVersion}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[11px] text-neutral-400"
              >
                <span className="text-neutral-300">rule {shortVersion(c.ruleVersion)}</span>
                <span>closed</span>
                <span>{c.published} published</span>
                <span>{c.settled} settled</span>
                <span>
                  CLV {c.nClvMc > 0 ? `${pct(c.clvMarginCorrected)} (n=${c.nClvMc})` : "—"}
                </span>
                <span className={c.pnlUnits >= 0 ? "text-neutral-400" : "text-rose-400/80"}>
                  P&amp;L {c.pnlUnits >= 0 ? "+" : ""}{c.pnlUnits.toFixed(2)}u
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        <strong className="text-neutral-400">How to read this.</strong> Closing-line
        value is the primary measure, not profit: it says whether a pick beat the
        market&apos;s final price, corrected for the bookmaker&apos;s own margin, and it
        settles the question far faster than P&amp;L can. At this sample size the
        profit figure is noise in either direction — a confidence interval spanning
        zero means exactly that, and we would rather show it than a number that
        looks like a result.
      </p>
    </section>
  );
}

function Stat({ label, value, sub, emphasis }: {
  label: string; value: string; sub?: string; emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`font-mono tabular-nums ${emphasis ? "text-lg text-neutral-100" : "text-base text-neutral-300"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-neutral-500">{sub}</div>}
    </div>
  );
}
