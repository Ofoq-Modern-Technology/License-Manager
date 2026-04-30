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

// ── API sub-router (mounted at both / and /lapi) ──────────────────────────────
// Mounting at /lapi serves the bundled admin UI (which calls /lapi/... in prod)
// Mounting at / allows external apps to call /license, /purchase etc. directly
const api = express.Router();

api.get("/health", (_req, res) => res.json({ ok: true }));
api.use("/license", licenseRouter);
api.use("/purchase", purchaseRouter);
api.use("/admin", adminAuth, adminRouter);

app.use("/", api);
app.use("/lapi", api);

// ── Start background payment poller ───────────────────────────────────────────
startPaymentPoller();

// ── Serve admin UI in production (Docker) ─────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
