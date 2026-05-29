import { Zap, Equal, AlertTriangle } from "lucide-react";
import type { MatchValueBet } from "@/lib/engine-data";

interface Props {
  valueBet: MatchValueBet | null;
  homeTeam: string;
  awayTeam: string;
  matchStatus: string;
  /** Model probabilities from publicMatch (0-100) */
  modelHome?: number | null;
  modelDraw?: number | null;
  modelAway?: number | null;
  /** Best market odds */
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  isPro: boolean;
}

function selectionLabel(selection: string, market: string, home: string, away: string): string {
  const sel = selection.toLowerCase();
  if (market === "1x2" || market === "match_winner" || market === "1x2_home" || market === "1x2_draw" || market === "1x2_away") {
    if (sel === "home" || sel === home.toLowerCase()) return home;
    if (sel === "draw") return "Draw";
    if (sel === "away" || sel === away.toLowerCase()) return away;
  }
  if (market?.startsWith("over_under")) {
    if (sel.includes("over")) return `O${market.replace(/\D/g, "").replace(/^(\d)(\d)$/, "$1.$2")}`;
    if (sel.includes("under")) return `U${market.replace(/\D/g, "").replace(/^(\d)(\d)$/, "$1.$2")}`;
  }
  return selection.charAt(0).toUpperCase() + selection.slice(1);
}

function marketLabel(market: string): string {
  if (market === "1x2" || market === "match_winner") return "1X2";
  if (market?.startsWith("over_under")) return "O/U";
  if (market?.includes("asian_handicap")) return "AH";
  if (market?.includes("btts")) return "BTTS";
  return market;
}

export function MatchVerdictCard({
  valueBet,
  homeTeam,
  awayTeam,
  matchStatus,
  modelHome,
  modelDraw,
  modelAway,
  bestHome,
  bestDraw,
  bestAway,
  isPro,
}: Props) {
  if (matchStatus === "finished") return null;

  // ── Value found state ──────────────────────────────────────────────────────
  if (valueBet) {
    const sel = selectionLabel(valueBet.selection, valueBet.market, homeTeam, awayTeam);
    const mktLabel = marketLabel(valueBet.market);
    const edgePp = (valueBet.edge * 100).toFixed(0);

    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 space-y-3">
        {/* Headline */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 shrink-0 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">
              Value · {sel} {mktLabel !== "1X2" ? `(${mktLabel})` : ""}
            </span>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
              +{edgePp}pp
            </span>
          </div>
        </div>

        {/* Odds + bookmaker row */}
        {isPro ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-card/60 px-3 py-2">
            <span className="font-mono text-lg font-bold text-foreground">{valueBet.odds.toFixed(2)}</span>
            {valueBet.bookmaker && (
              <span className="text-xs text-muted-foreground">@ {valueBet.bookmaker}</span>
            )}
            <div className="ml-auto text-right">
              <div className="font-mono text-sm font-bold text-foreground">€{valueBet.stake.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">Kelly stake</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/40 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">PRO</span>
              Odds, bookmaker &amp; Kelly stake
            </div>
          </div>
        )}

        {/* Model vs market probs — shown when we have matching model data */}
        {modelHome != null && modelDraw != null && modelAway != null && (
          <ModelVsMarket
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            modelHome={modelHome}
            modelDraw={modelDraw}
            modelAway={modelAway}
            bestHome={bestHome}
            bestDraw={bestDraw}
            bestAway={bestAway}
            valueSide={valueBet.selection.toLowerCase()}
          />
        )}
      </div>
    );
  }

  // ── No value state ─────────────────────────────────────────────────────────
  // Only show "no value" verdict for pre-match; skip if no model data at all
  if (!modelHome || !modelDraw || !modelAway) return null;

  const rawHome = 1 / (bestHome || 99);
  const rawDraw = 1 / (bestDraw || 99);
  const rawAway = 1 / (bestAway || 99);
  const total = rawHome + rawDraw + rawAway;
  const impliedHome = (rawHome / total) * 100;
  const impliedDraw = (rawDraw / total) * 100;
  const impliedAway = (rawAway / total) * 100;

  const maxEdge = Math.max(
    modelHome - impliedHome,
    modelDraw - impliedDraw,
    modelAway - impliedAway,
  );

  // Only show "no value" card when model data exists and gap is small (<3pp)
  if (maxEdge >= 3) return null;

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Equal className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Fairly priced — no single-side edge</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Model and market agree on probabilities for this match. No outcome shows enough edge to warrant a bet. Intelligence signals are still available on the INTEL tab.
      </p>
    </div>
  );
}

// Compact 3-row model vs market comparison inside the verdict card
function ModelVsMarket({
  homeTeam,
  awayTeam,
  modelHome,
  modelDraw,
  modelAway,
  bestHome,
  bestDraw,
  bestAway,
  valueSide,
}: {
  homeTeam: string;
  awayTeam: string;
  modelHome: number;
  modelDraw: number;
  modelAway: number;
  bestHome: number;
  bestDraw: number;
  bestAway: number;
  valueSide: string;
}) {
  const rawH = 1 / bestHome, rawD = 1 / bestDraw, rawA = 1 / bestAway;
  const tot = rawH + rawD + rawA;
  const mktH = (rawH / tot) * 100;
  const mktD = (rawD / tot) * 100;
  const mktA = (rawA / tot) * 100;

  const rows = [
    { label: homeTeam, model: modelHome, market: mktH, isValue: valueSide === "home" || valueSide === homeTeam.toLowerCase() },
    { label: "Draw", model: modelDraw, market: mktD, isValue: valueSide === "draw" },
    { label: awayTeam, model: modelAway, market: mktA, isValue: valueSide === "away" || valueSide === awayTeam.toLowerCase() },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 pb-1">
        <span>Outcome</span>
        <div className="flex gap-4">
          <span className="text-violet-400/70">Model</span>
          <span>Market</span>
          <span>Gap</span>
        </div>
      </div>
      {rows.map((r) => {
        const gap = r.model - r.market;
        return (
          <div key={r.label} className={`flex items-center justify-between text-xs ${r.isValue ? "text-foreground" : "text-muted-foreground"}`}>
            <span className="truncate max-w-[120px]">{r.label}</span>
            <div className="flex gap-4 font-mono">
              <span className="w-8 text-right text-violet-400/80">{r.model.toFixed(0)}%</span>
              <span className="w-8 text-right">{r.market.toFixed(0)}%</span>
              <span className={`w-10 text-right font-bold ${gap > 0 ? "text-emerald-400" : gap < -1 ? "text-rose-400" : "text-muted-foreground/40"}`}>
                {gap > 0 ? "+" : ""}{gap.toFixed(0)}pp
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
