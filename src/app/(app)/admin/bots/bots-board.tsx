"use client";

// /admin/bots board — #139 UNIFIED-BOT-MODEL phase 1 (2026-09-24).
//
// One row per ACTIVE bot, whatever ledger it writes (simulated_bets, shadow_bets,
// picks_forward_test), grouped by family. Each family is judged on ONE admissible
// metric (design doc "Families and their admissible metric"); the verdict chip is
// read from that metric's t only. Deliberately absent (BOTS_AUDIT_2026_09_24 D4/E5):
// raw CLV as a headline, a Bankroll column, "€1,000 per bot", the May quality
// toggle / cohort rows, the Coolbet*/Kambi price column, and any min-odds column
// (min odds is family-specific and was meaningless for in-play).
//
// Units: CLV means and ROI arrive as FRACTIONS (0.025 = +2.5%), matching
// clv_margin_corrected / clv_pinnacle_devig in the source ledgers.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  BotBoardData,
  BotCapabilitiesRow,
  BotConfigRow,
  BotLedgerRow,
  BotScoreboardRow,
  RetiredInfo,
} from "@/lib/bot-board";

// ─── families ────────────────────────────────────────────────────────────────

type Metric = "clv_mc" | "clv_pinnacle" | "lift";

const FAMILY_ORDER = [
  "forward_test",
  "control",
  "model_sim",
  "model_shadow",
  "sharp_generator",
  "sharp_trigger",
  "inplay",
  "unknown",
] as const;

const FAMILY_INFO: Record<string, { title: string; blurb: string; metric: Metric }> = {
  forward_test: {
    title: "Forward test",
    blurb: "The pre-registered public test arms behind /picks — their rows are never rewritten or re-scored.",
    metric: "clv_mc",
  },
  control: {
    title: "Control",
    blurb: "A deliberately junk-anchored arm: the noise floor the forward test is read against.",
    metric: "clv_mc",
  },
  model_sim: {
    title: "Model (simulated ledger)",
    blurb: "Our prediction model's picks, written to simulated_bets and priced off the best accessible book.",
    metric: "clv_pinnacle",
  },
  model_shadow: {
    title: "Model (shadow ledger)",
    blurb: "Model-driven paper bots priced at the books we can actually bet, written to shadow_bets.",
    metric: "clv_mc",
  },
  sharp_generator: {
    title: "Sharp generators",
    blurb: "Pick wherever a book's price beats the de-vigged sharp (Pinnacle) line by the edge floor.",
    metric: "clv_mc",
  },
  sharp_trigger: {
    title: "Sharp triggers",
    blurb: "One trigger per book: fire when that book is above the sharp line by the floor.",
    metric: "clv_mc",
  },
  inplay: {
    title: "In-play",
    blurb: "Paper bots that pick during the match. No closing line exists, so they are judged on lift (hit rate minus de-vigged implied), never CLV.",
    metric: "lift",
  },
  unknown: {
    title: "Unknown family",
    blurb: "The config export could not resolve these bots — fix them in scripts/export_bot_config.py.",
    metric: "clv_mc",
  },
};

const METRIC_LABEL: Record<Metric, string> = {
  clv_mc: "mc-CLV (margin-corrected, own book close)",
  clv_pinnacle: "Pinnacle CLV (de-vigged close)",
  lift: "lift (hit rate − de-vigged implied)",
};
const METRIC_SHORT: Record<Metric, string> = { clv_mc: "mc-CLV", clv_pinnacle: "Pin-CLV", lift: "lift" };

const MIN_N = 30;

function familyOf(sb: BotScoreboardRow | undefined, cfg: BotConfigRow | undefined): string {
  const f = sb?.family ?? cfg?.family ?? "unknown";
  return FAMILY_INFO[f] ? f : "unknown";
}

