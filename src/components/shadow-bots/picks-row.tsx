import Link from "next/link";
import { PickBetMark } from "@/components/pick-bet-mark";
import { PlaceAction } from "@/components/shadow-bots/place-action";
import { KoTime } from "@/components/shadow-bots/ko-time";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import type { BotTrack, Freshness, PickVerdict, PickVerdictResult } from "@/lib/shadow-bots/verdict";
import { quoteFreshness, DECISION_FRESH_MAX_MIN, QUOTE_MAX_AGE_MIN } from "@/lib/shadow-bots/verdict";
import type { Quote, UpcomingPick } from "@/lib/shadow-bots/queries";
import { BOOK_CHIP, formatAge, formatPickLabel } from "@/lib/shadow-bots/labels";

/**
 * One pick in the Pick queue (/admin/shadow-bots). Since #139 IA move P6 (2026-09-24) the table
 * is the shared DataTable (picks-queue-table.tsx); this module holds the per-row data and the
 * CELL renderers, so every rule that used to live in the one <tr> still lives in one file.
 */
export interface PickRowData {
  /** Already recorded in real_bets today (for ANY bot in the group) — shown, and the button says so. */
  alreadyLogged: boolean;
  // Automation state (placement paused / bot toggled off) is NOT on the row since the UX fix round
  // (2026-09-24): it was the same automation-off chip on every row. The page states the fleet's
  // automatic-placing state ONCE, above the table (shadow-bots/page.tsx).
  pick: UpcomingPick;
  /** bots.display_name via prettyDisplayName — the ONE bot name; the id is secondary text. */
  botLabel: string;
  /** The bot's own book's price now, when that book is NOT the best book (else null). */
  ownQuote: Quote | null;
  /** Edge at the best price now, per verdict.ts shownEdge() — null below the bot's minimum. */
  shownEdge: number | null;
  /** Other bots that raised the same match + market + selection, grouped into this row. */
  siblings: PickRowData[];
  prob: number | null;
  threshold: number;
  /** Best quote at a PLACEABLE book, or null. */
  best: Quote | null;
  bestAgeMin: number | null;
  /** Best quote at an UNPLACEABLE book (Epicbet), shown greyed when no placeable price exists. */
  unplaceable: Quote | null;
  verdict: PickVerdictResult;
  minutesToKo: number;
  /** `inplay_minute IS NOT NULL` — raised while the match was running. */
  inplay: boolean;
  /** The in-play CONTROL arm (priced off AF's aggregate — a feed nobody can bet). */
  isControlArm: boolean;
  /**
   * Which bot this pick came from, on the "where do I look" axis (verdict.ts).
   * A green Place chip is a per-PICK price test; this is the per-BOT record
   * behind it. The two are independent and the row must show both.
   */
  track: BotTrack;
  markState: 0 | 1 | 2;
  stake: number;
}

/**
 * The Verdict chip is the ONE colour carrier per row. Everything else — fresh/stale, in-play,
 * control — is structural: an outline, muted text, or reduced opacity. A second traffic light
 * on the same row makes neither readable.
 */
export const VERDICT_TONE: Record<PickVerdict, Tone> = {
  PLACE: "success",
  THIN: "warning",
  SKIP: "neutral",
  BLOCKED: "danger",
};
/** Plain words for the owner; the codes stay the values (filters, sorting, CSV). */
export const VERDICT_LABEL: Record<PickVerdict, string> = {
  PLACE: "Place",
  THIN: "Thin",
  SKIP: "Skip",
  BLOCKED: "Blocked",
};

// Only STALE gets a word; the word fresh is never printed (UX fix round, 2026-09-24): it sat next to a
// price the verdict called too old — two different ages, and the word read as a claim about both.
const FRESH_TITLE: Record<Freshness, string> = {
  FRESH: `How old the price was when the bot decided — within the engine's ${DECISION_FRESH_MAX_MIN}-minute limit.`,
  STALE: `The bot decided on a price over ${DECISION_FRESH_MAX_MIN} minutes old — it may have moved since.`,
  UNKNOWN: "No age recorded: written before 15 Sep, or this bot does not check price age.",
};

