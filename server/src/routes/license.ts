import { Router } from "express";
import { z } from "zod";
import { db, licensesTable } from "../db/index.js";
import { eq, and } from "drizzle-orm";

const router = Router();

// ─── POST /license/validate ───────────────────────────────────────────────────
router.post("/validate", async (req, res) => {
  const { key, instanceId } = z.object({
    key: z.string().min(1),
    instanceId: z.string().optional(),
  }).parse(req.body);

  const [lic] = await db.select().from(licensesTable).where(eq(licensesTable.key, key));

  if (!lic) {
    res.json({ valid: false, error: "License key not found" });
    return;
  }

  if (lic.status === "revoked") {
    res.json({ valid: false, error: "License revoked" });
    return;
  }

  if (lic.status === "expired" || (lic.expiresAt && lic.expiresAt < new Date())) {
    await db.update(licensesTable).set({ status: "expired" }).where(eq(licensesTable.id, lic.id));
    res.json({ valid: false, error: "License expired", status: "expired" });
    return;
  }

  // If instanceId provided, verify it matches
  if (instanceId && lic.instanceId && lic.instanceId !== instanceId) {
    res.json({ valid: false, error: "Instance mismatch — key already activated on another machine" });
    return;
  }

  res.json({
    valid: true,
    plan: lic.plan,
    status: lic.status,
    expiresAt: lic.expiresAt ?? null,
    instanceId: lic.instanceId ?? null,
  });
});

// ─── POST /license/activate ───────────────────────────────────────────────────
router.post("/activate", async (req, res) => {
  const { key, instanceName } = z.object({
    key: z.string().min(1),
    instanceName: z.string().min(1),
  }).parse(req.body);

  const [lic] = await db.select().from(licensesTable).where(eq(licensesTable.key, key));

  if (!lic) {
    res.status(400).json({ activated: false, error: "License key not found" });
    return;
  }

  if (lic.status === "revoked") {
    res.status(400).json({ activated: false, error: "License revoked" });
    return;
  }

  if (lic.expiresAt && lic.expiresAt < new Date()) {
    res.status(400).json({ activated: false, error: "License expired" });
    return;
  }

  // Generate a new instance ID
  const instanceId = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await db.update(licensesTable).set({
    instanceId,
    instanceName,
    activatedAt: new Date(),
    status: "active",
  }).where(eq(licensesTable.id, lic.id));

  res.json({
    activated: true,
    instance: { id: instanceId, name: instanceName },
    license_key: {
      status: "active",
      expires_at: lic.expiresAt?.toISOString() ?? null,
    },
  });
});

// ─── POST /license/deactivate ─────────────────────────────────────────────────
router.post("/deactivate", async (req, res) => {
  const { key, instanceId } = z.object({
    key: z.string().min(1),
    instanceId: z.string().optional(),
  }).parse(req.body);

  const [lic] = await db.select().from(licensesTable).where(eq(licensesTable.key, key));

  if (!lic) {
    res.status(400).json({ deactivated: false, error: "License key not found" });
    return;
  }

  await db.update(licensesTable).set({
    instanceId: null,
    instanceName: null,
  }).where(eq(licensesTable.id, lic.id));

  res.json({ deactivated: true });
});

export default router;
