import Link from "next/link";
import { CoolbetPlacerToggle } from "@/components/coolbet-placer-toggle";
import { execOdds } from "@/lib/engine-data";
import type { BotScoreRow, BotRow, PlacerBotRow } from "@/lib/shadow-bots/queries";
import { botShortLabel } from "@/lib/shadow-bots/labels";
import {
  botTrack,
  botVerdict,
  leadBotName,
  meanSd,
  LEAD_MIN_N,
  PREREG_MIN_N,
  type BotTrack,
  type BotVerdictKind,
} from "@/lib/shadow-bots/verdict";

const VERDICT_TONE: Record<BotVerdictKind, string> = {
  PROMOTE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  RETIRE: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  OBSERVE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  COLLECTING: "bg-white/[0.04] text-neutral-400 border-white/10",
};

/**
 * TRACK is the "where do I look" axis and must not compete with the Verdict
 * chip, which is the pre-registered answer. So only LEAD gets colour, and only
 * an outline; NEGATIVE is grey text plus a dimmed row. See verdict.ts.
 */
const TRACK_CHIP: Record<BotTrack, string | null> = {
  LEAD: "border-sky-400/50 text-sky-300",
  NEGATIVE: "border-white/10 text-neutral-500",
  CANDIDATE: "border-white/15 text-neutral-400",
  OPEN: "border-white/15 text-neutral-400",
};
const TRACK_TITLE: Record<BotTrack, string> = {
  LEAD: "The candidate closest to resolving: mean margin-corrected CLV above zero on the most legs. "
    + "This is where to look — NOT a claim that it works. Its CI still spans zero.",
  NEGATIVE: "The whole 95% CI sits below zero. Decided at this n — more legs tell you how negative, not whether.",
  CANDIDATE: "Mean above zero past the leg floor, but another bot is further along.",
  OPEN: "NOT RULED OUT — a positive truth is still inside this bot's 95% interval, either because it has too "
    + `few legs (under ${LEAD_MIN_N}) or because its CI still spans zero. More CLV legs can still move it. `
    + "Caveat: CLV is measured against the closing line, so it cannot see a book that is PERSISTENTLY soft "
    + "in a segment — that only shows up in outcomes.",
};

