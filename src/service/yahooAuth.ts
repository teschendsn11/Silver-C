import fs from "fs/promises";
import path from "path";
import * as readline from "readline/promises";
import YahooFantasy from "yahoo-fantasy";

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  obtained_at?: string;
}

export class YahooAuthService {
  private clientKey: string;
  private clientSecret: string;
  private redirectUri: string;
  private tokenFilePath: string;
  private yf: any = null;

  constructor(tokenFilePath = path.resolve(process.cwd(), ".tokens.json")) {
    this.clientKey = process.env.YAHOO_CLIENT_KEY || "";
    this.clientSecret = process.env.YAHOO_CLIENT_SECRET || "";
    this.redirectUri = process.env.YAHOO_REDIRECT_URI || "oob";
    this.tokenFilePath = tokenFilePath;

    if (!this.clientKey || !this.clientSecret) {
      throw new Error(
        "Missing YAHOO_CLIENT_KEY or YAHOO_CLIENT_SECRET in environment variables."
      );
    }
  }

  /**
   * Check if a token file already exists on disk.
   */
  async hasStoredTokens(): Promise<boolean> {
    try {
      await fs.access(this.tokenFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load stored OAuth tokens from disk.
   */
  async loadStoredTokens(): Promise<StoredTokens | null> {
    try {
      const data = await fs.readFile(this.tokenFilePath, "utf8");
      return JSON.parse(data) as StoredTokens;
    } catch {
      return null;
    }
  }

  /**
   * Persist OAuth tokens to disk.
   */
  async saveTokens(tokens: StoredTokens): Promise<void> {
    const payload: StoredTokens = {
      ...tokens,
      obtained_at: new Date().toISOString(),
    };
    await fs.writeFile(this.tokenFilePath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`[YahooAuth] Saved tokens to ${path.basename(this.tokenFilePath)}`);
  }

  /**
   * Delete stored OAuth tokens from disk.
   */
  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.tokenFilePath);
      console.log("[YahooAuth] Cleared stored tokens.");
    } catch {
      // Ignore if file does not exist
    }
  }

  /**
   * Generate Yahoo OAuth 2.0 authorization URL.
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientKey,
      redirect_uri: this.redirectUri,
      response_type: "code",
    });

    const scope = process.env.YAHOO_OAUTH_SCOPE !== undefined 
      ? process.env.YAHOO_OAUTH_SCOPE 
      : "fspt-r";
    if (scope && scope.trim()) {
      params.append("scope", scope.trim());
    }

    if (state) {
      params.append("state", state);
    }
    return `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access & refresh tokens.
   */
  async exchangeCode(code: string): Promise<StoredTokens> {
    const tokenEndpoint = "https://api.login.yahoo.com/oauth2/get_token";
    const credentials = Buffer.from(
      `${this.clientKey}:${this.clientSecret}`
    ).toString("base64");

    const body = new URLSearchParams({
      client_id: this.clientKey,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code: code.trim(),
      grant_type: "authorization_code",
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange code: HTTP ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as StoredTokens;
    await this.saveTokens(data);

    if (this.yf) {
      this.yf.setUserToken(data.access_token);
      this.yf.setRefreshToken(data.refresh_token);
    }

    return data;
  }

  /**
   * Initialize and configure the YahooFantasy client.
   * Sets up automatic token refresh persistence.
   */
  async getClient(interactive = false, forceReauth = false): Promise<any> {
    if (this.yf && !forceReauth) {
      return this.yf;
    }

    const tokenRefreshCallback = async (tokenData: any) => {
      console.log("[YahooAuth] Access token was automatically refreshed.");
      await this.saveTokens(tokenData);
    };

    this.yf = new YahooFantasy(
      this.clientKey,
      this.clientSecret,
      tokenRefreshCallback,
      this.redirectUri
    );

    if (forceReauth) {
      await this.clearTokens();
      await this.promptInteractiveAuth();
      return this.yf;
    }

    const stored = await this.loadStoredTokens();
    if (stored?.access_token && stored?.refresh_token) {
      this.yf.setUserToken(stored.access_token);
      this.yf.setRefreshToken(stored.refresh_token);
      return this.yf;
    }

    if (interactive) {
      await this.promptInteractiveAuth();
      return this.yf;
    }

    throw new Error(
      "Not authenticated. Please run authentication first or provide valid tokens in .tokens.json."
    );
  }

  /**
   * Prompt user via terminal for OAuth verification code.
   */
  private async promptInteractiveAuth(): Promise<void> {
    const authUrl = this.getAuthorizationUrl();

    console.log("\n================ Yahoo Fantasy Authorization ================");
    console.log("No stored tokens found. Please authorize this application:");
    console.log(`\n👉 Open this URL in your browser:\n\n${authUrl}\n`);
    console.log("1. Sign in with your Yahoo account.");
    console.log("2. Authorize the application.");
    if (this.redirectUri === "oob") {
      console.log("3. Yahoo will show a verification code on the screen.");
      console.log("4. Copy and paste that code below.");
    } else {
      console.log(`3. Yahoo will redirect your browser to ${this.redirectUri}?code=...`);
      console.log("4. Copy the 'code' from your URL bar (or paste the entire redirected URL below).");
    }
    console.log("=============================================================\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const input = await rl.question("Enter the authorization code or redirected URL: ");
      if (!input || !input.trim()) {
        throw new Error("Authorization input cannot be empty.");
      }

      let code = input.trim();
      // If the user pasted the entire redirected URL, extract the code parameter automatically
      if (code.includes("code=")) {
        try {
          const urlObj = new URL(code);
          code = urlObj.searchParams.get("code") || code;
        } catch {
          const match = code.match(/[?&]code=([^&]+)/);
          if (match) code = match[1];
        }
      }

      console.log("\nExchanging authorization code for tokens...");
      await this.exchangeCode(code);
      console.log("Successfully authenticated!\n");
    } finally {
      rl.close();
    }
  }
}
