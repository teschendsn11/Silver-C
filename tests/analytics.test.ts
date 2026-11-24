import { describe, it, expect, beforeAll } from "bun:test";
import app from "../src/index";
import { AnalyticsService } from "../src/service/analyticsService";
import type { HistoricalLeagueExport } from "../src/types/league";
import fs from "fs/promises";
import path from "path";

describe("AnalyticsService and API Routes", () => {
  let exportData: HistoricalLeagueExport;
  const analytics = new AnalyticsService();

  beforeAll(async () => {
    const raw = await fs.readFile(
      path.resolve(process.cwd(), "output", "latest-league.json"),
      "utf8"
    );
    exportData = JSON.parse(raw);
  });

  describe("Analytics Calculations", () => {
    it("should compute manager career statistics with accurate championships", () => {
      const stats = analytics.calculateManagerStats(exportData);
      expect(stats.length).toBeGreaterThan(10);

      // Nate should have 6 titles
      const nate = stats.find((m) => m.nickname.toLowerCase() === "nate");
      expect(nate).toBeDefined();
      expect(nate?.championships).toBe(6);
      expect(nate?.seasonsCount).toBe(17);

      // Brian should have 2 titles
      const brian = stats.find((m) => m.nickname.toLowerCase().includes("brian"));
      expect(brian).toBeDefined();
      expect(brian?.championships).toBe(2);

      // Adam Cotter should have 3 sackos
      const adam = stats.find((m) => m.nickname.toLowerCase().includes("adam"));
      expect(adam).toBeDefined();
      expect(adam?.sackos).toBe(3);
    });

    it("should compute head-to-head records between managers", () => {
      const h2h = analytics.calculateHeadToHead(exportData);
      expect(h2h.length).toBeGreaterThan(20);

      const sample = h2h[0];
      expect(sample.manager1Guid).toBeDefined();
      expect(sample.manager2Guid).toBeDefined();
      expect(sample.totalMatchups).toBeGreaterThan(0);
    });

    it("should compute Top 10 record leaderboards", () => {
      const records = analytics.calculateLeagueRecords(exportData);
      const highScores = records.filter((r) => r.recordType === "HIGHEST_SCORE");
      const blowouts = records.filter((r) => r.recordType === "BIGGEST_BLOWOUT");
      const shootouts = records.filter((r) => r.recordType === "HIGHEST_SHOOTOUT");

      expect(highScores.length).toBe(10);
      expect(blowouts.length).toBe(10);
      expect(shootouts.length).toBe(10);

      // Brian's 234.66 high score
      expect(highScores[0].primaryScore).toBeCloseTo(234.66, 1);
      expect(highScores[0].primaryManagerName).toContain("Brian");

      // Nate's 187.30 margin blowout
      expect(blowouts[0].margin).toBeCloseTo(187.3, 1);
      expect(blowouts[0].primaryManagerName).toContain("Nate");

      // Season-level records
      const worstWinners = records.filter((r) => r.recordType === "WORST_WINNER");
      const highestDildos = records.filter((r) => r.recordType === "HIGHEST_DILDO");
      const biggestChokes = records.filter((r) => r.recordType === "BIGGEST_CHOKE");

      expect(worstWinners.length).toBeGreaterThan(0);
      expect(highestDildos.length).toBeGreaterThan(0);
      expect(biggestChokes.length).toBeGreaterThan(0);

      // 2024 Ross G was the highest scoring Dildo
      expect(highestDildos[0].primaryManagerName).toContain("Ross G");
      expect(highestDildos[0].seasonYear).toBe("2024");
      expect(highestDildos[0].primaryScore).toBeCloseTo(108.63, 1);
    });
  });

  describe("Hono API Query Endpoints", () => {
    it("GET / should return service directory", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.service).toBe("silver-cock-service");
      expect(json.endpoints["GET /api/leagues/:id/hall-of-fame"]).toBeDefined();
    });

    it("GET /api/leagues should list leagues", async () => {
      const res = await app.request("/api/leagues");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.leagues.length).toBeGreaterThanOrEqual(1);
      expect(json.leagues[0].id).toBe("482651");
    });

    it("GET /api/leagues/482651/hall-of-fame should return career leaderboard", async () => {
      const res = await app.request("/api/leagues/482651/hall-of-fame");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.leagueId).toBe("482651");
      expect(json.leaderboard.length).toBeGreaterThan(10);
      expect(json.leaderboard[0].championships).toBeGreaterThanOrEqual(
        json.leaderboard[1].championships
      );
    });

    it("GET /api/leagues/482651/records should return Top 10 leaderboards", async () => {
      const res = await app.request("/api/leagues/482651/records");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.records.length).toBeGreaterThan(30);
    });

    it("GET /api/leagues/482651/records?type=highest_score should return only highest scores", async () => {
      const res = await app.request("/api/leagues/482651/records?type=highest_score");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.records.length).toBe(10);
      expect(json.records[0].recordType).toBe("HIGHEST_SCORE");
    });

    it("GET /api/leagues/482651/rivalries should return head-to-head records", async () => {
      const res = await app.request("/api/leagues/482651/rivalries");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.rivalries.length).toBeGreaterThan(10);
    });

    it("GET /api/leagues/482651/seasons should list all 17 seasons", async () => {
      const res = await app.request("/api/leagues/482651/seasons");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.seasons.length).toBe(17);
    });

    it("GET /api/leagues/482651/seasons/2025/matchups should return season matchups", async () => {
      const res = await app.request("/api/leagues/482651/seasons/2025/matchups?week=1");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.season).toBe("2025");
      expect(json.week).toBe(1);
      expect(json.matchupsCount).toBe(6); // 12-team league = 6 matchups
    });
  });
});
