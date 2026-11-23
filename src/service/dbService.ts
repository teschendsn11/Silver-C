import { getDb } from "../db/client";
import type {
  HistoricalLeagueExport,
  SeasonHistory,
} from "../types/league";

export interface IngestionSummary {
  leaguesCount: number;
  seasonsCount: number;
  teamsCount: number;
  managersCount: number;
  standingsCount: number;
  matchupsCount: number;
  draftPicksCount: number;
}

export class DatabaseIngestService {
  /**
   * Ingests full HistoricalLeagueExport payload into PostgreSQL.
   */
  async ingestLeagueExport(payload: HistoricalLeagueExport): Promise<IngestionSummary> {
    const sql = getDb();
    const summary = payload.summary;

    let seasonsCount = 0;
    let teamsCount = 0;
    let managersCount = 0;
    let standingsCount = 0;
    let matchupsCount = 0;
    let draftPicksCount = 0;

    console.log(`[DatabaseIngest] Starting ingestion for league: ${summary.name} (${summary.leagueId})...`);

    // 1. Upsert League
    await sql`
      INSERT INTO leagues (id, name, sport, updated_at)
      VALUES (${summary.leagueId}, ${summary.name}, ${summary.sport}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        sport = EXCLUDED.sport,
        updated_at = NOW();
    `;

    // 2. Ingest Seasons
    for (const season of payload.seasons) {
      await this.ingestSeason(season, summary.leagueId);
      seasonsCount++;
      teamsCount += season.teams.length;
      managersCount += season.teams.reduce((acc, t) => acc + (t.managers?.length || 0), 0);
      standingsCount += season.standings.length;
      matchupsCount += season.matchups?.length || 0;
      draftPicksCount += season.draftResults?.length || 0;
    }

    console.log(`[DatabaseIngest] Successfully ingested ${seasonsCount} seasons for ${summary.name}!`);

    return {
      leaguesCount: 1,
      seasonsCount,
      teamsCount,
      managersCount,
      standingsCount,
      matchupsCount,
      draftPicksCount,
    };
  }

  /**
   * Ingests a single SeasonHistory record into PostgreSQL.
   */
  async ingestSeason(season: SeasonHistory, leagueId: string): Promise<void> {
    const sql = getDb();

    console.log(`[DatabaseIngest] Ingesting season ${season.season} (${season.leagueKey})...`);

    // Upsert Season
    await sql`
      INSERT INTO seasons (
        id, league_id, season_year, name, num_teams, scoring_type,
        current_week, start_week, end_week, renewed_from_league_key,
        renewed_to_league_key, updated_at
      )
      VALUES (
        ${season.leagueKey},
        ${leagueId},
        ${season.season},
        ${season.name},
        ${season.numTeams},
        ${season.scoringType},
        ${season.currentWeek ?? null},
        ${season.startWeek ?? 1},
        ${season.endWeek ?? 17},
        ${season.renewedFromLeagueKey ?? null},
        ${season.renewedToLeagueKey ?? null},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        num_teams = EXCLUDED.num_teams,
        scoring_type = EXCLUDED.scoring_type,
        current_week = EXCLUDED.current_week,
        start_week = EXCLUDED.start_week,
        end_week = EXCLUDED.end_week,
        renewed_from_league_key = EXCLUDED.renewed_from_league_key,
        renewed_to_league_key = EXCLUDED.renewed_to_league_key,
        updated_at = NOW();
    `;

    // Upsert Teams & Managers
    for (const team of season.teams) {
      await sql`
        INSERT INTO teams (id, season_id, team_id, name, logo_url)
        VALUES (
          ${team.teamKey},
          ${season.leagueKey},
          ${team.teamId},
          ${team.name},
          ${team.logoUrl ?? null}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          logo_url = EXCLUDED.logo_url;
      `;

      // Clear existing managers for this team and re-insert
      await sql`DELETE FROM managers WHERE team_id = ${team.teamKey};`;

      for (const m of team.managers || []) {
        await sql`
          INSERT INTO managers (team_id, manager_id, nickname, guid, is_commissioner)
          VALUES (
            ${team.teamKey},
            ${m.managerId},
            ${m.nickname},
            ${m.guid ?? null},
            ${m.isCommissioner ?? false}
          );
        `;
      }
    }

    // Upsert Standings
    for (const st of season.standings) {
      await sql`
        INSERT INTO standings (
          season_id, team_id, rank, wins, losses, ties, points_for, points_against, streak_type, streak_value
        )
        VALUES (
          ${season.leagueKey},
          ${st.teamKey},
          ${st.rank},
          ${st.wins},
          ${st.losses},
          ${st.ties},
          ${st.pointsFor},
          ${st.pointsAgainst},
          ${st.streak?.type ?? null},
          ${st.streak?.value ?? null}
        )
        ON CONFLICT (season_id, team_id) DO UPDATE SET
          rank = EXCLUDED.rank,
          wins = EXCLUDED.wins,
          losses = EXCLUDED.losses,
          ties = EXCLUDED.ties,
          points_for = EXCLUDED.points_for,
          points_against = EXCLUDED.points_against,
          streak_type = EXCLUDED.streak_type,
          streak_value = EXCLUDED.streak_value;
      `;
    }

    // Upsert Matchups
    if (season.matchups && season.matchups.length > 0) {
      for (const m of season.matchups) {
        if (!m.teams || m.teams.length < 2) continue;
        const t1 = m.teams[0];
        const t2 = m.teams[1];

        await sql`
          INSERT INTO matchups (
            season_id, week, is_playoffs, team1_id, team1_score, team1_projected,
            team2_id, team2_score, team2_projected, winner_team_id, is_tied
          )
          VALUES (
            ${season.leagueKey},
            ${m.week},
            ${m.isPlayoffs},
            ${t1.teamKey},
            ${t1.points},
            ${t1.projectedPoints ?? null},
            ${t2.teamKey},
            ${t2.points},
            ${t2.projectedPoints ?? null},
            ${m.winnerTeamKey ?? null},
            ${m.isTied ?? false}
          )
          ON CONFLICT (season_id, week, team1_id, team2_id) DO UPDATE SET
            team1_score = EXCLUDED.team1_score,
            team1_projected = EXCLUDED.team1_projected,
            team2_score = EXCLUDED.team2_score,
            team2_projected = EXCLUDED.team2_projected,
            winner_team_id = EXCLUDED.winner_team_id,
            is_tied = EXCLUDED.is_tied;
        `;
      }
    }

    // Upsert Draft Picks
    if (season.draftResults && season.draftResults.length > 0) {
      for (const d of season.draftResults) {
        await sql`
          INSERT INTO draft_picks (
            season_id, team_id, round, pick, player_key, player_name
          )
          VALUES (
            ${season.leagueKey},
            ${d.teamKey},
            ${d.round},
            ${d.pick},
            ${d.playerKey},
            ${d.playerName ?? null}
          )
          ON CONFLICT (season_id, round, pick) DO UPDATE SET
            team_id = EXCLUDED.team_id,
            player_key = EXCLUDED.player_key,
            player_name = EXCLUDED.player_name;
        `;
      }
    }
  }
}