function metricOf(family: string, cfg: BotConfigRow | undefined): Metric {
  const m = cfg?.admissible_metric;
  if (m === "clv_mc" || m === "clv_pinnacle" || m === "lift") return m;
  return FAMILY_INFO[family]?.metric ?? "clv_mc";
}

interface MetricValue {
  metric: Metric;
  n: number | null;
  mean: number | null;
  se: number | null;
  t: number | null;
  /** bot_scoreboard.clv_outlier_n — rows skipped from CLV stats (|clv| > 1). */
  outliers: number | null;
  version: string | null;
  earlier: number | null;
}

function metricValue(sb: BotScoreboardRow | undefined, metric: Metric): MetricValue {
  if (!sb || metric === "lift") return { metric, n: null, mean: null, se: null, t: null, outliers: null, version: null, earlier: null };
  if (metric === "clv_pinnacle") {
    const t = sb.clv_pin_t;
    const mean = sb.clv_pin_mean;
    return { metric, n: sb.clv_pin_n, mean, se: sb.clv_pin_se, t, outliers: sb.clv_outlier_n, version: sb.scored_rule_version, earlier: sb.earlier_version_picks };
  }
  return { metric, n: sb.clv_mc_n, mean: sb.clv_mc_mean, se: sb.clv_mc_se, t: sb.clv_mc_t, outliers: sb.clv_outlier_n, version: sb.scored_rule_version, earlier: sb.earlier_version_picks };
}

type Verdict = "negative" | "none" | "positive" | "n/a";

function verdictOf(v: MetricValue): Verdict {
  if (v.metric === "lift") return "n/a";
  if (v.t == null || v.n == null || v.n < MIN_N) return "none";
  if (v.t <= -2) return "negative";
  if (v.t >= 2) return "positive";
  return "none";
}

const VERDICT_CHIP: Record<Verdict, { text: string; cls: string; title: string }> = {
  negative: {
    text: "negative (t ≤ −2)",
    cls: "border-red-500/40 bg-red-500/10 text-red-400",
    title: "The admissible metric is at least two standard errors below zero.",
  },
  none: {
    text: "no evidence yet",
    cls: "border-border bg-muted/40 text-muted-foreground",
    title: `|t| < 2 or fewer than ${MIN_N} measured picks — the data cannot tell this bot from zero yet.`,
  },
  positive: {
    text: "positive (t ≥ 2)",
    cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    title: "The admissible metric is at least two standard errors above zero. Not a promotion by itself.",
  },
  "n/a": {
    text: "lift — not computed yet",
    cls: "border-border bg-muted/40 text-muted-foreground",
    title: "In-play bots are judged on lift, which the scoreboard does not compute yet.",
  },
};

// ─── formatting ──────────────────────────────────────────────────────────────

