import type { Request, Response, NextFunction } from "express";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "changeme";

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-admin-token"] ?? req.query["adminToken"];
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }
  next();
}