const fmtOdds = (v: number | null) => (v == null ? "—" : v.toFixed(2));
const fmtEdge = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`);

const CHIP = "inline-block rounded border px-1 text-[10px] font-mono tracking-wider";
const MONO = "font-mono text-xs tabular-nums";

/**
 * Row styling: a pick whose DECISION quote was stale is greyed, never hidden (visibility
 * invariant — hiding it would quietly shrink the slate). The lead bot's picks get a sky edge.
 * The dimming is on the cells, not the <tr>, and skips the last (sticky Action) cell: opacity on
 * the row would make the sticky cell see-through, so scrolled columns would show under it.
 */
export function pickRowClassName(r: PickRowData): string {
  const stale = quoteFreshness(r.pick.decision_quote_age_min) === "STALE";
  return `${stale ? "[&>td:not(:last-child)]:opacity-50" : ""} ${r.track === "LEAD" ? "bg-info/[0.06] shadow-[inset_3px_0_0_0_var(--color-info)]" : ""}`;
}

export function KickoffCell({ r }: { r: PickRowData }) {
  return (
    <span className="whitespace-nowrap">
      <KoTime iso={r.pick.kickoff} />
    </span>
  );
}

export function MatchCell({ r }: { r: PickRowData }) {
  const { pick } = r;
  const score =
    pick.inplay_score_home != null && pick.inplay_score_away != null ? `${pick.inplay_score_home}-${pick.inplay_score_away}` : null;
  return (
    <div className="min-w-[150px] max-w-[220px]">
      <div className="truncate">
        {pick.home} <span className="text-muted-foreground">v</span> {pick.away}
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        {r.inplay && (
          <span className={`${CHIP} shrink-0 border-border text-foreground`} title="Raised while the match was running (the in-play test rig).">
            IN-PLAY
            {pick.inplay_minute != null ? ` ${pick.inplay_minute}'` : ""}
            {score ? ` · ${score}` : ""}
          </span>
        )}
        <span className="truncate">
          {pick.country ? `${pick.country} · ` : ""}
          {pick.league ?? ""}
          {pick.tier ? ` · T${pick.tier}` : ""}
        </span>
      </div>
    </div>
  );
}

export function PickCell({ r }: { r: PickRowData }) {
  return <span className="whitespace-nowrap">{formatPickLabel(r.pick.market, r.pick.selection)}</span>;
}

function BotName({ r }: { r: PickRowData }) {
  const { pick } = r;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1">
        <Link
          href={`/admin/bots?bot=${encodeURIComponent(pick.bot_name)}`}
          className="text-xs hover:underline"
          title={`${pick.bot_name} · needs an edge of ${(r.threshold * 100).toFixed(0)}% before it fires`}
        >
          {r.botLabel}
        </Link>
        {r.track === "LEAD" && (
          <span
            className={`${CHIP} border-info/50 text-info`}
            title="The one bot worth watching: beating the closing price on the most bets, so it is nearest to a real answer. Where to look — NOT proof that it works yet."
          >
            lead bot
          </span>
        )}
        {r.track === "NEGATIVE" && (
          <span
            className={`${CHIP} border-border text-muted-foreground`}
            title="This bot is clearly getting worse prices than the market closes at — decided, at this many bets. A Place chip here means the PRICE clears the bot's bar, not that the bot works."
          >
            losing bot
          </span>
        )}
        {r.track === "OPEN" && (
          <span className={`${CHIP} border-border text-muted-foreground`} title="Not ruled out yet: more bets can still show this bot works.">
            unproven
          </span>
        )}
        {r.isControlArm && (
          <span
            className={`${CHIP} border-dashed border-border text-muted-foreground`}
            title="Control arm: the same trigger priced off API-Football's average price. For measuring only — nobody can bet at that price."
          >
            control
          </span>
        )}
      </div>
      <div className="truncate font-mono text-[10px] text-muted-foreground/70">{pick.bot_name}</div>
    </div>
  );
}

