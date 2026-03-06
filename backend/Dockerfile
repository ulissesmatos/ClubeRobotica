# ─── Stage 1: Build ──────────────────────────────────────────────────────────
# node:22+ necessário para node:sqlite (módulo nativo do Node.js)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Remove devDependencies
RUN npm ci --omit=dev

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Cria diretórios de volume e define permissões
RUN mkdir -p /data /uploads && chown -R node:node /data /uploads /app

# Copia apenas o necessário do stage de build
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "--experimental-sqlite", "dist/server.js"]
