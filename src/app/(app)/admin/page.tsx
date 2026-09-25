export const dynamic = "force-dynamic";

import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Euro, Rss, ShieldAlert, Sparkles } from "lucide-react";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { loadOverview } from "@/lib/admin-overview";
import type { AttentionItem } from "@/lib/admin-attention";
import { PageHeader, Panel, PanelHeader } from "@/components/oi/panel";
import { Sparkline, StatCard } from "@/components/oi/stat-card";
import { StatusBadge, TrendPill, type Tone } from "@/components/oi/status-badge";
import { OverviewCharts } from "./overview-charts";
import { fmtEur, fmtInt } from "@/components/oi/format";
import { RETIRED_SERIES } from "@/lib/admin-overview-shared";
import { feedHealth } from "@/lib/admin-feeds-model";
import { AutoRefresh } from "./ops/auto-refresh";

// /admin Overview (#139, 2026-09-24). Was a link index with one feed widget (ADMIN-REDO #107).
// Now, per the IA audit (dev/active/admin-information-architecture.md §3.3, move P4) and the
// owner's brief ("make it look like a real admin dashboard … graphs, bars, columns"):
//   1. KPI cards with trends/sparklines — each links to the page that owns the number;
//   2. the ATTENTION inbox — only things that need an action, each linking to where it is fixed;
//   3. interactive charts (picks per family, CLV vs the junk control, P/L, real bets, verdict and
//      feed mixes). Data: src/lib/admin-overview.ts, all from reads that already exist.

export const metadata: Metadata = { title: "Overview · Admin · OddsIntel", robots: { index: false } };

const SEV_TONE: Record<AttentionItem["severity"], Tone> = { danger: "danger", warn: "warning", info: "info" };
const AREA_LABEL: Record<AttentionItem["area"], string> = { money: "Money", picks: "Picks", feeds: "Feeds", bots: "Bots", jobs: "Jobs", data: "Data" };

