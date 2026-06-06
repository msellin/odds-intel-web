export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  LineChart,
  Info,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
} from "lucide-react";

import { loadCLVSeries, type CLVPoint } from "@/lib/wc-record";
import { WC_FIRST_KICKOFF_ISO, buildWorldCup2026EventLd } from "@/lib/world-cup";
import { WCRecordSubNav } from "@/components/wc-record-subnav";

// ── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "OddsIntel WC2026 CLV vs Market — Closing Line Value Chart | OddsIntel",
  description:
    "Cumulative closing line value of OddsIntel's WC2026 model against the vig-removed market consensus. Every settled match, in order, with no hiding.",
  alternates: { canonical: "https://oddsintel.app/world-cup/predictions-record/clv" },
  openGraph: {
    title: "OddsIntel WC2026 CLV vs Market",
    description:
      "Closing line value chart vs Pinnacle / FotMob across every settled WC2026 fixture.",
    url: "https://oddsintel.app/world-cup/predictions-record/clv",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OddsIntel WC2026 CLV vs Market",
    description: "Cumulative CLV chart across every settled WC2026 fixture.",
  },
};

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtSigned(p: number | null, digits = 1): string {
  if (p == null || !isFinite(p)) return "—";
  const v = p * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}pp`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ series }: { series: CLVPoint[] }) {
  const headline = (() => {
    if (series.length === 0) {
      return "Cumulative CLV — populates as WC2026 fixtures settle.";
    }
    const last = series[series.length - 1];
    const beat = series.filter((p) => p.clv > 0).length;
    return `Cumulative CLV ${fmtSigned(last.cumClv)} over ${series.length} settled — we leaned the right way harder than the market on ${beat}/${series.length}.`;
  })();

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-7">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color:var(--color-tournament-gold)]/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LineChart className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Closing Line Value
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          Closing Line Value vs Market — OddsIntel WC2026
        </h1>
        <p className="mt-2 max-w-xl text-xs text-muted-foreground sm:text-sm">
          {headline}
        </p>
        <p className="mt-2 max-w-xl text-[11px] text-muted-foreground/80 sm:text-xs">
          Every settled WC2026 fixture in order. Positive CLV = we leaned the
          right way harder than the vig-removed market consensus.
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

// ── Empty state ──────────────────────────────────────────────────────────────

function PreTournamentPlaceholder() {
  const kickoffDate = new Date(WC_FIRST_KICKOFF_ISO).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" }
  );
  return (
    <section className="rounded-2xl border border-dashed border-white/[0.08] bg-card/30 p-8 text-center sm:p-12">
      <CalendarClock className="mx-auto size-10 text-muted-foreground/40" />
      <h2 className="mt-4 text-lg font-bold text-foreground sm:text-xl">
        No CLV points yet — tournament starts {kickoffDate}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground sm:text-sm">
        The chart needs at least one settled match where we had both a model
        prediction and a market consensus row. As fixtures resolve, each
        settled match adds one point to the cumulative line.
      </p>
      <p className="mx-auto mt-3 max-w-md text-[11px] text-muted-foreground/70 sm:text-xs">
        Why publish this? Because CLV is the cleanest single-number test of whether
        a model is actually adding information beyond the market price.
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

// ── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ series }: { series: CLVPoint[] }) {
  const n = series.length;
  const last = series[n - 1];
  const positiveN = series.filter((p) => p.clv > 0).length;
  const avgClv = series.reduce((s, p) => s + p.clv, 0) / n;
  const bestRow = series.reduce<CLVPoint | null>((best, p) => {
    if (!best || p.clv > best.clv) return p;
    return best;
  }, null);
  const worstRow = series.reduce<CLVPoint | null>((worst, p) => {
    if (!worst || p.clv < worst.clv) return p;
    return worst;
  }, null);

  const cards: Array<{ label: string; value: string; sub: string; tone: "ok" | "warn" | "neutral" }> = [
    {
      label: "Matches",
      value: String(n),
      sub: "with both model + market",
      tone: "neutral",
    },
    {
      label: "Cumulative CLV",
      value: fmtSigned(last.cumClv),
      sub: `avg ${fmtSigned(avgClv)} per match`,
      tone: last.cumClv >= 0 ? "ok" : "warn",
    },
    {
      label: "Beat market on",
      value: `${positiveN}/${n}`,
      sub: positiveN >= n / 2 ? "majority beat" : "minority beat",
      tone: positiveN >= n / 2 ? "ok" : "warn",
    },
    {
      label: "Best / worst row",
      value: `${fmtSigned(bestRow?.clv ?? null)} / ${fmtSigned(worstRow?.clv ?? null)}`,
      sub:
        bestRow && worstRow
          ? `${bestRow.homeName.slice(0, 8)} • ${worstRow.homeName.slice(0, 8)}`
          : "—",
      tone: "neutral",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {cards.map((c) => {
        const toneClass =
          c.tone === "ok"
            ? "text-emerald-300"
            : c.tone === "warn"
            ? "text-rose-300"
            : "text-foreground";
        return (
          <div
            key={c.label}
            className="rounded-xl border border-white/[0.08] bg-card/40 p-3 sm:p-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              {c.label}
            </p>
            <p className={`mt-1 text-lg font-bold tabular-nums sm:text-2xl ${toneClass}`}>
              {c.value}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
              {c.sub}
            </p>
          </div>
        );
      })}
    </section>
  );
}

// ── Inline SVG CLV chart ─────────────────────────────────────────────────────
//
// Mobile-first: viewBox is 100×60 abstract units; CSS sizes responsively. Works
// down to 375px screens (the viewBox shrinks isotropically). No chart library.

function CLVChart({ series }: { series: CLVPoint[] }) {
  const PAD_LEFT = 8;
  const PAD_RIGHT = 4;
  const PAD_TOP = 4;
  const PAD_BOTTOM = 10;
  const WIDTH = 100;
  const HEIGHT = 60;
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  // Find symmetric y-range around 0 so the zero line sits in the middle when
  // we cross it. Pad 15% so the line doesn't touch the top/bottom edge.
  const maxAbs = Math.max(
    0.01,
    ...series.map((p) => Math.abs(p.cumClv)),
    ...series.map((p) => Math.abs(p.clv))
  );
  const yMax = maxAbs * 1.15;

  // Map index → x, value → y.
  const xAt = (i: number): number => {
    if (series.length <= 1) return PAD_LEFT + innerW / 2;
    return PAD_LEFT + (i / (series.length - 1)) * innerW;
  };
  const yAt = (v: number): number => {
    // v in [-yMax, +yMax] → screen y (top is small y)
    const t = (v + yMax) / (2 * yMax);
    return PAD_TOP + innerH * (1 - t);
  };
  const yZero = yAt(0);

  // Cumulative line points
  const linePts = series.map((p, i) => `${xAt(i).toFixed(2)},${yAt(p.cumClv).toFixed(2)}`).join(" ");

  // Area fill — close down to zero line
  const areaPts = [
    `${xAt(0).toFixed(2)},${yZero.toFixed(2)}`,
    ...series.map((p, i) => `${xAt(i).toFixed(2)},${yAt(p.cumClv).toFixed(2)}`),
    `${xAt(series.length - 1).toFixed(2)},${yZero.toFixed(2)}`,
  ].join(" ");

  const cumLast = series[series.length - 1].cumClv;
  const lineColour = cumLast >= 0 ? "rgb(52 211 153)" : "rgb(251 113 133)";

  return (
    <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
      <header className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">
            Cumulative CLV — chronological
          </h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            One step per settled match. Above the dashed zero line = we&apos;re ahead of the market.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">
          {series.length} {series.length === 1 ? "match" : "matches"}
        </span>
      </header>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Cumulative closing line value across settled World Cup 2026 fixtures"
        className="block h-auto w-full"
        preserveAspectRatio="none"
      >
        {/* Y grid: 0, ±yMax/2, ±yMax */}
        {[-yMax, -yMax / 2, 0, yMax / 2, yMax].map((v) => {
          const y = yAt(v);
          return (
            <g key={v}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={WIDTH - PAD_RIGHT}
                y2={y}
                stroke="currentColor"
                strokeOpacity={v === 0 ? 0.35 : 0.08}
                strokeDasharray={v === 0 ? "1.5 1.5" : undefined}
                strokeWidth={v === 0 ? 0.5 : 0.3}
              />
              <text
                x={PAD_LEFT - 1.5}
                y={y + 1.2}
                textAnchor="end"
                fontSize="2.6"
                fill="currentColor"
                opacity="0.45"
              >
                {(v * 100 >= 0 ? "+" : "") + (v * 100).toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Area fill (subtle) */}
        <polygon points={areaPts} fill={lineColour} fillOpacity="0.10" />

        {/* Cumulative line */}
        <polyline
          points={linePts}
          fill="none"
          stroke={lineColour}
          strokeWidth="0.9"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Per-match dots — small, colour-coded */}
        {series.map((p, i) => {
          const dotColour = p.clv >= 0 ? "rgb(52 211 153)" : "rgb(251 113 133)";
          return (
            <circle
              key={p.matchId}
              cx={xAt(i)}
              cy={yAt(p.cumClv)}
              r="0.8"
              fill={dotColour}
            >
              <title>
                {`${fmtDate(p.date)} — ${p.homeName} vs ${p.awayName}: per-match ${fmtSigned(p.clv)}, cumulative ${fmtSigned(p.cumClv)}`}
              </title>
            </circle>
          );
        })}

        {/* X axis label (chronological — just a hint) */}
        <text
          x={WIDTH / 2}
          y={HEIGHT - 1}
          textAnchor="middle"
          fontSize="2.6"
          fill="currentColor"
          opacity="0.55"
        >
          chronological — oldest → newest
        </text>
      </svg>

      {/* Per-match table — collapsible visually via overflow.
          Both axes scroll so long team names don't bust the page on 375px. */}
      <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-white/[0.04]">
        <table className="w-full min-w-[420px] text-left text-[11px] sm:text-xs">
          <thead className="sticky top-0 bg-card/95 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Date</th>
              <th className="px-2 py-1.5 font-semibold">Match</th>
              <th className="px-2 py-1.5 text-right font-semibold">Per-match</th>
              <th className="px-2 py-1.5 text-right font-semibold">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {series
              .slice()
              .reverse()
              .map((p) => {
                const PerIcon = p.clv >= 0 ? ArrowUpRight : ArrowDownRight;
                const perColour = p.clv >= 0 ? "text-emerald-300" : "text-rose-300";
                return (
                  <tr
                    key={p.matchId}
                    className="border-t border-white/[0.04] text-foreground/90"
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
                      {fmtDate(p.date)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {p.homeName} v {p.awayName}
                    </td>
                    <td className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${perColour}`}>
                      <span className="inline-flex items-center gap-0.5">
                        <PerIcon className="size-3" />
                        {fmtSigned(p.clv)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-foreground">
                      {fmtSigned(p.cumClv)}
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

// ── Per-market breakdown ─────────────────────────────────────────────────────
//
// For WC2026 we only run 1X2 today — no OU/BTTS coverage. The card exists so
// the page structure matches the brief; we render a one-row "1X2" line and a
// "Coming soon" stub for OU/BTTS so visitors know what's coming.

function MarketBreakdown({ series }: { series: CLVPoint[] }) {
  const n = series.length;
  const avgClv = n > 0 ? series.reduce((s, p) => s + p.clv, 0) / n : null;
  const beat = series.filter((p) => p.clv > 0).length;

  const rows: Array<{ market: string; n: number; avg: number | null; beat: number | null; note: string }> = [
    {
      market: "1X2 (match result)",
      n,
      avg: avgClv,
      beat: n > 0 ? beat : null,
      note: "All WC2026 settled fixtures with model + market.",
    },
    {
      market: "Over/Under 2.5",
      n: 0,
      avg: null,
      beat: null,
      note: "Not yet modelled for WC — national-team OU model under design.",
    },
    {
      market: "Both Teams to Score",
      n: 0,
      avg: null,
      beat: null,
      note: "Not yet modelled for WC — national-team BTTS model under design.",
    },
  ];

  return (
    <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
      <header className="mb-3">
        <h2 className="text-sm font-bold text-foreground sm:text-base">
          Per-market breakdown
        </h2>
        <p className="text-[10px] text-muted-foreground sm:text-xs">
          Each market scored independently. For WC2026 we only ship 1X2 today.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] sm:text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-3 font-semibold">Market</th>
              <th className="px-2 py-1.5 text-right font-semibold">N</th>
              <th className="px-2 py-1.5 text-right font-semibold">Avg CLV</th>
              <th className="px-2 py-1.5 text-right font-semibold">Beat market</th>
              <th className="px-2 py-1.5 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const toneClass =
                r.avg == null
                  ? "text-muted-foreground/60"
                  : r.avg >= 0
                  ? "text-emerald-300"
                  : "text-rose-300";
              return (
                <tr key={r.market} className="border-t border-white/[0.04]">
                  <td className="py-1.5 pr-3 text-foreground">{r.market}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                    {r.n}
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${toneClass}`}>
                    {fmtSigned(r.avg)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                    {r.beat == null ? "—" : `${r.beat}/${r.n}`}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.note}</td>
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
            <strong className="font-semibold text-foreground">CLV = (model&apos;s prob on the actual outcome) − (market&apos;s prob on the actual outcome).</strong>{" "}
            &gt;0 means we leaned the right way harder than the market. &lt;0 means
            the market was sharper than us on that fixture.
          </p>
          <p>
            We sum across settled fixtures in chronological order to draw the
            cumulative line. The chart only includes matches where both our
            model and the vig-removed market consensus had a row — that&apos;s the
            apples-to-apples pool.
          </p>
          <p>
            Market source: <code className="rounded bg-white/[0.04] px-1 py-0.5 text-[10px]">wc_market_consensus</code>{" "}
            (average of Pinnacle / FotMob etc., vig-removed). Model source:
            whichever of <code className="rounded bg-white/[0.04] px-1 py-0.5 text-[10px]">national_team_v1</code> or{" "}
            <code className="rounded bg-white/[0.04] px-1 py-0.5 text-[10px]">national_team_v1_blended</code>{" "}
            is available (blended wins when both exist) — same logic as the
            Summary page.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function WCPredictionsCLVPage() {
  const series = await loadCLVSeries();

  // JSON-LD: WebPage schema. Identifies this as a CLV-vs-market analysis page.
  const SITE = "https://oddsintel.app";
  const pageUrl = `${SITE}/world-cup/predictions-record/clv`;
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "OddsIntel WC2026 CLV vs Market",
    description:
      "Cumulative closing line value of OddsIntel's WC2026 model against the vig-removed market consensus. Every settled match, in order.",
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
      <Hero series={series} />

      <WCRecordSubNav active="clv" />

      {series.length === 0 ? (
        <PreTournamentPlaceholder />
      ) : (
        <>
          <SummaryCards series={series} />
          <CLVChart series={series} />
          <MarketBreakdown series={series} />
        </>
      )}

      <MethodologyNote />
    </div>
  );
}
