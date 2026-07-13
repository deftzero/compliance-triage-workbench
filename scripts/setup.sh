#!/usr/bin/env bash
# Creates the two .env files and generates a real JWT secret.
# Idempotent — an existing .env is left alone, never overwritten.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

# The backend refuses to boot without a 16+ char JWT_SECRET, so generate one
# rather than leaving the placeholder from .env.example in place.
if [ -f apps/backend/.env ]; then
  echo "apps/backend/.env already exists, leaving it alone"
else
  secret="$(openssl rand -hex 32)"
  sed "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" \
    apps/backend/.env.example > apps/backend/.env
  echo "Created apps/backend/.env with a generated JWT_SECRET"
fi

if [ -f apps/admin/.env ]; then
  echo "apps/admin/.env already exists, leaving it alone"
else
  cp apps/admin/.env.example apps/admin/.env
  echo "Created apps/admin/.env"
fi

echo
echo "Done. Start everything with:  pnpm dev"
