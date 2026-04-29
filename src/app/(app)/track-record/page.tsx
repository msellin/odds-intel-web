import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets, getModelAccuracy, getTodayPicks } from "@/lib/engine-data";
import { TrackRecordLive } from "@/components/track-record-live";
import { ModelAccuracy } from "@/components/model-accuracy";
import { LayeredSimulation } from "@/components/layered-simulation";
import { TodayPicksPreview } from "@/components/today-picks-preview";

export default async function TrackRecordPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Model accuracy is public — no login required
  const [accuracy, todayPicks] = await Promise.all([
    getModelAccuracy(),
    getTodayPicks(),
  ]);

  // Bot P&L — only fetch and render for superadmins
  let isSuperadmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .single();
    isSuperadmin = profile?.is_superadmin === true;
  }

  const bets = isSuperadmin ? await getAllBets() : [];

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
      {/* Section A: Model accuracy — all users */}
      <ModelAccuracy data={accuracy} />

      {/* Section B: Today's picks preview — pending picks with locked Pro columns */}
      {todayPicks.length > 0 && (
        <TodayPicksPreview picks={todayPicks} />
      )}

      {/* Section C: Layered simulation — what adding more layers would have done */}
      {accuracy.rows.length > 0 && (
        <LayeredSimulation rows={accuracy.rows} />
      )}

      {/* Section D: Bot paper trading — superadmin only */}
      {isSuperadmin && <TrackRecordLive bets={sortedBets} stats={botStats} />}
    </div>
  );
}
