/**
 * The real-money layer ladder and the CAN STAKE line (#139 phase A, spec §3.4) — the web
 * counterpart of `coolbet_control --status`. Pure, client-safe.
 *
 * Every layer is shown separately, in gate order, because each is a separate safety layer with
 * its own failure default. The page gives the operator a handle on the ones meant to move at
 * runtime; it never merges them.
 *
 * Honesty rules: an unreadable layer is "unknown", never "off". A placer that has not run recently
 * is not "on".
 *
 * CAN STAKE (2026-09-24, UX re-test + money review): a HARD block decides even when another layer is
 * unreadable — the kill switch reads Paused, arming reads Not armed, or NO bot is switched on
 * (counted raw: ui_place_enabled and not locked, BEFORE the page's own placement-path filter). The
 * engine enforces each of those fail-closed on every pick, so money cannot move → NO. Layers 1
 * (the page's copy of the placement-path rule) and 5 (Mac heartbeat — a router can stake before it
 * reports) are NOT hard: with any layer unreadable they give UNKNOWN, as before. `canStakeStrict`
 * keeps the original conservative order (any unknown → UNKNOWN) for views that show the ladder while
 * OPENING a gate (the confirmation dialogs), where the hard block is the very gate being opened.
 */
import { HEARTBEAT_STALE_MIN, isStrategicPause, type ControlState, type PlacerHeartbeat } from "./types";

export type LayerState = "open" | "blocked" | "unknown" | "info";

export interface Layer {
  n: number;
  key: "path" | "eligible" | "pause" | "armed" | "executors" | "perpick" | "footprint";
  title: string;
  state: LayerState;
  value: string;
  detail?: string;
}

export interface Ladder {
  layers: Layer[];
  canStake: "yes" | "no" | "unknown";
  /** Conservative order: any unreadable layer → "unknown" (confirmation dialogs). */
  canStakeStrict: "yes" | "no" | "unknown";
  /** A readable hard gate (kill switch, arming, zero bots on) is closed. */
  hardBlock: boolean;
  blockedAt: number[];
  unknownAt: number[];
  /** Bots that would stake if the line reads YES. */
  stakingBots: string[];
}

export type HeartbeatStatus = "alive" | "stale" | "not_reported" | "unknown";

export function heartbeatStatus(hb: PlacerHeartbeat | undefined, now: number, readError: boolean): HeartbeatStatus {
  if (readError) return "unknown";
  if (!hb || !hb.last_seen_at) return "not_reported";
  const ageMin = (now - new Date(hb.last_seen_at).getTime()) / 60000;
  return ageMin <= HEARTBEAT_STALE_MIN ? "alive" : "stale";
}

export const PLACER_LABEL: Record<string, string> = {
  coolbet_ui_placer: "Coolbet UI placer",
  best_price_router: "Best-price router",
};

