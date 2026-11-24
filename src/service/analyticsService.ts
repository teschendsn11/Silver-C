import { getDb } from "../db/client";
import type {
  HistoricalLeagueExport,
  SeasonHistory,
} from "../types/league";

export interface ManagerCareerStats {
  leagueId: string;
  managerGuid: string;
  nickname: string;
  isActive: boolean;
  seasonsCount: number;
  championships: number;
  runnerUps: number;
  podiums: number;
  sackos: number;
  playoffAppearances: number;
  regWins: number;
  regLosses: number;
  regTies: number;
  regWinPct: number;
  playoffWins: number;
  playoffLosses: number;
  playoffWinPct: number;
  pointsFor: number;
  pointsAgainst: number;
  ppgAverage: number;
}

export interface HeadToHeadRecord {
  leagueId: string;
  manager1Guid: string;
  manager1Name: string;
  manager2Guid: string;
  manager2Name: string;
  totalMatchups: number;
  regWins: number;
  regLosses: number;
  regTies: number;
  playoffWins: number;
  playoffLosses: number;
  manager1Points: number;
  manager2Points: number;
}

export interface LeagueRecordEntry {
  leagueId: string;
  recordType:
    | "HIGHEST_SCORE"
    | "LOWEST_SCORE"
    | "BIGGEST_BLOWOUT"
    | "CLOSEST_GAME"
    | "HIGHEST_SHOOTOUT"
    | "TOUGH_LUCK_LOSS"
    | "LUCKY_WIN"
    | "SEASON_HIGH_SCORER"
    | "SEASON_LOW_SCORER"
    | "WORST_WINNER"
    | "HIGHEST_DILDO"
    | "LOWEST_DILDO"
    | "BIGGEST_CHOKE"
    | "BEST_RECORD"
    | "WORST_RECORD"
    | "UNLUCKIEST_TEAM"
    | "LUCKIEST_TEAM";
  rank: number;
  seasonYear: string;
  week: number;
  isPlayoffs: boolean;
  primaryManagerName: string;
  primaryManagerGuid?: string;
  primaryTeamName: string;
  primaryScore: number;
  secondaryManagerName?: string;
  secondaryManagerGuid?: string;
  secondaryTeamName?: string;
  secondaryScore?: number;
  margin?: number;
  combinedScore?: number;
  details?: string;
}

export class AnalyticsService {
  private knownAlumni: Record<string, string> = {
    "ZWUWVFLR7XXRCOSAOG2OTTFNF4": "Alumni (Rodgers/Draft trash)",
    "SJCJWALXMDVROCQRBIUF2L44JM": "Alumni (My back Ertz)",
    "YWKVQJVJCDSQ2NRFBJI4WL6BRE": "Alumni (Prestige Worldwide)",
    "5HSU7WFOSSQ5FHL5EEEUZOLB3A": "Alumni (ri-GRONK-ulous)",
    "EHU5WEBFPDPKQGC7J3F4AT3H4Y": "Alumni (Reggies Bushy Beaver)",
    "--": "Alumni (Stafford Infection)",
    "GL5XR42VSGUDLRVGWSCJO2BWKQ": "Alumni (Plum Smugglers)",
    "PN6H4X6BFL66TVCWGGSJ5KHWZU": "Alumni (Chosen Few)",
    "CJXDAHCPFTPZT5HEELYLN2SEC4": "Alumni (Van Buren Boys)",
    "VOYHKDJYFHBGIG7E2ENMR5QLAM": "Alumni (AestheticallyTeasing)",
  };

  /**
   * Resolves GUID to canonical nickname across seasons.
   */
  buildGuidMap(payload: HistoricalLeagueExport): Map<string, string> {
    const guidMap = new Map<string, string>();

    // 1. First pass: extract explicit non-hidden nicknames
    for (const s of payload.seasons) {
      for (const t of s.teams) {
        for (const m of t.managers || []) {
          if (m.guid && m.nickname && m.nickname !== "--hidden--") {
            guidMap.set(m.guid, m.nickname);
          }
        }
      }
    }

    // 2. Fallbacks for historical alumni
    for (const [guid, name] of Object.entries(this.knownAlumni)) {
      if (!guidMap.has(guid)) {
        guidMap.set(guid, name);
      }
    }

    return guidMap;
  }

