import type { PromoRow } from "@/lib/admin-money";
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
 * Promotions (OWN Phase 2). Rendered on /admin/real-bets since #139 IA move P5 (2026-09-24):
 * EV against realised is a money question. Collapsed to ONE line while `promo_terms` is empty.
 *
 * Original note — Promotions — the one OWN lever with a positive expectation that
 * needs no prediction, PROVIDED the terms are applied. Read-only: terms are
 * entered from each book's T&C page with `scripts/promo_ev.py`, which computes
 * and records the EV BEFORE the bet. This panel is the review side of that —
 * Σ EV against Σ realised, so the lever can be killed on evidence.
 */
export function Promotions({ promos, error }: { promos: PromoRow[]; error: string | null }) {
  const th = "px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground";
  const numCell = "px-3 py-2 text-right font-mono text-xs tabular-nums";
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

  if (error) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        Promotions: unreadable — the read failed, so this says nothing about whether any exist ({error}).
      </div>
    );
  }

  if (promos.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Promotions:</span> none entered yet. To add one from a book&apos;s
        terms page, run{" "}
        <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">
          python3 scripts/promo_ev.py add-terms --book Coolbet --type odds_boost --title &quot;…&quot; --min-odds 1.5
          --max-stake 20 --valid-to YYYY-MM-DD --url …
        </code>{" "}
        in the engine repo.
      </p>
    );
  }

  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
        <span className="text-sm font-medium">Promotions</span>
        <span className="text-xs text-muted-foreground">
          {promos.length} active · {totals.taken} taken · expected value {eur(totals.ev)}
          {totals.settled > 0 ? ` · ${totals.settled} settled, actually made ${eur(totals.realised)}` : ""}
          {expiring > 0 ? ` · ${expiring} expiring within ${EXPIRING_DAYS} days` : ""}
        </span>
        <span className="ml-auto text-xs text-primary group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs text-primary group-open:inline">Hide</span>
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className={th}>Book</th>
              <th className={th}>Type</th>
              <th className={th}>Title</th>
              <th className={th} title="The terms that decide whether the promo is worth it: min odds, caps, boost, rollover">
                Terms
              </th>
              <th className={th} title="Offer expiry; within 7 days is flagged because terms change silently">
                Valid to
              </th>
              <th className={`${th} text-right`}>Taken</th>
              <th className={`${th} text-right`} title="Sum of the expected value worked out before each bet">
                Expected
              </th>
              <th className={`${th} text-right`} title="What the settled ones actually made">
                Actually made
              </th>
              <th className={`${th} text-right`} title="Actually made minus expected, over the SAME settled bets only">
                Gap
              </th>
            </tr>
          </thead>
          <tbody>
            {promos.map((p) => {
              const soon = expiresWithinDays(p.valid_to, EXPIRING_DAYS);
              const gap = p.settled > 0 ? p.realisedSum - p.evSumSettled : null;
              return (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{p.book}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{PROMO_TYPE_LABEL[p.promo_type] ?? p.promo_type}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">
                    {p.source_url ? (
                      <a href={p.source_url} target="_blank" rel="noreferrer" className="hover:underline">
                        {p.title}
                      </a>
                    ) : (
                      p.title
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{termsSummary(p)}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                    {p.valid_to ? p.valid_to.slice(0, 10) : "—"}
                    {soon && (
                      <span className="ml-1 rounded bg-warning/15 px-1 text-[10px] text-warning" title={`Expires within ${EXPIRING_DAYS} days — re-capture the terms before relying on them.`}>
                        expiring
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
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Read-only. Terms and every promo taken are entered with <code className="font-mono">scripts/promo_ev.py</code> in the
        engine repo, which refuses a bet without an expected value worked out first. The gap compares only settled bets on both
        sides; open ones are left out.
      </p>
    </details>
  );
}
