/**
 * COOLBET-INGEST-ANON-FOLLOWUP (2026-06-06): banner on /admin/place that
 * warns when no Coolbet `odds_snapshots` have arrived in the last 60min
 * (twice the normal 30-min ingest cadence). Origin: on 2026-05-28 the
 * Coolbet manual JWT expired silently; for 6 days the ingest job failed
 * and the only signal was a wall of "no event" chips that looked normal.
 * This banner makes the next outage scream instead of whisper.
 */

export function CoolbetIngestBanner({ minutesSinceLastSnapshot }: { minutesSinceLastSnapshot: number | null }) {
  // Threshold = 60 min (2× the 30-min ingest cadence). Null means the query
  // failed — render a softer warning so the operator notices but isn't
  // bombarded by every transient DB hiccup.
  if (minutesSinceLastSnapshot != null && minutesSinceLastSnapshot < 60) return null;

  const label = minutesSinceLastSnapshot == null
    ? "Coolbet snapshot freshness check failed"
    : `No Coolbet snapshots in the last ${Math.round(minutesSinceLastSnapshot)} min`;
  const detail = minutesSinceLastSnapshot == null
    ? "Could not query odds_snapshots. Check DB connectivity."
    : "Expected cadence is 30 min. If this persists, the ingest job is likely failing — check Imperva cookies / pipeline logs.";

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-amber-200"
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">⚠️</span>
        <div className="min-w-0">
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs text-amber-300/80 mt-0.5">{detail}</div>
        </div>
      </div>
    </div>
  );
}
