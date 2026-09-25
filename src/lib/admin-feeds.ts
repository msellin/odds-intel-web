/**
 * /admin/feeds loader (#139 admin redesign, 2026-09-24). "Is data coming in, and at what cost?"
 *
 * Reads (service role, server only): feed_status + feed_book_stats (engine
 * workers/jobs/feed_health.py, every 5 min), data_quality_findings (7 days), today's ops_snapshots
 * row and the newest live_match_snapshots time. The last two moved here from /admin/ops (IA §2.1:
 * odds-pipeline coverage, the live tracker and the API-Football daily budget are feed-health facts).
 *
 * Unlike the engine-data.ts helpers, every read keeps its error: an unreadable source must render
 * as "unreadable", never as an empty board or a zero (owner's honesty rule).
 */
import { createServerServiceClient } from "@/lib/supabase-server";
import { readAdminFixture } from "@/lib/admin-fixture";
import type { DataQualityFinding, FeedBookStats, FeedStatus, OpsSnapshot } from "@/lib/engine-data";
import { DQ_WINDOW_D, type FootprintHour } from "@/lib/admin-feeds-model";
export type { FootprintHour } from "@/lib/admin-feeds-model";

export interface R<T> {
  v: T;
  /** null = read OK. */
  error: string | null;
}

export interface FeedsPageData {
  now: number;
  feeds: R<FeedStatus[]>;
  books: R<FeedBookStats[]>;
  dq: R<DataQualityFinding[]>;
  snapshot: R<OpsSnapshot | null>;
  lastLiveAt: R<string | null>;
  /** book_footprint, last 25 clock hours (workers/utils/footprint.py) — which hour's budget ran out. */
  footprint: R<FootprintHour[]>;
}


/** API-Football Mega plan: 150,000 calls per day, reset at midnight UTC. */
export const AF_DAILY_BUDGET = 150_000;

interface FeedsFixture {
  feeds?: FeedStatus[];
  books?: FeedBookStats[];
  dq?: DataQualityFinding[];
  snapshot?: OpsSnapshot | null;
  last_live_at?: string | null;
  footprint?: FootprintHour[];
}

async function read<T>(label: string, q: () => PromiseLike<{ data: unknown; error: { message: string } | null }>, fallback: T): Promise<R<T>> {
  try {
    const { data, error } = await q();
    if (error) return { v: fallback, error: `${label}: ${error.message}` };
    return { v: (data ?? fallback) as T, error: null };
  } catch (e) {
    return { v: fallback, error: `${label}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const ok = <T,>(v: T): R<T> => ({ v, error: null });

/** Row cap for the findings read. Was 100 — a busy week re-finds problems every 30 min, so 100 raw rows could miss today's. */
export const DQ_READ_LIMIT = 5000;

/**
 * THE data-quality read (round 6, 2026-09-25) — /admin/feeds and the Overview both call this, then
 * dqProblems → dqAdvice, so "N odds problems in the last 24 h" is one number on both. The last
 * DQ_WINDOW_D days: the table covers them, the 24 h count is taken from their last sightings.
 */
export async function loadDqFindings(db: ReturnType<typeof createServerServiceClient>, now: number): Promise<R<DataQualityFinding[]>> {
  const since = new Date(now - DQ_WINDOW_D * 86_400_000).toISOString();
  // ~80 rows a week in Sept 2026, so the cap is far off
  return read<DataQualityFinding[]>(
    "data_quality_findings",
    () => db.from("data_quality_findings").select("*").gte("found_at", since).order("found_at", { ascending: false }).order("id", { ascending: false }).limit(DQ_READ_LIMIT),
    [],
  );
}

export async function loadFeedsPage(): Promise<FeedsPageData> {
  const now = Date.now();
  const fx = await readAdminFixture<FeedsFixture>("feeds");
  if (fx) {
    const miss = <T,>(v: T | undefined, fallback: T, label: string): R<T> => (v === undefined ? { v: fallback, error: `${label}: not in fixture` } : ok(v));
    return {
      now,
      feeds: miss(fx.feeds, [], "feed_status"),
      books: miss(fx.books, [], "feed_book_stats"),
      dq: miss(fx.dq, [], "data_quality_findings"),
      snapshot: miss(fx.snapshot, null, "ops_snapshots"),
      lastLiveAt: miss(fx.last_live_at, null, "live_match_snapshots"),
      footprint: miss(fx.footprint, [], "book_footprint"),
    };
  }
  const db = createServerServiceClient();
  const today = new Date(now).toISOString().slice(0, 10);
  const since25h = new Date(now - 25 * 3_600_000).toISOString();
  const [feeds, books, dq, snap, live, footprint] = await Promise.all([
    read<FeedStatus[]>("feed_status", () => db.from("feed_status").select("*"), []),
    read<FeedBookStats[]>("feed_book_stats", () => db.from("feed_book_stats").select("*"), []),
    loadDqFindings(db, now),
    read<OpsSnapshot[]>(
      "ops_snapshots",
      () => db.from("ops_snapshots").select("*").eq("snapshot_date", today).order("created_at", { ascending: false }).limit(1),
      [],
    ),
    read<{ captured_at: string }[]>(
      "live_match_snapshots",
      () => db.from("live_match_snapshots").select("captured_at").order("captured_at", { ascending: false }).limit(1),
      [],
    ),
    read<FootprintHour[]>(
      "book_footprint",
      () => db.from("book_footprint").select("book, hour, requests, refused, challenges, errors").gte("hour", since25h).order("hour", { ascending: true }),
      [],
    ),
  ]);
  return {
    now,
    feeds,
    books,
    dq,
    snapshot: { v: snap.v[0] ?? null, error: snap.error },
    lastLiveAt: { v: live.v[0]?.captured_at ?? null, error: live.error },
    footprint,
  };
}

// Pure, client-safe helpers live in admin-feeds-model.ts (a client component cannot import this
// server module); re-exported so callers can import either.
export {
  budgetView, budgetSentence, BUDGET_REASON_RE, STATUS_STALE_MIN, DQ_GROUPS, dqGroupLabel, coolbetBlockRisk, dqProblems, dqLast24h, dqAdvice, DQ_WINDOW_D,
  type BudgetView, type BlockRisk,
} from "@/lib/admin-feeds-model";
