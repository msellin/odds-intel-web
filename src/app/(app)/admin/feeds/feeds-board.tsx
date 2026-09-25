"use client";

// /admin/feeds board (#107, redesigned 2026-09-23 after a three-reviewer UX audit
// and the owner's brief): ONE BLOCK PER BOOK, showing the book name and the time
// of its last odds row, COLOURED BY AGE — so a suspicious colour is visible at a
// glance. Click a block to open everything else (each sweeper, its controls, the
// services it depends on, today's stats). API-Football (incl. the Pinnacle
// benchmark), closing prices and infrastructure sit in a smaller row below.
//
// The selected block lives in client state (so the 60 s auto-refresh never closes
// it) and in the URL hash, so an alert can link straight to a book. Anchor scheme
// (#139 UX fix round, 2026-09-24): every block has id="book-<key>" — book-coolbet,
// book-epicbet, book-unibet, book-tonybet, book-betfair, book-api-football,
// book-closing, book-infra — and /admin/feeds#book-coolbet opens that block. The
// old #coolbet form still opens it. Blocks never resize; details open in one panel
// under the selected block's row.
//
// Honesty rules added in the same round: when the status check itself is older than
// STATUS_STALE_MIN every colour goes grey ("unknown") — a green from a stale check is
// a claim we cannot make; a feed's "Fresh" is only said when its last data is within
// its own schedule (a 2-minute live feed quiet for 34 min between games says "OK ·
// quiet", with its allowed gap); and a book's request budget is described by the hour
// that actually ran out (budgetSentence in src/lib/admin-feeds.ts), not by a refusal
// counter that lands in the wrong hour.

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { FeedStatus, FeedBookStats } from "@/lib/engine-data";
import { StatusBadge, TONE_DOT, TONE_TEXT } from "@/components/oi/status-badge";
import { FeedControls } from "./feed-controls";
import { ToastProvider } from "../bots/toast";
import { relSpan, timeAgo } from "@/lib/rel-time";
import { feedHealth, BUDGET_REASON_RE, budgetSentence, budgetView, STATUS_STALE_MIN, type BudgetView, type FootprintHour } from "@/lib/admin-feeds-model";

// #139 admin redesign (2026-09-24): colours are the admin status tokens (success / warning /
// danger / info / neutral) instead of hard-coded emerald / amber / red / sky; logic unchanged.
type Tone = "success" | "warning" | "danger" | "info" | "neutral";

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

const TONE_BORDER: Record<Tone, string> = {
  success: "border-success/30", warning: "border-warning/60", danger: "border-danger/70", info: "border-info/50", neutral: "border-border",
};
const RANK: Record<Tone, number> = { danger: 0, warning: 1, info: 2, neutral: 3, success: 4 };
export const STATUS_WORD: Record<FeedStatus["status"], string> = {
  ok: "OK", warn: "Needs a look", fail: "Stopped", paused: "Paused", unknown: "Unknown",
};

/** Minutes a feed's data may age and still be called fresh: 1.5 schedule slots + 5 min. */
function freshLimitMin(f: FeedStatus): number {
  return (f.interval_min ?? 30) * 1.5 + 5;
}

/**
 * The word on a feed's badge. "Fresh" only when its last data is inside its own schedule; a feed the
 * engine judges by runs or by the service being up says so instead of claiming fresh data.
 */
export function okWord(f: FeedStatus, now: number): string {
  if (f.status !== "ok") return STATUS_WORD[f.status];
  if (f.health_basis === "service") return "Up";
  if (!f.last_data_at) return f.health_basis === "runs" ? "Running on time" : "OK";
  const m = (now - new Date(f.last_data_at).getTime()) / 60000;
  if (m <= freshLimitMin(f)) return "Fresh";
  return f.health_basis === "runs" ? "Running · quiet" : "OK · quiet";
}

function statusTone(f: FeedStatus | undefined, stale = false): Tone {
  if (!f || stale) return "neutral";
  return ({ ok: "success", warn: "warning", fail: "danger", paused: "info", unknown: "neutral" } as const)[feedHealth(f)];
}

