import type {
  League,
  Match,
  MatchDetail,
  ValueBet,
  HistoricalBet,
  TrackRecordStats,
} from "./types";

// ─── LEAGUES ───────────────────────────────────────────────────────────────

export const leagues: League[] = [
  { id: "pl", name: "Premier League", country: "England", tier: 1, flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "ll", name: "La Liga", country: "Spain", tier: 1, flag: "🇪🇸" },
  { id: "bl", name: "Bundesliga", country: "Germany", tier: 1, flag: "🇩🇪" },
  { id: "sa", name: "Serie A", country: "Italy", tier: 1, flag: "🇮🇹" },
  { id: "ch", name: "Championship", country: "England", tier: 2, flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "l1", name: "Ligue 1", country: "France", tier: 1, flag: "🇫🇷" },
  { id: "sb", name: "Serie B", country: "Italy", tier: 2, flag: "🇮🇹" },
  { id: "b2", name: "2. Bundesliga", country: "Germany", tier: 2, flag: "🇩🇪" },
];

// ─── TODAY'S MATCHES ───────────────────────────────────────────────────────

export const todayMatches: Match[] = [
  // Premier League
  {
    id: "m1",
    date: "2026-04-26",
    kickoff: "15:00",
    homeTeam: { id: "ars", name: "Arsenal", shortName: "ARS", leagueId: "pl" },
    awayTeam: { id: "bri", name: "Brighton & Hove Albion", shortName: "BHA", leagueId: "pl" },
    league: leagues[0],
    status: "upcoming",
    hasDetailedData: true,
  },
  {
    id: "m2",
    date: "2026-04-26",
    kickoff: "15:00",
    homeTeam: { id: "mci", name: "Manchester City", shortName: "MCI", leagueId: "pl" },
    awayTeam: { id: "whu", name: "West Ham United", shortName: "WHU", leagueId: "pl" },
    league: leagues[0],
    status: "upcoming",
    hasDetailedData: true,
  },
  {
    id: "m3",
    date: "2026-04-26",
    kickoff: "17:30",
    homeTeam: { id: "liv", name: "Liverpool", shortName: "LIV", leagueId: "pl" },
    awayTeam: { id: "tot", name: "Tottenham Hotspur", shortName: "TOT", leagueId: "pl" },
    league: leagues[0],
    status: "upcoming",
    hasDetailedData: true,
  },
  {
    id: "m4",
    date: "2026-04-26",
    kickoff: "15:00",
    homeTeam: { id: "avl", name: "Aston Villa", shortName: "AVL", leagueId: "pl" },
    awayTeam: { id: "ful", name: "Fulham", shortName: "FUL", leagueId: "pl" },
    league: leagues[0],
    status: "upcoming",
    hasDetailedData: false,
  },
  // La Liga
  {
    id: "m5",
    date: "2026-04-26",
    kickoff: "16:15",
    homeTeam: { id: "rma", name: "Real Madrid", shortName: "RMA", leagueId: "ll" },
    awayTeam: { id: "atm", name: "Atlético Madrid", shortName: "ATM", leagueId: "ll" },
    league: leagues[1],
    status: "upcoming",
    hasDetailedData: true,
  },
  {
    id: "m6",
    date: "2026-04-26",
    kickoff: "18:30",
    homeTeam: { id: "bar", name: "Barcelona", shortName: "BAR", leagueId: "ll" },
    awayTeam: { id: "rsoc", name: "Real Sociedad", shortName: "RSO", leagueId: "ll" },
    league: leagues[1],
    status: "upcoming",
    hasDetailedData: false,
  },
  {
    id: "m7",
    date: "2026-04-26",
    kickoff: "14:00",
    homeTeam: { id: "sev", name: "Sevilla", shortName: "SEV", leagueId: "ll" },
    awayTeam: { id: "bet", name: "Real Betis", shortName: "BET", leagueId: "ll" },
    league: leagues[1],
    status: "upcoming",
    hasDetailedData: false,
  },
  // Bundesliga
  {
    id: "m8",
    date: "2026-04-26",
    kickoff: "15:30",
    homeTeam: { id: "bay", name: "Bayern Munich", shortName: "BAY", leagueId: "bl" },
    awayTeam: { id: "bvb", name: "Borussia Dortmund", shortName: "BVB", leagueId: "bl" },
    league: leagues[2],
    status: "upcoming",
    hasDetailedData: false,
  },
  {
    id: "m9",
    date: "2026-04-26",
    kickoff: "15:30",
    homeTeam: { id: "lev", name: "Bayer Leverkusen", shortName: "LEV", leagueId: "bl" },
    awayTeam: { id: "rbk", name: "RB Leipzig", shortName: "RBL", leagueId: "bl" },
    league: leagues[2],
    status: "upcoming",
    hasDetailedData: false,
  },
  {
    id: "m10",
    date: "2026-04-26",
    kickoff: "18:30",
    homeTeam: { id: "fra", name: "Eintracht Frankfurt", shortName: "FRA", leagueId: "bl" },
    awayTeam: { id: "wob", name: "VfL Wolfsburg", shortName: "WOB", leagueId: "bl" },
    league: leagues[2],
    status: "upcoming",
    hasDetailedData: false,
  },
  // Serie A
  {
    id: "m11",
    date: "2026-04-26",
    kickoff: "15:00",
    homeTeam: { id: "int", name: "Inter Milan", shortName: "INT", leagueId: "sa" },
    awayTeam: { id: "nap", name: "Napoli", shortName: "NAP", leagueId: "sa" },
    league: leagues[3],
    status: "upcoming",
    hasDetailedData: false,
  },
  {
    id: "m12",
    date: "2026-04-26",
    kickoff: "18:00",
    homeTeam: { id: "juv", name: "Juventus", shortName: "JUV", leagueId: "sa" },
    awayTeam: { id: "mil", name: "AC Milan", shortName: "MIL", leagueId: "sa" },
    league: leagues[3],
    status: "upcoming",
    hasDetailedData: false,
  },
  {
    id: "m13",
    date: "2026-04-26",
    kickoff: "20:45",
    homeTeam: { id: "rom", name: "AS Roma", shortName: "ROM", leagueId: "sa" },
    awayTeam: { id: "ata", name: "Atalanta", shortName: "ATA", leagueId: "sa" },
    league: leagues[3],
    status: "upcoming",
    hasDetailedData: false,
  },
  // Championship
  {
    id: "m14",
    date: "2026-04-26",
    kickoff: "12:30",
    homeTeam: { id: "lee", name: "Leeds United", shortName: "LEE", leagueId: "ch" },
    awayTeam: { id: "shfu", name: "Sheffield United", shortName: "SHU", leagueId: "ch" },
    league: leagues[4],
    status: "upcoming",
    hasDetailedData: false,
  },
  {
    id: "m15",
    date: "2026-04-26",
    kickoff: "15:00",
    homeTeam: { id: "bur", name: "Burnley", shortName: "BUR", leagueId: "ch" },
    awayTeam: { id: "nor", name: "Norwich City", shortName: "NOR", leagueId: "ch" },
    league: leagues[4],
    status: "upcoming",
    hasDetailedData: false,
  },
  {
    id: "m16",
    date: "2026-04-26",
    kickoff: "15:00",
    homeTeam: { id: "sun", name: "Sunderland", shortName: "SUN", leagueId: "ch" },
    awayTeam: { id: "mid", name: "Middlesbrough", shortName: "MID", leagueId: "ch" },
    league: leagues[4],
    status: "upcoming",
    hasDetailedData: false,
  },
  // Ligue 1
  {
    id: "m17",
    date: "2026-04-26",
    kickoff: "21:00",
    homeTeam: { id: "psg", name: "Paris Saint-Germain", shortName: "PSG", leagueId: "l1" },
    awayTeam: { id: "lyo", name: "Olympique Lyonnais", shortName: "OL", leagueId: "l1" },
    league: leagues[5],
    status: "upcoming",
    hasDetailedData: false,
  },
];