/**
 * The bot — its display name, the id as secondary text. When several bots raised the same
 * match + market + selection they are ONE row (picks-table.tsx groupPickRows); this cell names the
 * strongest and lists the rest behind "+N more bots", each with its own verdict and minimum.
 */
export function BotCell({ r }: { r: PickRowData }) {
  const n = r.siblings.length;
  return (
    <div className="min-w-[150px] max-w-[230px]">
      <BotName r={r} />
      {n > 0 && (
        <details className="mt-1 text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            +{n} more bot{n === 1 ? "" : "s"} on this pick
          </summary>
          <ul className="mt-1 space-y-1.5 border-l border-border pl-2">
            {r.siblings.map((s) => (
              <li key={s.pick.id}>
                <BotName r={s} />
                <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {s.inplay ? VERDICT_LABEL[s.verdict.verdict] : `${VERDICT_LABEL[s.verdict.verdict]} · min ${fmtOdds(s.verdict.gateFloor)} · edge ${fmtEdge(s.shownEdge)}`}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PriceCell({ r }: { r: PickRowData }) {
  const { pick } = r;
  const chip = r.best ? BOOK_CHIP[r.best.book] : null;
  if (r.inplay) {
    // In-play: the decision price is the book's ON-SCREEN number at the minute the trigger fired,
    // and `calibrated_prob` holds that book's own de-vigged probability — NOT a model probability.
    return (
      <div className="leading-tight">
        <span className={`${MONO} text-muted-foreground`} title="The book's on-screen price when the trigger fired. There is no way to place in-play bets.">
          {fmtOdds(pick.odds_at_pick)}
          <span className={`${CHIP} ml-1 border-border text-muted-foreground`}>{r.isControlArm ? "AF feed" : pick.recommended_bookmaker ?? "on-screen"}</span>
        </span>
        <div className="font-mono text-[10px] tabular-nums text-muted-foreground" title="The book's own implied chance at that price, margin removed — a market number, not our model.">
          book prob {pick.calibrated_prob == null ? "—" : `${(pick.calibrated_prob * 100).toFixed(1)}%`}
        </div>
      </div>
    );
  }
  if (r.best && chip) {
    const own = pick.recommended_bookmaker;
    const ownChip = own ? BOOK_CHIP[own] : null;
    const otherBook = own != null && own !== r.best.book;
    const tooOld = r.bestAgeMin == null || r.bestAgeMin >= QUOTE_MAX_AGE_MIN;
    return (
      <div className="ml-auto max-w-[150px] leading-tight">
        <span className={MONO} title={`${r.best.book} · ${new Date(r.best.ts).toUTCString()}`}>
          {r.best.odds.toFixed(2)}
          <span className="ml-1 rounded border border-border px-1 text-[10px] text-muted-foreground">{chip.chip}</span>
        </span>
        <div
          className={`font-mono text-[10px] tabular-nums ${tooOld ? "text-warning" : "text-muted-foreground"}`}
          title={`Age of this price. ${QUOTE_MAX_AGE_MIN} min or older and the row reads Skip — the book has probably moved.`}
        >
          {r.bestAgeMin == null ? "age unknown" : `${Math.round(r.bestAgeMin)} min old`}
          {tooOld ? " — too old" : ""}
        </div>
        {otherBook && (
          <div
            className="text-[10px] text-muted-foreground"
            title={`"Best price now" is the best price across all the books we can bet at. This bot priced its pick at ${own}; that book's price now is shown here.`}
          >
            best of our books; bot&apos;s book {ownChip?.chip ?? own}{" "}
            <span className="font-mono tabular-nums">{r.ownQuote ? r.ownQuote.odds.toFixed(2) : "—"}</span>
            {ownChip && !ownChip.placeable ? " (can't bet)" : ""}
          </div>
        )}
      </div>
    );
  }
  if (r.unplaceable) {
    return (
      <span className={`${MONO} text-muted-foreground/70`} title="Epicbet — we cannot place there; shown for reference only">
        {r.unplaceable.odds.toFixed(2)}
        <span className="ml-1 rounded border border-border px-1 text-[10px]">EB · can&apos;t bet</span>
      </span>
    );
  }
  return <span className="text-muted-foreground/70">—</span>;
}

export function DecisionAgeCell({ r }: { r: PickRowData }) {
  const fresh = quoteFreshness(r.pick.decision_quote_age_min);
  return (
    <span className="whitespace-nowrap" title={FRESH_TITLE[fresh]}>
      <span className={MONO}>{formatAge(r.pick.decision_quote_age_min)}</span>
      {fresh === "STALE" && <span className={`${CHIP} ml-1 border-border/60 text-muted-foreground`}>over {DECISION_FRESH_MAX_MIN} min</span>}
    </span>
  );
}

/**
 * Break-even / min price / edge now are model-gate arithmetic. For an in-play row the anchor IS
 * the book's own price, so they would restate the margin and read as a model opinion we did
 * not form — shown as "n/a".
 */
export function GateCell({ r, kind }: { r: PickRowData; kind: "breakEven" | "gateFloor" | "liveEdge" }) {
  if (r.inplay) return <span className="text-xs text-muted-foreground/70" title="Model gates do not apply to in-play rows.">n/a</span>;
  if (kind === "liveEdge") {
    // The edge AT the best price now, and only when that price clears the bot's minimum — a
    // positive number below the minimum read as an invitation (UX fix round, 2026-09-24).
    if (r.shownEdge == null && r.verdict.liveEdge != null && r.best) {
      return (
        <span
          className="text-[11px] text-muted-foreground"
          title={`At ${r.best.odds.toFixed(2)} the bot's edge is ${fmtEdge(r.verdict.liveEdge)}, but the price is below the bot's minimum (${fmtOdds(r.verdict.gateFloor)}) — not a bet the bot would make.`}
        >
          — below min
        </span>
      );
    }
    // On a price the verdict calls too old the edge is dimmed and says so — it is the edge at a
    // price that has probably moved, not one you can take now.
    if (r.shownEdge != null && (r.bestAgeMin == null || r.bestAgeMin >= QUOTE_MAX_AGE_MIN)) {
      return (
        <span className="leading-tight text-muted-foreground" title="Worked out at a price that is too old to trust — it has probably moved.">
          <span className={MONO}>{fmtEdge(r.shownEdge)}</span>
          <span className="block text-[10px]">at an old price</span>
        </span>
      );
    }
    return <span className={MONO}>{fmtEdge(r.shownEdge)}</span>;
  }
  return <span className={MONO}>{fmtOdds(r.verdict[kind])}</span>;
}

/** The verdict's reason in plain words (verdict.ts keeps its terse codes for the self-check). */
export function plainReason(reason: string): string {
  if (reason === "price clears gate floor") return "price is at or above the bot's minimum";
  if (reason === "above break-even, below gate") return "profitable, but below the bot's minimum";
  if (reason === "gate unreachable at this prob") return "no price is high enough for this bot";
  if (reason === "price below break-even") return "price is below break-even";
  if (reason === "no placeable price") return "no book we can bet at has a price";
  if (reason === "no anchor probability") return "the bot recorded no probability";
  if (reason === "no in-play placer") return "in-play — can't be placed";
  if (reason === "kickoff < 3 min") return "kicks off in under 3 minutes";
  if (reason.startsWith("quote ≥")) return `price too old (limit ${QUOTE_MAX_AGE_MIN} min)`;
  return reason;
}

/**
 * The row's reason, capitalised, with the ACTUAL price age where age is the reason — one wording
 * for the stale case everywhere on the row: "Price too old (42 min; limit 30)".
 */
export function reasonText(r: PickRowData): string {
  const reason = r.verdict.reason;
  const t = reason.startsWith("quote ≥")
    ? r.bestAgeMin == null
      ? `price age unknown (limit ${QUOTE_MAX_AGE_MIN} min)`
      : `price too old (${Math.round(r.bestAgeMin)} min; limit ${QUOTE_MAX_AGE_MIN})`
    : plainReason(reason);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function VerdictCell({ r }: { r: PickRowData }) {
  const verdict = { ...r.verdict, reason: reasonText(r) };
  return (
    <div className="min-w-[120px] max-w-[170px]">
      <StatusBadge tone={VERDICT_TONE[verdict.verdict]} title={verdict.reason}>
        {VERDICT_LABEL[verdict.verdict]}
      </StatusBadge>
      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{verdict.reason}</div>
    </div>
  );
}

/**
 * The Action cell — the rule (UX fix round, 2026-09-24): a Place button appears ONLY on a Place
 * row, and on a Thin row with a visible warning. Every other row shows its reason as TEXT here,
 * never a disabled button with the reason in a tooltip — a money page must not show an action
 * next to a verdict that says not to take it.
 */
export function ActionCell({ r }: { r: PickRowData }) {
  const { pick, verdict } = r;
  const chip = r.best ? BOOK_CHIP[r.best.book] : null;
  const v = verdict.verdict;
  // The Place button RECORDS a bet the operator placed by hand at the book; it
  // stakes nothing. So it is deliberately NOT gated on placement_paused or the
  // per-bot toggle — those halt the AUTOMATED placer. Gating it meant a
  // hand-placed bet never reached `real_bets` and was never settled or
  // CLV-scored, which is the whole reason that path exists (review 2026-09-15).
  // Still withheld for in-play and the control arm: there is no in-play placer,
  // and the control arm is priced off a feed nobody can bet.
  const showPlaceAction = !r.inplay && !r.isControlArm && r.best != null && chip != null && (v === "PLACE" || v === "THIN");
  const whyNot = r.inplay
    ? r.isControlArm
      ? "Control arm — for measuring only, can't be bet"
      : "In-play — can't be placed"
    : `Don't place: ${reasonText(r).charAt(0).toLowerCase()}${reasonText(r).slice(1)}`;
  return (
    <div className="flex min-w-[150px] max-w-[200px] flex-col items-start gap-1">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <PickBetMark pickId={pick.id} initialState={r.markState} />
        {r.alreadyLogged && (
          <span
            className={`${CHIP} border-success/40 text-success`}
            title="You already recorded a bet on this pick today. It will settle and be scored against the closing price."
          >
            LOGGED
          </span>
        )}
        {!r.alreadyLogged && showPlaceAction && r.best && chip && (
          <PlaceAction
            shadowBetId={pick.id}
            botId={pick.bot_id}
            matchId={pick.match_id}
            market={pick.market}
            selection={pick.selection}
            bookmaker={chip.realBetsName}
            bookChip={chip.chip}
            odds={r.best.odds}
            capturedOdds={pick.odds_at_pick}
            stake={r.stake}
            pickLabel={`${pick.home} v ${pick.away} · ${formatPickLabel(pick.market, pick.selection)}`}
          />
        )}
      </div>
      {!r.alreadyLogged && showPlaceAction && v === "THIN" && (
        <span className="text-[11px] leading-tight text-warning">
          Thin: profitable, but below the bot&apos;s minimum {fmtOdds(verdict.gateFloor)}
        </span>
      )}
      {!r.alreadyLogged && !showPlaceAction && <span className="text-[11px] leading-tight text-muted-foreground">{whyNot}</span>}
    </div>
  );
}
