export const dynamic = 'force-dynamic';

import Link from "next/link";
import { AutoRefresh } from "../ops/auto-refresh";
import { FeedControls } from "./feed-controls";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { getFeedDashboard, type FeedStatus, type FeedBookStats } from "@/lib/engine-data";

// FEEDS-DASHBOARD (#107, 2026-09-23) — every sweeper and feed we run, from
// feed_status / feed_book_stats (engine: workers/jobs/feed_health.py, every 5 min,
// registry workers/registry/feed_registry.py). Phase B: pause / resume / run now
// per feed (FeedControls → /api/admin/feed-control, enforced by the engine).
// Service restarts arrive in phase C.
//
// Status is judged on DATA WRITTEN for book sweeps — not on the job's own
// "completed" — because that is what hid a 4-hour Coolbet outage (#108).

const DOT: Record<FeedStatus["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  fail: "bg-red-500",
  unknown: "bg-zinc-500",
  paused: "bg-sky-500",
};
const BORDER: Record<FeedStatus["status"], string> = {
  ok: "border-emerald-500/25",
  warn: "border-amber-500/40",
  fail: "border-red-500/50",
  unknown: "border-border",
  paused: "border-sky-500/40",
};
const GROUPS: { key: FeedStatus["category"]; title: string; note: string }[] = [
  { key: "book", title: "Our bookmaker sweepers", note: "Collected by us — the prices we bet and publish." },
  { key: "af", title: "API-Football", note: "Bulk feed: 9 books, fixtures, live scores." },
  { key: "infra", title: "Infrastructure", note: "Services the sweepers depend on." },
];
const BASIS: Record<FeedStatus["health_basis"], string> = {
  data: "judged on data written",
  runs: "judged on job runs",
  service: "judged on service state",
};

function ago(iso: string | null, now: number): string {
  if (!iso) return "never";
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 90) return `${m} min ago`;
  if (m < 60 * 36) return `${(m / 60).toFixed(1)} h ago`;
  return `${(m / 1440).toFixed(1)} d ago`;
}

function fmtInt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-US");
}

function pct(a: number | null, b: number | null): string {
  if (!a || !b) return "";
  return ` (${Math.round((100 * a) / b)}%)`;
}

