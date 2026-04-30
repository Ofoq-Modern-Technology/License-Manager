import { db, serverSettingsTable } from "../db/index.js";
import { eq } from "drizzle-orm";

const ENV_DEFAULTS: Record<string, () => string> = {
  monthly_price_sol:  () => process.env.MONTHLY_PRICE_SOL  ?? "0.5",
  annual_price_sol:   () => process.env.ANNUAL_PRICE_SOL   ?? "1.5",
  lifetime_price_sol: () => process.env.LIFETIME_PRICE_SOL ?? "3",
  monthly_price_usdc:  () => process.env.MONTHLY_PRICE_USDC  ?? "49",
  annual_price_usdc:   () => process.env.ANNUAL_PRICE_USDC   ?? "149",
  lifetime_price_usdc: () => process.env.LIFETIME_PRICE_USDC ?? "299",
  vault_wallet_address: () => process.env.VAULT_WALLET_ADDRESS ?? "",
  session_ttl_minutes: () => "30",
};

export async function getSetting(key: string): Promise<string> {
  const [row] = await db.select().from(serverSettingsTable).where(eq(serverSettingsTable.key, key));
  return row?.value ?? ENV_DEFAULTS[key]?.() ?? "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.insert(serverSettingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: serverSettingsTable.key, set: { value, updatedAt: new Date() } });
}

export interface Pricing {
  monthly_price_sol: number;
  annual_price_sol: number;
  lifetime_price_sol: number;
  monthly_price_usdc: number;
  annual_price_usdc: number;
  lifetime_price_usdc: number;
}

export async function getPricing(): Promise<Pricing & { vault_wallet_address: string }> {
  const keys = [
    "monthly_price_sol", "annual_price_sol", "lifetime_price_sol",
    "monthly_price_usdc", "annual_price_usdc", "lifetime_price_usdc",
    "vault_wallet_address",
  ];
  const rows = await db.select().from(serverSettingsTable);
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const get = (k: string) => map[k] ?? ENV_DEFAULTS[k]?.() ?? "0";

  return {
    monthly_price_sol:   parseFloat(get("monthly_price_sol")),
    annual_price_sol:    parseFloat(get("annual_price_sol")),
    lifetime_price_sol:  parseFloat(get("lifetime_price_sol")),
    monthly_price_usdc:  parseFloat(get("monthly_price_usdc")),
    annual_price_usdc:   parseFloat(get("annual_price_usdc")),
    lifetime_price_usdc: parseFloat(get("lifetime_price_usdc")),
    vault_wallet_address: get("vault_wallet_address"),
  };
}
