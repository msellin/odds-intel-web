export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Clock, Goal, Scale, TriangleAlert } from "lucide-react";
import { requireSuperadmin } from "@/lib/admin-auth";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { familyOfBot, familyOfModel, LEVEL_BAND, loadModels, tradesMarket, type AccuracyRow, type ModelsData } from "@/lib/admin-models";
import { PageHeader } from "@/components/oi/panel";
import { AnswerStrip, type Answer } from "@/components/oi/answer-strip";
import { timeAgo } from "@/lib/rel-time";
import { ModelsView } from "./models-view";

// /admin/models ([[#153]], 2026-09-26). The owner's three questions, on one page:
//   1. Which MODELS are in production, and how good is each one right now (forward, on settled matches)?
//   2. Which BOT uses which model, with which rule, and how is it doing?
//   3. When did a bot's rule or model last change?
// Read-only. Data: src/lib/admin-models.ts (service role, server only). The accuracy numbers are
// computed by the engine's daily job model_accuracy (02:40 UTC) — no heavy SQL in this request.

export const metadata: Metadata = { title: "Models · Admin · OddsIntel", robots: { index: false } };

const ll = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(3));

function best(rows: AccuracyRow[], pred: (r: AccuracyRow) => boolean): AccuracyRow | null {
  return rows.filter(pred).sort((a, b) => b.n - a.n)[0] ?? null;
}

function answers(d: ModelsData): Answer[] {
  const acc = d.accuracy.rows.filter((r) => r.win === "30d");
  const out: Answer[] = [];
  const botsOn = (fam: string, market: string) =>
    d.config.rows.filter(
      (c) =>
        familyOfBot(c.prob_source) === fam &&
        tradesMarket((c.markets ?? []).join(","), market) &&
        d.bots.rows.some((b) => b.name === c.bot_name && !b.retired_at),
    ).length;

  const np = best(acc, (r) => familyOfModel(r.model) === "newplus" && r.market === "1x2");
  if (np && np.pin_logloss != null && np.logloss_pin_rows != null) {
    const gap = np.pin_logloss - np.logloss_pin_rows;
    out.push({
      label: "New 1X2 model",
      text:
        gap > LEVEL_BAND
          ? `Beating Pinnacle (${ll(np.logloss_pin_rows)} vs ${ll(np.pin_logloss)})`
          : gap >= -LEVEL_BAND
            ? `Level with Pinnacle (${ll(np.logloss_pin_rows)} vs ${ll(np.pin_logloss)})`
            : `Behind Pinnacle (${ll(np.logloss_pin_rows)} vs ${ll(np.pin_logloss)})`,
      sub: `Last 30 days, ${np.pin_n} matches both priced · ${botsOn("newplus", "1x2")} bots use it`,
      tone: gap >= -LEVEL_BAND ? "success" : "info",
      icon: Scale,
      href: "#models",
    });
  }
  const ens = best(acc, (r) => familyOfModel(r.model) === "ensemble" && r.market === "1x2");
  if (ens && ens.base_logloss != null) {
    const worse = ens.logloss > ens.base_logloss;
    out.push({
      label: "Old 1X2 model",
      text: worse ? "Worse than guessing on recent matches" : "Better than guessing",
      sub: `${ens.model}: ${ll(ens.logloss)} vs ${ll(ens.base_logloss)} guessing, ${ens.n.toLocaleString("en-GB")} matches · ${botsOn("ensemble", "1x2")} bots still use it`,
      tone: worse ? "danger" : "success",
      icon: TriangleAlert,
      href: "#bots",
    });
  }
  const ou = best(acc, (r) => r.model === "O/U combined ou_comb_v1 (served)" && r.market === "over_under_25");
  if (ou && ou.pin_logloss != null && ou.logloss_pin_rows != null) {
    const gap = ou.pin_logloss - ou.logloss_pin_rows;
    out.push({
      label: "Goals model (2.5)",
      text: gap > LEVEL_BAND ? "Beating Pinnacle" : gap >= -LEVEL_BAND ? "Level with Pinnacle" : "Behind Pinnacle",
      sub: `${ll(ou.logloss_pin_rows)} vs Pinnacle ${ll(ou.pin_logloss)} on ${ou.pin_n} matches (30 days)`,
      tone: gap >= -LEVEL_BAND ? "info" : "warning",
      icon: Goal,
      href: "#models",
    });
  }
  const stamps = d.accuracy.rows.map((r) => r.computed_at).filter((x): x is string => !!x).sort();
  const last = stamps[stamps.length - 1];
  const ageH = last ? (d.now - new Date(last).getTime()) / 3_600_000 : null;
  out.push({
    label: "Scorecard",
    text: d.accuracy.error ? "Could not be read" : !last ? "Not computed yet — first run 02:40 UTC" : ageH! > 30 ? `Stale — last run ${timeAgo(last, d.now)}` : `Updated ${timeAgo(last, d.now)}`,
    sub: "Recomputed daily at 02:40 UTC from settled matches",
    tone: d.accuracy.error || (ageH != null && ageH > 30) ? "warning" : "neutral",
    icon: Clock,
  });
  return out;
}

export default async function ModelsPage() {
  if (!isBotBoardDevPreview()) {
    const gate = await requireSuperadmin();
    if ("error" in gate) {
      return (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          {gate.status === 403 ? "Superadmin only." : "Access denied."}
        </div>
      );
    }
  }
  const d = await loadModels();
  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Bots & money"
        title="Models"
        meta="Every probability source the bots price from, how accurate it has been on settled matches, which bot uses it, and when each bot's rule or model changed. Read-only."
      />
      <AnswerStrip answers={answers(d)} />
      <ModelsView d={d} />
    </div>
  );
}
