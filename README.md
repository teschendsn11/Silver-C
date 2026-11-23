# Silver Cock Service

A backend service and data pipeline for extracting, archiving, and querying Yahoo Fantasy Football league data across all historical seasons into a local PostgreSQL database.

## Architecture

- **Phase 1 (Complete)**: OAuth 2.0 flow, single-season test extraction to JSON, full historical renewal-chain crawler, and data contracts.
- **Phase 2 (Current)**: Local PostgreSQL database (Docker Compose), Atlas schema migrations (`schema.sql` -> `migrations/` via `atlas.hcl`), and data ingestion pipeline (`bun run ingest`).
- **Phase 3 (Future)**: Client-facing query endpoints or GraphQL/tRPC layer for the client application.

---

## Getting Started

### 1. Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [Docker](https://www.docker.com) (for local PostgreSQL)
- [Atlas](https://atlasgo.io) CLI (for schema migrations):
  ```sh
  brew install ariga/tap/atlas
  ```

### 2. Install Dependencies & Configure Environment

```sh
bun install
```

Configure your `.env` file:

```env
YAHOO_CLIENT_KEY=your_yahoo_consumer_key
YAHOO_CLIENT_SECRET=your_yahoo_consumer_secret
YAHOO_REDIRECT_URI=oob
LEAGUE_ID=your_yahoo_league_id
SPORT=nfl
DATABASE_URL=postgres://postgres:postgres@localhost:5432/silver_cock
```

---

## Database Management (Docker & Atlas)

### Start and Stop Local PostgreSQL

```sh
# Start Postgres in background
bun run db:up

# Stop Postgres
bun run db:down

# Wipe database, restart container, and re-apply all migrations
bun run db:reset
```

### Atlas Migration Commands

```sh
# Apply pending migrations to local Postgres
bun run db:apply

# Check migration status
bun run db:status

# Generate a new migration after modifying schema.sql
bun run db:diff add_new_column

# Run safety linter on latest migration
bun run db:lint
```

---

## Data Pipeline Commands

### 1. Extract League Data from Yahoo

```sh
# Test connection: fetch single season to JSON
bun run fetch

# Fetch full historical league archive
bun run fetch:all
```
Extracted JSON payloads are saved to `output/latest-league.json`.

### 2. Ingest League Data into PostgreSQL

Once your database is running (`bun run db:up`) and migrations are applied (`bun run db:apply`), ingest your extracted JSON:

```sh
bun run ingest
```
You can also specify a custom file:
```sh
bun run ingest --file=output/league-12345-history.json
```

---

## HTTP Server Mode

Run the local development server:

```sh
bun run dev
```

Server endpoints available at `http://localhost:3000`:
- `GET /`: Health and endpoint directory
- `GET /api/league/test`: Fetch single season data from Yahoo
- `GET /api/league/history`: Fetch full historical archive from Yahoo
- `GET /auth/url`: Get OAuth 2.0 authorization URL
- `GET /auth/callback`: OAuth callback handler

---

## Project Structure

```
├── docker-compose.yml         # Local PostgreSQL container definition
├── atlas.hcl                  # Atlas migration configuration
├── schema.sql                 # Declarative database DDL
├── migrations/                # Version-controlled SQL migrations + atlas.sum
├── output/                    # Exported JSON dumps (git-ignored)
├── PLAN.md                    # Architecture design and roadmap
├── AGENTS.md                  # Developer & AI agent context guide
├── src/
│   ├── db/
│   │   └── client.ts          # Native Bun SQL connection pool
│   ├── service/
│   │   ├── yahooAuth.ts       # OAuth token manager & CLI prompt
│   │   ├── yahooLeagueService.ts # Historical crawler and scoreboard loop
│   │   └── dbService.ts       # Database upsert & ingestion pipeline
│   ├── scripts/
│   │   ├── fetchLeagueData.ts # Data extraction CLI runner
│   │   └── ingestLeagueData.ts# Database ingestion CLI runner
│   ├── types/
│   │   └── league.ts          # TypeScript relational interfaces
│   └── index.ts               # Hono HTTP server
└── package.json
```
