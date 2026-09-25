"use client";

import { CALIBRATED_SINCE } from "@/lib/engine-data";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { isLiveBot, pickEv, vipEvLabel, VIP_LIVE_SINCE } from "@/lib/bot-aggregates";
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
  /** [[#159]] Every row: the figures behind it, from the engine view bot_performance. */
  record?: BotRecordDetail;
}

/** [[#159]] What the detail view states about a row's numbers — the same for every bot.
 *  CLV = the pick's price against the sharp-anchor close (fresh de-vigged Pinnacle, else a 5+
 *  bookmaker consensus); a raw fraction. ([[#155]]: no stake-weighted secondary any more — every
 *  stored stake is the flat unit, migration 441.) */
export interface BotRecordDetail {
  clv: number | null;
  clvN: number;
  clvNPinnacle: number;
  clvNConsensus: number;
  /** Settled picks priced at the recorded odds — no quote at pick time. */
  nRecordedPrice: number;
  pending: number;
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
  /** [[#158]] earlier-rule picks counted in this record because they passed the current
   *  rule on pick-time data (engine re-check). Shown in the detail view only. */
  nRechecked: number;
  /** Earlier rule versions — kept visible, never pooled into the row. `failedRecheck` =
   *  re-checked against the current rule and failed ("didn't meet today's rule"). */
  earlier: Array<{
    rule: string; settled: number; sharpClv: number | null; nSharp: number; failedRecheck: boolean;
  }>;
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
      {ft.nRechecked > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          rule {ft.rule} · incl. {ft.nRechecked} earlier pick{ft.nRechecked === 1 ? "" : "s"}{" "}
          re-checked under {ft.rule} (judged only on what was known when published)
        </p>
      )}
      {ft.earlier.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          {ft.nRechecked > 0 ? "not counted · " : `rule ${ft.rule} only · earlier `}
          {ft.earlier
            .map((e) =>
              `${e.rule}: ${e.settled} settled, vs sharp close ${clvPct(e.sharpClv)}` +
              (e.failedRecheck ? ` — didn't meet today's rule` : ""))
            .join("; ")}
          {ft.earlier.every((e) => e.failedRecheck) ? "" : " — not counted"}
        </p>
      )}
    </>
  );
}

/** One pick in the detail view — `BotLeg` from lib/bot-performance (via /api/performance/bot-legs).
 *  odds = the best price available at pick time (all books); pnl = EUR at the flat stake;
 *  clv = sharp-anchor CLV of this pick (fraction). stake / edge are Elite-only (null otherwise). */
export interface BotLegView {
  id: string;
  bot: string;
  match: string;
  league: string;
  placedAt: string;
  market: string;
  selection: string;
  odds: number;
  result: string;
  pnl: number;
  clv: number | null;
  clvSource: "pinnacle" | "consensus" | null;
  modelProb: number | null;
  stake: number | null;
  edge: number | null;
  strategyProfile: string | null;
}

