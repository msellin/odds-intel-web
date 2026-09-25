export const dynamic = 'force-dynamic';

import { allBlockStates, coolbetBlockRisk, feedHealth, feedsAnswer } from "@/lib/admin-feeds-model";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, CirclePause, CircleStop, ShieldAlert, Server } from "lucide-react";
import { AutoRefreshBadge } from "../ops/auto-refresh";
import { Meter, shareTone } from "../ops/meter";
import { FeedsBoard } from "./feeds-board";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { AF_DAILY_BUDGET, budgetSentence, budgetView, loadFeedsPage, STATUS_STALE_MIN, type BudgetView } from "@/lib/admin-feeds";
import { DqFindings } from "./dq-findings";
import { isBotBoardDevPreview, loadControlState } from "@/lib/bot-board";
import { FootprintControl } from "./footprint-control";
import { CoverageChart } from "./feeds-charts";
import { PageHeader, Panel, PanelHeader } from "@/components/oi/panel";
import { AnswerStrip, type Answer } from "@/components/oi/answer-strip";
import { StatusBadge } from "@/components/oi/status-badge";
import { fmtInt } from "@/components/oi/format";
import { InfoTip } from "@/components/oi/info-tip";

// FEEDS-DASHBOARD (#107). Data: feed_status / feed_book_stats, written every 5 min
// by the engine (workers/jobs/feed_health.py, registry workers/registry/
// feed_registry.py). Layout (redesigned 2026-09-23 on the owner's brief): one
// block per book — name + last odds time, coloured by age — details behind a
// click. See feeds-board.tsx.
//
// #139 admin redesign (2026-09-24): "is data coming in, and at what cost?" — KPI cards, the book
// blocks, the Coolbet sweeping switch beside Coolbet's request budget, a coverage chart, and the
// odds-pipeline / live-tracker / API-Football-budget numbers moved here from /admin/ops (IA §2.1).
// Loader: src/lib/admin-feeds.ts (every read keeps its error — unreadable never reads as all clear).

export const metadata: Metadata = { title: "Feeds · Admin · OddsIntel", robots: { index: false } };

