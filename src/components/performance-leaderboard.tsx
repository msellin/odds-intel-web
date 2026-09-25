"use client";

import { CALIBRATED_SINCE } from "@/lib/engine-data";
import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { isLiveBot, vipEvLabel, VIP_LIVE_SINCE } from "@/lib/bot-aggregates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { ENGINE_BOT_FLOORS } from "@/lib/generated/engine-floors";

/**
 * What to print for a bot. BOT-NAMES-AND-LABELS (2026-09-22, [[#069]]).
 *
 * /performance is a CUSTOMER surface that was listing internal identifiers —
 * `bot_v10_all`, `bot_high_roi_global_v2`, `bot_sharp_forward_test_v1`. The owner:
 * *"the names should be user readable and intuitive"*.
 *
 * The fix is a `display_name` column that is NOT the primary key, so a bot can be
 * renamed for readers without breaking attribution, joins or history — the
 * failure mode that cost real rows in the 2026-09 audits. `name` is still shown,
 * as small mono secondary text, because an operator reading this page must still
 * be able to map a row to a query.
 *
 * The NAME says what the bot BETS, not what it prices against: the AnchorChip
 * beside it already carries MODEL / SHARP LINE / CONSENSUS, and a name that
 * repeats the chip spends the only line a reader reads on information already
 * on screen.
 */
function botLabel(bot: Pick<PublicBotStat, "name" | "displayName">): string {
  return bot.displayName?.trim() || bot.name;
}

export interface PublicBotStat {
  /** Identity / join key — `bots.name`. The bet filter, ENGINE_BOT_FLOORS and
   *  every ledger query key on this, so it is never renamed. */
  name: string;
  /** BOT-NAMES-AND-LABELS (migration 375, [[#069]]). What a READER sees.
   *  Null for rows that predate the column; `botLabel()` falls back to `name`. */
  displayName?: string | null;
  settled: number;
  won: number;
  lost: number;
  pnl: number | null;
  roi: number | null;
  clvDirection: "positive" | "negative" | "neutral" | null;
  avgClv: number | null;
  currentBankroll: number | null;
  // PERF-CHART-STARTING-BANKROLL (2026-05-17): per-bot starting bankroll so the
  // chart's synthetic origin matches reality. Was hardcoded €1000, which broke
  // for bot_aggressive_v2 (€10k start) — the line jumped from 1000 to 10000+
  // on the first bet, looking like the chart "started from the first bet."
  startingBankroll: number | null;
  hasEnoughData: boolean;
  maturityLabel: string;
  /** #148: the paid-tier VIP bot — settled picks only ever reach this page. */
  isVip?: boolean;
  /** [[#156]] Forward-test (picks_forward_test) bots only: the row is scored on its
   *  CURRENT rule version, and its CLV is the SHARP-ANCHOR close, not the book's own. */
  forwardTest?: ForwardTestRecord;
}

/** [[#156]] (2026-09-25). A forward-test bot's CLV, shown to every reader.
 *
 *  MAIN figure = sharp-anchor CLV: the pick's odds against the fresh de-vigged
 *  Pinnacle close, or a 5+-book consensus close where Pinnacle has none (the source
 *  mix is printed). SECONDARY = against the betting book's OWN close, margin-
 *  corrected — the figure the page used to lead with. It is kept because it is the
 *  originally registered number, but it cannot judge these rules: they pick a leg
 *  because that book misprices it, and an uncorrected soft line closes where it
 *  opened, so its own close scores the pick at about minus its margin whatever the
 *  pick was worth. All fractions are raw (0.024 = +2.4%). */
export interface ForwardTestRecord {
  /** Current rule_version (the row's figures and its bet list use only this). */
  ruleVersion: string;
  /** Short label, e.g. "v4". */
  rule: string;
  sharpClv: number | null;
  nSharp: number;
  nPinnacle: number;
  nConsensus: number;
  ownClv: number | null;
  nOwn: number;
  /** Earlier rule versions — kept visible, never pooled into the row. */
  earlier: Array<{ rule: string; settled: number; sharpClv: number | null; nSharp: number }>;
}

