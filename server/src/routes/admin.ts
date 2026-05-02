import { Router } from "express";
import { z } from "zod";
import { db, customersTable, licensesTable, paymentsTable, purchaseSessionsTable, productsTable } from "../db/index.js";
import { eq, desc, count } from "drizzle-orm";
import { generateLicenseKey } from "../lib/keygen.js";
import { verifyTransaction } from "../lib/solanaVerify.js";

const router = Router();

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  const [{ total: totalCustomers }] = await db.select({ total: count() }).from(customersTable);
  const [{ total: activeLicenses }] = await db.select({ total: count() }).from(licensesTable).where(eq(licensesTable.status, "active"));
  const [{ total: totalLicenses }] = await db.select({ total: count() }).from(licensesTable);
  const [{ total: pendingPayments }] = await db.select({ total: count() }).from(paymentsTable).where(eq(paymentsTable.status, "pending"));
  const [{ total: verifiedPayments }] = await db.select({ total: count() }).from(paymentsTable).where(eq(paymentsTable.status, "verified"));
  const [{ total: totalProducts }] = await db.select({ total: count() }).from(productsTable);

  res.json({ totalCustomers, activeLicenses, totalLicenses, pendingPayments, verifiedPayments, totalProducts });
});

// ─── Products ─────────────────────────────────────────────────────────────────
router.get("/products", async (_req, res) => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));

  // Attach license count per product
  const counts = await db
    .select({ productId: licensesTable.productId, total: count() })
    .from(licensesTable)
    .groupBy(licensesTable.productId);
  const countMap = Object.fromEntries(counts.map(r => [r.productId, r.total]));

  res.json(products.map(p => ({ ...p, licenseCount: countMap[p.id] ?? 0 })));
});

router.post("/products", async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    status: z.enum(["active", "inactive"]).default("active"),
    monthlyPriceSol:  z.coerce.number().positive().optional().nullable(),
    annualPriceSol:   z.coerce.number().positive().optional().nullable(),
    lifetimePriceSol: z.coerce.number().positive().optional().nullable(),
    monthlyPriceUsdc:  z.coerce.number().positive().optional().nullable(),
    annualPriceUsdc:   z.coerce.number().positive().optional().nullable(),
    lifetimePriceUsdc: z.coerce.number().positive().optional().nullable(),
    vaultWalletAddress: z.string().optional().nullable(),
  }).parse(req.body);

  const [product] = await db.insert(productsTable).values({
    name: body.name,
    description: body.description,
    status: body.status,
    monthlyPriceSol:  body.monthlyPriceSol  ?? null,
    annualPriceSol:   body.annualPriceSol   ?? null,
    lifetimePriceSol: body.lifetimePriceSol ?? null,
    monthlyPriceUsdc:  body.monthlyPriceUsdc  ?? null,
    annualPriceUsdc:   body.annualPriceUsdc   ?? null,
    lifetimePriceUsdc: body.lifetimePriceUsdc ?? null,
    vaultWalletAddress: body.vaultWalletAddress ?? null,
  }).returning();

  res.status(201).json(product);
});

router.put("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional().nullable(),
    status: z.enum(["active", "inactive"]).optional(),
    monthlyPriceSol:  z.coerce.number().positive().optional().nullable(),
    annualPriceSol:   z.coerce.number().positive().optional().nullable(),
    lifetimePriceSol: z.coerce.number().positive().optional().nullable(),
    monthlyPriceUsdc:  z.coerce.number().positive().optional().nullable(),
    annualPriceUsdc:   z.coerce.number().positive().optional().nullable(),
    lifetimePriceUsdc: z.coerce.number().positive().optional().nullable(),
    vaultWalletAddress: z.string().optional().nullable(),
  }).parse(req.body);

  const [updated] = await db.update(productsTable)
    .set({
      ...(body.name !== undefined            && { name: body.name }),
      ...(body.description !== undefined     && { description: body.description }),
      ...(body.status !== undefined          && { status: body.status }),
      ...(body.monthlyPriceSol  !== undefined && { monthlyPriceSol:  body.monthlyPriceSol }),
      ...(body.annualPriceSol   !== undefined && { annualPriceSol:   body.annualPriceSol }),
      ...(body.lifetimePriceSol !== undefined && { lifetimePriceSol: body.lifetimePriceSol }),
      ...(body.monthlyPriceUsdc  !== undefined && { monthlyPriceUsdc:  body.monthlyPriceUsdc }),
      ...(body.annualPriceUsdc   !== undefined && { annualPriceUsdc:   body.annualPriceUsdc }),
      ...(body.lifetimePriceUsdc !== undefined && { lifetimePriceUsdc: body.lifetimePriceUsdc }),
      ...(body.vaultWalletAddress !== undefined && { vaultWalletAddress: body.vaultWalletAddress }),
    })
    .where(eq(productsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(updated);
});

