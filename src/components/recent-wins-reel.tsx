import { Trophy } from "lucide-react";

interface RecentWin {
  home: string;
  away: string;
  league: string | null;
  country: string | null;
  market: string;
  selection: string;
  odds: number;
  clv: number;
  pick_time: string | null;
}

interface Props {
  wins: RecentWin[] | null;
}

// Country name → flag emoji. Falls back to globe for unmapped / "World" / null.
// Names match the `leagues.country` column values (English spelling, hyphens
// for two-word countries like "United-Arab-Emirates").
const COUNTRY_FLAGS: Record<string, string> = {
  "Argentina": "🇦🇷", "Australia": "🇦🇺", "Austria": "🇦🇹",
  "Belgium": "🇧🇪", "Brazil": "🇧🇷", "Bulgaria": "🇧🇬",
  "Canada": "🇨🇦", "Chile": "🇨🇱", "China": "🇨🇳", "Colombia": "🇨🇴",
  "Croatia": "🇭🇷", "Cyprus": "🇨🇾", "Czech-Republic": "🇨🇿",
  "Denmark": "🇩🇰", "Ecuador": "🇪🇨", "Egypt": "🇪🇬",
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Estonia": "🇪🇪", "Ethiopia": "🇪🇹",
  "Finland": "🇫🇮", "France": "🇫🇷", "Georgia": "🇬🇪",
  "Germany": "🇩🇪", "Greece": "🇬🇷", "Hungary": "🇭🇺",
  "Iceland": "🇮🇸", "India": "🇮🇳", "Indonesia": "🇮🇩",
  "Ireland": "🇮🇪", "Israel": "🇮🇱", "Italy": "🇮🇹",
  "Japan": "🇯🇵", "Kazakhstan": "🇰🇿", "Latvia": "🇱🇻",
  "Lithuania": "🇱🇹", "Malaysia": "🇲🇾", "Mexico": "🇲🇽",
  "Morocco": "🇲🇦", "Netherlands": "🇳🇱", "New-Zealand": "🇳🇿",
  "Northern-Ireland": "🇬🇧", "Norway": "🇳🇴", "Paraguay": "🇵🇾",
  "Peru": "🇵🇪", "Poland": "🇵🇱", "Portugal": "🇵🇹",
  "Romania": "🇷🇴", "Russia": "🇷🇺", "Saudi-Arabia": "🇸🇦",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Serbia": "🇷🇸", "Singapore": "🇸🇬",
  "Slovakia": "🇸🇰", "Slovenia": "🇸🇮", "South-Africa": "🇿🇦",
  "South-Korea": "🇰🇷", "Spain": "🇪🇸", "Sweden": "🇸🇪",
  "Switzerland": "🇨🇭", "Thailand": "🇹🇭", "Turkey": "🇹🇷",
  "Ukraine": "🇺🇦", "United-Arab-Emirates": "🇦🇪", "Uruguay": "🇺🇾",
  "USA": "🇺🇸", "Venezuela": "🇻🇪", "Vietnam": "🇻🇳",
  "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "World": "🌍",
};

function flagFor(country: string | null): string {
  if (!country) return "🌍";
  return COUNTRY_FLAGS[country] ?? "🌍";
}

function marketLabel(m: string, s: string): string {
  if (m === "1x2") {
    if (s.toLowerCase() === "home") return "Home win";
    if (s.toLowerCase() === "away") return "Away win";
    if (s.toLowerCase() === "draw") return "Draw";
    return s;
  }
  if (m === "asian_handicap") return `AH ${s}`;
  if (m === "draw_no_bet") return `DNB ${s.toLowerCase()}`;
  if (m === "double_chance") return `DC ${s}`;
  if (m === "btts") return s.toLowerCase() === "yes" ? "BTTS yes" : "BTTS no";
  if (m === "o/u" || m === "over_under") return `${s}`;
  return `${m} ${s}`;
}

export function RecentWinsReel({ wins }: Props) {
  if (!wins || wins.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <div className="px-5 py-3 border-b border-border/30 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold">Recent wins · last 14 days</h2>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Model picks that hit AND beat the closing line
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border/20">
        {wins.map((w, i) => (
          <div key={i} className="bg-card/80 px-3 py-2.5 flex flex-col gap-1">
            <div className="text-[11px] font-semibold leading-tight">
              {w.home} <span className="text-muted-foreground font-normal">v</span> {w.away}
            </div>
            {w.country && (
              <div className="text-[10px] text-muted-foreground truncate" title={`${w.country} · ${w.league ?? ""}`}>
                <span className="mr-1" aria-hidden="true">{flagFor(w.country)}</span>
                {w.country}{w.league ? ` · ${w.league}` : ""}
              </div>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-foreground">
                {marketLabel(w.market, w.selection)} @ <span className="font-mono">{w.odds.toFixed(2)}</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 tabular-nums">
                CLV +{(w.clv * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