function clvPct(v: number | null): string {
  return v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

function ForwardTestClvLine({ ft }: { ft: ForwardTestRecord }) {
  const tone = ft.sharpClv == null ? "" : ft.sharpClv > 0 ? "text-emerald-400" : "text-red-400";
  return (
    <>
      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
        <span className={tone}>vs sharp close {clvPct(ft.sharpClv)}</span>
        {ft.nSharp > 0
          ? ` · ${ft.nSharp} picks · ${ft.nPinnacle} Pinnacle / ${ft.nConsensus} consensus`
          : " · no settled picks yet"}
        {ft.nOwn > 0 && (
          <span className="text-muted-foreground/60">
            {" "}· vs the book&apos;s own close {clvPct(ft.ownClv)}
          </span>
        )}
      </p>
      {ft.earlier.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          rule {ft.rule} only · earlier{" "}
          {ft.earlier
            .map((e) => `${e.rule}: ${e.settled} settled, vs sharp close ${clvPct(e.sharpClv)}`)
            .join("; ")}{" "}
          — not counted
        </p>
      )}
    </>
  );
}

export interface SanitizedBotBet {
  id: string;
  match: string;
  league: string;
  placedAt: string;
  market: string;
  selection: string;
  odds: number;
  stake: number | null;
  result: string;
  pnl: number;
  bankrollAfter: number | null;
  modelProb: number;
  clv: number | null;
  closingOdds: number | null;
  edge: number | null;  // model edge % at pick time (Elite-only)
  bot: string;
  strategyProfile: string | null;
}