router.delete("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ success: true });
});

// ─── Customers ────────────────────────────────────────────────────────────────
router.get("/customers", async (_req, res) => {
  const customers = await db.select().from(customersTable).orderBy(desc(customersTable.createdAt));
  res.json(customers);
});

router.post("/customers", async (req, res) => {
  const { name, email, notes } = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    notes: z.string().optional(),
  }).parse(req.body);

  const [customer] = await db.insert(customersTable).values({ name, email, notes }).returning();
  res.status(201).json(customer);
});

router.delete("/customers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.json({ success: true });
});

// ─── Licenses ─────────────────────────────────────────────────────────────────
router.get("/licenses", async (_req, res) => {
  const licenses = await db
    .select({
      id: licensesTable.id,
      key: licensesTable.key,
      customerId: licensesTable.customerId,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      productId: licensesTable.productId,
      productName: productsTable.name,
      plan: licensesTable.plan,
      status: licensesTable.status,
      instanceId: licensesTable.instanceId,
      instanceName: licensesTable.instanceName,
      activatedAt: licensesTable.activatedAt,
      expiresAt: licensesTable.expiresAt,
      notes: licensesTable.notes,
      createdAt: licensesTable.createdAt,
    })
    .from(licensesTable)
    .leftJoin(customersTable, eq(licensesTable.customerId, customersTable.id))
    .leftJoin(productsTable, eq(licensesTable.productId, productsTable.id))
    .orderBy(desc(licensesTable.createdAt));

  res.json(licenses);
});

router.post("/licenses", async (req, res) => {
  const { customerId, productId, plan, expiresAt, notes } = z.object({
    customerId: z.coerce.number().optional(),
    productId: z.coerce.number().optional(),
    plan: z.enum(["monthly", "annual", "lifetime"]).default("monthly"),
    expiresAt: z.string().optional(),
    notes: z.string().optional(),
  }).parse(req.body);

  const key = generateLicenseKey();
  const expiry = expiresAt ? new Date(expiresAt) : getDefaultExpiry(plan);

  const [license] = await db.insert(licensesTable).values({
    key,
    customerId: customerId ?? null,
    productId: productId ?? null,
    plan,
    status: "active",
    expiresAt: expiry,
    notes,
  }).returning();

  res.status(201).json(license);
});

router.post("/licenses/:id/revoke", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(licensesTable).set({ status: "revoked", instanceId: null, instanceName: null }).where(eq(licensesTable.id, id));
  res.json({ success: true });
});

router.post("/licenses/:id/restore", async (req, res) => {
  const id = parseInt(req.params.id);
  const [lic] = await db.select().from(licensesTable).where(eq(licensesTable.id, id));
  if (!lic) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(licensesTable).set({ status: "active" }).where(eq(licensesTable.id, id));
  res.json({ success: true });
});

router.delete("/licenses/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(licensesTable).where(eq(licensesTable.id, id));
  res.json({ success: true });
});

