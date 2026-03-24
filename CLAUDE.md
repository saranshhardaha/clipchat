# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ClipChat** — chat-first video editing platform. Natural language → FFmpeg operations.

Two components:
- **`packages/engine`** — open-source backend: Express API, BullMQ job queue, FFmpeg worker, MCP server (stdio)
- **SaaS UI** — closed-source Next.js frontend (Phase 3, not yet started)

## Commands

### Engine (packages/engine)

```bash
npm install                                    # install all workspaces
npm run dev -w packages/engine                 # start dev server (tsx watch)
npm run build -w packages/engine               # compile TypeScript
npm test -w packages/engine                    # run all tests (Vitest)
npm test -w packages/engine -- test/ffmpeg/trim.test.ts  # run single test file
npm run db:generate -w packages/engine         # generate Drizzle migrations
npm run db:migrate -w packages/engine          # apply migrations
npm run create-api-key -w packages/engine -- "label"     # generate an API key
```

### Docker (full stack)

```bash
docker compose up -d          # start Postgres + Redis + engine
docker compose down           # stop
docker compose build          # rebuild engine image
```

### Environment

Copy `.env.example` → `.env` before running locally. Required vars:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string (default: `redis://localhost:6379`)
- `STORAGE_DRIVER` — `local` (default) or `s3`

## Architecture

```
packages/engine/src/
├── types/          # Zod schemas + TS types for all 10 tools, jobs, storage
├── storage/        # StorageAdapter interface; local FS and S3 implementations
├── ffmpeg/         # One file per tool: executor.ts + info/trim/merge/resize/audio/text/speed/export
├── queue/          # BullMQ queue setup (index.ts) and worker (worker.ts)
├── db/             # Drizzle schema (jobs, files, api_keys) + migrations
├── api/            # Express app factory; routes: health/files/jobs/tools; middleware: auth/errors
└── mcp/            # McpServer with StdioServerTransport; wraps all 10 FFmpeg tools
```

**Job flow:** `POST /api/v1/jobs` → BullMQ queue → worker dispatches to `ffmpeg/*.ts` → updates DB → client polls `GET /jobs/:id` or streams via SSE `GET /jobs/:id/stream`.

**MCP:** Start with `node dist/index.js --mcp` to expose all 10 tools via stdio transport. MCP tools call FFmpeg directly (no queue) to support synchronous agent workflows.

**Storage:** `createStorage()` in `storage/index.ts` returns a `LocalStorageAdapter` or `S3StorageAdapter` based on `STORAGE_DRIVER` env var. FFmpeg tools receive file paths; the adapter resolves IDs to paths.

**Auth:** API key middleware hashes the Bearer token with SHA-256 and looks it up in `api_keys`. Use the `create-api-key` script to generate keys.

## Testing

Tests require running Postgres and Redis. The Docker Compose stack is the easiest way:

```bash
docker compose up -d postgres redis
export DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat
export REDIS_URL=redis://localhost:6379
npm test -w packages/engine
```

FFmpeg tests use synthetic fixtures generated once on first run (`test/helpers/fixtures.ts`). Test fixtures are gitignored (`test/fixtures/*.mp4`).

Tests are isolated: `singleFork: true` in vitest config prevents parallel FFmpeg processes from conflicting.

## Plans

Implementation plans live in `docs/superpowers/plans/`:
- `2026-03-24-clipchat-phase1-foundation.md` — **current**: open-source backend (16 tasks)
- Phase 2 (AI/Claude intent layer) — not yet written
- Phase 3 (SaaS UI: Next.js, Clerk, Stripe) — not yet written
