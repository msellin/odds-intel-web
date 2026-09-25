export const dynamic = "force-dynamic";

import Link from "next/link";
import { jobAnchor } from "@/lib/admin-jobs-model";
import type { Metadata } from "next";
import { Euro, AlertTriangle, ArrowRight, Bot, CheckCircle2, Rss, ShieldAlert } from "lucide-react";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { isBotBoardDevPreview } from "@/lib/bot-board";
import { loadOverview } from "@/lib/admin-overview";
import type { AttentionItem } from "@/lib/admin-attention";
import { PageHeader, Panel, PanelHeader } from "@/components/oi/panel";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { OverviewCharts } from "./overview-charts";
import { AnswerStrip, type Answer } from "@/components/oi/answer-strip";
import { fmtEur, fmtInt } from "@/components/oi/format";
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
  // same window + rules as the Real bets page ("last 30 days"), so both pages show one number
  const rb = d.realBets.last30;
  const rbPnl = rb?.pnl ?? 0;
  const rbBets = rb?.bets ?? 0;
  const hhmm = new Date(d.now).toISOString().slice(11, 16);

  // feeds: the Feeds page's own answer (feedsAnswer over its blocks, incl. feeds gone quiet, via feedHealth)

  const answers: Answer[] = [
    f?.real_money_armed && d.canStake !== "no"
      ? { label: "Real money", text: d.canStake === "yes" ? "ARMED — real bets can be placed now" : "ARMED — some switches unreadable", tone: "danger", icon: ShieldAlert, href: "/admin/bots#real-money" }
      : !f
        ? // review 2026-09-25: an unreadable fleet row must never read "Off" — the ladder says "no" when no bot is on
          { label: "Real money", text: "Can't tell if real money is armed", sub: d.canStake === "no" ? "no bot can bet right now" : undefined, tone: "warning", icon: ShieldAlert, href: "/admin/bots#real-money" }
        : d.canStake === "unknown"
        ? { label: "Real money", text: "Can't tell — some switches unreadable", tone: "warning", icon: ShieldAlert, href: "/admin/bots#real-money" }
        : { label: "Real money", text: f?.real_money_armed ? "Armed, but nothing can bet right now" : "Off — nothing can bet automatically", sub: d.moneyBlockers.length ? `blocked by: ${d.moneyBlockers.join(", ")}` : undefined, tone: f?.real_money_armed ? "danger" : "neutral", icon: ShieldAlert, href: "/admin/bots#real-money" },
    // same window + rules as the Real bets page ("last 30 days")
    rb
      ? { label: "Real bets · 30 days", text: `${fmtEur(rbPnl, { signed: true })} on ${fmtInt(rbBets)} bets`, tone: rbPnl > 0 ? "success" : rbPnl < 0 ? "danger" : "neutral", alarm: false, icon: Euro, href: "/admin/real-bets" }
      : { label: "Real bets · 30 days", text: "couldn't load the real-bet ledger", tone: "warning", icon: Euro, href: "/admin/real-bets" },
    d.coolbetRisk.level === "high"
      ? { label: "Odds feeds", text: "Coolbet block risk: high", sub: d.coolbetRisk.sub, tone: "danger", icon: Rss, href: "/admin/feeds#coolbet-footprint" }
      : d.feedsAnswer.tone !== "success"
        ? { label: "Odds feeds", text: d.feedsAnswer.text, sub: d.feedsAnswer.sub, tone: d.feedsAnswer.tone, icon: Rss, href: d.feedsAnswer.href }
        : d.coolbetRisk.level !== "low"
          ? { label: "Odds feeds", text: d.coolbetRisk.level === "unknown" ? "Coolbet block risk: can't tell" : "Coolbet block risk: medium", sub: d.coolbetRisk.sub, tone: "warning", icon: Rss, href: "/admin/feeds#coolbet-footprint" }
          : { label: "Odds feeds", text: "All running", sub: d.feedsAnswer.sub, tone: "success", icon: Rss, href: "/admin/feeds" },
    // the Jobs page's own answer (jobsAnswer), so "1 job failing" reads the same on both pages
    !d.jobsAnswer
      ? { label: "Scheduled jobs", text: "Can't tell — job history unreadable", tone: "warning", icon: AlertTriangle, href: "/admin/ops" }
      : d.jobsAnswer.tone === "success" && d.jobsCadenceError
        ? // failures are known, lateness is not: never a green "All running" (review 2026-09-25)
          { label: "Scheduled jobs", text: "No failures — can't tell if any job is late", sub: "run history unreadable", tone: "warning", icon: AlertTriangle, href: "/admin/ops" }
        : {
          label: "Scheduled jobs",
          text: d.jobsAnswer.text,
          sub: d.jobsAnswer.sub,
          tone: d.jobsAnswer.tone,
          icon: d.jobsAnswer.tone === "success" ? CheckCircle2 : AlertTriangle,
          href: d.jobsAnswer.failing[0] ? `/admin/ops#${jobAnchor(d.jobsAnswer.failing[0].job)}` : "/admin/ops",
        },
    d.bots.verdicts.beats > 0
      ? { label: "Bots", text: `${d.bots.verdicts.beats} of ${d.bots.active} beat the closing price`, tone: "success", icon: Bot, href: "/admin/bots" }
      : { label: "Bots", text: `None proven yet — 0 of ${d.bots.active} beat the closing price`, tone: "neutral", icon: Bot, href: "/admin/bots" },
  ];

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <AutoRefresh intervalMs={120_000} />
      <div className="order-first">
      <PageHeader eyebrow="Admin" title="Overview" meta={`Checked ${hhmm} UTC · refreshes every 2 min`} />
      </div>

      {/* ── The answers first (owner, 2026-09-25: "so this is the clean and intuitive dashboard?"
             — the six KPI cards read like a report; each question now gets one plain sentence) ── */}
      {/* on a phone the to-do list comes first — five full-width answers pushed it off the screen */}
      <div className="order-2 sm:order-none">
        <AnswerStrip answers={answers} />
      </div>

      {/* ── Attention inbox ── */}
      <Panel id="attention" className="order-1 sm:order-none">
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

      {/* charts default to order 0 and would jump above the answers on a phone */}
      <div className="order-3 flex flex-col gap-4 sm:order-none lg:gap-6">
        <OverviewCharts d={d} />
      </div>
    </div>
  );
}
