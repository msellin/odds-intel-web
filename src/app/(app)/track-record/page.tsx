export const dynamic = 'force-dynamic';

import { createSupabaseServer } from "@/lib/supabase-server";
import { getUserTier } from "@/lib/get-user-tier";
import { getModelAccuracy, getTrackRecordStats, getSystemStatus } from "@/lib/engine-data";
import { TrackRecordHero } from "@/components/track-record-hero";
import { ClvEducation } from "@/components/clv-education";
import { SignificanceProgress } from "@/components/significance-progress";
import { SystemStatusCard } from "@/components/system-status";
import { EarlyResults } from "@/components/early-results";
import { PredictionHistory } from "@/components/prediction-history";
import { TrackRecordFooterCta } from "@/components/track-record-footer-cta";

export default async function TrackRecordPage() {
  // Run auth and data queries in parallel — data doesn't depend on auth
  const [authResult, accuracy, trackStats, systemStatus] = await Promise.all([
    (async () => {
      const supabase = await createSupabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isPro: false, isElite: false };
      return getUserTier(user.id, supabase);
    })(),
    getModelAccuracy(),
    getTrackRecordStats(),
    getSystemStatus(),
  ]);

  const { isPro, isElite } = authResult;

  return (
    <div className="space-y-8">
      {/* Hero — CLV, value bets, coverage (everyone) */}
      <TrackRecordHero stats={trackStats} />

      {/* CLV education — what it means and why it matters (everyone) */}
      <ClvEducation />

      {/* Live system status — proves the machine is running (everyone) */}
      <SystemStatusCard status={systemStatus} />

      {/* Statistical significance progress bar (everyone) */}
      <SignificanceProgress settled={trackStats.settledBets} />

      {/* Early results — contextualized, collapsible (everyone) */}
      <EarlyResults accuracy={accuracy} trackStats={trackStats} />

      {/* Prediction history — tiered (free: limited, Pro: full + CLV) */}
      <PredictionHistory rows={accuracy.rows} isPro={isPro} isElite={isElite} />

      {/* Footer CTA — conversion close (everyone except Elite) */}
      <TrackRecordFooterCta isPro={isPro} isElite={isElite} />
    </div>
  );
}
