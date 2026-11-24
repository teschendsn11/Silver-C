import fs from "fs/promises";
import path from "path";
import { getDb, closeDb } from "../db/client";

process.loadEnvFile();

/**
 * Native Bun PostgreSQL migration runner.
 * Applies pending .sql migration files in the migrations directory in sorted order.
 */
export async function runMigrations(): Promise<void> {
  const sql = getDb();
  const migrationsDir = path.resolve(process.cwd(), "migrations");

  console.log("================ Database Migration Runner ================");
  console.log(`Target: ${process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/silver_cock"}`);
  console.log(`Directory: ${migrationsDir}\n`);

  // 1. Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  // 2. Fetch applied migrations
  const appliedRows = await sql`
    SELECT version FROM schema_migrations;
  `;
  const appliedSet = new Set(appliedRows.map((r: any) => r.version));

  // 3. Read migration files
  const allFiles = await fs.readdir(migrationsDir);
  const migrationFiles = allFiles
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    console.log("No migration files found.");
    return;
  }

  let appliedCount = 0;

  for (const file of migrationFiles) {
    if (appliedSet.has(file)) {
      console.log(`- Skipping already applied: ${file}`);
      continue;
    }

    console.log(`→ Applying: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const content = await fs.readFile(filePath, "utf8");

    // Execute migration in transaction
    await sql.begin(async (tx: any) => {
      await tx.unsafe(content);
      await tx`
        INSERT INTO schema_migrations (version) VALUES (${file});
      `;
    });

    console.log(`✓ Successfully applied: ${file}`);
    appliedCount++;
  }

  console.log(`\nMigration run completed. Applied ${appliedCount} new file(s).`);
  console.log("===========================================================\n");
}

if (import.meta.main) {
  runMigrations()
    .catch((err) => {
      console.error("\n❌ Migration failed:", err.message || err);
      process.exit(1);
    })
    .finally(async () => {
      await closeDb();
    });
}
