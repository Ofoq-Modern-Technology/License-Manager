# License Manager

A self-hosted software licensing server with **multi-product support**, **Solana SOL/USDC payment verification**, and a built-in React admin panel. Ship it as a single Docker container alongside any number of products.

## Features

- **Multi-product** — create multiple products, each with its own pricing and Solana payment vault
- **License key generation** — issue unique keys tied to a product, plan, customer, and expiry
- **Solana payment verification** — customers pay on-chain (SOL or USDC), server verifies and auto-issues the license
- **Self-service purchase flow** — apps call 3 endpoints: get pricing → create invoice → poll status
- **Admin panel** — manage products, customers, licenses, payments, and settings from a browser UI (served on the same port in Docker)
- **Token-based admin auth** — `ADMIN_TOKEN` env var protects all admin routes
- **SQLite storage** — zero external database, single file, easy to back up

---

## Table of Contents

1. [Docker (recommended)](#docker-recommended)
2. [Manual setup (development)](#manual-setup-development)
3. [Environment variables](#environment-variables)
4. [Products & pricing](#products--pricing)
5. [Application integration guide](#application-integration-guide)
6. [Full API reference](#full-api-reference)
7. [Admin panel](#admin-panel)
8. [Production deployment](#production-deployment)
9. [CI/CD — Push to Docker Hub](#cicd--push-to-docker-hub)
10. [Tech stack](#tech-stack)

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

After starting, open the admin panel → **Products** → create your first product and configure its pricing there.

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
npm run dev   # opens http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_TOKEN` | **Yes** | Secret token protecting all `/admin/*` routes — change the default! |
| `VAULT_WALLET_ADDRESS` | **Yes** | Global fallback Solana wallet for receiving payments |
| `SOLANA_RPC` | No | RPC endpoint (default: public mainnet — use Helius/QuickNode in production) |
| `PORT` | No | HTTP port (default: `8082`) |
| `DATABASE_PATH` | No | SQLite file path (default: `/data/licenseserver.db` in Docker) |

### Global fallback pricing (optional)

**Pricing is managed per-product in the admin panel** under Products → Edit. You do not need to set the variables below if you configure all pricing through the admin UI.

These env vars are only used as a fallback for any price field that isn't set on the product itself:

| Variable | Default | Description |
|---|---|---|
| `MONTHLY_PRICE_SOL` | `0.5` | Fallback monthly price in SOL |
| `ANNUAL_PRICE_SOL` | `1.5` | Fallback annual price in SOL |
| `LIFETIME_PRICE_SOL` | `3` | Fallback lifetime price in SOL |
| `MONTHLY_PRICE_USDC` | `49` | Fallback monthly price in USDC |
| `ANNUAL_PRICE_USDC` | `149` | Fallback annual price in USDC |
| `LIFETIME_PRICE_USDC` | `299` | Fallback lifetime price in USDC |

---

## Products & Pricing

License Manager supports multiple products on a single server instance. Each product has:

- **Name and description** — shown in the admin panel
- **Status** — `active` (purchasable) or `inactive` (blocked from purchase)
- **Per-product pricing** — monthly, annual, and lifetime prices in both SOL and USDC. Any field left blank falls back to the global env var default
- **Per-product vault wallet** — payments for this product go to this wallet. Leave blank to use the global `VAULT_WALLET_ADDRESS`

### Typical setup

1. Start the container with only `ADMIN_TOKEN` and `VAULT_WALLET_ADDRESS`
2. Open the admin panel → **Products** → **New Product**
3. Fill in the name, description, pricing, and (optionally) a dedicated vault wallet
4. Pass `productId` when calling `/purchase/init` from your app

---

## Application Integration Guide

### Overview of the purchase flow

```
Your App                           License Manager Server
   │                                         │
   │  1. GET /purchase/pricing?productId=1   │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │
   │     { monthly_price_sol, ... }          │
   │                                         │
   │  2. POST /purchase/init                 │
   │     { email, name, plan, currency,      │
   │       productId }                       │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │
   │     { purchaseId, walletAddress,        │
   │       expectedAmountSol, expiresAt }    │
   │                                         │
   │  3. Show payment UI — user sends SOL    │
   │     to walletAddress                    │
   │                                         │
   │  4. Poll GET /purchase/status/:id       │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │  ← verified on-chain
   │     { status: "paid",                   │
   │       licenseKey: "XXXX-XXXX-..." }     │
   │                                         │
   │  5. Store licenseKey locally            │
   │  6. POST /license/validate (on launch)  │
   │ ──────────────────────────────────────► │
   │ ◄────────────────────────────────────── │
   │     { valid: true, plan, expiresAt }    │
```

### Step 1 — Fetch pricing for a product

```
GET https://your-server.com/purchase/pricing?productId=1
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

The `productId` is optional. Without it, the global fallback pricing is returned.

---

### Step 2 — Create a purchase session

```
POST https://your-server.com/purchase/init
Content-Type: application/json

{
  "email":     "user@example.com",
  "name":      "Jane Doe",
  "plan":      "monthly",        // "monthly" | "annual" | "lifetime"
  "currency":  "SOL",            // "SOL" | "USDC"
  "productId": 1                 // optional — ties the license to this product
}
```

**Response:**
```json
{
  "purchaseId":        "550e8400-e29b-41d4-a716-446655440000",
  "walletAddress":     "A1b2C3d4E5f6...",
  "expectedAmountSol": 0.5,
  "currency":          "SOL",
  "plan":              "monthly",
  "productId":         1,
  "expiresAt":         "2025-05-01T12:30:00.000Z"
}
```

---

### Step 3 — User sends payment

Show `walletAddress` and `expectedAmountSol` to the user. The server polls the wallet every 20 seconds and auto-issues the license once payment arrives.

---

### Step 4 — Poll for confirmation

```
GET https://your-server.com/purchase/status/550e8400-e29b-41d4-a716-446655440000
```

**Response (paid):**
```json
{
  "status":     "paid",
  "licenseKey": "MXKA-7TQP-N2WB-4HCR",
  "productId":  1,
  "plan":       "monthly"
}
```

---

### Step 5 — Validate on every launch

```
POST https://your-server.com/license/validate
Content-Type: application/json

{
  "key":        "MXKA-7TQP-N2WB-4HCR",
  "instanceId": "unique-machine-or-device-id"
}
```

**Valid response:**
```json
{ "valid": true, "plan": "monthly", "expiresAt": "2025-06-01T00:00:00.000Z" }
```

**Invalid / expired:**
```json
{ "valid": false, "reason": "License expired" }
```

> **Tip:** Cache the last successful validation with a timestamp. Allow a grace period (24–72 hours) if the server is temporarily unreachable.

---

### Code example (TypeScript)

```typescript
const LICENSE_SERVER = "https://your-server.com";
const PRODUCT_ID = 1;

// 1. Get pricing
const pricing = await fetch(`${LICENSE_SERVER}/purchase/pricing?productId=${PRODUCT_ID}`)
  .then(r => r.json());

// 2. Create invoice
const session = await fetch(`${LICENSE_SERVER}/purchase/init`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    name: "Jane",
    plan: "lifetime",
    currency: "SOL",
    productId: PRODUCT_ID,
  }),
}).then(r => r.json());

console.log(`Send ${session.expectedAmountSol} SOL to ${session.walletAddress}`);

// 3. Poll
let licenseKey: string | null = null;
while (!licenseKey) {
  await new Promise(r => setTimeout(r, 10_000));
  const { status, licenseKey: key } = await fetch(
    `${LICENSE_SERVER}/purchase/status/${session.purchaseId}`
  ).then(r => r.json());
  if (status === "paid")    { licenseKey = key; break; }
  if (status === "expired") throw new Error("Payment session expired");
}

// 4. Validate
const { valid, plan, expiresAt } = await fetch(`${LICENSE_SERVER}/license/validate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: licenseKey, instanceId: "device-xyz" }),
}).then(r => r.json());

if (!valid) throw new Error("Invalid license");
console.log(`License OK — ${plan}, expires ${expiresAt}`);
```

---

## Full API Reference

### Public endpoints (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check → `{ ok: true }` |
| GET | `/purchase/pricing?productId=` | Product pricing (falls back to global if no productId) |
| POST | `/purchase/init` | Create a purchase session |
| GET | `/purchase/status/:id` | Poll status + retrieve license key |
| POST | `/license/validate` | Validate a license key |
| POST | `/license/activate` | Bind a license to a machine instance |
| POST | `/license/deactivate` | Unbind a license from its instance |

### Admin endpoints (require `x-admin-token: <ADMIN_TOKEN>` header)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/stats` | Dashboard counts (includes product count) |
| GET | `/admin/products` | List all products with license counts |
| POST | `/admin/products` | Create a product |
| PUT | `/admin/products/:id` | Update a product (name, pricing, vault, status) |
| DELETE | `/admin/products/:id` | Delete a product |
| GET | `/admin/customers` | List customers |
| POST | `/admin/customers` | Create customer |
| DELETE | `/admin/customers/:id` | Delete customer |
| GET | `/admin/licenses` | List license keys (includes product name) |
| POST | `/admin/licenses` | Create license manually |
| POST | `/admin/licenses/:id/revoke` | Revoke a license |
| POST | `/admin/licenses/:id/restore` | Restore a revoked license |
| DELETE | `/admin/licenses/:id` | Delete license |
| GET | `/admin/payments` | List payments |
| POST | `/admin/payments` | Record payment manually |
| POST | `/admin/payments/:id/verify` | Re-verify a payment on-chain |
| DELETE | `/admin/payments/:id` | Delete payment record |
| GET | `/admin/pricing` | Get global fallback pricing settings |
| PUT | `/admin/pricing` | Update global fallback pricing |
| GET | `/admin/purchase-sessions` | List all purchase sessions (includes product name) |

---

## Admin Panel

In Docker mode, the admin panel is served at the root of the same port — open `http://your-server:8082`.

Log in with your `ADMIN_TOKEN`. The panel gives you:

- **Dashboard** — live stats (products, customers, active licenses, payments)
- **Products** — create products with per-product pricing and vault wallet; edit or delete
- **Customers** — create, search, and delete customer records
- **Licenses** — issue keys manually (tied to a product and customer), revoke, restore
- **Payments** — view and re-verify on-chain payments
- **Pricing** — update the global fallback prices (used when a product has no price set)

---

## Production Deployment

### Nginx reverse proxy

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
docker exec license-manager sqlite3 /data/licenseserver.db ".backup /data/backup.db"
docker cp license-manager:/data/backup.db ./license-backup-$(date +%Y%m%d).db
```

---

## CI/CD — Push to Docker Hub

The included GitHub Actions workflow builds and pushes the Docker image **only when explicitly triggered** — it does not push on every commit.

### How to trigger a DockerHub push

**Option 1 — Include keyword in commit message:**
```bash
git commit -m "release: v1.2.0 [push to dockerhub]"
git push
```

**Option 2 — Push a version tag:**
```bash
git tag v1.2.0
git push origin v1.2.0
```

**Option 3 — Run manually** from the GitHub repository → Actions tab → "Build & Push Docker Image" → Run workflow.

### Setup

1. GitHub repo → Settings → Secrets and variables → Actions
2. Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (create a token at hub.docker.com → Account Settings → Security)
3. The workflow builds for `linux/amd64` and `linux/arm64`

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
