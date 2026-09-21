import { CoolbetDaemonsPause } from "@/components/coolbet-daemons-pause";
import type { PlacerBotRow, SessionState, TodayRealBets } from "@/lib/shadow-bots/queries";

/**
 * Daily blast-radius caps. DEFAULTS ONLY — the engine reads
 * COOLBET_MAX_BETS_PER_DAY / COOLBET_MAX_STAKE_PER_DAY from its env
 * (scripts/place_coolbet_ui.py:196), so if either is set on the Mac these
 * numbers are decoration. Kept as a display reference, labelled as such in the
 * chip's tooltip rather than presented as the live limit.
 */
export const DAILY_MAX_BETS = 80;
export const DAILY_MAX_STAKE_EUR = 800;

/**
 * DB_GATES_OPEN — the three DATABASE gates, and nothing else.
 *
 * CAN-STAKE-ONE-DEFINITION (2026-09-21). This was called `canStake` and its
 * chip read CAN_STAKE, which claimed more than it can know. The engine's
 * `coolbet_control.can_stake()` requires the same three DB gates AND at least
 * one loaded `--execute` launchd agent (or ROUTER_ALLOW_REAL in the env). The
 * browser cannot see a launchd agent, so the two answers can differ — and they
 * DO right now: both plists sit in ~/Library/LaunchAgents/paused/, so the
 * engine says no while this strip would have said yes.
 *
 * A green CAN_STAKE on a host that cannot stake is the more dangerous error of
 * the two, so the name now says exactly what is measured. The engine's verdict
 * stays the authority; this is the half of it the web can observe.
 */
export function dbGatesOpen(s: SessionState, placerBots: PlacerBotRow[]): boolean {
  return !s.placement_paused && s.real_money_armed && placerBots.some((b) => b.ui_place_enabled);
}

/** @deprecated Use dbGatesOpen — this name implied the engine's full verdict. */
export const canStake = dbGatesOpen;

function Chip({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "off" | "bad";
  title?: string;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : tone === "bad"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-white/10 bg-white/[0.03] text-neutral-400";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] ${cls}`}
      title={title}
    >
      <span className="uppercase tracking-wider text-[10px] opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

export function SafetyStrip({
  state,
  placerBots,
  today,
}: {
  state: SessionState;
  placerBots: PlacerBotRow[];
  today: TodayRealBets;
}) {
  const enabled = placerBots.filter((b) => b.ui_place_enabled);
  const ok = dbGatesOpen(state, placerBots);
  return (
    <section className="sticky top-0 z-30 -mx-6 mb-6 border-b border-white/10 bg-neutral-950/95 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          label="placement"
          value={state.placement_paused ? "PAUSED" : "live"}
          tone={state.placement_paused ? "warn" : "ok"}
          title={state.placement_paused_reason ?? "coolbet_session_state.placement_paused — the kill switch"}
        />
        <Chip
          label="publishing"
          value={state.publishing_paused ? "PAUSED" : "live"}
          tone={state.publishing_paused ? "warn" : "ok"}
          title={state.publishing_paused_reason ?? "coolbet_session_state.publishing_paused — /picks output"}
        />
        <Chip
          label="daemons"
          value={state.daemons_paused ? "PAUSED" : "running"}
          tone={state.daemons_paused ? "warn" : "ok"}
          title={state.daemons_paused_reason ?? "Mac footprint daemons — control below"}
        />
        <Chip
          label="real money"
          value={state.real_money_armed ? "ARMED" : "disarmed"}
          tone={state.real_money_armed ? "ok" : "off"}
          title={
            state.real_money_armed_reason ??
            "coolbet_session_state.real_money_armed — armed by the owner engine-side, read-only here"
          }
        />
        <a href="#scoreboard" className="no-underline">
          <Chip
            label="executors"
            value={`${enabled.length} bot${enabled.length === 1 ? "" : "s"} on`}
            tone={enabled.length > 0 ? "ok" : "off"}
            title={
              enabled.length > 0
                ? `ui_place_enabled: ${enabled.map((b) => b.bot_name).join(", ")}`
                : "No bot has ui_place_enabled — toggle on the scoreboard"
            }
          />
        </a>
        <Chip
          label="today"
          // LOGGED-PICKS-INVISIBLE (2026-09-15): the manual count used to live only
          // in the tooltip, so logging two bets by hand left the strip reading
          // "0/80 · €0/800" and the operator reasonably concluded nothing saved.
          // A hand-placed bet is real exposure; it belongs in the visible number.
          value={
            `${today.confirmedCount}/${DAILY_MAX_BETS} · €${today.confirmedStake.toFixed(0)}/${DAILY_MAX_STAKE_EUR}` +
            (today.unconfirmedCount > 0
              ? `  +${today.unconfirmedCount} manual €${today.unconfirmedStake.toFixed(0)}`
              : "")
          }
          tone={
            today.confirmedCount >= DAILY_MAX_BETS || today.confirmedStake >= DAILY_MAX_STAKE_EUR ? "bad" : "off"
          }
          title={`Confirmed automated placements today (placed_real = true) against the daily caps (DEFAULTS \u2014 the engine reads COOLBET_MAX_BETS_PER_DAY / COOLBET_MAX_STAKE_PER_DAY from its env, so these are a reference, not necessarily the live limit). "+N manual" is what YOU recorded by hand: real exposure, but unconfirmed until the account reconciler matches the ticket, so it is shown separately rather than folded into the automated caps.`}
        />
        <span className="ml-auto" />
        <Chip
          label="DB GATES"
          value={ok ? "open" : "closed"}
          tone={ok ? "ok" : "bad"}
          title={
            "The three DATABASE gates only: not paused AND armed AND \u2265 1 bot toggled on. " +
            "This is NOT the engine's full verdict \u2014 coolbet_control.can_stake() also " +
            "requires a loaded --execute launchd agent (or ROUTER_ALLOW_REAL), which a browser " +
            "cannot see. Open here does not mean anything will stake. Run " +
            "`python3 -m workers.automation.coolbet_control` on the Mac for the authoritative answer."
          }
        />
      </div>
      <div className="mt-2">
        <CoolbetDaemonsPause
          initialPaused={state.daemons_paused}
          initialReason={state.daemons_paused_reason}
          lastSeenAt={state.mac_daemon_last_tick_at}
        />
      </div>
    </section>
  );
}
