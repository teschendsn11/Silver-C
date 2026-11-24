import { Hono } from "hono";
import { cors } from "hono/cors";
import { YahooAuthService } from "./service/yahooAuth";
import { YahooLeagueService } from "./service/yahooLeagueService";
import { leagueRoutes } from "./routes/analyticsRoutes";

process.loadEnvFile();
process.env.PORT = process.env.PORT || '4000';

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:3050"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

const authService = new YahooAuthService();
const leagueService = new YahooLeagueService(authService);

// Mount League Query & Analytics Routes
app.route("/api/leagues", leagueRoutes);

app.get("/", (c) => {
  return c.json({
    service: "silver-cock-service",
    endpoints: {
      "GET /api/leagues": "List archived leagues and overview",
      "GET /api/leagues/:id/hall-of-fame": "Career leaderboard (titles, podiums, sackos, win %, PPG)",
      "GET /api/leagues/:id/records": "Top 10 all-time records (blowouts, high scores, shootouts, nailbiters)",
      "GET /api/leagues/:id/rivalries": "Head-to-head match records (optional ?m1=...&m2=...)",
      "GET /api/leagues/:id/managers/:guid": "Manager career card and seasonal history",
      "GET /api/leagues/:id/seasons": "List historical seasons and champions",
      "GET /api/leagues/:id/seasons/:season": "Single season standings and teams",
      "GET /api/leagues/:id/seasons/:season/matchups": "Weekly matchups and box scores",
      "GET /auth/url": "Get Yahoo OAuth 2.0 authorization URL",
      "GET /auth/callback?code=...": "Exchange authorization code for tokens",
      "GET /api/league/test": "Fetch single season from Yahoo (JSON)",
      "GET /api/league/history": "Fetch full historical archive from Yahoo (JSON)",
    },
  });
});

app.get("/auth/url", (c) => {
  const url = authService.getAuthorizationUrl();
  return c.json({ authorizationUrl: url });
});

app.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  try {
    const tokens = await authService.exchangeCode(code);
    return c.json({ message: "Successfully authenticated!", tokens });
  } catch (err: any) {
    return c.text(`Authentication failed: ${err.message || err}`, 500);
  }
});

app.get("/api/league/test", async (c) => {
  try {
    const leagueKey = c.req.query("league");
    const data = await leagueService.fetchSingleSeason(leagueKey);
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message || String(err) }, 500);
  }
});

app.get("/api/league/history", async (c) => {
  try {
    const leagueKey = c.req.query("league");
    const data = await leagueService.fetchFullHistory(leagueKey);
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message || String(err) }, 500);
  }
});

export default app;
