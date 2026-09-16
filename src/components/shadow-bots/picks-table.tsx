import { FLAT_STAKE_EUR } from "@/lib/engine-data";
import { botEdgeThreshold } from "@/lib/coolbet-edge";
import { ENGINE_MIN_ODDS_BY_MARKET, ENGINE_BOT_FLOORS } from "@/lib/generated/engine-floors";
import type { PlacerBotRow, Quote, SessionState, ShadowBotsPageData } from "@/lib/shadow-bots/queries";
import { oddsKey } from "@/lib/shadow-bots/queries";
import { BOOK_CHIP, isInplayControlBot } from "@/lib/shadow-bots/labels";
import {
  botTrack,
  leadBotName,
  pickVerdict,
  quoteFreshness,
  PICK_VERDICT_RANK,
  QUOTE_MAX_AGE_MIN,
} from "@/lib/shadow-bots/verdict";
import { PicksRow, type PickRowData } from "@/components/shadow-bots/picks-row";

/** Market key for the placer's per-market odds floor (engine-floors.ts). */
function marketKey(market: string): string | null {
  const m = market.toLowerCase();
  if (m === "1x2") return "1x2";
  if (m.startsWith("over_under_")) return "o/u";
  return null;
}

export function buildPickRows(
  data: ShadowBotsPageData,
  state: SessionState,
  markStates: Record<string, 1 | 2>,
  now = Date.now(),
): PickRowData[] {
  const placerByName = new Map<string, PlacerBotRow>(data.placerBots.map((p) => [p.bot_name, p]));
  // TRACK, from the SAME scoreboard the table below reads, so the two surfaces
  // cannot disagree about which bot is the lead. A green PLACE chip is a per-PICK
  // price test and says nothing about whether the bot behind it works — on
  // 2026-09-16 three of five PLACE rows belonged to the most conclusively
  // negative bot on the board. This is what tells them apart.
  const statsByName = new Map(
    data.scoreboard.map((r) => [
      r.bot_name,
      {
        n: Number(r.clv_n ?? 0),
        mean: r.clv_mc_mean == null ? null : Number(r.clv_mc_mean),
        sd: r.clv_mc_sd == null ? null : Number(r.clv_mc_sd),
      },
    ]),
  );
  const noStats = { n: 0, mean: null, sd: null };
  // Built HERE, not in the query layer: `loggedPickIds` crosses `unstable_cache`
  // and so must be JSON (see its doc comment).
  const loggedIds = new Set(data.loggedPickIds);
  const lead = leadBotName([...statsByName].map(([name, stats]) => ({ name, stats })));
  const rows: PickRowData[] = data.upcoming.map((pick) => {
    const inplay = pick.inplay_minute != null;
    // An in-play row gets NO book quotes: `odds_snapshots` is pre-match only, so
    // the newest row for a running fixture is a price that has stopped existing.
    // Its decision price is `odds_at_pick` — the book's on-screen number.
    const quotes = inplay ? [] : (data.quotes[oddsKey(pick.match_id, pick.market, pick.selection)] ?? []);
    let best: Quote | null = null;
    let unplaceable: Quote | null = null;
    for (const q of quotes) {
      const meta = BOOK_CHIP[q.book];
      if (!meta) continue;
      if (meta.placeable) {
        if (!best || q.odds > best.odds) best = q;
      } else if (!unplaceable || q.odds > unplaceable.odds) {
        unplaceable = q;
      }
    }
    const bestAgeMin = best ? (now - Date.parse(best.ts)) / 60000 : null;
    const prob = pick.calibrated_prob ?? pick.model_probability;
    const threshold = botEdgeThreshold(pick.bot_name);
    const placer = placerByName.get(pick.bot_name) ?? null;
    // The bot's OWN floors, from the REGISTRY — the machine-checked source for
    // what each bot is. This used to read the placer table, which only the two
    // real-money bots have a row in, so every other bot got a null floor and a
    // gate floor LOWER than its own (review 2026-09-15: 20 of 40 rows would
    // have read PLACE for bots the engine has never been allowed to stake).
    // Falls back to the per-market floor only for a bot the registry lacks.
    const regFloors = ENGINE_BOT_FLOORS[pick.bot_name] ?? null;
    const mk = marketKey(pick.market);
    const oddsFloor =
      regFloors?.oddsFloor ?? (mk ? ENGINE_MIN_ODDS_BY_MARKET[mk] ?? null : null);
    const oddsCap = regFloors?.oddsCap ?? null;
    const minutesToKo = (Date.parse(pick.kickoff) - now) / 60000;
    const verdict = pickVerdict({
      prob,
      threshold,
      oddsFloor,
      oddsCap,
      livePrice: best?.odds ?? null,
      quoteAgeMin: bestAgeMin,
      minutesToKo,
      placementPaused: state.placement_paused,
      botEnabled: placer ? placer.ui_place_enabled : null,
      inplay,
    });
    return {
      pick,
      prob,
      threshold,
      best,
      bestAgeMin,
      unplaceable,
      verdict,
      minutesToKo,
      inplay,
      isControlArm: isInplayControlBot(pick.bot_name),
      track: botTrack(statsByName.get(pick.bot_name) ?? noStats, pick.bot_name === lead),
      alreadyLogged: loggedIds.has(pick.id),
      // Automation state is CONTEXT on the row, not a verdict — see verdict.ts.
      automationOff: state.placement_paused || placer?.ui_place_enabled === false,
      markState: markStates[pick.id] ?? 0,
      stake: FLAT_STAKE_EUR,
    };
  });
  // Verdict band first (unchanged), then the lead bot's picks ahead of the rest
  // of that band, then kickoff. The band still dominates: a SKIP from the lead
  // must never sort above a PLACE.
  rows.sort(
    (a, b) =>
      PICK_VERDICT_RANK[a.verdict.verdict] - PICK_VERDICT_RANK[b.verdict.verdict] ||
      Number(b.track === "LEAD") - Number(a.track === "LEAD") ||
      a.pick.kickoff.localeCompare(b.pick.kickoff),
  );
  return rows;
}

