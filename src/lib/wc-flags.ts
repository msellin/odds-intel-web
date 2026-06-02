/**
 * Country flag emojis for the 48 World Cup 2026 qualifiers + placeholders for
 * the 2 intercontinental play-off winners that land in June. Falls back to
 * the existing AF team logo if no match.
 *
 * Unicode regional indicators render natively on iOS/macOS/Android. Linux
 * (Chrome / Firefox on Ubuntu) may render as letter pairs — that's a known
 * limitation we accept for the launch.
 *
 * Keys are matched against the AF `teams.name` column (which is the AF
 * canonical name — e.g. "USA" not "United States", "South Korea" not
 * "Republic of Korea"). Aliases are added where AF disagrees with FIFA's
 * usual rendering.
 */

const WC_FLAGS: Record<string, string> = {
  // ── Host nations
  USA: "🇺🇸",
  "United States": "🇺🇸",
  Canada: "🇨🇦",
  Mexico: "🇲🇽",

  // ── UEFA (Europe)
  France: "🇫🇷",
  Spain: "🇪🇸",
  Germany: "🇩🇪",
  Italy: "🇮🇹",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Portugal: "🇵🇹",
  Netherlands: "🇳🇱",
  Belgium: "🇧🇪",
  Croatia: "🇭🇷",
  Switzerland: "🇨🇭",
  Denmark: "🇩🇰",
  Austria: "🇦🇹",
  Poland: "🇵🇱",
  Norway: "🇳🇴",
  Sweden: "🇸🇪",
  Serbia: "🇷🇸",
  Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Ukraine: "🇺🇦",
  Turkey: "🇹🇷",
  Czech: "🇨🇿",
  "Czech Republic": "🇨🇿",
  Czechia: "🇨🇿",
  Hungary: "🇭🇺",
  Slovakia: "🇸🇰",
  Slovenia: "🇸🇮",
  Ireland: "🇮🇪",
  "Northern Ireland": "🇬🇧",
  Finland: "🇫🇮",
  Iceland: "🇮🇸",
  Greece: "🇬🇷",
  Romania: "🇷🇴",
  Bulgaria: "🇧🇬",
  Bosnia: "🇧🇦",
  "Bosnia and Herzegovina": "🇧🇦",
  Albania: "🇦🇱",
  "North Macedonia": "🇲🇰",

  // ── CONMEBOL (South America)
  Brazil: "🇧🇷",
  Argentina: "🇦🇷",
  Uruguay: "🇺🇾",
  Colombia: "🇨🇴",
  Chile: "🇨🇱",
  Peru: "🇵🇪",
  Ecuador: "🇪🇨",
  Paraguay: "🇵🇾",
  Bolivia: "🇧🇴",
  Venezuela: "🇻🇪",

  // ── CONCACAF (North/Central America + Caribbean)
  "Costa Rica": "🇨🇷",
  Panama: "🇵🇦",
  Jamaica: "🇯🇲",
  Honduras: "🇭🇳",
  "Trinidad and Tobago": "🇹🇹",
  "El Salvador": "🇸🇻",
  Guatemala: "🇬🇹",
  Curacao: "🇨🇼",
  "Curaçao": "🇨🇼",
  Suriname: "🇸🇷",
  Haiti: "🇭🇹",

  // ── CAF (Africa)
  Morocco: "🇲🇦",
  Senegal: "🇸🇳",
  Egypt: "🇪🇬",
  Algeria: "🇩🇿",
  Tunisia: "🇹🇳",
  Nigeria: "🇳🇬",
  Ghana: "🇬🇭",
  "Ivory Coast": "🇨🇮",
  "Cote d'Ivoire": "🇨🇮",
  "Côte d'Ivoire": "🇨🇮",
  Cameroon: "🇨🇲",
  "South Africa": "🇿🇦",
  "Cape Verde": "🇨🇻",
  "Cape Verde Islands": "🇨🇻",
  Mali: "🇲🇱",
  "DR Congo": "🇨🇩",
  "Congo DR": "🇨🇩",
  Gabon: "🇬🇦",
  Burkina: "🇧🇫",
  "Burkina Faso": "🇧🇫",
  Kenya: "🇰🇪",
  Zambia: "🇿🇲",
  Angola: "🇦🇴",

  // ── AFC (Asia)
  Japan: "🇯🇵",
  "South Korea": "🇰🇷",
  "Korea Republic": "🇰🇷",
  Australia: "🇦🇺",
  Iran: "🇮🇷",
  "IR Iran": "🇮🇷",
  "Saudi Arabia": "🇸🇦",
  Qatar: "🇶🇦",
  Uzbekistan: "🇺🇿",
  Jordan: "🇯🇴",
  Iraq: "🇮🇶",
  UAE: "🇦🇪",
  "United Arab Emirates": "🇦🇪",
  Indonesia: "🇮🇩",

  // ── OFC (Oceania)
  "New Zealand": "🇳🇿",

  // ── Common alternates
  Russia: "🇷🇺",
  Israel: "🇮🇱",
};

/**
 * Look up a flag emoji for an AF team name. Returns null when there's no
 * match — callers should fall back to the AF logo URL.
 */
export function flagForTeam(name: string | null | undefined): string | null {
  if (!name) return null;
  const direct = WC_FLAGS[name];
  if (direct) return direct;

  // Case-insensitive fallback — AF occasionally casing-drifts.
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(WC_FLAGS)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}
