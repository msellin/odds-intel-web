/**
 * /picks — the pre-registered sharp-edge forward test.
 *
 * PICKS-PAGE-SHOW-FORWARD-TEST (2026-09-14). This page used to read
 * `simulated_bets` filtered to calibrated bots and show a MODEL edge. Migration
 * 335 removed the O/U Platt calibrator that had manufactured ~8-9 percentage
 * points of that edge for months (fitted on raw ensemble probabilities, applied
 * to Pinnacle-shrunk ones), and with it gone nothing clears the old model
 * floors: the query returned nothing and the page was dead.
 *
 * It now renders `picks_forward_test`, live arm only. See
 * src/lib/forward-test-picks.ts for the three rules this page exists to hold —
 * no backtest number, no /performance link, no junk-anchor arm.
 *
 * TIER: free, including signed-out. The same picks go to the public Telegram
 * channel the moment they are generated, so there is nothing here to gate. The
 * old auth-aware cohort split (PICKS-USER-GATE) went with the model path — this
 * rule has ONE cohort by construction (top 8 a day), and splitting it would
 * change what is being measured in a running pre-registered test.
 */
import Link from "next/link";
import { Nav } from "@/components/nav";
import {
  hasStarted,
  sharpBreakEvenOdds,
  fetchForwardTestPicks,
  type ForwardTestPick,
} from "@/lib/forward-test-picks";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sharp-line picks — OddsIntel",
  description:
    "Football picks priced against the sharpest line in the market, not against a model. Pre-registered forward test, running publicly since 14 September 2026.",
};

const START_DATE = "14 September 2026";

function formatMarket(market: string, selection: string): string {
  const m = (market || "").toLowerCase();
  const s = (selection || "").toLowerCase();
  if (m === "1x2") {
    if (s === "home") return "Home win";
    if (s === "away") return "Away win";
    if (s === "draw") return "Draw";
    return selection;
  }
  if (m.startsWith("over_under")) {
    if (s.includes("over")) return "Over 2.5 goals";
    if (s.includes("under")) return "Under 2.5 goals";
    return selection;
  }
  return `${market} · ${selection}`;
}

function formatKickoff(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "—", time: "—" };
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const date =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === tomorrow.toDateString()
        ? "Tomorrow"
        : d.toDateString() === yesterday.toDateString()
          ? "Yesterday"
          : d.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
  const time =
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC";
  return { date, time };
}

function OutcomeBadge({
  outcome,
  kickoff,
}: {
  outcome: ForwardTestPick["outcome"];
  kickoff: string | null;
}) {
  if (outcome === "won")
    return (
      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
        Won
      </span>
    );
  if (outcome === "lost")
    return (
      <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-400">
        Lost
      </span>
    );
  if (outcome === "push" || outcome === "void")
    return (
      <span className="rounded-md bg-neutral-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
        {outcome === "push" ? "Push" : "Void"}
      </span>
    );
  if (hasStarted(kickoff))
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Live
      </span>
    );
  return null;
}

// RUNNING-RESULT-REMOVED-FROM-PICKS-2026-09-14 (owner): the RunningResult
// component that stood here is gone with its mount. The running result lives
// on /performance now — one track record in one place, rather than two that
// drift apart.

