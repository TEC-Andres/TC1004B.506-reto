#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Starting PostgreSQL (docker compose up -d)..."
docker compose -f "$ROOT/docker-compose.yml" up -d

echo "==> Waiting for PostgreSQL to accept connections..."
until docker compose -f "$ROOT/docker-compose.yml" exec -T db pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done
echo "    PostgreSQL is ready."

if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "==> Installing backend dependencies..."
  (cd "$ROOT/backend" && npm install)
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

cd "$ROOT/backend"

echo "==> Generating Prisma client..."
npx prisma generate

if [ -z "$(ls -A "$ROOT/backend/prisma/migrations" 2>/dev/null)" ]; then
  echo "==> Creating initial migration..."
  npx prisma migrate dev --name init
else
  echo "==> Applying migrations..."
  npx prisma migrate dev
fi

echo "==> Setup complete. Start everything with ./run.sh"