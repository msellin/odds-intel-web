import { PerformancePnlChart } from "@/components/performance-pnl-chart";
import type { PublicPerformanceExtras, CalibrationBucket, Streaks } from "@/lib/engine-data";

export function PerformanceExtras({ data }: { data: PublicPerformanceExtras }) {
  const { cumulative, calibration, streaks } = data;
  return (
    <div className="space-y-6">
      {/* Chart card */}
      <div className="rounded-xl border border-border/40 bg-card/40 p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Cumulative P&amp;L
          </h2>
          <span className="text-[10px] text-muted-foreground">last 90 days · UTC</span>
        </div>
        <PerformancePnlChart data={cumulative} />
      </div>

      {/* Streaks + calibration stacked on mobile, side-by-side on md+ */}
      <div className="grid gap-4 md:grid-cols-2">
        <StreaksCard streaks={streaks} />
        <CalibrationCard buckets={calibration} />
      </div>
    </div>
  );
}

function StreaksCard({ streaks }: { streaks: Streaks }) {
  const current =
    streaks.currentWin > 0
      ? { label: `${streaks.currentWin}W in a row`, tone: "win" as const }
      : streaks.currentLoss > 0
        ? { label: `${streaks.currentLoss}L in a row`, tone: "loss" as const }
        : { label: "no active streak", tone: "neutral" as const };
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Streaks
      </h2>
      <div className="space-y-2.5">
        <StreakRow label="Current" value={current.label} tone={current.tone} />
        <StreakRow label="Longest winning" value={`${streaks.longestWin}W`} tone="win" />
        <StreakRow label="Longest losing" value={`${streaks.longestLoss}L`} tone="loss" />
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground leading-snug">
        Variance is real — even a +5% ROI edge will see double-digit losing runs.
      </p>
    </div>
  );
}

function StreakRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "win" | "loss" | "neutral";
}) {
  const color =
    tone === "win"
      ? "text-emerald-400"
      : tone === "loss"
        ? "text-red-400"
        : "text-muted-foreground";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-mono text-base font-bold ${color}`}>{value}</span>
    </div>
  );
}

function CalibrationCard({ buckets }: { buckets: CalibrationBucket[] }) {
  const visible = buckets.filter((b) => b.n >= 20);
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        Placed-bet calibration
      </h2>
      {/* CALIBRATION-HONEST-COPY (2026-07-06): the old intro said "when
          the model says 60%, it should hit ~60%" and every row showed
          the opposite (systematic ~10pp under-hit). That framing was
          dishonest — the model is a known 5-15pp over-confident on
          picks in the 30-60% range (documented in MODEL_WHITEPAPER §3.7
          GLOBAL-PLATT-OVERCONFIDENCE). Selection bias amplifies it:
          every row here is a pick the bot placed at market edge, so
          the sample sits on the model's optimistic tail by
          construction. Kelly sizing + the edge gate compensate at the
          P&L layer — ROI is still positive despite the visible gap.
          Better to say that than pretend the table is broken. */}
      <p className="text-[10px] text-muted-foreground mb-3 leading-snug">
        Bets we placed at market edge — our model is known 5–15pp
        over-confident on mid-range picks. Kelly sizing + edge gate
        compensate at the P&amp;L layer (still positive ROI).
      </p>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">Need more settled bets per bucket.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left pb-1.5">Predicted</th>
              <th className="text-right pb-1.5">Actual</th>
              <th className="text-right pb-1.5">Gap</th>
              <th className="text-right pb-1.5">N</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => {
              const actual = b.actualHit ?? 0;
              const delta = actual - b.predictedMid;
              // Neutral gray for all rows — the "red = broken" reading
              // was misleading. The gap size is now displayed
              // explicitly in a Gap column with a subtle sign, letting
              // the reader form their own view without the panic-red.
              return (
                <tr key={b.label} className="border-t border-border/30">
                  <td className="py-1.5 font-mono">{b.label}</td>
                  <td className="py-1.5 text-right font-mono text-neutral-200">
                    {(actual * 100).toFixed(1)}%
                  </td>
                  <td
                    className={`py-1.5 text-right font-mono ${
                      Math.abs(delta) < 0.03
                        ? "text-emerald-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {delta >= 0 ? "+" : ""}
                    {(delta * 100).toFixed(1)}pp
                  </td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">{b.n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
