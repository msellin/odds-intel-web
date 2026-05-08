const countryFlags: Record<string, string> = {
  England: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67\uDB40\uDC7F",
  Scotland: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74\uDB40\uDC7F",
  Spain: "\uD83C\uDDEA\uD83C\uDDF8",
  Italy: "\uD83C\uDDEE\uD83C\uDDF9",
  Germany: "\uD83C\uDDE9\uD83C\uDDEA",
  France: "\uD83C\uDDEB\uD83C\uDDF7",
  Turkey: "\uD83C\uDDF9\uD83C\uDDF7",
  Sweden: "\uD83C\uDDF8\uD83C\uDDEA",
  Denmark: "\uD83C\uDDE9\uD83C\uDDF0",
  Estonia: "\uD83C\uDDEA\uD83C\uDDEA",
  Portugal: "\uD83C\uDDF5\uD83C\uDDF9",
  Netherlands: "\uD83C\uDDF3\uD83C\uDDF1",
  Norway: "\uD83C\uDDF3\uD83C\uDDF4",
  Finland: "\uD83C\uDDEB\uD83C\uDDEE",
  Brazil: "\uD83C\uDDE7\uD83C\uDDF7",
  Japan: "\uD83C\uDDEF\uD83C\uDDF5",
  Belgium: "\uD83C\uDDE7\uD83C\uDDEA",
  Austria: "\uD83C\uDDE6\uD83C\uDDF9",
  Switzerland: "\uD83C\uDDE8\uD83C\uDDED",
  Greece: "\uD83C\uDDEC\uD83C\uDDF7",
  Poland: "\uD83C\uDDF5\uD83C\uDDF1",
  Croatia: "\uD83C\uDDED\uD83C\uDDF7",
  Serbia: "\uD83C\uDDF7\uD83C\uDDF8",
  Romania: "\uD83C\uDDF7\uD83C\uDDF4",
  Ukraine: "\uD83C\uDDFA\uD83C\uDDE6",
  Russia: "\uD83C\uDDF7\uD83C\uDDFA",
  Argentina: "\uD83C\uDDE6\uD83C\uDDF7",
  Mexico: "\uD83C\uDDF2\uD83C\uDDFD",
  USA: "\uD83C\uDDFA\uD83C\uDDF8",
  Australia: "\uD83C\uDDE6\uD83C\uDDFA",
  "South Korea": "\uD83C\uDDF0\uD83C\uDDF7",
  China: "\uD83C\uDDE8\uD83C\uDDF3",
  "Czech Republic": "\uD83C\uDDE8\uD83C\uDDFF",
  Hungary: "\uD83C\uDDED\uD83C\uDDFA",
  Iceland: "\uD83C\uDDEE\uD83C\uDDF8",
  Ireland: "\uD83C\uDDEE\uD83C\uDDEA",
  Wales: "\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73\uDB40\uDC7F",
  Europe: "\uD83C\uDDEA\uD83C\uDDFA",
};

/**
 * Get a flag emoji for a country name.
 * Extracts the country from a league path like "England / Premier League".
 */
export function getCountryFlag(leaguePath: string): string {
  const country = leaguePath.split(" / ")[0].trim();
  return countryFlags[country] ?? "\u26BD";
}

