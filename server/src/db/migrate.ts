import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export function runMigrations(db: BetterSQLite3Database): void {
  // ── Products (must exist before licenses/sessions reference it) ──────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      monthly_price_sol REAL,
      annual_price_sol REAL,
      lifetime_price_sol REAL,
      monthly_price_usdc REAL,
      annual_price_usdc REAL,
      lifetime_price_usdc REAL,
      vault_wallet_address TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ── Customers ────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ── Licenses ─────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      plan TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active',
      instance_id TEXT,
      instance_name TEXT,
      activated_at INTEGER,
      expires_at INTEGER,
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ── Payments ─────────────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      license_id INTEGER REFERENCES licenses(id),
      tx_signature TEXT,
      amount_sol REAL,
      amount_usdc REAL,
      currency TEXT NOT NULL DEFAULT 'USDC',
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      verified_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ── Purchase Sessions ────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_sessions (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      plan TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USDC',
      expected_amount_sol REAL,
      expected_amount_usdc REAL,
      wallet_address TEXT NOT NULL,
      wallet_private_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'awaiting_payment',
      license_key TEXT,
      customer_id INTEGER REFERENCES customers(id),
      tx_signature TEXT,
      amount_received_sol REAL,
      amount_received_usdc REAL,
      sweep_status TEXT NOT NULL DEFAULT 'pending',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ── Server Settings ──────────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS server_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // ── Column migrations (safe — ignore if already exist) ──────────────────────
  const alterColumns = [
    "ALTER TABLE licenses ADD COLUMN product_id INTEGER REFERENCES products(id)",
    "ALTER TABLE purchase_sessions ADD COLUMN product_id INTEGER REFERENCES products(id)",
  ];

  for (const sql of alterColumns) {
    try {
      db.run(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  console.log("[db] Migrations complete");
}
