/**
 * /admin/shadow-bots/[bot] — per-bot ledger for a single shadow bot.
 *
 * Restricted to the four known shadow bot names to prevent arbitrary bot
 * inspection via URL path.
 */
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";

const STAKE = 10;
const PROMOTE_N_THRESHOLD = 50;

const ALLOWED: Record<
  string,
  { title: string; subtitle: string }
> = {
  bot_no_pin_shadow_v1: {
    title: "Matches without Pinnacle",
    subtitle: "Any market · edge ≥ 8% · needs ≥3 accessible books",
  },
  bot_sweep_1x2_home_v1: {
    title: "Home wins · tier 2-3",
    subtitle: "1X2 home · edge ≥ 10% · odds 2.0-5.0 · Pinnacle required",
  },
  bot_sweep_1x2_draw_v1: {
    title: "Draws · tier 2-3",
    subtitle: "1X2 draw · edge ≥ 5% · odds 1.3-3.5 · Pinnacle required",
  },
  bot_sweep_btts_yes_v1: {
    title: "Both teams to score · tier 2-3",
    subtitle: "BTTS yes · edge ≥ 5% · odds 2.0-2.5",
  },
};

interface ShadowBetRow {
  id: string;
  market: string;
  selection: string;
  odds_at_pick: number | null;
  model_probability: number | null;
  edge_percent: number | null;
  recommended_bookmaker: string | null;
  pick_time: string;
  result: string | null;
  matches: {
    date: string;
    leagues: { name: string | null; country: string | null } | null;
    home_team: { name: string | null } | null;
    away_team: { name: string | null } | null;
  } | null;
}