  /**
   * Computes all-time career statistics for all managers.
   */
  calculateManagerStats(payload: HistoricalLeagueExport): ManagerCareerStats[] {
    const leagueId = payload.summary.leagueId;
    const guidMap = this.buildGuidMap(payload);
    const latestSeason = payload.seasons[0];
    const activeGuids = new Set<string>();

    if (latestSeason) {
      for (const t of latestSeason.teams) {
        for (const m of t.managers || []) {
          if (m.guid) activeGuids.add(m.guid);
        }
      }
    }

    const teamKeyToManager = new Map<string, { guid: string; name: string }>();
    for (const s of payload.seasons) {
      for (const t of s.teams) {
        const m = t.managers?.[0];
        const guid = m?.guid || `legacy-${t.teamKey}`;
        const name = guidMap.get(guid) || m?.nickname || t.name;
        teamKeyToManager.set(t.teamKey, { guid, name });
      }
    }

    const map = new Map<string, ManagerCareerStats>();

    function getOrCreate(guid: string, name: string): ManagerCareerStats {
      if (!map.has(guid)) {
        map.set(guid, {
          leagueId,
          managerGuid: guid,
          nickname: name,
          isActive: activeGuids.has(guid),
          seasonsCount: 0,
          championships: 0,
          runnerUps: 0,
          podiums: 0,
          sackos: 0,
          playoffAppearances: 0,
          regWins: 0,
          regLosses: 0,
          regTies: 0,
          regWinPct: 0,
          playoffWins: 0,
          playoffLosses: 0,
          playoffWinPct: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          ppgAverage: 0,
        });
      }
      return map.get(guid)!;
    }

    for (const s of payload.seasons) {
      const isCompleted = s.season !== payload.summary.currentSeason;

      // Standings
      for (const st of s.standings) {
        const mgr = teamKeyToManager.get(st.teamKey);
        if (!mgr) continue;
        const entry = getOrCreate(mgr.guid, mgr.name);
        entry.seasonsCount++;
        entry.regWins += st.wins;
        entry.regLosses += st.losses;
        entry.regTies += st.ties;
        entry.pointsFor += Number(st.pointsFor || 0);
        entry.pointsAgainst += Number(st.pointsAgainst || 0);

        if (isCompleted) {
          if (st.rank === 1) entry.championships++;
          if (st.rank === 2) entry.runnerUps++;
          if (st.rank <= 3) entry.podiums++;
          if (st.rank === s.standings.length) entry.sackos++;
        }
      }

      // Matchups (Playoffs)
      const playoffManagers = new Set<string>();
      for (const m of s.matchups || []) {
        if (!m.isPlayoffs || !isCompleted || m.teams.length < 2) continue;
        const t1Mgr = teamKeyToManager.get(m.teams[0].teamKey);
        const t2Mgr = teamKeyToManager.get(m.teams[1].teamKey);
        if (t1Mgr) playoffManagers.add(t1Mgr.guid);
        if (t2Mgr) playoffManagers.add(t2Mgr.guid);

        if (m.winnerTeamKey) {
          const winMgr = teamKeyToManager.get(m.winnerTeamKey);
          const lossMgr = m.winnerTeamKey === m.teams[0].teamKey ? t2Mgr : t1Mgr;
          if (winMgr) {
            getOrCreate(winMgr.guid, winMgr.name).playoffWins++;
          }
          if (lossMgr) {
            getOrCreate(lossMgr.guid, lossMgr.name).playoffLosses++;
          }
        }
      }

      for (const pGuid of playoffManagers) {
        const pEntry = map.get(pGuid);
        if (pEntry) pEntry.playoffAppearances++;
      }
    }

    // Finalize ratios
    for (const entry of map.values()) {
      const totalReg = entry.regWins + entry.regLosses + entry.regTies;
      entry.regWinPct = totalReg > 0 ? Number(((entry.regWins / totalReg) * 100).toFixed(2)) : 0;

      const totalPlayoff = entry.playoffWins + entry.playoffLosses;
      entry.playoffWinPct =
        totalPlayoff > 0 ? Number(((entry.playoffWins / totalPlayoff) * 100).toFixed(2)) : 0;

      entry.ppgAverage = totalReg > 0 ? Number((entry.pointsFor / totalReg).toFixed(2)) : 0;
      entry.pointsFor = Number(entry.pointsFor.toFixed(2));
      entry.pointsAgainst = Number(entry.pointsAgainst.toFixed(2));
    }

    return Array.from(map.values()).sort(
      (a, b) => b.championships - a.championships || b.regWins - a.regWins
    );
  }

