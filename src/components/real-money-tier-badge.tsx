/**
 * REAL-MONEY-TIER badge (2026-06-06) — operator-only signal on /admin/place.
 *
 * Prescriptive framing ("Bet / Cautious / Paper only") is appropriate here
 * because the operator is making decisions for THEIR own money. The same
 * underlying tier object can later drive a descriptive public badge on
 * /value-bets (filed as PUBLIC-MATURITY-BADGE) where prescription is unsafe.
 */
"use client";

import type { RealMoneyTier, ModelTierKind, BotTierKind } from "@/lib/real-money-tier";

const OVERALL_STYLE: Record<RealMoneyTier["overall"], { label: string; cls: string }> = {
  bet:      { label: "✅ Bet",        cls: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40" },
  cautious: { label: "🟡 Cautious",   cls: "bg-amber-900/30 text-amber-300 border-amber-700/40" },
  paper:    { label: "🔬 Paper only", cls: "bg-slate-800/60 text-slate-400 border-slate-700/40" },
};

const MODEL_LABEL: Record<ModelTierKind, string> = {
  mature:        "Mature",
  established:   "Established",
  new:           "Calibrated · new",
  partial:       "Partial",
  "under-study": "Under study",
  experimental:  "Experimental",
};

const BOT_LABEL: Record<BotTierKind, string> = {
  proven:   "Proven",
  building: "Building",
  thin:     "Thin sample",
  losing:   "Losing",
};

function fmtPct(n: number | null, signed = false): string {
  if (n == null) return "—";
  const v = n * 100;
  return signed ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : `${v.toFixed(1)}%`;
}

export function RealMoneyTierBadge({ tier }: { tier: RealMoneyTier }) {
  const style = OVERALL_STYLE[tier.overall];

  // Build the hover text — every line is a fact, not a recommendation.
  const lines: string[] = [];
  lines.push(`Model: ${MODEL_LABEL[tier.model.kind]}`);
  if (tier.model.kind !== "experimental") {
    lines.push(`  ECE ${fmtPct(tier.model.eceAfter)} · n=${tier.model.sampleCount} · fit ${Math.round(tier.model.daysOld ?? 0)}d ago`);
  }
  lines.push(`Bot: ${BOT_LABEL[tier.bot.kind]}`);
  lines.push(`  CLV ${fmtPct(tier.bot.clv, true)} · ROI ${fmtPct(tier.bot.roi, true)} · ${tier.bot.settledBets} settled (60d)`);
  if (tier.betFlags.length > 0) {
    lines.push(`Warnings:`);
    for (const f of tier.betFlags) lines.push(`  • ${f}`);
  }

  return (
    <span
      title={lines.join("\n")}
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${style.cls}`}
    >
      {style.label}
    </span>
  );
}
