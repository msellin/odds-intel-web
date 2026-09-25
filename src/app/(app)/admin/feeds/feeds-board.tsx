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

//
// Answer-first fix round (#139, 2026-09-25): the block definitions and their colour rules moved to
// src/lib/admin-feeds-model.ts (BOOK_BLOCKS / blockState) so the page's top answer is computed from
// the SAME tones as these blocks and can never say "all running" beside an amber block. A block is
// green only inside its own schedule plus FRESH_GRACE_MIN (was 1.5 slots + 5 min), and every card
// says its normal refresh ("updates every 30 min"). Every "this hour" figure comes from budgetView
// over book_footprint — the source the top answer uses.

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { FeedStatus, FeedBookStats } from "@/lib/engine-data";
import { StatusBadge, TONE_DOT, TONE_TEXT } from "@/components/oi/status-badge";
import { FeedControls } from "./feed-controls";
import { InfoTip } from "@/components/oi/info-tip";
import { ToastProvider } from "../bots/toast";
import { relSpan, timeAgo } from "@/lib/rel-time";
import {
  BOOK_BLOCKS,
  OTHER_BLOCKS,
  blockState,
  budgetSentence,
  budgetView,
  everyText,
  freshLimitMin,
  plainFeedReason,
  statusTone,
  STATUS_STALE_MIN,
  toneRank,
  type BlockDef,
  type BudgetView,
  type FootprintHour,
} from "@/lib/admin-feeds-model";

const SHORT: Record<string, string> = {
  coolbet_prematch: "Pre-match odds", epicbet_prematch: "Pre-match odds", unibet_prematch: "Pre-match odds",
  tonybet_prematch: "Pre-match odds", tonybet_live: "Live score, corners, cards", tonybet_results: "Results",
  epicbet_inplay: "In-play odds", af_odds: "Odds (9 bookmakers)", af_closing: "Prices at kick-off", af_live: "Live scores",
  af_fixtures: "Fixtures", direct_close: "Closing prices", zone_egress: "Estonian connection",
  betfair_exchange: "Exchange prices", betfair_egress: "London connection (Betfair)",
  unibet_chrome: "Unibet browser", flaresolverr: "Browser helper", scheduler: "Job scheduler",
  database: "Database", data_api: "Data API", website: "Website", disk: "Disk space", memory: "Memory",
};

type Tone = "success" | "warning" | "danger" | "info" | "neutral";
const TONE_BORDER: Record<Tone, string> = {
  success: "border-success/30", warning: "border-warning/60", danger: "border-danger/70", info: "border-info/50", neutral: "border-border",
};
export const STATUS_WORD: Record<FeedStatus["status"], string> = {
  ok: "OK", warn: "Needs a look", fail: "Stopped", paused: "Paused", unknown: "Unknown",
};

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

