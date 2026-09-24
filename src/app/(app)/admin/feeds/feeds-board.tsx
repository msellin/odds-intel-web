"use client";

// /admin/feeds board (#107, redesigned 2026-09-23 after a three-reviewer UX audit
// and the owner's brief): ONE BLOCK PER BOOK, showing the book name and the time
// of its last odds row, COLOURED BY AGE — so a suspicious colour is visible at a
// glance. Click a block to open everything else (each sweeper, its controls, the
// services it depends on, today's stats). API-Football (incl. the Pinnacle
// benchmark), closing prices and infrastructure sit in a smaller row below.
//
// The selected block lives in client state (so the 60 s auto-refresh never closes
// it) and in the URL hash (#coolbet), so an alert can link straight to a book.
// Blocks never resize; details open in one panel under the selected block's row.

import { useEffect, useState } from "react";
import type { FeedStatus, FeedBookStats } from "@/lib/engine-data";
import { FeedControls } from "./feed-controls";

type Tone = "green" | "amber" | "red" | "blue" | "grey";

interface BlockDef {
  key: string;            // hash / state key
  title: string;
  main?: string;          // feed whose last-data time is the headline
  extra: string[];        // other sweepers of this block
  deps: string[];         // infrastructure feeds it depends on
  statsBook?: string;     // feed_book_stats row
  note?: string;
}

const BOOKS: BlockDef[] = [
  { key: "coolbet", title: "Coolbet", main: "coolbet_prematch", extra: [], deps: ["zone_egress", "flaresolverr"], statsBook: "Coolbet" },
  { key: "epicbet", title: "Epicbet", main: "epicbet_prematch", extra: ["epicbet_inplay"], deps: ["zone_egress"], statsBook: "Epicbet" },
  { key: "unibet", title: "Unibet", main: "unibet_prematch", extra: [], deps: ["unibet_chrome", "zone_egress"], statsBook: "Unibet-Site" },
  { key: "tonybet", title: "Tonybet", main: "tonybet_prematch", extra: ["tonybet_live", "tonybet_results"], deps: ["zone_egress"], statsBook: "Tonybet" },
  { key: "betfair", title: "Betfair Exchange", main: "betfair_exchange", extra: [], deps: ["betfair_egress"], statsBook: "Betfair-Exchange",
    note: "Reference only — a second sharp price beside Pinnacle, never bet and never published. Back/lay prices plus matched money every 15 min through the London exit (the exchange shows no markets to our Finnish server). Thin markets are placeholders, so only liquid ones (spread ≤5%, ≥€1,000 matched) count as a price." },
];
const OTHERS: BlockDef[] = [
  { key: "api-football", title: "API-Football", main: "af_odds", extra: ["af_closing", "af_live", "af_fixtures"], deps: [],
    statsBook: "Pinnacle", note: "Bulk feed of 9 books. Pinnacle — our benchmark line — comes from here; we do not collect it ourselves." },
  { key: "closing", title: "Closing prices", main: "direct_close", extra: [], deps: [],
    note: "Runs every 5 min, but only captures when one of our paired matches kicks off within the next 15 min — so a gap between kickoff waves is normal. Colour follows the job's health, not the age of the last capture." },
  { key: "infra", title: "Infrastructure",
    extra: ["zone_egress", "betfair_egress", "unibet_chrome", "flaresolverr", "scheduler", "database", "data_api", "website", "disk", "memory"],
    deps: [], note: "Everything the sweepers and the website run on, on the VPS." },
];

const SHORT: Record<string, string> = {
  coolbet_prematch: "Pre-match odds", epicbet_prematch: "Pre-match odds", unibet_prematch: "Pre-match odds",
  tonybet_prematch: "Pre-match odds", tonybet_live: "Live score, corners, cards", tonybet_results: "Results",
  epicbet_inplay: "In-play odds", af_odds: "Bulk odds", af_closing: "Closing snapshots", af_live: "Live scores",
  af_fixtures: "Fixtures", direct_close: "Closing prices", zone_egress: "Estonian exit",
  betfair_exchange: "Back/lay + liquidity", betfair_egress: "London exit (Betfair)",
  unibet_chrome: "Unibet Chrome", flaresolverr: "FlareSolverr", scheduler: "Engine scheduler",
  database: "Database", data_api: "Data API (PostgREST)", website: "Website", disk: "Disk space", memory: "Memory",
};

const TONE_TEXT: Record<Tone, string> = {
  green: "text-emerald-500", amber: "text-amber-500", red: "text-red-500", blue: "text-sky-500", grey: "text-muted-foreground",
};
const TONE_BORDER: Record<Tone, string> = {
  green: "border-emerald-500/30", amber: "border-amber-500/60", red: "border-red-500/70", blue: "border-sky-500/50", grey: "border-border",
};
const TONE_DOT: Record<Tone, string> = {
  green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-sky-500", grey: "bg-zinc-500",
};
const RANK: Record<Tone, number> = { red: 0, amber: 1, blue: 2, grey: 3, green: 4 };

