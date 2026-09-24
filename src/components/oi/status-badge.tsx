// StatusBadge + TrendPill (#139 admin visual direction §4). One tone vocabulary for every status in
// the admin, replacing the per-file DOT_CLS / VERDICT_BG maps.
//
// TrendPill colour means GOOD FOR US / BAD FOR US, not the sign: a falling "needs a look" count
// is green. Pass `good` explicitly; `null` renders neutral (flat, or too few samples to say).

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

export type Tone = "success" | "danger" | "warning" | "info" | "neutral" | "sharp" | "consensus" | "model";

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  info: "text-info",
  neutral: "text-muted-foreground",
  sharp: "text-method-sharp",
  consensus: "text-method-consensus",
  model: "text-method-model",
};

export const TONE_BG: Record<Tone, string> = {
  success: "bg-success/15",
  danger: "bg-danger/15",
  warning: "bg-warning/15",
  info: "bg-info/15",
  neutral: "bg-muted",
  sharp: "bg-method-sharp/15",
  consensus: "bg-method-consensus/15",
  model: "bg-method-model/15",
};

export const TONE_DOT: Record<Tone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground",
  sharp: "bg-method-sharp",
  consensus: "bg-method-consensus",
  model: "bg-method-model",
};

export function StatusBadge({ tone, children, dot = true, title }: { tone: Tone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}>
      {dot && <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function TrendPill({ value, good, up, title }: { value: ReactNode; good: boolean | null; up?: boolean | null; title?: string }) {
  const tone: Tone = good == null ? "neutral" : good ? "success" : "danger";
  // the arrow shows the DIRECTION; the colour shows whether that is good for us
  const dir = up ?? good;
  const Icon = dir == null ? Minus : dir ? TrendingUp : TrendingDown;
  return (
    <span title={title} className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}>
      <Icon size={12} aria-hidden="true" />
      {value}
    </span>
  );
}
