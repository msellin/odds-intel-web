/**
 * /admin/bots control panel — shared types and copy (#139 phase A, 2026-09-24).
 *
 * Spec: odds-intel-engine dev/active/bots-control-panel-spec.md (§16 owner decisions override
 * the earlier text). Client-safe: no server imports here.
 *
 * Every write goes through ONE Postgres function (engine migration 413, `admin_set_control`, or
 * `admin_arm_real_money` for arming) that writes the change and its `control_changes` audit row
 * in one transaction. The page never updates a control table directly.
 */

/** Controls the page can send. `real_money_disarm` maps to real_money_armed = false. */
export type PageControl =
  | "placement_paused"
  | "publishing_paused"
  | "daemons_paused"
  | "real_money_disarm"
  | "placer_enabled"
  | "show_on_picks";

/** The DB vocabulary (control_changes.control). */
export type DbControl =
  | "placement_paused"
  | "publishing_paused"
  | "daemons_paused"
  | "real_money_armed"
  | "placer_enabled"
  | "show_on_picks"
  | "retire"
  | "unretire"
  | "maturity_label"
  | "display_name";

export interface FleetState {
  placement_paused: boolean | null;
  placement_paused_at: string | null;
  placement_paused_reason: string | null;
  real_money_armed: boolean | null;
  real_money_armed_at: string | null;
  real_money_armed_reason: string | null;
  publishing_paused: boolean | null;
  publishing_paused_at: string | null;
  publishing_paused_reason: string | null;
  daemons_paused: boolean | null;
  daemons_paused_at: string | null;
  daemons_paused_reason: string | null;
}

export interface PlacerRow {
  bot_name: string;
  ui_place_enabled: boolean;
  locked_reason: string | null;
  note: string | null;
  updated_at: string | null;
}

export interface BotControlRow {
  name: string;
  show_on_picks: boolean | null;
  maturity_label: string | null;
  is_active: boolean | null;
  retired_at: string | null;
  display_name: string | null;
}

export interface PlacerHeartbeat {
  placer: string;
  host: string | null;
  last_seen_at: string | null;
  execute_requested: boolean | null;
  execute_effective: boolean | null;
  refused_reason: string | null;
  result: {
    caps?: { max_bets_per_day?: number; max_stake_per_day?: number; kickoff_cutoff_min?: number };
    [k: string]: unknown;
  } | null;
}

export type ChangeSource = "web" | "telegram" | "engine" | "cli" | "migration";
export type ChangeOutcome = "applied" | "noop" | "refused" | "conflict";

export interface ControlChange {
  id: number;
  created_at: string;
  actor: string;
  source: ChangeSource;
  control: DbControl;
  bot_name: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  outcome: ChangeOutcome;
  refusal: string | null;
}

export interface CRead<T> {
  rows: T[];
  /** null = read OK. */
  error: string | null;
}

export interface Viewer {
  /** Superadmin whose user id is in OWNER_USER_IDS — may arm real money. */
  isOwner: boolean;
  /** Design preview (BOT_BOARD_FIXTURE): controls render but every write is refused. */
  readOnly: boolean;
  readOnlyReason: string | null;
}

export interface ControlState {
  fleet: { row: FleetState | null; error: string | null };
  placers: CRead<PlacerRow>;
  bots: CRead<BotControlRow>;
  heartbeats: CRead<PlacerHeartbeat>;
  changes: CRead<ControlChange>;
  viewer: Viewer;
}

export interface ControlRequest {
  control: PageControl;
  bot_name?: string | null;
  value: boolean;
  reason?: string | null;
  confirm_text?: string | null;
  /** The value the page believed was current; null = unknown (only allowed for stop directions). */
  expected: boolean | null;
  request_id: string;
}

export interface ArmRequest {
  reason: string;
  confirm_text: string;
  expected: boolean;
  request_id: string;
}

export interface ControlResult {
  outcome: ChangeOutcome;
  refusal: string | null;
  current: boolean | null;
  at: string | null;
  changed_by?: string | null;
  changed_at?: string | null;
  /** Telegram operator notice — a courtesy, never a gate. */
  notify?: "sent" | "failed" | "skipped";
  error?: string;
}

// ── copy and rules shared by the page and the route ─────────────────────────────────────────

export const MIN_REASON = 10;
export const MIN_ARM_REASON = 20;
export const MAX_REASON = 500;
export const PHRASE_RESUME = "RESUME PLACEMENT";
export const PHRASE_RESUME_STRATEGIC = "RESUME STRATEGIC";
export const PHRASE_PAUSE_PICKS = "PAUSE PICKS";
export const PHRASE_ARM = "ARM REAL MONEY";

/** A pause recorded as a strategic stop needs the stronger phrase to clear (I5, migration 343). */
export function isStrategicPause(reason: string | null | undefined): boolean {
  return !!reason && /(strategic|OWN-PATH-VERDICT)/i.test(reason);
}

/** Which direction of each control is the START (typed confirmation + reason, never optimistic). */
export function isStartDirection(control: PageControl, value: boolean, source: "web" = "web"): boolean {
  switch (control) {
    case "placement_paused":
      return value === false; // resume
    case "publishing_paused":
      return value === true && source === "web"; // silencing customers is the risky direction
    case "placer_enabled":
    case "show_on_picks":
      return value === true;
    case "daemons_paused":
    case "real_money_disarm":
      return false;
  }
}

/** Spec §2.4 — shown under each control and in the success toast. */
export const TAKES_EFFECT: Record<PageControl | "real_money_arm", string> = {
  placement_paused: "Next placement check — at run start and before every pick. A bet already being placed finishes.",
  real_money_disarm: "Next placement check — at run start and before every pick.",
  real_money_arm: "Next placement check. Nothing stakes while the Mac placers are parked.",
  publishing_paused: "Next :05/:35 send. Picks made while paused are never sent later (no burst).",
  daemons_paused: "Next collector tick. The sweep in progress finishes.",
  placer_enabled: "Next eligibility read — at run start and before every pick.",
  show_on_picks: "Immediately, on the next /picks render. Telegram is not affected.",
};

export const CONTROL_LABEL: Record<DbControl, string> = {
  placement_paused: "Placement pause",
  publishing_paused: "Picks channel pause",
  daemons_paused: "Coolbet sweeping (footprint pause)",
  real_money_armed: "Real money armed",
  placer_enabled: "Real-money eligible",
  show_on_picks: "Show on /picks",
  retire: "Retire",
  unretire: "Un-retire",
  maturity_label: "Maturity label",
  display_name: "Display name",
};

/** Every write route answers this in the dev fixture preview — the preview never writes. */
export const PREVIEW_REFUSAL = "Design preview (BOT_BOARD_FIXTURE): controls are read-only and nothing is written.";

/** A heartbeat older than this means the placer is not running now (launchd fires every 30 min). */
export const HEARTBEAT_STALE_MIN = 75;
