# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the Admin UI (React + Vite)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS admin-build

WORKDIR /build/admin

COPY admin/package.json ./
RUN npm install --legacy-peer-deps

COPY admin/ ./

# PORT is required by vite.config.ts; BASE is not needed for production build
RUN PORT=3000 npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production Runtime (Express server + embedded admin UI)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install server dependencies (tsx included for TypeScript execution)
COPY server/package.json ./
RUN npm install

# Copy server TypeScript source
COPY server/src ./src
COPY server/tsconfig.json ./

# Embed the built admin UI so Express can serve it as static files
COPY --from=admin-build /build/admin/dist ./public

# Database is stored on a mounted volume so it survives container restarts
VOLUME ["/data"]

# ── Environment variables ─────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=8082
ENV DATABASE_PATH=/data/licenseserver.db
# Set these at runtime:
# ENV ADMIN_TOKEN=changeme
# ENV VAULT_WALLET_ADDRESS=YourSolanaWallet
# ENV SOLANA_RPC=https://api.mainnet-beta.solana.com
# ENV MONTHLY_PRICE_SOL=0.5
# ENV ANNUAL_PRICE_SOL=1.5
# ENV LIFETIME_PRICE_SOL=3

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8082/health || exit 1

CMD ["node_modules/.bin/tsx", "src/index.ts"]
