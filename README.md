# License Manager

A self-hosted software licensing server with **Solana SOL/USDC payment support** and a built-in React admin panel. Ship it as a single Docker container alongside any product.

## Features

- **License key generation** — issue unique license keys tied to plan and expiry
- **Solana payment verification** — customers pay on-chain (SOL or USDC), server verifies the transaction automatically and issues a license
- **Self-service purchase flow** — apps call 3 endpoints: get pricing → create invoice → poll status
- **Admin panel** — manage customers, licenses, payments, and pricing from a browser UI (served on the same port in Docker)
- **Token-based admin auth** — simple `ADMIN_TOKEN` environment variable protects all admin routes
- **SQLite storage** — zero external database, single file, easy to back up

---

## Table of Contents

1. [Docker (recommended)](#docker-recommended)
2. [Manual setup (development)](#manual-setup-development)
3. [Environment variables](#environment-variables)
4. [Application integration guide](#application-integration-guide)
5. [Full API reference](#full-api-reference)
6. [Admin panel](#admin-panel)
7. [Production deployment](#production-deployment)
8. [Tech stack](#tech-stack)

---

## Docker (recommended)

### Run with a single command

```bash
docker run -d \
  --name license-manager \
  -p 8082:8082 \
  -v license_data:/data \
  -e ADMIN_TOKEN=your-secret-token \
  -e VAULT_WALLET_ADDRESS=YourSolanaWalletAddress \
  ofoqmoderntechnology/license-manager:latest
```

- Admin panel → **http://localhost:8082**
- API → **http://localhost:8082/license**, **/purchase**, **/admin**

### Run with docker-compose (recommended for production)

```bash
# 1. Clone the repo
git clone https://github.com/Ofoq-Modern-Technology/License-Manager.git
cd License-Manager

# 2. Create a .env file
cat > .env << 'EOF'
ADMIN_TOKEN=your-very-secret-token
VAULT_WALLET_ADDRESS=YourSolanaWalletAddress
SOLANA_RPC=https://api.mainnet-beta.solana.com
MONTHLY_PRICE_SOL=0.5
ANNUAL_PRICE_SOL=1.5
LIFETIME_PRICE_SOL=3
EOF

# 3. Start
docker-compose up -d
```

### Build locally

```bash
docker build -t license-manager .
docker run -d -p 8082:8082 -v license_data:/data \
  -e ADMIN_TOKEN=changeme \
  -e VAULT_WALLET_ADDRESS=YourWallet \
  license-manager
```

---

## Manual Setup (development)

### 1. Clone & install

```bash
git clone https://github.com/Ofoq-Modern-Technology/License-Manager.git
cd License-Manager

cd server && npm install
cd ../admin && npm install
```

### 2. Configure

Create `server/.env`:

```env
PORT=8082
ADMIN_TOKEN=your-secret-token
VAULT_WALLET_ADDRESS=YourSolanaWalletAddress
SOLANA_RPC=https://api.mainnet-beta.solana.com
```

### 3. Run the server

```bash
cd server
npm run dev
```

### 4. Run the admin panel

```bash
cd admin
npm run dev:ui   # opens http://localhost:3000
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ADMIN_TOKEN` | `changeme` | **Change this!** Secret token for all `/admin/*` routes |
| `VAULT_WALLET_ADDRESS` | — | Solana wallet address that receives customer payments |
| `SOLANA_RPC` | public mainnet | RPC endpoint — use Helius/QuickNode in production for reliability |
| `PORT` | `8082` | HTTP port |
| `DATABASE_PATH` | `./licenseserver.db` | SQLite file path (`/data/licenseserver.db` in Docker) |
| `MONTHLY_PRICE_SOL` | `0.5` | Monthly plan price in SOL |
| `ANNUAL_PRICE_SOL` | `1.5` | Annual plan price in SOL |
| `LIFETIME_PRICE_SOL` | `3` | Lifetime plan price in SOL |
| `MONTHLY_PRICE_USDC` | `49` | Monthly plan price in USDC |
| `ANNUAL_PRICE_USDC` | `149` | Annual plan price in USDC |
| `LIFETIME_PRICE_USDC` | `299` | Lifetime plan price in USDC |

Prices set via environment variables are used as defaults. They can also be overridden at runtime from the admin panel (Settings → Pricing).

---

## Application Integration Guide

This section explains how to integrate License Manager into your own application — desktop app, CLI tool, SaaS, or any software that needs license gating.

### Overview of the purchase flow

```
Your App                           License Manager Server
   │                                         │
   │  1. GET /purchase/pricing               │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │
   │     { monthly_price_sol, annual_price_sol, ... }
   │                                         │
   │  2. POST /purchase/init                 │
   │     { email, name, plan, currency }     │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │
   │     { purchaseId, walletAddress,        │
   │       expectedAmountSol, expiresAt }    │
   │                                         │
   │  3. Show payment UI to user             │
   │     User sends SOL to walletAddress     │
   │                                         │
   │  4. Poll GET /purchase/status/:id       │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │  ← Server verifies on-chain
   │     { status: "paid",                   │
   │       licenseKey: "XXXX-XXXX-..." }     │
   │                                         │
   │  5. Store licenseKey locally            │
   │  6. POST /license/validate (on launch)  │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │
   │     { valid: true, plan, expiresAt }    │
```

### Step 1 — Fetch available pricing

Call this once when the user opens the upgrade/purchase screen.

```
GET https://your-server.com/purchase/pricing
```

**Response:**
```json
{
  "monthly_price_sol":  0.5,
  "annual_price_sol":   1.5,
  "lifetime_price_sol": 3.0,
  "monthly_price_usdc":  49,
  "annual_price_usdc":   149,
  "lifetime_price_usdc": 299
}
```

Display the prices in your UI. The `VAULT_WALLET_ADDRESS` is intentionally excluded from this response.

---

### Step 2 — Create a purchase session (invoice)

When the user selects a plan and clicks "Pay", POST to create an invoice:

```
POST https://your-server.com/purchase/init
Content-Type: application/json

{
  "email":    "user@example.com",
  "name":     "Jane Doe",
  "plan":     "monthly",        // "monthly" | "annual" | "lifetime"
  "currency": "SOL"             // "SOL" | "USDC"
}
```

**Response:**
```json
{
  "purchaseId":        "550e8400-e29b-41d4-a716-446655440000",
  "walletAddress":     "A1b2C3d4E5f6G7h8I9j0...",
  "expectedAmountSol": 0.5,
  "expectedAmountUsdc": null,
  "currency":          "SOL",
  "plan":              "monthly",
  "expiresAt":         "2025-05-01T12:30:00.000Z"
}
```

The server generates a **fresh Solana wallet** for each session. Show the `walletAddress` and `expectedAmountSol` to the user as payment instructions. The session expires in 30 minutes (configurable via `session_ttl_minutes` in the admin panel).

---

### Step 3 — User sends payment

Display a QR code or copy-paste flow for the user to send exactly `expectedAmountSol` SOL to `walletAddress`. You can use any Solana wallet — Phantom, Solflare, etc.

The server's payment poller automatically monitors the wallet every ~15 seconds. Once it sees the expected amount arrive on-chain, it marks the session as `paid` and issues the license key.

---

### Step 4 — Poll for payment confirmation

Poll this endpoint every 5–15 seconds until `status` is `"paid"` or `"expired"`:

```
GET https://your-server.com/purchase/status/550e8400-e29b-41d4-a716-446655440000
```

**Response (waiting):**
```json
{
  "status":     "awaiting_payment",
  "licenseKey": null,
  "expiresAt":  "2025-05-01T12:30:00.000Z",
  "currency":   "SOL",
  "plan":       "monthly"
}
```

**Response (paid):**
```json
{
  "status":     "paid",
  "licenseKey": "MXKA-7TQP-N2WB-4HCR",
  "expiresAt":  "2025-05-01T12:30:00.000Z",
  "currency":   "SOL",
  "plan":       "monthly"
}
```

When `status === "paid"`, securely store `licenseKey` on the user's machine (e.g., OS keychain or encrypted local config file).

---

### Step 5 — Validate the license on every launch

On each application startup, call:

```
POST https://your-server.com/license/validate
Content-Type: application/json

{
  "key":        "MXKA-7TQP-N2WB-4HCR",
  "instanceId": "unique-machine-or-device-id"   // optional but recommended
}
```

**Valid response:**
```json
{
  "valid":     true,
  "plan":      "monthly",
  "expiresAt": "2025-06-01T00:00:00.000Z"
}
```

**Invalid / expired response:**
```json
{
  "valid":  false,
  "reason": "License expired"
}
```

If `valid` is `false`, gate access to your app's paid features accordingly.

> **Tip:** Cache the last successful validation result locally with a timestamp. If the server is temporarily unreachable, allow a grace period (e.g., 24–72 hours) based on the cached result — this prevents network hiccups from locking out paying customers.

---

### Code example (Node.js / TypeScript)

```typescript
const LICENSE_SERVER = "https://your-server.com";

// 1. Get pricing
const pricing = await fetch(`${LICENSE_SERVER}/purchase/pricing`).then(r => r.json());

// 2. Create invoice
const session = await fetch(`${LICENSE_SERVER}/purchase/init`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    name: "Jane",
    plan: "lifetime",
    currency: "SOL",
  }),
}).then(r => r.json());

console.log(`Send ${session.expectedAmountSol} SOL to ${session.walletAddress}`);

// 3. Poll for payment
let licenseKey: string | null = null;
while (!licenseKey) {
  await new Promise(r => setTimeout(r, 10_000)); // wait 10s
  const { status, licenseKey: key } = await fetch(
    `${LICENSE_SERVER}/purchase/status/${session.purchaseId}`
  ).then(r => r.json());

  if (status === "paid") { licenseKey = key; break; }
  if (status === "expired") throw new Error("Payment session expired");
}

// 4. Validate on launch
const { valid, plan, expiresAt } = await fetch(`${LICENSE_SERVER}/license/validate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: licenseKey, instanceId: "device-xyz" }),
}).then(r => r.json());

if (!valid) throw new Error("Invalid license");
console.log(`License OK — plan: ${plan}, expires: ${expiresAt}`);
```

---

## Full API Reference

### Public endpoints (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check → `{ ok: true }` |
| GET | `/purchase/pricing` | Available plans and prices |
| POST | `/purchase/init` | Create a purchase session |
| GET | `/purchase/status/:id` | Poll session status + get license key |
| POST | `/license/validate` | Validate a license key |

### Admin endpoints (require `x-admin-token: <ADMIN_TOKEN>` header)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/stats` | Dashboard counts |
| GET | `/admin/customers` | List customers |
| POST | `/admin/customers` | Create customer |
| DELETE | `/admin/customers/:id` | Delete customer |
| GET | `/admin/licenses` | List license keys |
| POST | `/admin/licenses` | Create license manually |
| POST | `/admin/licenses/:id/revoke` | Revoke a license |
| POST | `/admin/licenses/:id/restore` | Restore a revoked license |
| DELETE | `/admin/licenses/:id` | Delete license |
| GET | `/admin/payments` | List payments |
| POST | `/admin/payments` | Record payment manually |
| POST | `/admin/payments/:id/verify` | Re-verify a payment on-chain |
| DELETE | `/admin/payments/:id` | Delete payment record |
| GET | `/admin/pricing` | Get pricing settings |
| PUT | `/admin/pricing` | Update pricing |
| GET | `/admin/purchase-sessions` | List all purchase sessions |

---

## Admin Panel

In Docker mode, the admin panel is served at the root of the same port — just open `http://your-server:8082` in a browser.

Log in with your `ADMIN_TOKEN`. The panel gives you:

- **Dashboard** — live stats (customers, active licenses, pending payments)
- **Customers** — create, search, and delete customer records
- **Licenses** — issue keys manually, revoke, restore, filter by status
- **Payments** — view and manually re-verify on-chain payments
- **Pricing** — update plan prices without restarting

---

## Production Deployment

### Nginx reverse proxy (recommended)

```nginx
server {
  listen 80;
  server_name license.yourdomain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name license.yourdomain.com;

  ssl_certificate     /etc/letsencrypt/live/license.yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/license.yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://localhost:8082;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Data backup

```bash
# Backup the SQLite database
docker exec license-manager sqlite3 /data/licenseserver.db ".backup /data/backup.db"
docker cp license-manager:/data/backup.db ./license-backup-$(date +%Y%m%d).db
```

---

## CI/CD — Push to Docker Hub

The repo includes a GitHub Actions workflow that automatically builds and pushes the Docker image on every push to `main` or on version tags.

**Setup:**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add two secrets:
   - `DOCKERHUB_USERNAME` — your Docker Hub username
   - `DOCKERHUB_TOKEN` — a Docker Hub access token (not your password — create one at hub.docker.com → Account Settings → Security)
3. Push to `main` or tag a release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

The workflow builds for both `linux/amd64` and `linux/arm64` (works on ARM servers like Raspberry Pi / Oracle Free Tier).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 20, Express 5, TypeScript |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Blockchain | @solana/web3.js, @solana/spl-token |
| Admin UI | React 19, Vite 6, Tailwind CSS v4 |
| State | TanStack Query |
| Components | Radix UI + shadcn/ui |
| Container | Docker (multi-stage build, ~300 MB) |

---

## License

MIT