const pct = (v: number | null, dp = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(dp)}%`);

/**
 * "Which bots work" — one row per non-retired bot from `bots`, judged on the
 * pre-registered rule: margin-corrected OWN-BOOK CLV (break-even 0), n ≥ 300.
 * ROI is shown dimmed as a cross-check only (see footnote).
 */
export function Scoreboard({
  bots,
  scoreboard,
  placerBots,
}: {
  bots: BotRow[];
  scoreboard: BotScoreRow[];
  placerBots: PlacerBotRow[];
}) {
  const placerByName = new Map(placerBots.map((p) => [p.bot_name, p]));
  const byBot = new Map(scoreboard.map((r) => [r.bot_id, r]));
  const statsFor = (id: string) => {
    const sc = byBot.get(id);
    return {
      n: Number(sc?.clv_n ?? 0),
      mean: sc?.clv_mc_mean == null ? null : Number(sc.clv_mc_mean),
      sd: sc?.clv_mc_sd == null ? null : Number(sc.clv_mc_sd),
    };
  };
  // One lead for the whole board, or none — chosen across every bot before any
  // row is built, so the picks table and this table cannot disagree.
  const lead = leadBotName(bots.map((b) => ({ name: b.name, stats: statsFor(b.id) })));
  const rows = bots
    .map((b) => {
      const sc = byBot.get(b.id);
      const stats = statsFor(b.id);
      const v = botVerdict(stats);
      const track = botTrack(stats, b.name === lead);
      // TWO populations, never mixed (migration 360): ROI over EVERY settled
      // pick, CLV over the own-book-closed subset. Computing ROI over the CLV
      // subset flipped the sign on 4 of 11 bots.
      return {
        bot: b,
        settled: Number(sc?.settled_n ?? 0),
        stats,
        v,
        track,
        fresh: Number(sc?.decision_fresh_n ?? 0),
        roi: sc?.settled_roi == null ? null : Number(sc.settled_roi),
        placer: placerByName.get(b.name) ?? null,
      };
    })
    // Lead first — the whole point of the column is that the eye lands on it.
    // Then the two real-money-capable bots, then by volume.
    .sort(
      (a, b) =>
        Number(b.track === "LEAD") - Number(a.track === "LEAD") ||
        Number(!!b.placer) - Number(!!a.placer) ||
        b.settled - a.settled,
    );

  const th = "px-2 py-1.5 text-left font-normal";
  const num = "px-2 py-1.5 text-right font-mono text-xs tabular-nums text-neutral-200";
  return (
    <section id="scoreboard" className="mb-8">
      <h2 className="mb-2 text-xs font-mono uppercase tracking-widest text-neutral-300">Which bots work</h2>
      <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            <tr>
              <th className={th}>Bot</th>
              <th className={`${th} text-right`} title="EVERY settled pick — the honest ROI denominator (migration 360)">
                n settled
              </th>
              <th className={`${th} text-right`} title="Rows with margin-corrected own-book CLV — the pre-registration's n">
                n CLV
              </th>
              <th className={`${th} text-right`} title="Mean margin-corrected own-book CLV ± 95% CI (1.96·sd/√n, cluster-naive). Break-even 0.">
                CLV (mc) ± CI
              </th>
              <th className={`${th} text-right`} title="mean / (sd/√n)">
                t
              </th>
              <th className={`${th} text-right`} title="Legs whose decision quote was ≤ 60 min old (decision_quote_fresh)">
                fresh
              </th>
              <th className={`${th} text-right`} title="Flat-stake ROI at the executable price — cross-check only, see footnote">
                ROI
              </th>
              <th className={th} title="Where to look today — see the footnote. Not a verdict.">
                Track
              </th>
              <th className={th}>Verdict</th>
              <th className={th}>Real money</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bot, settled, stats, v, track, fresh, roi, placer }) => (
              <tr
                key={bot.id}
                className={`border-t border-white/[0.05] ${
                  track === "LEAD"
                    ? "bg-sky-500/[0.07] shadow-[inset_3px_0_0_0_rgb(56_189_248/0.7)]"
                    : track === "NEGATIVE"
                      ? "opacity-55"
                      : ""
                }`}
              >
                <td className="px-2 py-1.5">
                  <Link
                    href={`/admin/shadow-bots/${bot.name}`}
                    className="text-neutral-100 hover:underline"
                    title={bot.name}
                  >
                    {botShortLabel(bot.name)}
                  </Link>
                  <span className="ml-2 font-mono text-[10px] text-neutral-600">{bot.maturity_label ?? "—"}</span>
                </td>
                <td className={num}>{settled}</td>
                <td className={num}>{stats.n}</td>
                <td className={num}>
                  {stats.mean == null ? "—" : (
                    <>
                      {pct(stats.mean)}
                      <span className="text-neutral-500"> ± {v.ciHalf == null ? "—" : (v.ciHalf * 100).toFixed(1)}</span>
                    </>
                  )}
                </td>
                <td className={num}>{v.t == null ? "—" : v.t.toFixed(2)}</td>
                <td className={num}>{fresh}</td>
                <td className={`${num} text-neutral-500`}>{pct(roi)}</td>
                <td className="px-2 py-1.5">
                  {TRACK_CHIP[track] && (
                    <span
                      className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${TRACK_CHIP[track]}`}
                      title={TRACK_TITLE[track]}
                    >
                      {track === "NEGATIVE" ? "CI < 0" : track}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${VERDICT_TONE[v.kind]}`}
                    title={`Pre-registration: COLLECTING if n < ${PREREG_MIN_N}; PROMOTE if CI lower > 0; RETIRE if mean < −2%; else OBSERVE`}
                  >
                    {v.label}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  {placer ? (
                    <CoolbetPlacerToggle botName={bot.name} initialEnabled={placer.ui_place_enabled} />
                  ) : (
                    <span className="font-mono text-[10px] text-neutral-600">paper</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
        <strong className="text-sky-300">LEAD</strong> is the one bot worth watching right now — the
        candidate whose mean margin-corrected CLV is above zero on the most legs, so it is nearest to
        resolving. It is <em>where to look, not a result</em>: its CI still spans zero.{" "}
        <strong>CI&nbsp;&lt;&nbsp;0</strong> marks bots whose entire 95% interval sits below zero —
        decided at this n, so more legs tell you how negative they are, not whether. Under{" "}
        {LEAD_MIN_N} CLV legs a bot gets no track at all, because the sign of its mean is noise.
        Track is orthogonal to Verdict: Verdict is the pre-registered rule and stays COLLECTING until
        n&nbsp;=&nbsp;{PREREG_MIN_N}.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
        ROI is a cross-check, not the verdict: per-bet sd ≈ 1.3, so confirming a true +3% ROI needs
        ~15,600 settled bets. TWO populations, never mixed (migration 360): <strong>n settled</strong> and
        ROI cover EVERY settled pick at the executable price; <strong>n CLV</strong> and the
        margin-corrected CLV cover only picks whose own book had a complete closing market — the
        pre-registered decision variable. Computing ROI over the CLV subset flipped the sign on 4 of
        11 bots, so they are shown side by side rather than as one number.
      </p>
    </section>
  );
}
