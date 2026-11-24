import { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import { getDb } from "../db/client";
import { AnalyticsService } from "../service/analyticsService";
import type { HistoricalLeagueExport } from "../types/league";

export const leagueRoutes = new Hono();
const analytics = new AnalyticsService();

let cachedExport: HistoricalLeagueExport | null = null;

async function getHistoricalData(): Promise<HistoricalLeagueExport | null> {
  if (cachedExport) return cachedExport;
  try {
    const filePath = path.resolve(process.cwd(), "output", "latest-league.json");
    const raw = await fs.readFile(filePath, "utf8");
    cachedExport = JSON.parse(raw) as HistoricalLeagueExport;
    return cachedExport;
  } catch {
    return null;
  }
}

async function isDbAvailable(): Promise<boolean> {
  try {
    const sql = getDb();
    await sql`SELECT 1;`;
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/leagues
 * List leagues overview
 */
leagueRoutes.get("/", async (c) => {
  const dbOk = await isDbAvailable();
  if (dbOk) {
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT l.*, COUNT(s.id) as seasons_count
        FROM leagues l
        LEFT JOIN seasons s ON s.league_id = l.id
        GROUP BY l.id;
      `;
      return c.json({ source: "database", leagues: rows });
    } catch {
      // fallback
    }
  }

  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  return c.json({
    source: "json_cache",
    leagues: [
      {
        id: data.summary.leagueId,
        name: data.summary.name,
        sport: data.summary.sport,
        currentSeason: data.summary.currentSeason,
        seasonsCount: data.summary.totalSeasonsFetched,
        inauguralSeason: data.summary.inauguralSeason,
        fetchedAt: data.summary.fetchedAt,
      },
    ],
  });
});

/**
 * GET /api/leagues/:id/hall-of-fame
 * Career leaderboard (championships, podiums, sackos, win %, points)
 */
leagueRoutes.get("/:id/hall-of-fame", async (c) => {
  const leagueId = c.req.param("id");
  const dbOk = await isDbAvailable();

  if (dbOk) {
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT * FROM manager_career_stats
        WHERE league_id = ${leagueId}
        ORDER BY championships DESC, podiums DESC, reg_wins DESC;
      `;
      if (rows.length > 0) {
        return c.json({ source: "database", leagueId, leaderboard: rows });
      }
    } catch {
      // fallback
    }
  }

  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  const stats = analytics.calculateManagerStats(data);
  return c.json({ source: "in_memory_analytics", leagueId, leaderboard: stats });
});

/**
 * GET /api/leagues/:id/records
 * Top 10 leaderboards for extreme record categories
 */
leagueRoutes.get("/:id/records", async (c) => {
  const leagueId = c.req.param("id");
  const typeFilter = c.req.query("type"); // optional filter
  const dbOk = await isDbAvailable();

  if (dbOk) {
    try {
      const sql = getDb();
      const rows = typeFilter
        ? await sql`
            SELECT * FROM league_records
            WHERE league_id = ${leagueId} AND record_type = ${typeFilter.toUpperCase()}
            ORDER BY rank ASC;
          `
        : await sql`
            SELECT * FROM league_records
            WHERE league_id = ${leagueId}
            ORDER BY record_type ASC, rank ASC;
          `;
      if (rows.length > 0) {
        return c.json({ source: "database", leagueId, records: rows });
      }
    } catch {
      // fallback
    }
  }

  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  const allRecords = analytics.calculateLeagueRecords(data);
  const filtered = typeFilter
    ? allRecords.filter((r) => r.recordType.toLowerCase() === typeFilter.toLowerCase())
    : allRecords;

  return c.json({ source: "in_memory_analytics", leagueId, records: filtered });
});

/**
 * GET /api/leagues/:id/rivalries
 * Head-to-head match records. Optional ?m1=...&m2=...
 */
leagueRoutes.get("/:id/rivalries", async (c) => {
  const leagueId = c.req.param("id");
  const m1 = c.req.query("m1");
  const m2 = c.req.query("m2");
  const dbOk = await isDbAvailable();

  if (dbOk) {
    try {
      const sql = getDb();
      let query;
      if (m1 && m2) {
        query = await sql`
          SELECT * FROM head_to_head_records
          WHERE league_id = ${leagueId}
            AND manager1_guid = ${m1}
            AND manager2_guid = ${m2};
        `;
      } else if (m1) {
        query = await sql`
          SELECT * FROM head_to_head_records
          WHERE league_id = ${leagueId}
            AND (manager1_guid = ${m1} OR manager2_guid = ${m1})
          ORDER BY total_matchups DESC;
        `;
      } else {
        query = await sql`
          SELECT * FROM head_to_head_records
          WHERE league_id = ${leagueId}
          ORDER BY total_matchups DESC;
        `;
      }
      if (query.length > 0) {
        return c.json({ source: "database", leagueId, rivalries: query });
      }
    } catch {
      // fallback
    }
  }

  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  let h2h = analytics.calculateHeadToHead(data);
  if (m1 && m2) {
    h2h = h2h.filter(
      (h) =>
        (h.manager1Guid === m1 && h.manager2Guid === m2) ||
        (h.manager1Guid === m2 && h.manager2Guid === m1)
    );
  } else if (m1) {
    h2h = h2h.filter((h) => h.manager1Guid === m1 || h.manager2Guid === m1);
  }

  return c.json({ source: "in_memory_analytics", leagueId, rivalries: h2h });
});

/**
 * GET /api/leagues/:id/managers/:guid
 * Detailed manager player card across all seasons
 */
leagueRoutes.get("/:id/managers/:guid", async (c) => {
  const leagueId = c.req.param("id");
  const guid = c.req.param("guid");
  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  const careerList = analytics.calculateManagerStats(data);
  const career = careerList.find((m) => m.managerGuid === guid || m.nickname.toLowerCase() === guid.toLowerCase());

  if (!career) {
    return c.json({ error: "Manager not found" }, 404);
  }

  // Season-by-season history for this manager
  const seasonsHistory: any[] = [];
  for (const s of data.seasons) {
    for (const t of s.teams) {
      const match = (t.managers || []).some(
        (m) => m.guid === career.managerGuid || (m.nickname && m.nickname.toLowerCase() === career.nickname.toLowerCase())
      );
      if (match) {
        const standing = s.standings.find((st) => st.teamKey === t.teamKey);
        seasonsHistory.push({
          season: s.season,
          teamName: t.name,
          logoUrl: t.logoUrl,
          rank: standing?.rank,
          wins: standing?.wins,
          losses: standing?.losses,
          ties: standing?.ties,
          pointsFor: standing?.pointsFor,
          pointsAgainst: standing?.pointsAgainst,
        });
      }
    }
  }

  return c.json({
    leagueId,
    manager: career,
    seasonsHistory: seasonsHistory.sort((a, b) => Number(b.season) - Number(a.season)),
  });
});

/**
 * GET /api/leagues/:id/seasons
 * List seasons for this league
 */
leagueRoutes.get("/:id/seasons", async (c) => {
  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  const seasons = data.seasons.map((s) => ({
    season: s.season,
    name: s.name,
    numTeams: s.numTeams,
    scoringType: s.scoringType,
    currentWeek: s.currentWeek,
    champion: s.standings.find((st) => st.rank === 1)?.teamName,
    championManager: s.standings.find((st) => st.rank === 1)?.managerName,
  }));

  return c.json({ leagueId: c.req.param("id"), seasons });
});

/**
 * GET /api/leagues/:id/seasons/:season
 * Season standings and detail
 */
leagueRoutes.get("/:id/seasons/:season", async (c) => {
  const seasonParam = c.req.param("season");
  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  const season = data.seasons.find((s) => s.season === seasonParam);
  if (!season) return c.json({ error: "Season not found" }, 404);

  return c.json({
    season: season.season,
    name: season.name,
    numTeams: season.numTeams,
    scoringType: season.scoringType,
    standings: season.standings,
    teams: season.teams,
  });
});

/**
 * GET /api/leagues/:id/seasons/:season/matchups
 * Matchups for season, optionally filtered by ?week=... or ?playoffs=true
 */
leagueRoutes.get("/:id/seasons/:season/matchups", async (c) => {
  const seasonParam = c.req.param("season");
  const weekParam = c.req.query("week");
  const playoffsParam = c.req.query("playoffs");

  const data = await getHistoricalData();
  if (!data) return c.json({ error: "No league data found" }, 404);

  const season = data.seasons.find((s) => s.season === seasonParam);
  if (!season) return c.json({ error: "Season not found" }, 404);

  let matchups = season.matchups || [];
  if (weekParam) {
    const w = Number(weekParam);
    matchups = matchups.filter((m) => m.week === w);
  }
  if (playoffsParam !== undefined) {
    const isPlayoffs = playoffsParam === "true" || playoffsParam === "1";
    matchups = matchups.filter((m) => m.isPlayoffs === isPlayoffs);
  }

  return c.json({
    season: season.season,
    week: weekParam ? Number(weekParam) : undefined,
    matchupsCount: matchups.length,
    matchups,
  });
});
