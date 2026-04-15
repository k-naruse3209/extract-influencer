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

# BACKEND_URL must be set at build time so Next.js bakes the correct rewrite destination
# into routes-manifest.json (rewrites() is evaluated at build time in standalone mode)
ARG BACKEND_URL=https://influencer-platformbackend-production.up.railway.app
ENV BACKEND_URL=$BACKEND_URL

# Reuse installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full monorepo (needed for shared types and next.config.mjs)
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

# Copy standalone output; in monorepo without outputFileTracingRoot,
# Next.js mirrors the workspace path → server.js lands at /app/frontend/server.js
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./

# Static assets must be at .next/static relative to server.js (/app/frontend/.next/static)
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static

# Public assets must be at public/ relative to server.js (/app/frontend/public)
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public

USER nextjs

EXPOSE 3000

CMD ["node", "frontend/server.js"]