// ─── DETAILED MATCH DATA ───────────────────────────────────────────────────

export const matchDetails: Record<string, MatchDetail> = {
  m1: {
    match: todayMatches[0],
    stats: {
      homeForm: {
        results: [
          { opponent: "Chelsea", home: true, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 2.34, xga: 0.67, date: "2026-04-19" },
          { opponent: "Newcastle", home: false, goalsFor: 1, goalsAgainst: 1, result: "D", xg: 1.45, xga: 1.12, date: "2026-04-12" },
          { opponent: "Wolves", home: true, goalsFor: 3, goalsAgainst: 1, result: "W", xg: 2.87, xga: 0.89, date: "2026-04-05" },
          { opponent: "Everton", home: false, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 1.98, xga: 0.54, date: "2026-03-29" },
          { opponent: "Crystal Palace", home: true, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.67, xga: 0.78, date: "2026-03-22" },
          { opponent: "Bournemouth", home: false, goalsFor: 0, goalsAgainst: 1, result: "L", xg: 1.23, xga: 0.95, date: "2026-03-15" },
          { opponent: "Man United", home: true, goalsFor: 3, goalsAgainst: 2, result: "W", xg: 2.56, xga: 1.34, date: "2026-03-08" },
          { opponent: "Nottm Forest", home: false, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.89, xga: 0.45, date: "2026-03-01" },
          { opponent: "Brentford", home: true, goalsFor: 2, goalsAgainst: 1, result: "W", xg: 2.11, xga: 1.02, date: "2026-02-22" },
          { opponent: "Leicester", home: false, goalsFor: 4, goalsAgainst: 1, result: "W", xg: 3.12, xga: 0.76, date: "2026-02-15" },
        ],
      },
      awayForm: {
        results: [
          { opponent: "Everton", home: true, goalsFor: 2, goalsAgainst: 2, result: "D", xg: 1.87, xga: 1.34, date: "2026-04-19" },
          { opponent: "Wolves", home: false, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.56, xga: 0.89, date: "2026-04-12" },
          { opponent: "Bournemouth", home: true, goalsFor: 3, goalsAgainst: 1, result: "W", xg: 2.45, xga: 0.78, date: "2026-04-05" },
          { opponent: "Liverpool", home: false, goalsFor: 0, goalsAgainst: 2, result: "L", xg: 0.78, xga: 2.15, date: "2026-03-29" },
          { opponent: "Crystal Palace", home: true, goalsFor: 1, goalsAgainst: 1, result: "D", xg: 1.34, xga: 1.12, date: "2026-03-22" },
          { opponent: "Ipswich", home: false, goalsFor: 2, goalsAgainst: 1, result: "W", xg: 1.89, xga: 0.67, date: "2026-03-15" },
          { opponent: "West Ham", home: true, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.45, xga: 0.56, date: "2026-03-08" },
          { opponent: "Man City", home: false, goalsFor: 1, goalsAgainst: 3, result: "L", xg: 0.98, xga: 2.67, date: "2026-03-01" },
          { opponent: "Fulham", home: true, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 2.12, xga: 0.45, date: "2026-02-22" },
          { opponent: "Southampton", home: false, goalsFor: 3, goalsAgainst: 2, result: "W", xg: 2.34, xga: 1.56, date: "2026-02-15" },
        ],
      },
      headToHead: {
        matches: [
          { date: "2025-11-23", homeTeam: "Brighton", awayTeam: "Arsenal", scoreHome: 1, scoreAway: 2, competition: "Premier League" },
          { date: "2025-04-06", homeTeam: "Arsenal", awayTeam: "Brighton", scoreHome: 3, scoreAway: 0, competition: "Premier League" },
          { date: "2024-12-21", homeTeam: "Brighton", awayTeam: "Arsenal", scoreHome: 0, scoreAway: 0, competition: "Premier League" },
          { date: "2024-04-17", homeTeam: "Arsenal", awayTeam: "Brighton", scoreHome: 2, scoreAway: 0, competition: "Premier League" },
          { date: "2023-10-21", homeTeam: "Brighton", awayTeam: "Arsenal", scoreHome: 0, scoreAway: 1, competition: "Premier League" },
        ],
      },
      homeXg: 2.12,
      awayXg: 1.48,
      homeHomeSplits: { w: 10, d: 2, l: 1, gf: 28, ga: 8 },
      awayAwaySplits: { w: 5, d: 3, l: 5, gf: 16, ga: 18 },
    },
    odds: [
      { bookmaker: "Pinnacle", market: "1X2", homeOdds: 1.52, drawOdds: 4.45, awayOdds: 6.10, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Bet365", market: "1X2", homeOdds: 1.50, drawOdds: 4.50, awayOdds: 6.50, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Unibet", market: "1X2", homeOdds: 1.48, drawOdds: 4.60, awayOdds: 6.25, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "1xBet", market: "1X2", homeOdds: 1.55, drawOdds: 4.40, awayOdds: 6.00, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Betfair", market: "1X2", homeOdds: 1.54, drawOdds: 4.50, awayOdds: 6.20, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Pinnacle", market: "O/U 2.5", homeOdds: 1.52, drawOdds: 0, awayOdds: 2.62, overOdds: 1.75, underOdds: 2.15, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Bet365", market: "O/U 2.5", homeOdds: 1.52, drawOdds: 0, awayOdds: 2.62, overOdds: 1.73, underOdds: 2.10, timestamp: "2026-04-26T08:00:00Z" },
    ],
    oddsMovement: [
      { timestamp: "2026-04-23T10:00:00Z", homeOdds: 1.58, drawOdds: 4.20, awayOdds: 5.80 },
      { timestamp: "2026-04-23T18:00:00Z", homeOdds: 1.57, drawOdds: 4.25, awayOdds: 5.85 },
      { timestamp: "2026-04-24T08:00:00Z", homeOdds: 1.55, drawOdds: 4.30, awayOdds: 5.95 },
      { timestamp: "2026-04-24T16:00:00Z", homeOdds: 1.55, drawOdds: 4.35, awayOdds: 6.00 },
      { timestamp: "2026-04-25T08:00:00Z", homeOdds: 1.53, drawOdds: 4.40, awayOdds: 6.05 },
      { timestamp: "2026-04-25T14:00:00Z", homeOdds: 1.52, drawOdds: 4.45, awayOdds: 6.10 },
      { timestamp: "2026-04-25T20:00:00Z", homeOdds: 1.50, drawOdds: 4.50, awayOdds: 6.15 },
      { timestamp: "2026-04-26T08:00:00Z", homeOdds: 1.52, drawOdds: 4.45, awayOdds: 6.10 },
    ],
    injuries: [
      { player: "Bukayo Saka", team: "Arsenal", injuryType: "Hamstring tightness", expectedReturn: "Doubtful for Saturday", status: "doubtful", matchesMissed: 0 },
      { player: "Takehiro Tomiyasu", team: "Arsenal", injuryType: "Knee ligament", expectedReturn: "May 2026", status: "out", matchesMissed: 8 },
      { player: "Solly March", team: "Brighton", injuryType: "ACL recovery", expectedReturn: "May 2026", status: "out", matchesMissed: 14 },
      { player: "James Milner", team: "Brighton", injuryType: "Calf strain", expectedReturn: "Questionable", status: "questionable", matchesMissed: 1 },
    ],
    homeLineup: {
      formation: "4-3-3",
      starters: [
        { name: "D. Raya", position: "GK", number: 22 },
        { name: "B. White", position: "RB", number: 4 },
        { name: "W. Saliba", position: "CB", number: 12 },
        { name: "G. Magalhães", position: "CB", number: 6 },
        { name: "J. Timber", position: "LB", number: 12 },
        { name: "M. Ødegaard", position: "CM", number: 8, isCaptain: true },
        { name: "D. Rice", position: "CM", number: 41 },
        { name: "M. Merino", position: "CM", number: 23 },
        { name: "L. Trossard", position: "RW", number: 19 },
        { name: "K. Havertz", position: "ST", number: 29 },
        { name: "G. Martinelli", position: "LW", number: 11 },
      ],
      subs: [
        { name: "N. Ramsdale", position: "GK", number: 1 },
        { name: "R. Sterling", position: "FW", number: 7 },
        { name: "J. Kiwior", position: "CB", number: 15 },
        { name: "E. Nketiah", position: "FW", number: 14 },
        { name: "F. Onyeka", position: "CM", number: 21 },
      ],
    },
    awayLineup: {
      formation: "4-2-3-1",
      starters: [
        { name: "B. Verbruggen", position: "GK", number: 1 },
        { name: "J. Veltman", position: "RB", number: 34 },
        { name: "L. Dunk", position: "CB", number: 5, isCaptain: true },
        { name: "J. van Hecke", position: "CB", number: 29 },
        { name: "P. Estupiñán", position: "LB", number: 30 },
        { name: "C. Baleba", position: "CM", number: 45 },
        { name: "J. Gilmour", position: "CM", number: 14 },
        { name: "S. Adingra", position: "RW", number: 7 },
        { name: "J. Pedro", position: "CAM", number: 9 },
        { name: "K. Mitoma", position: "LW", number: 22 },
        { name: "D. Welbeck", position: "ST", number: 18 },
      ],
      subs: [
        { name: "T. Steele", position: "GK", number: 23 },
        { name: "E. Ferguson", position: "ST", number: 44 },
        { name: "T. Lamptey", position: "RB", number: 2 },
        { name: "A. Dahoud", position: "CM", number: 8 },
        { name: "A. Sarmiento", position: "FW", number: 20 },
      ],
    },
    weather: {
      tempC: 14,
      windKmh: 18,
      windDirection: "SW",
      rainMm: 0.2,
      humidity: 72,
      condition: "Partly cloudy",
    },
    referee: {
      name: "Michael Oliver",
      yellowsPerGame: 3.8,
      redsPerGame: 0.12,
      pensPerGame: 0.28,
      foulsPerGame: 22.4,
      matchesThisSeason: 25,
    },
    predictions: [
      {
        market: "1X2",
        selection: "Arsenal Win",
        modelProbability: 0.72,
        impliedProbability: 0.658,
        edgePercent: 6.2,
        confidence: "high",
        reasoning: "Arsenal's home form is exceptional (W10-D2-L1, 28GF/8GA). xG per game at the Emirates averages 2.12, well above their season average. Brighton's away record is mediocre (W5-D3-L5) and they've lost to every top-6 side away this season. Saka is doubtful but Trossard has been in excellent form as a replacement (3G/2A in last 5). The H2H heavily favors Arsenal at home (W4-D1 in last 5 at Emirates). Model sees this as a 72% Arsenal win probability vs the market's 65.8% implied — 6.2% edge on 1xBet at 1.55.",
        currentOdds: 1.55,
        bookmaker: "1xBet",
      },
      {
        market: "Over/Under 2.5",
        selection: "Over 2.5 Goals",
        modelProbability: 0.64,
        impliedProbability: 0.571,
        edgePercent: 6.9,
        confidence: "high",
        reasoning: "Arsenal average 2.15 goals at home this season. Their last 8 home games: 7 went Over 2.5 (87.5%). Combined xG projection for this match: 3.6 goals. Brighton concede on average 1.38 away from home, and Arsenal's attacking depth (even without Saka) creates numerous chance scenarios. Historical H2H: 4 of last 5 meetings at the Emirates produced 3+ goals. Weather conditions are neutral. Over 2.5 at 1.75 offers genuine value.",
        currentOdds: 1.75,
        bookmaker: "Pinnacle",
      },
      {
        market: "BTTS",
        selection: "Yes",
        modelProbability: 0.52,
        impliedProbability: 0.54,
        edgePercent: -2.0,
        confidence: "low",
        reasoning: "Model sees BTTS as slightly underpriced. Brighton have scored in 8/13 away games this season, but Arsenal's defensive record at home (8 GA in 13 games) suppresses the probability. No value detected.",
        currentOdds: 1.85,
        bookmaker: "Bet365",
      },
    ],
    fixtureCongest: {
      homeDaysSinceLast: 7,
      awayDaysSinceLast: 7,
      homeMatchesIn14Days: 2,
      awayMatchesIn14Days: 3,
    },
  },
  m3: {
    match: todayMatches[2],
    stats: {
      homeForm: {
        results: [
          { opponent: "Man United", home: true, goalsFor: 3, goalsAgainst: 0, result: "W", xg: 2.78, xga: 0.45, date: "2026-04-19" },
          { opponent: "Everton", home: false, goalsFor: 2, goalsAgainst: 1, result: "W", xg: 2.12, xga: 0.89, date: "2026-04-12" },
          { opponent: "Newcastle", home: true, goalsFor: 1, goalsAgainst: 1, result: "D", xg: 1.67, xga: 1.34, date: "2026-04-05" },
          { opponent: "Crystal Palace", home: false, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 1.89, xga: 0.56, date: "2026-03-29" },
          { opponent: "Chelsea", home: true, goalsFor: 4, goalsAgainst: 1, result: "W", xg: 3.45, xga: 0.98, date: "2026-03-22" },
          { opponent: "Brighton", home: true, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 2.15, xga: 0.78, date: "2026-03-15" },
          { opponent: "Bournemouth", home: false, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.34, xga: 0.67, date: "2026-03-08" },
          { opponent: "Wolves", home: true, goalsFor: 3, goalsAgainst: 0, result: "W", xg: 2.89, xga: 0.34, date: "2026-03-01" },
          { opponent: "Ipswich", home: false, goalsFor: 2, goalsAgainst: 2, result: "D", xg: 2.34, xga: 1.12, date: "2026-02-22" },
          { opponent: "Brentford", home: true, goalsFor: 3, goalsAgainst: 1, result: "W", xg: 2.56, xga: 0.89, date: "2026-02-15" },
        ],
      },
      awayForm: {
        results: [
          { opponent: "Brentford", home: true, goalsFor: 3, goalsAgainst: 2, result: "W", xg: 2.34, xga: 1.56, date: "2026-04-19" },
          { opponent: "Crystal Palace", home: false, goalsFor: 1, goalsAgainst: 2, result: "L", xg: 1.12, xga: 1.89, date: "2026-04-12" },
          { opponent: "Chelsea", home: true, goalsFor: 2, goalsAgainst: 2, result: "D", xg: 1.78, xga: 1.67, date: "2026-04-05" },
          { opponent: "Man City", home: false, goalsFor: 1, goalsAgainst: 3, result: "L", xg: 0.89, xga: 2.45, date: "2026-03-29" },
          { opponent: "Fulham", home: true, goalsFor: 2, goalsAgainst: 1, result: "W", xg: 1.67, xga: 0.89, date: "2026-03-22" },
          { opponent: "Nottm Forest", home: false, goalsFor: 0, goalsAgainst: 1, result: "L", xg: 0.78, xga: 1.23, date: "2026-03-15" },
          { opponent: "Southampton", home: true, goalsFor: 4, goalsAgainst: 0, result: "W", xg: 3.12, xga: 0.45, date: "2026-03-08" },
          { opponent: "Wolves", home: false, goalsFor: 2, goalsAgainst: 1, result: "W", xg: 1.56, xga: 0.98, date: "2026-03-01" },
          { opponent: "Aston Villa", home: true, goalsFor: 1, goalsAgainst: 1, result: "D", xg: 1.34, xga: 1.45, date: "2026-02-22" },
          { opponent: "Everton", home: false, goalsFor: 3, goalsAgainst: 1, result: "W", xg: 2.45, xga: 0.78, date: "2026-02-15" },
        ],
      },
      headToHead: {
        matches: [
          { date: "2025-12-22", homeTeam: "Tottenham", awayTeam: "Liverpool", scoreHome: 1, scoreAway: 3, competition: "Premier League" },
          { date: "2025-05-11", homeTeam: "Liverpool", awayTeam: "Tottenham", scoreHome: 2, scoreAway: 0, competition: "Premier League" },
          { date: "2024-11-10", homeTeam: "Tottenham", awayTeam: "Liverpool", scoreHome: 1, scoreAway: 1, competition: "Premier League" },
          { date: "2024-05-05", homeTeam: "Liverpool", awayTeam: "Tottenham", scoreHome: 4, scoreAway: 2, competition: "Premier League" },
          { date: "2023-09-30", homeTeam: "Tottenham", awayTeam: "Liverpool", scoreHome: 2, scoreAway: 1, competition: "Premier League" },
        ],
      },
      homeXg: 2.42,
      awayXg: 1.52,
      homeHomeSplits: { w: 11, d: 1, l: 1, gf: 32, ga: 6 },
      awayAwaySplits: { w: 4, d: 2, l: 7, gf: 14, ga: 22 },
    },
    odds: [
      { bookmaker: "Pinnacle", market: "1X2", homeOdds: 1.40, drawOdds: 5.00, awayOdds: 7.50, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Bet365", market: "1X2", homeOdds: 1.36, drawOdds: 5.25, awayOdds: 8.00, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Unibet", market: "1X2", homeOdds: 1.38, drawOdds: 5.10, awayOdds: 7.75, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "1xBet", market: "1X2", homeOdds: 1.42, drawOdds: 4.90, awayOdds: 7.20, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Betfair", market: "1X2", homeOdds: 1.41, drawOdds: 5.00, awayOdds: 7.40, timestamp: "2026-04-26T08:00:00Z" },
    ],
    oddsMovement: [
      { timestamp: "2026-04-23T10:00:00Z", homeOdds: 1.45, drawOdds: 4.80, awayOdds: 7.00 },
      { timestamp: "2026-04-23T18:00:00Z", homeOdds: 1.44, drawOdds: 4.85, awayOdds: 7.10 },
      { timestamp: "2026-04-24T08:00:00Z", homeOdds: 1.43, drawOdds: 4.90, awayOdds: 7.20 },
      { timestamp: "2026-04-24T16:00:00Z", homeOdds: 1.42, drawOdds: 4.95, awayOdds: 7.30 },
      { timestamp: "2026-04-25T08:00:00Z", homeOdds: 1.41, drawOdds: 5.00, awayOdds: 7.40 },
      { timestamp: "2026-04-25T14:00:00Z", homeOdds: 1.40, drawOdds: 5.00, awayOdds: 7.50 },
      { timestamp: "2026-04-25T20:00:00Z", homeOdds: 1.40, drawOdds: 5.00, awayOdds: 7.50 },
      { timestamp: "2026-04-26T08:00:00Z", homeOdds: 1.40, drawOdds: 5.00, awayOdds: 7.50 },
    ],
    injuries: [
      { player: "Diogo Jota", team: "Liverpool", injuryType: "Knee — meniscus", expectedReturn: "Season over", status: "out", matchesMissed: 12 },
      { player: "Richarlison", team: "Tottenham", injuryType: "Groin strain", expectedReturn: "Doubtful", status: "doubtful", matchesMissed: 2 },
      { player: "Micky van de Ven", team: "Tottenham", injuryType: "Hamstring", expectedReturn: "Out 2-3 weeks", status: "out", matchesMissed: 3 },
    ],
    homeLineup: {
      formation: "4-3-3",
      starters: [
        { name: "Alisson", position: "GK", number: 1 },
        { name: "T. Alexander-Arnold", position: "RB", number: 66 },
        { name: "V. van Dijk", position: "CB", number: 4, isCaptain: true },
        { name: "I. Konaté", position: "CB", number: 5 },
        { name: "A. Robertson", position: "LB", number: 26 },
        { name: "A. Mac Allister", position: "CM", number: 10 },
        { name: "R. Gravenberch", position: "CM", number: 38 },
        { name: "D. Szoboszlai", position: "CM", number: 8 },
        { name: "M. Salah", position: "RW", number: 11 },
        { name: "D. Núñez", position: "ST", number: 9 },
        { name: "L. Díaz", position: "LW", number: 7 },
      ],
      subs: [
        { name: "C. Kelleher", position: "GK", number: 62 },
        { name: "C. Gakpo", position: "FW", number: 18 },
        { name: "W. Endo", position: "CM", number: 3 },
        { name: "J. Quansah", position: "CB", number: 78 },
        { name: "C. Jones", position: "CM", number: 17 },
      ],
    },
    awayLineup: {
      formation: "4-3-3",
      starters: [
        { name: "G. Vicario", position: "GK", number: 1 },
        { name: "P. Porro", position: "RB", number: 23 },
        { name: "C. Romero", position: "CB", number: 17, isCaptain: true },
        { name: "R. Drăgușin", position: "CB", number: 6 },
        { name: "D. Udogie", position: "LB", number: 13 },
        { name: "Y. Bissouma", position: "CM", number: 38 },
        { name: "R. Bentancur", position: "CM", number: 30 },
        { name: "J. Maddison", position: "CAM", number: 10 },
        { name: "D. Kulusevski", position: "RW", number: 21 },
        { name: "Son Heung-min", position: "ST", number: 7 },
        { name: "B. Johnson", position: "LW", number: 22 },
      ],
      subs: [
        { name: "F. Forster", position: "GK", number: 20 },
        { name: "T. Werner", position: "FW", number: 16 },
        { name: "O. Skipp", position: "CM", number: 4 },
        { name: "A. Gray", position: "FW", number: 14 },
        { name: "A. Spence", position: "RB", number: 12 },
      ],
    },
    weather: {
      tempC: 12,
      windKmh: 22,
      windDirection: "W",
      rainMm: 1.5,
      humidity: 78,
      condition: "Light rain",
    },
    referee: {
      name: "Anthony Taylor",
      yellowsPerGame: 4.2,
      redsPerGame: 0.15,
      pensPerGame: 0.32,
      foulsPerGame: 24.1,
      matchesThisSeason: 28,
    },
    predictions: [
      {
        market: "1X2",
        selection: "Liverpool Win",
        modelProbability: 0.68,
        impliedProbability: 0.714,
        edgePercent: -3.4,
        confidence: "low",
        reasoning: "Liverpool are rightful favorites at Anfield (W11-D1-L1 at home) but the odds are too short. At 1.40 (Pinnacle), the market implies a 71.4% win probability, while our model sees 68%. No value on the home win. Spurs' away form is poor (W4-D2-L7) but the price doesn't compensate enough for the risk.",
        currentOdds: 1.40,
        bookmaker: "Pinnacle",
      },
      {
        market: "Over/Under 2.5",
        selection: "Over 2.5 Goals",
        modelProbability: 0.71,
        impliedProbability: 0.625,
        edgePercent: 8.5,
        confidence: "high",
        reasoning: "This is the play. Liverpool vs Spurs averages 3.4 goals per match in the last 5 meetings. Liverpool's home xG is 2.42/game. Spurs create chances even away — they rarely shut up shop under Postecoglou. Combined xG projection: 3.94 goals. Van de Ven's absence weakens Spurs' high line, exposing them to counters from Salah and Díaz. Over 2.5 at 1.60 is well below fair value.",
        currentOdds: 1.60,
        bookmaker: "1xBet",
      },
    ],
    fixtureCongest: {
      homeDaysSinceLast: 7,
      awayDaysSinceLast: 7,
      homeMatchesIn14Days: 2,
      awayMatchesIn14Days: 2,
    },
  },
  m5: {
    match: todayMatches[4],
    stats: {
      homeForm: {
        results: [
          { opponent: "Getafe", home: true, goalsFor: 3, goalsAgainst: 0, result: "W", xg: 2.45, xga: 0.34, date: "2026-04-19" },
          { opponent: "Villarreal", home: false, goalsFor: 2, goalsAgainst: 2, result: "D", xg: 1.89, xga: 1.56, date: "2026-04-12" },
          { opponent: "Celta Vigo", home: true, goalsFor: 4, goalsAgainst: 1, result: "W", xg: 3.12, xga: 0.67, date: "2026-04-05" },
          { opponent: "Valencia", home: false, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.56, xga: 0.89, date: "2026-03-29" },
          { opponent: "Athletic Bilbao", home: true, goalsFor: 2, goalsAgainst: 1, result: "W", xg: 2.34, xga: 1.12, date: "2026-03-22" },
          { opponent: "Girona", home: false, goalsFor: 3, goalsAgainst: 1, result: "W", xg: 2.67, xga: 0.78, date: "2026-03-15" },
          { opponent: "Osasuna", home: true, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 2.12, xga: 0.45, date: "2026-03-08" },
          { opponent: "Real Sociedad", home: false, goalsFor: 1, goalsAgainst: 1, result: "D", xg: 1.34, xga: 1.23, date: "2026-03-01" },
          { opponent: "Rayo Vallecano", home: true, goalsFor: 3, goalsAgainst: 0, result: "W", xg: 2.89, xga: 0.34, date: "2026-02-22" },
          { opponent: "Mallorca", home: false, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 1.78, xga: 0.56, date: "2026-02-15" },
        ],
      },
      awayForm: {
        results: [
          { opponent: "Sevilla", home: true, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.23, xga: 0.78, date: "2026-04-19" },
          { opponent: "Girona", home: false, goalsFor: 0, goalsAgainst: 0, result: "D", xg: 0.67, xga: 0.89, date: "2026-04-12" },
          { opponent: "Osasuna", home: true, goalsFor: 2, goalsAgainst: 0, result: "W", xg: 1.56, xga: 0.45, date: "2026-04-05" },
          { opponent: "Valencia", home: false, goalsFor: 1, goalsAgainst: 1, result: "D", xg: 0.89, xga: 1.12, date: "2026-03-29" },
          { opponent: "Mallorca", home: true, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.34, xga: 0.34, date: "2026-03-22" },
          { opponent: "Getafe", home: false, goalsFor: 0, goalsAgainst: 1, result: "L", xg: 0.56, xga: 0.78, date: "2026-03-15" },
          { opponent: "Villarreal", home: true, goalsFor: 3, goalsAgainst: 1, result: "W", xg: 2.12, xga: 0.89, date: "2026-03-08" },
          { opponent: "Celta Vigo", home: false, goalsFor: 1, goalsAgainst: 0, result: "W", xg: 1.12, xga: 0.67, date: "2026-03-01" },
          { opponent: "Real Betis", home: true, goalsFor: 2, goalsAgainst: 1, result: "W", xg: 1.45, xga: 1.12, date: "2026-02-22" },
          { opponent: "Athletic Bilbao", home: false, goalsFor: 0, goalsAgainst: 2, result: "L", xg: 0.78, xga: 1.89, date: "2026-02-15" },
        ],
      },
      headToHead: {
        matches: [
          { date: "2025-12-08", homeTeam: "Atlético Madrid", awayTeam: "Real Madrid", scoreHome: 1, scoreAway: 1, competition: "La Liga" },
          { date: "2025-02-04", homeTeam: "Real Madrid", awayTeam: "Atlético Madrid", scoreHome: 1, scoreAway: 0, competition: "Copa del Rey" },
          { date: "2024-09-29", homeTeam: "Real Madrid", awayTeam: "Atlético Madrid", scoreHome: 1, scoreAway: 1, competition: "La Liga" },
          { date: "2024-03-21", homeTeam: "Atlético Madrid", awayTeam: "Real Madrid", scoreHome: 2, scoreAway: 1, competition: "La Liga" },
          { date: "2024-01-08", homeTeam: "Real Madrid", awayTeam: "Atlético Madrid", scoreHome: 5, scoreAway: 3, competition: "Copa del Rey" },
        ],
      },
      homeXg: 2.32,
      awayXg: 1.08,
      homeHomeSplits: { w: 12, d: 1, l: 0, gf: 35, ga: 5 },
      awayAwaySplits: { w: 4, d: 4, l: 5, gf: 10, ga: 15 },
    },
    odds: [
      { bookmaker: "Pinnacle", market: "1X2", homeOdds: 1.62, drawOdds: 3.90, awayOdds: 5.50, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Bet365", market: "1X2", homeOdds: 1.60, drawOdds: 4.00, awayOdds: 5.75, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Unibet", market: "1X2", homeOdds: 1.58, drawOdds: 4.10, awayOdds: 5.60, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "1xBet", market: "1X2", homeOdds: 1.65, drawOdds: 3.85, awayOdds: 5.40, timestamp: "2026-04-26T08:00:00Z" },
      { bookmaker: "Betfair", market: "1X2", homeOdds: 1.63, drawOdds: 3.95, awayOdds: 5.50, timestamp: "2026-04-26T08:00:00Z" },
    ],
    oddsMovement: [
      { timestamp: "2026-04-23T10:00:00Z", homeOdds: 1.70, drawOdds: 3.75, awayOdds: 5.20 },
      { timestamp: "2026-04-23T18:00:00Z", homeOdds: 1.68, drawOdds: 3.80, awayOdds: 5.30 },
      { timestamp: "2026-04-24T08:00:00Z", homeOdds: 1.66, drawOdds: 3.85, awayOdds: 5.35 },
      { timestamp: "2026-04-24T16:00:00Z", homeOdds: 1.65, drawOdds: 3.85, awayOdds: 5.40 },
      { timestamp: "2026-04-25T08:00:00Z", homeOdds: 1.63, drawOdds: 3.90, awayOdds: 5.45 },
      { timestamp: "2026-04-25T14:00:00Z", homeOdds: 1.62, drawOdds: 3.90, awayOdds: 5.50 },
      { timestamp: "2026-04-25T20:00:00Z", homeOdds: 1.62, drawOdds: 3.90, awayOdds: 5.50 },
      { timestamp: "2026-04-26T08:00:00Z", homeOdds: 1.62, drawOdds: 3.90, awayOdds: 5.50 },
    ],
    injuries: [
      { player: "Éder Militão", team: "Real Madrid", injuryType: "ACL — recovery", expectedReturn: "Season over", status: "out", matchesMissed: 22 },
      { player: "David Alaba", team: "Real Madrid", injuryType: "ACL — recovery", expectedReturn: "Season over", status: "out", matchesMissed: 30 },
      { player: "Thomas Lemar", team: "Atlético Madrid", injuryType: "Muscle fatigue", expectedReturn: "Doubtful", status: "doubtful", matchesMissed: 1 },
    ],
    homeLineup: {
      formation: "4-3-3",
      starters: [
        { name: "T. Courtois", position: "GK", number: 1 },
        { name: "Dani Carvajal", position: "RB", number: 2 },
        { name: "A. Rüdiger", position: "CB", number: 22 },
        { name: "Aurélien Tchouaméni", position: "CB", number: 18 },
        { name: "Ferland Mendy", position: "LB", number: 23 },
        { name: "L. Modrić", position: "CM", number: 10, isCaptain: true },
        { name: "E. Camavinga", position: "CM", number: 12 },
        { name: "Jude Bellingham", position: "CM", number: 5 },
        { name: "Rodrygo", position: "RW", number: 11 },
        { name: "K. Mbappé", position: "ST", number: 9 },
        { name: "Vinícius Jr.", position: "LW", number: 7 },
      ],
      subs: [
        { name: "A. Lunin", position: "GK", number: 13 },
        { name: "L. Vázquez", position: "RB", number: 17 },
        { name: "Arda Güler", position: "CM", number: 15 },
        { name: "Brahim Díaz", position: "FW", number: 21 },
        { name: "Dani Ceballos", position: "CM", number: 19 },
      ],
    },
    awayLineup: {
      formation: "5-3-2",
      starters: [
        { name: "J. Oblak", position: "GK", number: 13 },
        { name: "Nahuel Molina", position: "RWB", number: 16 },
        { name: "J. Giménez", position: "CB", number: 2 },
        { name: "Axel Witsel", position: "CB", number: 20 },
        { name: "R. Le Normand", position: "CB", number: 24 },
        { name: "J. Galán", position: "LWB", number: 3 },
        { name: "Koke", position: "CM", number: 6, isCaptain: true },
        { name: "R. de Paul", position: "CM", number: 5 },
        { name: "P. Barrios", position: "CM", number: 17 },
        { name: "A. Griezmann", position: "ST", number: 7 },
        { name: "Julián Álvarez", position: "ST", number: 9 },
      ],
      subs: [
        { name: "A. Moldovan", position: "GK", number: 1 },
        { name: "M. Llorente", position: "MF", number: 14 },
        { name: "A. Correa", position: "FW", number: 10 },
        { name: "Samuel Lino", position: "FW", number: 12 },
        { name: "C. Azpilicueta", position: "DF", number: 15 },
      ],
    },
    weather: {
      tempC: 22,
      windKmh: 8,
      windDirection: "N",
      rainMm: 0,
      humidity: 35,
      condition: "Clear skies",
    },
    referee: {
      name: "Jesús Gil Manzano",
      yellowsPerGame: 5.2,
      redsPerGame: 0.18,
      pensPerGame: 0.22,
      foulsPerGame: 26.8,
      matchesThisSeason: 22,
    },
    predictions: [
      {
        market: "1X2",
        selection: "Real Madrid Win",
        modelProbability: 0.58,
        impliedProbability: 0.617,
        edgePercent: -3.7,
        confidence: "low",
        reasoning: "Real Madrid at the Bernabéu are nearly unbeatable (W12-D1-L0) but Atlético's low-block 5-3-2 is specifically designed to frustrate them. The derby dynamic is different from normal fixtures — Atlético don't play like a typical away side here. No value on the home win at these odds.",
        currentOdds: 1.62,
        bookmaker: "Pinnacle",
      },
      {
        market: "Over/Under 2.5",
        selection: "Under 2.5 Goals",
        modelProbability: 0.58,
        impliedProbability: 0.48,
        edgePercent: 10.0,
        confidence: "high",
        reasoning: "Madrid derbies are tight, tactical affairs. Last 5 meetings: average 2.0 goals per game. Atlético's defensive structure (0.78 xGA/game away) will compress the game. Simeone's Atleti have kept 8 clean sheets in 13 away games. Gil Manzano referees slow, stop-start games (26.8 fouls/game). Under 2.5 at 2.08 is the strongest value play on this fixture. The market overweights Madrid's attacking talent and underweights the derby context.",
        currentOdds: 2.08,
        bookmaker: "Bet365",
      },
      {
        market: "1X2",
        selection: "Draw",
        modelProbability: 0.27,
        impliedProbability: 0.256,
        edgePercent: 1.4,
        confidence: "low",
        reasoning: "Slight value on the draw at 3.90 but not enough edge to recommend. 2 of the last 5 meetings ended in draws. Atlético's setup invites this result but model confidence is too low to flag.",
        currentOdds: 3.90,
        bookmaker: "Pinnacle",
      },
    ],
    fixtureCongest: {
      homeDaysSinceLast: 7,
      awayDaysSinceLast: 7,
      homeMatchesIn14Days: 3,
      awayMatchesIn14Days: 2,
    },
  },
};

// ─── VALUE BETS ────────────────────────────────────────────────────────────

export const valueBets: ValueBet[] = [
  {
    id: "vb1",
    matchId: "m5",
    homeTeam: "Real Madrid",
    awayTeam: "Atlético Madrid",
    league: "La Liga",
    kickoff: "16:15",
    market: "O/U 2.5",
    selection: "Under 2.5",
    modelProbability: 0.58,
    impliedProbability: 0.48,
    edgePercent: 10.0,
    currentOdds: 2.08,
    bookmaker: "Bet365",
    confidence: "high",
  },
  {
    id: "vb2",
    matchId: "m3",
    homeTeam: "Liverpool",
    awayTeam: "Tottenham",
    league: "Premier League",
    kickoff: "17:30",
    market: "O/U 2.5",
    selection: "Over 2.5",
    modelProbability: 0.71,
    impliedProbability: 0.625,
    edgePercent: 8.5,
    currentOdds: 1.60,
    bookmaker: "1xBet",
    confidence: "high",
  },
  {
    id: "vb3",
    matchId: "m1",
    homeTeam: "Arsenal",
    awayTeam: "Brighton",
    league: "Premier League",
    kickoff: "15:00",
    market: "O/U 2.5",
    selection: "Over 2.5",
    modelProbability: 0.64,
    impliedProbability: 0.571,
    edgePercent: 6.9,
    currentOdds: 1.75,
    bookmaker: "Pinnacle",
    confidence: "high",
  },
  {
    id: "vb4",
    matchId: "m1",
    homeTeam: "Arsenal",
    awayTeam: "Brighton",
    league: "Premier League",
    kickoff: "15:00",
    market: "1X2",
    selection: "Arsenal Win",
    modelProbability: 0.72,
    impliedProbability: 0.658,
    edgePercent: 6.2,
    currentOdds: 1.55,
    bookmaker: "1xBet",
    confidence: "high",
  },
  {
    id: "vb5",
    matchId: "m8",
    homeTeam: "Bayern Munich",
    awayTeam: "Borussia Dortmund",
    league: "Bundesliga",
    kickoff: "15:30",
    market: "O/U 2.5",
    selection: "Over 2.5",
    modelProbability: 0.72,
    impliedProbability: 0.667,
    edgePercent: 5.3,
    currentOdds: 1.50,
    bookmaker: "Pinnacle",
    confidence: "medium",
  },
  {
    id: "vb6",
    matchId: "m14",
    homeTeam: "Leeds United",
    awayTeam: "Sheffield United",
    league: "Championship",
    kickoff: "12:30",
    market: "1X2",
    selection: "Leeds Win",
    modelProbability: 0.56,
    impliedProbability: 0.50,
    edgePercent: 6.0,
    currentOdds: 2.00,
    bookmaker: "Unibet",
    confidence: "medium",
  },
  {
    id: "vb7",
    matchId: "m11",
    homeTeam: "Inter Milan",
    awayTeam: "Napoli",
    league: "Serie A",
    kickoff: "15:00",
    market: "BTTS",
    selection: "No",
    modelProbability: 0.58,
    impliedProbability: 0.50,
    edgePercent: 8.0,
    currentOdds: 2.00,
    bookmaker: "Bet365",
    confidence: "medium",
  },
  {
    id: "vb8",
    matchId: "m15",
    homeTeam: "Burnley",
    awayTeam: "Norwich City",
    league: "Championship",
    kickoff: "15:00",
    market: "1X2",
    selection: "Burnley Win",
    modelProbability: 0.61,
    impliedProbability: 0.556,
    edgePercent: 5.4,
    currentOdds: 1.80,
    bookmaker: "1xBet",
    confidence: "medium",
  },
  {
    id: "vb9",
    matchId: "m9",
    homeTeam: "Bayer Leverkusen",
    awayTeam: "RB Leipzig",
    league: "Bundesliga",
    kickoff: "15:30",
    market: "O/U 2.5",
    selection: "Over 2.5",
    modelProbability: 0.68,
    impliedProbability: 0.625,
    edgePercent: 5.5,
    currentOdds: 1.60,
    bookmaker: "Betfair",
    confidence: "medium",
  },
  {
    id: "vb10",
    matchId: "m16",
    homeTeam: "Sunderland",
    awayTeam: "Middlesbrough",
    league: "Championship",
    kickoff: "15:00",
    market: "O/U 2.5",
    selection: "Under 2.5",
    modelProbability: 0.62,
    impliedProbability: 0.54,
    edgePercent: 8.0,
    currentOdds: 1.85,
    bookmaker: "Unibet",
    confidence: "medium",
  },
  {
    id: "vb11",
    matchId: "m12",
    homeTeam: "Juventus",
    awayTeam: "AC Milan",
    league: "Serie A",
    kickoff: "18:00",
    market: "O/U 2.5",
    selection: "Under 2.5",
    modelProbability: 0.60,
    impliedProbability: 0.513,
    edgePercent: 8.7,
    currentOdds: 1.95,
    bookmaker: "Pinnacle",
    confidence: "high",
  },
  {
    id: "vb12",
    matchId: "m2",
    homeTeam: "Manchester City",
    awayTeam: "West Ham",
    league: "Premier League",
    kickoff: "15:00",
    market: "1X2",
    selection: "Man City Win",
    modelProbability: 0.78,
    impliedProbability: 0.741,
    edgePercent: 3.9,
    currentOdds: 1.35,
    bookmaker: "Betfair",
    confidence: "low",
  },
];

// ─── TRACK RECORD / HISTORICAL BETS ───────────────────────────────────────

function generateHistoricalBets(): HistoricalBet[] {
  const bets: HistoricalBet[] = [];
  const leagueList = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Championship", "Ligue 1", "Serie B", "2. Bundesliga"];
  const markets = ["1X2", "O/U 2.5", "BTTS"];
  const strategies = ["bot_value_all", "bot_value_strict", "bot_news_only", "bot_lower_leagues", "bot_over_under"];
  const teams = [
    ["Arsenal", "Chelsea"], ["Liverpool", "Man United"], ["Man City", "Newcastle"],
    ["Brighton", "Crystal Palace"], ["Tottenham", "Wolves"], ["Aston Villa", "Fulham"],
    ["Real Madrid", "Barcelona"], ["Atlético Madrid", "Sevilla"], ["Real Sociedad", "Villarreal"],
    ["Bayern Munich", "Dortmund"], ["Leverkusen", "Leipzig"], ["Frankfurt", "Wolfsburg"],
    ["Inter Milan", "AC Milan"], ["Juventus", "Napoli"], ["Roma", "Atalanta"],
    ["Leeds United", "Sheffield United"], ["Burnley", "Norwich"], ["Sunderland", "Middlesbrough"],
    ["PSG", "Lyon"], ["Marseille", "Monaco"],
    ["Palermo", "Bari"], ["Pisa", "Cremonese"],
    ["Hamburg", "Köln"], ["Hertha Berlin", "Kaiserslautern"],
  ];
  const selections1x2 = ["Home Win", "Draw", "Away Win"];
  const selectionsOu = ["Over 2.5", "Under 2.5"];
  const selectionsBtts = ["BTTS Yes", "BTTS No"];

  let bankroll = 1000;
  const startDate = new Date("2026-01-15");

  for (let i = 0; i < 247; i++) {
    const dayOffset = Math.floor(i / 3);
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split("T")[0];

    const teamPair = teams[i % teams.length];
    const league = leagueList[i % leagueList.length];
    const market = markets[i % markets.length];
    const strategy = strategies[i % strategies.length];

    let selection: string;
    if (market === "1X2") selection = selections1x2[i % 3];
    else if (market === "O/U 2.5") selection = selectionsOu[i % 2];
    else selection = selectionsBtts[i % 2];

    const oddsAtPick = 1.40 + Math.random() * 2.0;
    const closingOdds = oddsAtPick + (Math.random() - 0.52) * 0.15;
    const clv = oddsAtPick - closingOdds;
    const modelProb = 0.40 + Math.random() * 0.35;

    // ~56% win rate for a realistic edge
    const won = Math.random() < 0.56;
    const stake = Math.round((5 + Math.random() * 20) * 100) / 100;
    const pnl = won ? Math.round(stake * (oddsAtPick - 1) * 100) / 100 : -stake;
    bankroll = Math.round((bankroll + pnl) * 100) / 100;

    bets.push({
      id: `hb${i + 1}`,
      date: dateStr,
      match: `${teamPair[0]} vs ${teamPair[1]}`,
      league,
      market,
      selection,
      oddsAtPick: Math.round(oddsAtPick * 100) / 100,
      closingOdds: Math.round(closingOdds * 100) / 100,
      clv: Math.round(clv * 100) / 100,
      modelProbability: Math.round(modelProb * 100) / 100,
      result: won ? "won" : "lost",
      stake,
      pnl,
      bankrollAfter: bankroll,
      botStrategy: strategy,
    });
  }

  return bets;
}

export const historicalBets = generateHistoricalBets();

export const trackRecordStats: TrackRecordStats = (() => {
  const bets = historicalBets;
  const wins = bets.filter((b) => b.result === "won").length;
  const losses = bets.filter((b) => b.result === "lost").length;
  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalPnl = bets.reduce((sum, b) => sum + b.pnl, 0);
  const avgClv = bets.reduce((sum, b) => sum + b.clv, 0) / bets.length;

  let maxWin = 0;
  let maxLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const b of bets) {
    if (b.result === "won") { curWin++; curLoss = 0; }
    else { curLoss++; curWin = 0; }
    maxWin = Math.max(maxWin, curWin);
    maxLoss = Math.max(maxLoss, curLoss);
  }

  return {
    totalBets: bets.length,
    wins,
    losses,
    hitRate: Math.round((wins / bets.length) * 1000) / 10,
    roi: Math.round((totalPnl / totalStaked) * 1000) / 10,
    avgClv: Math.round(avgClv * 100) / 100,
    totalStaked: Math.round(totalStaked * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    currentBankroll: bets[bets.length - 1].bankrollAfter,
    longestWinStreak: maxWin,
    longestLossStreak: maxLoss,
  };
})();
