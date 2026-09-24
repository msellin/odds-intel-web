// Shared number formatting for admin cards and charts: sign first, a real minus sign, thousands
// separators ("−€1,231", "+4.2%"). One formatter so a card and a chart never disagree.

const MINUS = "−";

export function fmtEur(v: number | null | undefined, { signed = false }: { signed?: boolean } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v).toLocaleString("en-GB", { maximumFractionDigits: 0 });
  const sign = v < 0 ? MINUS : signed && v > 0 ? "+" : "";
  return `${sign}€${abs}`;
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v < 0 ? MINUS : v > 0 ? "+" : "";
  return `${sign}${Math.abs(v * 100).toFixed(digits)}%`;
}

export function fmtInt(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}
