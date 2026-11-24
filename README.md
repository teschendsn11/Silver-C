# Silver Cock Service

A backend service, data pipeline, and analytics API for extracting, archiving, and querying Yahoo Fantasy Football league data across all historical seasons (2010–2026) into a local PostgreSQL database for consumption by a separate client application.

---

## Architecture Overview

- **Phase 1 (Complete)**: OAuth 2.0 flow, single-season test extraction to JSON, full historical renewal-chain crawler (17 seasons dumped into `output/latest-league.json`).
- **Phase 2 (Complete)**: Local PostgreSQL database, Bun native migrations (`bun run db:migrate`), and hybrid ingestion pipeline (`bun run ingest`) storing both raw granular data and pre-aggregated analytics tables.
- **Phase 3 (Complete)**: Analytics calculation engine, cross-era manager GUID identity resolution, terminal leaderboards (`bun run analytics`), and Hono REST query endpoints.

---

## Getting Started

### 1. Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Docker](https://www.docker.com) (or a local PostgreSQL installation via Homebrew / Postgres.app)
- *(Optional)* [Atlas](https://atlasgo.io) CLI (only if you want to generate automated schema diffs)

### 2. Install Dependencies & Configure Environment

```sh
bun install
```

Configure your `.env` file:

```env
YAHOO_CLIENT_KEY=your_yahoo_consumer_key
YAHOO_CLIENT_SECRET=your_yahoo_consumer_secret
YAHOO_REDIRECT_URI=oob
LEAGUE_ID=482651
SPORT=nfl
DATABASE_URL=postgres://postgres:postgres@localhost:5432/silver_cock
```

---

## Operational Workflow: When to Run What

Follow this lifecycle when operating the service:

```mermaid
flowchart TD
    A["1. Extraction<br/>bun run fetch / fetch:all"] -->|Writes output/latest-league.json| B["2. Database Setup<br/>bun run db:up && bun run db:migrate"]
    B --> C["3. Ingestion<br/>bun run ingest"]
    C -->|Auto-persists raw & aggregates| D["4. Querying & Display<br/>bun run analytics OR bun run dev"]
```

| Command | Purpose | When to Run |
| :--- | :--- | :--- |
| `bun run fetch:all` | Crawls historical Yahoo renewal chain backwards to 2010 and saves full archive to `output/latest-league.json`. | **Initial setup**, or whenever re-crawling all past seasons. |
| `bun run fetch` | Extracts only the current active season to JSON. | **Weekly during season** (e.g. Tuesday morning after Monday Night Football). |
| `bun run db:up` | Starts local PostgreSQL container in the background. | Whenever you want to run PostgreSQL via Docker. |
| `bun run db:migrate` | Applies pending `.sql` migration files to PostgreSQL using Bun's native SQL client (no external CLI needed). | **First-time DB setup**, or whenever database schema changes. |
| `bun run ingest` | Ingests `output/latest-league.json` into PostgreSQL raw tables and **automatically computes and persists all-time aggregates** (Hall of Fame, records, rivalries). | **Right after running `fetch` or `fetch:all`** to sync data into the database. |
| `bun run analytics` | Computes and displays the all-time Hall of Fame, Top 10 single-game records, and season-level awards in your terminal. | **Anytime**! Works standalone from JSON even if the database is offline. |
| `bun run dev` | Starts local Hono REST API server on `http://localhost:3000`. | Whenever your client frontend application needs to consume data. |
| `bun test` | Runs the automated test suite verifying analytics calculations and API routes. | After modifying analytics or route logic. |

---

## Detailed Command Reference

### 1. Extracting League Data from Yahoo

```sh
# Fetch entire 17-season historical archive (2010–present)
bun run fetch:all

# Fetch single season (current active season)
bun run fetch
```
Extracted JSON payloads are saved to `output/latest-league.json`.

---

### 2. Database Management & Migrations

```sh
# Start PostgreSQL container via Docker
bun run db:up

# Stop PostgreSQL container
bun run db:down

# Apply pending migrations using Bun native SQL runner
bun run db:migrate

# Reset database (wipe volume, start fresh, re-apply migrations)
bun run db:reset
```

*(Note: Atlas CLI commands like `bun run db:apply`, `bun run db:diff`, and `bun run db:lint` are also available if you install the Atlas binary).*

---

### 3. Ingesting League Data into PostgreSQL

Once your database is running and migrations are applied, ingest your extracted JSON:

```sh
bun run ingest
```
This performs atomic upserts of:
- **Raw tables**: `leagues`, `seasons`, `teams`, `managers`, `standings`, `matchups`, `draft_picks`
- **Persistent aggregate tables**: `manager_career_stats`, `head_to_head_records`, `league_records`

You can also specify a custom file path:
```sh
bun run ingest --file=output/league-482651-history.json
```

---

### 4. Viewing Historical Analytics in Terminal

Run the analytics CLI runner to print all calculated leaderboards directly in your shell:

```sh
bun run analytics
```

**Includes**:
* **🏆 Hall of Fame Leaderboard**: Manager career records, active years, championships, podiums, sackos, win %, PPG, and all-time Points For.
* **📌 Top 10 Single-Game Records**:
  - Highest Single-Game Team Scores (Brian Diedrich: 234.66 pts)
  - Biggest Blowouts (Nate: +187.30 margin)
  - Highest Scoring Shootouts (355.68 combined pts)
  - Closest Nailbiters (0.02 pt margin)
  - Tough Luck Losses (Highest score in an L)
* **🎖️ Season-Level Extremes & Awards**:
  - Highest Scoring Seasons (Nate: 141.86 PPG)
  - Worst Winners / Lucky Champions (Nate 2010: 89.68 PPG; VC 2017: 101.78 PPG)
  - Highest Scoring Dildo / Unluckiest Sacko (Ross G 2024: 108.63 PPG)
  - Lowest Scoring Dildo / Most Pathetic Sacko (Plum Smugglers 2010: 76.52 PPG)
  - Biggest Chokes (Highest scoring teams that missed the title)
  - Unluckiest Schedules (Adam Cotter 2020: 122.66 Points Against per game)
  - Luckiest Schedules (Nate 2010: 75.94 Points Against per game)

---

### 5. HTTP REST API Server Mode

Start the development server:

```sh
bun run dev
```

Available endpoints at `http://localhost:3000`:

| Endpoint | Description |
| :--- | :--- |
| `GET /` | Health check and endpoint directory |
| `GET /api/leagues` | Overview of archived leagues |
| `GET /api/leagues/:id/hall-of-fame` | Career leaderboard (rings, podiums, sackos, win %, PPG) |
| `GET /api/leagues/:id/records` | All-time records (supports `?type=worst_winner`, `?type=highest_dildo`, `?type=highest_score`, etc.) |
| `GET /api/leagues/:id/rivalries` | Head-to-head match records (optional `?m1=<guid>&m2=<guid>`) |
| `GET /api/leagues/:id/managers/:guid` | Manager career card and seasonal team history |
| `GET /api/leagues/:id/seasons` | List of all 17 historical seasons and champions |
| `GET /api/leagues/:id/seasons/:season` | Single season standings and roster metadata |
| `GET /api/leagues/:id/seasons/:season/matchups` | Weekly matchups & box scores (supports `?week=1` and `?playoffs=true`) |
| `GET /auth/url` | Get Yahoo OAuth 2.0 authorization URL |
| `GET /auth/callback` | OAuth code exchange callback handler |

> **Offline Resiliency**: If PostgreSQL is not currently running, API endpoints automatically fall back to calculating and serving responses directly from `output/latest-league.json` in memory.

---

## Project Structure

```
├── docker-compose.yml         # Local PostgreSQL container definition
├── atlas.hcl                  # Atlas migration configuration
├── schema.sql                 # Declarative database DDL (granular + aggregate tables)
├── migrations/                # Version-controlled SQL migrations
├── output/                    # Exported Yahoo JSON dumps (git-ignored)
├── PLAN.md                    # Architecture design and roadmap
├── AGENTS.md                  # Developer & AI agent context guide
├── tests/
│   └── analytics.test.ts      # Automated test suite (bun test)
├── src/
│   ├── db/
│   │   └── client.ts          # Native Bun SQL connection pool
│   ├── routes/
│   │   └── analyticsRoutes.ts # Hono REST API route handlers
│   ├── service/
│   │   ├── analyticsService.ts# Calculations engine & GUID identity resolver
│   │   ├── dbService.ts       # Database upsert & ingestion pipeline
│   │   ├── yahooAuth.ts       # OAuth token manager & CLI prompt
│   │   └── yahooLeagueService.ts # Historical crawler and scoreboard loop
│   ├── scripts/
│   │   ├── fetchLeagueData.ts # Data extraction CLI runner
│   │   ├── ingestLeagueData.ts# Database ingestion CLI runner
│   │   ├── migrate.ts         # Native Bun SQL migration runner
│   │   ├── showAnalytics.ts   # Terminal analytics & leaderboards runner
│   │   └── listMyLeagues.ts   # User leagues query script
│   ├── types/
│   │   └── league.ts          # TypeScript relational interfaces
│   └── index.ts               # Hono HTTP server
└── package.json
```
