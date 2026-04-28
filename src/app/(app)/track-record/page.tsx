import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getAllBets } from "@/lib/engine-data";
import { TrackRecordLive } from "@/components/track-record-live";

export default async function TrackRecordPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const bets = await getAllBets();

  // Calculate stats from real data
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

  const stats = {
    totalBets,
    pending,
    won,
    lost,
    hitRate,
    roi,
    totalStaked,
    totalPnl,
    allPending,
  };

  // Sort by placedAt descending
  const sorted = [...bets].sort(
    (a, b) => b.placedAt.localeCompare(a.placedAt)
  );

  return <TrackRecordLive bets={sorted} stats={stats} />;
}
