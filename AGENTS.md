# AGENTS.md - Developer & AI Agent Context Guide

This document gives AI agents (and human developers) the immediate context needed to resume, extend, or debug work in this workspace without re-discovering the codebase from scratch.

---

## 1. Project Mission & Context

- **Repository**: `silver-cock-service` (part of `yahoo-silver-cock`)
- **Primary Goal**: Extract and archive Yahoo Fantasy Football league data across all historical seasons (2010–2026), persist raw records and calculated aggregates into PostgreSQL, and expose REST query endpoints for a separate client application.
- **Current Phase**:
  - Phase 1 (Complete): OAuth 2.0 flow, single-season test extraction to JSON, full historical renewal-chain crawler (17 seasons dumped into `output/latest-league.json`).
  - Phase 2 (Complete): Local PostgreSQL database, Bun native migrations (`bun run db:migrate`), and hybrid ingestion pipeline (`bun run ingest`) persisting raw granular rows and pre-aggregated analytics tables.
  - Phase 3 (Complete): Historical analytics engine (`AnalyticsService`), cross-era manager GUID identity resolution, CLI leaderboards (`bun run analytics`), and Hono REST query endpoints.

---

## 2. Runtime & Tooling Conventions

- **Runtime**: **Bun** (`bun`) only. Do not invoke `npm` or `node`.
- **Package Manager**: `bun` or `pnpm`.
- **Framework**: Hono (`hono`).
- **Language**: TypeScript (strict mode enabled in `tsconfig.json`).
- **Core Library**: `yahoo-fantasy` (v5.4.1). Untyped JavaScript library; typed interfaces defined locally in `src/types/league.ts`.

---

## 3. Environment & Authentication Architecture

- **Credentials (`.env`)**:
  - `YAHOO_CLIENT_KEY`: Yahoo App consumer key.
  - `YAHOO_CLIENT_SECRET`: Yahoo App consumer secret.
  - `YAHOO_REDIRECT_URI`: Set to `oob` (Out of Band) by default.
  - `LEAGUE_ID`: 5-digit Yahoo league ID (`482651`).
  - `SPORT`: Defaults to `nfl`.
  - `DATABASE_URL`: `postgres://postgres:postgres@localhost:5432/silver_cock`.
- **Token Cache (`.tokens.json`)**:
  - Stores `access_token` and `refresh_token`.
  - Git-ignored.
  - Managed by `src/service/yahooAuth.ts`.
  - When tokens expire (1 hour), `yahoo-fantasy` automatically triggers the refresh callback and updates `.tokens.json`.

---

## 4. Key Files & Architecture

| File | Purpose |
|---|---|
| `PLAN.md` | Architecture design document and roadmap. |
| `schema.sql` | Declarative PostgreSQL DDL (granular + aggregate tables). |
| `migrations/` | Version-controlled SQL migration files. |
| `src/types/league.ts` | Relational TypeScript models (`LeagueSummary`, `SeasonHistory`, `TeamRecord`, etc.). |
| `src/service/yahooAuth.ts` | OAuth lifecycle, code exchange, token persistence, and CLI prompt. |
| `src/service/yahooLeagueService.ts` | League API client, metadata fetcher, weekly scoreboard loop, and renewal crawler. |
| `src/service/analyticsService.ts` | Calculations engine, manager GUID resolver, Hall of Fame, records, rivalries. |
| `src/service/dbService.ts` | Database upsert and ingestion pipeline (auto-persists aggregates). |
| `src/scripts/migrate.ts` | Bun native migration runner (`bun run db:migrate`). |
| `src/scripts/showAnalytics.ts` | Terminal analytics & leaderboards runner (`bun run analytics`). |
| `src/scripts/fetchLeagueData.ts` | Extraction CLI runner (`bun run fetch` and `bun run fetch:all`). |
| `src/scripts/ingestLeagueData.ts`| Database ingestion CLI runner (`bun run ingest`). |
| `src/routes/analyticsRoutes.ts` | Hono REST query endpoints mounted at `/api/leagues`. |
| `src/index.ts` | Hono server entry point. |
| `tests/analytics.test.ts` | Automated test suite (`bun test`). |
| `output/latest-league.json` | Exported 17-season JSON payload. |

---

## 5. Standard Verification & Test Commands

```sh
# Run automated test suite
bun test

# Typecheck & build
bun build --target=bun src/index.ts

# Run terminal analytics leaderboards
bun run analytics

# Apply database migrations
bun run db:migrate

# Ingest JSON payload into PostgreSQL
bun run ingest

# Start local API server
bun run dev
```
