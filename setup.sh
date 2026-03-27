#!/usr/bin/env bash
set -e

echo "=== ClipChat Setup ==="

# 1. Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
  echo ""
  echo "  Edit .env and set OPENROUTER_API_KEY before running the engine."
  echo "  Get a key at https://openrouter.ai"
  echo ""
fi

# 2. Install dependencies
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"

# 3. Start infra
echo "Starting postgres and redis..."
docker compose up -d postgres redis

# 4. Wait for postgres to be healthy
echo "Waiting for postgres..."
until docker compose exec postgres pg_isready -U postgres -q 2>/dev/null; do
  sleep 1
done
echo "✓ Postgres ready"

# 5. Run migrations
echo "Running migrations..."
npm run db:migrate -w packages/engine
echo "✓ Migrations applied"

# 6. Create API key
echo "Creating API key..."
KEY=$(npm run create-api-key -w packages/engine -- "dev" 2>&1 | grep -oE 'clp_[a-f0-9]{64}' | head -1)

if [ -n "$KEY" ]; then
  # Update ENGINE_API_KEY in .env
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

echo ""
echo "=== Setup complete ==="
echo ""
echo "Start the engine:  npm run dev"
echo "Start the web UI:  npm run dev:web"
echo "Full stack Docker: ENGINE_API_KEY=\$ENGINE_API_KEY docker compose up -d"
