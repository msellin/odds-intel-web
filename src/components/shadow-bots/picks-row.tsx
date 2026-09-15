import Link from "next/link";
import { PickBetMark } from "@/components/pick-bet-mark";
import { PlaceAction } from "@/components/shadow-bots/place-action";
import { KoTime } from "@/components/shadow-bots/ko-time";
import type { PickVerdict, PickVerdictResult } from "@/lib/shadow-bots/verdict";
import type { Quote, UpcomingPick } from "@/lib/shadow-bots/queries";
import { BOOK_CHIP, botShortLabel, formatPickLabel } from "@/lib/shadow-bots/labels";

export interface PickRowData {
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
  markState: 0 | 1 | 2;
  stake: number;
}

const VERDICT_TONE: Record<PickVerdict, string> = {
  PLACE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  THIN: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SKIP: "bg-white/[0.04] text-neutral-400 border-white/10",
  BLOCKED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const fmtOdds = (v: number | null) => (v == null ? "—" : v.toFixed(2));
const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);

export function PicksRow({ r }: { r: PickRowData }) {
  const { pick, verdict } = r;
  const chip = r.best ? BOOK_CHIP[r.best.book] : null;
  const canPlace = verdict.verdict === "PLACE" || verdict.verdict === "THIN";
  const td = "px-2 py-1.5 align-middle";
  const mono = "font-mono text-xs tabular-nums text-neutral-200";
  return (
    <tr className="border-t border-white/[0.05] text-sm">
      <td className={td}>
        <KoTime iso={pick.kickoff} />
      </td>
      <td className={`${td} min-w-0 max-w-[260px]`}>
        <div className="truncate text-neutral-100">
          {pick.home} <span className="text-neutral-500">v</span> {pick.away}
        </div>
        <div className="truncate text-[11px] text-neutral-500">
          {pick.country ? `${pick.country} · ` : ""}
          {pick.league ?? ""}
          {pick.tier ? ` · T${pick.tier}` : ""}
        </div>
      </td>
      <td className={`${td} whitespace-nowrap text-neutral-100`}>{formatPickLabel(pick.market, pick.selection)}</td>
      <td className={`${td} whitespace-nowrap`}>
        <Link
          href={`/admin/shadow-bots/${pick.bot_name}`}
          className="font-mono text-[11px] text-neutral-300 hover:text-neutral-100 hover:underline"
          title={`${pick.bot_name} · threshold ${(r.threshold * 100).toFixed(0)}%${
            pick.decision_quote_age_min != null ? ` · decision quote ${Math.round(pick.decision_quote_age_min)} min old` : ""
          }`}
        >
          {botShortLabel(pick.bot_name)}
        </Link>
      </td>
      <td className={`${td} whitespace-nowrap text-right`}>
        {r.best && chip ? (
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
      <td className={`${td} text-right ${mono}`} title="Age of the shown quote; ≥ 30 min reads SKIP">
        {r.bestAgeMin == null ? "—" : `${Math.round(r.bestAgeMin)}m`}
      </td>
      <td className={`${td} text-right ${mono}`} title="1 / anchor probability — below this the bet loses money">
        {fmtOdds(verdict.breakEven)}
      </td>
      <td className={`${td} text-right ${mono}`} title="1 / (anchor prob − bot threshold), raised to the placer's odds floor for real-money bots">
        {fmtOdds(verdict.gateFloor)}
      </td>
      <td className={`${td} text-right ${mono}`} title="anchor prob − 1 / shown price">
        {fmtPct(verdict.liveEdge)}
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <span
          className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${VERDICT_TONE[verdict.verdict]}`}
          title={verdict.reason}
        >
          {verdict.verdict}
        </span>
      </td>
      <td className={`${td} whitespace-nowrap`}>
        <div className="flex items-center gap-2">
          <PickBetMark pickId={pick.id} initialState={r.markState} />
          {r.best && chip && (
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
