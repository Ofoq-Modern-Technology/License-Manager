# License Manager

A self-hosted software licensing system with Solana SOL payment support. Includes a backend server and a React admin panel.

## Features

- **License key generation** — issue unique license keys tied to a product and expiry
- **SOL payment verification** — customers pay on-chain, the server verifies the transaction automatically
- **Admin panel** — manage customers, licenses, payments, and pricing tiers from a browser UI
- **Configurable payment wallet** — set any Solana wallet to receive payments
- **Token-based admin auth** — simple `ADMIN_TOKEN` environment variable protects all admin routes
- **SQLite storage** — zero-dependency database, single file, easy to back up

---

## Project Structure

```
License-Manager/
├── server/          # Express API + SQLite database
│   ├── src/
│   │   ├── routes/  # admin.ts, license.ts, purchase.ts
│   │   ├── lib/     # keygen, payment poller, Solana verify, settings
│   │   ├── middleware/
│   │   └── index.ts
│   └── package.json
│
└── admin/           # React + Vite admin dashboard
    ├── src/
    │   ├── pages/   # Dashboard, Customers, Licenses, Payments, Pricing
    │   └── components/
    └── package.json
```

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/Ofoq-Modern-Technology/License-Manager.git
cd License-Manager
```

### 2. Install dependencies

```bash
cd server && npm install
cd ../admin && npm install
```

### 3. Configure environment

Create a `.env` file inside `server/`:

```env
PORT=8082
ADMIN_TOKEN=your-secret-admin-token
PAYMENT_WALLET=YourSolanaWalletAddressHere
SOLANA_RPC=https://api.mainnet-beta.solana.com
```

> **ADMIN_TOKEN** — set this to a long random string. All `/admin/*` routes require it via the `x-admin-token` header.  
> **PAYMENT_WALLET** — the Solana wallet that receives purchase payments.  
> **SOLANA_RPC** — optional, defaults to public mainnet RPC. Use a private RPC (Helius, QuickNode) for production.

### 4. Run the server

```bash
cd server
npm run dev
```

The API will be available at `http://localhost:8082`.

### 5. Run the admin panel

```bash
cd admin
npm run dev:ui
```

Open `http://localhost:3000` in your browser. The admin UI proxies all `/lapi` requests to the server at port 8082.

---

## API Overview

### License verification (public)

```
POST /license/verify
Body: { "licenseKey": "XXXX-XXXX-XXXX-XXXX", "machineId": "optional-machine-id" }
```

Returns `{ valid: true, product, expiresAt }` or `{ valid: false, reason }`.

### Purchase flow

```
POST /purchase/initiate
Body: { "productId": "...", "email": "..." }
→ Returns { paymentAddress, amountSol, purchaseId }

POST /purchase/verify
Body: { "purchaseId": "...", "txSignature": "..." }
→ Returns { licenseKey } on success
```

The server polls the Solana chain to confirm payment automatically — manual verify is available for instant confirmation.

### Admin routes (require `x-admin-token` header)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/customers` | List all customers |
| GET | `/admin/licenses` | List all license keys |
| POST | `/admin/licenses` | Create a license manually |
| PATCH | `/admin/licenses/:id` | Update a license (extend, revoke) |
| GET | `/admin/payments` | List all payments |
| GET | `/admin/pricing` | List pricing tiers |
| POST | `/admin/pricing` | Create a pricing tier |
| GET | `/admin/settings` | View settings |
| PATCH | `/admin/settings` | Update settings |

---

## Production Deployment

1. Build the server:
   ```bash
   cd server && npm run build
   node dist/server.cjs
   ```

2. Build the admin UI (serve as static files behind nginx or any static host):
   ```bash
   cd admin && npm run build
   # dist/ contains the static site
   ```

3. Point the admin's `/lapi` proxy at your server's hostname in production by setting a reverse proxy rule (nginx example):
   ```nginx
   location /lapi/ {
       proxy_pass http://localhost:8082/;
   }
   location / {
       root /path/to/admin/dist;
       try_files $uri /index.html;
   }
   ```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js, Express 5, TypeScript |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Blockchain | @solana/web3.js, @solana/spl-token |
| Admin UI | React 19, Vite 6, Tailwind CSS v4 |
| State | TanStack Query |
| Components | Radix UI + shadcn/ui |

---

## License

MIT
