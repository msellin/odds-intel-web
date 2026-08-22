/**
 * /picks — recent + upcoming pre-match picks.
 *
 * PICKS-USER-GATE 2026-08-22 — auth-aware:
 *   - Signed-out visitors see the calibrated-only cohort (same set the
 *     public Telegram channel ships and the same set /api/v1/upcoming
 *     returns publicly).
 *   - Signed-in visitors see the wider calibrated+beta+active cohort, plus
 *     a per-row "Mark bet" checkbox that persists to `user_pick_marks` so
 *     they can track which picks they've manually placed with a book. The
 *     wider cohort is fetched server-side inside this component and never
 *     exposed via any JSON endpoint — anonymous scrapers cannot pull it
 *     from the network tab.
 *
 * Counterpart to /performance (full settled ledger). This page shows the
 * -24h/+36h window: today's picks that have already settled (with W/L badge)
 * plus everything upcoming.
 */
import Link from "next/link";
import { Nav } from "@/components/nav";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  fetchUpcomingPicks,
  PUBLIC_MATURITY_LABELS,
  SIGNED_IN_MATURITY_LABELS,
  type UpcomingPick,
} from "@/lib/upcoming-picks";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Live picks — OddsIntel",
  description:
    "Football picks the model is flagging right now. Every pick logged before kickoff, settlement tracked on the public ledger.",
};

function formatMarket(market: string, selection: string): string {
  const norm = market === "o/u" || market === "over_under_25" ? "ou25" : market;
  if (norm === "1x2") {
    if (selection === "home") return "Home win";
    if (selection === "away") return "Away win";
    if (selection === "draw") return "Draw";
    return selection;
  }
  if (norm === "ou25") {
    if (selection.toLowerCase().includes("over")) return "Over 2.5 goals";
    if (selection.toLowerCase().includes("under")) return "Under 2.5 goals";
    return selection;
  }
  if (norm === "btts") {
    return selection.toLowerCase().includes("yes")
      ? "Both teams to score: Yes"
      : "Both teams to score: No";
  }
  return `${market} · ${selection}`;
}

function formatKickoff(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "—", time: "—" };
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const date = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time =
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) +
    " UTC";
  return { date, time };
}

function ResultBadge({ result, kickoff }: { result: string; kickoff: string | null }) {
  const kickoffPassed = kickoff ? new Date(kickoff).getTime() < Date.now() : false;
  if (result === "pending") {
    if (kickoffPassed) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Live
        </span>
      );
    }
    return null;
  }
  if (result === "won") {
    return (
      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
        Won
      </span>
    );
  }
  if (result === "lost") {
    return (
      <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-rose-400">
        Lost
      </span>
    );
  }
  if (result === "void") {
    return (
      <span className="rounded-md bg-neutral-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
        Void
      </span>
    );
  }
  return null;
}

