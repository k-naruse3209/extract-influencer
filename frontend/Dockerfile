# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install only frontend workspace (and its transitive workspace deps)
RUN npm ci --workspace=@influencer-platform/frontend

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Reuse installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full monorepo (needed for shared types and next.config.ts)
COPY . .

# Build Next.js standalone output
RUN npm run build --workspace=@influencer-platform/frontend

# Ensure public directory exists even if empty
RUN mkdir -p /app/frontend/public

# Stage 3: Production runner (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output → /app (server.js lands at /app/server.js)
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./

# Static assets must be at .next/static relative to server.js
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

# Public assets must be at public/ relative to server.js
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
