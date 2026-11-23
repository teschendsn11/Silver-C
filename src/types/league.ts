/**
 * Relational data contracts for Yahoo Fantasy League data.
 * Designed to mirror future relational database tables (Leagues, Seasons, Teams, Standings, Matchups, DraftPicks).
 */

export interface LeagueSummary {
  leagueId: string;
  name: string;
  sport: string;
  currentSeason: string;
  totalSeasonsFetched: number;
  inauguralSeason?: string;
  fetchedAt: string;
}

export interface ManagerRecord {
  managerId: string;
  nickname: string;
  guid?: string;
  isCommissioner?: boolean;
}

export interface TeamRecord {
  teamKey: string;
  teamId: string;
  name: string;
  logoUrl?: string;
  managers: ManagerRecord[];
}

export interface SeasonStandings {
  rank: number;
  teamKey: string;
  teamName: string;
  managerName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak?: {
    type: string;
    value: number;
  };
}

export interface MatchupTeamScore {
  teamKey: string;
  teamName?: string;
  points: number;
  projectedPoints?: number;
}

export interface MatchupRecord {
  week: number;
  isPlayoffs: boolean;
  teams: [MatchupTeamScore, MatchupTeamScore];
  winnerTeamKey?: string;
  isTied?: boolean;
}

export interface DraftPickRecord {
  round: number;
  pick: number;
  teamKey: string;
  playerKey: string;
  playerName?: string;
}

export interface SeasonHistory {
  season: string;
  leagueKey: string;
  leagueId: string;
  name: string;
  numTeams: number;
  scoringType: string;
  currentWeek?: number;
  startWeek?: number;
  endWeek?: number;
  renewedFromLeagueKey?: string | null;
  renewedToLeagueKey?: string | null;
  teams: TeamRecord[];
  standings: SeasonStandings[];
  matchups?: MatchupRecord[];
  draftResults?: DraftPickRecord[];
}

export interface HistoricalLeagueExport {
  summary: LeagueSummary;
  seasons: SeasonHistory[];
}
