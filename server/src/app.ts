import express from "express";
import cors from "cors";
import path from "path";
import licenseRouter from "./routes/license.js";
import adminRouter from "./routes/admin.js";
import purchaseRouter from "./routes/purchase.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { startPaymentPoller } from "./lib/paymentPoller.js";

const app = express();

app.use(cors());
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Public license validation API ─────────────────────────────────────────────
app.use("/license", licenseRouter);

// ── Self-service purchase API (public) ────────────────────────────────────────
app.use("/purchase", purchaseRouter);

// ── Admin API (protected) ─────────────────────────────────────────────────────
app.use("/admin", adminAuth, adminRouter);

// ── Start background payment poller ───────────────────────────────────────────
startPaymentPoller();

// ── Serve admin UI in production ──────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
