export const dynamic = "force-dynamic";

// /admin/real-bets — the Real bets money ledger (#139 IA move P5, 2026-09-24).
//
// The ONE job (IA J7): what did we actually stake, and how did it go? Real money only — paper
// rows (placed_real = FALSE) are excluded in the loader. Moved here from /admin/shadow-bots:
// today's total against the daily caps (with the "+N by hand" split) and Promotions. New: the
// reconciliation to-do — hand-logged bets the account check has not confirmed after 24 h.
// Was a SELF-USE-VALIDATION page fed by the old "Place real bets" page, deleted in IA move P8b.
// Data: src/lib/admin-money.ts (paged past the 1,000-row cap).

import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, Coins, Euro, LineChart, Scale, Wallet } from "lucide-react";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { DAILY_MAX_BETS, DAILY_MAX_STAKE_EUR, loadMoney, RECONCILE_AFTER_H, unconfirmedToDo, type MoneyBet } from "@/lib/admin-money";
import { MARKET_THRESHOLDS_V2_EPOCH } from "@/lib/engine-data";
import { PageHeader, Panel, PanelHeader, SectionLabel } from "@/components/oi/panel";
import { Sparkline, StatCard } from "@/components/oi/stat-card";
import { StatusBadge } from "@/components/oi/status-badge";
import { fmtEur, fmtInt, fmtPct } from "@/components/oi/format";
import { Promotions } from "@/components/shadow-bots/promotions";
import { BetLogTable, BotMoneyTable, DailyTable, MoneyCharts, ToDoTable, type BotMoneyRow, type DailyRow, type DayPoint, type WeekPoint } from "./money-client";

export const metadata: Metadata = { title: "Real bets · Admin · OddsIntel", robots: { index: false } };

/** Closing-line values beyond ±100% are data errors, not results (ANALYSIS_GOTCHAS outlier guard). */
const CLV_OUTLIER = 1;
/** Fewer bets than this and an average says nothing — the same rule the bot board uses. */
const SMALL_N = 30;

const utcDay = (iso: string) => iso.slice(0, 10);
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
    const k = b.bot ?? "(no bot)";
    m.set(k, [...(m.get(k) ?? []), b]);
  }
  return [...m.entries()].map(([bot, bs]) => {
    const a = aggregate(bs);
    const c = meanClv(bs, (b) => b.clv);
    return { bot, bets: a.total, settled: a.settled, open: a.open, staked: a.staked, pnl: a.pnl, roi: a.roi, clv: c.mean, clvN: c.n, won: a.won, lost: a.lost };
  });
}

