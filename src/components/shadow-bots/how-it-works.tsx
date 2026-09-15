"use client";

import { useEffect, useState } from "react";
import {
  DECISION_FRESH_MAX_MIN,
  KO_BLOCK_MIN,
  PREREG_MIN_N,
  QUOTE_MAX_AGE_MIN,
} from "@/lib/shadow-bots/verdict";

/**
 * HOW-THIS-PAGE-WORKS (2026-09-15).
 *
 * The owner asked for this in as many words: the page was rebuilt, the old bot
 * cards and their prose went with it, and nothing on screen explained where a
 * pick comes from, what is validated, when we wait and when we bet. Everything
 * here is written down elsewhere (docs/SYSTEM_MAP.md, COOLBET_OWN_BETTING.md,
 * the pre-registrations) but "elsewhere" is not where the decision is made.
 *
 * Rule for editing: every number in this modal must be IMPORTED from the same
 * constant the page decides with, never retyped. A help text that drifts from
 * the behaviour it describes is worse than no help text.
 */

const H = "text-[11px] font-mono uppercase tracking-widest text-neutral-400 mt-6 mb-2 first:mt-0";
const P = "text-[13px] leading-relaxed text-neutral-300 mb-3";
const LI = "text-[13px] leading-relaxed text-neutral-300 mb-1.5";
const CODE = "rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-neutral-200";
const CHIP = "inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider";

