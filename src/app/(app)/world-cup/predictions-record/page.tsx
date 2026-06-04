export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import {
  Trophy,
  Activity,
  Target,
  CheckCircle2,
  XCircle,
  Info,
  CalendarClock,
} from "lucide-react";

import {
  loadRecord,
  type RecordRow,
  type RecordSummary,
  type CalibrationBucket,
} from "@/lib/wc-record";
import { WC_FIRST_KICKOFF_ISO } from "@/lib/world-cup";
import { WCRecordSubNav } from "@/components/wc-record-subnav";

// ── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "OddsIntel WC2026 Predictions Record — Brier, Log-Loss, CLV | OddsIntel",
  description:
    "How OddsIntel's FIFA World Cup 2026 model is doing — every settled match, our pick vs the market, Brier score, log-loss, calibration plot, and a no-hiding hit/miss log.",
  alternates: { canonical: "https://oddsintel.app/world-cup/predictions-record" },
  openGraph: {
    title: "OddsIntel WC2026 Predictions Record",
    description:
      "Brier, log-loss, CLV vs market, full hit/miss log. Every WC2026 prediction tracked publicly.",
    url: "https://oddsintel.app/world-cup/predictions-record",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OddsIntel WC2026 Predictions Record",
    description: "Brier, log-loss, CLV vs market, full hit/miss log.",
  },
};

// ── Small formatters ─────────────────────────────────────────────────────────