export default async function RealBetsPage() {
  if (!isBotBoardDevPreview()) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return <div className="py-24 text-center text-muted-foreground">Access denied.</div>;
    const db = createServerServiceClient();
    const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
    if (!profile?.is_superadmin) return <div className="py-24 text-center text-muted-foreground">Superadmin only.</div>;
  }

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
  const overCap = todayAuto.length >= DAILY_MAX_BETS || autoStake >= DAILY_MAX_STAKE_EUR;

  const overall = aggregate(bets);
  const last30 = aggregate(bets.filter((b) => Date.parse(b.placedAt) >= now.getTime() - 30 * 86_400_000));
  const clv = meanClv(bets, (b) => b.clv);
  const clvPin = meanClv(bets, (b) => b.clvPinnacle);
  const open = bets.filter((b) => !isSettled(b));
  const atRisk = open.reduce((a, b) => a + b.stake, 0);
  const maxPayout = open.reduce((a, b) => a + b.stake * b.actualOdds, 0);
  const todo = unconfirmedToDo(bets, now.getTime());
  const days = cumulative(bets, now);
  const weeks = weekly(bets, now);
  const pnlSpark = weeks.slice(-12).map((w) => w.pnl);
  const hitRate = overall.won + overall.lost > 0 ? overall.won / (overall.won + overall.lost) : null;

  // Paper vs real, on bets placed from a paper pick that have settled on both sides.
  const matched = bets.filter((b) => b.paper && isSettled(b) && b.paper.result !== "pending");
  const pvr = matched.length
    ? {
        n: matched.length,
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

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Money"
        title="Real bets"
        meta={`What we actually staked, and how it went. Real money only — paper bets are not in here. Checked ${hhmm} UTC.`}
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

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Staked"
          icon={Wallet}
          tone="info"
          unknown={unreadable}
          value={fmtEur(overall.staked)}
          foot={`Settled bets, all time · ${fmtEur(last30.staked)} in the last 30 days`}
        />
        <StatCard
          label="Profit / loss"
          icon={Euro}
          tone={overall.pnl > 0 ? "success" : overall.pnl < 0 ? "danger" : "neutral"}
          unknown={unreadable}
          value={<span className={overall.pnl > 0 ? "text-success" : overall.pnl < 0 ? "text-danger" : ""}>{fmtEur(overall.pnl, { signed: true })}</span>}
          spark={<Sparkline values={pnlSpark} kind="bars" signed />}
          foot={`Return on stake ${fmtPct(overall.roi)} · last 30 days ${fmtEur(last30.pnl, { signed: true })}`}
        />
        <StatCard
          label="Beat the close?"
          icon={LineChart}
          tone={clv.mean == null ? "neutral" : clv.mean > 0 ? "success" : "danger"}
          unknown={unreadable || clv.mean == null}
          value={fmtPct(clv.mean)}
          foot={
            clv.n < SMALL_N
              ? `Only ${clv.n} bets with a closing price — too few to trust`
              : `Avg vs the same book's closing price, ${fmtInt(clv.n)} bets · vs Pinnacle ${fmtPct(clvPin.mean)} (${fmtInt(clvPin.n)})`
          }
        />
        <StatCard
          label="Bets"
          icon={Coins}
          unknown={unreadable}
          value={fmtInt(overall.total)}
          foot={`${fmtInt(overall.settled)} settled · ${fmtInt(overall.open)} open · won ${overall.won}, lost ${overall.lost}${overall.void ? `, void ${overall.void}` : ""}${hitRate != null ? ` (${fmtPct(hitRate).replace("+", "")} hit)` : ""}`}
        />
        <StatCard
          label="At risk now"
          icon={Scale}
          tone={atRisk > 0 ? "warning" : "neutral"}
          unknown={unreadable}
          value={fmtEur(atRisk)}
          foot={atRisk > 0 ? `${open.length} open bets · pays up to ${fmtEur(maxPayout)} if all win` : "No open bets"}
        />
        <StatCard
          label="Today (UTC)"
          icon={CalendarClock}
          tone={overCap ? "danger" : "neutral"}
          unknown={unreadable}
          value={`${todayAuto.length + todayHand.length} bets`}
          foot={
            // LOGGED-PICKS-INVISIBLE (2026-09-15): a hand-logged bet is real exposure, so it is in the visible
            // number — but kept apart from the automatic placer's caps, which only count confirmed placements.
            <span title="The caps are the automatic placer's DEFAULT limits — the engine reads COOLBET_MAX_BETS_PER_DAY / COOLBET_MAX_STAKE_PER_DAY from its env, so they are a reference, not necessarily the live limit.">
              Automatic {todayAuto.length}/{DAILY_MAX_BETS} · {fmtEur(autoStake)}/{fmtEur(DAILY_MAX_STAKE_EUR)}
              {todayHand.length > 0 ? ` · +${todayHand.length} by hand ${fmtEur(handStake)}` : ""}
            </span>
          }
        />
      </div>

      {/* ── Reconciliation to-do ── */}
      {!unreadable && todo.length > 0 && (
        <Panel className="min-w-0 border-warning/40">
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                <StatusBadge tone="warning">To do</StatusBadge>
                {todo.length} hand-logged {todo.length === 1 ? "bet is" : "bets are"} still not confirmed on the account
              </span>
            }
            description={`Logged by hand more than ${RECONCILE_AFTER_H} h ago (since 10 Sep), and the account check has not matched a ticket. Check each one at the book: if it was never placed, it is inflating every number on this page.`}
          />
          <div className="p-4 pt-3">
            <ToDoTable bets={todo} />
          </div>
        </Panel>
      )}

      <MoneyCharts daily={days} weekly={weeks} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="min-w-0 lg:col-span-2">
          <PanelHeader title="Results by bot" description="Real money only. Return and average CLV under 30 bets are shown greyed — too few to say anything." />
          <div className="p-4 pt-3">
            <BotMoneyTable rows={perBot(bets)} />
          </div>
        </Panel>
        <Panel className="min-w-0">
          <PanelHeader title="Did we get the paper price?" description="Bets placed from a paper pick, settled on both sides." />
          <div className="space-y-2 p-4 text-sm">
            {pvr ? (
              <>
                <Row label="Real result" value={fmtEur(pvr.real, { signed: true })} tone={pvr.real} />
                <Row label="Same picks on paper" value={fmtEur(pvr.paper, { signed: true })} tone={pvr.paper} />
                <Row label="Lost to worse prices" value={fmtEur(pvr.real - pvr.paper, { signed: true })} tone={pvr.real - pvr.paper} />
                <Row label="Stake matched the paper stake" value={`${pvr.n - pvr.diverged} of ${pvr.n}`} />
                {pvr.n < SMALL_N && <p className="text-xs text-muted-foreground">Only {pvr.n} matched bets — a small sample.</p>}
              </>
            ) : (
              <p className="text-muted-foreground">No real bet has a settled paper twin yet.</p>
            )}
            <details className="border-t border-border pt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Before / after the per-market thresholds ({MARKET_THRESHOLDS_V2_EPOCH.slice(0, 10)})</summary>
              <div className="mt-2 space-y-1 text-xs">
                <Row label={`Before (${preV2.settled} settled)`} value={`${fmtEur(preV2.pnl, { signed: true })} · ${fmtPct(preV2.roi)}`} tone={preV2.pnl} />
                <Row label={`After (${postV2.settled} settled)`} value={`${fmtEur(postV2.pnl, { signed: true })} · ${fmtPct(postV2.roi)}`} tone={postV2.pnl} />
              </div>
            </details>
          </div>
        </Panel>
      </div>

      <section className="space-y-2">
        <SectionLabel>Promotions</SectionLabel>
        <Promotions promos={d.promos} error={d.promoError} />
      </section>

      <Panel>
        <PanelHeader title="Every real bet" description="Newest first. Filter by bot, result, market or whether the account check has confirmed it; export what you see as CSV." />
        <div className="p-4 pt-3">
          <BetLogTable bets={bets} />
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