export function HowItWorks() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-300 hover:bg-white/[0.06]"
        title="Where the picks come from, what each column means, and when we actually bet"
      >
        ? How this works
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-white/10 bg-neutral-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-sm font-semibold text-neutral-100">
                How this page works
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded border border-white/15 px-2 py-0.5 font-mono text-[11px] text-neutral-400 hover:bg-white/[0.06]"
              >
                esc
              </button>
            </div>

            {/* ── 1 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>1 · Where a pick comes from</h3>
            <p className={P}>
              Nobody picks these by hand. Every 30 minutes the engine re-reads the books we
              scrape ourselves — Coolbet, Unibet-Site and Epicbet — and asks each bot the
              same question: <em>is this price better than my idea of fair?</em> A pick is
              written the moment one says yes. Two different bots answer that question in
              two completely different ways, and their numbers are <strong>not</strong>{" "}
              comparable:
            </p>
            <ul className="mb-3 list-disc pl-5">
              <li className={LI}>
                <strong>Model bots</strong> (<span className={CODE}>O/U 3.5 model</span>) compare
                the book&rsquo;s price against <em>our own calibrated model</em>. Because the model
                is noisier than the market, they demand a big edge — 8 to 13 percentage points.
              </li>
              <li className={LI}>
                <strong>Sharp bots</strong> (<span className={CODE}>CB 1x2 sharp</span>) compare it
                against the <em>de-vigged Pinnacle line</em>. That is a much tighter yardstick, so
                their floor is about 3 points. A 3% sharp edge and a 13% model edge filter to
                roughly the same strictness — different rulers, not different strictness.
              </li>
            </ul>
            <p className={P}>
              The bot name tells you which ruler a row uses: <span className={CODE}>sharp</span> or{" "}
              <span className={CODE}>model</span>. The book prefix (<span className={CODE}>CB</span>,{" "}
              <span className={CODE}>UB</span>) is the venue it was priced at.
            </p>

            {/* ── 2 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>2 · Everything is kept</h3>
            <p className={P}>
              Yes — every pick a bot has ever raised is stored, win or lose, placed or ignored.
              That is the entire point: 162,000 rows and counting, which is what makes it
              possible to ask later whether a rule actually worked instead of remembering that
              it felt like it did. A pick being <span className={CHIP + " border-white/20 text-neutral-400"}>SKIP</span>{" "}
              today does not delete it; it still settles and still counts toward that bot&rsquo;s record.
            </p>

            {/* ── 3 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>3 · Reading one row</h3>
            <ul className="mb-3 list-disc pl-5">
              <li className={LI}>
                <strong>Best placeable</strong> — the best price right now at a book you can
                actually bet at. If only an unplaceable book has a price, this is empty; a price
                you cannot take is not an opportunity.
              </li>
              <li className={LI}>
                <strong>Decision</strong> — how old the quote was <em>when the bot decided</em>. A
                bot that fired on a 20-hour-old price decided against a price nobody could take.
                Fresh means ≤ {DECISION_FRESH_MAX_MIN} minutes, which is the engine&rsquo;s own
                definition, not a second opinion.
              </li>
              <li className={LI}>
                <strong>Shown age</strong> — how old the price in the &ldquo;best placeable&rdquo;
                column is. Over {QUOTE_MAX_AGE_MIN} minutes and we assume it is gone from the
                book&rsquo;s screen.
              </li>
              <li className={LI}>
                <strong>Break-even</strong> — below this price the bet is negative expected value
                on the bot&rsquo;s own numbers. This is the floor that matters if you are deciding
                whether a bet is worth anything at all.
              </li>
              <li className={LI}>
                <strong>Gate floor</strong> — the stricter price the <em>bot itself</em> requires
                before it would fire. Between break-even and the gate floor a bet is positive but
                below the bot&rsquo;s standard.
              </li>
              <li className={LI}>
                <strong>Live edge</strong> — the edge recomputed at the price shown now, not at
                the price when the pick was raised. This is the number that has moved since.
              </li>
            </ul>

            {/* ── 4 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>4 · The verdict</h3>
            <p className={P}>
              One chip per row, and it is the only thing on the row carrying colour, so your eye
              goes to the decision rather than to a wall of numbers.
            </p>
            <ul className="mb-3 list-disc pl-5">
              <li className={LI}>
                <span className={CHIP + " border-emerald-500/40 text-emerald-300"}>PLACE</span>{" "}
                — the live price clears the bot&rsquo;s own gate floor and the quote is fresh.
              </li>
              <li className={LI}>
                <span className={CHIP + " border-amber-500/40 text-amber-300"}>THIN</span>{" "}
                — above break-even, below the bot&rsquo;s gate. Positive, but not to the bot&rsquo;s
                standard.
              </li>
              <li className={LI}>
                <span className={CHIP + " border-white/20 text-neutral-400"}>SKIP</span>{" "}
                — below break-even, or the quote is stale, or no placeable book has a price, or
                the price is above an odds cap where the rule says the edge is noise. In-play
                picks are always SKIP: we have no in-play placer.
              </li>
              <li className={LI}>
                <span className={CHIP + " border-red-500/40 text-red-300"}>BLOCKED</span>{" "}
                — you cannot act on this row at all. Today that means one thing only: kickoff is
                under {KO_BLOCK_MIN} minutes away, where books suspend markets and a placement
                races the whistle.
              </li>
            </ul>
            <p className={P}>
              <strong>What BLOCKED no longer means:</strong> until today it also fired when the
              automated placer was paused, which made every row BLOCKED and told you nothing.
              That state is now the muted{" "}
              <span className={CHIP + " border-white/15 text-neutral-500"}>auto off</span> marker
              instead. The machine being off is not a fact about the price.
            </p>

            {/* ── 5 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>5 · Why some rows are greyed</h3>
            <p className={P}>
              A greyed row is one whose <em>decision quote was stale</em> — the bot fired on a
              price that was already old. It is dimmed rather than hidden on purpose: hiding it
              would quietly shrink your slate and you would never know what was removed. Read it,
              then decide.
            </p>

            {/* ── 6 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>6 · The two controls</h3>
            <ul className="mb-3 list-disc pl-5">
              <li className={LI}>
                <strong>The circle</strong> is your own mark — checked or skipped. It records what
                you thought of a pick and changes nothing in the engine. It exists so that
                &ldquo;what did I pass on, and was I right?&rdquo; is answerable later.
              </li>
              <li className={LI}>
                <strong>Place €10</strong> does not bet for you. It <em>records</em> a bet you
                already placed by hand at the book, so it lands in the ledger, gets settled, and
                gets scored against the closing line. Without it a hand-placed bet is invisible
                to every number on this page. That is why it stays available even when automation
                is paused.
              </li>
            </ul>

            {/* ── 7 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>7 · The safety strip, and CAN_STAKE</h3>
            <p className={P}>
              <span className={CODE}>CAN_STAKE no</span> means{" "}
              <strong>no automated job on any machine can move money right now</strong>. It is the
              one-line answer to &ldquo;is the system armed?&rdquo; and it requires three separate
              things to be true before it can read yes: the kill switch clear, real money armed,
              and at least one bot toggled on. Today all three are off.
            </p>
            <p className={P}>
              It says nothing about you. You can always place by hand; the strip is about the
              robot, not the operator.
            </p>
            <p className={P}>
              <strong>The daemons button and the Mac.</strong> You are right to be suspicious. The
              Coolbet jobs run on your Mac, not on the server, so this button cannot start or stop
              a process directly. All it does is flip a flag in the database. A <em>running</em>{" "}
              daemon reads that flag at the top of each cycle and idles itself. If nothing is
              running — which is what the banner is telling you — the flag changes nothing, and
              the button says so rather than pretending it worked.
            </p>

            {/* ── 8 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>8 · When we actually bet real money</h3>
            <p className={P}>
              Right now: not automatically, at all. The automated path is paused and disarmed
              deliberately, because measured on our own books line shopping recovers about two
              points of a seven-and-a-half point margin — not enough to pay its own way. What is
              running instead is measurement: the bots keep picking on paper so we can find out
              whether any rule is worth arming.
            </p>
            <p className={P}>
              A bot earns real money only by clearing its pre-registered bar, and the bar is{" "}
              <strong>closing-line value, not profit</strong>. Profit is far too noisy — confirming
              a genuine 3% edge would take roughly 15,600 bets — whereas closing-line value
              converges about 200 times faster. Nothing promotes on a good-looking ROI.
            </p>

            {/* ── 9 ─────────────────────────────────────────────────────── */}
            <h3 className={H}>9 · The scoreboard below</h3>
            <p className={P}>
              Two populations, deliberately side by side and never merged:{" "}
              <strong>n settled</strong> and ROI cover every settled pick, while{" "}
              <strong>n CLV</strong> and the margin-corrected closing-line value cover only picks
              whose book had a complete closing market. Mixing them is not academic — doing so
              flipped the sign on four of eleven bots, showing one whose real record is −11% as
              +30%.
            </p>
            <p className={P}>
              A verdict needs {PREREG_MIN_N} settled picks with closing-line value before it can
              say anything, so most bots read <span className={CODE}>COLLECTING</span> and will for
              months. That is the honest state, not a broken column.
            </p>

            <p className="mt-6 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-neutral-500">
              Deeper detail lives in the engine repo: <span className={CODE}>docs/SYSTEM_MAP.md</span>{" "}
              for every bot and every percentage,{" "}
              <span className={CODE}>docs/COOLBET_OWN_BETTING.md</span> for the placement gate
              stack, and <span className={CODE}>docs/OWN_STRATEGY_AUDIT_2026_09_15.md</span> for
              why the automated path is paused.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
