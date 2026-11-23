import { Hono } from "hono";
import { YahooAuthService } from "./service/yahooAuth";
import { YahooLeagueService } from "./service/yahooLeagueService";

process.loadEnvFile();

const app = new Hono();
const authService = new YahooAuthService();
const leagueService = new YahooLeagueService(authService);

app.get("/", (c) => {
  return c.json({
    service: "silver-cock-service",
    endpoints: {
      "GET /auth/url": "Get Yahoo OAuth 2.0 authorization URL",
      "GET /auth/callback?code=...": "Exchange authorization code for tokens",
      "GET /api/league/test": "Fetch single season to test connection (JSON)",
      "GET /api/league/history": "Fetch full historical league archive (JSON)",
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