export default async function FeedsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
  }
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
  }

  const { feeds, books, now } = await getFeedDashboard();
  const updated = feeds.reduce<string | null>((a, f) => (!a || f.updated_at > a ? f.updated_at : a), null);
  const count = (s: FeedStatus["status"]) => feeds.filter((f) => f.status === s).length;
  const order = { fail: 0, warn: 1, paused: 2, unknown: 3, ok: 4 } as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <AutoRefresh intervalMs={60_000} />
      <div>
        <Link href="/admin" className="text-xs text-muted-foreground hover:underline">← Admin</Link>
        <h1 className="text-2xl font-bold mt-1">Bookmakers &amp; feeds</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {feeds.length === 0 ? (
            "No status yet — the engine writes it every 5 minutes."
          ) : (
            <>
              <span className="text-emerald-500">{count("ok")} ok</span>
              {" · "}<span className="text-amber-500">{count("warn")} warn</span>
              {" · "}<span className="text-red-500">{count("fail")} fail</span>
              {count("paused") > 0 && <>{" · "}<span className="text-sky-500">{count("paused")} paused</span></>}
              {count("unknown") > 0 && <>{" · "}<span>{count("unknown")} unknown</span></>}
              {" · "}status {ago(updated, now)} (every 5 min)
            </>
          )}
        </p>
      </div>

      {/* Per-book collection today */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Collected today (UTC)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Book</th>
                <th className="text-right px-3 py-2 font-medium">Fixtures priced today</th>
                <th className="text-right px-3 py-2 font-medium">Yesterday</th>
                <th className="text-right px-3 py-2 font-medium">Rows today</th>
                <th className="text-right px-3 py-2 font-medium">Market types (24 h)</th>
                <th className="text-right px-3 py-2 font-medium">Last row</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b: FeedBookStats) => (
                <tr key={b.book} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{b.book}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtInt(b.priced_today)} / {fmtInt(b.fixtures_today)}
                    <span className="text-muted-foreground">{pct(b.priced_today, b.fixtures_today)}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {fmtInt(b.priced_yesterday)} / {fmtInt(b.fixtures_yesterday)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(b.rows_today)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(b.market_families)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{ago(b.last_row_at, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          &quot;Priced&quot; = at least one 1X2 price for one of our fixtures kicking off that day. Pinnacle (via
          API-Football) is shown as the reference.
        </p>
      </section>

      {GROUPS.map((g) => {
        const rows = feeds
          .filter((f) => f.category === g.key)
          .sort((a, b) => order[a.status] - order[b.status] || a.label.localeCompare(b.label));
        if (rows.length === 0) return null;
        return (
          <section key={g.key}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h2>
            <p className="text-xs text-muted-foreground mb-2">{g.note}</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {rows.map((f) => (
                <div key={f.feed_id} className={`rounded-lg border ${BORDER[f.status]} bg-card px-4 py-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[f.status]}`} />
                      <span className="font-semibold truncate">{f.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{f.schedule}</span>
                  </div>
                  {f.status_reason && (
                    <div className={`text-xs mt-1 ${f.status === "fail" ? "text-red-500" : f.status === "warn" ? "text-amber-500" : f.status === "paused" ? "text-sky-500" : "text-muted-foreground"}`}>
                      {f.status_reason}
                    </div>
                  )}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                    {f.health_basis !== "service" || f.last_data_at ? (
                      <>
                        <dt className="text-muted-foreground">Last data</dt>
                        <dd className="text-right">{ago(f.last_data_at, now)}</dd>
                      </>
                    ) : null}
                    {f.last_run_at && (
                      <>
                        <dt className="text-muted-foreground">Last run</dt>
                        <dd className="text-right">
                          {ago(f.last_run_at, now)} · {f.last_run_status}
                          {f.last_run_seconds != null && ` · ${Math.round(f.last_run_seconds)} s`}
                        </dd>
                        <dt className="text-muted-foreground">Last success</dt>
                        <dd className="text-right">{ago(f.last_success_at, now)}</dd>
                        <dt className="text-muted-foreground">Runs 24 h</dt>
                        <dd className="text-right">
                          {fmtInt(f.runs_24h)}
                          {(f.failures_24h ?? 0) > 0 && (
                            <span className="text-red-500"> · {f.failures_24h} failed</span>
                          )}
                        </dd>
                      </>
                    )}
                    {(f.rows_24h != null || f.rows_1h != null) && (
                      <>
                        <dt className="text-muted-foreground">Rows 1 h / 24 h</dt>
                        <dd className="text-right tabular-nums">
                          {fmtInt(f.rows_1h)} / {fmtInt(f.rows_24h)}
                        </dd>
                      </>
                    )}
                  </dl>
                  {f.service_state && Object.keys(f.service_state).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(f.service_state).map(([unit, state]) => (
                        <span
                          key={unit}
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-mono ${
                            ["active", "healthy", "running"].includes(state)
                              ? "border-emerald-500/30 text-emerald-500"
                              : state === "unknown"
                                ? "border-border text-muted-foreground"
                                : "border-red-500/40 text-red-500"
                          }`}
                        >
                          {unit.replace(/^oddsintel-/, "")}: {state}
                        </span>
                      ))}
                    </div>
                  )}
                  <FeedControls
                    feedId={f.feed_id}
                    label={f.label}
                    controls={f.controls ?? []}
                    paused={f.paused}
                    runNowPending={f.run_now_pending}
                  />
                  {f.last_error && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">Last error</summary>
                      <pre className="mt-1 text-[11px] whitespace-pre-wrap break-words text-red-400/90">{f.last_error}</pre>
                    </details>
                  )}
                  <div className="text-[11px] text-muted-foreground/70 mt-2">
                    {BASIS[f.health_basis]}
                    {f.stale_after_min ? ` · stale after ${f.stale_after_min} min` : ""}
                    {f.runbook && <> · runbook: <span className="font-mono">{f.runbook}</span></>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
