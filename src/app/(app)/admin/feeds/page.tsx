export const dynamic = 'force-dynamic';

import Link from "next/link";
import { AutoRefresh } from "../ops/auto-refresh";
import { FeedsBoard } from "./feeds-board";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { getDataQualityFindings, getFeedDashboard } from "@/lib/engine-data";
import { DqFindings } from "./dq-findings";

// FEEDS-DASHBOARD (#107). Data: feed_status / feed_book_stats, written every 5 min
// by the engine (workers/jobs/feed_health.py, registry workers/registry/
// feed_registry.py). Layout (redesigned 2026-09-23 on the owner's brief): one
// block per book — name + last odds time, coloured by age — details behind a
// click. See feeds-board.tsx.

export default async function FeedsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Access denied.</div>;
  }
  const db = createServerServiceClient();
  const { data: profile } = await db.from("profiles").select("is_superadmin").eq("id", user.id).single();
  if (!profile?.is_superadmin) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground">Superadmin only.</div>;
  }

  const [{ feeds, books, now }, findings] = await Promise.all([getFeedDashboard(), getDataQualityFindings()]);
  const updated = feeds.reduce<string | null>((a, f) => (!a || f.updated_at > a ? f.updated_at : a), null);
  const statusAgeMin = updated ? Math.round((now - new Date(updated).getTime()) / 60000) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <AutoRefresh intervalMs={60_000} />
      <div>
        <Link href="/admin" className="text-xs text-muted-foreground hover:underline">← Admin</Link>
        <h1 className="text-2xl font-bold mt-1">Bookmakers &amp; feeds</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Time since each book&apos;s last odds —{" "}
          <span className="text-emerald-500">green</span> fresh,{" "}
          <span className="text-amber-500">amber</span> a sweep missed,{" "}
          <span className="text-red-500">red</span> stopped,{" "}
          <span className="text-sky-500">blue</span> paused. Click a block for details and controls.
          {statusAgeMin !== null && (
            <span className={statusAgeMin > 15 ? " text-red-500" : ""}>
              {" "}Status checked {statusAgeMin < 1 ? "just now" : `${statusAgeMin} min ago`}
              {statusAgeMin > 15 ? " — the status job itself looks stuck." : "."}
            </span>
          )}
        </p>
      </div>
      {feeds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No status yet — the engine writes it every 5 minutes.</p>
      ) : (
        <FeedsBoard feeds={feeds} books={books} now={now} />
      )}
      <DqFindings findings={findings} now={now} />
    </div>
  );
}
