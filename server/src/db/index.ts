import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { runMigrations } from "./migrate.js";

const dbPath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "licenseserver.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

runMigrations(db as any);

export * from "./schema.js";