/** The headline colour: age of the last data row against this feed's own schedule. */
function ageTone(f: FeedStatus | undefined, now: number, stale: boolean): Tone {
  if (!f || stale) return "neutral";
  if (f.paused) return "info";
  // Closing capture only writes when a paired match kicks off within 15 min, so
  // "34 min since last data" between kickoff waves is normal — colour it by the
  // job's own health instead (owner asked about exactly this, 2026-09-23).
  if (f.kind === "close") return statusTone(f);
  if (!f.last_data_at) return f.health_basis === "data" ? "danger" : statusTone(f);
  const m = (now - new Date(f.last_data_at).getTime()) / 60000;
  const limit = f.stale_after_min ?? (f.interval_min ?? 30) * 3;
  if (m <= freshLimitMin(f)) return "success";
  if (m <= limit) return "warning";
  return "danger";
}

/** Shared admin wording (src/lib/rel-time.ts): "25 min ago" · "6 h ago" · "12 Sep". */
function ago(iso: string | null, now: number): string {
  return iso ? timeAgo(iso, now) : "never";
}

function clock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

function worst(tones: Tone[]): Tone {
  return tones.reduce<Tone>((a, t) => (RANK[t] < RANK[a] ? t : a), "success");
}

export function FeedsBoard({
  feeds,
  books,
  footprint,
  now,
  statusAgeMin,
  preview,
}: {
  feeds: FeedStatus[];
  books: FeedBookStats[];
  footprint: FootprintHour[];
  now: number;
  /** Minutes since the engine's status check wrote feed_status (null = never). */
  statusAgeMin: number | null;
  preview: boolean;
}) {
  const byId = new Map(feeds.map((f) => [f.feed_id, f]));
  const stats = new Map(books.map((b) => [b.book, b]));
  const stale = statusAgeMin == null || statusAgeMin > STATUS_STALE_MIN;
  const budgets = new Map<string, BudgetView>(
    books.filter((b) => b.budget_1h != null).map((b) => [b.book, budgetView(b.book, b.budget_1h, footprint, now)]),
  );
  // ONE selected block at a time. Blocks never change size or position (the first
  // version stretched the opened block to full width and reflowed the grid); the
  // details open in a single panel directly under the selected block's row.
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const keys = new Set([...BOOKS, ...OTHERS].map((b) => b.key));
    const fromHash = () => {
      const h = window.location.hash.replace(/^#(book-)?/, "");
      if (keys.has(h)) setSelected(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  // The URL update happens OUTSIDE the state updater: Next's router patches history.replaceState,
  // and calling it inside setState's updater updated the Router during FeedsBoard's render
  // ("Cannot update a component while rendering a different component", #139 UX fix round).
  function select(key: string) {
    const next = selected === key ? null : key;
    setSelected(next);
    window.history.replaceState(window.history.state, "", next ? `#book-${next}` : window.location.pathname + window.location.search);
  }

  const view = (b: BlockDef) => {
    const main = b.main ? byId.get(b.main) : undefined;
    const extras = b.extra.map((id) => byId.get(id)).filter(Boolean) as FeedStatus[];
    const headTone = b.main ? ageTone(main, now, stale) : worst(extras.map((e) => statusTone(e, stale)));
    // The headline number is coloured by data age; the block's border also carries the main feed's
    // own verdict (e.g. a sweep came back thin), so a warn is never hidden behind a fresh timestamp.
    // A stale status check greys everything: worst() of all-neutral is neutral.
    const tone = stale ? "neutral" : worst([headTone, ...(main ? [statusTone(main)] : []), ...extras.map((e) => statusTone(e))]);
    const st = b.statsBook ? stats.get(b.statsBook) : undefined;
    const budget = b.statsBook ? budgets.get(b.statsBook) ?? null : null;
    const deps = b.deps.map((id) => byId.get(id)).filter(Boolean) as FeedStatus[];
    return { main, extras, headTone, tone, st, deps, budget };
  };

  const card = (b: BlockDef, big: boolean) => {
    const { main, extras, headTone, tone, st, budget } = view(b);
    const isSel = selected === b.key;
    const raw = main && feedHealth(main) !== "ok" && feedHealth(main) !== "paused"
      ? main.status_reason
      : extras.find((e) => e.status === "fail" || e.status === "warn")?.status_reason;
    // The engine's "request budget spent — N refused this hour" is replaced by which hour actually ran out.
    const problem = raw && BUDGET_REASON_RE.test(raw) && budget ? budgetSentence(budget) : raw;
    return (
      <button key={b.key} id={`book-${b.key}`} type="button" onClick={() => select(b.key)} aria-expanded={isSel}
        className={`scroll-mt-24 rounded-xl border-2 ${TONE_BORDER[tone]} bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isSel ? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-background" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`flex min-w-0 items-center gap-2 font-medium ${big ? "text-base" : "text-sm"}`}>
            <span className={`size-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
            <span className="truncate">{b.title}</span>
          </span>
          {isSel ? <ChevronUp size={14} className="text-muted-foreground" aria-hidden="true" /> : <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />}
        </div>
        {b.main ? (
          <div className={`mt-1 ${big ? "text-2xl" : "text-lg"} font-semibold tabular-nums ${TONE_TEXT[headTone]}`}>
            {main?.paused ? (main.paused_by === "auto" ? "stopped" : "paused") : ago(main?.last_data_at ?? null, now)}
          </div>
        ) : (
          <div className={`mt-1 text-lg font-semibold ${TONE_TEXT[headTone]}`}>
            {extras.filter((e) => e.status === "ok").length}/{extras.length} OK
          </div>
        )}
        {!b.main && extras[0] && (
          <div className="text-xs text-muted-foreground mt-0.5">checked {ago(extras[0].updated_at, now)}</div>
        )}
        <div className="text-xs text-muted-foreground mt-0.5">
          {b.main && <>{main?.kind === "close" ? "last capture" : "last odds"} {clock(main?.last_data_at ?? null)}</>}
          {st && st.fixtures_today ? <> · {st.priced_today}/{st.fixtures_today} fixtures today</> : null}
          {st && st.liquid_today != null ? <> · {st.liquid_today} liquid</> : null}
        </div>
        {extras.length > 0 && b.main && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {extras.map((e) => (
              <span key={e.feed_id} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[statusTone(e, stale)]}`} aria-hidden="true" />
                {SHORT[e.feed_id] ?? e.label}
              </span>
            ))}
          </div>
        )}
        {problem && tone !== "success" && !stale && <div className={`mt-1.5 line-clamp-3 text-xs ${TONE_TEXT[tone]}`}>{problem}</div>}
      </button>
    );
  };

  const panel = (b: BlockDef) => {
    const { main, extras, st, deps, budget } = view(b);
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{b.title} — details</span>
          <button onClick={() => select(b.key)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Close <X size={12} aria-hidden="true" />
          </button>
        </div>
        {b.note && <p className="text-xs text-muted-foreground">{b.note}</p>}
        {st && (
          <div className="text-xs text-muted-foreground">
            Today: <span className="text-foreground">{st.priced_today}/{st.fixtures_today}</span> fixtures priced
            {st.fixtures_today ? ` (${Math.round((100 * (st.priced_today ?? 0)) / st.fixtures_today)}%)` : ""}
            {st.liquid_today != null && (
              <span title="Listed = the exchange has the market (thin placeholders included). Liquid = usable as a price: every runner's lay/back spread ≤ 5% and ≥ €1,000 matched on the market (betfair_exchange_feed.is_liquid).">
                {" · "}<span className="text-foreground">{st.liquid_today}</span> liquid
                {st.fixtures_today ? ` (${Math.round((100 * st.liquid_today) / st.fixtures_today)}%)` : ""}
              </span>
            )}
            {" · "}yesterday {st.priced_yesterday}/{st.fixtures_yesterday}
            {st.fixtures_yesterday ? ` (${Math.round((100 * (st.priced_yesterday ?? 0)) / st.fixtures_yesterday)}%)` : ""}
            {" · "}{(st.rows_today ?? 0).toLocaleString("en-US")} prices stored today
            {" · "}{st.market_families} market types
          </div>
        )}
        {st && st.closing_priced_24h != null && st.closing_priced_24h > 0 && (
          <div
            className="text-xs text-muted-foreground"
            title="Of the fixtures that kicked off in the last 24 h and this book priced before kickoff, how many have a price in the final 15 minutes. Without a close, CLV at this book is measured against a price hours old (#107 C)."
          >
            Closing price captured:{" "}
            <span
              className={
                (st.closing_captured_24h ?? 0) / st.closing_priced_24h < 0.8 ? "text-warning" : "text-foreground"
              }
            >
              {st.closing_captured_24h ?? 0}/{st.closing_priced_24h} kickoffs
            </span>{" "}
            ({Math.round((100 * (st.closing_captured_24h ?? 0)) / st.closing_priced_24h)}%, last 24 h)
          </div>
        )}
        {st && st.requests_24h != null && (
          <div className="text-xs text-muted-foreground" title="Every request we send this book, counted across all our processes. Over budget, requests are refused before they are sent — so one book's exit IP never gets flagged again (#110).">
            Requests this hour:{" "}
            <span className={st.budget_1h && (st.requests_1h ?? 0) >= 0.8 * st.budget_1h ? "text-warning" : "text-foreground"}>
              {st.requests_1h ?? 0}{st.budget_1h ? ` / ${st.budget_1h}` : ""}
            </span>
            {st.budget_1h ? " budget" : ""}
            {" · "}bot-checks {st.challenges_1h ?? 0}
            {" · "}errors {st.errors_1h ?? 0}
            {" · "}{(st.requests_24h ?? 0).toLocaleString("en-US")} in 24 h
            {budget && <span className="mt-0.5 block">{budgetSentence(budget)}</span>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[main, ...extras].filter(Boolean).map((f) => (
            <SubFeed key={(f as FeedStatus).feed_id} f={f as FeedStatus} now={now} stale={stale} budget={budget} preview={preview} />
          ))}
        </div>
        {deps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Depends on:</span>
            {deps.map((d) => (
              <span key={d.feed_id} className="inline-flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[statusTone(d, stale)]}`} aria-hidden="true" />
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
    <ToastProvider>
      <div className="space-y-3">
        {stale && (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {statusAgeMin == null
              ? "No status check recorded yet, so every block is grey — unknown, not healthy."
              : `The status check is ${statusAgeMin} min old (it should run every 5 min), so every block is grey — unknown, not healthy. The times shown are the last ones it saw.`}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sortedBooks.map((b) => card(b, true))}
        </div>
        {selBook && panel(selBook)}
        <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3">{OTHERS.map((b) => card(b, false))}</div>
        {selOther && panel(selOther)}
      </div>
    </ToastProvider>
  );
}

function SubFeed({ f, now, stale, budget, preview }: { f: FeedStatus; now: number; stale: boolean; budget: BudgetView | null; preview: boolean }) {
  const tone = statusTone(f, stale);
  const word = stale ? "Unknown" : okWord(f, now);
  const reason = f.status_reason && BUDGET_REASON_RE.test(f.status_reason) && budget ? budgetSentence(budget) : f.status_reason;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium">{SHORT[f.feed_id] ?? f.label}</span>
          <span className="text-xs text-muted-foreground">{f.schedule}</span>
        </div>
        <StatusBadge tone={tone} title={stale ? "The status check is stale — this is the last state it saw" : (reason ?? undefined)}>
          {word}
        </StatusBadge>
      </div>
      {f.status !== "ok" && reason && <div className={`mt-1 text-xs ${TONE_TEXT[tone]}`}>{reason}</div>}
      {!stale && word.endsWith("quiet") && (
        <div className="mt-1 text-xs text-muted-foreground">
          No new data for {relSpan(f.last_data_at, now)}, though it runs every {f.interval_min} min.{" "}
          {f.health_basis === "runs"
            ? "Its runs are on time, so it counts as OK"
            : `The engine allows a gap of up to ${f.stale_after_min} min before calling it stopped`}
          {f.kind === "live" ? " — live data only comes while games are on." : "."}
        </div>
      )}
      {(f.kind === "service" || f.kind === "host") && f.service_state && (
        <div className="mt-1 text-xs text-muted-foreground">
          {Object.values(f.service_state).join(" · ")} · checked {ago(f.updated_at, now)}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
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
        {f.paused && f.paused_reason && <span className="text-info">Paused: “{f.paused_reason}”</span>}
      </div>
      <FeedControls feedId={f.feed_id} label={f.label} book={f.book} schedule={f.schedule} controls={f.controls ?? []} paused={f.paused}
        runNowPending={f.run_now_pending} budget={f.category === "book" ? budget : null} preview={preview} />
      {f.last_error && f.status !== "ok" && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-xs text-muted-foreground">Last error</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-danger/90">{f.last_error}</pre>
        </details>
      )}
    </div>
  );
}