function statusTone(f?: FeedStatus): Tone {
  if (!f) return "grey";
  return ({ ok: "green", warn: "amber", fail: "red", paused: "blue", unknown: "grey" } as const)[f.status];
}

/** The headline colour: age of the last data row against this feed's own schedule. */
function ageTone(f: FeedStatus | undefined, now: number): Tone {
  if (!f) return "grey";
  if (f.paused) return "blue";
  // Closing capture only writes when a paired match kicks off within 15 min, so
  // "34 min since last data" between kickoff waves is normal — colour it by the
  // job's own health instead (owner asked about exactly this, 2026-09-23).
  if (f.kind === "close") return statusTone(f);
  if (!f.last_data_at) return f.health_basis === "data" ? "red" : statusTone(f);
  const m = (now - new Date(f.last_data_at).getTime()) / 60000;
  const interval = f.interval_min ?? 30;
  const stale = f.stale_after_min ?? interval * 3;
  if (m <= interval * 1.5 + 5) return "green";
  if (m <= stale) return "amber";
  return "red";
}

function ago(iso: string | null, now: number): string {
  if (!iso) return "never";
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 90) return `${m} min ago`;
  if (m < 60 * 36) return `${(m / 60).toFixed(1)} h ago`;
  return `${(m / 1440).toFixed(1)} d ago`;
}

function clock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

function worst(tones: Tone[]): Tone {
  return tones.reduce<Tone>((a, t) => (RANK[t] < RANK[a] ? t : a), "green");
}

