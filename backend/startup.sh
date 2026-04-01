#!/bin/bash

set -e

echo "Running database migrations..."
npx prisma migrate deploy --schema=backend/prisma/schema.prisma

echo "Running seed..."
node backend/dist/seed.js || true

echo "Starting application..."
exec node backend/dist/main.js
