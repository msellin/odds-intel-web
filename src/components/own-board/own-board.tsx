"use client";

/**
 * [[#182]] The OWN board — client half (book filter, the two lists, the Placed control).
 *
 * Owner, 2026-09-26: "a page that tells me where to put my real money right now … look at all the
 * picks or bots and find the best odds on the books we sweep and can bet from Estonia"; "each pick
 * should have the suggested odds, so I can still try to match them at Coolbet although the best price
 * is somewhere else"; "it doesn't matter how many — they need to be better quality than /picks".
 *
 * So: READY = a bot picked it AND at least one Estonian book's price clears every gate against the
 * fair price now (EV >= 3%, fresh quote, no ceiling / outlier / wrong-fixture hit). "Take at ≥" is the
 * lowest price still worth taking — try to match it at your own book. Everything else a bot picked is
 * below, collapsed, with the reason it is not ready. The numbers are the engine's (own_bet_board);
 * nothing is recomputed here.
 */
import { useMemo, useState, useTransition } from "react";
import { BOOK_CHIP } from "@/lib/shadow-bots/labels";
import { marketLabel } from "@/lib/admin-money-format";
import { boardKey, type BoardRow } from "@/lib/own-board-shared";

const BOOKS = ["Coolbet", "Unibet-Site", "Epicbet", "Tonybet"] as const;
const SHORT: Record<string, string> = { Coolbet: "Coolbet", "Unibet-Site": "Unibet", Epicbet: "Epicbet", Tonybet: "Tonybet" };
/** Books the Placed control can log to (accessible_bookmakers rows with an account). */
const LOGGABLE = new Set(["Coolbet", "Unibet-Site"]);

const ANCHOR_LABEL: Record<string, string> = {
  sharp_blend: "Pinnacle + exchange",
  pinnacle_tight: "Pinnacle",
  exchange_liquid: "Betfair exchange",
  sharp_conflict: "Pinnacle and exchange disagree",
  consensus: "consensus of books",
  pinnacle_wide: "Pinnacle (wide line)",
  none: "no fair price",
};
const REASON: Record<string, string> = {
  below_edge_floor: "price below the take-at",
  stale_quote: "price older than 60 min",
  no_fair_price: "no fair price to judge it",
  sharp_conflict: "Pinnacle and exchange disagree",
  above_ceiling: "too good to be true (> 8%)",
  above_outlier_cap: "far off the market",
  anchor_insane: "looks like a wrong fixture",
  too_close_to_ko: "too close to kick-off",
};

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const odds2 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));
const age = (m: number) => (m < 90 ? `${Math.round(m)}m` : `${Math.round(m / 60)}h`);
const kickoff = (iso: string) =>
  `${new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Tallinn" })} EE`;

/** The row as seen through the book filter: which book, price and edge count. */
function view(r: BoardRow, book: string | null) {
  if (!book) {
    return { ready: r.clears, book: r.best_book, odds: r.best_odds, edge: r.best_edge };
  }
  const p = r.prices[book];
  return { ready: !!p && p.refusal == null, book: p ? book : null, odds: p?.odds ?? null, edge: p?.edge ?? null };
}

function whyNot(r: BoardRow, book: string | null): string {
  const ps = book ? (r.prices[book] ? [r.prices[book]] : []) : Object.values(r.prices);
  if (!ps.length) return book ? `${SHORT[book]} has no price` : "no Estonian book prices it";
  const reasons = [...new Set(ps.map((p) => p.refusal).filter(Boolean) as string[])];
  return reasons.map((x) => REASON[x] ?? x).join(" · ");
}

