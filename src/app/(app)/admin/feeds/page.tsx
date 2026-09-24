export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, CirclePause, CircleStop, Gauge, Server } from "lucide-react";
import { AutoRefreshBadge } from "../ops/auto-refresh";
import { Meter, shareTone } from "../ops/meter";
import { FeedsBoard } from "./feeds-board";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { AF_DAILY_BUDGET, loadFeedsPage } from "@/lib/admin-feeds";
import { DqFindings } from "./dq-findings";
import { isBotBoardDevPreview, loadControlState } from "@/lib/bot-board";
import { FootprintControl } from "./footprint-control";
import { CoverageChart } from "./feeds-charts";
import { PageHeader, Panel, PanelHeader } from "@/components/oi/panel";
import { StatCard } from "@/components/oi/stat-card";
import { StatusBadge } from "@/components/oi/status-badge";
import { fmtInt } from "@/components/oi/format";

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

const STATUS_STUCK_MIN = 15;

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
  const count = (s: string) => feeds.filter((f) => f.status === s).length;
  const fresh = count("ok");
  const warn = count("warn");
  const fail = count("fail");
  const paused = count("paused");
  const unknown = count("unknown");
  const feedsUnknown = !!d.feeds.error;

  const cb = d.books.v.find((b) => b.book === "Coolbet");
  const cbShare = cb?.budget_1h ? (cb.requests_1h ?? 0) / cb.budget_1h : null;
  const s = d.snapshot.v;
  const afCalls = s?.af_calls_today ?? null;
  const afShare = afCalls != null ? afCalls / AF_DAILY_BUDGET : null;
  const liveAge = d.lastLiveAt.v ? Math.round((now - new Date(d.lastLiveAt.v).getTime()) / 60000) : null;
  const snapAge = s ? Math.round((now - new Date(s.created_at).getTime()) / 60000) : null;
  const snapNote = d.snapshot.error
    ? `Unreadable: ${d.snapshot.error}`
    : !s
      ? "No ops snapshot for today yet — the engine writes one every hour."
      : `From the ops snapshot written ${snapAge} min ago (hourly).`;

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Data & ops"
        title="Feeds"
        meta={
          <>
            Is data coming in, and at what cost? Every odds sweeper and data feed, checked every 5 minutes by the engine.
            {statusAgeMin !== null && (
              <span className={statusAgeMin > STATUS_STUCK_MIN ? " text-danger" : ""}>
                {" "}Status checked {statusAgeMin < 1 ? "just now" : `${statusAgeMin} min ago`}
                {statusAgeMin > STATUS_STUCK_MIN ? " — the status job itself looks stuck." : "."}
              </span>
            )}
          </>
        }
        actions={<AutoRefreshBadge intervalMs={60_000} checkedAt={now} />}
      />

      {d.feeds.error && (
        <Panel className="border-warning/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle size={14} aria-hidden="true" /> Feed status unreadable ({d.feeds.error}) — the blocks below are not an all-clear.
          </p>
        </Panel>
      )}

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Fresh" icon={CheckCircle2} tone="success" unknown={feedsUnknown} value={`${fresh}/${feeds.length}`} foot={unknown ? `${unknown} with no status yet` : "sweeping on time"} />
        <StatCard label="Needs a look" icon={AlertTriangle} tone={warn ? "warning" : "success"} unknown={feedsUnknown} value={warn} foot={warn ? "a sweep missed or came back thin" : "none"} />
        <StatCard label="Stopped" icon={CircleStop} tone={fail ? "danger" : "success"} unknown={feedsUnknown} value={fail} foot={fail ? "no data past its limit" : "none"} />
        <StatCard label="Paused" icon={CirclePause} tone={paused ? "info" : "neutral"} unknown={feedsUnknown} value={paused} foot={paused ? "by us — see the block for why" : "none paused"} />
        <StatCard
          label="Coolbet requests · hour"
          icon={Gauge}
          tone={cbShare == null ? "neutral" : cbShare >= 1 ? "danger" : cbShare >= 0.8 ? "warning" : "success"}
          unknown={!!d.books.error || cb?.requests_1h == null}
          value={
            <>
              {fmtInt(cb?.requests_1h)}
              {cb?.budget_1h ? <span className="text-sm font-normal text-muted-foreground"> / {fmtInt(cb.budget_1h)}</span> : null}
            </>
          }
          foot={cb ? `bot-checks ${cb.challenges_1h ?? 0} · errors ${cb.errors_1h ?? 0} · this clock hour` : "no Coolbet row"}
          href="#coolbet-footprint"
          hrefLabel="Coolbet sweeping"
        />
        <StatCard
          label="API-Football · today"
          icon={Server}
          tone={afShare == null ? "neutral" : afShare > 0.8 ? "danger" : afShare > 0.5 ? "warning" : "success"}
          unknown={afCalls == null}
          value={afShare != null ? `${Math.round(afShare * 100)}%` : "—"}
          foot={afCalls != null ? `${fmtInt(afCalls)} of ${fmtInt(AF_DAILY_BUDGET)} calls · resets 00:00 UTC` : snapNote}
          href="#af-budget"
          hrefLabel="Budget"
        />
      </div>

      {/* ── Book blocks ── */}
      <Panel>
        <PanelHeader
          title="Bookmakers"
          description={
            <>
              Time since each book&apos;s last odds — <span className="text-success">green</span> fresh, <span className="text-warning">amber</span> a sweep
              missed, <span className="text-danger">red</span> stopped, <span className="text-info">blue</span> paused. Click a block for its sweepers,
              Pause / Resume / Run now, and today&apos;s numbers.
            </>
          }
        />
        <div className="p-4 pt-3">
          {feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {d.feeds.error ? "Unreadable — see above." : "No status yet — the engine writes it every 5 minutes."}
            </p>
          ) : (
            <FeedsBoard feeds={feeds} books={d.books.v} now={now} />
          )}
        </div>
      </Panel>

      {/* ── Coolbet area + coverage chart ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FootprintControl state={controls} now={now}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Meter
              label="Requests · this hour"
              value={cb?.requests_1h}
              total={cb?.budget_1h}
              tone={cbShare == null ? "neutral" : cbShare >= 1 ? "danger" : cbShare >= 0.8 ? "warning" : "success"}
              note="Over budget, requests are refused before they are sent, so our exit IP is not flagged again (#110)."
            />
            <Meter
              label="Closes captured · 24 h"
              value={cb?.closing_captured_24h}
              total={cb?.closing_priced_24h}
              tone={shareTone(cb?.closing_captured_24h, cb?.closing_priced_24h, 0.8, 0.5)}
              note="Kick-offs Coolbet priced that also have a price in the last 15 minutes (its close)."
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {cb ? (
              <>
                {fmtInt(cb.requests_24h)} requests in 24 h · bot-checks this hour {cb.challenges_1h ?? 0} · errors this hour {cb.errors_1h ?? 0}
              </>
            ) : d.books.error ? (
              <span className="text-warning">Coolbet numbers unreadable ({d.books.error}).</span>
            ) : (
              "No Coolbet numbers yet."
            )}
          </p>
        </FootprintControl>
        <CoverageChart books={d.books.v} error={d.books.error} />
      </div>

      {/* ── Moved from /admin/ops: odds pipeline, live tracker, API-Football budget ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Odds pipeline today"
            description="Pre-match odds for today's matches, all books together. Bookmakers open lines through the day, so early-morning shares are low; about 75–80% by evening is typical — youth, reserve and small leagues are rarely priced."
            actions={s ? <StatusBadge tone="neutral" dot={false}>{fmtInt(s.matches_today)} matches</StatusBadge> : <StatusBadge tone="warning">No snapshot</StatusBadge>}
          />
          <div className="grid gap-3 p-4 pt-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Meter label="Have odds" value={s?.matches_with_odds} total={s?.matches_today} tone={shareTone(s?.matches_with_odds, s?.matches_today)} note="At least one book prices the match." />
            <Meter
              label="Have a sharp price"
              value={s?.matches_with_sharp ?? s?.matches_with_pinnacle}
              total={s?.matches_today}
              tone={shareTone(s?.matches_with_sharp ?? s?.matches_with_pinnacle, s?.matches_today, 0.6, 0.3)}
              note={`Pinnacle ${s?.matches_with_pinnacle ?? "—"} · liquid Betfair ${s?.matches_with_exchange_liquid ?? "—"}. The sharp price is what edges are measured against.`}
            />
            <Meter label="Match winner (1X2)" value={s?.odds_market_match_winner} total={s?.matches_today} tone={shareTone(s?.odds_market_match_winner, s?.matches_today)} />
            <Meter label="Goals over/under 2.5" value={s?.odds_market_goals_ou} total={s?.matches_today} tone={shareTone(s?.odds_market_goals_ou, s?.matches_today)} />
            <Meter label="Both teams to score" value={s?.odds_market_btts} total={s?.matches_today} tone={shareTone(s?.odds_market_btts, s?.matches_today)} />
            <Meter
              label="Bookmakers active"
              value={s?.distinct_bookmakers}
              tone={s?.distinct_bookmakers != null && s.distinct_bookmakers < 3 ? "danger" : "neutral"}
              note={`${fmtInt(s?.odds_snapshots_today)} price rows stored today. Under 3 books is a data gap.`}
            />
          </div>
          <p className="px-4 pb-4 text-xs text-muted-foreground">{snapNote}</p>
        </Panel>

        <div className="grid gap-4">
          <Panel id="af-budget">
            <PanelHeader
              title="API-Football daily budget"
              description="Mega plan: 150,000 calls a day across every job, reset at midnight UTC. It carries fixtures, 9 books' odds (Pinnacle included), live scores and match data."
            />
            <div className="p-4 pt-3">
              <Meter
                label="Calls today"
                value={afCalls}
                total={AF_DAILY_BUDGET}
                tone={afShare == null ? "neutral" : afShare > 0.8 ? "danger" : afShare > 0.5 ? "warning" : "success"}
                note={
                  afCalls != null
                    ? `${fmtInt(s?.af_budget_remaining)} left today. Amber past half, red past 80%.`
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
              <Meter label="Games tracked today" value={s?.live_games_tracked} note={`${fmtInt(s?.live_snapshots_today)} snapshot rows today.`} />
              <Meter
                label="Last live snapshot"
                value={liveAge}
                suffix={liveAge != null ? " min ago" : null}
                tone={liveAge != null && liveAge > 60 ? "warning" : "neutral"}
                note={d.lastLiveAt.error ? `Unreadable: ${d.lastLiveAt.error}` : "Over 60 min is normal only when no game is on."}
              />
              <Meter label="Games with xG" value={s?.live_games_with_xg} total={s?.live_games_tracked} tone="neutral" note="xG comes only from the top leagues' match stats." />
              <Meter
                label="Games with live over/under odds"
                value={s?.live_games_with_odds}
                total={s?.live_games_tracked}
                tone="neutral"
                note="Only the in-play bots used these; in-play betting was retired on 2026-08-21."
              />
            </div>
          </Panel>
        </div>
      </div>

      <DqFindings findings={d.dq.v} now={now} error={d.dq.error} />
    </div>
  );
}
