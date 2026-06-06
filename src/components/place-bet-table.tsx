"use client";

import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { autoMinEdgeFor } from "@/lib/coolbet-edge";
import type { PlaceableBet } from "@/lib/engine-data";
import { RealMoneyTierBadge } from "@/components/real-money-tier-badge";

// PER-MARKET-EDGE-V2 (2026-06-06): per-row badge explaining whether the
// auto-placer would take this bet. Mirrors `coolbet_placer.py` gate order:
// already placed → pick edge < market floor → no event / no market →
// live edge < market floor. Market floors live in `autoMinEdgeFor()` —
// 1x2: 10%, o/u: 3%, AH: 5%, BTTS: 10%, DC: retired (∞).
function AutoPlaceStatusBadge({
  status,
  liveEdge,
  market,
}: {
  status: PlaceableBet["autoPlaceStatus"];
  liveEdge: number | null;
  market: string;
}) {
  const floor = autoMinEdgeFor(market);
  const isRetired = !Number.isFinite(floor);
  const floorLabel = isRetired ? "retired" : `${(floor * 100).toFixed(0)}%`;

  if (status === "placed") {
    // The match-card already renders ✓ Placed in its own slot; suppress here
    // to avoid duplicating the indicator.
    return null;
  }
  if (status === "ready") {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 font-medium"
        title={`Auto-placer would take this bet on its next run (${market} floor: ${floorLabel})`}
      >
        ⏵ auto-place
      </span>
    );
  }
  if (status === "below_min") {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400"
        title={isRetired
          ? `${market} is retired from real-money placement — backtest showed it loses at every edge threshold. Paper tracking continues.`
          : `Edge below ${market} floor (${floorLabel}) — auto-placer ignores this bet`}
      >
        {isRetired ? `✗ ${market} retired` : `✗ edge < ${floorLabel}`}
      </span>
    );
  }
  if (status === "no_event") {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300"
        title="No Coolbet/Unibet snapshot exists for this match — fuzzy event match likely failed (team-name mismatch, league not covered, etc.). Worth spot-checking manually."
      >
        ⚠ no match
      </span>
    );
  }
  if (status === "no_market") {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400"
        title="Coolbet/Unibet has this match but no odds for this specific market/selection — bookmaker likely doesn't offer it (e.g. AH quarter lines, exotic DC, etc.). Worth spot-checking manually."
      >
        ⚠ no market
      </span>
    );
  }
  if (status === "edge_eroded") {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-300"
        title={`Edge at current live price = ${liveEdge != null ? (liveEdge * 100).toFixed(1) : "?"}% — below ${market} live-edge floor (${floorLabel})`}
      >
        ✗ edge eroded
      </span>
    );
  }
  return null;
}


function fmtAHSelection(selection: string): string {
  const m = selection.match(/^(home|away)\s+([+-]?\d+(?:\.\d+)?)$/i);
  if (!m) return selection;
  const team = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  const hl = parseFloat(m[2]);
  const homeStart = hl > 0 ? hl : 0;
  const awayStart = hl < 0 ? -hl : 0;
  const fmt = (n: number) => n % 1 === 0 ? String(Math.round(n)) : String(n);
  return `${team} · ${fmt(homeStart)}-${fmt(awayStart)}`;
}

function fmtSelShort(market: string, selection: string): string {
  const s = selection.toLowerCase().trim();
  const mkt = market.toUpperCase().trim();
  if (mkt === "1X2" || mkt === "MATCH_WINNER") {
    if (s === "home") return "1X2 H";
    if (s === "away") return "1X2 A";
    if (s === "draw") return "1X2 D";
  }
  if (mkt === "BTTS") return s === "yes" ? "BTTS Y" : "BTTS N";
  const ah = selection.match(/^(home|away)\s+([+-]?\d+(?:\.\d+)?)$/i);
  if (ah) {
    const side = ah[1].toLowerCase() === "home" ? "H" : "A";
    return `AH ${side} ${ah[2]}`;
  }
  const ou = selection.match(/^(over|under)\s+([\d.]+)$/i);
  if (ou) return `${ou[1].toLowerCase() === "over" ? "O" : "U"}${ou[2]}`;
  return `${market} ${selection}`;
}