export default async function FeedsPage() {
  let user: { id: string } | null = null;
  if (!isBotBoardDevPreview()) {
    const supabase = await createSupabaseServer();
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
    }
    const db = createServerServiceClient();
    const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", u.id).single();
    if (!profile?.is_superadmin) {
      return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
    }
    user = u;
  }

  const [d, controls] = await Promise.all([loadFeedsPage(), user ? loadControlState(user.id) : loadControlState(null)]);
  const { now } = d;
  const feeds = d.feeds.v;
  const updated = feeds.reduce<string | null>((a, f) => (!a || f.updated_at > a ? f.updated_at : a), null);
  const statusAgeMin = updated ? Math.round((now - new Date(updated).getTime()) / 60000) : null;
  // A status check older than STATUS_STALE_MIN is not a claim we can make: the counts go "unknown" (grey).
  const statusStale = statusAgeMin == null || statusAgeMin > STATUS_STALE_MIN;
  const feedsUnknown = !!d.feeds.error || statusStale;
  const paused = feeds.filter((f) => feedHealth(f) === "paused").length;

  // ONE source for every "this hour" figure on the page: book_footprint through budgetView (answer-first
  // fix round 2026-09-25 — the answer said 348/500 while the panel said 376/500).
  const budgets = new Map<string, BudgetView>(
    d.footprint.error ? [] : d.books.v.filter((b) => b.budget_1h != null).map((b) => [b.book, budgetView(b.book, b.budget_1h, d.footprint.v, now)]),
  );
  const cb = d.books.v.find((b) => b.book === "Coolbet");
  const cbBudget = budgets.get("Coolbet") ?? null;
  const cbShare = cbBudget?.cap ? cbBudget.requests / cbBudget.cap : null;
  const risk = coolbetBlockRisk(cbBudget);
  const s = d.snapshot.v;
  const afCalls = s?.af_calls_today ?? null;
  const afShare = afCalls != null ? afCalls / AF_DAILY_BUDGET : null;
  const liveAge = d.lastLiveAt.v ? Math.round((now - new Date(d.lastLiveAt.v).getTime()) / 60000) : null;
  const snapAge = s ? Math.round((now - new Date(s.created_at).getTime()) / 60000) : null;
  const snapNote = d.snapshot.error
    ? `Unreadable: ${d.snapshot.error}`
    : !s
      ? "No summary for today yet — the engine writes one every hour."
      : `Figures from ${snapAge} min ago (updated hourly).`;

  // The Feeds answer is computed from the SAME block tones the board shows (Rule 1: a headline never
  // contradicts the detail). Blocks, not the 23 internal checks, are what the owner sees and counts.
  const blocks = allBlockStates(feeds, budgets, now, statusStale);
  const fa = feedsAnswer(blocks, { error: !!d.feeds.error, stale: statusStale });
  const answers: Answer[] = [
    {
      label: "Feeds",
      ...fa,
      href: fa.href === "#" ? undefined : fa.href,
      icon: fa.tone === "danger" ? CircleStop : fa.tone === "warning" ? AlertTriangle : CheckCircle2,
    },
    feedsUnknown
      ? { label: "Paused by us", text: "Can't tell — feed status unreadable", tone: "warning", icon: CirclePause }
      : paused
        ? { label: "Paused by us", text: `${paused} feed${paused === 1 ? "" : "s"} paused on purpose`, tone: "info", icon: CirclePause }
        : { label: "Paused by us", text: "Nothing paused", tone: "neutral", icon: CirclePause },
    { label: "Coolbet block risk", text: risk.word, sub: risk.sub, tone: risk.tone, icon: ShieldAlert, href: "#coolbet-footprint" },
    {
      label: "API-Football",
      text: afShare == null ? "Unknown" : `${Math.round(afShare * 100)}% of today's calls used`,
      sub: afCalls != null ? `${fmtInt(afCalls)} of ${fmtInt(AF_DAILY_BUDGET)} · resets 00:00 UTC` : undefined,
      tone: afShare == null ? "neutral" : afShare > 0.8 ? "danger" : afShare > 0.5 ? "warning" : "success",
      icon: Server,
      href: "#af-budget",
    },
  ];

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Data & ops"
        title="Feeds"
        meta={
          <>
            Is odds data coming in?
            {statusStale && (
              <span className="text-danger">
                {" "}
                {statusAgeMin == null ? "No status check recorded yet" : `The status check is ${statusAgeMin} min late`} — colours below are grey (unknown).
              </span>
            )}
          </>
        }
        actions={<AutoRefreshBadge intervalMs={60_000} checkedAt={now} dataAt={updated} />}
      />

      {d.feeds.error && (
        <Panel className="border-warning/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle size={14} aria-hidden="true" /> Feed status unreadable ({d.feeds.error}) — the blocks below are not an all-clear.
          </p>
        </Panel>
      )}

      {/* ── The answers first (answer-first pass 2026-09-25): which feeds are down, what they cost ── */}
      <AnswerStrip answers={answers} />

      {/* ── Book blocks ── */}
      <Panel>
        <PanelHeader
          title="Bookmakers"
          description={
            <>
              Time since each book&apos;s last odds. <span className="text-success">Green</span>: within its normal refresh;{" "}
              <span className="text-warning">amber</span>: late; <span className="text-danger">red</span>: stopped;{" "}
              <span className="text-info">blue</span>: paused by us; grey: unknown. Behind these {blocks.length} blocks are {feeds.length} separate
              checks, run every 5 minutes. Click a block for details, Pause / Resume and Run now.
            </>
          }
        />
        <div className="p-4 pt-3">
          {feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {d.feeds.error ? "Unreadable — see above." : "No status yet — the engine writes it every 5 minutes."}
            </p>
          ) : (
            <FeedsBoard feeds={feeds} books={d.books.v} footprint={d.footprint.error ? null : d.footprint.v} now={now} statusAgeMin={statusAgeMin} preview={isBotBoardDevPreview()} />
          )}
        </div>
      </Panel>

      {/* ── Coolbet area + coverage chart ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FootprintControl state={controls} now={now}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Meter
              label={
                <span className="inline-flex items-center gap-1">
                  Requests · this hour
                  <InfoTip>
                    At the hourly limit we stop sending requests until the next hour, so Coolbet does not block us.
                    {cbBudget ? ` This hour: ${cbBudget.challenges} block checks, ${cbBudget.errors} errors; ${fmtInt(cbBudget.requests24h)} requests in the last 24 h.` : ""}
                  </InfoTip>
                </span>
              }
              value={cbBudget?.requests}
              total={cbBudget?.cap}
              tone={cbShare == null ? "neutral" : cbShare >= 1 ? "danger" : cbShare >= 0.8 ? "warning" : "success"}
            />
            <Meter
              label={
                <span className="inline-flex items-center gap-1">
                  Closing prices · last 24 h
                  <InfoTip>Matches that kicked off in the last 24 h with a Coolbet price in the final 15 minutes before kick-off.</InfoTip>
                </span>
              }
              value={cb?.closing_captured_24h}
              total={cb?.closing_priced_24h}
              tone={shareTone(cb?.closing_captured_24h, cb?.closing_priced_24h, 0.8, 0.5)}
            />
          </div>
          {d.footprint.error ? (
            <p className="mt-2 text-xs text-warning">Coolbet request counts unreadable ({d.footprint.error}).</p>
          ) : cbBudget && (cbBudget.lastSpent || cbBudget.strayRefusals || cbBudget.spentNow) ? (
            <p className="mt-2 text-xs text-muted-foreground">{budgetSentence(cbBudget)}</p>
          ) : null}
        </FootprintControl>
        <CoverageChart books={d.books.v} error={d.books.error} />
      </div>

      {/* ── Moved from /admin/ops: odds pipeline, live tracker, API-Football budget ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Odds for today's matches"
            description="Pre-match odds for today's matches, all books together. Bookmakers open prices through the day, so early-morning shares are low; about 75–80% by evening is typical — youth, reserve and small leagues are rarely priced."
            actions={s ? <StatusBadge tone="neutral" dot={false}>{fmtInt(s.matches_today)} matches</StatusBadge> : <StatusBadge tone="warning">No snapshot</StatusBadge>}
          />
          <div className="grid gap-3 p-4 pt-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Meter label="Have odds" value={s?.matches_with_odds} total={s?.matches_today} tone={shareTone(s?.matches_with_odds, s?.matches_today)} note="At least one book prices the match." />
            <Meter
              label={
                <span className="inline-flex items-center gap-1">
                  Priced by the sharpest bookmaker
                  <InfoTip>
                    Pinnacle {s?.matches_with_pinnacle ?? "—"} · Betfair with enough money matched {s?.matches_with_exchange_liquid ?? "—"}. This price is
                    what every expected advantage is measured against.
                  </InfoTip>
                </span>
              }
              value={s?.matches_with_sharp ?? s?.matches_with_pinnacle}
              total={s?.matches_today}
              tone={shareTone(s?.matches_with_sharp ?? s?.matches_with_pinnacle, s?.matches_today, 0.6, 0.3)}
            />
            <Meter label="Match result" value={s?.odds_market_match_winner} total={s?.matches_today} tone={shareTone(s?.odds_market_match_winner, s?.matches_today)} />
            <Meter label="Over/under 2.5 goals" value={s?.odds_market_goals_ou} total={s?.matches_today} tone={shareTone(s?.odds_market_goals_ou, s?.matches_today)} />
            <Meter label="Both teams score" value={s?.odds_market_btts} total={s?.matches_today} tone={shareTone(s?.odds_market_btts, s?.matches_today)} />
            <Meter
              label="Bookmakers with a price today"
              value={s?.distinct_bookmakers}
              tone={s?.distinct_bookmakers != null && s.distinct_bookmakers < 3 ? "danger" : "neutral"}
              note={`Includes books we can't bet at · ${fmtInt(s?.odds_snapshots_today)} prices stored today`}
            />
          </div>
          <p className="px-4 pb-4 text-xs text-muted-foreground">{snapNote}</p>
        </Panel>

        <div className="grid gap-4">
          <Panel id="af-budget">
            <PanelHeader
              title="API-Football daily budget"
              description="Our plan allows 150,000 calls a day across every job, reset at midnight UTC. It carries fixtures, 9 bookmakers' odds (the sharpest one, Pinnacle, included), live scores and match data."
            />
            <div className="p-4 pt-3">
              <Meter
                label="Calls today"
                value={afCalls}
                total={AF_DAILY_BUDGET}
                tone={afShare == null ? "neutral" : afShare > 0.8 ? "danger" : afShare > 0.5 ? "warning" : "success"}
                note={
                  afCalls != null
                    ? `${fmtInt(s?.af_budget_remaining)} left today`
                    : snapNote
                }
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader
              title="Live tracker"
              description="Follows games in play for scores and events (used to settle bets). It polls about once a minute while games are on; outside match hours a long gap is normal."
            />
            <div className="grid gap-3 p-4 pt-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Meter label="Games followed today" value={s?.live_games_tracked} note={`${fmtInt(s?.live_snapshots_today)} live updates stored today`} />
              <Meter
                label="Last live update"
                value={liveAge}
                suffix={liveAge != null ? " min ago" : null}
                tone={liveAge != null && liveAge > 60 ? "warning" : "neutral"}
                note={d.lastLiveAt.error ? `Unreadable: ${d.lastLiveAt.error}` : "Over 60 min is normal only when no game is on"}
              />
              <Meter label="Games with expected goals" value={s?.live_games_with_xg} total={s?.live_games_tracked} tone="neutral" note="Only top leagues publish it" />
              <Meter
                label="Games with live over/under odds"
                value={s?.live_games_with_odds}
                total={s?.live_games_tracked}
                tone="neutral"
                note="Not used since in-play betting stopped (21 Aug)"
              />
            </div>
          </Panel>
        </div>
      </div>

      <DqFindings findings={d.dq.v} now={now} error={d.dq.error} />
    </div>
  );
}
