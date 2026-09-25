/**
 * /admin/shadow-bots — the Pick queue (#139 IA move P6, 2026-09-24; was "Shadow bots", OWN Phase 6).
 *
 * ONE job (IA J6): what should I place by hand today? The owner places real bets by hand on these
 * picks, then records each with `Place €X` (→ /api/admin/real-bet → record_manual_real_bet, which
 * writes real_bets with placed_real NULL until the account check confirms it).
 *
 *   1. Four counts — picks waiting, ready to place, placed today vs the caps, old bot prices.
 *   2. One line pointing at where the removed sections now live: the real-money switches and bot
 *      scores are on /admin/bots (IA §2.2 duplicates), the money ledger on the Real money view (/admin/bots?section=money, was /admin/real-bets).
 *   3. The queue — shared DataTable, one verdict per pending pick.
 *   4. "How this page works" — collapsed.
 *
 * Removed here on purpose: the safety strip and the scoreboard (their jobs live on /admin/bots —
 * one owner per number), the Promotions panel (moved to the Real money view (/admin/bots?section=money, was /admin/real-bets)).
 *
 * Bot list is `bots WHERE retired_at IS NULL` — nothing hardcoded, so a new bot's picks appear
 * the moment it has a `bots` row and its first `shadow_bets` write. Decision rules live in
 * lib/shadow-bots/verdict.ts. Reads: `loadShadowBotsPage()` (cached 60 s) + `loadSessionState()`
 * (fresh) + the viewer's pick marks.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Clock, Hourglass, ListChecks } from "lucide-react";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { readAdminFixture } from "@/lib/admin-fixture";
import { fetchUserPickMarkStates } from "@/lib/upcoming-picks";
import { loadSessionState, loadShadowBotsPage, type SessionState, type ShadowBotsPageData } from "@/lib/shadow-bots/queries";
import { DAILY_MAX_BETS, DAILY_MAX_STAKE_EUR } from "@/lib/admin-money";
import { buildPickRows, queueCounts } from "@/components/shadow-bots/picks-table";
import { PicksQueueTable } from "@/components/shadow-bots/picks-queue-table";
import { QUOTE_MAX_AGE_MIN } from "@/lib/shadow-bots/verdict";
import { HowItWorks } from "@/components/shadow-bots/how-it-works";
import { PageHeader, Panel } from "@/components/oi/panel";
import { StatCard } from "@/components/oi/stat-card";
import { StatusBadge } from "@/components/oi/status-badge";
import { prettyDisplayName } from "@/app/(app)/admin/bots/bot-board-format";
import { fmtEur } from "@/components/oi/format";

export const metadata: Metadata = { title: "Pick queue · Admin · OddsIntel", robots: { index: false } };

async function load(userId: string | null): Promise<{ data: ShadowBotsPageData; state: SessionState; marks: Record<string, 1 | 2> }> {
  const fx = await readAdminFixture<{ page: ShadowBotsPageData; state: SessionState }>("queue");
  if (fx) return { data: fx.page, state: fx.state, marks: {} };
  const [data, state, marks] = await Promise.all([
    loadShadowBotsPage(),
    loadSessionState(),
    userId ? fetchUserPickMarkStates(userId).catch(() => new Map<string, 1 | 2>()) : new Map<string, 1 | 2>(),
  ]);
  const markStates: Record<string, 1 | 2> = {};
  for (const [k, v] of marks) markStates[k] = v;
  return { data, state, marks: markStates };
}

export default async function PickQueuePage() {
  let userId: string | null = null;
  if (!isBotBoardDevPreview()) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return <Denied />;
    const db = createServerServiceClient();
    const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
    if (!profile?.is_superadmin) return <Denied text="Superadmin only." />;
    userId = user.id;
  }

  const { data, state, marks } = await load(userId);
  const rows = buildPickRows(data, state, marks);
  const c = queueCounts(rows);
  const t = data.todayRealBets;
  const placedToday = t.confirmedCount + t.unconfirmedCount;
  // #162 W4.2: the engine's daily cap counts confirmed AND unconfirmed (hand-logged) bets at every book
  const overCap = placedToday >= DAILY_MAX_BETS || t.confirmedStake + t.unconfirmedStake >= DAILY_MAX_STAKE_EUR;
  const loaded = new Date(data.loadedAt).toISOString().slice(11, 16);
  // The fleet's automatic-placing state, stated ONCE here (UX fix round, 2026-09-24) — it used to
  // be an "auto off" chip on every row. Off is neutral, not red and not green: money being off is
  // "off", not "bad" or "good". It never affects the Place button, which only RECORDS a hand bet.
  const botLabel = new Map(data.bots.map((b) => [b.name, prettyDisplayName(b.display_name, b.name)]));
  const toggledOff = data.placerBots.filter((p) => !p.ui_place_enabled).map((p) => botLabel.get(p.bot_name) ?? prettyDisplayName(null, p.bot_name));

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        eyebrow="Bots & money"
        title="Pick queue"
        meta={`What to place by hand today: every pending pick from the ${data.bots.length} active bots, placeable first, one row per bet. Prices checked ${loaded} UTC (refreshed every minute).`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Picks waiting"
          icon={ListChecks}
          tone="info"
          // pre-match bets only — the table's default view; in-play rows are hidden behind a chip
          value={c.total - c.inplay}
          foot={`${c.today - c.inplayToday} kick off today (UTC) · ${c.botPicks - c.inplayBotPicks} bot picks, same bet grouped${c.inplay > 0 ? ` · +${c.inplay} in-play (hidden, can't be placed)` : ""}`}
        />
        <StatCard
          label="Ready to place"
          icon={CheckCircle2}
          tone={c.place > 0 ? "success" : "neutral"}
          value={c.place}
          foot={c.thin > 0 ? `+ ${c.thin} thin: above break-even, below the bot's own bar` : `Price clears the bot's own bar and is under ${QUOTE_MAX_AGE_MIN} min old`}
        />
        <StatCard
          label="Placed today"
          icon={Clock}
          tone={overCap ? "danger" : "neutral"}
          value={placedToday}
          href="/admin/bots?section=money"
          hrefLabel="Real money"
          foot={
            // LOGGED-PICKS-INVISIBLE (2026-09-15): bets recorded by hand are real exposure, so they are in
            // the headline number; the automatic caps count confirmed placements only.
            `Automatic ${t.confirmedCount}/${DAILY_MAX_BETS} · ${fmtEur(t.confirmedStake)}/${fmtEur(DAILY_MAX_STAKE_EUR)}` +
            (t.unconfirmedCount > 0 ? ` · +${t.unconfirmedCount} by hand ${fmtEur(t.unconfirmedStake)}` : "")
          }
        />
        <StatCard
          label="Old bot prices"
          icon={Hourglass}
          tone={c.stale > 0 ? "warning" : "neutral"}
          value={c.stale}
          foot="The bot decided on an old price — greyed in the table, never hidden"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          Automatic placing:
          {state.placement_paused ? (
            <StatusBadge tone="neutral" title={state.placement_paused_reason ?? undefined}>
              Off (paused)
            </StatusBadge>
          ) : (
            <StatusBadge tone="success">On</StatusBadge>
          )}
        </span>
        <span>
          {state.placement_paused
            ? "The machine places nothing. You can still place by hand at the book and record it here."
            : toggledOff.length > 0
              ? `Switched off for ${toggledOff.join(", ")}. Hand bets can always be recorded.`
              : "Hand bets can always be recorded."}
        </span>
        <span className="basis-full sm:basis-auto">
          <Link href="/admin/bots#real-money" className="text-primary hover:underline">
            Real-money switches
          </Link>{" "}
          ·{" "}
          <Link href="/admin/bots" className="text-primary hover:underline">
            Bot scores
          </Link>{" "}
          ·{" "}
          <Link href="/admin/bots?section=money" className="text-primary hover:underline">
            Real bets
          </Link>
        </span>
      </div>

      {data.truncatedBooks.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">
          The price read hit its row limit for {data.truncatedBooks.join(", ")} — some prices may show “—” although one exists.
        </div>
      )}

      <Panel className="p-4">
        <PicksQueueTable rows={rows} />
      </Panel>

      <HowItWorks />
    </div>
  );
}

function Denied({ text = "Access denied." }: { text?: string }) {
  return <div className="flex items-center justify-center py-24 text-muted-foreground">{text}</div>;
}
