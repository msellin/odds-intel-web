export const dynamic = 'force-dynamic';

import Link from "next/link";
import { createSupabaseServer, createServerServiceClient } from "@/lib/supabase-server";
import { getFeedStatus, type FeedStatus } from "@/lib/engine-data";

// ADMIN-REDO (#107 FEEDS-DASHBOARD, 2026-09-23). CS2, LoL, Tennis, "Place real
// bets" and "Real bets" were removed from this index at the owner's request — not
// in use. Their routes still exist; only the entry points are gone. The page now
// leads with the Bookmakers block, the entry into /admin/feeds.
const SECTIONS: { href: string; title: string; blurb: string }[] = [
  {
    href: "/admin/bots",
    title: "Bot dashboard",
    blurb: "Every active bot on one ledger — config, capabilities, flat ROI and the family's admissible CLV verdict.",
  },
  {
    href: "/admin/shadow-bots",
    title: "Shadow bots",
    blurb: "Shadow-bot board — the main operator view of paper picks.",
  },
  {
    href: "/admin/ops",
    title: "Ops",
    blurb: "Match coverage, odds pipeline, settlement, scheduler runs.",
  },
];

const DOT: Record<FeedStatus["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  fail: "bg-red-500",
  unknown: "bg-zinc-500",
  paused: "bg-sky-500",
};

export default async function AdminIndexPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access denied.
      </div>
    );
  }
  const db = createServerServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Superadmin only.
      </div>
    );
  }

  const feeds = await getFeedStatus();
  const count = (s: FeedStatus["status"]) => feeds.filter((f) => f.status === s).length;
  const bookFeeds = feeds.filter((f) => f.category === "book" && f.kind === "pre-match");
  const problems = feeds.filter((f) => f.status === "fail" || f.status === "warn");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Admin</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Operator-only consoles. Each section opens a focused dashboard.
      </p>

      <Link
        href="/admin/feeds"
        className="block rounded-lg border border-border bg-card hover:bg-accent transition-colors px-4 py-4 mb-3"
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="font-semibold text-lg">Bookmakers &amp; feeds</div>
          <div className="text-xs text-muted-foreground">
            {feeds.length === 0 ? (
              "no status yet"
            ) : (
              <>
                <span className="text-emerald-500">{count("ok")} ok</span>
                {" · "}
                <span className="text-amber-500">{count("warn")} warn</span>
                {" · "}
                <span className="text-red-500">{count("fail")} fail</span>
              </>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">
          Every sweeper and feed: last data written, schedule, today&apos;s coverage, errors.
        </div>
        {bookFeeds.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {bookFeeds.map((f) => (
              <span
                key={f.feed_id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs"
              >
                <span className={`h-2 w-2 rounded-full ${DOT[f.status]}`} />
                {f.book}
              </span>
            ))}
          </div>
        )}
        {problems.length > 0 && (
          <ul className="mt-3 space-y-1">
            {problems.slice(0, 4).map((f) => (
              <li key={f.feed_id} className="text-xs">
                <span className={f.status === "fail" ? "text-red-500" : "text-amber-500"}>
                  {f.status === "fail" ? "✕" : "!"} {f.label}
                </span>
                {f.status_reason && (
                  <span className="text-muted-foreground"> — {f.status_reason}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="text-xs text-muted-foreground/70 mt-2 font-mono">/admin/feeds</div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-border bg-card hover:bg-accent transition-colors px-4 py-3 block"
          >
            <div className="font-semibold">{s.title}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{s.blurb}</div>
            <div className="text-xs text-muted-foreground/70 mt-1 font-mono">{s.href}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