/** Shared admin wording (src/lib/rel-time.ts): "25 min ago" · "6 h ago" · "12 Sep". */
function ago(iso: string | null, now: number): string {
  return iso ? timeAgo(iso, now) : "never";
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
  /** null = book_footprint unreadable: no "this hour" figures at all (never a made-up 0). */
  footprint: FootprintHour[] | null;
  now: number;
  /** Minutes since the engine's status check wrote feed_status (null = never). */
  statusAgeMin: number | null;
  preview: boolean;
}) {
  const byId = new Map(feeds.map((f) => [f.feed_id, f]));
  const stats = new Map(books.map((b) => [b.book, b]));
  const stale = statusAgeMin == null || statusAgeMin > STATUS_STALE_MIN;
  const budgets = new Map<string, BudgetView>(
    footprint ? books.filter((b) => b.budget_1h != null).map((b) => [b.book, budgetView(b.book, b.budget_1h, footprint, now)]) : [],
  );
  // ONE selected block at a time. Blocks never change size or position (the first
  // version stretched the opened block to full width and reflowed the grid); the
  // details open in a single panel directly under the selected block's row.
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const keys = new Set([...BOOK_BLOCKS, ...OTHER_BLOCKS].map((b) => b.key));
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
    const budget = b.statsBook ? budgets.get(b.statsBook) ?? null : null;
    const bs = blockState(b, byId, now, stale, budget);
    const st = b.statsBook ? stats.get(b.statsBook) : undefined;
    const deps = b.deps.map((id) => byId.get(id)).filter(Boolean) as FeedStatus[];
    return { ...bs, st, deps, budget };
  };

  const card = (b: BlockDef, big: boolean) => {
    const { main, extras, headTone, tone, problem } = view(b);
    const isSel = selected === b.key;
    const every = main && main.kind !== "close" ? everyText(main.interval_min) : null;
    // only the collectors that are NOT fine get a chip on the card; the rest are in the details
    const badExtras = stale ? [] : extras.filter((e) => statusTone(e) !== "success");
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
            {/* round 6: a late check's "All 10 OK" is not a claim we can make — it reads Unknown */}
            {stale ? "Unknown" : extras.every((e) => e.status === "ok") ? `All ${extras.length} OK` : `${extras.filter((e) => e.status === "ok").length} of ${extras.length} OK`}
          </div>
        )}
        <div className="mt-0.5 text-xs text-muted-foreground">
          {every ?? (main?.kind === "close" ? "at each kick-off" : null)}
          {every && headTone === "warning" ? <span className="text-warning"> · late</span> : null}
        </div>
        {badExtras.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {badExtras.map((e) => (
              <span key={e.feed_id} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={`size-1.5 rounded-full ${TONE_DOT[statusTone(e)]}`} aria-hidden="true" />
                {SHORT[e.feed_id] ?? e.label}
              </span>
            ))}
          </div>
        )}
        {problem && <div className={`mt-1.5 line-clamp-3 text-xs ${TONE_TEXT[tone]}`}>{problem}</div>}
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
            Today: <span className="text-foreground">{st.priced_today}/{st.fixtures_today}</span> matches priced
            {st.fixtures_today ? ` (${Math.round((100 * (st.priced_today ?? 0)) / st.fixtures_today)}%)` : ""}
            {st.liquid_today != null && (
              <span title="Listed = the exchange has the market (thin placeholders included). Usable = every runner's lay/back spread ≤ 5% and ≥ €1,000 matched on the market (betfair_exchange_feed.is_liquid).">
                {" · "}<span className="text-foreground">{st.liquid_today}</span> with enough money matched
                {st.fixtures_today ? ` (${Math.round((100 * st.liquid_today) / st.fixtures_today)}%)` : ""}
              </span>
            )}
            {" · "}yesterday {st.priced_yesterday}/{st.fixtures_yesterday}
            {st.fixtures_yesterday ? ` (${Math.round((100 * (st.priced_yesterday ?? 0)) / st.fixtures_yesterday)}%)` : ""}
            {" · "}{(st.rows_today ?? 0).toLocaleString("en-US")} prices stored today
            {" · "}{st.market_families} kinds of bet
          </div>
        )}
        {st && st.closing_priced_24h != null && st.closing_priced_24h > 0 && (
          <div
            className="text-xs text-muted-foreground"
            title="Of the matches that kicked off in the last 24 h and this book priced before kick-off, how many have a price in the final 15 minutes. Without it, 'price vs the final price' at this book is measured against a price hours old."
          >
            Closing price captured:{" "}
            <span
              className={
                (st.closing_captured_24h ?? 0) / st.closing_priced_24h < 0.8 ? "text-warning" : "text-foreground"
              }
            >
              {st.closing_captured_24h ?? 0}/{st.closing_priced_24h} kick-offs
            </span>{" "}
            ({Math.round((100 * (st.closing_captured_24h ?? 0)) / st.closing_priced_24h)}%, last 24 h)
          </div>
        )}
        {budget && (
          <div className="text-xs text-muted-foreground" title="Every request we send this book, counted across all our processes. At the hourly limit we stop sending until the next hour, so the book does not block us.">
            Requests this hour:{" "}
            <span className={budget.cap && budget.requests >= 0.8 * budget.cap ? "text-warning" : "text-foreground"}>
              {budget.requests}{budget.cap ? ` of ${budget.cap}` : ""}
            </span>
            {" · "}block checks {budget.challenges}
            {" · "}errors {budget.errors}
            {" · "}{budget.requests24h.toLocaleString("en-US")} in the last 24 h
            {(budget.lastSpent || budget.strayRefusals || budget.spentNow) && <span className="mt-0.5 block">{budgetSentence(budget)}</span>}
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

  const sortedBooks = [...BOOK_BLOCKS].sort((a, c) => toneRank(view(a).tone) - toneRank(view(c).tone));
  const selBook = sortedBooks.find((b) => b.key === selected);
  const selOther = OTHER_BLOCKS.find((b) => b.key === selected);

  return (
    <ToastProvider>
      <div className="space-y-3">
        {stale && (
          <p className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {statusAgeMin == null ? "No feed check recorded yet — blocks are grey (unknown)." : `Feed check ${statusAgeMin} min late — blocks are grey (unknown).`}
            <InfoTip>
              The engine checks every feed every 5 minutes; while that check is late we cannot say a feed is healthy, so every block is grey. Times
              shown are the last ones it saw. A book that was already late when the check last looked stays amber.
            </InfoTip>
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {sortedBooks.map((b) => card(b, true))}
        </div>
        {selBook && panel(selBook)}
        <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-3">{OTHER_BLOCKS.map((b) => card(b, false))}</div>
        {selOther && panel(selOther)}
      </div>
    </ToastProvider>
  );
}

function SubFeed({ f, now, stale, budget, preview }: { f: FeedStatus; now: number; stale: boolean; budget: BudgetView | null; preview: boolean }) {
  const tone = statusTone(f, stale);
  const word = stale ? "Unknown" : okWord(f, now);
  const reason = plainFeedReason(f.status_reason, budget);
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium">{SHORT[f.feed_id] ?? f.label}</span>
          <span className="text-xs text-muted-foreground">{everyText(f.interval_min) ? `updates ${everyText(f.interval_min)}` : f.schedule}</span>
        </div>
        <StatusBadge tone={tone} title={stale ? "The status check is stale — this is the last state it saw" : (reason ?? undefined)}>
          {word}
        </StatusBadge>
      </div>
      {f.status !== "ok" && reason && <div className={`mt-1 text-xs ${TONE_TEXT[tone]}`}>{reason}</div>}
      {!stale && word.endsWith("quiet") && (
        <div className="mt-1 text-xs text-muted-foreground">
          No new data for {relSpan(f.last_data_at, now)}, though it runs {everyText(f.interval_min)}.{" "}
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
          <summary className="cursor-pointer text-xs text-muted-foreground">Technical detail</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-danger/90">{f.last_error}</pre>
        </details>
      )}
    </div>
  );
}