interface Props {
  bots: PublicBotStat[];
  isPro: boolean;
  isElite: boolean;
  allBets: SanitizedBotBet[] | null;
  retiredBotCount?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function fmtPct(n: number | null) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

function pnlColor(n: number) {
  return n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-muted-foreground";
}

function ClvIcon({ dir }: { dir: "positive" | "negative" | "neutral" | null }) {
  if (dir === "positive") return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (dir === "negative") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />;
}

function MaturityChip({ label }: { label: string }) {
  if (label === 'calibrated') return <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">calibrated</span>;
  if (label === 'beta') return <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25">beta</span>;
  if (label === 'testing') return <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-500/15 text-zinc-400 border border-zinc-500/25">testing</span>;
  return null; // 'active' shows no chip — it's the default
}

/** VIP-PERFORMANCE-SETTLED-ONLY (#148). The paid-tier bot: its live picks go to
 *  paying members before kickoff; this page shows its record once settled. */
function VipChip({ isVip }: { isVip?: boolean }) {
  if (!isVip) return null;
  return (
    <span
      title="Our paid-tier bot — its picks appear here once settled."
      className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-yellow-400/15 text-yellow-300 border border-yellow-400/40"
    >
      VIP
    </span>
  );
}

/** Per-pick EV band on a VIP pick: EV8 (EV ≥ 8%) or EV5 (5–8%). */
function EvBandChip({ label }: { label: "EV8" | "EV5" | null }) {
  if (!label) return null;
  const style = label === "EV8"
    ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/40"
    : "bg-yellow-400/5 text-yellow-200/70 border-yellow-400/20";
  return (
    <span
      title={label === "EV8" ? "Expected value ≥ 8% at the price taken" : "Expected value 5–8% at the price taken"}
      className={`ml-1 rounded px-1 py-0.5 text-[9px] font-bold tracking-wider border ${style}`}
    >
      {label}
    </span>
  );
}

/** What the bot prices against — model, sharp line, or book consensus.
 *
 *  Added 2026-09-22 (owner: "we should have a label about what is used for
 *  bot....model, anchor, mix"). The maturity chip says how much EVIDENCE backs a
 *  bot; this says what the bot IS. Without it the table puts a model edge and a
 *  sharp edge in one ROI column with no hint that they are measured against
 *  different rulers — a 16% model edge and a 3% sharp edge are different
 *  quantities, not a 5x difference.
 *
 *  Read from ENGINE_BOT_FLOORS, which is generated from the bot registry, so
 *  this label cannot drift from what the bot actually does. */
function AnchorChip({ bot }: { bot: string }) {
  const anchor = ENGINE_BOT_FLOORS[bot]?.anchor;
  const style =
    anchor === "model"     ? "bg-sky-500/15 text-sky-400 border-sky-500/25"
    : anchor === "sharp"     ? "bg-violet-500/15 text-violet-300 border-violet-500/25"
    : anchor === "consensus" ? "bg-teal-500/15 text-teal-300 border-teal-500/25"
    : anchor === "none"      ? "bg-zinc-500/15 text-zinc-400 border-zinc-500/25"
    : null;
  // 'none' NO LONGER MEANS "strategy" (corrected 2026-09-22, owner: "how is
  // strategy different from model?"). It wasn't: bot_high_roi_global_v2 runs the
  // SAME model edge thresholds as bot_v10_1x2 and then filters by league, side
  // and odds band. A filter over model picks is still model-anchored, and
  // labelling it a separate METHOD on a customer page was telling readers it
  // priced against something it does not. Its registry anchor is now `model`.
  //
  // What is left on `none` is the in-play rig, which genuinely has no model or
  // sharp reference — it prices off the BOOK's own de-vigged probability. In-play
  // bots do not render on /performance, so this branch is a safety net, not a
  // label anyone sees today.
  if (!style) return null;
  return (
    <span
      title={
        anchor === "model"
          ? "Fair value comes from our own probability model."
          : anchor === "sharp"
          ? "Fair value comes from the sharpest single line, margin removed. No model."
          : anchor === "consensus"
          ? "Fair value comes from a consensus of 5+ bookmakers, margin removed. No model."
          : "Priced off the bookmaker's own de-vigged probability — no model and no sharp reference."
      }
      // PILL, where the maturity chip is a square tag (owner: "those labels need
      // to be explained and have maybe separate shape?"). Two chips of identical
      // shape sitting side by side read as one two-part label; the different
      // silhouette is what tells a reader they answer different questions —
      // HOW MUCH EVIDENCE (maturity) vs WHAT IT PRICES AGAINST (method).
      className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${style}`}
    >
      {anchor === "none" ? "book" : anchor}
    </span>
  );
}

function resultBadge(r: string) {
  if (r === "won") return <span className="text-emerald-400 font-semibold">W</span>;
  if (r === "lost") return <span className="text-red-400/80">L</span>;
  if (r === "void") return <span className="text-muted-foreground">V</span>;
  return <span className="text-yellow-400/70">P</span>;
}

// ── Bankroll chart ────────────────────────────────────────────────────────────

function buildChartData(bets: SanitizedBotBet[], startingBankroll: number | null) {
  const settled = [...bets]
    .filter((b) => b.result === "won" || b.result === "lost")
    .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

  if (settled.length < 2) return [];

  // PERF-CHART-STARTING-BANKROLL (2026-05-17): use the bot's actual starting
  // bankroll. Was hardcoded €1000, which broke bot_aggressive_v2 (€10k start)
  // — the line jumped from 1000 to ~10000 on the first bet, looking like the
  // chart "started from the first bet's result."
  //
  // BOT-MODAL-CHART-VOID-BUG (2026-06-06): always recompute the running total
  // from `pnl` of the displayed bets. Previously the chart preferred each
  // bet's stored `bankrollAfter` snapshot, which is the bankroll at the
  // moment THAT bet settled — written before any later void cleanup. When
  // a sibling bet is retroactively voided (MATCH-DUPES-CLEANUP, OU odds
  // hygiene, etc.) its pnl flips to 0 but the snapshot on neighbouring bets
  // is not rewritten. Filtering voids out of the displayed series then
  // produced a cliff where the next non-void bet's stale snapshot reflected
  // the void's original loss/win. Running from pnl is internally consistent
  // with the filtered series — the line moves only by bets the user can see.
  const origin = startingBankroll ?? 1000;
  let running = origin;

  const series = settled.map((b, i) => {
    running += b.pnl;
    return {
      idx: i + 1,
      bankroll: Math.round(running * 100) / 100,
      date: new Date(b.placedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      result: b.result as "won" | "lost" | "origin",
    };
  });
  return [
    { idx: 0, bankroll: origin, date: "Start", result: "origin" as const },
    ...series,
  ];
}

// ── Bot detail modal (Pro+) ───────────────────────────────────────────────────

function BotModal({
  bot,
  bets,
  isElite,
  onClose,
}: {
  bot: PublicBotStat;
  bets: SanitizedBotBet[];
  isElite: boolean;
  onClose: () => void;
}) {
  // MATCH-DUPES-CLEANUP: hide voided bets from the per-bot history. They fire when the
  // OU/odds-quality cleanup (or future audits) retroactively invalidates a settled bet —
  // pnl=0 by definition, but the row at original odds_at_pick was misleading users into
  // thinking the bot had taken e.g. Over 1.5 at 3.42 (it did, but the price was garbage).
  // VIP-PERFORMANCE-SETTLED-ONLY (#148): a VIP bot's modal lists settled picks
  // only. The server already drops its unsettled rows; this is the last guard.
  const botBets = bets
    .filter((b) => b.bot === bot.name && b.result !== "void")
    .filter((b) => !bot.isVip || b.result === "won" || b.result === "lost")
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const chartData = buildChartData(botBets, bot.startingBankroll);
  const origin = bot.startingBankroll ?? 1000;
  const bankrollValues = chartData.map((d) => d.bankroll);
  const minB = Math.min(...bankrollValues, origin);
  const maxB = Math.max(...bankrollValues, origin);
  // Bucket size scales with origin — €50 buckets feel right at €1000 starts
  // but tiny at €10k. Use 5% of origin, min 50.
  const bucket = Math.max(50, Math.round((origin * 0.05) / 50) * 50);
  const yDomain = [Math.floor((minB - bucket * 0.6) / bucket) * bucket, Math.ceil((maxB + bucket * 0.6) / bucket) * bucket];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            <span className="text-base font-semibold">{botLabel(bot)}</span>
            {bot.displayName && (
              <span className="font-mono text-xs text-muted-foreground">{bot.name}</span>
            )}
            {bot.settled > 0 && bot.pnl != null && (
              <span className={`text-base font-semibold ${pnlColor(bot.pnl)}`}>
                {fmt(bot.pnl)}€
              </span>
            )}
            <span className="text-sm text-muted-foreground font-normal">
              {bot.settled > 0
                ? `${bot.settled} settled · ROI ${fmtPct(bot.roi)}`
                : "Accumulating data…"}
            </span>
            {bot.isVip && (
              <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <VipChip isVip /> Live since {VIP_LIVE_SINCE} · settled picks only
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Chart */}
        {chartData.length > 1 ? (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">
              Bankroll progression · {chartData.length} settled bets
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#888" }} tickLine={false} />
                <YAxis
                  domain={yDomain}
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v) => `€${v}`}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 12 }}
                  formatter={(v) => [`€${Number(v).toFixed(2)}`, "Bankroll"]}
                  labelFormatter={(label) => {
                    const idx = Number(label);
                    const d = chartData.find((x) => x.idx === idx);
                    if (!d) return `Bet #${label}`;
                    if (d.result === "origin") return "Starting bankroll";
                    return `Bet #${idx} · ${d.date}`;
                  }}
                />
                <ReferenceLine y={1000} stroke="#555" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const fill = payload.result === "won"
                      ? "#22c55e"
                      : payload.result === "lost"
                        ? "#ef4444"
                        : "#666";
                    return (
                      <circle
                        key={`dot-${props.index}`}
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill={fill}
                        stroke="none"
                      />
                    );
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-muted-foreground">
            {botBets.length > 0
              ? `${botBets.filter((b) => b.result === "pending").length} pending bet(s) — waiting for results.`
              : "No bets placed yet."}
          </div>
        )}

        {/* Bets table */}
        {botBets.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">{botBets.length} bets (newest first)</p>
            <div className="rounded-md border border-white/[0.08] overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pl-3 pr-2">Date</th>
                    <th className="py-2 px-2">Match</th>
                    <th className="py-2 px-2">Market</th>
                    <th className="py-2 px-2 text-right">Odds</th>
                    {isElite && <th className="py-2 px-2 text-right">Stake</th>}
                    <th className="py-2 px-2 text-center">Result</th>
                    <th className="py-2 px-2 text-right">P&L</th>
                    {isElite && <th className="py-2 px-2 text-right">Edge</th>}
                    <th className="py-2 pr-3 text-right">CLV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {botBets.map((b) => (
                    <tr key={b.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 pl-3 pr-2 text-muted-foreground whitespace-nowrap">
                        {new Date(b.placedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2 px-2 max-w-[180px] truncate" title={b.match}>{b.match}</td>
                      <td className="py-2 px-2">
                        <div className="font-mono uppercase text-muted-foreground text-[10px] whitespace-nowrap">
                          {b.market} · {b.selection}
                          {bot.isVip && <EvBandChip label={vipEvLabel(b.modelProb, b.odds)} />}
                        </div>
                        {b.strategyProfile && (
                          <div className="text-[9px] text-blue-400/60 mt-0.5">{b.strategyProfile}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{b.odds.toFixed(2)}</td>
                      {isElite && (
                        <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                          {b.stake != null ? `€${b.stake.toFixed(2)}` : "—"}
                        </td>
                      )}
                      <td className="py-2 px-2 text-center">{resultBadge(b.result)}</td>
                      <td className={`py-2 px-2 text-right tabular-nums ${b.result !== "pending" ? pnlColor(b.pnl) : "text-muted-foreground"}`}>
                        {b.result !== "pending" ? fmt(b.pnl) : "—"}
                      </td>
                      {isElite && (
                        <td className="py-2 px-2 text-right tabular-nums">
                          {b.edge != null ? (
                            <span className={b.edge > 0 ? "text-emerald-400" : b.edge < 0 ? "text-red-400" : "text-muted-foreground"}>
                              {b.edge >= 0 ? "+" : ""}{(b.edge * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {isElite && b.clv != null ? (
                          <span className={b.clv > 0 ? "text-emerald-400" : b.clv < 0 ? "text-red-400" : "text-muted-foreground"}>
                            {b.clv >= 0 ? "+" : ""}{(b.clv * 100).toFixed(1)}%
                          </span>
                        ) : b.clv != null ? (
                          <ClvIcon dir={b.clv > 0 ? "positive" : b.clv < 0 ? "negative" : "neutral"} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PerformanceLeaderboard({ bots, isPro, isElite, allBets, retiredBotCount = 0 }: Props) {
  const [selected, setSelected] = useState<PublicBotStat | null>(null);
  // SHOW-THE-LOSERS-BY-DEFAULT (2026-09-22, owner: "add the fix not to hide
  // negative ones, be default show all").
  //
  // This defaulted to FALSE, so a reader's first view of /performance was the
  // WINNERS ONLY and they had to click "N underperforming (negative ROI)" to see
  // the rest. The count was honest and the collapse was one click — but the
  // default is what most readers ever see, and a track record whose default view
  // excludes the losing strategies is not a track record.
  //
  // It also cut directly against the point of V10-SPLIT-BY-MARKET ([[#040]]) two
  // hours earlier: the whole reason for splitting `bot_v10_all` was to stop one
  // market's +12.8% hiding another's -0.5%, and this toggle then hid the -0.5%
  // half behind a chevron anyway.
  //
  // 👥 PICKS judges work on "whether the number survives scrutiny". A default
  // that hides the unflattering rows fails that on its own terms.
  //
  // The toggle is KEPT (now a collapse, not a reveal) because the grouping is
  // still useful — losers sort below winners and a reader can fold them away.
  const [showUnderperforming, setShowUnderperforming] = useState(true);
  // Same reasoning as above — "show all" includes the ones still accumulating.
  const [showDeveloping, setShowDeveloping] = useState(true);

  // PERFORMANCE-PUBLIC-PREMATCH-ONLY (2026-06-24): the public leaderboard
  // hides in-play bots entirely — they have higher variance + the InplayBot
  // UUID-bug history, and the public "production strategies" cohort the
  // landing claims is pre-match only. In-play data stays in /admin where
  // the operator can audit it.
  //
  // PERF-BOT-COUNT-RECONCILE-ADMIN (closed 2026-09-06): the "Tested to date:
  // N strategies" counts below are therefore INTENTIONALLY LOWER than
  // /admin/bots, which shows every bot including in-play ones. That is not a
  // bug and should not be "fixed" to match — the public cohort is pre-match
  // only by design, because that is what the landing page claims. Any future
  // audit comparing the two numbers should expect the delta to equal the
  // in-play bot count exactly.
  const tabFilteredBots = bots.filter((b) => !isLiveBot(b.name));

  const activeBots = tabFilteredBots.filter((b) => b.hasEnoughData && (b.roi == null || b.roi >= 0));
  const underperformingBots = tabFilteredBots.filter((b) => b.hasEnoughData && b.roi != null && b.roi < 0);
  const developingBots = tabFilteredBots.filter((b) => !b.hasEnoughData);

  const visibleBots = [
    ...activeBots,
    ...(showUnderperforming ? underperformingBots : []),
    ...(showDeveloping ? developingBots : []),
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">Bot Leaderboard</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {/* 2026-09-25 (owner): no separate "N proven" count — the status labels and their legend
                  below say how much evidence each bot has; a second, ROI-based judgement contradicted them
                  (4 picks at +29% read as "proven"). */}
              {isPro ? "Click any row for its bankroll chart" : "Pro unlocks W/L, P&L, charts"}
            </p>
            {/* PERF-STATE-THE-PERIOD (2026-09-17). Every ROI on this table is
                cumulative since CALIBRATED_SINCE, and until now the page never
                said so. A return figure without its window is not checkable,
                and "over what period, and how many bets?" is the first thing a
                reader who takes the number seriously will ask. The Settled
                column already answers the second half; this answers the first.

                It is deliberately a plain statement rather than a disclaimer:
                the numbers are what they are, and naming the window makes them
                verifiable rather than weaker. */}
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Cumulative since{" "}
              <span className="text-foreground">
                {new Date(`${CALIBRATED_SINCE}T00:00:00Z`).toLocaleDateString("en-GB", {
                  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
                })}
              </span>{" "}
              · flat stakes · logged before kickoff
            </p>
            {/* PERF-BOT-FUNNEL (2026-08-21) — surface the full strategy funnel
                so visitors see how many total strategies we've tested, not
                just the survivors. Only render when we have a retired count
                to avoid a lonely "0 retired". */}
            {retiredBotCount > 0 && (
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Tested to date:{" "}
                <span className="text-foreground">{activeBots.length + underperformingBots.length + developingBots.length + retiredBotCount}</span>{" "}
                strategies · <span className="text-muted-foreground">{retiredBotCount} retired</span>
              </p>
            )}
            {/* Chip legend prose (2026-07-06) — replaces the previous
                chip-and-inline-description row which read as a jargon
                strip most visitors skipped. Same information, but as
                one line of readable prose. */}
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Every strategy is tagged by how much live evidence backs it —
              <span className="mx-1 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-400">calibrated</span>
              (proven),
              <span className="mx-1 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-400">beta</span>
              (early live results),
              <span className="mx-1 rounded bg-zinc-500/15 px-1 py-0.5 text-[9px] font-bold uppercase text-zinc-400">testing</span>
              (still collecting).{" "}
              <span className="mx-1 rounded border border-yellow-400/40 bg-yellow-400/15 px-1 py-0.5 text-[9px] font-bold uppercase text-yellow-300">VIP</span>
              — our paid-tier bot; its picks appear here once settled, each marked
              EV8 (expected value ≥ 8%) or EV5 (5–8%).
            </p>
            {/* SECOND LEGEND, for the second chip (2026-09-22, owner: "those
                labels need to be explained and have maybe separate shape?").
                The square tag says how much EVIDENCE backs a bot; the pill says
                WHAT IT PRICES AGAINST. Two different questions, so two different
                shapes and two separate sentences.

                Sharp and consensus are deliberately described as siblings rather
                than a hierarchy — the owner asked "consensus is also based on
                sharp then?" and the answer is that both price against the market
                with the margin removed, differing only in how many books set the
                fair price. Measured 2026-09-22 (n=11,419): a consensus EXCLUDING
                our Pinnacle feed predicts as well as that feed alone, so the
                consensus is an independent estimator, not a diluted sharp one. */}
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              And by what sets its fair price —
              <span className="mx-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-300">model</span>
              (our own probability model),
              <span className="mx-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-300">sharp</span>
              (the sharpest single line, margin removed),
              <span className="mx-1 rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-teal-300">consensus</span>
              (several bookmakers agreeing, margin removed). The last two use no
              model at all and differ only in how many books set the fair price;
              they are tracked separately because they are different rules, not
              different kinds of thing.
            </p>
            {/* [[#156]] 2026-09-25 — what CLV means on the SHARP / CONSENSUS rows. */}
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Closing-line value (CLV) on the sharp and consensus rows is measured{" "}
              <span className="text-foreground">vs the sharp close</span>: our price against
              Pinnacle&apos;s final line with the margin removed, or a 5+ bookmaker consensus
              where Pinnacle has none. Positive means the price beat where the market
              settled. The figure against the book&apos;s own close is shown beside it, but
              it cannot judge these picks — they are chosen because that book&apos;s price is
              off, and a price the book never corrects closes where it opened.
            </p>
          </div>
          {/* Pre-match / In-play tabs removed — in-play hidden from public,
              audit data lives in /admin. */}
        </div>
      </div>

      {visibleBots.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          Bots are accumulating data — results appear after 5 settled bets.
        </div>
      ) : (
        <>
          {/* Mobile card list (2026-07-06) — the desktop table below
              collapses to a 480px-wide horizontal-scroll on iPhone SE.
              First-time visitors don't discover the scroll and only
              see 2 columns. Cards let each strategy stand on its own
              at 375px without cropping. */}
          <ul className="divide-y divide-border/10 sm:hidden">
            {visibleBots.map((bot) => {
              const isMaturing = !bot.hasEnoughData;
              const isLive = isLiveBot(bot.name);
              const clickable = isPro && !!allBets;
              return (
                <li
                  key={bot.name}
                  className={`px-4 py-3 ${
                    clickable ? "cursor-pointer active:bg-muted/40" : ""
                  } ${isMaturing ? "opacity-60" : ""}`}
                  onClick={() => clickable && setSelected(bot)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold truncate">
                          {botLabel(bot)}
                        </span>
                        {isLive && (
                          <Badge
                            variant="outline"
                            className="h-4 border-amber-500/30 px-1 py-0 text-[9px] text-amber-400/70"
                          >
                            live
                          </Badge>
                        )}
                        <MaturityChip label={bot.maturityLabel ?? "active"} />
                        <VipChip isVip={bot.isVip} />
                        <AnchorChip bot={bot.name} />
                      </div>
                      {bot.displayName && (
                        <p className="font-mono text-[10px] text-muted-foreground/60 truncate">
                          {bot.name}
                        </p>
                      )}
                      {bot.isVip && (
                        <p className="text-[10px] text-yellow-300/80">Live since {VIP_LIVE_SINCE}</p>
                      )}
                      {bot.forwardTest && <ForwardTestClvLine ft={bot.forwardTest} />}
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {isMaturing
                          ? bot.settled > 0
                            ? `${bot.settled} settled — accumulating`
                            : "no settled bets yet"
                          : `${bot.settled} settled`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className={`font-mono text-lg font-semibold tabular-nums ${
                            isMaturing || bot.roi == null
                              ? "text-muted-foreground"
                              : bot.roi > 0
                                ? "text-emerald-400"
                                : bot.roi < 0
                                  ? "text-red-400"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {isMaturing ? "—" : fmtPct(bot.roi)}
                        </span>
                        {!isMaturing && <ClvIcon dir={bot.clvDirection} />}
                      </div>
                      {isPro && bot.pnl != null && !isMaturing && (
                        <p className={`mt-0.5 font-mono text-[11px] tabular-nums ${pnlColor(bot.pnl)}`}>
                          {bot.pnl >= 0 ? "+" : ""}€{bot.pnl.toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop table — hidden on mobile since the sm:hidden card
              list above carries the same information without the
              horizontal-scroll trap. */}
          <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-border/20 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 bg-background py-2.5 pl-5 pr-2">Bot</th>
                <th scope="col" className="py-2.5 px-2 text-right">Settled</th>
                {isPro && <th scope="col" className="py-2.5 px-2 text-right">W / L</th>}
                <th scope="col" className="py-2.5 px-2 text-right">ROI</th>
                {isPro && <th scope="col" className="py-2.5 px-2 text-right">P&L (€)</th>}
                {isElite && <th scope="col" className="py-2.5 px-2 text-right">Avg CLV</th>}
                {/* [[#074]] 2026-09-23: no Bankroll column. bots.current_bankroll is on the
                    stored-pnl (high-water odds) basis while P&L / ROI beside it are on the
                    executable basis, so one row showed two contradictory totals (€1,360 vs
                    +€206). It is a live staking input, so its basis is not changed here —
                    the operator sees it on /admin/bots; readers get the honest columns. */}
                <th scope="col" className="py-2.5 px-2 text-center">CLV</th>
                {isPro && <th scope="col" className="py-2.5 pr-4 w-6" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {visibleBots.map((bot) => {
                const isMaturing = !bot.hasEnoughData;
                const isLive = isLiveBot(bot.name);

                return (
                  <tr
                    key={bot.name}
                    className={`group transition-colors ${isPro ? "cursor-pointer hover:bg-muted/40" : ""} ${isMaturing ? "opacity-50" : ""}`}
                    onClick={() => isPro && allBets && setSelected(bot)}
                  >
                    <td className="sticky left-0 z-10 bg-background py-3 pl-5 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium max-w-[150px] sm:max-w-none truncate">{botLabel(bot)}</span>
                        {isLive && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/30 text-amber-400/70">
                            live
                          </Badge>
                        )}
                        <MaturityChip label={bot.maturityLabel ?? 'active'} />
                        <VipChip isVip={bot.isVip} />
                        <AnchorChip bot={bot.name} />
                      </div>
                      {bot.displayName && (
                        <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{bot.name}</p>
                      )}
                      {bot.isVip && (
                        <p className="text-[10px] text-yellow-300/80 mt-0.5">Live since {VIP_LIVE_SINCE}</p>
                      )}
                      {bot.forwardTest && <ForwardTestClvLine ft={bot.forwardTest} />}
                      {isMaturing && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {bot.settled > 0 ? `${bot.settled} settled — accumulating data` : "Active · no settled bets yet"}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right text-sm tabular-nums">
                      {bot.settled > 0
                        ? <span className={isMaturing ? "text-muted-foreground text-xs" : ""}>{bot.settled}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    {isPro && (
                      <td className="py-3 px-2 text-right text-sm whitespace-nowrap">
                        {isMaturing ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <>
                            <span className="text-emerald-400">{bot.won}</span>
                            <span className="text-muted-foreground mx-0.5">/</span>
                            <span className="text-red-400">{bot.lost}</span>
                          </>
                        )}
                      </td>
                    )}
                    <td className={`py-3 px-2 text-right text-sm tabular-nums font-medium ${
                      isMaturing ? "text-muted-foreground" :
                      bot.roi == null ? "text-muted-foreground" :
                      bot.roi > 0 ? "text-emerald-400" : bot.roi < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {isMaturing ? "—" : fmtPct(bot.roi)}
                    </td>
                    {isPro && (
                      <td className={`py-3 px-2 text-right text-sm tabular-nums ${
                        isMaturing || bot.pnl == null ? "text-muted-foreground" : pnlColor(bot.pnl)
                      }`}>
                        {isMaturing || bot.pnl == null ? "—" : fmt(bot.pnl)}
                      </td>
                    )}
                    {isElite && (
                      <td className={`py-3 px-2 text-right text-sm tabular-nums ${
                        isMaturing || bot.avgClv == null ? "text-muted-foreground" :
                        bot.avgClv > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {isMaturing || bot.avgClv == null ? "—" : (bot.avgClv >= 0 ? "+" : "") + (bot.avgClv * 100).toFixed(1) + "%"}
                      </td>
                    )}
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center">
                        {isMaturing ? (
                          <Minus className="h-3.5 w-3.5 text-muted-foreground/30" />
                        ) : (
                          <ClvIcon dir={bot.clvDirection} />
                        )}
                      </div>
                    </td>
                    {isPro && (
                      <td className="py-3 pr-4">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* Underperforming + developing collapse toggles */}
      {(underperformingBots.length > 0 || developingBots.length > 0) && (
        <div className="border-t border-border/20 px-5 py-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
          {underperformingBots.length > 0 && (
            <button
              onClick={() => setShowUnderperforming((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${showUnderperforming ? "rotate-90" : ""}`} />
              {showUnderperforming
                ? `Hide ${underperformingBots.length} underperforming`
                : `${underperformingBots.length} underperforming (negative ROI)`}
            </button>
          )}
          {developingBots.length > 0 && (
            <button
              onClick={() => setShowDeveloping((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${showDeveloping ? "rotate-90" : ""}`} />
              {showDeveloping
                ? `Hide ${developingBots.length} in development`
                : `${developingBots.length} in development (< 5 bets)`}
            </button>
          )}
        </div>
      )}

      {/* #055 follow-up (2026-09-24): the Pro/Elite upsells were removed — there is no paid
          tier to buy (no checkout), and both links pointed back at /performance itself. */}

      {selected && allBets && (
        <BotModal
          bot={selected}
          bets={allBets}
          isElite={isElite}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