export default async function PicksPage() {
  let picks: ForwardTestPick[] = [];
  let loadFailed = false;
  try {
    picks = await fetchForwardTestPicks();
  } catch {
    loadFailed = true;
  }

  const upcoming = picks.filter((p) => p.outcome == null);
  const groups = new Map<string, ForwardTestPick[]>();
  for (const p of picks) {
    const { date } = formatKickoff(p.kickoff_utc);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(p);
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      <Nav />

      <main className="mx-auto max-w-4xl px-4 pt-12 pb-20">
        <div className="space-y-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            Priced against the sharpest line — no model
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            {/* PICKS-HEADLINE-COUNT-2026-09-14: "N picks on the board" counts
                only UNRESOLVED picks, but the list below is headed "Today · 8
                picks" — so the moment anything settled the page read "3 picks
                on the board" above a list of 8. The count was never wrong; it
                was just unambiguous only while nothing had settled yet, which
                stopped being true on day one. Say which number it is. */}
            {upcoming.length > 0
              ? `${upcoming.length} pick${upcoming.length === 1 ? "" : "s"} still to settle`
              : picks.length > 0
                ? "All of today's picks have settled"
                : "No picks on the board right now"}
          </h1>
          <p className="mx-auto max-w-xl text-balance text-sm text-neutral-400 sm:text-base">
            A pick is a price that beats the sharpest line in the market, with
            the bookmaker&apos;s margin stripped out, by at least 3%. Up to eight
            a day. Some days there are none.
          </p>
        </div>

        {/* The honest framing, above everything. This method has no history and
            the page says so before it shows a single number. */}
        <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-5 py-4">
          <p className="text-sm font-semibold text-emerald-300">
            New method, tracked from {START_DATE}. No past performance is
            claimed.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
            These picks use no prediction model. Each one is priced directly
            against the sharpest available line with the margin removed. The
            method starts at zero on the date above — any earlier track record on
            this site belongs to a different, model-based method and does not
            carry over to these picks.
          </p>
        </div>

        {/* RUNNING-RESULT-REMOVED-FROM-PICKS-2026-09-14 (owner). /picks is the
            pick list — what is on today and at what price. The running result
            lives on /performance, where the fleet's numbers already are, so a
            reader sees one track record in one place instead of two that will
            drift apart. It is also n=5 right now, and a results block at the top
            of a pick list invites exactly the reading the method does not
            support yet. */}

        {loadFailed && (
          <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-neutral-400">
            Couldn&apos;t load picks right now. This is a loading problem, not a
            result — try again shortly.
          </div>
        )}

        {!loadFailed && picks.length === 0 ? (
          <div className="mt-10 rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-neutral-400">
              Nothing clears the bar in the current window.
              <br />
              That is a normal outcome, not an outage — the rule publishes only
              prices that beat the sharp line by 3% or more, and on a thin day no
              price does.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {Array.from(groups.entries()).map(([date, group]) => (
              <section key={date}>
                <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-500">
                  {date} · {group.length} pick{group.length === 1 ? "" : "s"}
                </h2>
                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  {group.map((p, idx) => {
                    const { time } = formatKickoff(p.kickoff_utc);
                    const edgePct = p.edge != null ? p.edge * 100 : null;
                    return (
                      <div
                        key={p.id}
                        className={`px-4 py-4 sm:px-5 ${
                          idx > 0 ? "border-t border-white/[0.04]" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                              {time}
                              {p.league && (
                                <>
                                  {" · "}
                                  {p.country ? `${p.country} ` : ""}
                                  {p.league}
                                </>
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-neutral-100 sm:text-base">
                              {p.home_team ?? "Home"}{" "}
                              <span className="text-neutral-500">vs</span>{" "}
                              {p.away_team ?? "Away"}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-emerald-300">
                              <span>
                                Pick: {formatMarket(p.market, p.selection)}
                              </span>
                              <OutcomeBadge
                                outcome={p.outcome}
                                kickoff={p.kickoff_utc}
                              />
                              {p.clv != null && (
                                <span
                                  className="font-mono text-[10px] text-neutral-500"
                                  title="Closing-line value: how our price compared with the same book's closing price. Positive means we were on before the line moved."
                                >
                                  CLV {p.clv >= 0 ? "+" : ""}
                                  {(p.clv * 100).toFixed(1)}%
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-baseline gap-4 text-right sm:gap-6">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                                Odds
                              </p>
                              <p className="font-mono text-base font-semibold tabular-nums text-neutral-100 sm:text-lg">
                                {p.odds != null ? Number(p.odds).toFixed(2) : "—"}
                              </p>
                              {/* Break-even against the SHARP line (1 / P_shin),
                                  kept deliberately quiet — it only matters at
                                  the moment of placing. Odds move after a pick
                                  is posted, so a reader must be able to check
                                  the price they are actually offered against
                                  this before placing. */}
                              <p className="font-mono text-[10px] tabular-nums text-neutral-600">
                                {(() => {
                                  const be = sharpBreakEvenOdds(p.p_sharp);
                                  return be != null ? (
                                    <span title={`Break-even price against the sharp line. This pick is only +EV at ${be.toFixed(2)} or better — below that the edge is gone. Odds move after a pick is posted, so check the price you are actually offered against this.`}>
                                      min {be.toFixed(2)}
                                    </span>
                                  ) : null;
                                })()}
                                {p.alignment_gap_minutes != null && (
                                  <span
                                    className="text-neutral-700"
                                    title="How far apart the sharp reference quote and this price were when the pick was made. The rule caps this at 60 minutes: comparing a fresh sharp line against a stale price measures drift, not value."
                                  >
                                    {sharpBreakEvenOdds(p.p_sharp) != null ? " · " : ""}
                                    {Math.round(p.alignment_gap_minutes)}m apart
                                  </span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                                Edge vs sharp
                              </p>
                              <p className="font-mono text-base font-semibold tabular-nums text-neutral-100 sm:text-lg">
                                {edgePct != null
                                  ? `+${edgePct.toFixed(1)}%`
                                  : "—"}
                              </p>
                            </div>
                            {p.bookmaker && (
                              <div className="hidden sm:block">
                                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                                  Book
                                </p>
                                <p className="text-xs text-neutral-300">
                                  {p.bookmaker}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Deliberately NOT a link to /performance. That ledger was priced on a
            model edge we have since shown to be manufactured, and it survives in
            2 bots of 46 — linking it from here would imply a claim that does not
            transfer to this method. */}
        <section className="mt-16 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="mb-2 text-base font-semibold text-neutral-100">
            Get picks as they post
          </h2>
          <p className="text-sm text-neutral-400">
            Every pick here goes to the free Telegram channel at the same moment,
            with the same price and the same edge. Nothing is held back or
            posted late.
          </p>
          <div className="mt-4">
            <Link
              href="https://t.me/oddsintelpicks"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
            >
              Join Telegram
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Odds move. Check the price you are actually offered before placing
          anything — a pick is only worth taking near the price it was found at.
        </p>
      </main>
    </div>
  );
}
