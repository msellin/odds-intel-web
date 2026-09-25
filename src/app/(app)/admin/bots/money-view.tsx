// Real money view of /admin/bots (`?section=money`) — the money ledger. #162 W6.8 (2026-09-26):
// this was the /admin/real-bets page. Owner, 2026-09-25: the page is not used and its information
// belongs on the bot view. It moved here unchanged in content (answers, € P/L, the cross-bot table,
// the reconcile to-do, today's use of the daily limit, charts, promotions, the full ledger);
// /admin/real-bets now redirects to /admin/bots?section=money. It is a SEPARATE section of the bots
// page, not a card on the board, so the board's render does not pay for up to 5 pages of real_bets
// (loadMoney) and the money render does not pay for the board. The superadmin check is the bots
// page's (page.tsx), made before this component renders.
//
// History — /admin/real-bets, the Real bets money ledger (#139 IA move P5, 2026-09-24):
//
// The ONE job (IA J7): what did we actually stake, and how did it go? Real money only — paper
// rows (placed_real = FALSE) are excluded in the loader. Moved here from /admin/shadow-bots:
// today's total against the daily caps (with the "+N by hand" split) and Promotions. New: the
// reconciliation to-do — hand-logged bets the account check has not confirmed after 24 h.
// Was a SELF-USE-VALIDATION page fed by the old "Place real bets" page, deleted in IA move P8b.
// Data: src/lib/admin-money.ts (paged past the 1,000-row cap).
//
// Answer-first round (2026-09-25): the page opens with four plain answers (last 30 days, all time,
// open now, to do) before any card; the Staked / P&L / At-risk cards they replaced are gone, the
// three cards left add something the answers do not (price vs the final price, won/lost, today's
// limits). Every figure names its period; the technical terms sit behind ⓘ.

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Coins, Euro, History, LineChart, Scale } from "lucide-react";
import {
  DAILY_MAX_BETS,
  DAILY_MAX_STAKE_EUR,
  loadMoney,
  moneyBotLabel,
  realMoneyWindow,
  RECONCILE_AFTER_H,
  RECONCILE_FROM,
  unconfirmedToDo,
  type MoneyBet,
} from "@/lib/admin-money";
import { MARKET_THRESHOLDS_V2_EPOCH } from "@/lib/engine-data";
import { PageHeader, Panel, PanelHeader, SectionLabel } from "@/components/oi/panel";
import { StatCard } from "@/components/oi/stat-card";
import { AnswerStrip, type Answer } from "@/components/oi/answer-strip";
import { InfoTip } from "@/components/oi/info-tip";
import { StatusBadge } from "@/components/oi/status-badge";
import { fmtEur, fmtInt, fmtPct } from "@/components/oi/format";
import { Promotions } from "@/components/shadow-bots/promotions";
import { BetLogTable, BotMoneyTable, DailyTable, MoneyCharts, ToDoTable, type BotMoneyRow, type DailyRow, type DayPoint, type WeekPoint } from "./money-client";

/** Closing-line values beyond ±100% are data errors, not results (ANALYSIS_GOTCHAS outlier guard). */
const CLV_OUTLIER = 1;
/** Fewer bets than this and an average says nothing — the same rule the bot board uses. */
const SMALL_N = 30;

const utcDay = (iso: string) => iso.slice(0, 10);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const earliest = (bets: MoneyBet[]) => bets.reduce<string | null>((a, b) => (a == null || b.placedAt < a ? b.placedAt : a), null);
const latest = (bets: MoneyBet[]) => bets.reduce<string | null>((a, b) => (a == null || b.placedAt > a ? b.placedAt : a), null);

/** "Better than the final price?" in words — the sign and size of the average, not a raw %. */
function clvVerdict(mean: number | null): string {
  if (mean == null) return "No data yet";
  const a = Math.abs(mean);
  if (a < 0.005) return "About the same";
  if (a < 0.02) return mean > 0 ? "Slightly better" : "Slightly worse";
  return mean > 0 ? "Better" : "Worse";
}
const isSettled = (b: MoneyBet) => b.result !== "pending";

