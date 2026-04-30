import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets, getModelAccuracy, getTodayPicks, getTrackRecordStats, getSystemStatus } from "@/lib/engine-data";
import { TrackRecordHero } from "@/components/track-record-hero";
import { ClvEducation } from "@/components/clv-education";
import { SignificanceProgress } from "@/components/significance-progress";
import { SystemStatusCard } from "@/components/system-status";
import { EarlyResults } from "@/components/early-results";
import { TodayPicksPreview } from "@/components/today-picks-preview";
import { TrackRecordLive } from "@/components/track-record-live";

export default async function TrackRecordPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Public data — no login required
  const [accuracy, todayPicks, trackStats, systemStatus] = await Promise.all([
    getModelAccuracy(),
    getTodayPicks(),
    getTrackRecordStats(),
    getSystemStatus(),
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
    <div className="space-y-8">
      {/* Section 1: Hero — CLV, value bets, coverage (everyone) */}
      <TrackRecordHero stats={trackStats} />

      {/* Section 2: CLV education — what it means and why it matters (everyone) */}
      <ClvEducation />

      {/* Section 3: Live system status — proves the machine is running (everyone) */}
      <SystemStatusCard status={systemStatus} />

      {/* Section 4: Statistical significance progress bar (everyone) */}
      <SignificanceProgress settled={accuracy.stats.total + trackStats.settledBets} />

      {/* Section 5: Early results — contextualized, collapsible (everyone) */}
      <EarlyResults accuracy={accuracy} trackStats={trackStats} />

      {/* Section 6: Today's value opportunities (everyone, tiered in PR2) */}
      {todayPicks.length > 0 && (
        <TodayPicksPreview picks={todayPicks} />
      )}

      {/* Section 7: Bot paper trading — superadmin only */}
      {isSuperadmin && <TrackRecordLive bets={sortedBets} stats={botStats} />}
    </div>
  );
}