export function OwnBoard({ rows, placed, computedAt }: { rows: BoardRow[]; placed: string[]; computedAt: string | null }) {
  const [book, setBook] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);
  const placedSet = useMemo(() => new Set(placed), [placed]);

  const { ready, rest } = useMemo(() => {
    const ready: BoardRow[] = [];
    const rest: BoardRow[] = [];
    for (const r of rows) (view(r, book).ready ? ready : rest).push(r);
    ready.sort((a, b) => (view(b, book).edge ?? -9) - (view(a, book).edge ?? -9));
    rest.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    return { ready, rest };
  }, [rows, book]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Book:</span>
        {[null, ...BOOKS].map((b) => (
          <button
            key={b ?? "all"}
            type="button"
            onClick={() => setBook(b)}
            className={`rounded-full border px-2.5 py-0.5 ${book === b ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {b ? SHORT[b] : "All Estonian books"}
          </button>
        ))}
        {computedAt && <span className="ml-auto text-muted-foreground">Prices as of {new Date(computedAt).toISOString().slice(11, 16)} UTC · refreshed every 10 min</span>}
      </div>

      {ready.length === 0 ? (
        <div className="rounded-xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing worth betting {book ? `at ${SHORT[book]} ` : ""}right now. That is a normal answer — the board only lists a
          bet when a price clears the fair price by 3% or more.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {ready.map((r) => (
            <BoardItem key={boardKey(r)} r={r} book={book} placed={placedSet.has(boardKey(r))} at={computedAt} />
          ))}
        </ul>
      )}

      <button type="button" onClick={() => setShowRest((v) => !v)} className="text-xs text-primary hover:underline">
        {showRest ? "Hide" : "Show"} the other {rest.length} bot picks (not worth it {book ? `at ${SHORT[book]}` : "at our books"} right now)
      </button>
      {showRest && (
        <ul className="divide-y divide-border rounded-xl border border-border opacity-80">
          {rest.map((r) => (
            <BoardItem key={boardKey(r)} r={r} book={book} placed={placedSet.has(boardKey(r))} at={computedAt} why={whyNot(r, book)} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** #182 research (dev/active/own-bot-filter-study-findings.md): the per-book sharp picks hold up
 * against the independent close only in the last 3 h before kick-off (+4.9%, n 190, Holm p < 0.001);
 * earlier, the Pinnacle move usually reverts. Measured at the board's own timestamp. */
const LAST_WINDOW_H = 3;

function BoardItem({ r, book, placed, why, at }: { r: BoardRow; book: string | null; placed: boolean; why?: string; at: string | null }) {
  const v = view(r, book);
  const hToKo = at ? (Date.parse(r.kickoff) - Date.parse(at)) / 3.6e6 : null;
  const late = hToKo != null && hToKo <= LAST_WINDOW_H;
  return (
    <li className="grid gap-2 px-3 py-2.5 text-sm md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="truncate font-medium">
          {r.home} – {r.away}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {kickoff(r.kickoff)} · {r.league ?? ""}
        </div>
        {late ? (
          <span className="mt-0.5 inline-block rounded-full bg-success/15 px-1.5 py-px text-[10px] font-medium text-success" title="The window where these picks have held up against the closing price (#182 research)">
            last 3 h before kick-off
          </span>
        ) : hToKo != null ? (
          <span className="mt-0.5 inline-block text-[10px] text-muted-foreground" title="Earlier than 3 h out the price move has usually reverted by kick-off (#182 research) — waiting is often better">
            {Math.round(hToKo)} h to kick-off — early
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        <div className="font-medium">{marketLabel(r.market, r.selection)}</div>
        <div className="text-xs text-muted-foreground" title={`Fair price from ${ANCHOR_LABEL[r.anchor_source] ?? r.anchor_source}${r.anchor_books > 1 ? ` (${r.anchor_books} sources)` : ""}`}>
          fair {odds2(r.fair_odds)} · {ANCHOR_LABEL[r.anchor_source] ?? r.anchor_source}
        </div>
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs text-muted-foreground">Take at ≥</span>
          <span className="font-mono text-base font-semibold" title={book ? `${SHORT[book]}'s own bar` : "The strictest book's bar — at or above this, the price is worth taking at any of our books"}>
            {odds2(book ? r.prices[book]?.take_at ?? r.take_at : r.take_at)}
          </span>
          {v.book && (
            <span className="text-xs">
              best {SHORT[v.book]} <span className="font-mono">{odds2(v.odds)}</span>{" "}
              <span className={v.edge != null && v.edge >= 0.03 ? "text-success" : "text-muted-foreground"}>{pct(v.edge)}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
          {BOOKS.filter((b) => r.prices[b]).map((b) => {
            const p = r.prices[b];
            const good = p.refusal == null;
            return (
              <span key={b} title={`${p.refusal ? REASON[p.refusal] ?? p.refusal : "worth taking"} · take at ≥ ${odds2(p.take_at)} here`} className={good ? "text-success" : p.refusal === "stale_quote" ? "opacity-50" : ""}>
                {BOOK_CHIP[b]?.chip ?? SHORT[b].slice(0, 2).toUpperCase()} {p.odds.toFixed(2)}
                <span className="opacity-60"> {age(p.age_min)}</span>
              </span>
            );
          })}
        </div>
        {why && <div className="text-xs text-warning">{why}</div>}
      </div>
      <div className="flex flex-col items-start gap-1 md:items-end">
        <div className="flex flex-wrap gap-1">
          {r.bots.map((b) => (
            <span
              key={b.bot}
              title={`${b.bot} · ${b.status ?? "?"}`}
              className={`rounded-full border px-1.5 py-px text-[10px] ${b.vip ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}`}
            >
              {b.vip ? "VIP · " : ""}
              {b.display}
            </span>
          ))}
        </div>
        {placed ? <span className="text-xs text-success">✓ placed</span> : <Placed r={r} defaultBook={v.book} />}
      </div>
    </li>
  );
}

function Placed({ r, defaultBook }: { r: BoardRow; defaultBook: string | null }) {
  const start0 = defaultBook && LOGGABLE.has(defaultBook) ? defaultBook : "Coolbet";
  const [open, setOpen] = useState(false);
  const [bk, setBk] = useState(start0);
  const [oddsIn, setOddsIn] = useState(odds2(r.prices[start0]?.odds ?? r.take_at));
  const [stakeIn, setStakeIn] = useState("10");
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const taken = Number(oddsIn.replace(",", "."));
  const stake = Number(stakeIn.replace(",", "."));
  const ok = Number.isFinite(taken) && taken > 1 && Number.isFinite(stake) && stake > 0;
  const bar = r.prices[bk]?.take_at ?? r.take_at;
  const below = bar != null && ok && taken < bar;

  if (done) return <span className="text-xs text-success">✓ logged €{stake} @ {taken.toFixed(2)} {SHORT[bk]}</span>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted">
        I placed this…
      </button>
    );

  function commit() {
    setMsg(null);
    const lead = r.bots[0];
    start(async () => {
      const res = await fetch("/api/admin/real-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: r.match_id,
          market: r.market,
          selection: r.selection,
          bookmaker: BOOK_CHIP[bk]?.realBetsName ?? bk,
          capturedOdds: r.prices[bk]?.odds ?? null,
          actualOdds: taken,
          stake,
          notes: `manual via OWN board (#182); take_at ${odds2(r.take_at)}; bots ${r.bots.map((b) => b.bot).join(",")}`,
          ...(lead?.source === "shadow" ? { shadowBetId: lead.pick_id } : {}),
          ...(lead?.source === "sim" ? { simulatedBetId: lead.pick_id } : {}),
          ...(lead?.source === "forward_test" ? { forwardTestPickId: lead.pick_id } : {}),
        }),
      }).catch(() => null);
      const j = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: "network error" };
      if (res?.status === 409) setMsg("already logged");
      else if (!res?.ok) setMsg(j.error ?? "failed");
      else setDone(true);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <select value={bk} onChange={(e) => { setBk(e.target.value); setOddsIn(odds2(r.prices[e.target.value]?.odds ?? r.take_at)); }} className="rounded border border-border bg-background px-1 py-0.5">
        {[...LOGGABLE].map((b) => (
          <option key={b} value={b}>{SHORT[b]}</option>
        ))}
      </select>
      <span className="text-muted-foreground">@</span>
      <input aria-label="odds you took" inputMode="decimal" value={oddsIn} onChange={(e) => setOddsIn(e.target.value)} className="w-14 rounded border border-border bg-background px-1 text-right font-mono" />
      <span className="text-muted-foreground">€</span>
      <input aria-label="stake" inputMode="decimal" value={stakeIn} onChange={(e) => setStakeIn(e.target.value)} className="w-10 rounded border border-border bg-background px-1 text-right font-mono" />
      <button type="button" disabled={pending || !ok} onClick={commit} className="rounded bg-primary px-2 py-0.5 font-semibold text-primary-foreground disabled:opacity-50">
        {pending ? "…" : "Log"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground underline">cancel</button>
      {below && <span className="basis-full text-warning">below the take-at {odds2(bar)} for {SHORT[bk]}</span>}
      {msg && <span className="basis-full text-danger">{msg}</span>}
    </div>
  );
}
