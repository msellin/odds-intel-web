"use client";

// "How to read this" panel for /admin/bots — plain-language definitions first (CLV, sharp CLV,
// MC-CLV, t), then the icon legend. Split out of bots-board.tsx.

import { Banknote, Globe, Send, Wallet } from "lucide-react";

const HOW_TO_READ = [
  "CLV (closing-line value) = how much better our price was than the price just before kick-off. Positive means we bet at a better price than the market finally settled on — the best early sign of real skill.",
  "Sharp CLV (every bot, since #159) = our price at our books against the fresh closing line of Pinnacle with its margin removed, or a 5+ bookmaker consensus where Pinnacle has none. The same definition /performance uses. MC-CLV (against the bet book's own close, margin-corrected) is shown only as a secondary — it cannot judge a rule that bets a soft book's mispriced line.",
  "t = how sure we are the average is not just luck: |t| ≥ 2 is roughly 95% sure; below that the bot is 'inconclusive'. In-play bots have no closing price, so no CLV yet.",
  "The bar is the 95% range on a shared −8% … +8% scale (arrowheads = runs past it). Left of zero = we priced worse than the close.",
  "Dashed amber line = a deliberately junk-anchored bot on the same markets. A bot that cannot be told apart from it is not showing skill.",
  "No verdict below 30 measured picks. ROI is a flat 1-unit stake at our books' price, for comparison only — uncoloured below 300 settled. The 'all books' ROI under it is the /performance figure (best price available at pick time on every book).",
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
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-method-consensus/15 text-method-consensus ring-1 ring-method-consensus/30"><Globe size={12} /></Legend>Published</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-info/15 text-info ring-1 ring-info/30"><Send size={12} /></Legend>Telegram</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-warning/10 text-warning ring-1 ring-warning/30"><Wallet size={12} /></Legend>Real-money capable</span>
            <span className="inline-flex items-center gap-1.5"><Legend cls="bg-danger/20 text-danger ring-2 ring-danger/60"><Banknote size={12} /></Legend>Real money ON</span>
            <span>– = collecting only (paper)</span>
          </div>
        </div>
      );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${cls}`} aria-hidden="true">{children}</span>;
}