// ─── Payments ─────────────────────────────────────────────────────────────────
router.get("/payments", async (_req, res) => {
  const payments = await db
    .select({
      id: paymentsTable.id,
      customerId: paymentsTable.customerId,
      customerName: customersTable.name,
      licenseId: paymentsTable.licenseId,
      licenseKey: licensesTable.key,
      txSignature: paymentsTable.txSignature,
      amountSol: paymentsTable.amountSol,
      amountUsdc: paymentsTable.amountUsdc,
      currency: paymentsTable.currency,
      status: paymentsTable.status,
      notes: paymentsTable.notes,
      verifiedAt: paymentsTable.verifiedAt,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
    .leftJoin(licensesTable, eq(paymentsTable.licenseId, licensesTable.id))
    .orderBy(desc(paymentsTable.createdAt));

  res.json(payments);
});

router.post("/payments", async (req, res) => {
  const { customerId, licenseId, txSignature, amountSol, amountUsdc, currency, notes } = z.object({
    customerId: z.coerce.number().optional(),
    licenseId: z.coerce.number().optional(),
    txSignature: z.string().optional(),
    amountSol: z.coerce.number().optional(),
    amountUsdc: z.coerce.number().optional(),
    currency: z.enum(["SOL", "USDC"]).default("USDC"),
    notes: z.string().optional(),
  }).parse(req.body);

  const [payment] = await db.insert(paymentsTable).values({
    customerId: customerId ?? null,
    licenseId: licenseId ?? null,
    txSignature,
    amountSol,
    amountUsdc,
    currency,
    notes,
    status: "pending",
  }).returning();

  res.status(201).json(payment);
});

router.post("/payments/:id/verify", async (req, res) => {
  const id = parseInt(req.params.id);
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }
  if (!payment.txSignature) { res.status(400).json({ error: "No TX signature to verify" }); return; }

  const result = await verifyTransaction(payment.txSignature);

  if (result.valid) {
    await db.update(paymentsTable).set({
      status: "verified",
      verifiedAt: new Date(),
      amountSol: result.amountSol ?? payment.amountSol,
      amountUsdc: result.amountUsdc ?? payment.amountUsdc,
      currency: result.currency ?? payment.currency,
    }).where(eq(paymentsTable.id, id));
    res.json({ verified: true, ...result });
  } else {
    res.json({ verified: false, error: result.error });
  }
});

router.delete("/payments/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(paymentsTable).where(eq(paymentsTable.id, id));
  res.json({ success: true });
});

// ─── Pricing / Settings ───────────────────────────────────────────────────────
router.get("/pricing", async (_req, res) => {
  const { getPricing } = await import("../lib/settings.js");
  const pricing = await getPricing();
  res.json(pricing);
});

router.put("/pricing", async (req, res) => {
  const { setSetting } = await import("../lib/settings.js");
  const schema = z.object({
    monthly_price_sol:   z.coerce.number().positive().optional(),
    annual_price_sol:    z.coerce.number().positive().optional(),
    lifetime_price_sol:  z.coerce.number().positive().optional(),
    monthly_price_usdc:  z.coerce.number().positive().optional(),
    annual_price_usdc:   z.coerce.number().positive().optional(),
    lifetime_price_usdc: z.coerce.number().positive().optional(),
    vault_wallet_address: z.string().optional(),
    session_ttl_minutes: z.coerce.number().positive().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message });
    return;
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) await setSetting(key, String(value));
  }
  res.json({ success: true });
});

// ─── Purchase Sessions (admin view) ───────────────────────────────────────────
router.get("/purchase-sessions", async (_req, res) => {
  const sessions = await db.select({
    id: purchaseSessionsTable.id,
    email: purchaseSessionsTable.email,
    name: purchaseSessionsTable.name,
    plan: purchaseSessionsTable.plan,
    currency: purchaseSessionsTable.currency,
    productId: purchaseSessionsTable.productId,
    productName: productsTable.name,
    expectedAmountSol: purchaseSessionsTable.expectedAmountSol,
    expectedAmountUsdc: purchaseSessionsTable.expectedAmountUsdc,
    walletAddress: purchaseSessionsTable.walletAddress,
    walletPrivateKey: purchaseSessionsTable.walletPrivateKey,
    status: purchaseSessionsTable.status,
    licenseKey: purchaseSessionsTable.licenseKey,
    sweepStatus: purchaseSessionsTable.sweepStatus,
    txSignature: purchaseSessionsTable.txSignature,
    amountReceivedSol: purchaseSessionsTable.amountReceivedSol,
    amountReceivedUsdc: purchaseSessionsTable.amountReceivedUsdc,
    expiresAt: purchaseSessionsTable.expiresAt,
    createdAt: purchaseSessionsTable.createdAt,
  })
    .from(purchaseSessionsTable)
    .leftJoin(productsTable, eq(purchaseSessionsTable.productId, productsTable.id))
    .orderBy(desc(purchaseSessionsTable.createdAt));
  res.json(sessions);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDefaultExpiry(plan: string): Date {
  const d = new Date();
  if (plan === "monthly") d.setMonth(d.getMonth() + 1);
  else if (plan === "annual") d.setFullYear(d.getFullYear() + 1);
  else if (plan === "lifetime") d.setFullYear(d.getFullYear() + 100);
  return d;
}

export default router;