interface Agg {
  total: number;
  settled: number;
  open: number;
  won: number;
  lost: number;
  void: number;
  staked: number;
  pnl: number;
  roi: number | null;
}
function aggregate(bets: MoneyBet[]): Agg {
  const s = bets.filter(isSettled);
  const staked = s.reduce((a, b) => a + b.stake, 0);
  const pnl = s.reduce((a, b) => a + (b.pnl ?? 0), 0);
  return {
    total: bets.length,
    settled: s.length,
    open: bets.length - s.length,
    won: s.filter((b) => b.result === "won").length,
    lost: s.filter((b) => b.result === "lost").length,
    // voids neither won nor lost, so they are counted apart and left out of the hit rate
    void: s.filter((b) => b.result === "void").length,
    staked,
    pnl,
    roi: staked > 0 ? pnl / staked : null,
  };
}

function meanClv(bets: MoneyBet[], pick: (b: MoneyBet) => number | null): { mean: number | null; n: number } {
  const v = bets.filter(isSettled).map(pick).filter((x): x is number => x != null && Number.isFinite(x) && Math.abs(x) <= CLV_OUTLIER);
  return { mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length };
}

function mondayOf(iso: string): string {
  const d = new Date(`${utcDay(iso)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Every day from the first settlement to today, so a range button means calendar days. */
function cumulative(bets: MoneyBet[], now: Date): DayPoint[] {
  const byDay = new Map<string, { real: number; paper: number; hasPaper: boolean }>();
  for (const b of bets.filter(isSettled)) {
    const day = utcDay(b.resolvedAt ?? b.placedAt);
    const d = byDay.get(day) ?? { real: 0, paper: 0, hasPaper: false };
    d.real += b.pnl ?? 0;
    if (b.paper && b.paper.result !== "pending") {
      d.paper += b.paper.pnl ?? 0;
      d.hasPaper = true;
    }
    byDay.set(day, d);
  }
  const days = [...byDay.keys()].sort();
  if (!days.length) return [];
  const out: DayPoint[] = [];
  let real = 0;
  let paper = 0;
  let paperSeen = false;
  const end = utcDay(now.toISOString());
  for (let t = Date.parse(`${days[0]}T00:00:00Z`); ; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const d = byDay.get(day);
    if (d) {
      real += d.real;
      if (d.hasPaper) {
        paper += d.paper;
        paperSeen = true;
      }
    }
    out.push({ day, real: Math.round(real * 100) / 100, paper: paperSeen ? Math.round(paper * 100) / 100 : null });
    if (day >= end) break;
  }
  return out;
}

function weekly(bets: MoneyBet[], now: Date): WeekPoint[] {
  const m = new Map<string, WeekPoint>();
  for (const b of bets) {
    const w = mondayOf(b.placedAt);
    const r = m.get(w) ?? { week: w, staked: 0, pnl: 0, bets: 0 };
    r.staked += b.stake;
    r.bets += 1;
    if (isSettled(b)) r.pnl += b.pnl ?? 0;
    m.set(w, r);
  }
  const weeks = [...m.keys()].sort();
  if (!weeks.length) return [];
  // fill empty weeks with zeros up to this week, so quiet weeks show as quiet
  const out: WeekPoint[] = [];
  const last = mondayOf(now.toISOString());
  for (let t = Date.parse(`${weeks[0]}T00:00:00Z`); ; t += 7 * 86_400_000) {
    const w = new Date(t).toISOString().slice(0, 10);
    const r = m.get(w) ?? { week: w, staked: 0, pnl: 0, bets: 0 };
    out.push({ ...r, staked: Math.round(r.staked * 100) / 100, pnl: Math.round(r.pnl * 100) / 100 });
    if (w >= last) break;
  }
  return out;
}

function daily(bets: MoneyBet[], days: number): DailyRow[] {
  const m = new Map<string, DailyRow>();
  for (const b of bets) {
    const day = utcDay(b.placedAt);
    const r = m.get(day) ?? { day, bets: 0, settled: 0, staked: 0, pnl: 0, roi: null };
    r.bets += 1;
    if (isSettled(b)) {
      r.settled += 1;
      r.staked += b.stake;
      r.pnl += b.pnl ?? 0;
    }
    m.set(day, r);
  }
  for (const r of m.values()) r.roi = r.staked > 0 ? r.pnl / r.staked : null;
  return [...m.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, days);
}

function perBot(bets: MoneyBet[]): BotMoneyRow[] {
  const m = new Map<string, MoneyBet[]>();
  for (const b of bets) {
    const k = b.bot ?? "";
    m.set(k, [...(m.get(k) ?? []), b]);
  }
  return [...m.entries()].map(([botId, bs]) => {
    const a = aggregate(bs);
    const c = meanClv(bs, (b) => b.clv);
    return { bot: moneyBotLabel(bs[0]), botId: botId || null, bets: a.total, settled: a.settled, open: a.open, staked: a.staked, pnl: a.pnl, roi: a.roi, clv: c.mean, clvN: c.n, won: a.won, lost: a.lost };
  });
}

/** Rendered by /admin/bots/page.tsx for `?section=money`, after its superadmin check. */
export async function RealMoneyView({ tabs }: { tabs: React.ReactNode }) {
  const d = await loadMoney();
  const bets = d.bets;
  const unreadable = d.betsError != null;
  const now = new Date();
  // Today in UTC — the engine and settlement run on UTC.
  const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayBets = bets.filter((b) => new Date(b.placedAt) >= todayStartUtc);
  const todayAuto = todayBets.filter((b) => b.placedReal === true);
  const todayHand = todayBets.filter((b) => b.placedReal == null);
  const autoStake = todayAuto.reduce((a, b) => a + b.stake, 0);
  const handStake = todayHand.reduce((a, b) => a + b.stake, 0);
  // #162 W4.2 (engine spent_today, 2026-09-25): the daily limit counts EVERY real or unverified bet at
  // every book — hand-logged ones included — so this reads the same as the engine that refuses.
  const overCap = todayAuto.length + todayHand.length >= DAILY_MAX_BETS || autoStake + handStake >= DAILY_MAX_STAKE_EUR;

  const overall = aggregate(bets);
  // The SAME window definition as the Overview's real-money card (realMoneyWindow in admin-money.ts):
  // placed in the last 30 × 24 h, paper excluded, staked = every bet placed, P/L = settled only.
  const last30 = realMoneyWindow(bets, now, 30);
  const clv = meanClv(bets, (b) => b.clv);
  const clvPin = meanClv(bets, (b) => b.clvPinnacle);
  const open = bets.filter((b) => !isSettled(b));
  const atRisk = open.reduce((a, b) => a + b.stake, 0);
  const maxPayout = open.reduce((a, b) => a + b.stake * b.actualOdds, 0);
  const todo = unconfirmedToDo(bets, now.getTime());
  const days = cumulative(bets, now);
  const weeks = weekly(bets, now);
  const hitRate = overall.won + overall.lost > 0 ? overall.won / (overall.won + overall.lost) : null;

  // Paper vs real, on bets placed from a paper pick that have settled on both sides.
  const matched = bets.filter((b) => b.paper && isSettled(b) && b.paper.result !== "pending");
  const pvr = matched.length
    ? {
        n: matched.length,
        from: earliest(matched) as string,
        to: latest(matched) as string,
        real: matched.reduce((a, b) => a + (b.pnl ?? 0), 0),
        paper: matched.reduce((a, b) => a + (b.paper?.pnl ?? 0), 0),
        diverged: matched.filter((b) => Math.abs(b.stake - (b.paper?.stake ?? 0)) >= 0.01).length,
      }
    : null;

  // The per-market threshold change (PER-MARKET-EDGE-V2, 2026-06-06): before vs after.
  const epoch = Date.parse(MARKET_THRESHOLDS_V2_EPOCH);
  const preV2 = aggregate(bets.filter((b) => Date.parse(b.placedAt) < epoch));
  const postV2 = aggregate(bets.filter((b) => Date.parse(b.placedAt) >= epoch));

  const hhmm = new Date(d.loadedAt).toISOString().slice(11, 16);
  const nowMs = now.getTime();
  const firstBet = earliest(bets);
  const epochLabel = shortDate(MARKET_THRESHOLDS_V2_EPOCH);
  // Hand-logged bets are all Coolbet today; name the book only when that is true.
  const todoBooks = [...new Set(todo.map((b) => b.bookmaker))];
  const todoAccount = todoBooks.length === 1 ? `your ${todoBooks[0]} account` : "your bookmaker accounts";
  const todoText = `${todo.length} hand-placed ${todo.length === 1 ? "bet" : "bets"} not matched to ${todoAccount}`;
  const usedN = todayAuto.length + todayHand.length;
  const autoUsed = usedN > 0 ? `${usedN} bets / ${fmtEur(autoStake + handStake)} used today` : "none used today";

  const answers: Answer[] = unreadable
    ? [{ label: "Real bets", text: "Can't tell — the real-bet ledger could not be read", tone: "warning", icon: AlertTriangle }]
    : [
        // SAME function + window as the Overview's "Real bets · 30 days" answer (realMoneyWindow)
        { label: "Last 30 days", text: `${fmtEur(last30.pnl, { signed: true })} on ${fmtInt(last30.bets)} bets`, sub: `${fmtEur(last30.staked)} staked, open bets included`, tone: last30.pnl > 0 ? "success" : last30.pnl < 0 ? "danger" : "neutral", alarm: false, icon: Euro },
        {
          label: firstBet ? `All time · since ${shortDate(firstBet)}` : "All time",
          text: `${fmtEur(overall.pnl, { signed: true })} on ${fmtEur(overall.staked)} staked`,
          sub: `return ${fmtPct(overall.roi)} on settled bets`,
          tone: overall.pnl > 0 ? "success" : overall.pnl < 0 ? "danger" : "neutral",
          alarm: false,
          icon: History,
        },
        atRisk > 0
          ? { label: "Open now", text: `${fmtEur(atRisk)} at risk on ${fmtInt(open.length)} ${open.length === 1 ? "bet" : "bets"}`, sub: `pays up to ${fmtEur(maxPayout)} if all win`, tone: "info", icon: Scale }
          : { label: "Open now", text: "Nothing at risk", tone: "neutral", icon: Scale },
        todo.length > 0
          ? { label: "To do", text: todoText, tone: "warning", icon: ClipboardCheck, href: "#todo" }
          : { label: "To do", text: "Nothing — every hand-placed bet is matched", tone: "success", icon: CheckCircle2 },
      ];

  return (
    <div className="space-y-4 lg:space-y-6">
      {tabs}
      <PageHeader
        eyebrow="Bots & money"
        title="Real money"
        meta={`Real money only · checked ${hhmm} UTC`}
        actions={
          <Link href="/admin/shadow-bots" className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            Pick queue →
          </Link>
        }
      />

      {unreadable && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Real bets are unreadable right now ({d.betsError}). Every number below would be wrong, so they are shown as unknown.
          </span>
        </div>
      )}

      <AnswerStrip answers={answers} />

      {/* ── Three cards that add something the answers do not ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Price vs final price"
          icon={LineChart}
          tone={clv.mean == null || clv.n < SMALL_N ? "neutral" : clv.mean > 0 ? "success" : "danger"}
          unknown={unreadable || clv.mean == null}
          value={clvVerdict(clv.mean)}
          foot={
            <span className="inline-flex items-center gap-1">
              {clv.n < SMALL_N ? `Only ${fmtInt(clv.n)} bets — too few to trust` : `${fmtPct(clv.mean)}, ${fmtInt(clv.n)} bets, all time`}
              <InfoTip>
                Average of our price ÷ the same bookmaker&apos;s final price before kickoff − 1 (closing-line value, CLV), settled bets since{" "}
                {firstBet ? shortDate(firstBet) : "the first bet"}. Against the sharpest bookmaker&apos;s final price (Pinnacle, margin removed): {fmtPct(clvPin.mean)} on{" "}
                {fmtInt(clvPin.n)} bets. Above 0 means we usually got a better price than the market settled on.
              </InfoTip>
            </span>
          }
        />
        <StatCard
          label="Bets · all time"
          icon={Coins}
          unknown={unreadable}
          value={fmtInt(overall.total)}
          foot={`won ${fmtInt(overall.won)} · lost ${fmtInt(overall.lost)}${overall.void ? ` · void ${overall.void}` : ""}${hitRate != null ? ` · ${Math.round(hitRate * 100)}% won` : ""}`}
        />
        <StatCard
          label="Today (UTC)"
          icon={CalendarClock}
          tone={overCap ? "danger" : "neutral"}
          unknown={unreadable}
          value={`${todayAuto.length + todayHand.length} bets`}
          foot={
            // LOGGED-PICKS-INVISIBLE (2026-09-15): a hand-logged bet is real exposure, so it is in the visible
            // number — and since #162 W4.2 (2026-09-25) it counts against the daily caps too, as in the engine.
            <span className="inline-flex items-center gap-1">
              <span>
                Daily limit: {DAILY_MAX_BETS} bets / {fmtEur(DAILY_MAX_STAKE_EUR)} ({autoUsed})
                {todayHand.length > 0 ? ` · ${todayHand.length} of them by hand` : ""}
              </span>
              <InfoTip>
                The automatic placer&apos;s daily limits (defaults — the engine reads COOLBET_MAX_BETS_PER_DAY / COOLBET_MAX_STAKE_PER_DAY, so the live limit may differ).
                Every real or unverified bet today counts against these limits — at every bookmaker, bets logged by hand included.
              </InfoTip>
            </span>
          }
        />
      </div>

      {/* ── Reconciliation to-do ── */}
      {!unreadable && todo.length > 0 && (
        <Panel id="todo" className="min-w-0 scroll-mt-20 border-warning/40">
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <StatusBadge tone="warning">To do</StatusBadge>
                {todoText}
              </span>
            }
            description={`Logged by hand on or after ${shortDate(RECONCILE_FROM)}, more than ${RECONCILE_AFTER_H} h ago, and the account check found no matching ticket. Check each one at the bookmaker: if it was never placed, it is inflating every number on this page. Older hand-logged bets show as "Old entry" in the table below — the check did not exist yet, so there is nothing to do for them.`}
          />
          <div className="p-4 pt-3">
            <ToDoTable bets={todo} now={nowMs} />
          </div>
        </Panel>
      )}

      <MoneyCharts daily={days} weekly={weeks} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="min-w-0 lg:col-span-2">
          <PanelHeader title={firstBet ? `Results by bot · since ${shortDate(firstBet)}` : "Results by bot"} description="Real money only, all time. The price comparison is greyed under 30 bets — too few to say anything." />
          <div className="p-4 pt-3">
            <BotMoneyTable rows={perBot(bets)} />
          </div>
        </Panel>
        <Panel className="min-w-0">
          <PanelHeader
            title="Did we get the paper price?"
            description={
              pvr
                ? `Only real bets placed from a paper pick and settled on both sides: ${pvr.n} of the ${overall.settled} settled real bets, placed ${shortDate(pvr.from)} – ${shortDate(pvr.to)}. Because it is that subset, its real result differs from the all-time total (${fmtEur(overall.pnl, { signed: true })}). "Lost to worse prices" is the real result minus what the same picks made on paper.`
                : "Real bets placed from a paper pick, settled on both sides."
            }
          />
          <div className="space-y-2 p-4 text-sm">
            {pvr ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {shortDate(pvr.from)} – {shortDate(pvr.to)} · {fmtInt(pvr.n)} bets
                </p>
                <Row label="Real result" value={fmtEur(pvr.real, { signed: true })} tone={pvr.real} />
                <Row label="Same picks on paper" value={fmtEur(pvr.paper, { signed: true })} tone={pvr.paper} />
                <Row label="Lost to worse prices" value={fmtEur(pvr.real - pvr.paper, { signed: true })} tone={pvr.real - pvr.paper} />
                <Row label="Stake matched the paper stake" value={`${pvr.n - pvr.diverged} of ${pvr.n}`} />
                {pvr.n < SMALL_N && <p className="text-xs text-muted-foreground">Only {pvr.n} bets — a small sample.</p>}
              </>
            ) : (
              <p className="text-muted-foreground">No real bet has a settled paper twin yet.</p>
            )}
            <details className="border-t border-border pt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Before / after the new per-market minimums ({epochLabel})</summary>
              <div className="mt-2 space-y-1 text-xs">
                <Row label={`Before ${epochLabel} (${preV2.settled} bets)`} value={`${fmtEur(preV2.pnl, { signed: true })} · ${fmtPct(preV2.roi)}`} tone={preV2.pnl} />
                <Row label={`From ${epochLabel} (${postV2.settled} bets)`} value={`${fmtEur(postV2.pnl, { signed: true })} · ${fmtPct(postV2.roi)}`} tone={postV2.pnl} />
              </div>
            </details>
          </div>
        </Panel>
      </div>

      {/* Promotions: hidden while none is recorded (a read failure still shows — "none" and
          "unreadable" must not look the same). */}
      {(d.promos.length > 0 || d.promoError) && (
        <section className="space-y-2">
          <SectionLabel>Promotions</SectionLabel>
          <Promotions promos={d.promos} error={d.promoError} />
        </section>
      )}

      <Panel>
        <PanelHeader
          title={firstBet ? `Every real bet · since ${shortDate(firstBet)}` : "Every real bet"}
          description={`Newest first. Filter by bot, result, market or whether the account check has confirmed it; export what you see as CSV. Bets logged by hand before ${shortDate(RECONCILE_FROM)} show as "Old entry" — the account check did not exist yet.`}
        />
        <div className="p-4 pt-3">
          <BetLogTable bets={bets} now={nowMs} />
        </div>
      </Panel>

      <details className="rounded-xl border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Day by day, last 14 days</summary>
        <div className="border-t border-border p-4">
          <DailyTable rows={daily(bets, 14)} />
        </div>
      </details>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: number }) {
  const cls = tone == null || tone === 0 ? "" : tone > 0 ? "text-success" : "text-danger";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}
