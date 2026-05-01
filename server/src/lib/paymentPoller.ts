import { db, purchaseSessionsTable, licensesTable, customersTable, paymentsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { checkWalletBalance, sweepSOL, sweepUSDC } from "./paymentWallet.js";
import { generateLicenseKey } from "./keygen.js";
import { getSetting } from "./settings.js";

const POLL_INTERVAL_MS = 20_000;
const TOLERANCE = 0.99;

type Session = typeof purchaseSessionsTable.$inferSelect;

export function startPaymentPoller(): void {
  console.log("[poller] Payment poller started (20s interval)");
  setInterval(() => { void pollPayments(); }, POLL_INTERVAL_MS);
}

async function pollPayments(): Promise<void> {
  const now = new Date();
  const pending = await db.select()
    .from(purchaseSessionsTable)
    .where(eq(purchaseSessionsTable.status, "awaiting_payment"));

  for (const session of pending) {
    if (session.expiresAt < now) {
      await db.update(purchaseSessionsTable)
        .set({ status: "expired" })
        .where(eq(purchaseSessionsTable.id, session.id));
      continue;
    }

    try {
      const balance = await checkWalletBalance(
        session.walletAddress,
        session.currency as "SOL" | "USDC",
      );
      const expected = session.currency === "SOL"
        ? (session.expectedAmountSol ?? 0)
        : (session.expectedAmountUsdc ?? 0);

      if (balance >= expected * TOLERANCE) {
        await processPayment(session, balance);
      }
    } catch (err) {
      console.warn(`[poller] Error checking session ${session.id}:`, err);
    }
  }
}

async function processPayment(session: Session, receivedBalance: number): Promise<void> {
  // 1. Find or create customer
  let customerId: number;
  const [existing] = await db.select().from(customersTable)
    .where(eq(customersTable.email, session.email));
  if (existing) {
    customerId = existing.id;
    if (existing.name !== session.name) {
      await db.update(customersTable).set({ name: session.name }).where(eq(customersTable.id, customerId));
    }
  } else {
    const inserted = await db.insert(customersTable)
      .values({ name: session.name, email: session.email })
      .returning();
    customerId = inserted[0].id;
  }

  // 2. Calculate expiry
  const now = Date.now();
  let expiresAt: Date | null = null;
  if (session.plan === "monthly") expiresAt = new Date(now + 30 * 86_400_000);
  else if (session.plan === "annual") expiresAt = new Date(now + 365 * 86_400_000);

  // 3. Generate license (inherit productId from the purchase session)
  const key = generateLicenseKey();
  const [license] = await db.insert(licensesTable).values({
    key,
    customerId,
    productId: session.productId ?? null,
    plan: session.plan,
    status: "active",
    expiresAt,
    notes: `auto-issued via purchase session ${session.id}`,
  }).returning();

  // 4. Log payment
  await db.insert(paymentsTable).values({
    customerId,
    licenseId: license.id,
    currency: session.currency,
    amountSol:  session.currency === "SOL"  ? receivedBalance : null,
    amountUsdc: session.currency === "USDC" ? receivedBalance : null,
    status: "verified",
    verifiedAt: new Date(),
    notes: `auto-confirmed from purchase session ${session.id}`,
  });

  // 5. Update session → paid
  await db.update(purchaseSessionsTable)
    .set({
      status: "paid",
      licenseKey: key,
      customerId,
      amountReceivedSol:  session.currency === "SOL"  ? receivedBalance : null,
      amountReceivedUsdc: session.currency === "USDC" ? receivedBalance : null,
    })
    .where(eq(purchaseSessionsTable.id, session.id));

  console.log(`[poller] ✓ Payment confirmed for session ${session.id} — license: ${key}`);

  void sweepFundsAsync(session);
}

async function sweepFundsAsync(session: Session): Promise<void> {
  // Use product-specific vault if available, fall back to global
  let vaultAddress: string | null = null;
  if (session.productId) {
    const { productsTable } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, session.productId));
    vaultAddress = product?.vaultWalletAddress ?? null;
  }
  if (!vaultAddress) {
    vaultAddress = await getSetting("vault_wallet_address");
  }

  if (!vaultAddress) {
    console.warn("[sweep] No vault address configured — skipping sweep");
    return;
  }

  try {
    let sig: string | null = null;
    if (session.currency === "SOL") {
      sig = await sweepSOL(session.walletPrivateKey, vaultAddress);
    } else {
      const usdcMicro = BigInt(Math.floor((session.amountReceivedUsdc ?? 0) * 1_000_000));
      sig = await sweepUSDC(session.walletPrivateKey, vaultAddress, usdcMicro);
    }

    await db.update(purchaseSessionsTable)
      .set({ sweepStatus: "done", txSignature: sig ?? undefined })
      .where(eq(purchaseSessionsTable.id, session.id));

    console.log(`[sweep] ✓ Funds swept for session ${session.id} — sig: ${sig}`);
  } catch (err) {
    console.error(`[sweep] ✗ Failed for session ${session.id}:`, err);
    await db.update(purchaseSessionsTable)
      .set({ sweepStatus: "failed" })
      .where(eq(purchaseSessionsTable.id, session.id));
  }
}
