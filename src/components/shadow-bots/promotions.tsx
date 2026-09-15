import type { PromoRow } from "@/lib/shadow-bots/queries";
import { expiresWithinDays, PROMO_TYPE_LABEL } from "@/lib/shadow-bots/labels";

/** A promo inside this many days of expiry is flagged — terms go stale silently. */
const EXPIRING_DAYS = 7;

const eur = (v: number) => `${v >= 0 ? "+" : "−"}€${Math.abs(v).toFixed(2)}`;
const num = (v: number | null, dp = 2) => (v == null ? null : v.toFixed(dp));

/** The terms that actually decide the sign of a promo's EV, in one cell. */
function termsSummary(p: PromoRow): string {
  const bits: string[] = [];
  if (p.boost_pct != null) bits.push(`+${p.boost_pct}% on ${p.boost_applies_to ?? "profit"}`);
  if (p.face_value_eur != null) bits.push(`€${num(p.face_value_eur)} face${p.stake_returned ? " (SR)" : " (SNR)"}`);
  if (p.refund_eur != null) bits.push(`€${num(p.refund_eur)} refund${p.refund_cash ? " cash" : " as free bet"}`);
  if (p.min_odds != null) bits.push(`min ${num(p.min_odds)}`);
  if (p.max_stake_eur != null) bits.push(`max €${num(p.max_stake_eur, 0)}`);
  if (p.min_legs != null) bits.push(`${p.min_legs}+ legs`);
  if (p.rollover_x != null) bits.push(`${num(p.rollover_x, 1)}× rollover${p.deposit_eur != null ? ` on €${num(p.deposit_eur, 0)}` : ""}`);
  if (p.single_use) bits.push("single use");
  return bits.join(" · ") || "no terms captured";
}

/**
 * Promotions (OWN Phase 2) — the one OWN lever with a positive expectation that
 * needs no prediction, PROVIDED the terms are applied. Read-only: terms are
 * entered from each book's T&C page with `scripts/promo_ev.py`, which computes
 * and records the EV BEFORE the bet. This panel is the review side of that —
 * Σ EV against Σ realised, so the lever can be killed on evidence.
 */
export function Promotions({ promos, error }: { promos: PromoRow[]; error: string | null }) {
  const th = "px-2 py-1.5 text-left font-normal whitespace-nowrap";
  const numCell = "px-2 py-1.5 text-right font-mono text-xs tabular-nums text-neutral-200";
  const totals = promos.reduce(
    (a, p) => ({
      taken: a.taken + p.taken,
      ev: a.ev + p.evSum,
      settled: a.settled + p.settled,
      realised: a.realised + p.realisedSum,
      evSettled: a.evSettled + p.evSumSettled,
    }),
    { taken: 0, ev: 0, settled: 0, realised: 0, evSettled: 0 },
  );
  const expiring = promos.filter((p) => expiresWithinDays(p.valid_to, EXPIRING_DAYS)).length;

  return (
    <section className="mb-8">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-300">Promotions</h2>
        <span className="font-mono text-[11px] text-neutral-500">
          {promos.length} active · {totals.taken} taken · Σ EV {eur(totals.ev)}
          {totals.settled > 0 ? ` · ${totals.settled} settled, realised ${eur(totals.realised)}` : ""}
          {expiring > 0 ? ` · ${expiring} expiring ≤ ${EXPIRING_DAYS}d` : ""}
        </span>
      </div>

      {error && (
        <div className="mb-2 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          Promo read failed — this table is empty because of the error, not because there are no promos: {error}
        </div>
      )}

      {promos.length === 0 ? (
        <p className="rounded-lg border border-white/[0.08] px-4 py-5 text-sm text-neutral-500">
          No promo terms entered yet — add one from the book&apos;s T&amp;C page with{" "}
          <code className="rounded bg-white/[0.04] px-1 font-mono text-[11px] text-neutral-300">
            python3 scripts/promo_ev.py add-terms --book Coolbet --type odds_boost --title &quot;…&quot; --min-odds 1.5
            --max-stake 20 --valid-to YYYY-MM-DD --url …
          </code>{" "}
          in the engine repo.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-neutral-500">
              <tr>
                <th className={th}>Book</th>
                <th className={th}>Type</th>
                <th className={th}>Title</th>
                <th className={th} title="The terms that decide the sign of the EV: min odds, caps, boost, rollover">
                  Terms
                </th>
                <th className={th} title="Offer expiry; within 7 days is flagged because T&Cs change silently">
                  Valid to
                </th>
                <th className={`${th} text-right`} title="promo_ledger rows against these terms">
                  Taken
                </th>
                <th className={`${th} text-right`} title="Sum of the EV computed before each bet, under these terms">
                  Σ EV
                </th>
                <th className={`${th} text-right`} title="Sum of realised P&L over SETTLED ledger rows only">
                  Σ realised
                </th>
                <th className={`${th} text-right`} title="Realised minus Σ EV over the same settled rows — the only honest comparand">
                  Gap
                </th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => {
                const soon = expiresWithinDays(p.valid_to, EXPIRING_DAYS);
                const gap = p.settled > 0 ? p.realisedSum - p.evSumSettled : null;
                return (
                  <tr key={p.id} className="border-t border-white/[0.05]">
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono text-xs text-neutral-300">{p.book}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-xs text-neutral-400">
                      {PROMO_TYPE_LABEL[p.promo_type] ?? p.promo_type}
                    </td>
                    <td className="px-2 py-1.5 max-w-[220px] truncate text-neutral-100">
                      {p.source_url ? (
                        <a href={p.source_url} target="_blank" rel="noreferrer" className="hover:underline">
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-neutral-400">{termsSummary(p)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono text-xs tabular-nums text-neutral-400">
                      {p.valid_to ? p.valid_to.slice(0, 10) : "—"}
                      {soon && (
                        <span
                          className="ml-1 rounded border border-white/25 px-1 text-[10px] tracking-wider text-neutral-300"
                          title={`Expires within ${EXPIRING_DAYS} days — re-capture the terms before relying on them.`}
                        >
                          EXPIRING
                        </span>
                      )}
                    </td>
                    <td className={numCell}>{p.taken}</td>
                    <td className={numCell}>{p.taken > 0 ? eur(p.evSum) : "—"}</td>
                    <td className={numCell}>{p.settled > 0 ? eur(p.realisedSum) : "—"}</td>
                    <td className={numCell}>{gap == null ? "—" : eur(gap)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-neutral-600">
        Read-only. Terms and every taken promo are entered with{" "}
        <code className="font-mono text-neutral-500">scripts/promo_ev.py</code> in the engine repo, which refuses a
        ledger row without an EV computed before the bet. Gap compares realised only against the EV of the
        <span className="text-neutral-500"> same settled rows</span>; open positions are excluded on both sides.
      </p>
    </section>
  );
}
