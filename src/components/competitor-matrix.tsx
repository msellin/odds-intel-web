/**
 * GROWTH-COMPARISON-MATRIX (2026-06-05, Tier A #3) — competitor matrix on landing.
 *
 * Tier framing: each competitor column is a representative of one of the
 * 5 competitor "tiers" we've identified. The killer row at the bottom —
 * "Spans all 5 tiers" — is the actual punchline.
 *
 * 3-symbol legend:
 *   ✅ Have it
 *   ⏳ On the roadmap (intentional — we will, but we don't yet)
 *   ❌ Won't do (positioning choice — e.g. manual tipster picks)
 *
 * Honest gaps are kept visible — without ⏳/❌ in our column the matrix
 * loses credibility. The 13-bookmaker gap vs OddsPortal/WinnerOdds is
 * the most prominent honest weakness; it stays as ⏳ because we plan to
 * close it (GROWTH-BOOKMAKER-EXPANSION).
 *
 * External links: competitor names link to their sites (Linear/Notion
 * pattern — confident + fair vs hiding behind generic categories).
 */
import { Fragment } from "react";
import Link from "next/link";
import { Check, Hourglass, X as Cross } from "lucide-react";

type Cell = "have" | "roadmap" | "wont" | "partial";

interface CompetitorCol {
  name: string;
  tier: string;
  href?: string;
}

interface FeatureRow {
  label: string;
  cells: Cell[]; // length === COMPETITORS.length + 1 (OddsIntel last)
}

interface Section {
  heading: string;
  rows: FeatureRow[];
}

const COMPETITORS: CompetitorCol[] = [
  { name: "SofaScore",   tier: "Stats aggregator",    href: "https://www.sofascore.com" },
  { name: "OddsChecker", tier: "Odds comparison",     href: "https://www.oddschecker.com" },
  { name: "WinnerOdds",  tier: "Value-bet engine",    href: "https://winnerodds.com" },
  { name: "InPlayGuru",  tier: "In-play scanner",     href: "https://inplayguru.com" },
];

const SECTIONS: Section[] = [
  {
    heading: "Core data — what every football fan needs",
    rows: [
      { label: "280+ league coverage",     cells: ["have",    "wont",    "wont",    "have",    "have"] },
      { label: "Live scores + match clock", cells: ["have",    "partial", "wont",    "have",    "have"] },
      { label: "Confirmed lineups + injuries", cells: ["have", "wont",    "wont",    "partial", "have"] },
    ],
  },
  {
    heading: "Odds intelligence",
    rows: [
      { label: "Multi-bookmaker odds comparison", cells: ["wont", "have", "have",    "wont",    "partial"] },
      { label: "Odds movement / drift detection", cells: ["wont", "have", "have",    "have",    "have"] },
      { label: "Live in-play odds tracking",      cells: ["wont", "wont", "wont",    "have",    "have"] },
      { label: "Live xG / momentum signals",      cells: ["partial","wont","wont",   "have",    "have"] },
    ],
  },
  {
    heading: "Predictions + value",
    rows: [
      { label: "AI prediction confidence %",        cells: ["wont", "wont", "partial","wont", "have"] },
      { label: "AI value-bet detection (edge math)", cells: ["wont", "wont", "have",   "partial","have"] },
      { label: "Multi-strategy ensemble (not one model)", cells: ["wont", "wont", "wont", "partial","have"] },
      { label: "Per-bet AI explanation",            cells: ["wont", "wont", "wont",   "wont",  "have"] },
    ],
  },
  {
    heading: "Delivery + transparency",
    rows: [
      { label: "Telegram alerts on new picks",     cells: ["wont", "wont", "have",    "have",   "have"] },
      { label: "Public per-bet track record",      cells: ["wont", "wont", "have",    "partial","have"] },
      { label: "Honest drawdown disclosure",       cells: ["wont", "wont", "have",    "wont",   "have"] },
      { label: "Open methodology page",            cells: ["wont", "wont", "partial", "wont",   "have"] },
      { label: "Third-party verified (Bet-Analytix / SBC)", cells: ["wont","wont","have","wont","roadmap"] },
      { label: "Multi-bookmaker depth (50+)",      cells: ["wont", "have", "have",    "wont",   "roadmap"] },
    ],
  },
];

const KILLER_ROW: FeatureRow = {
  label: "Spans all 5 competitor tiers",
  cells: ["wont", "wont", "wont", "wont", "have"],
};

function CellGlyph({ value }: { value: Cell }) {
  if (value === "have") {
    return <Check className="mx-auto size-4 text-green-400" aria-label="Yes" />;
  }
  if (value === "roadmap") {
    return <Hourglass className="mx-auto size-3.5 text-amber-300" aria-label="On roadmap" />;
  }
  if (value === "partial") {
    return (
      <span
        className="mx-auto inline-block text-[10px] font-mono text-amber-300/80"
        aria-label="Partial"
      >
        ~
      </span>
    );
  }
  return <Cross className="mx-auto size-3.5 text-muted-foreground/30" aria-label="No" />;
}

