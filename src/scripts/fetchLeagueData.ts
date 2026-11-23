import fs from "fs/promises";
import path from "path";
import { YahooAuthService } from "../service/yahooAuth";
import { YahooLeagueService } from "../service/yahooLeagueService";

// Load environment variables from .env
process.loadEnvFile();

async function main() {
  const args = process.argv.slice(2);
  const isAll = args.includes("--all") || args.includes("-a");
  const forceReauth = args.includes("--login") || args.includes("--reauth");
  const leagueArg = args.find((a) => a.startsWith("--league="))?.split("=")[1];

  console.log("================ Yahoo Fantasy League Extractor ================");
  console.log(`Mode: ${isAll ? "Full Historical Archive (--all)" : "Single Season Connection Test"}`);
  console.log(`Target League: ${leagueArg || process.env.LEAGUE_ID || "(default from .env)"}`);
  if (process.env.YAHOO_COOKIE) {
    console.log("Auth Mode: Browser Session Cookie (pub-api-ro.fantasysports.yahoo.com)");
  } else {
    console.log("Auth Mode: OAuth 2.0 (fantasysports.yahooapis.com)");
    if (forceReauth) console.log("Action: Forcing fresh OAuth re-authentication (--login)");
  }
  console.log("===============================================================\n");

  const authService = new YahooAuthService();
  const leagueService = new YahooLeagueService(authService);

  // If using OAuth (no cookie), ensure authenticated
  if (!process.env.YAHOO_COOKIE) {
    await authService.getClient(true, forceReauth);
  }

  // Fetch data
  const result = isAll
    ? await leagueService.fetchFullHistory(leagueArg)
    : await leagueService.fetchSingleSeason(leagueArg);

  const formattedJson = JSON.stringify(result, null, 2);

  // Print to console
  console.log("\n================ Extracted League JSON Output ================\n");
  console.log(formattedJson);
  console.log("\n==============================================================");

  // Save to output directory
  const outputDir = path.resolve(process.cwd(), "output");
  await fs.mkdir(outputDir, { recursive: true });

  const safeLeagueId = result.summary.leagueId || "unknown";
  const modeSuffix = isAll ? "history" : `season-${result.summary.currentSeason}`;
  const outFileName = `league-${safeLeagueId}-${modeSuffix}.json`;
  const outFilePath = path.join(outputDir, outFileName);

  await fs.writeFile(outFilePath, formattedJson, "utf8");
  console.log(`\n✓ Saved full JSON export to: ${outFilePath}`);

  // Also save a latest copy for easy referencing
  const latestPath = path.join(outputDir, "latest-league.json");
  await fs.writeFile(latestPath, formattedJson, "utf8");
  console.log(`✓ Updated: ${latestPath}\n`);
}

main().catch((err) => {
  console.error("\n❌ Execution failed:", err.message || err);
  process.exit(1);
});
