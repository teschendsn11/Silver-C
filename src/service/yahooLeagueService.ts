import { YahooAuthService } from "./yahooAuth";
import type {
  HistoricalLeagueExport,
  LeagueSummary,
  SeasonHistory,
  SeasonStandings,
  TeamRecord,
  MatchupRecord,
  MatchupTeamScore,
  DraftPickRecord,
  ManagerRecord,
} from "../types/league";

function mergeArrayOfObjects(arr: any): Record<string, any> {
  if (!Array.isArray(arr)) return arr || {};
  const res: Record<string, any> = {};
  for (const item of arr) {
    if (item && typeof item === "object") {
      Object.assign(res, item);
    }
  }
  return res;
}

function parseTeamsList(rawTeams: any): any[] {
  if (!rawTeams) return [];
  const count = Number(rawTeams.count ?? Object.keys(rawTeams).length);
  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const t = rawTeams[i]?.team;
    if (!t) continue;
    const teamData = Array.isArray(t[0]) ? mergeArrayOfObjects(t[0]) : t[0] || {};
    const logos = Array.isArray(teamData.team_logos)
      ? teamData.team_logos.map((l: any) => l.team_logo?.url || l.team_logo || l)
      : [];
    const managers = Array.isArray(teamData.managers)
      ? teamData.managers.map((m: any) => m.manager || m)
      : [];
    result.push({
      ...teamData,
      team_logos: logos,
      managers,
    });
  }
  return result;
}

function parseStandingsList(rawStandingsTeams: any): any[] {
  if (!rawStandingsTeams) return [];
  const count = Number(rawStandingsTeams.count ?? Object.keys(rawStandingsTeams).length);
  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const t = rawStandingsTeams[i]?.team;
    if (!t) continue;
    const teamData = Array.isArray(t[0]) ? mergeArrayOfObjects(t[0]) : t[0] || {};
    const standingsData = t[2]?.team_standings || t[1]?.team_standings || {};
    const managers = Array.isArray(teamData.managers)
      ? teamData.managers.map((m: any) => m.manager || m)
      : [];
    result.push({
      ...teamData,
      managers,
      standings: standingsData,
    });
  }
  return result;
}

function parseScoreboardList(rawScoreboard: any): any[] {
  if (!rawScoreboard) return [];
  const matchupsObj = rawScoreboard[0]?.matchups || rawScoreboard?.matchups;
  if (!matchupsObj) return [];
  const count = Number(matchupsObj.count ?? Object.keys(matchupsObj).length);
  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const m = matchupsObj[i]?.matchup;
    if (!m) continue;
    const teamsObj = m[0]?.teams || m.teams;
    const teamCount = Number(teamsObj?.count ?? Object.keys(teamsObj || {}).length);
    const parsedTeams: any[] = [];
    for (let j = 0; j < teamCount; j++) {
      const t = teamsObj[j]?.team;
      if (!t) continue;
      const teamData = Array.isArray(t[0]) ? mergeArrayOfObjects(t[0]) : t[0] || {};
      const pointsData = t[1]?.team_points || t[1]?.points || t[1] || {};
      const projectedData = t[1]?.team_projected_points || {};
      parsedTeams.push({
        ...teamData,
        points: pointsData.total ?? pointsData,
        projected_points: projectedData.total ?? projectedData,
      });
    }
    result.push({
      week: Number(m.week || 0),
      is_playoffs: Boolean(m.is_playoffs === "1" || m.is_playoffs === true),
      winner_team_key: m.winner_team_key ? String(m.winner_team_key) : undefined,
      is_tied: Boolean(m.is_tied === "1" || m.is_tied === true),
      teams: parsedTeams,
    });
  }
  return result;
}

function parseDraftList(rawDraft: any): any[] {
  if (!rawDraft) return [];
  const count = Number(rawDraft.count ?? Object.keys(rawDraft).length);
  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const d = rawDraft[i]?.draft_result || rawDraft[i];
    if (d) result.push(d);
  }
  return result;
}

