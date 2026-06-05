/**
 * GROWTH-ACCURACY-PAGE (Tier B #4, 2026-06-05) — /accuracy public surface.
 *
 * The "pure outcome accuracy" marketing surface. Sister product to
 * /value-bets — same prediction engine, different metric, different audience.
 *
 *   /value-bets answers:  "where is the market wrong?" (CLV / edge / +EV)
 *   /accuracy answers:    "did we call the outcome correctly?" (hit rate)
 *
 * Critical editorial rule: this page does NOT mix CLV / odds / staking
 * language with the accuracy claim. The whole differentiator is the honest
 * framing: "X% accuracy. 0% guarantee of profit. Here's why those aren't
 * the same thing." Competitor sites that publish accuracy % without
 * explaining the gap to profit are doing positioning work, not measurement
 * work. We refuse to be that.
 *
 * Data source: published_picks table (GROWTH-ACCURACY-PICKS-LOG).
 * Backfilled rows are labelled distinctly from live-published rows — the
 * picked_at timestamp on backfill rows is an approximation, not a
 * credibility-equivalent immutable log entry.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Check, X as XIcon, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getAccuracyStats,
  getRecentPublishedPicks,
  type PublishedPickMarket,
} from "@/lib/engine-data";

export const dynamic = "force-dynamic";
export const revalidate = 600; // 10 min cache — page is read-heavy + low-mutation

export const metadata: Metadata = {
  title: "AI Football Prediction Accuracy — OddsIntel",
  description:
    "Pure-outcome hit-rate for OddsIntel's AI football predictions. Every pick logged before kickoff, scored against the actual result, published openly. Backed by the honest caveat: accuracy is not profitability.",
  alternates: { canonical: "https://oddsintel.app/accuracy" },
};

const MARKET_LABEL: Record<PublishedPickMarket, string> = {
  "1x2": "1X2 (match winner)",
  "over_under_15": "Over / Under 1.5 goals",
  "over_under_25": "Over / Under 2.5 goals",
  "btts": "Both teams to score",
};

const SELECTION_LABEL: Record<string, string> = {
  home: "Home",
  draw: "Draw",
  away: "Away",
  over: "Over",
  under: "Under",
  yes: "Yes",
  no: "No",
};

function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtSelection(market: PublishedPickMarket, selection: string): string {
  if (market === "1x2") return SELECTION_LABEL[selection] ?? selection;
  if (market === "over_under_15") return `${SELECTION_LABEL[selection] ?? selection} 1.5`;
  if (market === "over_under_25") return `${SELECTION_LABEL[selection] ?? selection} 2.5`;
  if (market === "btts") return `BTTS ${SELECTION_LABEL[selection] ?? selection}`;
  return selection;
}

export default async function AccuracyPage() {
  // All-time stats (no daysBack window — covers backfilled + live)
  const [stats, recent] = await Promise.all([
    getAccuracyStats(null),
    getRecentPublishedPicks(25, { outcomeOnly: true }),
  ]);

  // Pick the strongest single-market for the headline
  const ou15 = stats.byMarket["over_under_15"];
  const headlineMarket: { label: string; total: number; hits: number; hitRate: number } = {
    label: "Over/Under 1.5 goals",
    total: ou15.total,
    hits: ou15.hits,
    hitRate: ou15.hitRate,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 space-y-10">
      {/* ───── Hero ───── */}
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Prediction track record
        </p>
        <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          <span className="text-green-400">{fmtPct(headlineMarket.hitRate, 0)}</span> accuracy.
          <span className="text-muted-foreground"> 0% guarantee of profit.</span>
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Our AI calls Over / Under 1.5 goals correctly{" "}
          <span className="text-foreground font-semibold">{fmtPct(headlineMarket.hitRate)}</span> of
          the time across{" "}
          <span className="text-foreground font-semibold">{headlineMarket.total.toLocaleString()}</span>{" "}
          settled picks. Every pick is logged before kickoff and scored against the actual result —
          no cherry-picking, no retroactive editing.
        </p>
        <p className="max-w-2xl text-sm text-amber-300/90">
          But accuracy is <span className="font-semibold">not</span> the same as profitability. A
          1.01-odds favourite that wins counts as a hit here — but betting it makes you almost no
          money.{" "}
          <Link
            href="/learn/closing-line-value"
            className="text-foreground underline underline-offset-2 hover:text-green-400"
          >
            Why CLV beats accuracy as a betting metric →
          </Link>
        </p>
      </header>

      {/* ───── Per-market stats ───── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">By market</h2>
        <p className="text-sm text-muted-foreground">
          Different markets have different difficulty. Over/Under 1.5 is structurally the easiest
          because top-flight football averages 2.7 goals/match — picking &quot;over&quot; wins most
          of the time. 1X2 is the hardest because a 3-way market with home advantage tops out
          around 45% by luck alone. We publish all four.
        </p>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground">
                  Market
                </th>
                <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">
                  Picks
                </th>
                <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">
                  Hits
                </th>
                <th className="py-3 pl-3 pr-4 text-right text-xs font-medium text-foreground">
                  Accuracy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {(["over_under_15", "over_under_25", "btts", "1x2"] as PublishedPickMarket[]).map(
                (key) => {
                  const m = stats.byMarket[key];
                  return (
                    <tr key={key} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 pl-4 pr-2 text-foreground/85">
                        {MARKET_LABEL[key]}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {m.total.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {m.hits.toLocaleString()}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right font-mono font-bold text-foreground">
                        {m.total > 0 ? fmtPct(m.hitRate) : "—"}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ───── By confidence bucket ───── */}
      {stats.byBucket.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">By confidence threshold</h2>
          <p className="text-sm text-muted-foreground">
            When the model is more confident, it&apos;s right more often. This is the calibration
            test — if accuracy didn&apos;t rise with confidence, the model would be just guessing
            and labelling.
          </p>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground">
                    Model confidence ≥
                  </th>
                  <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">
                    Picks
                  </th>
                  <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">
                    Hits
                  </th>
                  <th className="py-3 pl-3 pr-4 text-right text-xs font-medium text-foreground">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {stats.byBucket
                  .filter((b) => b.total >= 10)
                  .map((b) => (
                    <tr key={b.threshold} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 pl-4 pr-2 font-mono text-foreground/85">
                        {Math.round(b.threshold * 100)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {b.total.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {b.hits.toLocaleString()}
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-right font-mono font-bold text-foreground">
                        {fmtPct(b.hitRate)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ───── Honest sample-composition disclosure ───── */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-5 py-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground/90">Sample composition — read this</p>
        <ul className="mt-2 space-y-1 pl-4">
          <li className="list-disc">
            <span className="font-mono text-foreground/90">{stats.backfilledTotal.toLocaleString()}</span>{" "}
            picks are <span className="font-semibold">backfilled</span> — reconstructed from our
            historical predictions table. The pick was generated before kickoff (by the same model
            that produces live picks today), but the public log entry was created in a batch on
            2026-06-05. Honest analogy: same answer the model gave at the time, but we&apos;re
            certifying it after the fact.
          </li>
          <li className="list-disc">
            <span className="font-mono text-foreground/90">{stats.livePublishedTotal.toLocaleString()}</span>{" "}
            picks are <span className="font-semibold">live-published</span> — logged into a public
            append-only table the morning of the match, with a kickoff-timestamped insert that we
            can&apos;t edit. These are the credibility-equivalent rows for &quot;we called this
            ahead of time.&quot; The number will grow daily from here.
          </li>
        </ul>
      </section>

      <Separator className="opacity-30" />

      {/* ───── Recent picks ───── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Recent settled picks</h2>
        <p className="text-sm text-muted-foreground">
          The last {recent.length} picks the model called, with the actual outcome. Hover any row
          to see the score.
        </p>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No settled picks to show yet — check back after the first matches finish.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground">
                    Match
                  </th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground">
                    Pick
                  </th>
                  <th className="py-3 px-3 text-right text-xs font-medium text-muted-foreground">
                    Confidence
                  </th>
                  <th className="py-3 pl-3 pr-4 text-center text-xs font-medium text-muted-foreground">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recent.map((p) => {
                  const scoreLabel =
                    p.scoreHome != null && p.scoreAway != null
                      ? `${p.scoreHome}-${p.scoreAway}`
                      : null;
                  const isHit = p.outcome === "hit";
                  const isMiss = p.outcome === "miss";
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-white/[0.02]"
                      title={scoreLabel ? `Final: ${scoreLabel}` : undefined}
                    >
                      <td className="py-2.5 pl-4 pr-2">
                        <div className="text-foreground/85">
                          {p.homeTeam ?? "—"} vs {p.awayTeam ?? "—"}
                        </div>
                        {p.leagueName && (
                          <div className="text-[10px] text-muted-foreground/60">
                            {p.leagueName}
                            {scoreLabel ? ` · ${scoreLabel}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-foreground/85">
                        {fmtSelection(p.market, p.selection)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-foreground/85">
                        {Math.round(p.modelProbability * 100)}%
                      </td>
                      <td className="py-2.5 pl-3 pr-4 text-center">
                        {isHit && (
                          <Check
                            className="inline-block size-4 text-green-400"
                            aria-label="Hit"
                          />
                        )}
                        {isMiss && (
                          <XIcon
                            className="inline-block size-4 text-red-400/80"
                            aria-label="Miss"
                          />
                        )}
                        {p.outcome === "void" && (
                          <span
                            className="text-muted-foreground/40"
                            title="Match cancelled / postponed"
                          >
                            —
                          </span>
                        )}
                        {p.outcome === null && (
                          <Hourglass
                            className="inline-block size-3.5 text-muted-foreground/60"
                            aria-label="Pending"
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ───── Honest framing CTA ───── */}
      <section className="rounded-2xl border border-green-500/25 bg-green-500/[0.05] px-6 py-7 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Accuracy is one half of the story. CLV is the other.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Even 80%-accurate picks lose money at 1.10 odds. The metric that actually proves edge
          over the bookmaker is CLV (closing line value). It&apos;s where we lead — and what
          competitor &quot;X% accuracy&quot; claims hide.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            size="lg"
            className="h-12 bg-green-500 px-8 text-base font-bold text-black shadow-lg shadow-green-500/20 hover:bg-green-400"
            nativeButton={false}
            render={<Link href="/value-bets" />}
          >
            See today&apos;s value bets →
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-12 px-8 text-base border border-white/[0.15] text-foreground hover:bg-white/[0.05]"
            nativeButton={false}
            render={<Link href="/learn/closing-line-value" />}
          >
            Why CLV beats accuracy →
          </Button>
        </div>
      </section>
    </div>
  );
}