function fmtOdds(o: number | null | undefined) {
  return o == null ? "—" : o.toFixed(2);
}
function fmtPct(o: number | null | undefined) {
  return o == null ? "—" : `${(o * 100).toFixed(1)}%`;
}
function fmtKickoff(iso: string) {
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  // INPLAY-PLACEABLE (2026-06-02): kickoff-passed matches now appear on
  // this table for in-play placement consideration. Surface that with a
  // "Started Nm" tag instead of the static "Jun 2, 19:00" the future-only
  // version of this list always rendered.
  if (ms <= 0) {
    const minsAgo = Math.floor(-ms / 60000);
    if (minsAgo < 60) return `Started ${minsAgo}m`;
    const hAgo = Math.floor(minsAgo / 60);
    return `Started ${hAgo}h ${minsAgo % 60}m`;
  }
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

// COMBO-LABELS (2026-05-23): all five combo variants have nearly identical
// row chrome (5 legs, similar odds + edge), so the row was unreadable. This
// returns a short {label, subtitle, placeable} tuple per bot name so the UI
// can show what's actually different.
function comboVariantLabel(botName: string): {
  label: string;
  subtitle: string;
  placeable: boolean;
} {
  switch (botName) {
    case "bot_acca_value":
      return {
        label: "Straight 5-fold · all markets",
        subtitle: "One ticket, all 5 legs must win",
        placeable: false,
      };
    case "bot_combo_system":
      return {
        label: "Fours-up system · all markets",
        subtitle: "Same 5 picks split into 5 four-folds + 1 five-fold (6 sub-tickets) · tolerates 1 leg failing",
        placeable: false,
      };
    case "bot_acca_proven":
      return {
        label: "Straight 5-fold · proven markets only",
        subtitle: "Markets restricted to OU25/OU35/BTTS (+ OU15 required leg)",
        placeable: false,
      };
    case "bot_combo_proven_system":
      return {
        label: "Fours-up system · proven markets only",
        subtitle: "Same proven-market picks split into 5 four-folds + 1 five-fold (6 sub-tickets)",
        placeable: false,
      };
    case "bot_acca_coolbet":
      return {
        label: "Straight 5-fold · Coolbet leagues only",
        subtitle: "Legs restricted to leagues offered on Coolbet — this is the one you can build at the slip",
        placeable: true,
      };
    default:
      return { label: "Combo", subtitle: "", placeable: false };
  }
}

function ConsensusBadge({ size, recommended }: { size: number; recommended: boolean }) {
  if (size < 2) return null;
  if (recommended) {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 font-medium"
        title={`${size} bots picked this same bet — this row has the highest edge, follow this one`}
      >
        ★ best of {size}
      </span>
    );
  }
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
      title={`${size} bots picked this same bet — a different bot has higher edge, prefer that one`}
    >
      {size} bots
    </span>
  );
}

