-- Migration: 20261123140000_add_aggregate_tables.sql
-- Description: Add persistent tables for manager career stats, head-to-head records, and top 10 league records

-- 8. Manager Career Stats
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

-- 9. Head to Head Records
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

-- 10. League Records
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
