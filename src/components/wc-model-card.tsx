/**
 * WC-B1-B4 — per-fixture model card.
 *
 * Lives above the tabs on the WC2026 match-detail page (between the WP curve
 * and the tab strip). Every site shows probabilities; this card shows *why*
 * and where our model disagrees with the market.
 *
 * Composition:
 *   • Header — "OddsIntel Model — {Home} vs {Away}" + confidence band tag
 *               (HIGH ≥60% / MED 40-60% / LOW <40% on the favourite).
 *   • Three stacked rows: Our model · Market consensus · OddsIntel blend.
 *     Each row reuses the shared ProbBar + ProbNumbersRow primitives so the
 *     visual grammar matches the schedule + bracket UIs. Missing data
 *     renders a muted "X data unavailable" pill — never a silent gap.
 *   • Disagreement callout — fires when the model and market disagree on
 *     who the favourite is, OR when they agree but the favourite-prob gap
 *     is ≥10pp. Amber tone for 10-15pp, red tone above that.
 *   • Feature-attribution sidebar — top three drivers placeholder pending
 *     the Wave-2 feature-importance backend; until then we surface generic
 *     ELO / form / availability lines so the card doesn't ship empty.
 *   • Methodology footer — explains the 70% cap + the λ blend.
 *
 * Server component on purpose — every input arrives via props from the
 * page-level loader. No hover or local state lives here.
 */

import { TrendingUp, Activity, ShieldAlert, AlertTriangle, Info } from "lucide-react";

import {
  ProbBar,
  ProbNumbersRow,
  AiPickPill,
} from "@/components/wc-prob-display";
import { displayProb } from "@/lib/probability-display";
import {
  confidenceBand,
  pickFromTriple,
  probOnPick,
  type ModelCardData,
  type ModelCardTriple,
} from "@/lib/wc-model-card-data";

interface WCModelCardProps {
  homeTeam: string;
  awayTeam: string;
  data: ModelCardData;
}

const MIN_SOURCES_FOR_FULL_LAMBDA = 3;
const FULL_LAMBDA = 0.6;

function teamFromPick(pick: "1" | "X" | "2", home: string, away: string): string {
  if (pick === "1") return home;
  if (pick === "2") return away;
  return "Draw";
}

function bandClass(band: "HIGH" | "MED" | "LOW"): string {
  if (band === "HIGH") {
    return "bg-[color:var(--color-tournament-green)]/15 text-[color:var(--color-tournament-green)]";
  }
  if (band === "MED") {
    return "bg-[color:var(--color-tournament-gold)]/15 text-[color:var(--color-tournament-gold)]";
  }
  return "bg-white/[0.06] text-muted-foreground";
}

function scaledLambda(nSources: number | undefined): number {
  if (!nSources || nSources <= 0) return 0;
  if (nSources >= MIN_SOURCES_FOR_FULL_LAMBDA) return FULL_LAMBDA;
  // Scale linearly down toward zero when fewer than 3 market sources agree —
  // mirrors the engine-side `scripts/write_blended_predictions.py` policy.
  return FULL_LAMBDA * (nSources / MIN_SOURCES_FOR_FULL_LAMBDA);
}

interface DisagreementInfo {
  ownPick: "1" | "X" | "2";
  marketPick: "1" | "X" | "2";
  ownTopProb: number;
  marketProbOnOwnPick: number;
  gapPp: number;
  intensity: "amber" | "red";
}

function detectDisagreement(
  own: ModelCardTriple,
  market: ModelCardTriple
): DisagreementInfo | null {
  const ownPick = pickFromTriple(own);
  const marketPick = pickFromTriple(market);
  const ownTopProb = probOnPick(own, ownPick);
  const marketProbOnOwnPick = probOnPick(market, ownPick);
  const gapPp = Math.round((ownTopProb - marketProbOnOwnPick) * 100);
  const differentTeam = ownPick !== marketPick;
  const bigGap = Math.abs(gapPp) >= 10;
  if (!differentTeam && !bigGap) return null;
  const intensity: "amber" | "red" = Math.abs(gapPp) >= 15 || differentTeam ? "red" : "amber";
  return { ownPick, marketPick, ownTopProb, marketProbOnOwnPick, gapPp, intensity };
}

