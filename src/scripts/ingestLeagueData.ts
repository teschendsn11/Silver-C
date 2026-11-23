import fs from "fs/promises";
import path from "path";
import { DatabaseIngestService } from "../service/dbService";
import { closeDb } from "../db/client";
import type { HistoricalLeagueExport } from "../types/league";

process.loadEnvFile();

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  const targetPath = fileArg
    ? path.resolve(process.cwd(), fileArg)
    : path.resolve(process.cwd(), "output", "latest-league.json");

  console.log("================ Yahoo League Database Ingest ================");
  console.log(`Source File: ${targetPath}`);
  console.log(`Target Database: ${process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/silver_cock"}`);
  console.log("===============================================================\n");

  let rawData: string;
  try {
    rawData = await fs.readFile(targetPath, "utf8");
  } catch (err: any) {
    console.error(`Error reading data file at ${targetPath}.`);
    console.error("Have you run 'bun run fetch' or 'bun run fetch:all' first?");
    process.exit(1);
  }

  const exportData = JSON.parse(rawData) as HistoricalLeagueExport;
  const ingestService = new DatabaseIngestService();

  const summary = await ingestService.ingestLeagueExport(exportData);

  console.log("\n================ Ingestion Summary ================");
  console.log(`✓ Leagues:     ${summary.leaguesCount}`);
  console.log(`✓ Seasons:     ${summary.seasonsCount}`);
  console.log(`✓ Teams:       ${summary.teamsCount}`);
  console.log(`✓ Managers:    ${summary.managersCount}`);
  console.log(`✓ Standings:   ${summary.standingsCount}`);
  console.log(`✓ Matchups:    ${summary.matchupsCount}`);
  console.log(`✓ Draft Picks: ${summary.draftPicksCount}`);
  console.log("===================================================\n");
}

main()
  .catch((err) => {
    console.error("\n❌ Ingestion failed:", err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
