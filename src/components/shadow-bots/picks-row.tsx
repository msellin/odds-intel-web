import Link from "next/link";
import { PickBetMark } from "@/components/pick-bet-mark";
import { PlaceAction } from "@/components/shadow-bots/place-action";
import { KoTime } from "@/components/shadow-bots/ko-time";
import type { BotTrack, Freshness, PickVerdict, PickVerdictResult } from "@/lib/shadow-bots/verdict";
import { quoteFreshness, QUOTE_MAX_AGE_MIN } from "@/lib/shadow-bots/verdict";
import type { Quote, UpcomingPick } from "@/lib/shadow-bots/queries";
import { BOOK_CHIP, botShortLabel, formatAge, formatPickLabel } from "@/lib/shadow-bots/labels";

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
   * A green PLACE chip is a per-PICK price test; this is the per-BOT record
   * behind it. The two are independent and the row must show both.
   */
  track: BotTrack;
  markState: 0 | 1 | 2;
  stake: number;
}

/**
 * The Verdict chip is the ONE colour carrier per row. Everything else added for
 * the 2026-09-15 display additions — FRESH/STALE, IN-PLAY, CONTROL — is
 * structural: an outline, muted text, or reduced opacity. A second traffic
 * light on the same row makes neither readable.
 */
const VERDICT_TONE: Record<PickVerdict, string> = {
  PLACE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  THIN: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SKIP: "bg-white/[0.04] text-neutral-400 border-white/10",
  BLOCKED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const FRESH_TONE: Record<Freshness, string> = {
  FRESH: "border-white/20 text-neutral-300",
  STALE: "border-white/10 text-neutral-500",
  UNKNOWN: "border-white/[0.07] text-neutral-600",
};
const FRESH_TITLE: Record<Freshness, string> = {
  FRESH: `Bot decided on a quote under ${QUOTE_MAX_AGE_MIN} min old.`,
  STALE: `Bot decided on a quote ${QUOTE_MAX_AGE_MIN} min or older — the price may have moved.`,
  UNKNOWN: "No decision-quote age recorded: written before 2026-09-15, or this bot has no freshness gate.",
};

const fmtOdds = (v: number | null) => (v == null ? "—" : v.toFixed(2));
const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

const CHIP = "inline-block rounded border px-1 text-[10px] font-mono tracking-wider";

export function PicksRow({ r }: { r: PickRowData }) {
  const { pick, verdict } = r;
  const chip = r.best ? BOOK_CHIP[r.best.book] : null;
  const fresh = quoteFreshness(pick.decision_quote_age_min);
  // Greyed, never hidden (visibility invariant): a stale row is still a row the
  // owner must be able to see and judge.
  const stale = fresh === "STALE";
  const canPlace = verdict.verdict === "PLACE" || verdict.verdict === "THIN";
  // The control arm is priced off API-Football's aggregate — there is nothing to
  // place at that number, so it never gets an action, whatever the verdict says.
  // The Place button RECORDS a bet the operator placed by hand at the book; it
// stakes nothing. So it is deliberately NOT gated on placement_paused or the
// per-bot toggle — those halt the AUTOMATED placer. Gating it meant a
// hand-placed bet never reached `real_bets` and was never settled or
// CLV-scored, which is the whole reason that path exists (review 2026-09-15).
// Still withheld for in-play and the control arm: there is no in-play placer,
// and the control arm is priced off a feed nobody can bet.
const showPlaceAction = !r.inplay && !r.isControlArm && r.best != null && chip != null;
  const td = "px-2 py-1.5 align-middle";
  const mono = "font-mono text-xs tabular-nums text-neutral-200";
  const score =
    pick.inplay_score_home != null && pick.inplay_score_away != null
      ? `${pick.inplay_score_home}-${pick.inplay_score_away}`
      : null;
  return (
    <tr
      className={`border-t border-white/[0.05] text-sm ${stale ? "opacity-50" : ""} ${
        r.track === "LEAD" ? "bg-sky-500/[0.06] shadow-[inset_3px_0_0_0_rgb(56_189_248/0.7)]" : ""
      }`}
    >
      <td className={td}>
        <KoTime iso={pick.kickoff} />
      </td>
      <td className={`${td} min-w-0 max-w-[260px]`}>
        <div className="truncate text-neutral-100">
          {pick.home} <span className="text-neutral-500">v</span> {pick.away}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-500">
          {r.inplay && (
            <span
              className={`${CHIP} shrink-0 border-white/25 text-neutral-300`}
              title="Raised while the match was running — the in-play slow-state rig."
            >
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
      </td>
      <td className={`${td} whitespace-nowrap text-neutral-100`}>{formatPickLabel(pick.market, pick.selection)}</td>
      <td className={`${td} whitespace-nowrap`}>
        <Link
          href={`/admin/shadow-bots/${pick.bot_name}`}
          className="font-mono text-[11px] text-neutral-300 hover:text-neutral-100 hover:underline"
          title={`${pick.bot_name} · threshold ${(r.threshold * 100).toFixed(0)}%`}
        >
          {botShortLabel(pick.bot_name)}
        </Link>
        {r.track === "LEAD" && (
          <span
            className={`${CHIP} ml-1 border-sky-400/50 text-sky-300`}
            title="The one bot worth watching: mean margin-corrected CLV above zero on the most legs, so it is nearest to resolving. Where to look — NOT a claim that it works; its CI still spans zero."
          >
            LEAD
          </span>
        )}
        {r.track === "NEGATIVE" && (
          <span
            className={`${CHIP} ml-1 border-white/10 text-neutral-500`}
            title="This bot's entire 95% CLV interval sits below zero — decided at this n. A PLACE chip here means the PRICE clears the bot's floor, not that the bot works."
          >
            CI &lt; 0
          </span>
        )}
        {r.track === "OPEN" && (
          <span
            className={`${CHIP} ml-1 border-white/15 text-neutral-500`}
            title="Not ruled out: a positive truth is still inside this bot's 95% CLV interval. More legs can still move it."
          >
            OPEN
          </span>
        )}
        {r.isControlArm && (
          <span
            className={`${CHIP} ml-1 border-dashed border-white/25 text-neutral-400`}
            title="Control arm: same trigger priced off API-Football's aggregate. Measurement only, never placeable."
          >
            CONTROL
          </span>
        )}
        {r.automationOff && (
          <span
            className={`${CHIP} ml-1 border-white/15 text-neutral-500`}
            title="The automated placer is paused or this bot is toggled off. You can still place by hand and record it."
          >
            auto off
          </span>
        )}
      </td>
      <td className={`${td} whitespace-nowrap text-right`}>
        {r.inplay ? (
          // In-play: the decision price is the book's ON-SCREEN number at the
          // minute the trigger fired, and `calibrated_prob` holds that book's
          // own Shin de-vigged probability — NOT a model probability.
          <div className="leading-tight">
            <span
              className="font-mono text-xs tabular-nums text-neutral-400"
              title="Book's on-screen price at the minute the trigger fired. No placement path exists for in-play."
            >
              {fmtOdds(pick.odds_at_pick)}
              <span className={`${CHIP} ml-1 border-white/10 text-neutral-500`}>
                {r.isControlArm ? "AF feed" : pick.recommended_bookmaker ?? "on-screen"}
              </span>
            </span>
            <div
              className="font-mono text-[10px] tabular-nums text-neutral-500"
              title="The book's own de-vigged implied probability at that price — a market number, not our model."
            >
              book prob {pick.calibrated_prob == null ? "—" : `${(pick.calibrated_prob * 100).toFixed(1)}%`}
            </div>
          </div>
        ) : r.best && chip ? (
          <span className={mono} title={`${r.best.book} · ${new Date(r.best.ts).toUTCString()}`}>
            {r.best.odds.toFixed(2)}
            <span className="ml-1 rounded border border-white/10 px-1 text-[10px] text-neutral-400">{chip.chip}</span>
          </span>
        ) : r.unplaceable ? (
          <span className="font-mono text-xs tabular-nums text-neutral-600" title="Epicbet — no placement path; price discovery only">
            {r.unplaceable.odds.toFixed(2)}
            <span className="ml-1 rounded border border-white/10 px-1 text-[10px]">EB · no placer</span>
          </span>
        ) : (
          <span className="text-neutral-600">—</span>
        )}
      </td>
      <td className={`${td} whitespace-nowrap text-right`} title={FRESH_TITLE[fresh]}>
        <span className="font-mono text-xs tabular-nums text-neutral-300">
          {formatAge(pick.decision_quote_age_min)}
        </span>
        <span className={`${CHIP} ml-1 ${FRESH_TONE[fresh]}`}>{fresh === "UNKNOWN" ? "—" : fresh}</span>
      </td>
      <td className={`${td} text-right ${mono}`} title="Age of the live quote shown to the left; ≥ 30 min reads SKIP">
        {r.bestAgeMin == null ? "—" : `${Math.round(r.bestAgeMin)}m`}
      </td>
      {r.inplay ? (
        // Break-even / gate floor / live edge are model-gate arithmetic. For an
        // in-play row the anchor IS the book's own price, so they would restate
        // the vig and read as a model opinion we did not form.
        <td
          className={`${td} text-center text-xs text-neutral-600`}
          colSpan={3}
          title="Model gates do not apply to in-play rows — the anchor is the book's own de-vigged price."
        >
          model gates n/a
        </td>
      ) : (
        <>
          <td className={`${td} text-right ${mono}`} title="1 / anchor probability — below this the bet loses money">
            {fmtOdds(verdict.breakEven)}
          </td>
          <td className={`${td} text-right ${mono}`} title="1 / (anchor prob − bot threshold), raised to the placer's odds floor for real-money bets">
            {fmtOdds(verdict.gateFloor)}
          </td>
          <td className={`${td} text-right ${mono}`} title="anchor prob − 1 / shown price">
            {fmtPct(verdict.liveEdge)}
          </td>
        </>
      )}
      <td className={`${td} whitespace-nowrap`}>
        <span
          className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${VERDICT_TONE[verdict.verdict]}`}
          title={verdict.reason}
        >
          {verdict.verdict}
        </span>
        {r.inplay && (
          <span className={`${CHIP} ml-1 border-white/10 text-neutral-500`} title="No placement path exists for in-play at any book we can bet.">
            {verdict.reason}
          </span>
        )}
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <div className="flex items-center gap-2">
          <PickBetMark pickId={pick.id} initialState={r.markState} />
          {r.alreadyLogged && (
            <span
              className={`${CHIP} border-emerald-500/40 text-emerald-300`}
              title="You already recorded a bet on this pick today (real_bets). It will settle and be scored against the closing line."
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
              disabledReason={verdict.reason}
            />
          )}
        </div>
      </td>
    </tr>
  );
}
