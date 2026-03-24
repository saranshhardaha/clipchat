# Getting Started

This guide walks through setting up ClipChat Engine for local development.

---

## Prerequisites

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | Runtime |
| npm | 10+ | Package manager |
| FFmpeg | Any recent | Video processing |
| Docker | 24+ | Postgres + Redis (easiest) |
| Git | Any | Version control |

**Install FFmpeg:**
```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt-get install ffmpeg

# Windows — download from https://ffmpeg.org/download.html
# Ensure ffmpeg and ffprobe are on PATH
```

---

## 1. Clone and Install

```bash
git clone https://github.com/your-org/clipchat.git
cd clipchat
npm install
```

This installs dependencies for all workspaces (currently just `packages/engine`).

---

## 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and set the required values. The defaults work for local development:

```env
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat
REDIS_URL=redis://localhost:6379
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads
PORT=3000
WORKER_CONCURRENCY=2
```

---

## 3. Start Postgres and Redis

The easiest way is Docker:

```bash
docker compose up -d postgres redis
```

Or start them individually:
```bash
docker run -d --name clipchat-pg \
  -e POSTGRES_DB=clipchat \
  -e POSTGRES_PASSWORD=clipchat \
  -p 5432:5432 postgres:16

docker run -d --name clipchat-redis \
  -p 6379:6379 redis:7
```

---

## 4. Run Database Migrations

```bash
npm run db:generate -w packages/engine
npm run db:migrate -w packages/engine
```

This creates the `files`, `jobs`, and `api_keys` tables.

---

## 5. Generate an API Key

```bash
npm run create-api-key -w packages/engine -- "dev"
```

Output:
```
API key created for "dev":
clp_a1b2c3d4e5f6...

Store this safely — it will not be shown again.
```

Copy this key — you'll use it as `Authorization: Bearer <key>` in API requests.

---

## 6. Start the Dev Server

```bash
npm run dev
```

This starts the Express API server and BullMQ worker with hot reload (via `tsx watch`).

```
ClipChat API listening on :3000
```

---

## 7. Verify

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","version":"0.1.0"}`

Test an authenticated endpoint:
```bash
curl -H "Authorization: Bearer clp_YOUR_KEY_HERE" \
  http://localhost:3000/api/v1/tools
```

Expected: JSON with 10 tools listed.

---

## Running Tests

Tests require Postgres and Redis. Start them first:

```bash
docker compose up -d postgres redis
```

Run all tests:
```bash
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat \
REDIS_URL=redis://localhost:6379 \
npm test -w packages/engine
```

Run a single test file:
```bash
DATABASE_URL=... REDIS_URL=... \
npm test -w packages/engine -- test/ffmpeg/trim.test.ts
```

**Test fixtures** (test.mp4, test.mp3, test.srt) are auto-generated on first run using FFmpeg. This takes ~10 seconds once and is then cached. Fixtures are gitignored.

**Note:** Tests run with `singleFork: true` — FFmpeg tests cannot run in parallel. This is by design to prevent process conflicts.

---

## Full Docker Stack

To run everything in Docker (including the engine):

```bash
docker compose build
docker compose up -d
```

Then generate an API key inside the container:
```bash
docker compose exec engine npm run create-api-key -w packages/engine -- "prod"
```

---

## Troubleshooting

**`ffmpeg: not found`**
FFmpeg is not on your PATH. Install it (see Prerequisites) and verify with `ffmpeg -version`.

**`Error: DATABASE_URL is required`**
You didn't set `DATABASE_URL` in your environment. Either copy `.env.example` → `.env` or export the variable:
```bash
export DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat
```

**`ECONNREFUSED` on port 5432 or 6379**
Postgres or Redis isn't running. Start them with `docker compose up -d postgres redis`.

**Port 3000 already in use**
Change the `PORT` in your `.env` file:
```env
PORT=3001
```

**Tests fail with `Cannot connect to database`**
Pass `DATABASE_URL` as an env var when running tests — `vitest` does not load `.env` files automatically.

**Migrations fail with "relation already exists"**
Migrations have already been applied. This is safe to ignore or you can reset:
```bash
docker compose down -v  # deletes pgdata volume
docker compose up -d postgres
npm run db:migrate -w packages/engine
```
