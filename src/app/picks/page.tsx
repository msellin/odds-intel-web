/**
 * /picks — public list of upcoming pre-match picks from production strategies.
 *
 * Counterpart to /performance (settled history). This page surfaces what's
 * LIVE right now — bets the model has flagged for matches in the next 36h,
 * with full match info, odds, edge, and the bookmaker our system recommends.
 *
 * Free, no tier-gating, no signup. Same data as /api/v1/upcoming, just
 * rendered for humans.
 */
import Link from "next/link";
import { headers } from "next/headers";

interface UpcomingPick {
  id: string;
  match_id: string;
  kickoff_utc: string | null;
  league: string | null;
  country: string | null;
  home_team: string | null;
  away_team: string | null;
  market: string;
  selection: string;
  odds: number | null;
  edge_pct: number | null;
  bookmaker: string | null;
  posted_at_utc: string;
}

interface UpcomingMeta {
  generated_at_utc: string;
  horizon_hours: number;
  count: number;
  scope: string;
  notes: string;
}

async function fetchUpcoming(): Promise<{ meta: UpcomingMeta | null; picks: UpcomingPick[] }> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  try {
    const res = await fetch(`${proto}://${host}/api/v1/upcoming`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { meta: null, picks: [] };
    return (await res.json()) as { meta: UpcomingMeta; picks: UpcomingPick[] };
  } catch {
    return { meta: null, picks: [] };
  }
}

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
  const date = isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  return { date, time };
}

export default async function PicksPage() {
  const { meta, picks } = await fetchUpcoming();

  // Group by kickoff date for cleaner reading
  const groups = new Map<string, UpcomingPick[]>();
  for (const p of picks) {
    const { date } = formatKickoff(p.kickoff_utc);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(p);
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-50 antialiased">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="font-mono text-sm font-bold tracking-tight">
            ODDSINTEL
          </Link>
          <nav className="flex items-center gap-4 text-xs text-neutral-400">
            <Link href="/picks" className="text-neutral-100">Picks</Link>
            <Link href="/performance" className="hover:text-neutral-100">Track Record</Link>
            <Link href="/api/v1/upcoming" className="hidden sm:inline hover:text-neutral-100 font-mono">API</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-12 pb-20">
        <div className="space-y-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            Live picks · next 36 hours
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            {picks.length > 0
              ? `${picks.length} pick${picks.length === 1 ? "" : "s"} the model has flagged`
              : "No active picks right now"}
          </h1>
          <p className="mx-auto max-w-xl text-balance text-sm text-neutral-400 sm:text-base">
            Each pick is logged before kickoff and tracked on the{" "}
            <Link href="/performance" className="text-emerald-400 hover:underline">
              public ledger
            </Link>
            . Free for everyone — no signup, no paywall. Results settle automatically.
          </p>
        </div>

        {picks.length === 0 ? (
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
              <Link href="/api/v1/track-record" className="font-mono text-emerald-400 hover:underline">
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
                            <p className="mt-1 text-sm text-emerald-300">
                              Pick: {formatMarket(p.market, p.selection)}
                            </p>
                          </div>
                          <div className="flex items-baseline gap-4 text-right sm:gap-6">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Odds</p>
                              <p className="font-mono text-base font-semibold tabular-nums text-neutral-100 sm:text-lg">
                                {p.odds?.toFixed(2) ?? "—"}
                              </p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Edge</p>
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
                                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Book</p>
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
              href="https://t.me/oddsintelapp"
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

        {meta && (
          <p className="mt-6 text-center text-xs text-neutral-500">
            {meta.scope}.{" "}
            Generated at {new Date(meta.generated_at_utc).toLocaleString()}.
          </p>
        )}
      </main>
    </div>
  );
}