export function computeLadder(
  s: ControlState,
  capable: string[] | null,
  now: number,
): Ladder {
  const layers: Layer[] = [];
  const fleet = s.fleet.row;

  // 1 — placement path (code rule over the exported config)
  layers.push(
    capable == null
      ? { n: 1, key: "path", title: "Placement path (code)", state: "unknown", value: "config unreadable" }
      : {
          n: 1,
          key: "path",
          title: "Placement path (code)",
          state: capable.length > 0 ? "info" : "blocked",
          value: `${capable.length} bot${capable.length === 1 ? "" : "s"} can technically be placed`,
          detail: "Bots whose picks our placers can technically place: before kick-off, at Coolbet or Unibet. Changing the rule is a code change.",
        },
  );

  // 2 — per-bot eligibility switch
  let staking: string[] = [];
  if (s.placers.error) {
    layers.push({ n: 2, key: "eligible", title: "Per-bot switch", state: "unknown", value: "unreadable" });
  } else {
    const cap = capable ? new Set(capable) : null;
    staking = s.placers.rows
      .filter((p) => p.ui_place_enabled && !p.locked_reason && (!cap || cap.has(p.bot_name)))
      .map((p) => p.bot_name);
    layers.push({
      n: 2,
      key: "eligible",
      title: "Per-bot switch",
      state: staking.length > 0 ? "open" : "blocked",
      value: `${staking.length} of ${s.placers.rows.length} on`,
      detail: "In the table below (€ column).",
    });
  }

  // 3 — placement pause (KILL, fails closed)
  const paused = fleet?.placement_paused ?? null;
  layers.push({
    n: 3,
    key: "pause",
    title: "Placement (kill switch)",
    state: paused == null ? "unknown" : paused ? "blocked" : "open",
    value: paused == null ? "Unknown" : paused ? "Paused" : "Running",
    detail: paused
      ? isStrategicPause(fleet?.placement_paused_reason)
        ? "Strategic stop — closed on purpose, not a technical fault"
        : "Paused — see the reason in the Placement box"
      : undefined,
  });

  // 4 — armed (fails closed)
  const armed = fleet?.real_money_armed ?? null;
  layers.push({
    n: 4,
    key: "armed",
    title: "Real money armed",
    state: armed == null ? "unknown" : armed ? "open" : "blocked",
    value: armed == null ? "Unknown" : armed ? "ARMED" : "Not armed",
    detail: armed ? fleet?.real_money_armed_reason ?? undefined : undefined,
  });

  // 5 — executors on the Mac (heartbeat)
  if (s.heartbeats.error) {
    layers.push({ n: 5, key: "executors", title: "Executors (Mac)", state: "unknown", value: "heartbeat unreadable" });
  } else {
    const st = s.heartbeats.rows.map((h) => ({ h, st: heartbeatStatus(h, now, false) }));
    const live = st.filter((x) => x.st === "alive" && x.h.execute_requested);
    const anyAlive = st.some((x) => x.st === "alive");
    if (st.length === 0) {
      layers.push({ n: 5, key: "executors", title: "Executors (Mac)", state: "unknown", value: "Not reported", detail: "No placer on the Mac has checked in yet (it reports each time it runs)." });
    } else if (live.length > 0) {
      layers.push({ n: 5, key: "executors", title: "Executors (Mac)", state: "open", value: `${live.map((x) => PLACER_LABEL[x.h.placer] ?? x.h.placer).join(", ")} alive with --execute` });
    } else {
      layers.push({
        n: 5,
        key: "executors",
        title: "Executors (Mac)",
        state: "blocked",
        value: anyAlive ? "Alive, dry-run only" : "Stale — no placer has run recently",
      });
    }
  }

  // 6 — per-pick gates (always on; informational)
  const caps = s.heartbeats.rows.map((h) => h.result?.caps).find(Boolean);
  layers.push({
    n: 6,
    key: "perpick",
    title: "Per-pick gates",
    state: "info",
    value: caps
      ? `cutoff ${caps.kickoff_cutoff_min ?? "?"} min · ${caps.max_bets_per_day ?? "?"} bets · €${caps.max_stake_per_day ?? "?"}/day · always on`
      : "cutoff, daily caps, exposure — always on (values set on the Mac)",
  });

  // 7 — Coolbet footprint pause (information only, owner decision 2026-09-24). It stops the Coolbet
  // odds SWEEPS, and the feed watchdog — never a real-money placer:
  // placement_gate.assert_run_may_place() reads only the kill switch and arming. Shown so an
  // operator who paused sweeping for Imperva does not believe that also stopped real bets.
  const foot = fleet?.daemons_paused ?? null;
  layers.push({
    n: 7,
    key: "footprint",
    title: "Coolbet sweeping",
    state: "info",
    value: foot == null ? "Unknown" : foot ? "Paused — does not stop real bets" : "Collecting — not a real-money gate",
    detail: "The footprint pause stops odds sweeping only. To stop real bets use the kill switch (layer 3).",
  });

  const unknownAt = layers.filter((l) => l.state === "unknown").map((l) => l.n);
  const blockedAt = layers.filter((l) => l.state === "blocked").map((l) => l.n);
  const rawOn = s.placers.error ? null : s.placers.rows.filter((p) => p.ui_place_enabled && !p.locked_reason).length;
  const hardBlock = paused === true || armed === false || rawOn === 0;
  const canStakeStrict = unknownAt.length > 0 ? "unknown" : blockedAt.length > 0 ? "no" : "yes";
  const canStake = hardBlock ? "no" : canStakeStrict;
  return { layers, canStake, canStakeStrict, hardBlock, blockedAt, unknownAt, stakingBots: canStake === "yes" ? staking : [] };
}
