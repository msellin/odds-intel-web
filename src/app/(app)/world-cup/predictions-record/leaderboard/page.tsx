export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  Trophy,
  Info,
  CalendarClock,
  Activity,
} from "lucide-react";

import { loadLeaderboard, type LeaderboardRow } from "@/lib/wc-record";
import { WC_FIRST_KICKOFF_ISO, buildWorldCup2026EventLd } from "@/lib/world-cup";
import { WCRecordSubNav } from "@/components/wc-record-subnav";

// ── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "OddsIntel WC2026 Model Leaderboard — Brier, Log-Loss, Hit-Rate, CLV | OddsIntel",
  description:
    "Daily-updated comparison of OddsIntel's FIFA World Cup 2026 model against the market consensus and (when scrape-able) Opta. Brier, log-loss, hit-rate, CLV on identical fixtures.",
  alternates: {
    canonical: "https://oddsintel.app/world-cup/predictions-record/leaderboard",
  },
  openGraph: {
    title: "OddsIntel WC2026 Model Leaderboard",
    description:
      "Brier, log-loss, hit-rate, CLV — OddsIntel vs market consensus on every settled WC2026 fixture.",
    url: "https://oddsintel.app/world-cup/predictions-record/leaderboard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OddsIntel WC2026 Model Leaderboard",
    description: "Brier, log-loss, hit-rate, CLV — re-computed nightly.",
  },
};

// ── Formatters ───────────────────────────────────────────────────────────────

function fmt3(p: number | null): string {
  if (p == null || !isFinite(p)) return "—";
  return p.toFixed(3);
}

