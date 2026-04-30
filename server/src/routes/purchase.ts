import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { db, purchaseSessionsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { generatePaymentWallet } from "../lib/paymentWallet.js";
import { getPricing, getSetting } from "../lib/settings.js";

const router = Router();

// ─── GET /purchase/pricing ─────────────────────────────────────────────────────
router.get("/pricing", async (_req, res) => {
  const p = await getPricing();
  // Never expose vault address to public clients
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
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, name, plan, currency } = parsed.data;
  const pricing = await getPricing();

  const expectedAmountSol  = currency === "SOL"  ? (
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
  });
});

export default router;
