-- Declarative schema for Yahoo Fantasy Football League Archive
-- Managed via Atlas (atlas.hcl)

-- 1. Leagues: Overall fantasy league profile
CREATE TABLE IF NOT EXISTS leagues (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sport VARCHAR(32) NOT NULL DEFAULT 'nfl',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seasons: Annual season instance of a league
CREATE TABLE IF NOT EXISTS seasons (
    id VARCHAR(64) PRIMARY KEY,
    league_id VARCHAR(64) NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_year VARCHAR(8) NOT NULL,
    name VARCHAR(255) NOT NULL,
    num_teams INTEGER NOT NULL DEFAULT 0,
    scoring_type VARCHAR(64) NOT NULL DEFAULT 'head',
    current_week INTEGER,
    start_week INTEGER NOT NULL DEFAULT 1,
    end_week INTEGER NOT NULL DEFAULT 17,
    renewed_from_league_key VARCHAR(64),
    renewed_to_league_key VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_season_league_year UNIQUE (league_id, season_year)
);

CREATE INDEX IF NOT EXISTS idx_seasons_league_id ON seasons(league_id);

-- 3. Teams: Teams participating in each season
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(64) PRIMARY KEY, -- e.g. "449.l.12345.t.1"
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    team_id VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams(season_id);

-- 4. Managers: Team owners and co-managers
CREATE TABLE IF NOT EXISTS managers (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(64) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    manager_id VARCHAR(64) NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    guid VARCHAR(128),
    is_commissioner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_managers_team_id ON managers(team_id);

-- 5. Standings: Final regular-season records and rankings
CREATE TABLE IF NOT EXISTS standings (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    team_id VARCHAR(64) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    ties INTEGER NOT NULL DEFAULT 0,
    points_for NUMERIC(10, 2) NOT NULL DEFAULT 0,
    points_against NUMERIC(10, 2) NOT NULL DEFAULT 0,
    streak_type VARCHAR(16),
    streak_value INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_standings_season_team UNIQUE (season_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_standings_season_id ON standings(season_id);

-- 6. Matchups: Weekly head-to-head match outcomes
CREATE TABLE IF NOT EXISTS matchups (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    is_playoffs BOOLEAN NOT NULL DEFAULT FALSE,
    team1_id VARCHAR(64) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team1_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
    team1_projected NUMERIC(10, 2),
    team2_id VARCHAR(64) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team2_score NUMERIC(10, 2) NOT NULL DEFAULT 0,
    team2_projected NUMERIC(10, 2),
    winner_team_id VARCHAR(64) REFERENCES teams(id) ON DELETE SET NULL,
    is_tied BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_matchup_week_teams UNIQUE (season_id, week, team1_id, team2_id)
);

CREATE INDEX IF NOT EXISTS idx_matchups_season_week ON matchups(season_id, week);

-- 7. Draft Picks: Annual fantasy draft selections
CREATE TABLE IF NOT EXISTS draft_picks (
    id SERIAL PRIMARY KEY,
    season_id VARCHAR(64) NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    team_id VARCHAR(64) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    pick INTEGER NOT NULL,
    player_key VARCHAR(64) NOT NULL,
    player_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_draft_picks_season_round_pick UNIQUE (season_id, round, pick)
);

CREATE INDEX IF NOT EXISTS idx_draft_picks_season_id ON draft_picks(season_id);

-- 8. Manager Career Stats: All-time career totals, rings, and efficiency
CREATE TABLE IF NOT EXISTS manager_career_stats (
    id SERIAL PRIMARY KEY,
    league_id VARCHAR(64) NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    manager_guid VARCHAR(128) NOT NULL,
    nickname VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    seasons_count INTEGER NOT NULL DEFAULT 0,
    championships INTEGER NOT NULL DEFAULT 0,
    runner_ups INTEGER NOT NULL DEFAULT 0,
    podiums INTEGER NOT NULL DEFAULT 0,
    sackos INTEGER NOT NULL DEFAULT 0,
    playoff_appearances INTEGER NOT NULL DEFAULT 0,
    reg_wins INTEGER NOT NULL DEFAULT 0,
    reg_losses INTEGER NOT NULL DEFAULT 0,
    reg_ties INTEGER NOT NULL DEFAULT 0,
    reg_win_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    playoff_wins INTEGER NOT NULL DEFAULT 0,
    playoff_losses INTEGER NOT NULL DEFAULT 0,
    playoff_win_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    points_for NUMERIC(10, 2) NOT NULL DEFAULT 0,
    points_against NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ppg_average NUMERIC(6, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_manager_career UNIQUE (league_id, manager_guid)
);

CREATE INDEX IF NOT EXISTS idx_manager_career_league_id ON manager_career_stats(league_id);

-- 9. Head to Head Records: Rivalry matrix between managers
CREATE TABLE IF NOT EXISTS head_to_head_records (
    id SERIAL PRIMARY KEY,
    league_id VARCHAR(64) NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    manager1_guid VARCHAR(128) NOT NULL,
    manager1_name VARCHAR(255) NOT NULL,
    manager2_guid VARCHAR(128) NOT NULL,
    manager2_name VARCHAR(255) NOT NULL,
    total_matchups INTEGER NOT NULL DEFAULT 0,
    reg_wins INTEGER NOT NULL DEFAULT 0,
    reg_losses INTEGER NOT NULL DEFAULT 0,
    reg_ties INTEGER NOT NULL DEFAULT 0,
    playoff_wins INTEGER NOT NULL DEFAULT 0,
    playoff_losses INTEGER NOT NULL DEFAULT 0,
    manager1_points NUMERIC(10, 2) NOT NULL DEFAULT 0,
    manager2_points NUMERIC(10, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_head_to_head UNIQUE (league_id, manager1_guid, manager2_guid)
);

CREATE INDEX IF NOT EXISTS idx_h2h_league_m1 ON head_to_head_records(league_id, manager1_guid);

-- 10. League Records: Top all-time single-game and matchup extremes
CREATE TABLE IF NOT EXISTS league_records (
    id SERIAL PRIMARY KEY,
    league_id VARCHAR(64) NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    record_type VARCHAR(64) NOT NULL,
    rank INTEGER NOT NULL,
    season_year VARCHAR(8) NOT NULL,
    week INTEGER NOT NULL,
    is_playoffs BOOLEAN NOT NULL DEFAULT FALSE,
    primary_manager_name VARCHAR(255) NOT NULL,
    primary_manager_guid VARCHAR(128),
    primary_team_name VARCHAR(255) NOT NULL,
    primary_score NUMERIC(10, 2) NOT NULL,
    secondary_manager_name VARCHAR(255),
    secondary_manager_guid VARCHAR(128),
    secondary_team_name VARCHAR(255),
    secondary_score NUMERIC(10, 2),
    margin NUMERIC(10, 2),
    combined_score NUMERIC(10, 2),
    details TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_league_record_rank UNIQUE (league_id, record_type, rank)
);

CREATE INDEX IF NOT EXISTS idx_league_records_league_type ON league_records(league_id, record_type);
