"use client";

// "How to read this" panel for /admin/bots — plain-language definitions first (CLV, MC-CLV,
// PIN-CLV, t), then the icon legend. Split out of bots-board.tsx.

import { Banknote, Globe, Send, Wallet } from "lucide-react";

const HOW_TO_READ = [
  "CLV (closing-line value) = how much better our price was than the price just before kick-off. Positive means we bet at a better price than the market finally settled on — the best early sign of real skill.",
  "MC-CLV compares against the average closing price across bookmakers; PIN-CLV compares against Pinnacle's closing price with its margin removed (the sharpest reference). Each family of bots is judged on one of the two.",
  "t = how sure we are the average is not just luck: |t| ≥ 2 is roughly 95% sure; below that the bot is 'inconclusive'. In-play bots have no closing price, so no CLV yet.",
  "The bar is the 95% range on a shared −8% … +8% scale (arrowheads = runs past it). Left of zero = we priced worse than the close.",
  "Dashed amber line = a deliberately junk-anchored bot on the same markets. A bot that cannot be told apart from it is not showing skill.",
  "No verdict below 30 measured picks. ROI is a flat 1-unit stake, for comparison only — uncoloured below 300 settled.",
  "Pre-registered bots are scored on their current rule version only.",
  "Switches: /picks = shown to customers on /picks (not Telegram, not /performance). € = selected to bet real money — one of six gates; it stakes nothing alone.",
];

export function HowToRead() {
  return (
        <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <ul className="list-disc space-y-1 pl-4">
            {HOW_TO_READ.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="text-foreground">Capability icons:</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30"><Globe size={12} /></Legend>Published</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30"><Send size={12} /></Legend>Telegram</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30"><Wallet size={12} /></Legend>Real-money capable</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-red-500/20 text-red-300 ring-2 ring-red-500/60"><Banknote size={12} /></Legend>Real money ON</span>
            <span>– = collecting only (paper)</span>
          </div>
        </div>
      );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${cls}`} aria-hidden="true">{children}</span>;
}