function ProbRow({
  label,
  triple,
  homeTeam,
  awayTeam,
  emphasis,
  caption,
  unavailableLabel,
}: {
  label: string;
  triple: ModelCardTriple | null;
  homeTeam: string;
  awayTeam: string;
  emphasis?: "gold" | "none";
  caption?: string | null;
  unavailableLabel: string;
}) {
  const wrapperClass = emphasis === "gold"
    ? "rounded-lg border border-[color:var(--color-tournament-gold)]/30 bg-[color:var(--color-tournament-gold)]/[0.04] p-3"
    : "rounded-lg border border-white/[0.05] bg-white/[0.015] p-3";

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {triple && (
          <AiPickPill
            pick={pickFromTriple(triple)}
            homeName={homeTeam}
            awayName={awayTeam}
          />
        )}
      </div>
      {triple ? (
        <div className="mt-2 space-y-1.5">
          <ProbBar home={triple.home} draw={triple.draw} away={triple.away} />
          <ProbNumbersRow home={triple.home} draw={triple.draw} away={triple.away} />
          {caption && (
            <p className="pt-0.5 text-[10px] text-muted-foreground/70">{caption}</p>
          )}
        </div>
      ) : (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-muted-foreground/80">
          <Info className="size-3" />
          {unavailableLabel}
        </div>
      )}
    </div>
  );
}

function DisagreementCallout({
  info,
  own,
  market,
  homeTeam,
  awayTeam,
  reasoning,
}: {
  info: DisagreementInfo;
  own: ModelCardTriple;
  market: ModelCardTriple;
  homeTeam: string;
  awayTeam: string;
  reasoning: string | null;
}) {
  const palette =
    info.intensity === "red"
      ? "border-red-500/30 bg-red-500/[0.06] text-red-200"
      : "border-amber-500/30 bg-amber-500/[0.06] text-amber-200";
  const iconClass =
    info.intensity === "red" ? "text-red-400" : "text-amber-400";

  const ownTeam = teamFromPick(info.ownPick, homeTeam, awayTeam);
  const marketTeam = teamFromPick(info.marketPick, homeTeam, awayTeam);
  const ownProbText = displayProb(info.ownTopProb);
  const marketTopProb = probOnPick(market, info.marketPick);
  const marketProbText = displayProb(marketTopProb);
  // The "we disagree because" pulls the reasoning JSON's first non-empty
  // string. When the engine doesn't ship a reasoning string yet, fall back
  // to a generic explainer that points at the feature drivers below.
  const explanation = reasoning?.trim()
    ? reasoning.trim()
    : "Our ELO + Poisson model weights recent international form and squad availability differently than the public market — see the drivers below.";

  return (
    <div
      role="note"
      aria-label="Model vs market disagreement"
      className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${palette}`}
    >
      <div className="flex items-start gap-2">
        {info.intensity === "red" ? (
          <ShieldAlert className={`mt-0.5 size-3.5 shrink-0 ${iconClass}`} />
        ) : (
          <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${iconClass}`} />
        )}
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            {info.ownPick === info.marketPick
              ? `Our model agrees on ${ownTeam} but is more confident (${ownProbText} vs market ${displayProb(probOnPick(market, info.ownPick))}).`
              : `Our model leans ${ownTeam} (${ownProbText}), market favours ${marketTeam} (${marketProbText}).`}
          </p>
          <p className="text-[11px] text-foreground/75">{explanation}</p>
        </div>
      </div>
      {/* Tiny aria-only descriptor so screen-readers get the exact gap. */}
      <span className="sr-only">
        Top-pick gap: {info.gapPp} percentage points. Own home {Math.round(own.home * 100)}%, market home {Math.round(market.home * 100)}%.
      </span>
    </div>
  );
}