export function CompetitorMatrix() {
  return (
    <section className="py-14" aria-label="OddsIntel vs competitors">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Most sites do one thing. We do all of them.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-balance text-sm text-muted-foreground">
            Every competitor below owns one slice of the punter&apos;s workflow.
            You&apos;d need <span className="font-mono text-foreground">4 separate
            subscriptions</span> to replace what OddsIntel does in one place.
          </p>
        </div>

        {/* Mobile stack view — table requires ~265px of horizontal scroll
            at 375px viewport. The mobile version flattens each feature
            into a card with OddsIntel always visible.
            GROWTH-MOBILE-FIRST-AUDIT P0-2. */}
        <div className="mt-8 space-y-3 md:hidden">
          {SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="px-1 pb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {section.heading}
              </p>
              <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04]">
                {section.rows.map((row, i) => (
                  <div key={`${section.heading}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 text-sm text-foreground/85">{row.label}</div>
                    <div className="flex items-center gap-2.5 text-xs">
                      {COMPETITORS.map((c, j) => (
                        <div
                          key={c.name}
                          className="flex w-7 flex-col items-center"
                          title={c.name}
                        >
                          <CellGlyph value={row.cells[j]} />
                        </div>
                      ))}
                      <div className="flex w-7 flex-col items-center rounded bg-green-500/[0.08] py-0.5">
                        <CellGlyph value={row.cells[COMPETITORS.length]} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* Killer row at the bottom of the mobile stack */}
          <div className="rounded-xl border border-green-500/30 bg-green-500/[0.05] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-sm font-bold text-foreground">
                {KILLER_ROW.label}
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                {COMPETITORS.map((c, j) => (
                  <div key={c.name} className="flex w-7 flex-col items-center" title={c.name}>
                    <CellGlyph value={KILLER_ROW.cells[j]} />
                  </div>
                ))}
                <div className="flex w-7 flex-col items-center rounded bg-green-500/[0.15] py-0.5">
                  <CellGlyph value={KILLER_ROW.cells[COMPETITORS.length]} />
                </div>
              </div>
            </div>
          </div>
          {/* Compact column-key legend so users know what each column glyph maps to */}
          <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-2 text-[10px] text-muted-foreground/70">
            <span className="font-mono uppercase tracking-widest text-muted-foreground/50">Columns: </span>
            {COMPETITORS.map((c, idx) => (
              <span key={c.name}>
                {idx > 0 && " · "}
                <span className="text-foreground/80">{c.name}</span>
              </span>
            ))}
            {" · "}
            <span className="font-bold text-green-400">OddsIntel</span>
          </div>
        </div>

        {/* Desktop / tablet table view — hidden on mobile, where the stack above takes over */}
        <div className="mt-8 hidden overflow-x-auto rounded-xl border border-white/[0.06] md:block">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-muted/30">
                <th className="py-3 pl-4 pr-2 text-left text-xs font-medium text-muted-foreground w-[36%]">
                  Feature
                </th>
                {COMPETITORS.map((c) => (
                  <th
                    key={c.name}
                    className="py-3 px-2 text-center text-xs font-medium w-[12%]"
                  >
                    <div className="text-foreground">
                      {c.href ? (
                        <a
                          href={c.href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="hover:text-green-400 transition-colors"
                        >
                          {c.name}
                        </a>
                      ) : (
                        c.name
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                      {c.tier}
                    </div>
                  </th>
                ))}
                <th className="py-3 pl-2 pr-4 text-center text-xs font-medium w-[16%] bg-green-500/[0.06]">
                  <div className="text-green-400 font-semibold">OddsIntel</div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-green-400/70">
                    All-in-one
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {SECTIONS.map((section) => (
                <Fragment key={section.heading}>
                  <tr className="bg-white/[0.02]">
                    <td
                      colSpan={COMPETITORS.length + 2}
                      className="py-2 pl-4 pr-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60"
                    >
                      {section.heading}
                    </td>
                  </tr>
                  {section.rows.map((row, i) => (
                    <tr key={`${section.heading}-${i}`} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 pl-4 pr-2 text-sm text-foreground/80">
                        {row.label}
                      </td>
                      {row.cells.slice(0, COMPETITORS.length).map((cell, j) => (
                        <td key={j} className="py-2.5 px-2">
                          <CellGlyph value={cell} />
                        </td>
                      ))}
                      <td className="py-2.5 pl-2 pr-4 bg-green-500/[0.04]">
                        <CellGlyph value={row.cells[COMPETITORS.length]} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {/* Killer row */}
              <tr className="border-t-2 border-green-500/30">
                <td className="py-3 pl-4 pr-2 text-sm font-bold text-foreground">
                  {KILLER_ROW.label}
                </td>
                {KILLER_ROW.cells.slice(0, COMPETITORS.length).map((cell, j) => (
                  <td key={j} className="py-3 px-2">
                    <CellGlyph value={cell} />
                  </td>
                ))}
                <td className="py-3 pl-2 pr-4 bg-green-500/[0.08]">
                  <CellGlyph value={KILLER_ROW.cells[COMPETITORS.length]} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend + caveats */}
        <div className="mt-4 flex flex-col items-center gap-3 text-xs text-muted-foreground sm:flex-row sm:justify-center sm:gap-6">
          <div className="flex items-center gap-1.5">
            <Check className="size-3.5 text-green-400" /> Have it
          </div>
          <div className="flex items-center gap-1.5">
            <Hourglass className="size-3 text-amber-300" /> On roadmap
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-amber-300/80">~</span> Partial / limited
          </div>
          <div className="flex items-center gap-1.5">
            <Cross className="size-3 text-muted-foreground/40" /> Doesn&apos;t offer
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Comparison verified 2026-06-05 from each competitor&apos;s public site.{" "}
          <Link
            href="/methodology"
            className="underline underline-offset-2 hover:text-foreground"
          >
            See our methodology →
          </Link>
          {" · "}
          <Link
            href="/live"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Try our in-play scanner →
          </Link>
        </p>
      </div>
    </section>
  );
}
