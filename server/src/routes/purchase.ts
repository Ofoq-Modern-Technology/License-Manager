import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { db, purchaseSessionsTable, productsTable } from "../db/index.js";
import { eq, sql } from "drizzle-orm";
import { generatePaymentWallet, fundPaymentWallet } from "../lib/paymentWallet.js";
import { getSetting } from "../lib/settings.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveProduct(productId?: number | null, productName?: string | null) {
  if (productId) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    return p ?? null;
  }
  if (productName) {
    const [p] = await db.select().from(productsTable)
      .where(sql`lower(${productsTable.name}) = lower(${productName})`);
    return p ?? null;
  }
  return null;
}

// ─── GET /purchase/products ────────────────────────────────────────────────────
// Public — list all active products so clients can discover product IDs/names
router.get("/products", async (_req, res) => {
  const products = await db.select({
    id:               productsTable.id,
    name:             productsTable.name,
    description:      productsTable.description,
    monthlyPriceSol:  productsTable.monthlyPriceSol,
    annualPriceSol:   productsTable.annualPriceSol,
    lifetimePriceSol: productsTable.lifetimePriceSol,
    monthlyPriceUsdc: productsTable.monthlyPriceUsdc,
    annualPriceUsdc:  productsTable.annualPriceUsdc,
    lifetimePriceUsdc:productsTable.lifetimePriceUsdc,
  })
    .from(productsTable)
    .where(eq(productsTable.status, "active"));

  res.json(products);
});

// ─── GET /purchase/pricing ─────────────────────────────────────────────────────
// Requires productId (query param) OR productName (query param)
router.get("/pricing", async (req, res) => {
  const productId   = req.query.productId   ? parseInt(req.query.productId as string) : null;
  const productName = (req.query.productName as string) || null;

  if (!productId && !productName) {
    res.status(400).json({ error: "Provide productId or productName" });
    return;
  }

  const product = await resolveProduct(productId, productName);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (product.status !== "active") {
    res.status(400).json({ error: "Product is not available for purchase" });
    return;
  }

  res.json({
    productId:         product.id,
    productName:       product.name,
    monthlyPriceSol:   product.monthlyPriceSol,
    annualPriceSol:    product.annualPriceSol,
    lifetimePriceSol:  product.lifetimePriceSol,
    monthlyPriceUsdc:  product.monthlyPriceUsdc,
    annualPriceUsdc:   product.annualPriceUsdc,
    lifetimePriceUsdc: product.lifetimePriceUsdc,
  });
});

// ─── POST /purchase/init ───────────────────────────────────────────────────────
// Requires productId OR productName — no global-pricing fallback
router.post("/init", async (req, res) => {
  const schema = z.object({
    email:       z.string().email(),
    name:        z.string().min(1).max(100),
    plan:        z.enum(["monthly", "annual", "lifetime"]),
    currency:    z.enum(["SOL", "USDC"]),
    productId:   z.coerce.number().optional(),
    productName: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, name, plan, currency, productId, productName } = parsed.data;

  if (!productId && !productName) {
    res.status(400).json({ error: "Provide productId or productName" });
    return;
  }

  const product = await resolveProduct(productId ?? null, productName ?? null);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (product.status !== "active") {
    res.status(400).json({ error: "Product is not available for purchase" });
    return;
  }

  // Prices must be configured on the product — no silent global fallback
  const expectedAmountSol = currency === "SOL" ? (
    plan === "monthly"  ? product.monthlyPriceSol  :
    plan === "annual"   ? product.annualPriceSol   :
                          product.lifetimePriceSol
  ) : null;

  const expectedAmountUsdc = currency === "USDC" ? (
    plan === "monthly"  ? product.monthlyPriceUsdc  :
    plan === "annual"   ? product.annualPriceUsdc   :
                          product.lifetimePriceUsdc
  ) : null;

  const expectedAmount = currency === "SOL" ? expectedAmountSol : expectedAmountUsdc;
  if (!expectedAmount || expectedAmount <= 0) {
    res.status(400).json({
      error: `No ${currency} price configured for the "${plan}" plan on this product. Contact the seller.`,
    });
    return;
  }

  // Use product-specific vault; fall back to global env only if product has none
  const vaultAddress = product.vaultWalletAddress ?? await getSetting("vault_wallet_address");

  const { address, privateKey } = generatePaymentWallet();
  const sessionId = uuidv4();
  const ttlMins = parseInt(await getSetting("session_ttl_minutes"), 10) || 30;
  const expiresAt = new Date(Date.now() + ttlMins * 60_000);

  await db.insert(purchaseSessionsTable).values({
    id: sessionId,
    email, name, plan, currency,
    productId: product.id,
    expectedAmountSol,
    expectedAmountUsdc,
    walletAddress: address,
    walletPrivateKey: privateKey,
    status: "awaiting_payment",
    sweepStatus: "pending",
    expiresAt,
  });

  // For USDC sessions: pre-fund payment wallet with SOL so it can pay its own
  // sweep fees later (vault private key not needed at sweep time).
  if (currency === "USDC") {
    const feePayerKey = process.env.VAULT_WALLET_PRIVATE_KEY ?? "";
    if (feePayerKey) {
      fundPaymentWallet(address, feePayerKey).catch((err: unknown) => {
        console.warn(`[purchase] Could not pre-fund USDC payment wallet ${address}:`, err);
      });
    } else {
      console.warn("[purchase] VAULT_WALLET_PRIVATE_KEY not set — USDC sweep may fail due to missing fees");
    }
  }

  res.json({
    purchaseId:        sessionId,
    walletAddress:     address,
    expectedAmountSol,
    expectedAmountUsdc,
    currency,
    plan,
    productId:         product.id,
    productName:       product.name,
    expiresAt:         expiresAt.toISOString(),
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
    status:     session.status,
    licenseKey: session.status === "paid" ? session.licenseKey : null,
    expiresAt:  session.expiresAt,
    currency:   session.currency,
    plan:       session.plan,
    productId:  session.productId,
  });
});

export default router;
