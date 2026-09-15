import Link from "next/link";
import { CoolbetPlacerToggle } from "@/components/coolbet-placer-toggle";
import { execOdds } from "@/lib/engine-data";
import type { BotScoreRow, BotRow, PlacerBotRow } from "@/lib/shadow-bots/queries";
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
  scoreboard,
  placerBots,
}: {
  bots: BotRow[];
  scoreboard: BotScoreRow[];
  placerBots: PlacerBotRow[];
}) {
  const placerByName = new Map(placerBots.map((p) => [p.bot_name, p]));
  const byBot = new Map(scoreboard.map((r) => [r.bot_id, r]));
  const rows = bots
    .map((b) => {
      const sc = byBot.get(b.id);
      const n = Number(sc?.clv_n ?? 0);
      const mean = sc?.clv_mc_mean == null ? null : Number(sc.clv_mc_mean);
      const sd = sc?.clv_mc_sd == null ? null : Number(sc.clv_mc_sd);
      const stats = { n, mean, sd };
      const v = botVerdict(stats);
      // TWO populations, never mixed (migration 360): ROI over EVERY settled
      // pick, CLV over the own-book-closed subset. Computing ROI over the CLV
      // subset flipped the sign on 4 of 11 bots.
      return {
        bot: b,
        settled: Number(sc?.settled_n ?? 0),
        stats,
        v,
        fresh: Number(sc?.decision_fresh_n ?? 0),
        roi: sc?.settled_roi == null ? null : Number(sc.settled_roi),
        placer: placerByName.get(b.name) ?? null,
      };
    })
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
        ~15,600 settled bets. TWO populations, never mixed (migration 360): <strong>n settled</strong> and
        ROI cover EVERY settled pick at the executable price; <strong>n CLV</strong> and the
        margin-corrected CLV cover only picks whose own book had a complete closing market — the
        pre-registered decision variable. Computing ROI over the CLV subset flipped the sign on 4 of
        11 bots, so they are shown side by side rather than as one number.
      </p>
    </section>
  );
}