const pct = (v: number | null | undefined, dp = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(dp)}%`;

function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return "never";
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 0) return "upcoming";
  if (m < 1) return "just now";
  if (m < 90) return `${m} min ago`;
  if (m < 60 * 36) return `${(m / 60).toFixed(1)} h ago`;
  return `${(m / 1440).toFixed(1)} d ago`;
}

function dateUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

function fmtValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

// ─── model ───────────────────────────────────────────────────────────────────

interface BotView {
  name: string;
  displayName: string;
  family: string;
  sb?: BotScoreboardRow;
  cfg?: BotConfigRow;
  caps?: BotCapabilitiesRow;
  metric: MetricValue;
  verdict: Verdict;
}

function isActive(sb: BotScoreboardRow): boolean {
  if (sb.retired_at) return false;
  if (sb.is_active) return true;
  // Forward-test arms and the control have no `bots` row, so is_active is NULL.
  return sb.source === "forward_test" || sb.family === "forward_test" || sb.family === "control";
}

function buildView(
  name: string,
  sb: BotScoreboardRow | undefined,
  cfg: BotConfigRow | undefined,
  caps: BotCapabilitiesRow | undefined,
): BotView {
  const family = familyOf(sb, cfg);
  const metric = metricValue(sb, metricOf(family, cfg));
  return {
    name,
    displayName: sb?.display_name || name,
    family,
    sb,
    cfg,
    caps,
    metric,
    verdict: verdictOf(metric),
  };
}

// ─── component ───────────────────────────────────────────────────────────────

type LedgerState = { loading: true } | { loading: false; rows: BotLedgerRow[]; error: string | null };

export function BotsBoard({ data }: { data: BotBoardData }) {
  const { scoreboard, config, capabilities, retired, now } = data;
  const [tab, setTab] = useState<"active" | "retired">("active");
  const [selected, setSelected] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<Record<string, LedgerState>>({});

  const cfgBy = useMemo(() => new Map(config.rows.map((c) => [c.bot_name, c])), [config.rows]);
  const capsBy = useMemo(() => new Map(capabilities.rows.map((c) => [c.bot_name, c])), [capabilities.rows]);
  const sbBy = useMemo(() => new Map(scoreboard.rows.map((s) => [s.bot_name, s])), [scoreboard.rows]);

  const active = useMemo(
    () =>
      scoreboard.rows
        .filter(isActive)
        .map((sb) => buildView(sb.bot_name, sb, cfgBy.get(sb.bot_name), capsBy.get(sb.bot_name))),
    [scoreboard.rows, cfgBy, capsBy],
  );

  const retiredViews = useMemo(() => {
    const byName = new Map<string, { view: BotView; info?: RetiredInfo }>();
    for (const r of retired.rows) {
      byName.set(r.name, { view: buildView(r.name, sbBy.get(r.name), cfgBy.get(r.name), capsBy.get(r.name)), info: r });
    }
    for (const sb of scoreboard.rows) {
      if (sb.retired_at && !byName.has(sb.bot_name)) {
        byName.set(sb.bot_name, { view: buildView(sb.bot_name, sb, cfgBy.get(sb.bot_name), capsBy.get(sb.bot_name)) });
      }
    }
    const retiredAt = (x: { view: BotView; info?: RetiredInfo }) => x.info?.retired_at ?? x.view.sb?.retired_at ?? "";
    return [...byName.values()].sort((a, b) => retiredAt(b).localeCompare(retiredAt(a)));
  }, [retired.rows, scoreboard.rows, sbBy, cfgBy, capsBy]);

  const groups = useMemo(() => {
    const m = new Map<string, BotView[]>();
    for (const v of active) m.set(v.family, [...(m.get(v.family) ?? []), v]);
    return FAMILY_ORDER.filter((f) => m.has(f)).map((f) => ({
      family: f,
      bots: (m.get(f) ?? []).sort((a, b) => (b.sb?.last_pick_at ?? "").localeCompare(a.sb?.last_pick_at ?? "")),
    }));
  }, [active]);

  const selectedView = useMemo(() => {
    if (!selected) return null;
    return (
      active.find((v) => v.name === selected) ??
      retiredViews.find((r) => r.view.name === selected)?.view ??
      null
    );
  }, [selected, active, retiredViews]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function open(name: string) {
    setSelected(name);
    const cur = ledgers[name];
    if (cur && (cur.loading || !cur.error)) return; // cached (refetch only after an error)
    setLedgers((prev) => ({ ...prev, [name]: { loading: true } }));
    fetch(`/api/admin/bot-ledger?bot=${encodeURIComponent(name)}`)
      .then(async (r) => {
        const j = (await r.json()) as { rows?: BotLedgerRow[]; error?: string | null };
        setLedgers((prev) => ({
          ...prev,
          [name]: { loading: false, rows: j.rows ?? [], error: r.ok ? j.error ?? null : j.error ?? `HTTP ${r.status}` },
        }));
      })
      .catch((e: unknown) => {
        setLedgers((prev) => ({
          ...prev,
          [name]: { loading: false, rows: [], error: e instanceof Error ? e.message : String(e) },
        }));
      });
  }

  const viewsMissing = scoreboard.error !== null;
  const fleet = capabilities.rows[0];

  return (
    <div className="space-y-5">
      {viewsMissing && (
        <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/5 px-4 py-3 space-y-1.5">
          <div className="font-semibold text-amber-500">Unified bot views not deployed yet</div>
          <p className="text-sm text-muted-foreground">
            This page reads <code>bot_scoreboard</code>, <code>bot_config</code>, <code>bot_capabilities</code> and{" "}
            <code>bot_ledger</code> (engine migration 410 + <code>scripts/export_bot_config.py</code>, #139 phase 1).
            It fills in by itself once they exist — nothing to do on this side.
          </p>
          <ul className="text-xs text-muted-foreground list-disc pl-5">
            {[scoreboard.error, config.error, capabilities.error].filter(Boolean).map((e) => (
              <li key={e as string} className="break-words">{e}</li>
            ))}
          </ul>
        </div>
      )}
      {!viewsMissing && (config.error || capabilities.error) && (
        <div className="rounded-lg border border-amber-500/40 px-4 py-2 text-xs text-amber-500 space-y-0.5">
          {config.error && <div>Config unavailable ({config.error}) — Markets / Books / Floor columns are blank.</div>}
          {capabilities.error && <div>Capabilities unavailable ({capabilities.error}) — chips and fleet status are blank.</div>}
        </div>
      )}

      <FleetStatus fleet={fleet} caps={capabilities.rows} active={active} capsMissing={capabilities.error !== null} />

      <div className="flex gap-1 border-b border-border">
        {(["active", "retired"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 ${
              tab === t ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "active" ? `Active (${active.length})` : `Retired (${retiredViews.length})`}
          </button>
        ))}
      </div>

      {tab === "active" ? (
        groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {viewsMissing ? "No bots to show until the views are deployed." : "bot_scoreboard has no active bots."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Bot</th>
                  <th className="px-3 py-2 font-medium">Market(s)</th>
                  <th className="px-3 py-2 font-medium">Books</th>
                  <th className="px-3 py-2 font-medium">Floor</th>
                  <th className="px-3 py-2 font-medium">Capabilities</th>
                  <th className="px-3 py-2 font-medium">Last pick</th>
                  <th className="px-3 py-2 font-medium text-right">Settled</th>
                  <th className="px-3 py-2 font-medium text-right" title="Flat 1-unit stake on every pick: won → odds−1, lost → −1. Comparable across bots whatever their own staking.">
                    ROI (flat 1u)
                  </th>
                  <th className="px-3 py-2 font-medium" title="The family's admissible metric: mean ± 1.96·se, t, n">
                    Admissible metric
                  </th>
                  <th className="px-3 py-2 font-medium">Verdict</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.family}>
                  <tr className="bg-muted/20 border-t border-border">
                    <td colSpan={10} className="px-3 py-2">
                      <span className="font-semibold">{FAMILY_INFO[g.family].title}</span>
                      <span className="text-xs text-muted-foreground">
                        {" "}— {FAMILY_INFO[g.family].blurb} Judged on{" "}
                        <span className="text-foreground">{METRIC_LABEL[FAMILY_INFO[g.family].metric]}</span>.
                      </span>
                    </td>
                  </tr>
                  {g.bots.map((v) => (
                    <BotRow key={v.name} v={v} now={now} onOpen={open} selected={selected === v.name} />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )
      ) : (
        <RetiredTable rows={retiredViews} onOpen={open} error={retired.error} />
      )}

      {selectedView && (
        <BotDrawer v={selectedView} now={now} ledger={ledgers[selectedView.name]} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── pieces ──────────────────────────────────────────────────────────────────

function FleetStatus({
  fleet,
  caps,
  active,
  capsMissing,
}: {
  fleet: BotCapabilitiesRow | undefined;
  caps: BotCapabilitiesRow[];
  active: BotView[];
  capsMissing: boolean;
}) {
  // No row or a failed read means we do NOT know the fleet state — never render "off".
  const known = !capsMissing && !!fleet;
  const paused = known ? fleet.fleet_placement_paused : null;
  const armed = known ? fleet.fleet_real_money_armed : null;
  const count = (k: keyof BotCapabilitiesRow) => caps.filter((c) => c[k] === true).length;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
      <span>
        Placement:{" "}
        <span className={paused ? "text-sky-500 font-medium" : "text-amber-500 font-medium"}>
          {paused == null ? "unknown" : paused ? "paused" : "running"}
        </span>
      </span>
      <span>
        Real money:{" "}
        <span className={armed ? "text-red-500 font-semibold" : "text-muted-foreground font-medium"}>
          {armed == null ? "unknown" : armed ? "ARMED" : "off"}
        </span>
      </span>
      {known ? (
        <span className="text-muted-foreground">
          <span className="text-foreground">{active.length}</span> active ·{" "}
          <span className="text-foreground">{count("collect")}</span> collecting ·{" "}
          <span className="text-foreground">{count("publish")}</span> published ·{" "}
          <span className="text-foreground">{count("place_enabled")}</span> real-money enabled
        </span>
      ) : (
        <span className="text-muted-foreground">
          <span className="text-foreground">{active.length}</span> active · capabilities unknown (bot_capabilities not readable)
        </span>
      )}
    </div>
  );
}

const CHIP = "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap";

function CapChips({ caps }: { caps: BotCapabilitiesRow | undefined }) {
  if (!caps) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {caps.collect && <span className={`${CHIP} border-border text-muted-foreground`}>Collecting</span>}
      {caps.publish && <span className={`${CHIP} border-sky-500/40 text-sky-500`}>Published</span>}
      {caps.telegram && <span className={`${CHIP} border-sky-500/40 text-sky-500`}>Telegram</span>}
      {caps.place_capable && <span className={`${CHIP} border-amber-500/40 text-amber-500`}>Real-money capable</span>}
      {caps.place_enabled && <span className={`${CHIP} border-red-500/50 bg-red-500/10 text-red-500 font-medium`}>Real-money ON</span>}
      {!caps.collect && !caps.publish && !caps.telegram && !caps.place_capable && !caps.place_enabled && (
        <span className="text-xs text-muted-foreground">none</span>
      )}
    </div>
  );
}

function MetricCell({ m }: { m: MetricValue }) {
  if (m.metric === "lift") return <span className="text-xs text-muted-foreground">lift — not computed yet</span>;
  if (m.mean == null) return <span className="text-xs text-muted-foreground">{METRIC_SHORT[m.metric]} — no data</span>;
  const ci = m.se != null ? ` ± ${(1.96 * m.se * 100).toFixed(1)}%` : "";
  return (
    <div className="tabular-nums whitespace-nowrap" title={METRIC_LABEL[m.metric]}>
      <span className="text-xs text-muted-foreground">{METRIC_SHORT[m.metric]} </span>
      {pct(m.mean)}
      <span className="text-muted-foreground">{ci}</span>
      <div className="text-[11px] text-muted-foreground">
        t {m.t == null ? "—" : m.t.toFixed(2)} · n {m.n ?? 0}
        {(m.outliers ?? 0) > 0 && (
          <span title="Picks left out of the CLV statistics because |CLV| > 1 (bad price or bad close)."> · {m.outliers} outlier{m.outliers === 1 ? "" : "s"} excluded</span>
        )}
      </div>
      {m.version && (
        <div className="text-[11px] text-muted-foreground" title="Pre-registered: scored on the current rule version only; earlier versions are separate populations and are not pooled.">
          {m.version}
          {(m.earlier ?? 0) > 0 && <> · {m.earlier} earlier-version pick{m.earlier === 1 ? "" : "s"} not pooled</>}
        </div>
      )}
    </div>
  );
}

function VerdictChip({ v }: { v: Verdict }) {
  const c = VERDICT_CHIP[v];
  return (
    <span className={`${CHIP} ${c.cls}`} title={c.title}>
      {c.text}
    </span>
  );
}

function BotRow({
  v,
  now,
  onOpen,
  selected,
}: {
  v: BotView;
  now: number;
  onOpen: (name: string) => void;
  selected: boolean;
}) {
  const cfg = v.cfg;
  return (
    <tr
      onClick={() => onOpen(v.name)}
      className={`border-t border-border cursor-pointer hover:bg-accent/40 ${selected ? "bg-accent/40" : ""}`}
    >
      <td className="px-3 py-2">
        <div className="font-medium">{v.displayName}</div>
        {v.displayName !== v.name && <div className="text-[11px] text-muted-foreground font-mono">{v.name}</div>}
      </td>
      <td className="px-3 py-2 text-xs">{cfg?.markets?.length ? cfg.markets.join(", ") : "—"}</td>
      <td className="px-3 py-2 text-xs max-w-[12rem]" title={cfg?.books_source ?? undefined}>
        {cfg?.books?.length ? cfg.books.join(", ") : "—"}
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap" title={cfg?.edge_floor_source ? `Source: ${cfg.edge_floor_source}` : undefined}>
        {cfg?.edge_floor ?? "—"}
        {cfg?.edge_floor_source && <span className="text-muted-foreground"> ⓘ</span>}
      </td>
      <td className="px-3 py-2"><CapChips caps={v.caps} /></td>
      <td className="px-3 py-2 text-xs whitespace-nowrap" title={dateUtc(v.sb?.last_pick_at)}>
        {ago(v.sb?.last_pick_at, now)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {v.sb?.settled ?? 0}
        {(v.sb?.pending ?? 0) > 0 && <div className="text-[11px] text-muted-foreground">+{v.sb?.pending} pending</div>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{(v.sb?.settled ?? 0) > 0 ? pct(v.sb?.roi_unit) : "—"}</td>
      <td className="px-3 py-2"><MetricCell m={v.metric} /></td>
      <td className="px-3 py-2"><VerdictChip v={v.verdict} /></td>
    </tr>
  );
}

function RetiredTable({
  rows,
  onOpen,
  error,
}: {
  rows: { view: BotView; info?: RetiredInfo }[];
  onOpen: (name: string) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-amber-500">Retirement reasons unavailable ({error}).</p>}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No retired bots found.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Bot</th>
                <th className="px-3 py-2 font-medium">Retired</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium text-right">Settled</th>
                <th className="px-3 py-2 font-medium text-right">ROI (flat 1u)</th>
                <th className="px-3 py-2 font-medium">Final admissible metric</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ view: v, info }) => {
                const retiredAt = info?.retired_at ?? v.sb?.retired_at ?? null;
                return (
                  <tr key={v.name} onClick={() => onOpen(v.name)} className="border-t border-border cursor-pointer hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <div className="font-medium">{v.displayName}</div>
                      {v.displayName !== v.name && <div className="text-[11px] text-muted-foreground font-mono">{v.name}</div>}
                      {v.caps?.writing_7d && (
                        <span
                          className={`${CHIP} mt-1 border-border text-muted-foreground`}
                          title="Retired bots keep collecting picks on purpose (owner decision), so their record stays measurable. Wrote at least one pick in the last 7 days."
                        >
                          retired, still collecting
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{retiredAt ? retiredAt.slice(0, 10) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-md">
                      <span className="line-clamp-2" title={info?.retired_reason ?? undefined}>{info?.retired_reason ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.sb?.settled ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(v.sb?.settled ?? 0) > 0 ? pct(v.sb?.roi_unit) : "—"}</td>
                    <td className="px-3 py-2">{v.sb ? <MetricCell m={v.metric} /> : <span className="text-xs text-muted-foreground">no ledger rows</span>}</td>
                    <td className="px-3 py-2">{v.sb ? <VerdictChip v={v.verdict} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const KNOWN_RESULTS = new Set(["won", "lost", "void", "pending", "push"]);

/** Known results as coloured text; anything else (e.g. an unexpected forward-test
 *  outcome the ledger passes through unfolded) is shown as-is in a neutral chip. */
function ResultCell({ result }: { result: string | null }) {
  if (result == null) return <span className="text-muted-foreground">—</span>;
  if (!KNOWN_RESULTS.has(result)) {
    return (
      <span className={`${CHIP} border-border bg-muted/40 text-foreground`} title="Result value outside won/lost/void/pending/push">
        {result}
      </span>
    );
  }
  const cls = result === "won" ? "text-emerald-500" : result === "lost" ? "text-red-500" : "text-muted-foreground";
  return <span className={cls}>{result}</span>;
}

function KV({ k, v, src }: { k: string; v: ReactNode; src?: string | null }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 text-xs py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="break-words">
        {v}
        {src && <span className="text-muted-foreground"> · source: {src}</span>}
      </span>
    </div>
  );
}

function BotDrawer({
  v,
  now,
  ledger,
  onClose,
}: {
  v: BotView;
  now: number;
  ledger: LedgerState | undefined;
  onClose: () => void;
}) {
  const cfg = v.cfg;
  const sb = v.sb;
  const caps = v.caps;
  const yn = (b: boolean | null | undefined) => (b == null ? "—" : b ? "yes" : "no");
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${v.name} details`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative h-full w-full max-w-3xl overflow-y-auto border-l border-border bg-background px-5 py-4 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{v.displayName}</div>
            <div className="text-xs text-muted-foreground font-mono">{v.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {FAMILY_INFO[v.family].title} · judged on {METRIC_LABEL[v.metric.metric]}
            </div>
          </div>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:underline">Close ✕</button>
        </div>

        <section className="space-y-1">
          <h3 className="text-sm font-semibold">Record</h3>
          {sb ? (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>
                <span className="text-foreground">{sb.picks_total ?? 0}</span> picks ·{" "}
                <span className="text-foreground">{sb.settled ?? 0}</span> settled ({sb.won ?? 0} won / {sb.lost ?? 0} lost) ·{" "}
                {sb.void ?? 0} void · {sb.pending ?? 0} pending
              </div>
              <div>
                Last 7 days: {sb.picks_7d ?? 0} picks, {sb.settled_7d ?? 0} settled · first pick {dateUtc(sb.first_pick_at)} ·
                last pick {ago(sb.last_pick_at, now)}
              </div>
              <div>
                ROI (flat 1u): <span className="text-foreground">{(sb.settled ?? 0) > 0 ? pct(sb.roi_unit) : "—"}</span> ·{" "}
                {METRIC_SHORT[v.metric.metric]}: <span className="text-foreground">{v.metric.metric === "lift" ? "not computed yet" : pct(v.metric.mean)}</span>
                {v.metric.se != null && ` ± ${(1.96 * v.metric.se * 100).toFixed(1)}%`}
                {v.metric.t != null && `, t ${v.metric.t.toFixed(2)}`}
                {v.metric.n != null && `, n ${v.metric.n}`} · <VerdictChip v={v.verdict} />
              </div>
              <div>Ledger source: {sb.source ?? "—"} · maturity label: {sb.maturity_label ?? "—"}</div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No bot_scoreboard row.</p>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-sm font-semibold">Capabilities</h3>
          {caps ? (
            <div>
              <KV k="Collect" v={yn(caps.collect)} />
              <KV k="Publish" v={yn(caps.publish)} />
              <KV k="Telegram" v={yn(caps.telegram)} />
              <KV k="Real-money capable" v={yn(caps.place_capable)} />
              <KV k="Real-money enabled" v={yn(caps.place_enabled)} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No bot_capabilities row.</p>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-sm font-semibold">Configuration</h3>
          {cfg ? (
            <div>
              {cfg.description && <p className="text-xs mb-1.5">{cfg.description}</p>}
              <KV k="Family" v={cfg.family ?? "—"} />
              <KV k="Ledger" v={cfg.ledger ?? "—"} />
              <KV k="Writer job" v={cfg.writer_job ?? "—"} />
              <KV k="Cadence" v={cfg.cadence ?? "—"} />
              <KV k="Markets" v={cfg.markets?.join(", ") || "—"} />
              <KV k="Probability" v={cfg.prob_source ?? "—"} />
              <KV k="Anchor" v={cfg.anchor ?? "—"} />
              <KV k="Edge floor" v={cfg.edge_floor ?? "—"} src={cfg.edge_floor_source} />
              <KV k="Odds range" v={cfg.odds_min == null && cfg.odds_max == null ? "—" : `${cfg.odds_min ?? "any"} – ${cfg.odds_max ?? "any"}`} />
              <KV k="Books" v={cfg.books?.join(", ") || "—"} src={cfg.books_source} />
              <KV k="Placeable" v={yn(cfg.placeable)} />
              <KV k="Published" v={yn(cfg.published)} />
              <KV k="Telegram" v={yn(cfg.telegram)} />
              <KV k="Admissible metric" v={cfg.admissible_metric ?? "—"} />
              <KV k="Exported" v={cfg.exported_at ? `${dateUtc(cfg.exported_at)} UTC` : "—"} />
              {cfg.gates && cfg.gates.length > 0 && (
                <div className="mt-2 overflow-x-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr className="text-left">
                        <th className="px-2 py-1 font-medium">Gate</th>
                        <th className="px-2 py-1 font-medium">Value</th>
                        <th className="px-2 py-1 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cfg.gates.map((g, i) => (
                        <tr key={`${g.name}-${i}`} className="border-t border-border">
                          <td className="px-2 py-1 font-mono">{g.name}</td>
                          <td className="px-2 py-1 break-all">{fmtValue(g.value)}</td>
                          <td className="px-2 py-1 text-muted-foreground break-all">{g.source ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No bot_config row — the export has not described this bot.</p>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-sm font-semibold">30 most recent picks</h3>
          {!ledger || ledger.loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : ledger.error ? (
            <p className="text-xs text-amber-500 break-words">Could not read bot_ledger: {ledger.error}</p>
          ) : ledger.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No picks in bot_ledger.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Kickoff (UTC)</th>
                    <th className="px-2 py-1 font-medium">Match</th>
                    <th className="px-2 py-1 font-medium">Market / selection</th>
                    <th className="px-2 py-1 font-medium text-right">Odds</th>
                    <th className="px-2 py-1 font-medium">Book</th>
                    <th className="px-2 py-1 font-medium">Result</th>
                    <th className="px-2 py-1 font-medium text-right">mc-CLV</th>
                    <th className="px-2 py-1 font-medium text-right">Pin-CLV</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r) => (
                    <tr key={`${r.source}-${r.pick_id}`} className="border-t border-border">
                      <td className="px-2 py-1 whitespace-nowrap">{dateUtc(r.kickoff)}</td>
                      <td className="px-2 py-1 font-mono text-muted-foreground" title={r.match_id ?? undefined}>
                        {r.match_id ? r.match_id.slice(0, 8) : "—"}
                      </td>
                      <td className="px-2 py-1">
                        {r.market ?? "—"} / {r.selection ?? "—"}
                        {r.is_inplay && <span className="text-muted-foreground"> · in-play</span>}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.odds != null ? Number(r.odds).toFixed(2) : "—"}</td>
                      <td className="px-2 py-1">{r.bookmaker ?? "—"}</td>
                      <td className="px-2 py-1"><ResultCell result={r.result} /></td>
                      <td className="px-2 py-1 text-right tabular-nums">{pct(r.clv_mc)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{pct(r.clv_pinnacle)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
