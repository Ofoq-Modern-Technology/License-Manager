# License Manager

A self-hosted software licensing server with **multi-product support**, **Solana SOL/USDC payment verification**, and a built-in React admin panel — all in a single Docker container.

## Features

- 📦 **Multi-product** — manage multiple products, each with its own pricing and payment vault
- 🔑 License key generation, validation, activation, and revocation
- ⛓️ On-chain SOL & USDC payment verification (Solana mainnet)
- 🛒 Self-service purchase flow — customers pay on-chain, license is auto-issued
- 🖥️ Built-in admin panel (same port, no separate deployment needed)
- 🗄️ SQLite database — zero external dependencies
- 🔒 Token-protected admin API

---

## Quick Start

```bash
docker run -d \
  --name license-manager \
  -p 8082:8082 \
  -v license_data:/data \
  -e ADMIN_TOKEN=your-secret-token \
  -e VAULT_WALLET_ADDRESS=YourSolanaWalletAddress \
  youruser/license-manager:latest
```

Admin panel → **http://localhost:8082**  
API → **http://localhost:8082/license**, **/purchase**, **/admin**

After starting, open the admin panel and go to **Products** to create your first product and set its pricing.

---

## docker-compose

```yaml
version: "3.9"
services:
  license-manager:
    image: youruser/license-manager:latest
    ports:
      - "8082:8082"
    volumes:
      - license_data:/data
    environment:
      ADMIN_TOKEN: your-secret-token
      VAULT_WALLET_ADDRESS: YourSolanaWalletAddress   # global fallback vault
      SOLANA_RPC: https://api.mainnet-beta.solana.com
      # Pricing is managed per-product in the admin panel.
      # Uncomment below only if you want a global price fallback.
      # MONTHLY_PRICE_SOL: 0.5
      # ANNUAL_PRICE_SOL: 1.5
      # LIFETIME_PRICE_SOL: 3
    restart: unless-stopped

volumes:
  license_data:
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_TOKEN` | **Yes** | Secret token for all `/admin/*` routes — change from default! |
| `VAULT_WALLET_ADDRESS` | **Yes** | Global fallback Solana wallet for receiving payments |
| `SOLANA_RPC` | No | RPC endpoint (default: public mainnet — use Helius/QuickNode in production) |
| `PORT` | No | HTTP port (default: `8082`) |
| `DATABASE_PATH` | No | SQLite file path (default: `/data/licenseserver.db`) |

### Global fallback pricing (optional)

Pricing is set **per product** in the admin panel under **Products → Edit**. The env vars below are only used as a fallback for any product that doesn't have its own price set. You do not need to set these if you manage all pricing through the admin panel.

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

Each product you create in the admin panel can have:
- Its own SOL and USDC pricing for monthly, annual, and lifetime plans
- Its own Solana vault wallet address (payments go directly to that wallet)
- An active/inactive status (inactive products cannot be purchased)

When a purchase session is created with a `productId`, the server uses that product's pricing. Any price field left blank on the product falls back to the global env var values.

---

## API — Application Integration

### 1. Get pricing for a product

```
GET /purchase/pricing?productId=1
```

### 2. Create a purchase session

```
POST /purchase/init
Body: { "email": "user@example.com", "name": "John", "plan": "monthly", "currency": "SOL", "productId": 1 }
→ { purchaseId, walletAddress, expectedAmountSol, expiresAt }
```

### 3. Poll for payment status

```
GET /purchase/status/:purchaseId
→ { status: "awaiting_payment" | "paid" | "expired", licenseKey }
```

### 4. Validate a license in your app

```
POST /license/validate
Body: { "key": "XXXX-XXXX-XXXX-XXXX", "instanceId": "machine-id" }
→ { valid: true, plan, expiresAt }
```

---

## Data Persistence

The SQLite database is stored at `/data/licenseserver.db`. Always mount `/data` as a volume:

```bash
-v license_data:/data     # named volume (recommended)
-v /host/path:/data       # or bind mount to a host directory
```

---

## Source Code

[github.com/Ofoq-Modern-Technology/License-Manager](https://github.com/Ofoq-Modern-Technology/License-Manager)
