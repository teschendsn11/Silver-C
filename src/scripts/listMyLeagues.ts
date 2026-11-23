import { YahooAuthService } from "../service/yahooAuth";
import { YahooLeagueService } from "../service/yahooLeagueService";

process.loadEnvFile();

async function main() {
  console.log("================ Pull User Fantasy Leagues ================\n");

  const authService = new YahooAuthService();
  const leagueService = new YahooLeagueService(authService);

  if (process.env.YAHOO_COOKIE) {
    console.log("Auth Mode: Browser Session Cookie (pub-api-ro.fantasysports.yahoo.com)");
  } else {
    console.log("Auth Mode: OAuth 2.0 (fantasysports.yahooapis.com)");
    await authService.getClient(false);
  }

  console.log("Querying Yahoo Fantasy API for all leagues associated with your account...\n");

  try {
    const data = await leagueService.fetchFantasyContent("users;use_login=1/games/leagues");

    const usersData = data?.fantasy_content?.users;
    if (!usersData || usersData.length === 0) {
      console.log("No user data returned from Yahoo.");
      return;
    }

    const userObj = usersData[0]?.user;
    const userProfile = userObj?.[0];
    const gamesObj = userObj?.[1]?.games;

    console.log(`👤 Authenticated User GUID: ${userProfile?.guid || "N/A"}\n`);

    if (!gamesObj || gamesObj.count === 0) {
      console.log("No fantasy leagues found for this user account.");
      return;
    }

    console.log("------------------------------------------------------------");
    const gameCount = gamesObj.count || 0;
    let foundLeaguesCount = 0;

    for (let i = 0; i < gameCount; i++) {
      const g = gamesObj[i]?.game;
      if (!g) continue;

      const gameMeta = g[0];
      const leaguesWrapper = g[1]?.leagues;

      if (!leaguesWrapper || leaguesWrapper.count === 0) continue;

      const season = gameMeta?.season || "Unknown";
      const sportCode = gameMeta?.code || "nfl";
      const gameKey = gameMeta?.game_key || "";

      console.log(`\n🏆 ${gameMeta?.name || "Fantasy"} (${season}) [Game Key: ${gameKey}]`);

      const leagueCount = leaguesWrapper.count || 0;
      for (let j = 0; j < leagueCount; j++) {
        const l = leaguesWrapper[j]?.league;
        if (!l) continue;

        const leagueMeta = l[0];
        foundLeaguesCount++;

        console.log(`   • League Name:  ${leagueMeta?.name}`);
        console.log(`     League Key:   ${leagueMeta?.league_key}`);
        console.log(`     League ID:    ${leagueMeta?.league_id}`);
        console.log(`     Season:       ${leagueMeta?.season}`);
        console.log(`     Num Teams:    ${leagueMeta?.num_teams}`);
        console.log(`     URL:          ${leagueMeta?.url}`);
        if (leagueMeta?.renew) {
          console.log(`     Renewed From: ${leagueMeta?.renew}`);
        }
        console.log("");
      }
    }

    console.log("------------------------------------------------------------");
    console.log(`Total Leagues Discovered: ${foundLeaguesCount}\n`);

  } catch (err: any) {
    const desc = err?.description || err?.message || JSON.stringify(err);
    console.error("❌ Failed to query user leagues:", desc);

    if (desc.includes("not authorized")) {
      console.error("\n⚠️ Your access token lacks authorization to query user leagues.");
      console.error("Run 'bun run fetch --login' to refresh authorization.");
    }
  }
}

main().catch(console.error);
