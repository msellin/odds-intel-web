/**
 * VALUE-BETS-DENSITY-PASS Tier 1 (2026-06-06) — compact page header.
 *
 * Replaces the previous 5-section vertical stack (h1 + subtitle + 3-variant
 * tier explainer + Telegram CTA full-width banner + CLVTrustBanner) with a
 * single 2-line header. CLV stat collapses to a clickable pill linking to
 * /performance for the full breakdown. Telegram becomes an icon-chip
 * routing to /profile#telegram. Tier explainer collapses to a one-line
 * caption appropriate to the current user's tier.
 *
 * Above-the-fold mobile gain: ~500-600px vertical = 4+ additional rows
 * visible on first paint.
 */
import Link from "next/link";
import { getDashboardCache } from "@/lib/engine-data";

interface Props {
  isPro: boolean;
  isElite: boolean;
  totalCount: number;
}

async function loadHeroClv(isElite: boolean): Promise<number | null> {
  // Same source as CLVTrustBanner — dashboard_cache.{pro,elite}_value_bets_30d.
  // clv_pct is stored in % units (e.g. 10.0 = +10%), not decimal.
  const cache = await getDashboardCache();
  if (!cache) return null;
  const stats = isElite ? cache.elite_value_bets_30d : cache.pro_value_bets_30d;
  if (!stats || stats.n < 30) return null;
  return stats.clv_pct ?? null;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export async function ValueBetsHeader({ isPro, isElite, totalCount }: Props) {
  const clvHero = isPro ? await loadHeroClv(isElite) : null;

  // Tier-appropriate one-line caption. Replaces the 3 inline tier-explainer
  // <section> blocks that previously stacked under the h1.
  const caption =
    isElite
      ? `${totalCount} picks · all 39 strategies in the ensemble`
      : isPro
        ? `${totalCount} picks · calibrated strategies only`
        : `Today's model picks · Pro/Elite see live odds + edge per pick`;

  return (
    <header className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Today&apos;s value bets · <span className="text-green-400">CLV-tracked</span>
        </h1>
        <div className="flex items-center gap-1.5">
          {/* CLV stat pill — clickable, routes to /performance for the
              full breakdown. Replaces the multi-line CLVTrustBanner. */}
          {isPro && clvHero != null && (
            <Link
              href="/performance"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08] px-2.5 py-0.5 text-[11px] font-mono text-emerald-300 transition-colors hover:bg-emerald-500/15"
              title="Closing-line value over the last 30 days. Click for full breakdown on /performance."
            >
              <span className="font-bold">{fmtPct(clvHero)}</span>
              <span className="text-emerald-300/70">CLV · 30d</span>
            </Link>
          )}
          {/* Telegram delivery icon — replaces the full-width "Get these
              picks in Telegram" banner. Same destination. */}
          {isPro && (
            <Link
              href="/profile#telegram"
              aria-label="Get picks in Telegram"
              title="Get picks in Telegram — sent the moment they're identified. Manage in profile."
              className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/[0.08] px-2 text-[11px] text-sky-300 transition-colors hover:bg-sky-500/15"
            >
              <span aria-hidden>📲</span>
              <span className="hidden sm:inline">Telegram</span>
            </Link>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
        <span>{caption}</span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <Link
          href="/learn/closing-line-value"
          className="text-foreground/80 underline underline-offset-2 hover:text-green-400"
        >
          Why CLV beats ROI?
        </Link>
      </p>
    </header>
  );
}