interface Props {
  bots: PublicBotStat[];
  isElite: boolean;
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

function buildChartData(bets: BotLegView[], startingBankroll: number | null) {
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

// ── Bot detail view — open to EVERY reader ([[#159]]) ──────────────────────────
//
// Until 2026-09-25 this opened for Pro only (`clickable = isPro && !!allBets`), and the ledger
// it drew came from a client-side bet array the page shipped to Pro browsers. Owner: the
// detail view opens for everyone, the same view. It now fetches its own legs from
// /api/performance/bot-legs — the SAME record legs (bot_ledger_display, in_record) the row is
// computed from, so the list a reader counts reconciles with the row. VIP / hide_pending bots:
// the route returns settled legs only (their pending picks are the paid product).

function ClvLine({ bot }: { bot: PublicBotStat }) {
  if (bot.forwardTest) return <ForwardTestClvLine ft={bot.forwardTest} />;
  const r = bot.record;
  if (!r) return null;
  const tone = r.clv == null ? "" : r.clv > 0 ? "text-emerald-400" : "text-red-400";
  return (
    <p className="text-[10px] tabular-nums text-muted-foreground">
      <span className={tone}>vs sharp close {clvPct(r.clv)}</span>
      {r.clvN > 0
        ? ` · ${r.clvN} picks · ${r.clvNPinnacle} Pinnacle / ${r.clvNConsensus} consensus`
        : " · no settled pick with a fresh closing line yet"}
    </p>
  );
}

/** The flat unit every /performance figure is stated at (lib/bot-performance PERF_FLAT_STAKE_EUR —
 *  not imported: that module is server-only). */
const FLAT_EUR = 10;

/** The detail view's header row — the bot's bot_performance row, fetched with its legs ([[#155]]). */
interface DetailPerf {
  settled: number;
  won: number;
  lost: number;
  pnlUnits: number;
  roi: number | null;
}

/** One EV band of a VIP bot's record (engine view bot_performance_ev_band, [[#155]]). */
interface DetailEvBand {
  band: "EV8" | "EV5";
  settled: number;
  won: number;
  lost: number;
  pnlUnits: number;
  roi: number | null;
  clv: number | null;
  clvN: number;
}

/** [[#155]] owner 2026-09-25: the VIP bot's record split EV8 (EV ≥ 8%) vs EV5 (5–8%), each with n
 *  settled, flat ROI and sharp-anchor CLV — the same basis as the header (the bands sum to it).
 *  Replaces the retired EV8 bot, whose picks were a strict subset of these. */
function EvBandSplit({ bands }: { bands: DetailEvBand[] }) {
  return (
    <div className="rounded-lg border border-yellow-400/20 px-4 py-2 text-xs">
      <p className="text-[10px] text-muted-foreground mb-1">By expected value at the price (model probability × odds − 1)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {bands.map((b) => (
          <p key={b.band} className="tabular-nums">
            <EvBandChip label={b.band} />
            <span className="ml-1.5 text-muted-foreground">{b.band === "EV8" ? "EV ≥ 8%" : "EV 5–8%"}</span>
            <span className="ml-2">{b.settled} settled</span>
            {b.settled > 0 && (
              <>
                <span className={`ml-2 ${pnlColor(b.roi ?? 0)}`}>ROI {fmtPct(b.roi == null ? null : b.roi * 100)}</span>
                <span className="ml-2 text-muted-foreground">
                  vs sharp close {b.clvN > 0 ? clvPct(b.clv) : "—"}{b.clvN > 0 ? ` (${b.clvN})` : ""}
                </span>
              </>
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

function BotModal({
  bot,
  isElite,
  onClose,
}: {
  bot: PublicBotStat;
  isElite: boolean;
  onClose: () => void;
}) {
  const [legs, setLegs] = useState<BotLegView[] | null>(null);
  const [perf, setPerf] = useState<DetailPerf | null>(null);
  const [evBands, setEvBands] = useState<DetailEvBand[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/performance/bot-legs?bot=${encodeURIComponent(bot.name)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { legs: BotLegView[]; perf?: DetailPerf | null; evBands?: DetailEvBand[] }) => {
        if (!alive) return;
        setLegs(j.legs ?? []);
        setPerf(j.perf ?? null);
        setEvBands(j.evBands ?? []);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [bot.name]);

  // [[#155]] The header reads the bot's bot_performance row from the SAME request as the legs
  // (the row's cached copy until it arrives), so "N settled" in the header and in the chart title
  // always count the same legs. Flat €10 at the public price — the table row's figure.
  const hdr = perf
    ? { settled: perf.settled, won: perf.won, lost: perf.lost,
        pnl: perf.settled > 0 ? perf.pnlUnits * FLAT_EUR : null,
        roi: perf.roi == null ? null : perf.roi * 100 }
    : { settled: bot.settled, won: bot.won, lost: bot.lost, pnl: bot.pnl, roi: bot.roi };
  // [[#155]] EV-unit bots (their own gate is EV = p × odds − 1) show the pick's EV, not a pp edge.
  const evBot = ENGINE_BOT_FLOORS[bot.name]?.edgeUnit === "ev";

  // MATCH-DUPES-CLEANUP: voided picks are not history (pnl 0 by definition, price often garbage).
  // VIP-PERFORMANCE-SETTLED-ONLY (#148): the route already drops a VIP bot's unsettled rows;
  // this is the last guard.
  const botBets = (legs ?? [])
    .filter((b) => b.bot === bot.name && b.result !== "void" && b.result !== "push")
    .filter((b) => !bot.isVip || b.result === "won" || b.result === "lost")
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const chartData = buildChartData(botBets, bot.startingBankroll);
  const origin = bot.startingBankroll ?? 1000;
  const bankrollValues = chartData.map((d) => d.bankroll);
  const minB = Math.min(...bankrollValues, origin);
  const maxB = Math.max(...bankrollValues, origin);
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
            {hdr.settled > 0 && hdr.pnl != null && (
              <span className={`text-base font-semibold ${pnlColor(hdr.pnl)}`}>
                {fmt(hdr.pnl)}€
              </span>
            )}
            <span className="text-sm text-muted-foreground font-normal">
              {hdr.settled > 0
                ? `${hdr.settled} settled · ${hdr.won} W / ${hdr.lost} L · ROI ${fmtPct(hdr.roi)}`
                : "Accumulating data…"}
            </span>
            {bot.isVip && (
              <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                <VipChip isVip /> Live since {VIP_LIVE_SINCE} · settled picks only
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-border/40 px-4 py-3 text-xs space-y-0.5">
          <p className="text-[10px] text-muted-foreground">
            ROI at the best price available when each pick was made (all books) · flat €10 per pick
            {(bot.record?.nRecordedPrice ?? 0) > 0 && (
              <span className="text-muted-foreground/60">
                {" "}· {bot.record?.nRecordedPrice} pick{bot.record?.nRecordedPrice === 1 ? "" : "s"} priced at the recorded odds (no quote stored at pick time)
              </span>
            )}
          </p>
          <ClvLine bot={bot} />
        </div>
        {bot.isVip && evBands.length > 0 && <EvBandSplit bands={evBands} />}

        {/* Chart */}
        {legs == null && !failed ? (
          <div className="mt-4 px-4 py-6 text-center text-sm text-muted-foreground">Loading picks…</div>
        ) : failed ? (
          <div className="mt-4 px-4 py-6 text-center text-sm text-muted-foreground">Could not load this bot&apos;s picks — try again.</div>
        ) : chartData.length > 1 ? (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">
              Bankroll progression · flat €10 · {chartData.length - 1} settled bets
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
                <ReferenceLine y={origin} stroke="#555" strokeDasharray="4 4" />
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
                    <th className="py-2 px-2 text-right" title="Best price available when the pick was made (all books)">Odds</th>
                    {isElite && <th className="py-2 px-2 text-right">Stake</th>}
                    <th className="py-2 px-2 text-center">Result</th>
                    <th className="py-2 px-2 text-right" title="Flat €10 per pick">P&L</th>
                    {evBot ? (
                      <th className="py-2 px-2 text-right" title="Expected value at this price: model probability × odds − 1 — the unit this bot's own rule is set in">EV</th>
                    ) : isElite && <th className="py-2 px-2 text-right">Edge</th>}
                    <th className="py-2 pr-3 text-right" title="Against the sharp closing line">CLV</th>
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
                      {evBot ? (
                        <td className="py-2 px-2 text-right tabular-nums">
                          {(() => {
                            const ev = pickEv(b.modelProb, b.odds);
                            return ev == null ? <span className="text-muted-foreground">—</span> : (
                              <span className={ev > 0 ? "text-emerald-400" : ev < 0 ? "text-red-400" : "text-muted-foreground"}>
                                {ev >= 0 ? "+" : ""}{(ev * 100).toFixed(1)}%
                              </span>
                            );
                          })()}
                        </td>
                      ) : isElite && (
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
                      <td className="py-2 pr-3 text-right tabular-nums" title={b.clvSource ? `vs ${b.clvSource} close` : undefined}>
                        {/* Per-pick CLV NUMBER stays Elite-only (CLV-PUBLIC-WITHDRAWN); everyone sees its
                            direction. The row's aggregate sharp CLV above is public (#156 / #159). */}
                        {isElite && b.clv != null ? (
                          <span className={b.clv > 0 ? "text-emerald-400" : b.clv < 0 ? "text-red-400" : "text-muted-foreground"}>
                            {b.clv >= 0 ? "+" : ""}{(b.clv * 100).toFixed(1)}%
                          </span>
                        ) : b.clv != null ? (
                          <span className="inline-flex justify-end"><ClvIcon dir={b.clv > 0 ? "positive" : b.clv < 0 ? "negative" : "neutral"} /></span>
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

/** [[#159]] (f) rows are grouped by STATUS — how much evidence backs them — never by ROI. */
type GroupKey = "live" | "testing" | "vip" | "developing";
const GROUP_TITLE: Record<GroupKey, string> = {
  live: "Calibrated & beta — live results",
  testing: "Testing — still collecting",
  vip: "VIP — paid tier, shown once settled",
  developing: "In development — fewer than 5 settled",
};
const GROUP_ORDER: GroupKey[] = ["live", "testing", "vip", "developing"];

function groupOf(b: PublicBotStat): GroupKey {
  // (e) ONE row rule: < 5 settled is "in development" whatever the bot — forward-test rows included.
  if (!b.hasEnoughData) return "developing";
  if (b.isVip) return "vip";
  if (b.maturityLabel === "calibrated" || b.maturityLabel === "beta") return "live";
  return "testing";
}

export function PerformanceLeaderboard({ bots, isElite, retiredBotCount = 0 }: Props) {
  const [selected, setSelected] = useState<PublicBotStat | null>(null);

  // PERFORMANCE-PUBLIC-PREMATCH-ONLY (2026-06-24): the public leaderboard hides in-play bots
  // entirely; their audit data lives in /admin. So the "strategies tested" count below is
  // INTENTIONALLY lower than /admin/bots by exactly the in-play bot count
  // (PERF-BOT-COUNT-RECONCILE-ADMIN, closed 2026-09-06).
  const tabFilteredBots = bots.filter((b) => !isLiveBot(b.name));

  // [[#159]] (f) The ROI-based "N underperforming" group/toggle is GONE (owner, 2026-09-25) —
  // the same second, ROI-based judgement the header counts were removed for. Every row is
  // shown (SHOW-THE-LOSERS-BY-DEFAULT, 2026-09-22), grouped by status, and within a group the
  // most-evidenced first (settled desc) — not the luckiest.
  const groups = GROUP_ORDER.map((key) => ({
    key,
    title: GROUP_TITLE[key],
    bots: tabFilteredBots
      .filter((b) => groupOf(b) === key)
      .sort((a, b) => b.settled - a.settled || a.name.localeCompare(b.name)),
  })).filter((g) => g.bots.length > 0);
  const visibleBots = groups.flatMap((g) => g.bots);

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">Bot Leaderboard</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {/* 2026-09-25 (owner): no separate "N proven" count — the status labels and their legend
                  below say how much evidence each bot has. [[#159]]: the detail view opens for every
                  reader (the "Pro unlocks W/L, P&L, charts" split ended). */}
              Click any row for its chart and every pick
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
            {/* 2026-09-25 (owner: "too much dense and small text"). ONE short context line, the two legends
                as compact chip rows, and the long explanations behind a collapsed "How to read this".
                History of each sentence (PERF-STATE-THE-PERIOD, PERF-BOT-FUNNEL, the two legends, #156 CLV)
                is in git; the facts are unchanged, only the density. */}
            <p className="text-xs text-muted-foreground mt-1">
              Since{" "}
              <span className="text-foreground">
                {new Date(`${CALIBRATED_SINCE}T00:00:00Z`).toLocaleDateString("en-GB", {
                  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
                })}
              </span>{" "}
              {/* [[#159]] now TRUE: every figure is flat €10 at the best price available when the
                  pick was made (all books) — one definition, engine view bot_performance. */}
              · flat €10 stakes · ROI at the best price available when each pick was made (all books) · logged before kickoff
              {retiredBotCount > 0 && (
                <>
                  {" "}· <span className="text-foreground">{tabFilteredBots.length + retiredBotCount}</span>{" "}
                  strategies tested, {retiredBotCount} retired
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-400">calibrated</span>proven
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-400">beta</span>early results
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-400">testing</span>collecting
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded border border-yellow-400/40 bg-yellow-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-yellow-300">VIP</span>paid, shown once settled
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">model</span>our model
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300">sharp</span>sharpest line
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded-full border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-teal-300">consensus</span>5+ bookmakers
              </span>
            </div>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none text-foreground/80 hover:text-foreground">How to read this</summary>
              <div className="mt-2 max-w-3xl space-y-2 leading-relaxed">
                <p>
                  The square tag says how much live evidence backs a strategy. VIP is our paid-tier bot: its
                  picks appear here once settled, each marked EV8 (expected value ≥ 8%) or EV5 (5–8%).
                </p>
                <p>
                  The round tag says what sets the fair price: our own probability model, the sharpest single
                  line with its margin removed, or several bookmakers agreeing with the margin removed. The last
                  two use no model and differ only in how many books set the price.
                </p>
                <p>
                  Closing-line value (CLV) on the sharp and consensus rows is measured{" "}
                  <span className="text-foreground">vs the sharp close</span>: our price against Pinnacle&apos;s
                  final line with the margin removed, or a 5+ bookmaker consensus where Pinnacle has none.
                  Positive means the price beat where the market settled. The figure against the book&apos;s own
                  close is shown beside it, but it cannot judge these picks — they are chosen because that
                  book&apos;s price is off, and a price the book never corrects closes where it opened.
                </p>
              </div>
            </details>
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
            {groups.map((g) => [
              <li key={`g-${g.key}`} className="bg-muted/20 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </li>,
              ...g.bots.map((bot) => {
              const isMaturing = !bot.hasEnoughData;
              const isLive = isLiveBot(bot.name);
              const clickable = true;
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
                      {/* 2026-09-25 (owner): the list shows name + labels only; technical name, VIP start
                          date and the CLV breakdown live in the detail view (click the row). */}
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
                      {bot.pnl != null && !isMaturing && (
                        <p className={`mt-0.5 font-mono text-[11px] tabular-nums ${pnlColor(bot.pnl)}`}>
                          {bot.pnl >= 0 ? "+" : ""}€{bot.pnl.toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })])}
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
                <th scope="col" className="py-2.5 px-2 text-right">W / L</th>
                <th scope="col" className="py-2.5 px-2 text-right">ROI</th>
                <th scope="col" className="py-2.5 px-2 text-right" title="Flat €10 per pick">P&L (€)</th>
                {isElite && <th scope="col" className="py-2.5 px-2 text-right">Avg CLV</th>}
                {/* [[#074]] 2026-09-23: no Bankroll column. bots.current_bankroll is on the
                    stored-pnl (high-water odds) basis while P&L / ROI beside it are on the
                    executable basis, so one row showed two contradictory totals (€1,360 vs
                    +€206). It is a live staking input, so its basis is not changed here —
                    the operator sees it on /admin/bots; readers get the honest columns. */}
                <th scope="col" className="py-2.5 px-2 text-center">CLV</th>
                <th scope="col" className="py-2.5 pr-4 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {groups.map((g) => [
                <tr key={`g-${g.key}`} className="bg-muted/20">
                  <td colSpan={isElite ? 8 : 7} className="sticky left-0 py-1.5 pl-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.title}
                  </td>
                </tr>,
                ...g.bots.map((bot) => {
                const isMaturing = !bot.hasEnoughData;
                const isLive = isLiveBot(bot.name);

                return (
                  <tr
                    key={bot.name}
                    className={`group cursor-pointer transition-colors hover:bg-muted/40 ${isMaturing ? "opacity-50" : ""}`}
                    onClick={() => setSelected(bot)}
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
                      {/* 2026-09-25 (owner): name + labels only — details are in the click-open view. */}
                    </td>
                    <td className="py-3 px-2 text-right text-sm tabular-nums">
                      {bot.settled > 0
                        ? <span className={isMaturing ? "text-muted-foreground text-xs" : ""}>{bot.settled}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
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
                    <td className={`py-3 px-2 text-right text-sm tabular-nums font-medium ${
                      isMaturing ? "text-muted-foreground" :
                      bot.roi == null ? "text-muted-foreground" :
                      bot.roi > 0 ? "text-emerald-400" : bot.roi < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {isMaturing ? "—" : fmtPct(bot.roi)}
                    </td>
                      <td className={`py-3 px-2 text-right text-sm tabular-nums ${
                        isMaturing || bot.pnl == null ? "text-muted-foreground" : pnlColor(bot.pnl)
                      }`}>
                        {isMaturing || bot.pnl == null ? "—" : fmt(bot.pnl)}
                      </td>
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
                      <td className="py-3 pr-4">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </td>
                  </tr>
                );
              })])}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* #055 follow-up (2026-09-24): the Pro/Elite upsells were removed — there is no paid
          tier to buy (no checkout), and both links pointed back at /performance itself. */}

      {selected && (
        <BotModal
          bot={selected}
          isElite={isElite}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