  /**
   * Computes all-time head-to-head match records between every pair of managers.
   */
  calculateHeadToHead(payload: HistoricalLeagueExport): HeadToHeadRecord[] {
    const leagueId = payload.summary.leagueId;
    const guidMap = this.buildGuidMap(payload);

    const teamKeyToManager = new Map<string, { guid: string; name: string }>();
    for (const s of payload.seasons) {
      for (const t of s.teams) {
        const m = t.managers?.[0];
        const guid = m?.guid || `legacy-${t.teamKey}`;
        const name = guidMap.get(guid) || m?.nickname || t.name;
        teamKeyToManager.set(t.teamKey, { guid, name });
      }
    }

    const matrix = new Map<string, HeadToHeadRecord>();

    function getH2H(m1: { guid: string; name: string }, m2: { guid: string; name: string }) {
      const key = `${m1.guid}::${m2.guid}`;
      if (!matrix.has(key)) {
        matrix.set(key, {
          leagueId,
          manager1Guid: m1.guid,
          manager1Name: m1.name,
          manager2Guid: m2.guid,
          manager2Name: m2.name,
          totalMatchups: 0,
          regWins: 0,
          regLosses: 0,
          regTies: 0,
          playoffWins: 0,
          playoffLosses: 0,
          manager1Points: 0,
          manager2Points: 0,
        });
      }
      return matrix.get(key)!;
    }

    for (const s of payload.seasons) {
      for (const m of s.matchups || []) {
        if (m.teams.length < 2) continue;
        const t1 = m.teams[0];
        const t2 = m.teams[1];
        const p1 = Number(t1.points || 0);
        const p2 = Number(t2.points || 0);
        if (p1 === 0 && p2 === 0) continue;

        const m1 = teamKeyToManager.get(t1.teamKey);
        const m2 = teamKeyToManager.get(t2.teamKey);
        if (!m1 || !m2 || m1.guid === m2.guid) continue;

        const h1 = getH2H(m1, m2);
        const h2 = getH2H(m2, m1);

        h1.totalMatchups++;
        h2.totalMatchups++;
        h1.manager1Points += p1;
        h1.manager2Points += p2;
        h2.manager1Points += p2;
        h2.manager2Points += p1;

        if (m.isPlayoffs) {
          if (p1 > p2) {
            h1.playoffWins++;
            h2.playoffLosses++;
          } else if (p2 > p1) {
            h2.playoffWins++;
            h1.playoffLosses++;
          }
        } else {
          if (p1 > p2) {
            h1.regWins++;
            h2.regLosses++;
          } else if (p2 > p1) {
            h2.regWins++;
            h1.regLosses++;
          } else {
            h1.regTies++;
            h2.regTies++;
          }
        }
      }
    }

    for (const record of matrix.values()) {
      record.manager1Points = Number(record.manager1Points.toFixed(2));
      record.manager2Points = Number(record.manager2Points.toFixed(2));
    }

    return Array.from(matrix.values());
  }