function ago(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export default async function AdminIndexPage() {
  let viewerId: string | null = null;
  if (!isBotBoardDevPreview()) {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
    const db = createServerServiceClient();
    const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
    if (!profile?.is_superadmin) return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
    viewerId = user.id;
  }

  const d = await loadOverview(viewerId);
  const f = d.control.fleet.row;
  const danger = d.attention.filter((a) => a.severity === "danger").length;
  // Active bots only: last week's total includes bots retired since, which would read as a drop.
  const picksPerWeek = d.picksByFamily.map((r) => d.families.filter((k) => k !== RETIRED_SERIES).reduce((a, k) => a + Number(r[k] ?? 0), 0));
  const thisWeek = picksPerWeek[picksPerWeek.length - 1] ?? 0;
  const lastWeek = picksPerWeek[picksPerWeek.length - 2] ?? 0;
  // The current week is still running: compare its PACE (picks so far ÷ share of the week gone)
  // with last full week, never the raw part-week — that would read as a collapse every Monday.
  const weekShare = Math.min(1, Math.max(1 / 168, (d.now - new Date(`${d.weeks[d.weeks.length - 1]}T00:00:00Z`).getTime()) / (7 * 86_400_000)));
  const pace = Math.round(thisWeek / weekShare);
  // a pace from the first hours of a week is noise — no trend until a day of it has passed
  const paceChange = lastWeek > 0 && weekShare >= 1 / 7 ? Math.round(((pace - lastWeek) / lastWeek) * 100) : null;
  const feedsStale = d.feedsStale; // same rule as /admin/feeds (status check > 15 min old)
  const feedsOk = d.feeds.rows.filter((x) => feedHealth(x) === "ok").length;
  const feedsBad = d.feeds.rows.filter((x) => feedHealth(x) === "fail" || feedHealth(x) === "warn").length;
  // same window + rules as the Real bets page ("last 30 days"), so both pages show one number
  const rb = d.realBets.last30;
  const rbPnl = rb?.pnl ?? 0;
  const rbBets = rb?.bets ?? 0;
  const rbStaked = rb?.staked ?? 0;
  const hhmm = new Date(d.now).toISOString().slice(11, 16);

  return (
    <div className="space-y-4 lg:space-y-6">
      <AutoRefresh intervalMs={120_000} />
      <PageHeader eyebrow="Admin" title="Overview" meta={`Checked ${hhmm} UTC · refreshes every 2 min`} />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Needs attention"
          icon={danger ? AlertTriangle : CheckCircle2}
          tone={danger ? "danger" : d.attention.length ? "warning" : "success"}
          value={d.attention.length}
          foot={d.attention.length === 0 ? "All clear" : `${danger} urgent · ${d.attention.length - danger} to check`}
          href="#attention"
          hrefLabel="See list"
        />
        <StatCard
          label="Real money"
          icon={ShieldAlert}
          tone={f?.real_money_armed ? "danger" : "neutral"}
          unknown={!f}
          danger={!!f?.real_money_armed}
          value={f?.real_money_armed ? "ARMED" : "Off"}
          foot={
            d.canStake === "yes"
              ? `CAN STAKE — ${d.bots.switchedOn ?? "?"} bot${d.bots.switchedOn === 1 ? "" : "s"} switched on`
              : d.canStake === "unknown"
                ? "Some switches unreadable — can't tell if money can move"
                : `Can't stake — blocked by: ${d.moneyBlockers.join(", ")}`
          }
          href="/admin/bots#real-money"
        />
        <StatCard
          label="Active bots"
          icon={Bot}
          tone="info"
          unknown={!!d.bots.error}
          value={d.bots.active}
          trend={<StatusBadge tone={d.bots.verdicts.beats > 0 ? "success" : "warning"} dot={false} title="Bots that get better prices than the closing price">{d.bots.verdicts.beats} beat</StatusBadge>}
          foot={`${d.bots.published} on /picks · ${d.bots.telegram} on Telegram`}
          href="/admin/bots"
        />
        <StatCard
          label="Picks · this week"
          icon={Sparkles}
          tone="model"
          value={fmtInt(thisWeek)}
          trend={
            paceChange != null ? (
              <TrendPill good={null} up={paceChange === 0 ? null : paceChange > 0} value={`${paceChange > 0 ? "+" : paceChange < 0 ? "\u2212" : ""}${Math.abs(paceChange)}%`} title="This week's pace against last full week (bots active today only)" />
            ) : undefined
          }
          spark={<Sparkline values={picksPerWeek} tone="model" kind="bars" />}
          foot={`Mon–now, active bots · on pace for ${fmtInt(pace)} · last week ${fmtInt(lastWeek)}`}
          href="/admin/bots"
        />
        <StatCard
          label="Feeds fresh"
          icon={Rss}
          tone={feedsBad ? "warning" : "success"}
          unknown={!!d.feeds.error || feedsStale}
          value={`${feedsOk}/${d.feeds.rows.length}`}
          foot={feedsStale ? "the status check itself is stale — colours can't be trusted" : feedsBad ? `${feedsBad} need a look` : "all sweeping on time"}
          href="/admin/feeds"
        />
        <StatCard
          label="Real bets · 30 days"
          icon={Euro}
          tone={rbPnl >= 0 ? "success" : "danger"}
          unknown={!!d.realBets.error || !rb}
          value={fmtEur(rbPnl, { signed: true })}
          spark={<Sparkline values={d.realBets.rows.map((r) => r.pnl)} kind="bars" signed />}
          foot={rb ? `${fmtInt(rbBets)} bets · ${fmtEur(rbStaked)} staked` : "couldn't load the real-bet ledger"}
          href="/admin/real-bets"
        />
      </div>

      {/* ── Attention inbox ── */}
      <Panel id="attention">
        <PanelHeader
          title="Needs attention"
          description="Only things that need an action. Each one links to where it is fixed."
          actions={<StatusBadge tone={danger ? "danger" : d.attention.length ? "warning" : "success"}>{d.attention.length ? `${d.attention.length} open` : "All clear"}</StatusBadge>}
        />
        {d.attention.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="text-success" aria-hidden="true" /> All clear — checked {hhmm} UTC.
          </p>
        ) : (
          <div className="mt-3 border-t border-border/60">
            {(
              [
                ["Urgent", d.attention.filter((a) => a.severity === "danger")],
                ["To check", d.attention.filter((a) => a.severity !== "danger")],
              ] as const
            ).map(([label, items]) =>
              items.length === 0 ? null : (
                <div key={label}>
                  <div className={`px-4 pb-1 pt-3 font-mono text-[11px] uppercase tracking-wider ${label === "Urgent" ? "text-danger" : "text-warning"}`}>
                    {label} · {items.length}
                  </div>
                  <ul className="divide-y divide-border/60">
                    {items.map((a) => (
                      <li key={a.id}>
                        <Link href={a.href} className="group flex items-start gap-3 px-4 py-2.5 hover:bg-accent/40">
                          <span className="mt-0.5 w-16 shrink-0">
                            <StatusBadge tone={SEV_TONE[a.severity]}>{AREA_LABEL[a.area]}</StatusBadge>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm">{a.title}</span>
                            {a.detail && <span className="block truncate text-xs text-muted-foreground" title={a.detail}>{a.detail}</span>}
                          </span>
                          {ago(a.since, d.now) && (
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground" title={a.sinceFloor ? "No success in the 35 days of history we keep — it may be longer" : undefined}>
                              {a.sinceFloor ? "over " : ""}
                              {ago(a.since, d.now)}
                            </span>
                          )}
                          <ArrowRight size={14} className="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </Panel>

      <OverviewCharts d={d} />
    </div>
  );
}
