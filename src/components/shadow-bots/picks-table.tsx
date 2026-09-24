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
} from "@/lib/shadow-bots/verdict";
import type { PickRowData } from "@/components/shadow-bots/picks-row";

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

/** Headline counts for the StatCard row — one definition of stale (quoteFreshness, as the row). */
export function queueCounts(rows: PickRowData[], now = Date.now()) {
  const by = (v: PickRowData["verdict"]["verdict"]) => rows.filter((r) => r.verdict.verdict === v).length;
  const dayEnd = new Date(now);
  dayEnd.setUTCHours(24, 0, 0, 0);
  return {
    total: rows.length,
    place: by("PLACE"),
    thin: by("THIN"),
    inplay: rows.filter((r) => r.inplay).length,
    today: rows.filter((r) => Date.parse(r.pick.kickoff) < dayEnd.getTime()).length,
    stale: rows.filter((r) => quoteFreshness(r.pick.decision_quote_age_min) === "STALE").length,
    lead: rows.filter((r) => r.track === "LEAD").length,
  };
}