export class YahooLeagueService {
  private authService: YahooAuthService;
  private sport: string;

  constructor(authService: YahooAuthService, sport = "nfl") {
    this.authService = authService;
    this.sport = process.env.SPORT || sport;
  }

  /**
   * Universal fetcher supporting:
   * 1. Session Cookie via pub-api-ro.fantasysports.yahoo.com (bypasses App ID gate)
   * 2. OAuth Bearer token via fantasysports.yahooapis.com
   */
  async fetchFantasyContent(subPath: string): Promise<any> {
    const cookie = process.env.YAHOO_COOKIE;
    if (cookie && cookie.trim()) {
      const cleanPath = subPath.replace(/^\//, "");
      const separator = cleanPath.includes("?") ? "&" : "?";
      const url = `https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/${cleanPath}${separator}format=json`;

      const response = await fetch(url, {
        headers: {
          Cookie: cookie.trim(),
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 401) {
          throw new Error(
            `HTTP 401 Unauthorized from pub-api-ro. Your YAHOO_COOKIE in .env may be expired: ${text}`
          );
        }
        throw new Error(`HTTP ${response.status} from pub-api-ro: ${text}`);
      }

      const json = await response.json();
      return json?.fantasy_content;
    }

    // OAuth flow fallback
    const yf = await this.authService.getClient(true);
    const data = await yf.api(
      yf.GET,
      `https://fantasysports.yahooapis.com/fantasy/v2/${subPath.replace(/^\//, "")}`
    );
    return data?.fantasy_content;
  }

  /**
   * Normalizes various league key formats:
   * - "482651" -> "nfl.l.482651"
   * - "423_482651" -> "423.l.482651"
   */
  normalizeLeagueKey(rawKey: string): string {
    const trimmed = rawKey.trim();
    if (!trimmed) {
      throw new Error("League key/ID cannot be empty.");
    }

    if (trimmed.includes(".l.")) {
      return trimmed;
    }

    if (trimmed.includes("_")) {
      return trimmed.replace("_", ".l.");
    }

    return `${this.sport}.l.${trimmed}`;
  }

  /**
   * Fetches full data for a specific season / leagueKey
   */
  async fetchSeason(rawLeagueKey: string): Promise<SeasonHistory> {
    const leagueKey = this.normalizeLeagueKey(rawLeagueKey);

    console.log(`[YahooLeagueService] Fetching metadata for ${leagueKey}...`);
    const metaContent = await this.fetchFantasyContent(`league/${leagueKey}/metadata`);
    const meta = metaContent?.league?.[0];

    if (!meta) {
      throw new Error(`No metadata returned for league key: ${leagueKey}`);
    }

    const numTeams = Number(meta.num_teams || 0);
    const startWeek = meta.start_week ? Number(meta.start_week) : 1;
    const endWeek = meta.end_week ? Number(meta.end_week) : 17;
    const currentWeek = meta.current_week ? Number(meta.current_week) : endWeek;

    // Normalizing renew references
    const renewedFrom = meta.renew
      ? this.normalizeLeagueKey(String(meta.renew))
      : null;
    const renewedTo = meta.renewed
      ? this.normalizeLeagueKey(String(meta.renewed))
      : null;

    // Fetch Teams
    console.log(`[YahooLeagueService] Fetching teams for ${leagueKey}...`);
    let teams: TeamRecord[] = [];
    try {
      const teamsContent = await this.fetchFantasyContent(`league/${leagueKey}/teams`);
      const rawTeams = teamsContent?.league?.[1]?.teams;
      const parsedTeams = parseTeamsList(rawTeams);

      teams = parsedTeams.map((t: any) => {
        const managers: ManagerRecord[] = (t.managers || []).map((m: any) => ({
          managerId: String(m.manager_id || ""),
          nickname: String(m.nickname || ""),
          guid: m.guid ? String(m.guid) : undefined,
          isCommissioner: Boolean(m.is_commissioner === "1" || m.is_commissioner === true),
        }));

        const logoUrl =
          t.team_logos && t.team_logos.length > 0 ? t.team_logos[0] : undefined;

        return {
          teamKey: String(t.team_key),
          teamId: String(t.team_id),
          name: String(t.name),
          logoUrl,
          managers,
        };
      });
    } catch (err: any) {
      console.warn(`[YahooLeagueService] Notice: Could not fetch teams for ${leagueKey}: ${err.message || err}`);
    }

    // Fetch Standings
    console.log(`[YahooLeagueService] Fetching standings for ${leagueKey}...`);
    let standings: SeasonStandings[] = [];
    try {
      const standingsContent = await this.fetchFantasyContent(`league/${leagueKey}/standings`);
      const rawStandingsTeams = standingsContent?.league?.[1]?.standings?.[0]?.teams;
      const parsedStandings = parseStandingsList(rawStandingsTeams);

      standings = parsedStandings.map((t: any) => {
        const st = t.standings || {};
        const outcome = st.outcome_totals || {};
        const managerName =
          t.managers && t.managers.length > 0
            ? t.managers[0].nickname || t.managers[0].manager_id
            : "";

        return {
          rank: Number(st.rank || 0),
          teamKey: String(t.team_key),
          teamName: String(t.name),
          managerName: String(managerName),
          wins: Number(outcome.wins || 0),
          losses: Number(outcome.losses || 0),
          ties: Number(outcome.ties || 0),
          pointsFor: Number(st.points_for || 0),
          pointsAgainst: Number(st.points_against || 0),
          streak: st.streak
            ? {
                type: String(st.streak.type || ""),
                value: Number(st.streak.value || 0),
              }
            : undefined,
        };
      });
    } catch (err: any) {
      console.warn(`[YahooLeagueService] Notice: Could not fetch standings for ${leagueKey}: ${err.message || err}`);
    }

    // Fetch Matchups (Scoreboards) if Head-to-Head
    const matchups: MatchupRecord[] = [];
    const isHeadToHead = String(meta.scoring_type).toLowerCase().includes("head");
    if (isHeadToHead) {
      const maxWeekToFetch = Math.min(currentWeek, endWeek);
      console.log(
        `[YahooLeagueService] Fetching weekly matchups (weeks ${startWeek} to ${maxWeekToFetch}) for ${leagueKey}...`
      );

      for (let week = startWeek; week <= maxWeekToFetch; week++) {
        try {
          const sbContent = await this.fetchFantasyContent(`league/${leagueKey}/scoreboard;week=${week}`);
          const rawSb = sbContent?.league?.[1]?.scoreboard;
          const weeklyMatchups = parseScoreboardList(rawSb);

          for (const m of weeklyMatchups) {
            if (!m.teams || m.teams.length < 2) continue;

            const t1 = m.teams[0];
            const t2 = m.teams[1];

            const team1Score: MatchupTeamScore = {
              teamKey: String(t1.team_key),
              teamName: String(t1.name || ""),
              points: Number(t1.points ?? 0),
              projectedPoints: t1.projected_points !== undefined ? Number(t1.projected_points) : undefined,
            };

            const team2Score: MatchupTeamScore = {
              teamKey: String(t2.team_key),
              teamName: String(t2.name || ""),
              points: Number(t2.points ?? 0),
              projectedPoints: t2.projected_points !== undefined ? Number(t2.projected_points) : undefined,
            };

            matchups.push({
              week,
              isPlayoffs: Boolean(m.is_playoffs),
              teams: [team1Score, team2Score],
              winnerTeamKey: m.winner_team_key ? String(m.winner_team_key) : undefined,
              isTied: Boolean(m.is_tied),
            });
          }
        } catch (err: any) {
          console.warn(
            `[YahooLeagueService] Notice: Could not fetch scoreboard for week ${week} of ${leagueKey}: ${err.message || err}`
          );
        }
      }
    }

    // Fetch Draft Results
    let draftResults: DraftPickRecord[] = [];
    try {
      console.log(`[YahooLeagueService] Fetching draft results for ${leagueKey}...`);
      const draftContent = await this.fetchFantasyContent(`league/${leagueKey}/draftresults`);
      const rawDraft = draftContent?.league?.[1]?.draft_results;
      const parsedDraft = parseDraftList(rawDraft);

      draftResults = parsedDraft.map((d: any) => ({
        round: Number(d.round || 0),
        pick: Number(d.pick || 0),
        teamKey: String(d.team_key || ""),
        playerKey: String(d.player_key || ""),
        playerName: d.player_name ? String(d.player_name) : undefined,
      }));
    } catch {
      // Draft results often unavailable for older leagues
    }

    return {
      season: String(meta.season || ""),
      leagueKey: String(meta.league_key || leagueKey),
      leagueId: String(meta.league_id || ""),
      name: String(meta.name || ""),
      numTeams,
      scoringType: String(meta.scoring_type || ""),
      currentWeek,
      startWeek,
      endWeek,
      renewedFromLeagueKey: renewedFrom,
      renewedToLeagueKey: renewedTo,
      teams,
      standings,
      matchups: matchups.length > 0 ? matchups : undefined,
      draftResults: draftResults.length > 0 ? draftResults : undefined,
    };
  }

  /**
   * Fetches single season to test connection and output JSON.
   */
  async fetchSingleSeason(targetKey?: string): Promise<HistoricalLeagueExport> {
    const rawKey = targetKey || process.env.LEAGUE_ID;
    if (!rawKey) {
      throw new Error("No league key or LEAGUE_ID provided.");
    }

    const seasonData = await this.fetchSeason(rawKey);

    const summary: LeagueSummary = {
      leagueId: seasonData.leagueId,
      name: seasonData.name,
      sport: this.sport,
      currentSeason: seasonData.season,
      totalSeasonsFetched: 1,
      inauguralSeason: seasonData.season,
      fetchedAt: new Date().toISOString(),
    };

    return {
      summary,
      seasons: [seasonData],
    };
  }

  /**
   * Traverses backward through all renewed seasons to extract full league history.
   */
  async fetchFullHistory(startingKey?: string): Promise<HistoricalLeagueExport> {
    const rawKey = startingKey || process.env.LEAGUE_ID;
    if (!rawKey) {
      throw new Error("No league key or LEAGUE_ID provided.");
    }

    const seasons: SeasonHistory[] = [];
    const visitedKeys = new Set<string>();
    let currentKey: string | null = this.normalizeLeagueKey(rawKey);

    console.log(`\nStarting historical traversal starting from: ${currentKey}...`);

    while (currentKey && !visitedKeys.has(currentKey)) {
      visitedKeys.add(currentKey);

      const seasonData = await this.fetchSeason(currentKey);
      seasons.push(seasonData);

      console.log(
        `✓ Captured season ${seasonData.season} (${seasonData.name}) - ${seasonData.standings.length} teams, ${seasonData.matchups?.length || 0} matchups`
      );

      if (seasonData.renewedFromLeagueKey) {
        console.log(`Found prior season link: ${seasonData.renewedFromLeagueKey}`);
        currentKey = this.normalizeLeagueKey(seasonData.renewedFromLeagueKey);
      } else {
        console.log(`Reached inaugural season (${seasonData.season}). No further renewals found.`);
        currentKey = null;
      }
    }

    const inauguralSeason = seasons[seasons.length - 1]?.season || seasons[0]?.season;
    const currentSeason = seasons[0]?.season || "";

    const summary: LeagueSummary = {
      leagueId: seasons[0]?.leagueId || "",
      name: seasons[0]?.name || "",
      sport: this.sport,
      currentSeason,
      totalSeasonsFetched: seasons.length,
      inauguralSeason,
      fetchedAt: new Date().toISOString(),
    };

    return {
      summary,
      seasons,
    };
  }
}
