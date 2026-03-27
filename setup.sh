#!/usr/bin/env bash
set -e

echo "=== ClipChat Setup ==="

# 1. Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
fi

# 2. Check OPENROUTER_API_KEY is set
set -a; . ./.env 2>/dev/null; set +a
if [ -z "$OPENROUTER_API_KEY" ]; then
  echo ""
  echo "⚠ OPENROUTER_API_KEY is not set in .env"
  echo "  Get a key at https://openrouter.ai and add it:"
  echo "  OPENROUTER_API_KEY=your_key_here"
  echo ""
  echo "  Setup will continue, but the engine will not start until this is set."
  echo ""
fi

# 3. Install dependencies
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"

# 4. Start infra
echo "Starting postgres and redis..."
docker compose up -d postgres redis

# 5. Wait for postgres to be healthy
echo "Waiting for postgres..."
until docker compose exec postgres pg_isready -U postgres -q 2>/dev/null; do
  sleep 1
done
echo "✓ Postgres ready"

# 6. Run migrations
echo "Running migrations..."
npm run db:migrate -w packages/engine
echo "✓ Migrations applied"

# 7. Create API key (skip if one already exists and is saved)
if grep -q "^ENGINE_API_KEY=.\+" .env 2>/dev/null; then
  echo "✓ ENGINE_API_KEY already set in .env — skipping key generation"
else
  echo "Creating API key..."
  KEY=$(npm run create-api-key -w packages/engine -- "dev" 2>&1 | grep -oE 'clp_[a-f0-9]{64}' | head -1)

  if [ -n "$KEY" ]; then
    if grep -q "^ENGINE_API_KEY=" .env; then
      sed -i.bak "s|^ENGINE_API_KEY=.*|ENGINE_API_KEY=$KEY|" .env && rm -f .env.bak
    else
      echo "ENGINE_API_KEY=$KEY" >> .env
    fi
    echo "✓ API key created and saved to .env"
  else
    echo "⚠ Could not auto-save API key. Run manually:"
    echo "  npm run create-api-key -w packages/engine -- \"dev\""
  fi
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Local dev:"
echo "  npm run dev          — start engine on :3000"
echo "  npm run dev:web      — start web UI on :3001"
echo ""
echo "Full Docker stack (requires OPENROUTER_API_KEY in .env):"
echo "  set -a && . .env && set +a"
echo "  docker compose up -d"
