import { SQL } from "bun";

let sqlInstance: any = null;

/**
 * Returns the singleton Bun native SQL database client.
 */
export function getDb(): any {
  if (!sqlInstance) {
    const connectionUrl =
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/silver_cock";

    sqlInstance = new SQL(connectionUrl);
  }
  return sqlInstance;
}

/**
 * Closes the active database connection pool.
 */
export async function closeDb(): Promise<void> {
  if (sqlInstance) {
    if (typeof sqlInstance.end === "function") {
      await sqlInstance.end();
    }
    sqlInstance = null;
  }
}