export function PlaceBetTable({ candidates }: { candidates: PlaceableBet[] }) {
  const [filter, setFilter] = useState<"all" | "edge" | "available" | "placed" | "consensus">("all");
  const [openModal, setOpenModal] = useState<PlaceableBet | null>(null);
  const [openComboModal, setOpenComboModal] = useState<PlaceableBet | null>(null);
  // COMBO-ADMIN-PLACE-UI: track which combo rows are expanded inline. Click a
  // combo row's chevron to reveal the N legs below.
  const [expandedCombos, setExpandedCombos] = useState<Set<string>>(new Set());
  const toggleCombo = (betId: string) => {
    setExpandedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(betId)) next.delete(betId);
      else next.add(betId);
      return next;
    });
  };

  const placedCount = candidates.filter((c) => c.alreadyPlaced).length;

  // Group identical bets across bots: (match, market, selection).
  // Within a group, mark the recommended row: already-placed wins, otherwise highest edge,
  // tiebreak alphabetical bot name. Computed off `candidates` so the consensus reflects
  // the full picture regardless of the active filter.
  const { recommendedByBetId, groupSizeByBetId } = useMemo(() => {
    const groups = new Map<string, PlaceableBet[]>();
    for (const c of candidates) {
      const key = `${c.matchId}|${c.market}|${c.selection}`;
      const arr = groups.get(key);
      if (arr) arr.push(c);
      else groups.set(key, [c]);
    }
    const recommended = new Set<string>();
    const sizes = new Map<string, number>();
    for (const bets of groups.values()) {
      for (const b of bets) sizes.set(b.betId, bets.length);
      if (bets.length < 2) continue;
      const sorted = [...bets].sort((a, b) => {
        if (a.alreadyPlaced !== b.alreadyPlaced) return a.alreadyPlaced ? -1 : 1;
        const ea = a.edge ?? -Infinity;
        const eb = b.edge ?? -Infinity;
        if (eb !== ea) return eb - ea;
        return a.bot.localeCompare(b.bot);
      });
      recommended.add(sorted[0].betId);
    }
    return { recommendedByBetId: recommended, groupSizeByBetId: sizes };
  }, [candidates]);

  const filtered = candidates
    .filter((c) => {
      if (filter === "edge" && (c.edge ?? 0) < 0.05) return false;
      if (filter === "available" && c.coolbetOdds == null && c.unibetOdds == null && c.bet365Odds == null) return false;
      if (filter === "placed" && !c.alreadyPlaced) return false;
      if (filter === "consensus" && (groupSizeByBetId.get(c.betId) ?? 1) < 2) return false;
      if (filter === "consensus" && !recommendedByBetId.has(c.betId)) return false;
      return true;
    })
    // Keep duplicate-bet rows adjacent so the amber stripe reads as one bar.
    // Preserves kickoff ASC (engine-data's primary order), then groups by
    // (matchId, market, selection), edge DESC within the group.
    .sort((a, b) => {
      const ka = new Date(a.kickoff).getTime();
      const kb = new Date(b.kickoff).getTime();
      if (ka !== kb) return ka - kb;
      if (a.matchId !== b.matchId) return a.matchId.localeCompare(b.matchId);
      const ga = `${a.market}|${a.selection}`;
      const gb = `${b.market}|${b.selection}`;
      if (ga !== gb) return ga.localeCompare(gb);
      return (b.edge ?? 0) - (a.edge ?? 0);
    });

  const consensusCount = candidates.filter(
    (c) => (groupSizeByBetId.get(c.betId) ?? 1) >= 2 && recommendedByBetId.has(c.betId)
  ).length;

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
        No pending bets on upcoming matches. Wait for the morning betting run, then refresh.
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2 mb-3 text-xs flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-2 py-1 rounded ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          All ({candidates.length})
        </button>
        <button
          onClick={() => setFilter("edge")}
          className={`px-2 py-1 rounded ${filter === "edge" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          Edge ≥5%
        </button>
        <button
          onClick={() => setFilter("available")}
          className={`px-2 py-1 rounded ${filter === "available" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          Has Coolbet/Bet365 odds
        </button>
        {consensusCount > 0 && (
          <button
            onClick={() => setFilter("consensus")}
            title="Show only the recommended bot row for each bet that 2+ bots picked"
            className={`px-2 py-1 rounded ${filter === "consensus" ? "bg-amber-700 text-amber-50" : "bg-amber-900/40 text-amber-300"}`}
          >
            ★ Consensus picks ({consensusCount})
          </button>
        )}
        {placedCount > 0 && (
          <button
            onClick={() => setFilter("placed")}
            className={`px-2 py-1 rounded ${filter === "placed" ? "bg-emerald-700 text-white" : "bg-emerald-900/40 text-emerald-400"}`}
          >
            ✓ Already placed ({placedCount})
          </button>
        )}
      </div>

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {filtered.map((c) => {
          const grouped = (groupSizeByBetId.get(c.betId) ?? 1) >= 2;
          return (
            <div
              key={c.betId}
              className={`rounded-lg border bg-card p-3 ${c.alreadyPlaced ? "border-emerald-700/50 bg-emerald-950/30" : "border-border"} ${grouped ? "border-l-2 border-l-amber-500/60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <div className="font-semibold text-sm leading-tight">{c.match}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.league} · {fmtKickoff(c.kickoff)}
                  </div>
                </div>
                {c.alreadyPlaced && (
                  <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200">✓</span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium">{fmtSelShort(c.market, c.selection)}</span>
                  <span className="text-[10px] text-muted-foreground">· {c.bot}</span>
                  <ConsensusBadge
                    size={groupSizeByBetId.get(c.betId) ?? 1}
                    recommended={recommendedByBetId.has(c.betId)}
                  />
                  <RealMoneyTierBadge tier={c.realMoneyTier} />
                  <AutoPlaceStatusBadge status={c.autoPlaceStatus} liveEdge={c.liveEdge} market={c.market} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{fmtOdds(c.botOdds)}</span>
                  <span className="font-mono text-emerald-400 font-semibold">{fmtOdds(c.coolbetOdds ?? c.unibetOdds)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{fmtPct(c.edge)}</span>
                  <button
                    onClick={() => setOpenModal(c)}
                    className="px-3 py-1.5 text-sm font-medium rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
                  >
                    Place
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-2">Match</th>
              <th className="text-left p-2">Sel</th>
              <th className="text-right p-2 text-emerald-400">Coolbet*</th>
              <th className="text-right p-2">Bet365</th>
              <th className="text-right p-2">Pin</th>
              <th className="text-right p-2">Bot</th>
              <th className="text-right p-2">Edge</th>
              <th className="text-right p-2" title="Bot's Kelly-based recommended stake (assuming €1000 bankroll)">Stake</th>
              <th className="text-right p-2">Place</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const grouped = (groupSizeByBetId.get(c.betId) ?? 1) >= 2;
              const isCombo = c.comboLegs != null && c.comboLegs.length > 0;
              const isExpanded = isCombo && expandedCombos.has(c.betId);
              return (
                <Fragment key={c.betId}>
                <tr
                  className={`border-t border-border ${c.alreadyPlaced ? "bg-emerald-950/30" : ""} ${grouped ? "border-l-2 border-l-amber-500/60" : ""} ${isCombo ? "border-l-2 border-l-purple-500/60 bg-purple-950/20" : ""}`}
                >
                  <td className="p-2">
                    <div className="font-medium flex items-center gap-1.5 flex-wrap">
                      {isCombo ? (
                        <>
                          <button
                            onClick={() => toggleCombo(c.betId)}
                            className="text-left flex items-center gap-1.5 hover:text-purple-300"
                          >
                            <span className="text-purple-400">{isExpanded ? "▼" : "▶"}</span>
                            <span>{comboVariantLabel(c.bot).label}</span>
                          </button>
                          {comboVariantLabel(c.bot).placeable ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-medium border border-emerald-700/40">
                              ✓ Placeable at Coolbet
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400 font-medium border border-zinc-700/40">
                              paper-only
                            </span>
                          )}
                        </>
                      ) : (
                        c.match
                      )}
                      {c.alreadyPlaced && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200 font-normal">✓ Placed</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isCombo ? (
                        <span title={c.bot}>{comboVariantLabel(c.bot).subtitle}</span>
                      ) : (
                        c.league
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      {isCombo ? (
                        <span>Combined edge {fmtPct(c.edge)} · stake €{c.stake?.toFixed(2) ?? "—"} · {c.bot}</span>
                      ) : (
                        <>
                          <span>{fmtKickoff(c.kickoff)} · {c.bot}</span>
                          <ConsensusBadge
                            size={groupSizeByBetId.get(c.betId) ?? 1}
                            recommended={recommendedByBetId.has(c.betId)}
                          />
                          <RealMoneyTierBadge tier={c.realMoneyTier} />
                          <AutoPlaceStatusBadge status={c.autoPlaceStatus} liveEdge={c.liveEdge} market={c.market} />
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-xs">
                    <div>{isCombo ? "COMBO" : c.market}</div>
                    <div className="text-muted-foreground">{isCombo ? c.selection : fmtAHSelection(c.selection)}</div>
                  </td>
                  <td className="p-2 text-right font-mono text-emerald-400">
                    {isCombo ? "—" : fmtOdds(c.coolbetOdds ?? c.unibetOdds)}
                    {c.coolbetOdds == null && c.unibetOdds != null && (
                      <span className="ml-1 text-[9px] text-amber-500" title="Unibet proxy — Coolbet odds not yet ingested">*</span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono text-blue-300">{isCombo ? "—" : fmtOdds(c.bet365Odds)}</td>
                  <td className="p-2 text-right font-mono text-muted-foreground">{isCombo ? "—" : fmtOdds(c.pinnacleOdds)}</td>
                  <td className="p-2 text-right font-mono">{fmtOdds(c.botOdds)}</td>
                  <td className="p-2 text-right font-mono">{fmtPct(c.edge)}</td>
                  <td className="p-2 text-right font-mono text-amber-300">{c.stake != null ? `€${c.stake.toFixed(2)}` : "—"}</td>
                  <td className="p-2 text-right">
                    {isCombo ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => toggleCombo(c.betId)}
                          className="px-2 py-1 text-xs rounded bg-purple-700 hover:bg-purple-600"
                        >
                          {isExpanded ? "Hide" : "Legs"}
                        </button>
                        {!c.alreadyPlaced && (
                          <button
                            onClick={() => setOpenComboModal(c)}
                            className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500"
                          >
                            Record
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setOpenModal(c)}
                        className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500"
                      >
                        Place
                      </button>
                    )}
                  </td>
                </tr>
                {/* Expanded combo legs */}
                {isCombo && isExpanded && c.comboLegs!.map((leg, i) => (
                  <tr key={`leg-${i}`} className="border-t border-border/30 bg-purple-950/10 text-xs">
                    <td className="p-2 pl-8">
                      <div className="font-medium">Leg {i + 1}: {leg.match}</div>
                      <div className="text-muted-foreground">{leg.league} · {fmtKickoff(leg.kickoff)}</div>
                      <div className="text-muted-foreground">{leg.botSource}</div>
                    </td>
                    <td className="p-2">
                      <div>{leg.market}</div>
                      <div className="text-muted-foreground">{fmtAHSelection(leg.selection)}</div>
                    </td>
                    <td className="p-2 text-right text-muted-foreground" colSpan={3}>(combine at Coolbet bet builder)</td>
                    <td className="p-2 text-right font-mono">{fmtOdds(leg.odds)}</td>
                    <td className="p-2 text-right font-mono">{fmtPct(leg.prob * leg.odds - 1)}</td>
                    <td className="p-2 text-right text-muted-foreground" colSpan={2}>—</td>
                  </tr>
                ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        *Coolbet column shows real Coolbet odds when ingested; falls back to Unibet proxy (marked with *) when the daemon hasn&rsquo;t snapshotted that match yet.
      </p>

      {openModal && <PlaceBetModal candidate={openModal} onClose={() => setOpenModal(null)} />}
      {openComboModal && <RecordComboModal candidate={openComboModal} onClose={() => setOpenComboModal(null)} />}
    </>
  );
}

function PlaceBetModal({ candidate, onClose }: { candidate: PlaceableBet; onClose: () => void }) {
  const router = useRouter();
  // Prefer real Coolbet odds; fall back through proxies (Unibet → Bet365 → Pinnacle → model).
  const defaultOdds = candidate.coolbetOdds ?? candidate.unibetOdds ?? candidate.bet365Odds ?? candidate.pinnacleOdds ?? candidate.botOdds;
  const bookmaker = "Coolbet";
  const [actualOdds, setActualOdds] = useState<string>(defaultOdds.toFixed(2));
  // Default to the bot's Kelly-recommended stake. Fall back to €2 if missing.
  const defaultStake = candidate.stake != null && candidate.stake > 0
    ? candidate.stake.toFixed(2)
    : "2.00";
  const [stake, setStake] = useState<string>(defaultStake);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // capturedOdds = what the snapshot saw (Coolbet preferred). Stored on real_bets
  // for later CLV / drift analysis vs actualOdds.
  const capturedOdds = candidate.coolbetOdds ?? candidate.unibetOdds;

  const parsedOdds = parseFloat(actualOdds);
  const liveEdge =
    candidate.modelProb != null && !isNaN(parsedOdds) && parsedOdds > 1
      ? candidate.modelProb - 1 / parsedOdds
      : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/real-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatedBetId: candidate.betId,
          botId: candidate.botId,
          matchId: candidate.matchId,
          market: candidate.market,
          selection: candidate.selection,
          bookmaker,
          capturedOdds,
          actualOdds: parseFloat(actualOdds),
          stake: parseFloat(stake),
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `${res.status} ${res.statusText}`);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="bg-card border border-border rounded-lg p-6 max-w-md w-full space-y-3"
      >
        <h2 className="text-lg font-bold">Log real bet</h2>
        <div className="text-xs text-muted-foreground">
          {candidate.match} · {candidate.market} {fmtAHSelection(candidate.selection)} · bot {candidate.bot}
        </div>

        <div className="block text-sm">
          Bookmaker
          <div className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-muted-foreground">
            Coolbet
          </div>
        </div>

        <label className="block text-sm">
          Actual odds taken
          <input
            type="number"
            step="0.01"
            min="1.01"
            required
            value={actualOdds}
            onChange={(e) => setActualOdds(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 font-mono"
          />
          {candidate.modelProb != null && (
            <div className="mt-2 rounded border border-border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original edge (bot odds {fmtOdds(candidate.botOdds)})</span>
                <span className={`font-mono font-semibold ${(candidate.edge ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {candidate.edge != null ? `${candidate.edge > 0 ? "+" : ""}${(candidate.edge * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Edge at your odds</span>
                <span className={`font-mono font-semibold ${liveEdge == null ? "text-muted-foreground" : liveEdge > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {liveEdge == null ? "—" : `${liveEdge > 0 ? "+" : ""}${(liveEdge * 100).toFixed(1)}%${liveEdge <= 0 ? " ✗ skip" : ""}`}
                </span>
              </div>
            </div>
          )}
        </label>

        <label className="block text-sm">
          Stake (€)
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 font-mono"
          />
          {candidate.stake != null && candidate.stake > 0 && (
            <span className="text-xs text-muted-foreground">
              Bot recommends €{candidate.stake.toFixed(2)} (Kelly × tier × €1000 bankroll).
              Override freely — paper-validation, no real money.
            </span>
          )}
        </label>

        <label className="block text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 'price moved before click', 'max bet capped at €0.50'…"
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5"
            rows={2}
          />
        </label>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-muted hover:bg-muted/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? "Logging…" : "Log bet"}
          </button>
        </div>
      </form>
    </div>
  );
}

function extractSystemType(selection: string): string | null {
  if (selection.startsWith("fours_up")) return "fours_up";
  if (selection.startsWith("no_singles")) return "no_singles";
  return null;
}

function RecordComboModal({ candidate, onClose }: { candidate: PlaceableBet; onClose: () => void }) {
  const router = useRouter();
  const legs = candidate.comboLegs ?? [];
  const combinedOdds = legs.reduce((acc, l) => acc * l.odds, 1);
  const systemType = extractSystemType(candidate.selection);

  const [actualOdds, setActualOdds] = useState<string>(combinedOdds.toFixed(2));
  const defaultStake = candidate.stake != null && candidate.stake > 0
    ? candidate.stake.toFixed(2)
    : "2.00";
  const [stake, setStake] = useState<string>(defaultStake);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/record-combo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulatedBetId: candidate.betId,
          botId: candidate.botId,
          firstLegMatchId: candidate.matchId,
          systemType,
          comboLegs: legs.map((l) => ({
            match_id: l.matchId,
            market: l.market,
            selection: l.selection,
            odds: l.odds,
            prob: l.prob,
            bot_source: l.botSource,
          })),
          bookmaker: "Coolbet",
          actualOdds: parseFloat(actualOdds),
          stake: parseFloat(stake),
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `${res.status} ${res.statusText}`);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="bg-card border border-border rounded-lg p-6 max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold">Record combo bet</h2>
        <div className="text-xs text-muted-foreground">
          {candidate.bot} · {legs.length}-leg {systemType ?? "straight"} · combined edge {fmtPct(candidate.edge)}
        </div>

        {/* Legs summary */}
        <div className="rounded border border-border overflow-hidden text-xs">
          <table className="w-full">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left p-2">Leg</th>
                <th className="text-left p-2">Sel</th>
                <th className="text-right p-2">Odds</th>
                <th className="text-right p-2">Edge</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="p-2">
                    <div className="font-medium">{leg.match}</div>
                    <div className="text-muted-foreground">{leg.league}</div>
                  </td>
                  <td className="p-2">
                    <div>{leg.market}</div>
                    <div className="text-muted-foreground">{fmtAHSelection(leg.selection)}</div>
                  </td>
                  <td className="p-2 text-right font-mono">{fmtOdds(leg.odds)}</td>
                  <td className="p-2 text-right font-mono">{fmtPct(leg.prob * leg.odds - 1)}</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/20 font-semibold">
                <td className="p-2" colSpan={2}>Combined (model)</td>
                <td className="p-2 text-right font-mono text-purple-300">{combinedOdds.toFixed(2)}</td>
                <td className="p-2 text-right font-mono">{fmtPct(candidate.edge)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="block text-sm">
          Bookmaker
          <div className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 text-muted-foreground">
            Coolbet
          </div>
        </div>

        <label className="block text-sm">
          Actual combined odds taken
          <input
            type="number"
            step="0.01"
            min="1.01"
            required
            value={actualOdds}
            onChange={(e) => setActualOdds(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 font-mono"
          />
          <span className="text-xs text-muted-foreground">Model estimates {combinedOdds.toFixed(2)} — enter what Coolbet actually showed.</span>
        </label>

        <label className="block text-sm">
          Stake (€)
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5 font-mono"
          />
          {candidate.stake != null && candidate.stake > 0 && (
            <span className="text-xs text-muted-foreground">
              Bot recommends €{candidate.stake.toFixed(2)}.
            </span>
          )}
        </label>

        <label className="block text-sm">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. 'one leg slightly different odds', 'reduced stake due to low liquidity'…"
            className="w-full mt-1 bg-background border border-border rounded px-2 py-1.5"
            rows={2}
          />
        </label>

        {error && <div className="text-xs text-red-400">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-muted hover:bg-muted/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? "Recording…" : "Record bet"}
          </button>
        </div>
      </form>
    </div>
  );
}