function FeatureDriversSidebar() {
  // Wave-2 will swap these placeholders for engine-fed drivers (top 3 by
  // |feature_importance|). For now we surface the canonical national-team
  // model drivers so the card always renders something useful.
  const drivers: Array<{ icon: React.ReactNode; label: string; detail: string }> = [
    {
      icon: <TrendingUp className="size-3.5 text-[color:var(--color-tournament-green)]" />,
      label: "ELO gap",
      detail: "International ELO differential drives the base prior.",
    },
    {
      icon: <Activity className="size-3.5 text-[color:var(--color-tournament-gold)]" />,
      label: "Recent form",
      detail: "Last 10 internationals weighted by opponent quality.",
    },
    {
      icon: <ShieldAlert className="size-3.5 text-muted-foreground" />,
      label: "Key absentees",
      detail: "Confirmed unavailables (suspensions, injuries) — refreshes at T-60.",
    },
  ];

  return (
    <aside
      aria-label="Top model drivers"
      className="space-y-2 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Top drivers
      </h3>
      <ul className="space-y-1.5">
        {drivers.map((d) => (
          <li key={d.label} className="flex items-start gap-2 text-[11px]">
            <span className="mt-0.5 shrink-0">{d.icon}</span>
            <span className="text-foreground/85">
              <span className="font-semibold text-foreground">{d.label}</span>
              <span className="text-muted-foreground"> — {d.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function WCModelCard({ homeTeam, awayTeam, data }: WCModelCardProps) {
  const { own, blended, lineup, market, reasoning } = data;

  // Header band uses the "primary" triple in priority order:
  // lineup (T-60 freshest) → blended → own. If nothing is present, show LOW.
  const primaryTriple = lineup ?? blended ?? own;
  const band = primaryTriple ? confidenceBand(primaryTriple) : "LOW";
  const bandTag = primaryTriple ? band : "PENDING";

  // Disagreement only fires when we actually have both rows. The blended row
  // is excluded from this check — it's literally a mix of the two.
  const disagreement = own && market ? detectDisagreement(own, market) : null;

  const lambda = scaledLambda(market?.nSources);
  const blendCaption = market && market.nSources > 0
    ? `λ=${lambda.toFixed(2)} (${(lambda * 100).toFixed(0)}% market / ${((1 - lambda) * 100).toFixed(0)}% own, ${market.nSources} market ${market.nSources === 1 ? "source" : "sources"})`
    : "λ=0 until market data lands";

  const lineupCaption = lineup
    ? "Refreshed at T-60 after lineups dropped."
    : null;

  return (
    <section
      aria-label={`OddsIntel model card for ${homeTeam} versus ${awayTeam}`}
      className="rounded-xl border border-border/50 bg-card p-4 sm:p-5"
    >
      {/* Header — title + confidence tag */}
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-foreground sm:text-base">
            OddsIntel Model — {homeTeam} vs {awayTeam}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Per-fixture 1X2 with market context.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${bandClass(band)}`}
        >
          {bandTag} confidence
        </span>
      </header>

      {/* Body: two-column on desktop (rows | sidebar), stacked on mobile */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
        <div className="space-y-2.5">
          <ProbRow
            label="Our model"
            triple={own}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            unavailableLabel="Our model hasn't graded this fixture yet"
          />
          <ProbRow
            label="Market consensus"
            triple={market}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            caption={market && market.nSources > 0
              ? `${market.nSources} market ${market.nSources === 1 ? "source" : "sources"} averaged.`
              : null}
            unavailableLabel="Market data unavailable"
          />
          <ProbRow
            label="OddsIntel blended pick"
            triple={blended}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            emphasis="gold"
            caption={blendCaption}
            unavailableLabel="Blended pick pending — needs both own + market rows"
          />
          {lineup && (
            <ProbRow
              label="Lineup-adjusted (T-60)"
              triple={lineup}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              caption={lineupCaption}
              unavailableLabel="Lineup-adjusted prediction not yet available"
            />
          )}

          {disagreement && own && market && (
            <DisagreementCallout
              info={disagreement}
              own={own}
              market={market}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              reasoning={reasoning}
            />
          )}
        </div>

        <FeatureDriversSidebar />
      </div>

      {/* Methodology footer */}
      <footer className="mt-3 border-t border-white/[0.05] pt-2.5 text-[10px] leading-relaxed text-muted-foreground/80">
        Probabilities cap at 70% per CALIBRATION-DISPLAY-CAP. Blend uses λ=0.6
        (60% market / 40% own) when ≥3 market sources are present; scaled down
        proportionally when fewer sources are available.
      </footer>
    </section>
  );
}