export default async function PicksPage() {
  const auth = await createSupabaseServer();
  const {
    data: { user },
  } = await auth.auth.getUser();
  const isSignedIn = !!user;

  const maturityLabels = isSignedIn
    ? SIGNED_IN_MATURITY_LABELS
    : PUBLIC_MATURITY_LABELS;

  let picks: UpcomingPick[] = [];
  let hiddenPickCount = 0;
  let generatedAt = new Date().toISOString();
  try {
    const result = await fetchUpcomingPicks(maturityLabels);
    picks = result.picks;
    generatedAt = new Date().toISOString();
    if (!isSignedIn) {
      const fullResult = await fetchUpcomingPicks(SIGNED_IN_MATURITY_LABELS);
      hiddenPickCount = Math.max(0, fullResult.picks.length - picks.length);
    }
  } catch {
    picks = [];
  }

  // Group by kickoff date for cleaner reading
  const groups = new Map<string, UpcomingPick[]>();
  for (const p of picks) {
    const { date } = formatKickoff(p.kickoff_utc);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(p);
  }

  const publicPickCount = picks.length; // for header count

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      <Nav />

      <main className="mx-auto max-w-4xl px-4 pt-12 pb-20">
        <div className="space-y-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            Today&apos;s picks + next 36 hours
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            {publicPickCount > 0
              ? `${publicPickCount} pick${publicPickCount === 1 ? "" : "s"} the model has flagged`
              : "No active picks right now"}
          </h1>
          <p className="mx-auto max-w-xl text-balance text-sm text-neutral-400 sm:text-base">
            Each pick is logged before kickoff and tracked on the{" "}
            <Link href="/performance" className="text-emerald-400 hover:underline">
              public ledger
            </Link>
            . Results settle automatically.
          </p>
        </div>

        {!isSignedIn && hiddenPickCount > 0 && (
          <div className="mt-8 flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-300">
                {hiddenPickCount} more pick{hiddenPickCount === 1 ? "" : "s"} from beta bots today
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">
                You&apos;re seeing the public cohort — same as Telegram. Sign in to unlock the full list and track which ones you&apos;ve placed.
              </p>
            </div>
            <Link
              href="/login?next=/picks"
              className="shrink-0 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
            >
              Sign in →
            </Link>
          </div>
        )}

        {publicPickCount === 0 ? (
          <div className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-neutral-400">
              The model didn&apos;t find any value bets in the next 36 hours.
              <br />
              Check back later — most leagues are on summer break right now (June–July).
              <br />
              You can still browse the historical{" "}
              <Link href="/performance" className="text-emerald-400 hover:underline">
                track record
              </Link>{" "}
              and the{" "}
              <Link
                href="/api/v1/track-record"
                className="font-mono text-emerald-400 hover:underline"
              >
                /api/v1/track-record
              </Link>{" "}
              JSON feed.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {Array.from(groups.entries()).map(([date, group]) => (
              <section key={date}>
                <h2 className="mb-3 text-xs font-mono uppercase tracking-widest text-neutral-500">
                  {date} · {group.length} pick{group.length === 1 ? "" : "s"}
                </h2>
                <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  {group.map((p, idx) => {
                    const { time } = formatKickoff(p.kickoff_utc);
                    const edgeHigh = (p.edge_pct ?? 0) >= 10;
                    return (
                      <div
                        key={p.id}
                        className={`px-4 py-4 sm:px-5 ${
                          idx > 0 ? "border-t border-white/[0.04]" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                              {time}
                              {p.league && (
                                <>
                                  {" · "}
                                  {p.country ? `${p.country} ` : ""}
                                  {p.league}
                                </>
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-neutral-100 sm:text-base">
                              {p.home_team ?? "Home"}{" "}
                              <span className="text-neutral-500">vs</span>{" "}
                              {p.away_team ?? "Away"}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-emerald-300">
                              <span>Pick: {formatMarket(p.market, p.selection)}</span>
                              <ResultBadge result={p.result} kickoff={p.kickoff_utc} />
                            </p>
                          </div>
                          <div className="flex items-baseline gap-4 text-right sm:gap-6">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                                Odds
                              </p>
                              <p className="font-mono text-base font-semibold tabular-nums text-neutral-100 sm:text-lg">
                                {p.odds?.toFixed(2) ?? "—"}
                              </p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                                Edge
                              </p>
                              <p
                                className={`font-mono text-base font-semibold tabular-nums sm:text-lg ${
                                  edgeHigh ? "text-emerald-400" : "text-neutral-100"
                                }`}
                              >
                                {p.edge_pct != null ? `+${p.edge_pct.toFixed(1)}%` : "—"}
                              </p>
                            </div>
                            {p.bookmaker && (
                              <div className="hidden sm:block">
                                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                                  Book
                                </p>
                                <p className="text-xs text-neutral-300">{p.bookmaker}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-16 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="mb-2 text-base font-semibold text-neutral-100">
            Get picks delivered live
          </h2>
          <p className="text-sm text-neutral-400">
            Picks land here as the model fires them. To get them pushed to your phone
            instantly, join the free Telegram channel.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Link
              href="https://t.me/oddsintelpicks"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
            >
              Join Telegram
            </Link>
            <Link
              href="/api/v1/upcoming"
              className="rounded-md border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-mono font-semibold text-neutral-100 hover:bg-white/[0.08]"
            >
              View raw JSON
            </Link>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-neutral-500">
          {isSignedIn
            ? "Signed in — showing calibrated + beta + active production strategies."
            : "Public cohort — calibrated strategies only (same set as Telegram)."}{" "}
          Generated at {new Date(generatedAt).toLocaleString()}.
        </p>
      </main>
    </div>
  );
}
