// AnswerStrip (#139 answer-first pass, 2026-09-25). The owner's questions, answered in one plain
// sentence each at the top of a page — "Money: off, nothing can bet", "Feeds: Unibet stopped 8 h" —
// before any number, chart or table. Each answer links to where it is dealt with. Server component.

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { TONE_BG, TONE_TEXT, type Tone } from "./status-badge";

export interface Answer {
  /** The question, in two or three words: "Money", "Feeds", "Jobs". */
  label: string;
  /** The answer, one plain sentence. */
  text: string;
  tone: Tone;
  icon: LucideIcon;
  href?: string;
  /** Optional small second line (a figure that backs the answer). */
  sub?: string;
  /** Red border = something to act on. Defaults to tone "danger"; a loss is a fact, not an alarm (false). */
  alarm?: boolean;
}

export function AnswerStrip({ answers }: { answers: Answer[] }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${answers.length >= 5 ? "lg:grid-cols-3 2xl:grid-cols-5" : "xl:grid-cols-4"}`}>
      {answers.map((a) => {
        const body = (
          <>
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[a.tone]} ${TONE_TEXT[a.tone]}`}>
              <a.icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{a.label}</span>
              <span className={`mt-0.5 block text-base font-medium leading-snug ${a.tone === "danger" ? "text-danger" : "text-foreground"}`}>{a.text}</span>
              {a.sub && <span className="mt-0.5 block text-xs text-muted-foreground">{a.sub}</span>}
            </span>
            {a.href && <ArrowRight size={16} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />}
          </>
        );
        const cls = `flex items-start gap-3 rounded-xl border bg-card p-4 ${(a.alarm ?? a.tone === "danger") ? "border-danger/50" : "border-border"}`;
        return a.href ? (
          <Link key={a.label} href={a.href} className={`${cls} transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
            {body}
          </Link>
        ) : (
          <div key={a.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
