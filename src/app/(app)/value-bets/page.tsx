import { getTodayBets } from "@/lib/engine-data";
import { ValueBetsLive } from "@/components/value-bets-live";

export default async function ValueBetsPage() {
  const bets = await getTodayBets();
  const sorted = [...bets].sort((a, b) => b.edge - a.edge);

  return <ValueBetsLive bets={sorted} />;
}
