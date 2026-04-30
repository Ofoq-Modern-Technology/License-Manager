import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const customersTable = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const licensesTable = sqliteTable("licenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  customerId: integer("customer_id").references(() => customersTable.id),
  plan: text("plan").notNull().default("monthly"),
  status: text("status").notNull().default("active"),
  instanceId: text("instance_id"),
  instanceName: text("instance_name"),
  activatedAt: integer("activated_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const paymentsTable = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").references(() => customersTable.id),
  licenseId: integer("license_id").references(() => licensesTable.id),
  txSignature: text("tx_signature"),
  amountSol: real("amount_sol"),
  amountUsdc: real("amount_usdc"),
  currency: text("currency").notNull().default("USDC"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Self-service purchase sessions — one unique payment wallet per purchase
export const purchaseSessionsTable = sqliteTable("purchase_sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  plan: text("plan").notNull(),
  currency: text("currency").notNull().default("USDC"),
  expectedAmountSol: real("expected_amount_sol"),
  expectedAmountUsdc: real("expected_amount_usdc"),
  walletAddress: text("wallet_address").notNull(),
  walletPrivateKey: text("wallet_private_key").notNull(),
  status: text("status").notNull().default("awaiting_payment"),
  licenseKey: text("license_key"),
  customerId: integer("customer_id").references(() => customersTable.id),
  txSignature: text("tx_signature"),
  amountReceivedSol: real("amount_received_sol"),
  amountReceivedUsdc: real("amount_received_usdc"),
  sweepStatus: text("sweep_status").notNull().default("pending"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Runtime-configurable key/value settings (prices, vault address, etc.)
export const serverSettingsTable = sqliteTable("server_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
