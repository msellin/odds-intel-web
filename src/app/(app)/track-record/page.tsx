import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets, getModelAccuracy } from "@/lib/engine-data";
import { TrackRecordLive } from "@/components/track-record-live";
import { ModelAccuracy } from "@/components/model-accuracy";

export default async function TrackRecordPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Model accuracy is public — no login required
  // Bot P&L is superadmin-only — only fetch bets if user is logged in
  const [bets, accuracy] = await Promise.all([
    user ? getAllBets() : Promise.resolve([]),
    getModelAccuracy(),
  ]);

  // Bot stats for the superadmin section
  const totalBets = bets.length;
  const pending = bets.filter((b) => b.result === "pending").length;
  const won = bets.filter((b) => b.result === "won").length;
  const lost = bets.filter((b) => b.result === "lost").length;
  const settled = won + lost;
  const hitRate = settled > 0 ? (won / settled) * 100 : 0;
  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalPnl = bets.reduce((sum, b) => sum + b.pnl, 0);
  const roi = totalStaked > 0 && settled > 0 ? (totalPnl / totalStaked) * 100 : 0;
  const allPending = totalBets > 0 && pending === totalBets;

  const botStats = { totalBets, pending, won, lost, hitRate, roi, totalStaked, totalPnl, allPending };

  const sortedBets = [...bets].sort((a, b) => b.placedAt.localeCompare(a.placedAt));

  return (
    <div className="space-y-12">
      {/* ── Section A: Model accuracy — all users, no login required ── */}
      <ModelAccuracy data={accuracy} />

      {/* ── Section B: Bot paper trading — superadmin only (gated inside component) ── */}
      {user && <TrackRecordLive bets={sortedBets} stats={botStats} />}
    </div>
  );
}
