import {
  DECISION_FRESH_MAX_MIN,
  KO_BLOCK_MIN,
  PREREG_MIN_N,
  QUOTE_MAX_AGE_MIN,
} from "@/lib/shadow-bots/verdict";

/**
 * HOW-THIS-PAGE-WORKS (2026-09-15). Collapsed <details> panel since #139 IA move P6 (2026-09-24);
 * it was a modal behind a button.
 *
 * The owner asked for this in as many words: nothing on screen explained where a pick comes
 * from, what is validated, when we wait and when we bet. Everything here is written down
 * elsewhere (docs/SYSTEM_MAP.md, COOLBET_OWN_BETTING.md, the pre-registrations) but "elsewhere"
 * is not where the decision is made.
 *
 * Rule for editing: every number in this panel must be IMPORTED from the same constant the page
 * decides with, never retyped. A help text that drifts from the behaviour it describes is worse
 * than no help text.
 */

const H = "mt-6 mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground first:mt-0";
const P = "mb-3 text-[13px] leading-relaxed";
const LI = "mb-1.5 text-[13px] leading-relaxed";
const CODE = "rounded bg-muted px-1 py-0.5 font-mono text-[11px]";
const CHIP = "inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium";

export function HowItWorks() {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span>
          <span className="text-sm font-medium">How this page works</span>
          <span className="ml-2 text-xs text-muted-foreground">where picks come from, what each column means, when we bet</span>
        </span>
        <span className="text-xs text-primary group-open:hidden">Show</span>
        <span className="hidden text-xs text-primary group-open:inline">Hide</span>
      </summary>
      <div className="max-w-3xl border-t border-border px-4 py-4">
        <h3 className={H}>1 · Where a pick comes from</h3>
        <p className={P}>
          Nobody picks these by hand. Every 30 minutes the engine re-reads the books we collect ourselves — Coolbet,
          Unibet, Epicbet and Tonybet — and asks each bot the same question: <em>is this price better than my idea of
          fair?</em> A pick is written the moment one says yes. Two kinds of bot answer that question in two different
          ways, and their numbers are <strong>not</strong> comparable:
        </p>
        <ul className="mb-3 list-disc pl-5">
          <li className={LI}>
            <strong>Model bots</strong> (<span className={CODE}>O/U 3.5 model</span>) compare the book&rsquo;s price with{" "}
            <em>our own model</em>. The model is noisier than the market, so they demand a big edge — 8 to 13 points.
          </li>
          <li className={LI}>
            <strong>Sharp bots</strong> (<span className={CODE}>CB 1x2 sharp</span>) compare it with{" "}
            <em>Pinnacle&rsquo;s price with its margin removed</em>. That is a much tighter yardstick, so their bar is about
            3 points. Different rulers, not different strictness.
          </li>
        </ul>
        <p className={P}>
          The bot name tells you which ruler a row uses: <span className={CODE}>sharp</span> or{" "}
          <span className={CODE}>model</span>. The book prefix (<span className={CODE}>CB</span> Coolbet,{" "}
          <span className={CODE}>UB</span> Unibet) is where it was priced.
        </p>

        <h3 className={H}>2 · Everything is kept</h3>
        <p className={P}>
          Every pick a bot has ever raised is stored, win or lose, placed or ignored. That is what makes it possible to ask
          later whether a rule actually worked. A pick marked <span className={`${CHIP} bg-muted text-muted-foreground`}>Skip</span>{" "}
          today is not deleted; it still settles and still counts toward that bot&rsquo;s record.
        </p>

        <h3 className={H}>3 · Reading one row</h3>
        <ul className="mb-3 list-disc pl-5">
          <li className={LI}>
            <strong>Best price now</strong> — the best price right now at a book you can actually bet at. If only a book we
            cannot bet at has a price, it is shown greyed; a price you cannot take is not an opportunity.
          </li>
          <li className={LI}>
            <strong>Bot&rsquo;s price age</strong> — how old the price was <em>when the bot decided</em>. A bot that fired
            on a 20-hour-old price decided on a price nobody could take. Fresh means {DECISION_FRESH_MAX_MIN} minutes or
            less — the engine&rsquo;s own definition.
          </li>
          <li className={LI}>
            <strong>Price age</strong> — how old the price in &ldquo;Best price now&rdquo; is. At {QUOTE_MAX_AGE_MIN}{" "}
            minutes or more we assume it has gone from the book&rsquo;s screen.
          </li>
          <li className={LI}>
            <strong>Break-even</strong> — below this price the bet loses money on the bot&rsquo;s own numbers.
          </li>
          <li className={LI}>
            <strong>Min price</strong> — the stricter price the <em>bot itself</em> needs before it would fire. Between
            break-even and this, a bet is positive but below the bot&rsquo;s standard.
          </li>
          <li className={LI}>
            <strong>Edge now</strong> — the edge worked out again at the price shown now, not at the price when the pick
            was raised. This is the number that has moved since.
          </li>
          <li className={LI}>
            <strong>Bot chips</strong> — <em>lead bot</em> is the one bot worth watching (beating the closing price on the
            most bets); <em>losing bot</em> is clearly getting worse prices than the close; <em>unproven</em> is not ruled
            out yet. The bot scores themselves are on the Bots page.
          </li>
        </ul>

        <h3 className={H}>4 · The verdict</h3>
        <p className={P}>One chip per row, and it is the only thing on the row in colour, so your eye goes to the decision.</p>
        <ul className="mb-3 list-disc pl-5">
          <li className={LI}>
            <span className={`${CHIP} bg-success/15 text-success`}>Place</span> — the price clears the bot&rsquo;s own
            minimum and is fresh.
          </li>
          <li className={LI}>
            <span className={`${CHIP} bg-warning/15 text-warning`}>Thin</span> — above break-even, below the bot&rsquo;s
            minimum. Positive, but not to the bot&rsquo;s standard.
          </li>
          <li className={LI}>
            <span className={`${CHIP} bg-muted text-muted-foreground`}>Skip</span> — below break-even, or the price is
            old, or no book we can bet at has a price, or the price is above a cap where the rule says the edge is noise.
            In-play picks are always Skip: there is no way to place in-play.
          </li>
          <li className={LI}>
            <span className={`${CHIP} bg-danger/15 text-danger`}>Blocked</span> — you cannot act on this row at all.
            That means one thing only: kickoff is under {KO_BLOCK_MIN} minutes away, where books suspend markets.
          </li>
        </ul>
        <p className={P}>
          <strong>What blocked does not mean:</strong> the automatic placer being paused. That is the muted{" "}
          <span className={`${CHIP} border border-border text-muted-foreground`}>auto off</span> marker instead — the
          machine being off is not a fact about the price.
        </p>

        <h3 className={H}>5 · Why some rows are greyed</h3>
        <p className={P}>
          A greyed row is one where the bot decided on an old price. It is dimmed rather than hidden on purpose: hiding it
          would quietly shrink your list and you would never know what was removed.
        </p>

        <h3 className={H}>6 · The two controls</h3>
        <ul className="mb-3 list-disc pl-5">
          <li className={LI}>
            <strong>The circle</strong> is your own mark — taken or skipped. It changes nothing in the engine; it lets you
            answer &ldquo;what did I pass on, and was I right?&rdquo; later.
          </li>
          <li className={LI}>
            <strong>Place €10</strong> does not bet for you. It <em>records</em> a bet you already placed by hand at the
            book, so it lands in the ledger, gets settled, and gets scored against the closing price. You can change the
            price and stake to what you actually took before confirming. It stays available when automation is paused.
          </li>
        </ul>

        <h3 className={H}>7 · Can the robot bet? (CAN_STAKE)</h3>
        <p className={P}>
          This page no longer carries the safety strip. Whether any automated job can move money right now — the Coolbet
          CAN_STAKE answer, with every switch that feeds it — is the real-money ladder on the Bots page. It says nothing
          about you: you can always place by hand.
        </p>
        <p className={P}>
          <strong>The Coolbet daemons and the Mac.</strong> The Coolbet jobs run on your Mac, not on the server, so no web
          button can start or stop them directly; the pause switch (on the Feeds page) flips a flag the running daemons
          read at the top of each cycle.
        </p>

        <h3 className={H}>8 · When we actually bet real money</h3>
        <p className={P}>
          Right now: not automatically. The automatic path is paused and disarmed on purpose — measured on our own books,
          shopping for the best price recovers about two points of a seven-and-a-half point margin, not enough to pay its
          way. The bots keep picking on paper so we can find out whether any rule is worth arming.
        </p>
        <p className={P}>
          A bot earns real money only by clearing its pre-registered bar, and that bar is{" "}
          <strong>beating the closing price, not profit</strong>. Profit is far too noisy — confirming a real 3% edge would
          take about 15,600 bets. A verdict needs {PREREG_MIN_N} settled picks with a closing price, so most bots are
          still collecting and will be for months. That is the honest state.
        </p>

        <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          More detail in the engine repo: <span className={CODE}>docs/SYSTEM_MAP.md</span> for every bot and every
          percentage, <span className={CODE}>docs/COOLBET_OWN_BETTING.md</span> for the placement gates.
        </p>
      </div>
    </details>
  );
}
