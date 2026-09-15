import { CoolbetDaemonsPause } from "@/components/coolbet-daemons-pause";
import type { PlacerBotRow, SessionState, TodayRealBets } from "@/lib/shadow-bots/queries";

/** Daily blast-radius caps the engine placer enforces (coolbet_placer). Display only. */
export const DAILY_MAX_BETS = 80;
export const DAILY_MAX_STAKE_EUR = 800;

/**
 * CAN_STAKE — the one line that says whether anything can stake real money now:
 * not paused AND armed AND at least one bot toggled on. Mirrors the engine's
 * fail-closed pair (placement_paused = kill switch, real_money_armed = arming
 * switch, migration 354) plus the per-bot toggle.
 */
export function canStake(s: SessionState, placerBots: PlacerBotRow[]): boolean {
  return !s.placement_paused && s.real_money_armed && placerBots.some((b) => b.ui_place_enabled);
}

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
  const ok = canStake(state, placerBots);
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
          value={`${today.confirmedCount}/${DAILY_MAX_BETS} · €${today.confirmedStake.toFixed(0)}/${DAILY_MAX_STAKE_EUR}`}
          tone={
            today.confirmedCount >= DAILY_MAX_BETS || today.confirmedStake >= DAILY_MAX_STAKE_EUR ? "bad" : "off"
          }
          title={`Confirmed real_bets today (placed_real = true). ${today.unconfirmedCount} unconfirmed manual (€${today.unconfirmedStake.toFixed(0)}) not counted.`}
        />
        <span className="ml-auto" />
        <Chip
          label="CAN_STAKE"
          value={ok ? "yes" : "no"}
          tone={ok ? "ok" : "bad"}
          title="not paused AND armed AND ≥ 1 bot toggled on"
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