  /**
   * Computes the Top 10 leaderboards for all extreme record categories.
   */
  calculateLeagueRecords(payload: HistoricalLeagueExport): LeagueRecordEntry[] {
    const leagueId = payload.summary.leagueId;
    const guidMap = this.buildGuidMap(payload);

    const teamKeyToInfo = new Map<
      string,
      { guid: string; manager: string; teamName: string; season: string }
    >();

    for (const s of payload.seasons) {
      for (const t of s.teams) {
        const m = t.managers?.[0];
        const guid = m?.guid || `legacy-${t.teamKey}`;
        const manager = guidMap.get(guid) || m?.nickname || t.name;
        teamKeyToInfo.set(t.teamKey, {
          guid,
          manager,
          teamName: t.name,
          season: s.season,
        });
      }
    }

    const allSingleScores: any[] = [];
    const allBlowouts: any[] = [];
    const allShootouts: any[] = [];
    const allNailbiters: any[] = [];
    const allToughLuck: any[] = [];
    const allLuckyWins: any[] = [];
    const allLowScores: any[] = [];

    for (const s of payload.seasons) {
      for (const m of s.matchups || []) {
        if (m.teams.length < 2) continue;
        const t1 = m.teams[0];
        const t2 = m.teams[1];
        const p1 = Number(t1.points || 0);
        const p2 = Number(t2.points || 0);

        if (p1 === 0 && p2 === 0) continue;
        // In current active season, ignore unplayed/incomplete games
        if (s.season === payload.summary.currentSeason && (p1 < 10 || p2 < 10)) continue;

        const i1 = teamKeyToInfo.get(t1.teamKey) || {
          guid: "",
          manager: t1.teamName || "Team 1",
          teamName: t1.teamName || "Team 1",
          season: s.season,
        };
        const i2 = teamKeyToInfo.get(t2.teamKey) || {
          guid: "",
          manager: t2.teamName || "Team 2",
          teamName: t2.teamName || "Team 2",
          season: s.season,
        };

        const margin = Number(Math.abs(p1 - p2).toFixed(2));
        const combined = Number((p1 + p2).toFixed(2));
        const winner = p1 > p2 ? i1 : i2;
        const loser = p1 > p2 ? i2 : i1;
        const winPts = Math.max(p1, p2);
        const losePts = Math.min(p1, p2);

        // Single Scores
        allSingleScores.push({
          score: p1,
          seasonYear: s.season,
          week: m.week,
          isPlayoffs: m.isPlayoffs,
          primary: i1,
          secondary: i2,
          secondaryScore: p2,
          margin,
          combined,
        });
        allSingleScores.push({
          score: p2,
          seasonYear: s.season,
          week: m.week,
          isPlayoffs: m.isPlayoffs,
          primary: i2,
          secondary: i1,
          secondaryScore: p1,
          margin,
          combined,
        });

        if (p1 > 0 && p2 > 0) {
          allLowScores.push({
            score: p1,
            seasonYear: s.season,
            week: m.week,
            isPlayoffs: m.isPlayoffs,
            primary: i1,
            secondary: i2,
            secondaryScore: p2,
          });
          allLowScores.push({
            score: p2,
            seasonYear: s.season,
            week: m.week,
            isPlayoffs: m.isPlayoffs,
            primary: i2,
            secondary: i1,
            secondaryScore: p1,
          });
        }

        // Blowouts
        allBlowouts.push({
          margin,
          seasonYear: s.season,
          week: m.week,
          isPlayoffs: m.isPlayoffs,
          primary: winner,
          primaryScore: winPts,
          secondary: loser,
          secondaryScore: losePts,
          combined,
        });

        // Shootouts
        allShootouts.push({
          combined,
          seasonYear: s.season,
          week: m.week,
          isPlayoffs: m.isPlayoffs,
          primary: winner,
          primaryScore: winPts,
          secondary: loser,
          secondaryScore: losePts,
          margin,
        });

        // Nailbiters & Tough Luck
        if (margin > 0) {
          allNailbiters.push({
            margin,
            seasonYear: s.season,
            week: m.week,
            isPlayoffs: m.isPlayoffs,
            primary: winner,
            primaryScore: winPts,
            secondary: loser,
            secondaryScore: losePts,
            combined,
          });

          allToughLuck.push({
            score: losePts,
            seasonYear: s.season,
            week: m.week,
            isPlayoffs: m.isPlayoffs,
            primary: loser,
            primaryScore: losePts,
            secondary: winner,
            secondaryScore: winPts,
            margin,
          });

          allLuckyWins.push({
            score: winPts,
            seasonYear: s.season,
            week: m.week,
            isPlayoffs: m.isPlayoffs,
            primary: winner,
            primaryScore: winPts,
            secondary: loser,
            secondaryScore: losePts,
            margin,
          });
        }
      }
    }

    allSingleScores.sort((a, b) => b.score - a.score);
    allLowScores.sort((a, b) => a.score - b.score);
    allBlowouts.sort((a, b) => b.margin - a.margin);
    allShootouts.sort((a, b) => b.combined - a.combined);
    allNailbiters.sort((a, b) => a.margin - b.margin);
    allToughLuck.sort((a, b) => b.score - a.score);
    allLuckyWins.sort((a, b) => a.score - b.score);

    const records: LeagueRecordEntry[] = [];

    function pushTop10(items: any[], type: LeagueRecordEntry["recordType"], mapFn: (item: any) => any) {
      items.slice(0, 10).forEach((item, idx) => {
        records.push({
          leagueId,
          recordType: type,
          rank: idx + 1,
          ...mapFn(item),
        });
      });
    }

    pushTop10(allSingleScores, "HIGHEST_SCORE", (i) => ({
      seasonYear: i.seasonYear,
      week: i.week,
      isPlayoffs: i.isPlayoffs,
      primaryManagerName: i.primary.manager,
      primaryManagerGuid: i.primary.guid,
      primaryTeamName: i.primary.teamName,
      primaryScore: i.score,
      secondaryManagerName: i.secondary.manager,
      secondaryManagerGuid: i.secondary.guid,
      secondaryTeamName: i.secondary.teamName,
      secondaryScore: i.secondaryScore,
      margin: i.margin,
      combinedScore: i.combined,
    }));

    pushTop10(allLowScores, "LOWEST_SCORE", (i) => ({
      seasonYear: i.seasonYear,
      week: i.week,
      isPlayoffs: i.isPlayoffs,
      primaryManagerName: i.primary.manager,
      primaryManagerGuid: i.primary.guid,
      primaryTeamName: i.primary.teamName,
      primaryScore: i.score,
      secondaryManagerName: i.secondary.manager,
      secondaryManagerGuid: i.secondary.guid,
      secondaryTeamName: i.secondary.teamName,
      secondaryScore: i.secondaryScore,
    }));

    pushTop10(allBlowouts, "BIGGEST_BLOWOUT", (i) => ({
      seasonYear: i.seasonYear,
      week: i.week,
      isPlayoffs: i.isPlayoffs,
      primaryManagerName: i.primary.manager,
      primaryManagerGuid: i.primary.guid,
      primaryTeamName: i.primary.teamName,
      primaryScore: i.primaryScore,
      secondaryManagerName: i.secondary.manager,
      secondaryManagerGuid: i.secondary.guid,
      secondaryTeamName: i.secondary.teamName,
      secondaryScore: i.secondaryScore,
      margin: i.margin,
      combinedScore: i.combined,
    }));

    pushTop10(allNailbiters, "CLOSEST_GAME", (i) => ({
      seasonYear: i.seasonYear,
      week: i.week,
      isPlayoffs: i.isPlayoffs,
      primaryManagerName: i.primary.manager,
      primaryManagerGuid: i.primary.guid,
      primaryTeamName: i.primary.teamName,
      primaryScore: i.primaryScore,
      secondaryManagerName: i.secondary.manager,
      secondaryManagerGuid: i.secondary.guid,
      secondaryTeamName: i.secondary.teamName,
      secondaryScore: i.secondaryScore,
      margin: i.margin,
      combinedScore: i.combined,
    }));

    pushTop10(allShootouts, "HIGHEST_SHOOTOUT", (i) => ({
      seasonYear: i.seasonYear,
      week: i.week,
      isPlayoffs: i.isPlayoffs,
      primaryManagerName: i.primary.manager,
      primaryManagerGuid: i.primary.guid,
      primaryTeamName: i.primary.teamName,
      primaryScore: i.primaryScore,
      secondaryManagerName: i.secondary.manager,
      secondaryManagerGuid: i.secondary.guid,
      secondaryTeamName: i.secondary.teamName,
      secondaryScore: i.secondaryScore,
      margin: i.margin,
      combinedScore: i.combined,
    }));

    pushTop10(allToughLuck, "TOUGH_LUCK_LOSS", (i) => ({
      seasonYear: i.seasonYear,
      week: i.week,
      isPlayoffs: i.isPlayoffs,
      primaryManagerName: i.primary.manager,
      primaryManagerGuid: i.primary.guid,
      primaryTeamName: i.primary.teamName,
      primaryScore: i.primaryScore,
      secondaryManagerName: i.secondary.manager,
      secondaryManagerGuid: i.secondary.guid,
      secondaryTeamName: i.secondary.teamName,
      secondaryScore: i.secondaryScore,
      margin: i.margin,
    }));

    pushTop10(allLuckyWins, "LUCKY_WIN", (i) => ({
      seasonYear: i.seasonYear,
      week: i.week,
      isPlayoffs: i.isPlayoffs,
      primaryManagerName: i.primary.manager,
      primaryManagerGuid: i.primary.guid,
      primaryTeamName: i.primary.teamName,
      primaryScore: i.primaryScore,
      secondaryManagerName: i.secondary.manager,
      secondaryManagerGuid: i.secondary.guid,
      secondaryTeamName: i.secondary.teamName,
      secondaryScore: i.secondaryScore,
      margin: i.margin,
    }));

    // Season-Level Aggregates (Completed Seasons Only)
    const allSeasonTeams: any[] = [];
    for (const s of payload.seasons) {
      if (s.season === payload.summary.currentSeason) continue;
      const numTeams = s.standings.length;

      for (const st of s.standings) {
        const info = teamKeyToInfo.get(st.teamKey) || {
          guid: "",
          manager: st.managerName || "Manager",
          teamName: st.teamName || "Team",
          season: s.season,
        };
        const games = st.wins + st.losses + st.ties;
        const ppg = games > 0 ? Number((st.pointsFor / games).toFixed(2)) : 0;
        const oppPpg = games > 0 ? Number((st.pointsAgainst / games).toFixed(2)) : 0;
        const isChamp = st.rank === 1;
        const isDildo = st.rank === numTeams;

        allSeasonTeams.push({
          seasonYear: s.season,
          rank: st.rank,
          numTeams,
          isChamp,
          isDildo,
          info,
          wins: st.wins,
          losses: st.losses,
          ties: st.ties,
          pointsFor: st.pointsFor,
          pointsAgainst: st.pointsAgainst,
          games,
          ppg,
          oppPpg,
          winPct: games > 0 ? Number(((st.wins / games) * 100).toFixed(2)) : 0,
        });
      }
    }

    // 1. Season High Scorers (by PPG)
    const seasonHighScorers = [...allSeasonTeams].sort((a, b) => b.ppg - a.ppg);
    pushTop10(seasonHighScorers, "SEASON_HIGH_SCORER", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: false,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.ppg,
      secondaryScore: t.pointsFor,
      details: `${t.ppg} PPG (${t.pointsFor} total pts, ${t.wins}-${t.losses}, Finished #${t.rank})`,
    }));

    // 2. Season Low Scorers (by PPG)
    const seasonLowScorers = [...allSeasonTeams].sort((a, b) => a.ppg - b.ppg);
    pushTop10(seasonLowScorers, "SEASON_LOW_SCORER", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: false,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.ppg,
      secondaryScore: t.pointsFor,
      details: `${t.ppg} PPG (${t.pointsFor} total pts, ${t.wins}-${t.losses}, Finished #${t.rank})`,
    }));

    // 3. Worst Winner (Champions with lowest regular season PPG)
    const champs = allSeasonTeams.filter((t) => t.isChamp);
    const worstWinners = [...champs].sort((a, b) => a.ppg - b.ppg);
    pushTop10(worstWinners, "WORST_WINNER", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: true,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.ppg,
      secondaryScore: t.pointsFor,
      details: `Champion with only ${t.ppg} PPG (${t.pointsFor} pts, Reg Rec: ${t.wins}-${t.losses})`,
    }));

    // 4. Highest Scoring Dildo (Unluckiest Sackos)
    const dildos = allSeasonTeams.filter((t) => t.isDildo);
    const highestDildos = [...dildos].sort((a, b) => b.ppg - a.ppg);
    pushTop10(highestDildos, "HIGHEST_DILDO", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: false,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.ppg,
      secondaryScore: t.pointsFor,
      margin: t.oppPpg,
      details: `Sacko despite scoring ${t.ppg} PPG (${t.pointsFor} pts, Rec: ${t.wins}-${t.losses}, Allowed: ${t.oppPpg} opp PPG)`,
    }));

    // 5. Lowest Scoring Dildo (Most Pathetic Sackos)
    const lowestDildos = [...dildos].sort((a, b) => a.ppg - b.ppg);
    pushTop10(lowestDildos, "LOWEST_DILDO", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: false,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.ppg,
      secondaryScore: t.pointsFor,
      details: `Pathetic Sacko with only ${t.ppg} PPG (${t.pointsFor} pts, Rec: ${t.wins}-${t.losses})`,
    }));

    // 6. Biggest Chokes (Highest scoring non-champions)
    const nonChamps = allSeasonTeams.filter((t) => !t.isChamp);
    const biggestChokes = [...nonChamps].sort((a, b) => b.ppg - a.ppg);
    pushTop10(biggestChokes, "BIGGEST_CHOKE", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: false,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.ppg,
      secondaryScore: t.pointsFor,
      details: `Dominant ${t.ppg} PPG (${t.pointsFor} pts, ${t.wins}-${t.losses}) but choked and finished #${t.rank}`,
    }));

    // 7. Unluckiest Team (Most Points Against per game)
    const unluckiestTeams = [...allSeasonTeams].sort((a, b) => b.oppPpg - a.oppPpg);
    pushTop10(unluckiestTeams, "UNLUCKIEST_TEAM", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: false,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.oppPpg,
      secondaryScore: t.pointsAgainst,
      details: `Opponents torched them for ${t.oppPpg} opp PPG (${t.pointsAgainst} PA, Rec: ${t.wins}-${t.losses}, Finished #${t.rank})`,
    }));

    // 8. Luckiest Team (Fewest Points Against per game)
    const luckiestTeams = [...allSeasonTeams].sort((a, b) => a.oppPpg - b.oppPpg);
    pushTop10(luckiestTeams, "LUCKIEST_TEAM", (t) => ({
      seasonYear: t.seasonYear,
      week: 0,
      isPlayoffs: false,
      primaryManagerName: t.info.manager,
      primaryManagerGuid: t.info.guid,
      primaryTeamName: t.info.teamName,
      primaryScore: t.oppPpg,
      secondaryScore: t.pointsAgainst,
      details: `Opponents averaged just ${t.oppPpg} opp PPG (${t.pointsAgainst} PA, Rec: ${t.wins}-${t.losses}, Finished #${t.rank})`,
    }));

    return records;
  }

  /**
   * Persists all pre-calculated aggregates directly into PostgreSQL.
   */
  async persistAggregates(payload: HistoricalLeagueExport): Promise<void> {
    const sql = getDb();
    const leagueId = payload.summary.leagueId;

    console.log(`[Analytics] Computing career stats, rivalries, and records for league ${leagueId}...`);

    const careerStats = this.calculateManagerStats(payload);
    const h2hRecords = this.calculateHeadToHead(payload);
    const records = this.calculateLeagueRecords(payload);

    await sql.begin(async (tx: any) => {
      // 1. Manager Career Stats
      for (const c of careerStats) {
        await tx`
          INSERT INTO manager_career_stats (
            league_id, manager_guid, nickname, is_active, seasons_count, championships,
            runner_ups, podiums, sackos, playoff_appearances, reg_wins, reg_losses,
            reg_ties, reg_win_pct, playoff_wins, playoff_losses, playoff_win_pct,
            points_for, points_against, ppg_average, updated_at
          )
          VALUES (
            ${c.leagueId}, ${c.managerGuid}, ${c.nickname}, ${c.isActive}, ${c.seasonsCount},
            ${c.championships}, ${c.runnerUps}, ${c.podiums}, ${c.sackos}, ${c.playoffAppearances},
            ${c.regWins}, ${c.regLosses}, ${c.regTies}, ${c.regWinPct}, ${c.playoffWins},
            ${c.playoffLosses}, ${c.playoffWinPct}, ${c.pointsFor}, ${c.pointsAgainst},
            ${c.ppgAverage}, NOW()
          )
          ON CONFLICT (league_id, manager_guid) DO UPDATE SET
            nickname = EXCLUDED.nickname,
            is_active = EXCLUDED.is_active,
            seasons_count = EXCLUDED.seasons_count,
            championships = EXCLUDED.championships,
            runner_ups = EXCLUDED.runner_ups,
            podiums = EXCLUDED.podiums,
            sackos = EXCLUDED.sackos,
            playoff_appearances = EXCLUDED.playoff_appearances,
            reg_wins = EXCLUDED.reg_wins,
            reg_losses = EXCLUDED.reg_losses,
            reg_ties = EXCLUDED.reg_ties,
            reg_win_pct = EXCLUDED.reg_win_pct,
            playoff_wins = EXCLUDED.playoff_wins,
            playoff_losses = EXCLUDED.playoff_losses,
            playoff_win_pct = EXCLUDED.playoff_win_pct,
            points_for = EXCLUDED.points_for,
            points_against = EXCLUDED.points_against,
            ppg_average = EXCLUDED.ppg_average,
            updated_at = NOW();
        `;
      }

      // 2. Head-to-Head records
      for (const h of h2hRecords) {
        await tx`
          INSERT INTO head_to_head_records (
            league_id, manager1_guid, manager1_name, manager2_guid, manager2_name,
            total_matchups, reg_wins, reg_losses, reg_ties, playoff_wins, playoff_losses,
            manager1_points, manager2_points, updated_at
          )
          VALUES (
            ${h.leagueId}, ${h.manager1Guid}, ${h.manager1Name}, ${h.manager2Guid}, ${h.manager2Name},
            ${h.totalMatchups}, ${h.regWins}, ${h.regLosses}, ${h.regTies}, ${h.playoffWins},
            ${h.playoffLosses}, ${h.manager1Points}, ${h.manager2Points}, NOW()
          )
          ON CONFLICT (league_id, manager1_guid, manager2_guid) DO UPDATE SET
            manager1_name = EXCLUDED.manager1_name,
            manager2_name = EXCLUDED.manager2_name,
            total_matchups = EXCLUDED.total_matchups,
            reg_wins = EXCLUDED.reg_wins,
            reg_losses = EXCLUDED.reg_losses,
            reg_ties = EXCLUDED.reg_ties,
            playoff_wins = EXCLUDED.playoff_wins,
            playoff_losses = EXCLUDED.playoff_losses,
            manager1_points = EXCLUDED.manager1_points,
            manager2_points = EXCLUDED.manager2_points,
            updated_at = NOW();
        `;
      }

      // 3. League Records (Top 10s)
      for (const r of records) {
        await tx`
          INSERT INTO league_records (
            league_id, record_type, rank, season_year, week, is_playoffs,
            primary_manager_name, primary_manager_guid, primary_team_name, primary_score,
            secondary_manager_name, secondary_manager_guid, secondary_team_name, secondary_score,
            margin, combined_score, details, updated_at
          )
          VALUES (
            ${r.leagueId}, ${r.recordType}, ${r.rank}, ${r.seasonYear}, ${r.week}, ${r.isPlayoffs},
            ${r.primaryManagerName}, ${r.primaryManagerGuid ?? null}, ${r.primaryTeamName}, ${r.primaryScore},
            ${r.secondaryManagerName ?? null}, ${r.secondaryManagerGuid ?? null}, ${r.secondaryTeamName ?? null},
            ${r.secondaryScore ?? null}, ${r.margin ?? null}, ${r.combinedScore ?? null},
            ${r.details ?? null}, NOW()
          )
          ON CONFLICT (league_id, record_type, rank) DO UPDATE SET
            season_year = EXCLUDED.season_year,
            week = EXCLUDED.week,
            is_playoffs = EXCLUDED.is_playoffs,
            primary_manager_name = EXCLUDED.primary_manager_name,
            primary_manager_guid = EXCLUDED.primary_manager_guid,
            primary_team_name = EXCLUDED.primary_team_name,
            primary_score = EXCLUDED.primary_score,
            secondary_manager_name = EXCLUDED.secondary_manager_name,
            secondary_manager_guid = EXCLUDED.secondary_manager_guid,
            secondary_team_name = EXCLUDED.secondary_team_name,
            secondary_score = EXCLUDED.secondary_score,
            margin = EXCLUDED.margin,
            combined_score = EXCLUDED.combined_score,
            details = EXCLUDED.details,
            updated_at = NOW();
        `;
      }
    });

    console.log(
      `[Analytics] Successfully persisted ${careerStats.length} manager careers, ${h2hRecords.length} rivalries, and ${records.length} record leaderboard entries!`
    );
  }
}
