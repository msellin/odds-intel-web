import Link from "next/link";
import { PickBetMark } from "@/components/pick-bet-mark";
import { PlaceAction } from "@/components/shadow-bots/place-action";
import { KoTime } from "@/components/shadow-bots/ko-time";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import type { BotTrack, Freshness, PickVerdict, PickVerdictResult } from "@/lib/shadow-bots/verdict";
import { quoteFreshness, QUOTE_MAX_AGE_MIN } from "@/lib/shadow-bots/verdict";
import type { Quote, UpcomingPick } from "@/lib/shadow-bots/queries";
import { BOOK_CHIP, botShortLabel, formatAge, formatPickLabel } from "@/lib/shadow-bots/labels";

/**
 * One pick in the Pick queue (/admin/shadow-bots). Since #139 IA move P6 (2026-09-24) the table
 * is the shared DataTable (picks-queue-table.tsx); this module holds the per-row data and the
 * CELL renderers, so every rule that used to live in the one <tr> still lives in one file.
 */
export interface PickRowData {
  /** Already recorded in real_bets today — shown, and the button says so. */
  alreadyLogged: boolean;
  /** placement_paused OR this bot toggled off — context, never a verdict. */
  automationOff: boolean;
  pick: UpcomingPick;
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

const FRESH_TONE: Record<Freshness, string> = {
  FRESH: "border-border text-foreground",
  STALE: "border-border/60 text-muted-foreground",
  UNKNOWN: "border-border/40 text-muted-foreground/70",
};
const FRESH_TITLE: Record<Freshness, string> = {
  FRESH: `The bot decided on a price that was still fresh.`,
  STALE: `The bot decided on an old price — it may have moved since.`,
  UNKNOWN: "No age recorded: written before 15 Sep, or this bot does not check price age.",
};
const FRESH_WORD: Record<Freshness, string> = { FRESH: "fresh", STALE: "old", UNKNOWN: "—" };

const fmtOdds = (v: number | null) => (v == null ? "—" : v.toFixed(2));
const fmtEdge = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`);

const CHIP = "inline-block rounded border px-1 text-[10px] font-mono tracking-wider";
const MONO = "font-mono text-xs tabular-nums";

/**
 * Row styling: a pick whose DECISION quote was stale is greyed, never hidden (visibility
 * invariant — hiding it would quietly shrink the slate). The lead bot's picks get a sky edge.
 */
export function pickRowClassName(r: PickRowData): string {
  const stale = quoteFreshness(r.pick.decision_quote_age_min) === "STALE";
  return `${stale ? "opacity-50" : ""} ${r.track === "LEAD" ? "bg-info/[0.06] shadow-[inset_3px_0_0_0_var(--color-info)]" : ""}`;
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
    <div className="min-w-[160px] max-w-[260px]">
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

export function BotCell({ r }: { r: PickRowData }) {
  const { pick } = r;
  return (
    <div className="flex flex-wrap items-center gap-1 whitespace-nowrap">
      <Link
        href={`/admin/shadow-bots/${pick.bot_name}`}
        className="font-mono text-[11px] hover:underline"
        title={`${pick.bot_name} · needs an edge of ${(r.threshold * 100).toFixed(0)}% before it fires`}
      >
        {botShortLabel(pick.bot_name)}
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
      {r.automationOff && (
        <span
          className={`${CHIP} border-border text-muted-foreground`}
          title="The automatic placer is paused or this bot is switched off. You can still place by hand and record it."
        >
          auto off
        </span>
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
    return (
      <span className={MONO} title={`${r.best.book} · ${new Date(r.best.ts).toUTCString()}`}>
        {r.best.odds.toFixed(2)}
        <span className="ml-1 rounded border border-border px-1 text-[10px] text-muted-foreground">{chip.chip}</span>
      </span>
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
      {fresh !== "UNKNOWN" && <span className={`${CHIP} ml-1 ${FRESH_TONE[fresh]}`}>{FRESH_WORD[fresh]}</span>}
    </span>
  );
}

export function ShownAgeCell({ r }: { r: PickRowData }) {
  return (
    <span className={MONO} title={`Age of the price shown in "Best price now"; ${QUOTE_MAX_AGE_MIN} min or older reads Skip`}>
      {r.bestAgeMin == null ? "—" : `${Math.round(r.bestAgeMin)}m`}
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
  const v = r.verdict[kind];
  return <span className={MONO}>{kind === "liveEdge" ? fmtEdge(v) : fmtOdds(v)}</span>;
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
  if (reason.startsWith("quote ≥")) return reason.replace("quote ≥", "price is");
  return reason;
}

export function VerdictCell({ r }: { r: PickRowData }) {
  const verdict = { ...r.verdict, reason: plainReason(r.verdict.reason) };
  return (
    <div className="min-w-[120px] max-w-[170px]">
      <StatusBadge tone={VERDICT_TONE[verdict.verdict]} title={verdict.reason}>
        {VERDICT_LABEL[verdict.verdict]}
      </StatusBadge>
      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{verdict.reason}</div>
    </div>
  );
}

export function ActionCell({ r }: { r: PickRowData }) {
  const { pick, verdict } = r;
  const chip = r.best ? BOOK_CHIP[r.best.book] : null;
  const canPlace = verdict.verdict === "PLACE" || verdict.verdict === "THIN";
  // The Place button RECORDS a bet the operator placed by hand at the book; it
  // stakes nothing. So it is deliberately NOT gated on placement_paused or the
  // per-bot toggle — those halt the AUTOMATED placer. Gating it meant a
  // hand-placed bet never reached `real_bets` and was never settled or
  // CLV-scored, which is the whole reason that path exists (review 2026-09-15).
  // Still withheld for in-play and the control arm: there is no in-play placer,
  // and the control arm is priced off a feed nobody can bet.
  const showPlaceAction = !r.inplay && !r.isControlArm && r.best != null && chip != null;
  return (
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
          disabled={!canPlace}
          disabledReason={plainReason(verdict.reason)}
        />
      )}
    </div>
  );
}
