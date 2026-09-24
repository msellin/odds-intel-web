"use client";

// /admin/activity — control_changes ∪ feed_actions as one searchable, faceted table of plain
// sentences ("sellinmargus paused the picks channel — “reason”"). Wording helpers: actorWord comes
// from the /admin/bots Activity timeline so both views name people the same way; the sentence
// verbs below are new (the timeline shows "old → new" values instead).
//
// #139 UX fix round (2026-09-24): "Database change 413" meant nothing to the owner — the rows the
// change-log migration wrote when it was created now read "Set up when the change log started
// (24 Sep): …"; a later migration row reads "A database update (date)". The owner's e-mail / user
// id (resolved server-side from OWNER_USER_IDS) reads "Owner"; other e-mails keep the part before
// the @. Below sm the table is one column of stacked cards (when · from · result inside each row)
// instead of a 652 px-wide table. Times use the shared src/lib/rel-time.ts.

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Clock, History, ToggleRight } from "lucide-react";
import { DataTable } from "@/components/oi/data-table";
import { Panel, PanelHeader } from "@/components/oi/panel";
import { StatCard } from "@/components/oi/stat-card";
import { StatusBadge, type Tone } from "@/components/oi/status-badge";
import { CONTROL_LABEL, type ControlChange } from "@/lib/bot-controls/types";
import type { ActivityData, FeedAction } from "@/lib/admin-activity";
import { actorWord } from "../bots/activity-timeline";
import { utcStamp } from "../bots/bot-board-format";
import { timeAgo } from "@/lib/rel-time";

type Kind = "control" | "feed";
type Outcome = "applied" | "noop" | "refused" | "conflict" | "pending";

interface Row {
  id: string;
  at: string;
  kind: Kind;
  source: string;
  actor: string;
  outcome: Outcome;
  sentence: string;
  reason: string | null;
  note: string | null;
}

