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
 * rule has ONE cohort by construction (every qualifying leg, no selection cap
 * since PICKS-NO-DAILY-CAP-2026-09-15), and splitting it would
 * change what is being measured in a running pre-registered test.
 */
import Link from "next/link";
import { Nav } from "@/components/nav";
import {
  hasStarted,
  sharpBreakEvenOdds,
  fetchForwardTestPicks,
  fetchBoard,
  hoursSinceUtcMidnight,
  type ForwardTestPick,
  type BoardLeg,
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

/**
 * One row renderer for every pick on the page, kicked off or not.
 *
 * HISTORY, because this row has been moved twice in two days and the reasons
 * are easy to re-break:
 *
 * PICKS-BOARD-VS-RESULTS (2026-09-15, morning) hid every pick whose fixture had
 * kicked off. The problem it was actually solving was a *window* problem — the
 * fetch looks back a rolling 24h from the clock, so before the day's batch
 * published, the page held yesterday's settled losers and nothing else, which
 * the owner reported as an outage ("we are still showing yesterdays pick on
 * /picks page, where are todays?"). Hiding started fixtures did stop that, but
 * it also threw away the day's own picks the moment they kicked off.
 *
 * PICKS-SHOW-WHOLE-DAY (2026-09-15, owner) undoes the hiding and fixes the
 * window instead: the lookback is anchored to midnight UTC
 * (`hoursSinceUtcMidnight`), so yesterday is gone but ALL of today stays —
 * "before 14 sept change, it showed all todays, even the ones that were
 * settled..so it should show all 4 still". A reader who followed a pick at
 * lunchtime can still find it in the evening and see how it went.
 *
 * What stops a settled pick reading as a live one is the badge, not removal:
 * `OutcomeBadge` marks every row Won / Lost / Push / Void / Live, and the price
 * column is the price the pick was found at, not an offer.
 */
function PickRow({ p }: { p: ForwardTestPick }) {
  const { time } = formatKickoff(p.kickoff_utc);
  const edgePct = p.edge != null ? p.edge * 100 : null;
  return (
    <div className="border-t border-white/[0.04] px-4 py-4 first:border-t-0 sm:px-5">
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
            <span>Pick: {formatMarket(p.market, p.selection)}</span>
            <OutcomeBadge outcome={p.outcome} kickoff={p.kickoff_utc} />
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
            {/* Break-even against the SHARP line (1 / P_shin), kept deliberately
                quiet — it only matters at the moment of placing. Odds move after
                a pick is posted, so a reader must be able to check the price
                they are actually offered against this before placing. */}
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
              {edgePct != null ? `+${edgePct.toFixed(1)}%` : "—"}
            </p>
          </div>
          {p.bookmaker && (
            <div className="hidden sm:block">
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Book
              </p>
              <p className="text-xs text-neutral-300">{p.bookmaker}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PickGroups({ groups }: { groups: Map<string, ForwardTestPick[]> }) {
  return (
    <div className="space-y-8">
      {Array.from(groups.entries()).map(([date, group]) => (
        <section key={date}>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-500">
            {date} · {group.length} pick{group.length === 1 ? "" : "s"}
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {group.map((p) => (
              <PickRow key={p.id} p={p} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default async function PicksPage() {
  let picks: ForwardTestPick[] = [];
  let loadFailed = false;
  try {
    // PICKS-SHOW-WHOLE-DAY: look back to midnight UTC, not a rolling 24h.
    // See hoursSinceUtcMidnight() for why the day boundary is the right anchor.
    picks = await fetchForwardTestPicks(hoursSinceUtcMidnight(), 48);
  } catch {
    loadFailed = true;
  }
  // The watchlist never takes the page down: fetchBoard swallows its own errors.
  // Named `watchlist`, not `board` — `board` above is the set of PUBLISHED picks
  // that have not kicked off, and conflating the two is the whole risk here.
  const watchlist: BoardLeg[] = await fetchBoard();

  // Every pick in the window is rendered. The split below is for the COUNT LINE
  // only — a reader needs to know how many of these are still bettable, and
  // that is a different number from how many were published today. Splitting on
  // kickoff rather than on `outcome == null` because a match in play has no
  // outcome yet and is not bettable either.
  const stillOpen = picks.filter((p) => !hasStarted(p.kickoff_utc)).length;
  const startedCount = picks.length - stillOpen;

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
            {/* PICKS-HEADLINE-COUNT-2026-09-14, revised twice on 2026-09-15.
                THE INVARIANT: this number and the list below it count the SAME
                set. 80aedd1 broke it by counting unresolved picks above a list
                that counted everything — the page said "3 picks on the board"
                over a list headed "Today · 8 picks".
                It counts `picks` again, which is now every pick kicking off
                today or in the next 48h, settled ones included
                (PICKS-SHOW-WHOLE-DAY). How many are still bettable is a real
                and different fact, so it is stated underneath rather than
                folded into this number. */}
            {picks.length > 0
              ? `${picks.length} pick${picks.length === 1 ? "" : "s"} on the board`
              : "No picks on the board right now"}
          </h1>
          {picks.length > 0 && startedCount > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
              {stillOpen === 0
                ? "All kicked off — today's card, kept on the page"
                : `${stillOpen} still to kick off · ${startedCount} running or finished`}
            </p>
          )}
          <p className="mx-auto max-w-xl text-balance text-sm text-neutral-400 sm:text-base">
            A pick is a price that beats the sharpest line in the market, with
            the bookmaker&apos;s margin stripped out, by at least 3%. Every
            price that clears that bar is published — there is no daily cap, so
            a busy Saturday runs long and a thin Tuesday shows none.
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

        {!loadFailed && picks.length === 0 && (
          <div className="mt-10 rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-neutral-400">
              Nothing on the board right now.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-500">
              Picks appear here the moment they are published, and the same
              moment they reach Telegram. A quiet board is a normal outcome, not
              an outage — the rule publishes only prices that beat the sharp line
              by 3% or more, and on a thin day no price does. Today&apos;s picks
              stay on this page after kickoff, so an empty board means none were
              published today, not that they have scrolled away.
            </p>
          </div>
        )}

        {picks.length > 0 && (
          <div className="mt-10">
            <PickGroups groups={groups} />
          </div>
        )}

        {/* PICKS-BOARD-WATCHLIST (2026-09-15). What the rule is LOOKING at, and
            the price each leg would have to reach. This exists so a flat day
            shows something honest instead of an empty page — on the day it
            shipped, 0 of 31 legs cleared the floor.

            These are deliberately NOT styled as picks and are never counted as
            picks: they come from `picks_board` (a display table refreshed every
            30 minutes), not from the pre-registered ledger. The number shown is
            arithmetic off the sharp line — "worth taking at 2.18 or better" —
            and predicts nothing about whether it wins. */}
        {watchlist.length > 0 && (
          <details className="mt-14 group">
            {/* COLLAPSED BY DEFAULT (owner, 2026-09-15). The watchlist is a
                secondary feature — "here is what we are watching, and the price
                it would need" — and it must not compete with the picks for
                attention. A reader who wants it opens it; everyone else sees a
                one-line summary and the picks above. */}
            <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-300 hover:text-neutral-100">
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-[10px] text-neutral-600 transition-transform group-open:rotate-90">
                  ▶
                </span>
                On the watchlist — {watchlist.length} price
                {watchlist.length === 1 ? "" : "s"} we&apos;re tracking, not picks yet
              </span>
            </summary>
            <p className="mb-3 mt-2 max-w-2xl text-xs leading-relaxed text-neutral-500">
              Prices the sharp line says are close but not yet worth taking.
              <strong className="text-neutral-400"> Grade B</strong> is the price
              that beats the sharpest line by 3% — our bar for publishing a pick.
              <strong className="text-neutral-400"> Grade A</strong> is 5%. Both
              are arithmetic against the sharp line, not forecasts. Find one of
              those prices and it is a bet on the same terms as anything we
              publish; at today&apos;s prices it is not.
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="px-4 py-2 font-normal">Match</th>
                    <th className="px-3 py-2 font-normal">Pick</th>
                    <th className="px-3 py-2 text-right font-normal">Best now</th>
                    <th className="px-3 py-2 text-right font-normal">Grade B</th>
                    <th className="px-3 py-2 text-right font-normal">Grade A</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map((b) => (
                    <tr
                      key={`${b.match_id}-${b.market}-${b.selection}`}
                      className="border-t border-white/[0.04]"
                    >
                      <td className="px-4 py-2.5">
                        <div className="truncate text-neutral-200">
                          {b.home_team ?? "Home"}{" "}
                          <span className="text-neutral-600">vs</span>{" "}
                          {b.away_team ?? "Away"}
                        </div>
                        <div className="font-mono text-[10px] text-neutral-600">
                          {formatKickoff(b.kickoff_utc).time}
                          {b.league ? ` · ${b.league}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-neutral-300">
                        {formatMarket(b.market, b.selection)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-neutral-300">
                        {b.odds != null ? Number(b.odds).toFixed(2) : "—"}
                        {b.bookmaker && (
                          <div className="text-[10px] text-neutral-600">
                            {b.bookmaker}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-300">
                        {b.odds_grade_b != null
                          ? Number(b.odds_grade_b).toFixed(2)
                          : "—"}
                        <div className="text-[10px] text-neutral-600">+3% vs sharp</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-200">
                        {b.odds_grade_a != null
                          ? Number(b.odds_grade_a).toFixed(2)
                          : "—"}
                        <div className="text-[10px] text-neutral-600">+5% vs sharp</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* NO SEPARATE SETTLED SECTION (owner, 2026-09-15). A section under a
            heading of its own was added earlier today and removed the same day:
            the page never had one, and splitting the day's card in two made it
            less readable, not more. Today's settled picks are in the SAME list
            as everything else, in kickoff order, carrying a Won/Lost badge —
            which is how the page worked before 14 September. The running track
            record still lives on /performance; this is one day's card, not a
            ledger. */}

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
