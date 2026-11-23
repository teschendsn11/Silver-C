# AGENTS.md - Developer & AI Agent Context Guide

This document gives AI agents (and human developers) the immediate context needed to resume, extend, or debug work in this workspace without re-discovering the codebase from scratch.

---

## 1. Project Mission & Context

- **Repository**: `silver-cock-service` (part of `yahoo-silver-cock`)
- **Primary Goal**: Extract and archive Yahoo Fantasy Football league data across all historical seasons into database-ready structures, and eventually store that data in a local database for consumption by a separate client application.
- **Current Phase**:
  - Phase 1 (Complete): OAuth 2.0 flow, single-season test extraction to JSON, full historical renewal-chain crawler, and data contracts.
  - Phase 2 (In Progress): Local PostgreSQL database (Docker Compose), Atlas schema migrations (`schema.sql` -> `migrations/` via `atlas.hcl`), and ingestion pipeline.
  - Phase 3 (Future): Client-facing query endpoints or GraphQL/tRPC layer for the client application.

---

## 2. Runtime & Tooling Conventions

- **Runtime**: **Bun** (`bun`) only. Do not invoke `npm` or `node`.
- **Package Manager**: `bun` or `pnpm`.
- **Framework**: Hono (`hono`).
- **Language**: TypeScript (strict mode enabled in `tsconfig.json`).
- **Core Library**: `yahoo-fantasy` (v5.4.1). Note that this is an untyped JavaScript library; typed interfaces are defined locally in `src/types/league.ts`.

---

## 3. Environment & Authentication Architecture

- **Credentials (`.env`)**:
  - `YAHOO_CLIENT_KEY`: Yahoo App consumer key.
  - `YAHOO_CLIENT_SECRET`: Yahoo App consumer secret.
  - `YAHOO_REDIRECT_URI`: Set to `oob` (Out of Band) by default.
  - `LEAGUE_ID`: 5-digit Yahoo league ID.
  - `SPORT`: Defaults to `nfl`.
- **Token Cache (`.tokens.json`)**:
  - Stores `access_token` and `refresh_token`.
  - Git-ignored.
  - Managed by `src/service/yahooAuth.ts`.
  - When tokens expire (1 hour), `yahoo-fantasy` automatically triggers the refresh callback and updates `.tokens.json`.

---

## 4. Key Files & Architecture

| File | Purpose |
|---|---|
| `PLAN.md` | Approved architecture design document. |
| `src/types/league.ts` | Relational TypeScript models (`LeagueSummary`, `SeasonHistory`, `TeamRecord`, `SeasonStandings`, `MatchupRecord`, `DraftPickRecord`). |
| `src/service/yahooAuth.ts` | OAuth lifecycle, code exchange, token persistence, and CLI prompt. |
| `src/service/yahooLeagueService.ts` | League API client, metadata fetcher, weekly scoreboard loop, and renewal crawler. |
| `src/scripts/fetchLeagueData.ts` | CLI entry point (`bun run fetch` and `bun run fetch:all`). |
| `src/index.ts` | Hono server exposing `/api/league/test` and `/api/league/history`. |
| `output/` | Directory where exported JSON files are saved (`output/latest-league.json`). |

---

## 5. Standard Verification & Test Commands

```sh
# Typecheck & build
bun build --target=bun src/index.ts
bun build --target=bun src/scripts/fetchLeagueData.ts

# Test single season pull (connection verification)
bun run fetch

# Run full historical crawl
bun run fetch:all

# Run local API server
bun run dev
```

---

## 6. Immediate Next Steps for Subsequent Sessions

1. **Verify Live Data**: Run `bun run fetch` with real user credentials to ensure the Yahoo authorization and JSON output work as expected.
2. **Local Database Setup**:
   - Choose a local database engine (SQLite with `bun:sqlite` or Drizzle ORM is recommended for Bun).
   - Create migrations / tables matching the schemas in `src/types/league.ts`.
3. **Database Ingestion Service**:
   - Build a service in `src/service/dbService.ts` to ingest `HistoricalLeagueExport` JSON payloads and upsert records into the database.