export default async function ShadowBotDetailPage({
  params,
}: {
  params: Promise<{ bot: string }>;
}) {
  const { bot: botName } = await params;
  const cfg = ALLOWED[botName];
  if (!cfg) notFound();

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Denied />;
  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) return <Denied text="Superadmin only." />;

  const { data: botRow } = await db
    .from("bots")
    .select("id, name, description, maturity_label, strategy_description")
    .eq("name", botName)
    .single();
  if (!botRow?.id) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <BackLink />
        <h1 className="mt-6 text-3xl font-semibold">{cfg.title}</h1>
        <p className="mt-4 text-base text-amber-400">
          Bot not yet registered — migration hasn&apos;t been applied.
        </p>
      </div>
    );
  }

  const { data: rows } = await db
    .from("shadow_bets")
    .select(
      `id, market, selection, odds_at_pick, model_probability,
       edge_percent, recommended_bookmaker, pick_time, result,
       matches!inner (
         date,
         leagues ( name, country ),
         home_team:teams!matches_home_team_id_fkey ( name ),
         away_team:teams!matches_away_team_id_fkey ( name )
       )`
    )
    .eq("bot_id", botRow.id)
    .order("pick_time", { ascending: false })
    .limit(500);

  const bets = (rows ?? []) as unknown as ShadowBetRow[];

  const settled = bets.filter((b) => b.result === "won" || b.result === "lost");
  const wins = settled.filter((b) => b.result === "won");
  const losses = settled.filter((b) => b.result === "lost");
  const voided = bets.filter((b) => b.result === "void");
  const pending = bets.filter((b) => !b.result || b.result === "pending");

  const totalStake = settled.length * STAKE;
  const wonPnl = wins.reduce(
    (s, b) => s + (Number(b.odds_at_pick ?? 0) - 1) * STAKE,
    0
  );
  const pnl = wonPnl - losses.length * STAKE;
  const roi = totalStake > 0 ? (pnl / totalStake) * 100 : 0;
  const hitRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0;
  const roiTone: "good" | "bad" | "neutral" =
    settled.length === 0 ? "neutral" : roi >= 3 ? "good" : roi <= -8 ? "bad" : "neutral";
  const progress = Math.min(100, (bets.length / PROMOTE_N_THRESHOLD) * 100);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <BackLink />

      {/* Header */}
      <header className="mt-6 mb-12 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-400">
          {botRow.maturity_label ?? "—"}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{cfg.title}</h1>
        <p className="text-base text-neutral-400">{cfg.subtitle}</p>
        <p className="font-mono text-[11px] text-neutral-600">{botRow.name}</p>
      </header>

      {/* Stats panel */}
      <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
          <BigStat label="Picks" value={bets.length.toString()} />
          <BigStat label="Awaiting" value={pending.length.toString()} />
          <BigStat label="Settled" value={settled.length.toString()} />
          <BigStat
            label="Hit rate"
            value={settled.length > 0 ? `${hitRate.toFixed(0)}%` : "—"}
            hint={settled.length === 0 ? "Not enough data" : undefined}
          />
          <BigStat
            label="ROI"
            value={settled.length > 0 ? `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%` : "—"}
            hint={settled.length === 0 ? "Not enough data" : undefined}
            tone={roiTone}
          />
        </div>

        {/* Progress toward promotion decision */}
        <div className="mt-8">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-neutral-300">
              Progress toward decision
            </span>
            <span className="text-neutral-500">
              {bets.length >= PROMOTE_N_THRESHOLD
                ? `${bets.length} / ${PROMOTE_N_THRESHOLD}+`
                : `${bets.length} / ${PROMOTE_N_THRESHOLD}`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${
                settled.length > 0 && roi >= 3
                  ? "bg-emerald-400"
                  : settled.length > 0 && roi <= -8
                  ? "bg-rose-400"
                  : "bg-neutral-400"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Outcome dots */}
        <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
          <OutcomePill kind="won" n={wins.length} />
          <OutcomePill kind="lost" n={losses.length} />
          <OutcomePill kind="void" n={voided.length} />
          <OutcomePill kind="pending" n={pending.length} />
        </div>
      </section>

      {/* Ledger */}
      <section>
        <h2 className="mb-4 text-sm font-mono uppercase tracking-widest text-neutral-500">
          Picks ({bets.length})
        </h2>

        {bets.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-neutral-400">
            No picks yet. The bot fires on the next scheduler cycle.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            {/* Header row — hidden on mobile, table on desktop */}
            <div className="hidden border-b border-white/[0.04] px-6 py-3 text-xs font-mono uppercase tracking-wider text-neutral-500 sm:grid sm:grid-cols-[130px_1fr_100px_90px_80px_100px_100px]">
              <div>Kickoff</div>
              <div>Match</div>
              <div>Pick</div>
              <div className="text-right">Odds</div>
              <div className="text-right">Prob</div>
              <div>Book</div>
              <div className="text-right">Result</div>
            </div>
            <ul>
              {bets.map((b, i) => (
                <BetRow key={b.id} bet={b} isFirst={i === 0} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function BetRow({ bet: b, isFirst }: { bet: ShadowBetRow; isFirst: boolean }) {
  const ko = b.matches?.date ? new Date(b.matches.date) : null;
  const kickoffMain = ko
    ? ko.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      })
    : "—";
  const kickoffTime = ko
    ? ko.toLocaleString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "";

  const pickLabel = formatPickLabel(b.market, b.selection);

  return (
    <li
      className={`px-6 py-4 sm:grid sm:grid-cols-[130px_1fr_100px_90px_80px_100px_100px] sm:items-center sm:gap-3 sm:py-3 ${
        isFirst ? "" : "border-t border-white/[0.04]"
      }`}
    >
      <div className="font-mono text-xs text-neutral-400">
        <span className="text-neutral-200">{kickoffMain}</span>
        <span className="ml-1 text-neutral-500">{kickoffTime}</span>
      </div>
      <div className="mt-1 min-w-0 sm:mt-0">
        <div className="truncate text-sm font-medium text-neutral-100">
          {b.matches?.home_team?.name ?? "Home"}{" "}
          <span className="text-neutral-500">vs</span>{" "}
          {b.matches?.away_team?.name ?? "Away"}
        </div>
        <div className="mt-0.5 truncate text-xs text-neutral-500">
          {b.matches?.leagues?.country ? `${b.matches.leagues.country} · ` : ""}
          {b.matches?.leagues?.name ?? ""}
        </div>
      </div>
      <div className="mt-1 text-sm text-emerald-300 sm:mt-0">{pickLabel}</div>
      <div className="mt-1 text-right font-mono text-sm tabular-nums text-neutral-100 sm:mt-0">
        {b.odds_at_pick != null ? Number(b.odds_at_pick).toFixed(2) : "—"}
      </div>
      <div className="mt-1 text-right font-mono text-xs tabular-nums text-neutral-400 sm:mt-0">
        {b.model_probability != null
          ? `${(Number(b.model_probability) * 100).toFixed(0)}%`
          : "—"}
      </div>
      <div className="mt-1 text-xs text-neutral-300 sm:mt-0">{b.recommended_bookmaker ?? "—"}</div>
      <div className="mt-2 text-right sm:mt-0">
        <ResultBadge result={b.result} />
      </div>
    </li>
  );
}

function formatPickLabel(market: string, selection: string): string {
  const sel = (selection ?? "").toLowerCase();
  if (market === "1x2") {
    if (sel === "home") return "Home";
    if (sel === "draw") return "Draw";
    if (sel === "away") return "Away";
  }
  if (market === "btts") {
    return sel === "yes" ? "BTTS yes" : "BTTS no";
  }
  if (market.startsWith("over_under_")) {
    const line = market.replace("over_under_", "").replace("_", ".");
    return sel === "over" ? `Over ${line}` : `Under ${line}`;
  }
  return `${market} · ${sel}`;
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result || result === "pending")
    return (
      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
        Pending
      </span>
    );
  if (result === "won")
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
        Won
      </span>
    );
  if (result === "lost")
    return (
      <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-400">
        Lost
      </span>
    );
  if (result === "void")
    return (
      <span className="rounded-full bg-neutral-500/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
        Void
      </span>
    );
  return null;
}

function OutcomePill({ kind, n }: { kind: "won" | "lost" | "void" | "pending"; n: number }) {
  const dot =
    kind === "won"
      ? "bg-emerald-400"
      : kind === "lost"
      ? "bg-rose-400"
      : kind === "void"
      ? "bg-neutral-500"
      : "bg-amber-400";
  const label = kind === "won" ? "won" : kind === "lost" ? "lost" : kind === "void" ? "void" : "pending";
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="tabular-nums text-neutral-200">{n}</span>
      <span className="text-neutral-500">{label}</span>
    </span>
  );
}

function BigStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-400" : tone === "bad" ? "text-rose-400" : "text-neutral-100";
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums sm:text-3xl ${toneClass}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/shadow-bots"
      className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-300"
    >
      ← All shadow bots
    </Link>
  );
}

function Denied({ text = "Access denied." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">{text}</div>
  );
}
