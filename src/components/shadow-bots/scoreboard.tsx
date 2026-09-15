import Link from "next/link";
import { CoolbetPlacerToggle } from "@/components/coolbet-placer-toggle";
import { execOdds } from "@/lib/engine-data";
import type { BotClvRow, BotRow, PlacerBotRow } from "@/lib/shadow-bots/queries";
import { botShortLabel } from "@/lib/shadow-bots/labels";
import { botVerdict, meanSd, PREREG_MIN_N, type BotVerdictKind } from "@/lib/shadow-bots/verdict";

const VERDICT_TONE: Record<BotVerdictKind, string> = {
  PROMOTE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  RETIRE: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  OBSERVE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  COLLECTING: "bg-white/[0.04] text-neutral-400 border-white/10",
};

const pct = (v: number | null, dp = 1) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(dp)}%`);

/**
 * "Which bots work" — one row per non-retired bot from `bots`, judged on the
 * pre-registered rule: margin-corrected OWN-BOOK CLV (break-even 0), n ≥ 300.
 * ROI is shown dimmed as a cross-check only (see footnote).
 */
export function Scoreboard({
  bots,
  clvRows,
  placerBots,
}: {
  bots: BotRow[];
  clvRows: BotClvRow[];
  placerBots: PlacerBotRow[];
}) {
  const byBot = new Map<string, BotClvRow[]>();
  for (const r of clvRows) (byBot.get(r.bot_id) ?? byBot.set(r.bot_id, []).get(r.bot_id)!).push(r);
  const placerByName = new Map(placerBots.map((p) => [p.bot_name, p]));

  const rows = bots
    .map((b) => {
      const mine = byBot.get(b.id) ?? [];
      const stats = meanSd(mine.map((r) => (r.clv_margin_corrected == null ? null : Number(r.clv_margin_corrected))));
      const v = botVerdict(stats);
      const fresh = mine.filter((r) => r.decision_quote_fresh === true).length;
      const rets = mine
        .filter((r) => r.result === "won" || r.result === "lost")
        .map((r) => (r.result === "won" ? execOdds(r.odds_at_pick, r.odds_at_pick_live) - 1 : -1));
      const roi = rets.length ? rets.reduce((a, c) => a + c, 0) / rets.length : null;
      return { bot: b, settled: mine.length, stats, v, fresh, roi, placer: placerByName.get(b.name) ?? null };
    })
    // real-money-capable first, then by n desc
    .sort((a, b) => Number(!!b.placer) - Number(!!a.placer) || b.settled - a.settled);

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
              <th className={`${th} text-right`} title="Settled picks with an own-book close (shadow_bets_own_book_clv)">
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
              <th className={th}>Verdict</th>
              <th className={th}>Real money</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ bot, settled, stats, v, fresh, roi, placer }) => (
              <tr key={bot.id} className="border-t border-white/[0.05]">
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
        ROI is a cross-check, not the verdict: per-bet sd ≈ 1.3, so confirming a true +3% ROI needs
        ~15,600 settled bets. Margin-corrected own-book CLV is written at settlement from 2026-09-15
        (migration 355); rows settled before then have none and count toward n settled only.
      </p>
    </section>
  );
}