function fmtPct(p: number | null, digits = 0): string {
  if (p == null || !isFinite(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

function fmtSigned(p: number | null, digits = 1): string {
  if (p == null || !isFinite(p)) return "—";
  const v = p * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}pp`;
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ rows }: { rows: LeaderboardRow[] }) {
  const populated = rows.filter((r) => r.n > 0);
  const headline = (() => {
    if (populated.length === 0) {
      return "Daily-updated comparison — populates as WC2026 fixtures settle.";
    }
    const best = populated
      .slice()
      .sort((a, b) => (a.brier ?? Infinity) - (b.brier ?? Infinity))[0];
    return `Leading on Brier so far: ${best.label} at ${fmt3(best.brier)} across ${best.n} settled.`;
  })();

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-7">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color:var(--color-tournament-gold)]/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Model leaderboard
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          OddsIntel vs the market on the same WC2026 fixtures
        </h1>
        <p className="mt-2 max-w-xl text-xs text-muted-foreground sm:text-sm">
          {headline}
        </p>
        <p className="mt-2 max-w-xl text-[11px] text-muted-foreground/80 sm:text-xs">
          Same matches, same outcomes, four predictions — scored identically.
          Re-computed nightly as matches resolve.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/world-cup"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-card/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-white/[0.16] sm:min-h-[44px] sm:px-4 sm:py-2.5 sm:text-sm"
          >
            <Trophy className="size-3.5" />
            Back to World Cup hub
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Pre-tournament placeholder ───────────────────────────────────────────────

function PreTournamentPlaceholder() {
  const kickoffDate = new Date(WC_FIRST_KICKOFF_ISO).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" }
  );
  return (
    <section className="rounded-2xl border border-dashed border-white/[0.08] bg-card/30 p-8 text-center sm:p-12">
      <CalendarClock className="mx-auto size-10 text-muted-foreground/40" />
      <h2 className="mt-4 text-lg font-bold text-foreground sm:text-xl">
        0 settled fixtures — tournament starts {kickoffDate}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground sm:text-sm">
        The leaderboard ranks each source on Brier (lower is better) across the
        SAME settled fixtures. We need at least one resolved match before any
        row gets a Brier score.
      </p>
      <p className="mx-auto mt-3 max-w-md text-[11px] text-muted-foreground/70 sm:text-xs">
        Opta is listed as &quot;Coming soon&quot; until we wire up their daily
        article scrape — the market consensus is enough for v1.
      </p>
      <Link
        href="/world-cup/who-can-win"
        className="mt-5 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/[0.12] bg-card/40 px-4 py-2 text-xs font-semibold text-foreground hover:border-[color:var(--color-tournament-gold)]/40 sm:text-sm"
      >
        See pre-tournament picks instead →
      </Link>
    </section>
  );
}

// ── Leaderboard table ────────────────────────────────────────────────────────

function rankRows(rows: LeaderboardRow[]): Array<LeaderboardRow & { rank: number | null }> {
  // Rank by Brier ASC; null Brier (no data / Coming soon) goes last and has no rank.
  const populated = rows.filter((r) => r.brier != null);
  const unpopulated = rows.filter((r) => r.brier == null);
  populated.sort((a, b) => (a.brier ?? 0) - (b.brier ?? 0));
  const ranked: Array<LeaderboardRow & { rank: number | null }> = populated.map((r, i) => ({
    ...r,
    rank: i + 1,
  }));
  for (const r of unpopulated) ranked.push({ ...r, rank: null });
  return ranked;
}

function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  const ranked = rankRows(rows);

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
      <header className="flex items-end justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">
            Per-source ranking
          </h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            Sorted by Brier (lower = better). Re-computed nightly as matches resolve.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">
          {ranked.filter((r) => r.n > 0).length} active{" "}
          {ranked.filter((r) => r.n > 0).length === 1 ? "source" : "sources"}
        </span>
      </header>
      {/* 7-col table — give a min-width so columns stay legible at 375px and
          the wrapper scrolls horizontally rather than smashing labels. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[11px] sm:text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold sm:px-4">#</th>
              <th className="px-2 py-2 font-semibold">Source</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">N</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Brier</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Log-loss</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Hit-rate</th>
              <th className="whitespace-nowrap px-2 py-2 pr-3 text-right font-semibold sm:pr-4">CLV</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => {
              const isFirst = r.rank === 1;
              return (
                <tr
                  key={r.source}
                  className={`border-t border-white/[0.04] ${
                    isFirst ? "bg-[color:var(--color-tournament-gold)]/[0.06]" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-foreground sm:px-4">
                    {r.rank == null ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : isFirst ? (
                      <span className="inline-flex items-center gap-1 text-[color:var(--color-tournament-gold)]">
                        <Trophy className="size-3" />
                        {r.rank}
                      </span>
                    ) : (
                      r.rank
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="font-semibold text-foreground">{r.label}</div>
                    {r.note && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground/80 sm:text-[11px]">
                        {r.note}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-foreground">
                    {r.n}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-foreground">
                    {fmt3(r.brier)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-foreground">
                    {fmt3(r.logLoss)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-foreground">
                    {fmtPct(r.hitRate)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-2 py-2.5 pr-3 text-right tabular-nums sm:pr-4 ${
                      r.clv == null
                        ? "text-muted-foreground/60"
                        : r.clv >= 0
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {r.source === "market" ? (
                      <span className="text-muted-foreground/50">baseline</span>
                    ) : (
                      fmtSigned(r.clv)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Methodology ──────────────────────────────────────────────────────────────

function MethodologyNote() {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-card/30 p-4 text-xs text-muted-foreground sm:p-5">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[color:var(--color-tournament-gold)]" />
        <div className="space-y-2">
          <p>
            <strong className="font-semibold text-foreground">Same fixtures, same outcomes.</strong>{" "}
            Each source is scored only on the matches it had a row for, then sorted
            by mean Brier (lower is better). N tells you the sample size — early in
            the tournament a strong-looking source on 3 matches isn&apos;t conclusive.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Brier</strong> = mean
            squared error of the (home, draw, away) prob vector against the one-hot
            actual outcome.{" "}
            <strong className="font-semibold text-foreground">Log-loss</strong> =
            −log(p) on the eventual outcome, averaged over matches. Same definitions
            as the Summary page.
          </p>
          <p>
            <strong className="font-semibold text-foreground">CLV</strong> = avg of
            (source&apos;s prob on the actual outcome) − (market&apos;s prob on the
            actual outcome). Market is the reference baseline, so it has no CLV
            against itself.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Opta:</strong>{" "}
            we don&apos;t scrape Opta&apos;s daily-updated articles yet. The row is
            included with a &quot;Coming soon&quot; note so the table reflects the
            full intended comparison set.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function WCPredictionsLeaderboardPage() {
  const rows = await loadLeaderboard();
  const settled = rows.reduce((m, r) => Math.max(m, r.n), 0);

  // JSON-LD: WebPage schema. Identifies this as a leaderboard comparison page.
  const SITE = "https://oddsintel.app";
  const pageUrl = `${SITE}/world-cup/predictions-record/leaderboard`;
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "OddsIntel WC2026 Model Leaderboard",
    description:
      "Daily-updated comparison of OddsIntel's FIFA World Cup 2026 model against the market consensus and Opta on identical fixtures — Brier, log-loss, hit-rate, CLV.",
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "OddsIntel",
      url: SITE,
    },
    about: buildWorldCup2026EventLd(SITE),
    publisher: {
      "@type": "Organization",
      name: "OddsIntel",
      url: SITE,
    },
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Hero rows={rows} />

      <WCRecordSubNav active="leaderboard" />

      {settled === 0 ? <PreTournamentPlaceholder /> : <LeaderboardTable rows={rows} />}

      <MethodologyNote />

      <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70 sm:text-[11px]">
        <Activity className="size-3" />
        Re-computed nightly as matches resolve.
      </p>
    </div>
  );
}
