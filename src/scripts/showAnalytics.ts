import fs from "fs/promises";
import path from "path";
import { AnalyticsService } from "../service/analyticsService";
import type { HistoricalLeagueExport } from "../types/league";

async function main() {
  const filePath = path.resolve(process.cwd(), "output", "latest-league.json");

  console.log("================ League Historical Analytics ================");
  console.log(`Source File: ${filePath}\n`);

  let rawData: string;
  try {
    rawData = await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    console.error(`Could not read ${filePath}. Please run 'bun run fetch:all' first.`);
    process.exit(1);
  }

  const exportData = JSON.parse(rawData) as HistoricalLeagueExport;
  const analytics = new AnalyticsService();

  // 1. Hall of Fame
  const careerStats = analytics.calculateManagerStats(exportData);
  console.log("🏆 ==================== HALL OF FAME LEADERBOARD ==================== 🏆");
  console.log(
    "Manager".padEnd(20) +
      " | Yrs | Titles | Podiums | Sackos | Reg Record (Win %)  | Playoffs | PPG Avg | Total PF"
  );
  console.log("-".repeat(95));
  for (const m of careerStats) {
    const regRec = `${m.regWins}-${m.regLosses}-${m.regTies}`.padEnd(10);
    const winPct = `(${m.regWinPct}%)`.padEnd(8);
    const playoffRec = `${m.playoffWins}-${m.playoffLosses}`.padEnd(6);
    console.log(
      `${m.nickname.padEnd(20)} | ${String(m.seasonsCount).padStart(3)} | ${String(m.championships).padStart(6)} | ${String(m.podiums).padStart(7)} | ${String(m.sackos).padStart(6)} | ${regRec} ${winPct} | ${playoffRec}   | ${String(m.ppgAverage).padStart(7)} | ${String(m.pointsFor).padStart(8)}`
    );
  }

  // 2. Records
  const records = analytics.calculateLeagueRecords(exportData);

  function printCategory(title: string, type: string) {
    console.log(`\n📌 ==================== ${title} ==================== 📌`);
    const subset = records.filter((r) => r.recordType === type);
    console.log(
      "Rank".padEnd(5) +
        " | Value      | Primary Team/Manager               | Context / Opponent"
    );
    console.log("-".repeat(85));
    for (const r of subset) {
      let valStr = "";
      if (type === "HIGHEST_SCORE" || type === "LOWEST_SCORE") {
        valStr = `${r.primaryScore} pts`.padEnd(12);
      } else if (type === "BIGGEST_BLOWOUT") {
        valStr = `+${r.margin} margin`.padEnd(12);
      } else if (type === "CLOSEST_GAME") {
        valStr = `${r.margin} diff`.padEnd(12);
      } else if (type === "HIGHEST_SHOOTOUT") {
        valStr = `${r.combinedScore} comb`.padEnd(12);
      } else if (type === "TOUGH_LUCK_LOSS") {
        valStr = `${r.primaryScore} (L)`.padEnd(12);
      } else if (type === "LUCKY_WIN") {
        valStr = `${r.primaryScore} (W)`.padEnd(12);
      } else if (type.includes("PPG") || type.includes("SCORER") || type.includes("DILDO") || type.includes("WINNER") || type.includes("CHOKE") || type.includes("TEAM")) {
        valStr = `${r.primaryScore} PPG`.padEnd(12);
      }

      const primary = `${r.primaryManagerName} (${r.primaryTeamName})`.slice(0, 32).padEnd(32);
      const details = r.details
        ? `[${r.seasonYear}] ${r.details}`
        : r.secondaryManagerName
        ? `vs ${r.secondaryManagerName} (${r.secondaryScore} pts) in ${r.seasonYear} Wk ${r.week}`
        : `in ${r.seasonYear} Wk ${r.week}`;
      console.log(`${String(r.rank).padEnd(5)} | ${valStr} | ${primary} | ${details}`);
    }
  }

  printCategory("TOP 10 HIGHEST SINGLE-GAME SCORES", "HIGHEST_SCORE");
  printCategory("TOP 10 BIGGEST BLOWOUTS", "BIGGEST_BLOWOUT");
  printCategory("TOP 10 HIGHEST SCORING SHOOTOUTS", "HIGHEST_SHOOTOUT");
  printCategory("TOP 10 CLOSEST NAILBITERS", "CLOSEST_GAME");
  printCategory("TOP 10 TOUGH LUCK LOSSES", "TOUGH_LUCK_LOSS");

  printCategory("TOP 5 HIGHEST SCORING SEASONS (ALL-TIME)", "SEASON_HIGH_SCORER");
  printCategory("TOP 5 WORST WINNERS (LUCKIEST / LOWEST SCORING CHAMPIONS)", "WORST_WINNER");
  printCategory("TOP 5 HIGHEST SCORING DILDOS (UNLUCKIEST SACKOS)", "HIGHEST_DILDO");
  printCategory("TOP 5 LOWEST SCORING DILDOS (MOST PATHETIC SACKOS)", "LOWEST_DILDO");
  printCategory("TOP 5 BIGGEST CHOKES (HIGHEST SCORING TEAMS THAT MISSED TITLE)", "BIGGEST_CHOKE");
  printCategory("TOP 5 UNLUCKIEST SEASONS (MOST POINTS AGAINST PER GAME)", "UNLUCKIEST_TEAM");
  printCategory("TOP 5 LUCKIEST SEASONS (FEWEST POINTS AGAINST PER GAME)", "LUCKIEST_TEAM");

  console.log("\n=============================================================\n");
}

main().catch(console.error);
