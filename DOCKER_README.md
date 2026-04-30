# License Manager

A self-hosted software licensing server with **Solana SOL payment support** and a built-in React admin panel — all in a single Docker container.

## Features

- 🔑 License key generation and validation
- ⛓️ On-chain SOL & USDC payment verification (Solana mainnet)
- 🛒 Self-service purchase flow (pricing → invoice → pay → license auto-issued)
- 🖥️ Built-in admin panel (accessible at the same port — no separate deployment)
- 📦 SQLite database — zero external dependencies
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
      VAULT_WALLET_ADDRESS: YourSolanaWalletAddress
      SOLANA_RPC: https://api.mainnet-beta.solana.com
      MONTHLY_PRICE_SOL: 0.5
      ANNUAL_PRICE_SOL: 1.5
      LIFETIME_PRICE_SOL: 3
    restart: unless-stopped

volumes:
  license_data:
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ADMIN_TOKEN` | `changeme` | Secret token for all `/admin/*` routes |
| `VAULT_WALLET_ADDRESS` | — | Solana wallet that receives payments |
| `SOLANA_RPC` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |
| `PORT` | `8082` | HTTP port |
| `DATABASE_PATH` | `/data/licenseserver.db` | SQLite file path (keep on a volume) |
| `MONTHLY_PRICE_SOL` | `0.5` | Monthly plan price in SOL |
| `ANNUAL_PRICE_SOL` | `1.5` | Annual plan price in SOL |
| `LIFETIME_PRICE_SOL` | `3` | Lifetime plan price in SOL |
| `MONTHLY_PRICE_USDC` | `49` | Monthly plan price in USDC |
| `ANNUAL_PRICE_USDC` | `149` | Annual plan price in USDC |
| `LIFETIME_PRICE_USDC` | `299` | Lifetime plan price in USDC |

---

## API — Application Integration

### 1. Get pricing

```
GET /purchase/pricing
```

### 2. Create a purchase session

```
POST /purchase/init
Body: { "email": "user@example.com", "name": "John", "plan": "monthly", "currency": "SOL" }
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

The SQLite database is stored at `/data/licenseserver.db` inside the container. Always mount `/data` as a volume — otherwise all data is lost when the container restarts.

```bash
-v license_data:/data     # named volume (recommended)
-v /host/path:/data       # or bind mount to a host directory
```

---

## Source Code

[github.com/Ofoq-Modern-Technology/License-Manager](https://github.com/Ofoq-Modern-Technology/License-Manager)