export function FeedsBoard({ feeds, books, now }: { feeds: FeedStatus[]; books: FeedBookStats[]; now: number }) {
  const byId = new Map(feeds.map((f) => [f.feed_id, f]));
  const stats = new Map(books.map((b) => [b.book, b]));
  // ONE selected block at a time. Blocks never change size or position (the first
  // version stretched the opened block to full width and reflowed the grid); the
  // details open in a single panel directly under the selected block's row.
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h) setSelected(h);
  }, []);

  function select(key: string) {
    setSelected((prev) => {
      const next = prev === key ? null : key;
      window.history.replaceState(null, "", next ? `#${next}` : window.location.pathname);
      return next;
    });
  }

  const view = (b: BlockDef) => {
    const main = b.main ? byId.get(b.main) : undefined;
    const extras = b.extra.map((id) => byId.get(id)).filter(Boolean) as FeedStatus[];
    const headTone = b.main ? ageTone(main, now) : worst(extras.map(statusTone));
    const tone = worst([headTone, ...extras.map(statusTone)]);
    const st = b.statsBook ? stats.get(b.statsBook) : undefined;
    const deps = b.deps.map((id) => byId.get(id)).filter(Boolean) as FeedStatus[];
    return { main, extras, headTone, tone, st, deps };
  };

  const card = (b: BlockDef, big: boolean) => {
    const { main, extras, headTone, tone, st } = view(b);
    const isSel = selected === b.key;
    const problem = main && main.status !== "ok" && main.status !== "paused"
      ? main.status_reason
      : extras.find((e) => e.status === "fail" || e.status === "warn")?.status_reason;
    return (
      <button key={b.key} id={b.key} onClick={() => select(b.key)} aria-expanded={isSel}
        className={`text-left rounded-lg border-2 ${TONE_BORDER[tone]} bg-card px-4 py-3 transition-colors hover:bg-accent/40 ${isSel ? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-background" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`font-semibold ${big ? "text-lg" : ""}`}>{b.title}</span>
          <span className="text-xs text-muted-foreground">{isSel ? "▴" : "▾"}</span>
        </div>
        {b.main ? (
          <div className={`${big ? "text-2xl" : "text-lg"} font-bold tabular-nums ${TONE_TEXT[headTone]}`}>
            {main?.paused ? "paused" : ago(main?.last_data_at ?? null, now)}
          </div>
        ) : (
          <div className={`text-lg font-bold ${TONE_TEXT[headTone]}`}>
            {extras.filter((e) => e.status === "ok").length}/{extras.length} OK
          </div>
        )}
        {!b.main && extras[0] && (
          <div className="text-xs text-muted-foreground mt-0.5">checked {ago(extras[0].updated_at, now)}</div>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">
          {b.main && <>{main?.kind === "close" ? "last capture" : "last odds"} {clock(main?.last_data_at ?? null)}</>}
          {st && st.fixtures_today ? <> · {st.priced_today}/{st.fixtures_today} fixtures today</> : null}
        </div>
        {extras.length > 0 && b.main && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {extras.map((e) => (
              <span key={e.feed_id} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[statusTone(e)]}`} />
                {SHORT[e.feed_id] ?? e.label}
              </span>
            ))}
          </div>
        )}
        {problem && tone !== "green" && <div className={`text-xs mt-1.5 line-clamp-2 ${TONE_TEXT[tone]}`}>{problem}</div>}
      </button>
    );
  };

  const panel = (b: BlockDef) => {
    const { main, extras, st, deps } = view(b);
    return (
      <div className="rounded-lg border border-border bg-card/60 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{b.title} — details</span>
          <button onClick={() => select(b.key)} className="text-xs text-muted-foreground hover:underline">Close ✕</button>
        </div>
        {b.note && <p className="text-xs text-muted-foreground">{b.note}</p>}
        {st && (
          <div className="text-xs text-muted-foreground">
            Today: <span className="text-foreground">{st.priced_today}/{st.fixtures_today}</span> fixtures priced
            {st.fixtures_today ? ` (${Math.round((100 * (st.priced_today ?? 0)) / st.fixtures_today)}%)` : ""}
            {" · "}yesterday {st.priced_yesterday}/{st.fixtures_yesterday}
            {st.fixtures_yesterday ? ` (${Math.round((100 * (st.priced_yesterday ?? 0)) / st.fixtures_yesterday)}%)` : ""}
            {" · "}{(st.rows_today ?? 0).toLocaleString("en-US")} prices stored today
            {" · "}{st.market_families} market types
          </div>
        )}
        {st && st.requests_24h != null && (
          <div className="text-xs text-muted-foreground" title="Every request we send this book, counted across all our processes. Over budget, requests are refused before they are sent — so one book's exit IP never gets flagged again (#110).">
            Requests this hour:{" "}
            <span className={st.budget_1h && (st.requests_1h ?? 0) >= 0.8 * st.budget_1h ? "text-amber-400" : "text-foreground"}>
              {st.requests_1h ?? 0}{st.budget_1h ? ` / ${st.budget_1h}` : ""}
            </span>
            {st.budget_1h ? " budget" : ""}
            {" · "}bot-checks {st.challenges_1h ?? 0}
            {" · "}errors {st.errors_1h ?? 0}
            {" · "}{(st.requests_24h ?? 0).toLocaleString("en-US")} in 24 h
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[main, ...extras].filter(Boolean).map((f) => (
            <SubFeed key={(f as FeedStatus).feed_id} f={f as FeedStatus} now={now} />
          ))}
        </div>
        {deps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Depends on:</span>
            {deps.map((d) => (
              <span key={d.feed_id} className="inline-flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[statusTone(d)]}`} />
                {SHORT[d.feed_id] ?? d.label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sortedBooks = [...BOOKS].sort((a, c) => RANK[view(a).tone] - RANK[view(c).tone]);
  const selBook = sortedBooks.find((b) => b.key === selected);
  const selOther = OTHERS.find((b) => b.key === selected);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sortedBooks.map((b) => card(b, true))}
      </div>
      {selBook && panel(selBook)}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">{OTHERS.map((b) => card(b, false))}</div>
      {selOther && panel(selOther)}
    </div>
  );
}

function SubFeed({ f, now }: { f: FeedStatus; now: number }) {
  const tone = statusTone(f);
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} />
          <span className="text-sm font-medium">{SHORT[f.feed_id] ?? f.label}</span>
          <span className="text-xs text-muted-foreground">{f.schedule}</span>
        </div>
        <span className={`text-xs ${TONE_TEXT[tone]}`}>{f.status === "ok" ? "OK" : f.status_reason}</span>
      </div>
      {(f.kind === "service" || f.kind === "host") && f.service_state && (
        <div className="text-xs text-muted-foreground mt-1">
          {Object.values(f.service_state).join(" · ")} · checked {ago(f.updated_at, now)}
        </div>
      )}
      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {f.last_data_at !== null && <span>Last data: {ago(f.last_data_at, now)}</span>}
        {f.last_run_at && (
          <span>
            Last run: {ago(f.last_run_at, now)} ({f.last_run_status}
            {f.last_run_seconds != null ? `, ${Math.round(f.last_run_seconds)} s` : ""})
          </span>
        )}
        {f.runs_24h != null && f.last_run_at && (
          <span>
            {f.runs_24h} runs in 24 h{(f.failures_24h ?? 0) > 0 ? `, ${f.failures_24h} failed` : ""}
          </span>
        )}
      </div>
      <FeedControls feedId={f.feed_id} label={f.label} controls={f.controls ?? []} paused={f.paused}
        runNowPending={f.run_now_pending} />
      {f.last_error && f.status !== "ok" && (
        <details className="mt-1.5">
          <summary className="text-xs text-muted-foreground cursor-pointer">Last error</summary>
          <pre className="mt-1 text-[11px] whitespace-pre-wrap break-words text-red-400/90">{f.last_error}</pre>
        </details>
      )}
    </div>
  );
}
