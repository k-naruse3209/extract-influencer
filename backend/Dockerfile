# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/

RUN npm ci --workspace=backend

COPY backend/prisma ./backend/prisma
RUN npx prisma generate --schema=backend/prisma/schema.prisma

COPY backend/tsconfig.json backend/nest-cli.json ./backend/
COPY backend/src ./backend/src
RUN npm run build --workspace=backend

# --- Stage 2: Production ---
FROM node:20-alpine AS runner

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
RUN npm ci --workspace=backend --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/dist ./backend/dist
COPY backend/prisma ./backend/prisma

RUN mkdir -p /app/backend/storage/reports && chown -R node:node /app
USER node

EXPOSE 3001

CMD ["node", "backend/dist/main.js"]
