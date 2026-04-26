export interface League {
  id: string;
  name: string;
  country: string;
  tier: number;
  flag: string; // emoji flag
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  leagueId: string;
}

export interface Match {
  id: string;
  date: string;
  kickoff: string;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  status: "upcoming" | "live" | "finished";
  scoreHome?: number;
  scoreAway?: number;
  hasDetailedData: boolean;
}

export interface TeamForm {
  results: Array<{
    opponent: string;
    home: boolean;
    goalsFor: number;
    goalsAgainst: number;
    result: "W" | "D" | "L";
    xg: number;
    xga: number;
    date: string;
  }>;
}

export interface HeadToHead {
  matches: Array<{
    date: string;
    homeTeam: string;
    awayTeam: string;
    scoreHome: number;
    scoreAway: number;
    competition: string;
  }>;
}

export interface MatchStats {
  homeForm: TeamForm;
  awayForm: TeamForm;
  headToHead: HeadToHead;
  homeXg: number;
  awayXg: number;
  homeHomeSplits: { w: number; d: number; l: number; gf: number; ga: number };
  awayAwaySplits: { w: number; d: number; l: number; gf: number; ga: number };
}

export interface OddsSnapshot {
  bookmaker: string;
  market: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  overOdds?: number;
  underOdds?: number;
  timestamp: string;
}

export interface OddsMovement {
  timestamp: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
}

export interface Injury {
  player: string;
  team: string;
  injuryType: string;
  expectedReturn: string;
  status: "out" | "doubtful" | "questionable";
  matchesMissed: number;
}

export interface LineupPlayer {
  name: string;
  position: string;
  number: number;
  isCaptain?: boolean;
}

export interface Lineup {
  formation: string;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
}

export interface Weather {
  tempC: number;
  windKmh: number;
  windDirection: string;
  rainMm: number;
  humidity: number;
  condition: string;
}

export interface Referee {
  name: string;
  yellowsPerGame: number;
  redsPerGame: number;
  pensPerGame: number;
  foulsPerGame: number;
  matchesThisSeason: number;
}

export interface Prediction {
  market: string;
  selection: string;
  modelProbability: number;
  impliedProbability: number;
  edgePercent: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  currentOdds: number;
  bookmaker: string;
}

export interface MatchDetail {
  match: Match;
  stats: MatchStats;
  odds: OddsSnapshot[];
  oddsMovement: OddsMovement[];
  injuries: Injury[];
  homeLineup: Lineup;
  awayLineup: Lineup;
  weather: Weather;
  referee: Referee;
  predictions: Prediction[];
  fixtureCongest: {
    homeDaysSinceLast: number;
    awayDaysSinceLast: number;
    homeMatchesIn14Days: number;
    awayMatchesIn14Days: number;
  };
}

export interface ValueBet {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  market: string;
  selection: string;
  modelProbability: number;
  impliedProbability: number;
  edgePercent: number;
  currentOdds: number;
  bookmaker: string;
  confidence: "high" | "medium" | "low";
}

export interface HistoricalBet {
  id: string;
  date: string;
  match: string;
  league: string;
  market: string;
  selection: string;
  oddsAtPick: number;
  closingOdds: number;
  clv: number;
  modelProbability: number;
  result: "won" | "lost" | "void";
  stake: number;
  pnl: number;
  bankrollAfter: number;
  botStrategy: string;
}

export interface TrackRecordStats {
  totalBets: number;
  wins: number;
  losses: number;
  hitRate: number;
  roi: number;
  avgClv: number;
  totalStaked: number;
  totalPnl: number;
  currentBankroll: number;
  longestWinStreak: number;
  longestLossStreak: number;
}