const KIND_WORD: Record<Kind, string> = { control: "Switch", feed: "Feed" };
const SOURCE_WORD: Record<string, string> = { web: "Web admin", telegram: "Telegram", engine: "Engine", cli: "Command line", migration: "Database update", other: "Other" };
const OUTCOME: Record<Outcome, { word: string; tone: Tone }> = {
  applied: { word: "Done", tone: "success" },
  noop: { word: "No change", tone: "neutral" },
  refused: { word: "Refused", tone: "danger" },
  conflict: { word: "Conflict", tone: "warning" },
  pending: { word: "Waiting for engine", tone: "info" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/**
 * Who, in words, starting with a capital. The owner (OWNER_USER_IDS, resolved server-side) is
 * "Owner"; other e-mail addresses are shortened to the part before the @; a migration is "A
 * database update (date)" — never "Database change 413".
 */
function who(actor: string | null, at: string, owners: Set<string>): string {
  if (!actor) return "Someone";
  if (owners.has(actor)) return "Owner";
  if (actor === "auto") return "The engine (automatic)";
  if (/^migration:\d+$/.test(actor)) return `A database update (${day(at)})`;
  const w = actorWord(actor);
  const s = w.includes("@") ? w.split("@")[0] : w;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const on = (v: unknown) => v === true || v === "true";

function stateText(c: ControlChange, bot: string): string {
  const v = c.new_value;
  switch (c.control) {
    case "placement_paused":
      return on(v) ? "placement paused" : "placement running";
    case "publishing_paused":
      return on(v) ? "picks channel paused" : "picks channel sending";
    case "daemons_paused":
      return on(v) ? "Coolbet sweeping paused" : "Coolbet sweeping on";
    case "real_money_armed":
      return on(v) ? "real money ARMED" : "real money not armed";
    case "placer_enabled":
      return `real money ${on(v) ? "on" : "off"} for ${bot}`;
    case "show_on_picks":
      return `${bot} ${on(v) ? "shown on" : "hidden from"} /picks`;
    default:
      return `${CONTROL_LABEL[c.control] ?? c.control}${bot ? ` for ${bot}` : ""}: ${v == null ? "—" : String(v)}`;
  }
}

function verb(c: ControlChange, bot: string): string {
  const v = c.new_value;
  switch (c.control) {
    case "placement_paused":
      return on(v) ? "paused placement" : "resumed placement";
    case "publishing_paused":
      return on(v) ? "paused the picks channel" : "resumed the picks channel";
    case "daemons_paused":
      return on(v) ? "paused Coolbet sweeping" : "resumed Coolbet sweeping";
    case "real_money_armed":
      return on(v) ? "armed real money" : "disarmed real money";
    case "placer_enabled":
      return `switched real money ${on(v) ? "on" : "off"} for ${bot}`;
    case "show_on_picks":
      return on(v) ? `put ${bot} on /picks` : `took ${bot} off /picks`;
    case "retire":
      return `retired ${bot}`;
    case "unretire":
      return `brought ${bot} back from retirement`;
    case "maturity_label":
      return `set ${bot}'s maturity label to “${String(v ?? "—")}”`;
    case "display_name":
      return `renamed ${bot} to “${String(v ?? "—")}”`;
    default:
      return `changed ${CONTROL_LABEL[c.control] ?? c.control}${bot ? ` for ${bot}` : ""} to ${String(v ?? "—")}`;
  }
}

function controlRow(c: ControlChange, botNames: Record<string, string>, owners: Set<string>): Row {
  const bot = c.bot_name ? botNames[c.bot_name] ?? c.bot_name : "";
  const w = who(c.actor, c.created_at, owners);
  const initial = c.source === "migration" && (c.old_value === null || c.old_value === undefined);
  let sentence: string;
  if (initial) sentence = `Set up when the change log started (${day(c.created_at)}): ${stateText(c, bot)}`;
  else if (c.outcome === "refused") sentence = `${w} asked for ${stateText(c, bot)} — refused`;
  else if (c.outcome === "conflict") sentence = `${w} asked for ${stateText(c, bot)} — not applied, someone changed it first`;
  else if (c.outcome === "noop") sentence = `${w} ${verb(c, bot)} (no change — it already was)`;
  else sentence = `${w} ${verb(c, bot)}`;
  return {
    id: `c-${c.id}`,
    at: c.created_at,
    kind: "control",
    source: c.source,
    actor: c.actor,
    outcome: c.outcome,
    sentence,
    reason: c.reason,
    note: c.refusal,
  };
}

function feedSource(actor: string | null): string {
  if (!actor) return "other";
  if (actor === "auto" || actor.startsWith("engine")) return "engine";
  if (actor.startsWith("telegram")) return "telegram";
  // the web route writes the signed-in user's e-mail (or user id) as the actor
  if (actor.includes("@") || /^[0-9a-f-]{36}$/i.test(actor)) return "web";
  return "other";
}

function feedRow(a: FeedAction, feedLabels: Record<string, string>, owners: Set<string>): Row {
  const feed = feedLabels[a.feed_id] ?? a.feed_id;
  const w = who(a.actor, a.created_at, owners);
  const what =
    a.action === "pause"
      ? `paused ${feed}`
      : a.action === "resume"
        ? `resumed ${feed}`
        : a.action === "run_now"
          ? `asked for a run of ${feed} now`
          : a.action === "auto_resume"
            ? `resumed ${feed} after its back-off`
            : a.action === "auto_pause"
              ? `paused ${feed} on its own`
              : `${a.action.replace(/_/g, " ")} ${feed}`;
  const outcome: Outcome = !a.handled_at ? "pending" : /refus|skip|fail|error|not /i.test(a.result ?? "") ? "refused" : "applied";
  return {
    id: `f-${a.id}`,
    at: a.created_at,
    kind: "feed",
    source: feedSource(a.actor),
    actor: a.actor ?? "",
    outcome,
    sentence: `${w} ${what}`,
    reason: a.reason,
    note: a.result ? `Engine: ${a.result}` : null,
  };
}

export function ActivityTable({ d }: { d: ActivityData }) {
  const rows = useMemo(() => {
    const owners = new Set(d.ownerActors);
    return [...d.changes.v.map((c) => controlRow(c, d.botNames, owners)), ...d.feedActions.v.map((a) => feedRow(a, d.feedLabels, owners))].sort((a, b) =>
      a.at < b.at ? 1 : a.at > b.at ? -1 : 0,
    );
  }, [d]);
  const now = d.now;
  const week = rows.filter((r) => now - new Date(r.at).getTime() < 7 * 86_400_000);
  const people = week.filter((r) => r.source === "web" || r.source === "telegram");
  const refused = week.filter((r) => r.outcome === "refused" || r.outcome === "conflict");
  const errors = [d.changes.error, d.feedActions.error].filter(Boolean) as string[];

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "at",
      header: "When",
      meta: { label: "When (UTC)", csv: (r) => r.at, className: "hidden w-28 sm:table-cell" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap" title={utcStamp(row.original.at)}>
          <span className="block text-sm tabular-nums">{timeAgo(row.original.at, now)}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{row.original.at.slice(5, 16).replace("T", " ")}</span>
        </span>
      ),
    },
    {
      accessorKey: "sentence",
      header: "What happened",
      enableSorting: false,
      meta: { label: "What happened", className: "sm:min-w-[18rem]" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className={r.outcome === "refused" || r.outcome === "noop" ? "opacity-80" : ""}>
            {/* phone: the other columns are hidden, so each row is a stacked card with them inline */}
            <span className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:hidden">
              <span className="tabular-nums" title={utcStamp(r.at)}>
                {timeAgo(r.at, now)} · {r.at.slice(5, 16).replace("T", " ")} UTC
              </span>
              <span>· {SOURCE_WORD[r.source] ?? r.source}</span>
              <StatusBadge tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].word}</StatusBadge>
            </span>
            <span className="block text-sm" title={r.actor}>
              {r.sentence}
            </span>
            {r.reason && (
              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground" title={r.reason}>
                Reason: “{r.reason}”
              </span>
            )}
            {r.note && (
              <span className={`mt-0.5 line-clamp-2 block text-xs ${r.outcome === "refused" ? "text-danger" : "text-muted-foreground"}`} title={r.note}>
                {r.note}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "source",
      header: "From",
      meta: { label: "From", csv: (r) => SOURCE_WORD[r.source] ?? r.source, className: "hidden sm:table-cell" },
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{SOURCE_WORD[row.original.source] ?? row.original.source}</span>,
    },
    {
      accessorKey: "kind",
      header: "Kind",
      meta: { label: "Kind", csv: (r) => KIND_WORD[r.kind], className: "hidden sm:table-cell" },
      cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{KIND_WORD[row.original.kind]}</span>,
    },
    {
      accessorKey: "outcome",
      header: "Result",
      meta: { label: "Result", csv: (r) => OUTCOME[r.outcome].word, className: "hidden sm:table-cell" },
      cell: ({ row }) => <StatusBadge tone={OUTCOME[row.original.outcome].tone}>{OUTCOME[row.original.outcome].word}</StatusBadge>,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Changes · 7 days" icon={History} tone="info" value={week.length} unknown={errors.length === 2} foot={`${rows.length} in the log in total`} />
        <StatCard label="By a person · 7 d" icon={ToggleRight} tone="model" value={people.length} unknown={!!d.changes.error} foot="from the web admin or Telegram" />
        <StatCard
          label="Refused · 7 d"
          icon={Ban}
          tone={refused.length ? "warning" : "success"}
          value={refused.length}
          unknown={errors.length === 2}
          foot={refused.length ? "a switch said no — see the reason" : "nothing was refused"}
        />
        <StatCard
          label="Last change"
          icon={Clock}
          tone="neutral"
          value={rows[0] ? timeAgo(rows[0].at, now) : "none"}
          unknown={errors.length === 2}
          foot={rows[0] ? rows[0].sentence : "nothing recorded yet"}
        />
      </div>

      {errors.length > 0 && (
        <Panel className="border-warning/40">
          <PanelHeader
            title={<span className="text-warning">Part of the log could not be read — this list may be missing entries</span>}
            description={errors.join(" · ")}
          />
          <div className="pb-4" />
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Timeline"
          description="Switches are the fleet and per-bot controls (placement, real money, picks channel, Coolbet sweeping, /picks). Feeds are the per-feed pause / resume / run-now on the Feeds page, including the engine's own automatic back-off."
        />
        <div className="p-4 pt-3">
          <DataTable
            data={rows}
            columns={columns}
            searchPlaceholder="Search who, what, reason…"
            facets={[
              { column: "source", label: "From", format: (v) => SOURCE_WORD[v] ?? v },
              { column: "kind", label: "Kind", format: (v) => KIND_WORD[v as Kind] ?? v },
              { column: "outcome", label: "Result", format: (v) => OUTCOME[v as Outcome]?.word ?? v },
            ]}
            exportName="admin-activity"
            emptyText="No changes recorded yet."
            pageSize={50}
          />
        </div>
      </Panel>
    </>
  );
}
