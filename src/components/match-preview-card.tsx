import { Sparkles, Lock } from "lucide-react";
import type { MatchPreview } from "@/lib/engine-data";

interface Props {
  preview: MatchPreview;
  isPro: boolean;
}

export function MatchPreviewCard({ preview, isPro }: Props) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <h2 className="text-sm font-semibold text-foreground">AI Match Preview</h2>
        {!isPro && (
          <span className="ml-auto flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">
            <Lock className="h-2.5 w-2.5" />
            Full preview — PRO
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {isPro ? preview.previewText : preview.previewShort}
      </p>

      {!isPro && (
        <p className="text-[11px] text-muted-foreground/50 italic">
          Full AI preview available on Pro — covers form, market movement, injury impact and edge assessment.
        </p>
      )}
    </div>
  );
}
