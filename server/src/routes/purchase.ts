import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { db, purchaseSessionsTable, productsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { generatePaymentWallet } from "../lib/paymentWallet.js";
import { getPricing, getSetting } from "../lib/settings.js";

const router = Router();

// Merge product-level pricing on top of global pricing (product values take precedence when set)
async function getEffectivePricing(productId?: number | null) {
  const global = await getPricing();
  if (!productId) return global;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return global;

  return {
    monthly_price_sol:   product.monthlyPriceSol   ?? global.monthly_price_sol,
    annual_price_sol:    product.annualPriceSol    ?? global.annual_price_sol,
    lifetime_price_sol:  product.lifetimePriceSol  ?? global.lifetime_price_sol,
    monthly_price_usdc:  product.monthlyPriceUsdc  ?? global.monthly_price_usdc,
    annual_price_usdc:   product.annualPriceUsdc   ?? global.annual_price_usdc,
    lifetime_price_usdc: product.lifetimePriceUsdc ?? global.lifetime_price_usdc,
    vault_wallet_address: product.vaultWalletAddress ?? global.vault_wallet_address,
  };
}

// ─── GET /purchase/pricing ─────────────────────────────────────────────────────
router.get("/pricing", async (req, res) => {
  const productId = req.query.productId ? parseInt(req.query.productId as string) : null;
  const p = await getEffectivePricing(productId);
  const { vault_wallet_address, ...publicPricing } = p;
  res.json(publicPricing);
});

// ─── POST /purchase/init ───────────────────────────────────────────────────────
router.post("/init", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    plan: z.enum(["monthly", "annual", "lifetime"]),
    currency: z.enum(["SOL", "USDC"]),
    productId: z.coerce.number().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, name, plan, currency, productId } = parsed.data;

  // Validate product exists and is active (if provided)
  if (productId) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) {
      res.status(400).json({ error: "Product not found" });
      return;
    }
    if (product.status !== "active") {
      res.status(400).json({ error: "Product is not available for purchase" });
      return;
    }
  }

  const pricing = await getEffectivePricing(productId);

  const expectedAmountSol = currency === "SOL" ? (
    plan === "monthly"  ? pricing.monthly_price_sol  :
    plan === "annual"   ? pricing.annual_price_sol   :
                          pricing.lifetime_price_sol
  ) : null;

  const expectedAmountUsdc = currency === "USDC" ? (
    plan === "monthly"  ? pricing.monthly_price_usdc  :
    plan === "annual"   ? pricing.annual_price_usdc   :
                          pricing.lifetime_price_usdc
  ) : null;

  const { address, privateKey } = generatePaymentWallet();
  const sessionId = uuidv4();
  const ttlMins = parseInt(await getSetting("session_ttl_minutes"), 10) || 30;
  const expiresAt = new Date(Date.now() + ttlMins * 60_000);

  await db.insert(purchaseSessionsTable).values({
    id: sessionId,
    email, name, plan, currency,
    productId: productId ?? null,
    expectedAmountSol,
    expectedAmountUsdc,
    walletAddress: address,
    walletPrivateKey: privateKey,
    status: "awaiting_payment",
    sweepStatus: "pending",
    expiresAt,
  });

  res.json({
    purchaseId: sessionId,
    walletAddress: address,
    expectedAmountSol,
    expectedAmountUsdc,
    currency,
    plan,
    productId: productId ?? null,
    expiresAt: expiresAt.toISOString(),
  });
});

// ─── GET /purchase/status/:id ──────────────────────────────────────────────────
router.get("/status/:id", async (req, res) => {
  const [session] = await db.select()
    .from(purchaseSessionsTable)
    .where(eq(purchaseSessionsTable.id, req.params.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    status: session.status,
    licenseKey: session.status === "paid" ? session.licenseKey : null,
    expiresAt: session.expiresAt,
    currency: session.currency,
    plan: session.plan,
    productId: session.productId,
  });
});

export default router;