export function PicksTable({ rows, truncatedBooks }: { rows: PickRowData[]; truncatedBooks: string[] }) {
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.verdict.verdict] = (acc[r.verdict.verdict] ?? 0) + 1;
    return acc;
  }, {});
  const inplayCount = rows.filter((r) => r.inplay).length;
  const leadCount = rows.filter((r) => r.track === "LEAD").length;
  const negCount = rows.filter((r) => r.track === "NEGATIVE").length;
  // One definition of stale — quoteFreshness(), the same call the row makes.
  const staleCount = rows.filter((r) => quoteFreshness(r.pick.decision_quote_age_min) === "STALE").length;
  const th = "px-2 py-1.5 text-left font-normal whitespace-nowrap";
  return (
    <section className="mb-8">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-300">Today&apos;s picks</h2>
        <span className="font-mono text-[11px] text-neutral-500">
          {rows.length} pending · PLACE {counts.PLACE ?? 0} · THIN {counts.THIN ?? 0} · SKIP {counts.SKIP ?? 0} · BLOCKED{" "}
          {counts.BLOCKED ?? 0}
          {inplayCount > 0 ? ` · in-play ${inplayCount}` : ""}
          {staleCount > 0 ? ` · stale decision quote ${staleCount}` : ""}
        </span>
        <span className="font-mono text-[11px] text-neutral-500">
          <span className="text-sky-300">LEAD {leadCount}</span>
          {negCount > 0 ? ` · from CI<0 bots ${negCount}` : ""}
        </span>
      </div>
      {truncatedBooks.length > 0 && (
        <div className="mb-2 rounded border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          Price fetch hit the row cap for {truncatedBooks.join(", ")} — some cells may read “—” though a price exists.
        </div>
      )}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-white/[0.08] px-4 py-6 text-sm text-neutral-500">
          No pending picks with a future kickoff from any active bot.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full">
            <thead className="bg-white/[0.02] text-[10px] font-mono uppercase tracking-wider text-neutral-500">
              <tr>
                <th className={th}>KO</th>
                <th className={th}>Match</th>
                <th className={th}>Pick</th>
                <th className={th}>Bot</th>
                <th className={`${th} text-right`} title="Best price at a book we can place at (CB/UB). EB shown greyed when nothing placeable">
                  Best placeable
                </th>
                <th
                  className={`${th} text-right`}
                  title={`Age of the quote the BOT decided on; FRESH under ${QUOTE_MAX_AGE_MIN} min, stale rows greyed`}
                >
                  Decision
                </th>
                <th className={`${th} text-right`} title="Age of the live quote shown to the left, in minutes">
                  Shown age
                </th>
                <th className={`${th} text-right`} title="1 / anchor probability">
                  Break-even
                </th>
                <th className={`${th} text-right`} title="1 / (anchor prob − bot threshold), or the placer's odds floor if higher">
                  Gate floor
                </th>
                <th className={`${th} text-right`} title="anchor prob − 1 / shown price">
                  Live edge
                </th>
                <th className={th} title="PLACE ≥ gate & fresh · THIN ≥ break-even · SKIP below/stale/unplaceable · BLOCKED paused/off/KO<3m">
                  Verdict
                </th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <PicksRow key={r.pick.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