function fmtPct(p: number | null, digits = 0): string {
  if (p == null || !isFinite(p)) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

function fmt3(p: number | null): string {
  if (p == null || !isFinite(p)) return "—";
  return p.toFixed(3);
}

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

function pickLabel(
  pick: "1" | "X" | "2" | null,
  homeName: string,
  awayName: string
): string {
  if (pick === "1") return homeName;
  if (pick === "2") return awayName;
  if (pick === "X") return "Draw";
  return "—";
}

function confidenceForPick(
  pick: "1" | "X" | "2" | null,
  triple: { home: number; draw: number; away: number } | null
): number | null {
  if (!pick || !triple) return null;
  if (pick === "1") return triple.home;
  if (pick === "X") return triple.draw;
  return triple.away;
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ summary }: { summary: RecordSummary | null }) {
  const headline = (() => {
    if (!summary || summary.nSettled === 0) {
      return "Public, honest record of every WC2026 prediction we make.";
    }
    const parts: string[] = [];
    if (summary.favouritesTotal > 0) {
      parts.push(
        `${summary.favouritesCalled}/${summary.favouritesTotal} favourites called`
      );
    } else if (summary.modelN > 0) {
      parts.push(`${summary.modelHits}/${summary.modelN} picks right`);
    }
    if (summary.modelBrier != null && summary.marketBrier != null) {
      parts.push(
        `Brier ${fmt3(summary.modelBrier)} vs market ${fmt3(summary.marketBrier)}`
      );
    } else if (summary.modelBrier != null) {
      parts.push(`Brier ${fmt3(summary.modelBrier)}`);
    }
    return parts.length > 0
      ? `OddsIntel WC2026 model: ${parts.join(", ")}.`
      : "Public, honest record of every WC2026 prediction we make.";
  })();

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:rounded-2xl sm:p-7">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[color:var(--color-tournament-gold)]/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Target className="size-3.5 text-[color:var(--color-tournament-gold)] sm:size-4" />
          <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
            Predictions record
          </span>
        </div>
        <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-foreground sm:text-3xl">
          How OddsIntel&apos;s WC predictions are doing
        </h1>
        <p className="mt-2 max-w-xl text-xs text-muted-foreground sm:text-sm">
          {headline}
        </p>
        <p className="mt-2 max-w-xl text-[11px] text-muted-foreground/80 sm:text-xs">
          Every settled WC2026 fixture below. We don&apos;t hide losses — if our model called it wrong, you&apos;ll see it.
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

// ── Empty-state placeholder ──────────────────────────────────────────────────

function PreTournamentPlaceholder() {
  const kickoffIso = WC_FIRST_KICKOFF_ISO;
  const kickoffDate = new Date(kickoffIso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <section className="rounded-2xl border border-dashed border-white/[0.10] bg-card/30 p-8 text-center sm:p-12">
      <CalendarClock className="mx-auto size-10 text-muted-foreground/40" />
      <h2 className="mt-4 text-lg font-bold text-foreground sm:text-xl">
        0 matches settled — tournament starts {kickoffDate}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground sm:text-sm">
        This page populates one row at a time as WC2026 fixtures resolve. The
        first kick-off is Mexico v South Africa at the Estadio Azteca. Once it
        finishes, the hit/miss log, Brier vs market, and calibration plot all
        come to life here.
      </p>
      <p className="mx-auto mt-3 max-w-md text-[11px] text-muted-foreground/70 sm:text-xs">
        Why publish this? Because the only way to trust a model is to watch it
        being graded in the open — wins, losses, and the gap to the market.
      </p>
    </section>
  );
}

// ── Summary cards ────────────────────────────────────────────────────────────

function SummaryCards({ summary }: { summary: RecordSummary }) {
  const hitRate =
    summary.modelN > 0 ? summary.modelHits / summary.modelN : null;
  const marketHitRate =
    summary.marketN > 0 ? summary.marketHits / summary.marketN : null;

  // Pick deltas vs market for the small "vs market" sub-line under each card.
  const brierDelta =
    summary.modelBrier != null && summary.marketBrier != null
      ? summary.modelBrier - summary.marketBrier
      : null;
  const logDelta =
    summary.modelLogLoss != null && summary.marketLogLoss != null
      ? summary.modelLogLoss - summary.marketLogLoss
      : null;
  const hitDelta =
    hitRate != null && marketHitRate != null ? hitRate - marketHitRate : null;

  const cards: Array<{
    label: string;
    value: string;
    sub: string;
    tone: "ok" | "warn" | "neutral";
  }> = [
    {
      label: "Settled",
      value: String(summary.nSettled),
      sub:
        summary.modelN === summary.nSettled
          ? "all with own-model prediction"
          : `${summary.modelN} with our prediction`,
      tone: "neutral",
    },
    {
      label: "Hit rate",
      value:
        summary.modelN > 0
          ? `${summary.modelHits}/${summary.modelN}`
          : "—",
      sub:
        hitDelta != null
          ? `${fmtSigned(hitDelta)} vs market (${fmtPct(marketHitRate)})`
          : "market: —",
      tone:
        hitDelta == null ? "neutral" : hitDelta >= 0 ? "ok" : "warn",
    },
    {
      label: "Brier (lower better)",
      value: fmt3(summary.modelBrier),
      sub:
        summary.marketBrier != null
          ? `market ${fmt3(summary.marketBrier)}${
              brierDelta != null
                ? ` (Δ ${(brierDelta).toFixed(3)})`
                : ""
            }`
          : "market: —",
      // Lower Brier = better, so negative delta is good.
      tone:
        brierDelta == null ? "neutral" : brierDelta <= 0 ? "ok" : "warn",
    },
    {
      label: "Log-loss (lower better)",
      value: fmt3(summary.modelLogLoss),
      sub:
        summary.marketLogLoss != null
          ? `market ${fmt3(summary.marketLogLoss)}${
              logDelta != null ? ` (Δ ${(logDelta).toFixed(3)})` : ""
            }`
          : "market: —",
      tone: logDelta == null ? "neutral" : logDelta <= 0 ? "ok" : "warn",
    },
    {
      label: "CLV vs market",
      value: fmtSigned(summary.clv),
      sub:
        summary.bothN > 0
          ? `avg over ${summary.bothN} matches`
          : "no overlapping rows",
      tone:
        summary.clv == null ? "neutral" : summary.clv >= 0 ? "ok" : "warn",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
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

// ── Calibration plot (inline SVG, mobile-first, no chart library) ────────────

function CalibrationPlot({ buckets }: { buckets: CalibrationBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.count, 0);

  // SVG viewBox uses an abstract 100×80 unit grid; CSS sizes it responsively.
  // Layout:
  //   - 10 bar pairs across, 8 unit-wide slots each (1 unit padding L/R = 80 units of bars, leave 10 left + 10 right for axes/labels).
  //   - Each slot has TWO half-bars side by side: predicted prob (background) and actual hit-rate (foreground).
  //   - Diagonal reference line spans full width.
  const PAD_LEFT = 8;
  const PAD_RIGHT = 4;
  const PAD_TOP = 4;
  const PAD_BOTTOM = 12;
  const WIDTH = 100;
  const HEIGHT = 80;
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slotW = innerW / 10;
  const halfW = slotW * 0.42; // leave gap between pairs

  // Diagonal: x maps to bucket centre 0.05, 0.15 … 0.95 → predicted
  // = same x on y. The reference is "perfect calibration".
  const diagPoints = buckets.map((_, i) => {
    const centre = (i + 0.5) / 10;
    const x = PAD_LEFT + i * slotW + slotW / 2;
    const y = PAD_TOP + innerH * (1 - centre);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <section className="rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
      <header className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">
            Calibration plot
          </h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            10pp prob buckets — bars should track the diagonal when calibrated.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">
          {total} prob points
        </span>
      </header>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center text-xs text-muted-foreground">
          No prob points yet — buckets populate as matches settle with model rows.
        </div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="Calibration plot — predicted probability vs actual hit rate"
            className="block h-auto w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Y-axis ticks (0/.25/.5/.75/1) */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = PAD_TOP + innerH * (1 - t);
              return (
                <g key={t}>
                  <line
                    x1={PAD_LEFT}
                    y1={y}
                    x2={WIDTH - PAD_RIGHT}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeWidth="0.3"
                  />
                  <text
                    x={PAD_LEFT - 1.5}
                    y={y + 1.2}
                    textAnchor="end"
                    fontSize="3"
                    fill="currentColor"
                    opacity="0.4"
                  >
                    {Math.round(t * 100)}
                  </text>
                </g>
              );
            })}

            {/* Diagonal reference line — perfect calibration */}
            <polyline
              points={diagPoints.join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeDasharray="1.5 1.5"
              strokeWidth="0.6"
            />

            {/* Bars: predicted (cool) + actual (warm) per bucket */}
            {buckets.map((b, i) => {
              const baseX = PAD_LEFT + i * slotW + slotW / 2;
              const predTop = PAD_TOP + innerH * (1 - b.meanPredicted);
              const actTop = PAD_TOP + innerH * (1 - b.actualHitRate);
              const yFloor = PAD_TOP + innerH;
              const predH = Math.max(0, yFloor - predTop);
              const actH = Math.max(0, yFloor - actTop);
              return (
                <g key={i}>
                  {/* Predicted (left half) */}
                  <rect
                    x={baseX - halfW - 0.3}
                    y={predTop}
                    width={halfW}
                    height={predH}
                    fill="rgb(96 165 250)"
                    fillOpacity={b.count > 0 ? 0.6 : 0.15}
                  >
                    <title>
                      {`Bucket ${Math.round(b.lower * 100)}-${Math.round(
                        b.upper * 100
                      )}%: ${b.count} points, predicted mean ${fmtPct(
                        b.meanPredicted,
                        1
                      )}, actual ${fmtPct(b.actualHitRate, 1)}`}
                    </title>
                  </rect>
                  {/* Actual (right half) */}
                  <rect
                    x={baseX + 0.3}
                    y={actTop}
                    width={halfW}
                    height={actH}
                    fill="rgb(251 191 36)"
                    fillOpacity={b.count > 0 ? 0.75 : 0.15}
                  >
                    <title>
                      {`Bucket ${Math.round(b.lower * 100)}-${Math.round(
                        b.upper * 100
                      )}%: actual hit rate ${fmtPct(b.actualHitRate, 1)} (${b.count} points)`}
                    </title>
                  </rect>
                  {/* X tick */}
                  <text
                    x={baseX}
                    y={yFloor + 4}
                    textAnchor="middle"
                    fontSize="2.6"
                    fill="currentColor"
                    opacity="0.5"
                  >
                    {Math.round(b.lower * 100)}
                  </text>
                </g>
              );
            })}

            {/* Axis labels */}
            <text
              x={WIDTH / 2}
              y={HEIGHT - 1}
              textAnchor="middle"
              fontSize="3"
              fill="currentColor"
              opacity="0.55"
            >
              predicted probability (%)
            </text>
          </svg>

          {/* Legend + bucket count grid (responsive — table at sm+) */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-blue-400/70" />
              predicted (avg)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm bg-amber-400/80" />
              actual hit rate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-[2px] w-4 border-t border-dashed border-current opacity-50" />
              perfect calibration
            </span>
          </div>
        </>
      )}
    </section>
  );
}

// ── Hit/miss log ─────────────────────────────────────────────────────────────

function HitMissRow({ row }: { row: RecordRow }) {
  const modelConf = confidenceForPick(row.modelPick, row.model);
  const marketConf = confidenceForPick(row.marketPick, row.market);
  return (
    <li className="grid grid-cols-[auto_1fr] gap-3 border-b border-white/[0.04] px-3 py-3 last:border-0 sm:grid-cols-[60px_1fr_auto] sm:px-4">
      {/* Date */}
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-[11px]">
        {fmtDate(row.date)}
      </span>

      {/* Body: fixture + picks */}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {row.homeName} {row.scoreHome}–{row.scoreAway} {row.awayName}
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
          <span className="inline-flex items-center gap-1">
            {row.modelHit == null ? (
              <span className="text-muted-foreground/60">no model</span>
            ) : row.modelHit ? (
              <CheckCircle2 className="size-3 text-emerald-400" />
            ) : (
              <XCircle className="size-3 text-rose-400" />
            )}
            <span>
              <span className="text-muted-foreground/70">us:</span>{" "}
              <span
                className={
                  row.modelHit == null
                    ? "text-muted-foreground/60"
                    : "text-foreground"
                }
              >
                {pickLabel(row.modelPick, row.homeName, row.awayName)}
              </span>
              {modelConf != null && (
                <span className="ml-1 text-muted-foreground/70">
                  {fmtPct(modelConf, 0)}
                </span>
              )}
              {row.modelIsBlended && (
                <span className="ml-1 rounded-full bg-white/[0.04] px-1.5 py-0 text-[9px] uppercase tracking-wide text-muted-foreground ring-1 ring-white/[0.06]">
                  blended
                </span>
              )}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            {row.marketHit == null ? (
              <span className="text-muted-foreground/60">no market</span>
            ) : row.marketHit ? (
              <CheckCircle2 className="size-3 text-emerald-400/80" />
            ) : (
              <XCircle className="size-3 text-rose-400/80" />
            )}
            <span>
              <span className="text-muted-foreground/70">market:</span>{" "}
              <span
                className={
                  row.marketHit == null
                    ? "text-muted-foreground/60"
                    : "text-foreground"
                }
              >
                {pickLabel(row.marketPick, row.homeName, row.awayName)}
              </span>
              {marketConf != null && (
                <span className="ml-1 text-muted-foreground/70">
                  {fmtPct(marketConf, 0)}
                </span>
              )}
            </span>
          </span>
        </div>
      </div>

      {/* Actual outcome chip — right side on desktop, hidden on mobile (the score already tells the story) */}
      <span className="hidden shrink-0 self-center rounded-full border border-white/[0.06] bg-background/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-flex">
        actual:{" "}
        {row.actual === "1"
          ? "home"
          : row.actual === "2"
          ? "away"
          : "draw"}
      </span>
    </li>
  );
}

function HitMissLog({ rows }: { rows: RecordRow[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-card/40">
      <header className="flex items-end justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-bold text-foreground sm:text-base">
            Hit / miss log
          </h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            Every settled WC2026 match — newest first. Losses included.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground sm:text-xs">
          {rows.length} {rows.length === 1 ? "match" : "matches"}
        </span>
      </header>
      <ol className="max-h-[70vh] overflow-y-auto">
        {rows.map((r) => (
          <HitMissRow key={r.matchId} row={r} />
        ))}
      </ol>
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
            <strong className="font-semibold text-foreground">Methodology.</strong>{" "}
            For every settled WC2026 match, we record our model&apos;s 1X2 probability
            triple (sources <code className="rounded bg-white/[0.04] px-1 py-0.5 text-[10px]">national_team_v1</code> and{" "}
            <code className="rounded bg-white/[0.04] px-1 py-0.5 text-[10px]">national_team_v1_blended</code> — the blend with market wins when both exist), the market consensus distribution from{" "}
            <code className="rounded bg-white/[0.04] px-1 py-0.5 text-[10px]">wc_market_consensus</code>{" "}
            (avg of free public sources, vig-removed), and the actual outcome.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Brier score</strong>{" "}
            is the mean squared error between the predicted probability vector and
            the one-hot actual outcome (e.g. (0.55, 0.27, 0.18) vs (1, 0, 0) for a
            home win → 0.45² + 0.27² + 0.18² = 0.30). Lower is better. 0 means
            perfect; a uniform 1/3 guess scores ~0.667.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Log-loss</strong>{" "}
            is −log(p) on the eventual outcome, averaged over matches. Penalises
            confident wrong calls more than Brier does — a model assigning 1% to
            the eventual winner gets ~4.6 in that row alone.
          </p>
          <p>
            <strong className="font-semibold text-foreground">CLV vs market</strong>{" "}
            is the average difference between our probability and the market&apos;s
            probability on the actual outcome. Positive = we leaned the right way
            harder than the market. Computed only on matches where both rows exist.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Calibration plot</strong>{" "}
            buckets every predicted probability (3 per match — home / draw / away)
            into 10pp bins, then plots the bucket&apos;s mean prediction next to the
            bucket&apos;s actual hit rate. When the model is well-calibrated, the
            amber bars track the dashed diagonal.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function WCPredictionsRecordPage() {
  const { summary, byMatch, calibration } = await loadRecord();
  const settled = summary?.nSettled ?? 0;

  // JSON-LD: WebPage schema. Identifies this as a content page about our
  // WC2026 prediction record (not the tournament itself — that's /who-can-win).
  const SITE = "https://oddsintel.app";
  const pageUrl = `${SITE}/world-cup/predictions-record`;
  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "OddsIntel WC2026 Predictions Record",
    description:
      "Public, honest record of every WC2026 prediction OddsIntel makes — Brier, log-loss, calibration, and full hit/miss log.",
    url: pageUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "OddsIntel",
      url: SITE,
    },
    about: {
      "@type": "SportsEvent",
      name: "FIFA World Cup 2026",
      url: `${SITE}/world-cup`,
    },
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
      <Hero summary={summary} />

      <WCRecordSubNav active="summary" />

      {settled === 0 ? (
        <PreTournamentPlaceholder />
      ) : (
        <>
          {summary && <SummaryCards summary={summary} />}
          <CalibrationPlot buckets={calibration} />
          <HitMissLog rows={byMatch} />
        </>
      )}

      {/* Methodology is always shown — even pre-tournament — so visitors know
          what the page will compute once data arrives. */}
      <MethodologyNote />

      {/* Sentinel chip at the bottom — keeps the page visually grounded.
          Mirrors the small "Activity" tiles used elsewhere in the WC pages. */}
      <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70 sm:text-[11px]">
        <Activity className="size-3" />
        Updates automatically as matches settle.
      </p>
    </div>
  );
}
