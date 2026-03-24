# ClipChat Engine

**Open-source video editing backend.** Natural language → FFmpeg operations via REST API and MCP server.

![Node 20](https://img.shields.io/badge/node-20%2B-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What is it?

ClipChat Engine is a self-hostable backend that exposes 10 FFmpeg operations as:

- **REST API** — async job queue (BullMQ) with SSE progress streaming
- **MCP Server** — Model Context Protocol server for AI agent integration (Claude, etc.)

It handles the FFmpeg heavy-lifting so you can focus on building interfaces — chat UIs, editors, automations, or AI agents that edit video through natural language.

---

## Features

| Feature | Detail |
|---------|--------|
| 10 FFmpeg tools | trim, merge, resize, extract audio, replace audio, add text, add subtitles, change speed, export, get info |
| Async job queue | BullMQ + Redis; jobs survive server restarts |
| SSE streaming | Real-time progress updates via Server-Sent Events |
| MCP server | All 10 tools accessible to AI agents via stdio |
| Local + S3 storage | Pluggable storage adapter |
| API key auth | SHA-256 hashed keys in PostgreSQL |
| TypeScript + Zod | End-to-end type safety with schema validation |

---

## Quick Start (Docker)

```bash
git clone https://github.com/your-org/clipchat.git
cd clipchat
cp .env.example .env

docker compose up -d
```

The API is now running at `http://localhost:3000`.

```bash
# Verify
curl http://localhost:3000/health
# {"status":"ok","version":"0.1.0"}

# Generate your first API key
docker compose exec engine npm run create-api-key -w packages/engine -- "mykey"
```

> Full local dev setup (without Docker): [Getting Started →](docs/getting-started.md)

---

## Architecture

```
HTTP Client / AI Agent
        │
        ▼
  Express API (:3000)
  ├── POST /api/v1/files/upload   → LocalStorage / S3
  ├── POST /api/v1/jobs           → BullMQ Queue (Redis)
  ├── GET  /api/v1/jobs/:id       → PostgreSQL (status poll)
  ├── GET  /api/v1/jobs/:id/stream→ SSE progress stream
  └── GET  /api/v1/tools          → tool manifest
        │
        ▼
  BullMQ Worker
  └── Dispatches to ffmpeg/*.ts
        │
        ▼
  FFmpeg (subprocess)
        │
        ▼
  Result stored in PostgreSQL

  ─────────────────────────────
  MCP Server (stdio, --mcp flag)
  └── 10 tools → FFmpeg direct (synchronous)
```

**Job flow:** `POST /jobs` → BullMQ queue → worker → FFmpeg → DB update → client polls `GET /jobs/:id` or streams via SSE.

**MCP flow:** AI agent calls tool → FFmpeg runs synchronously → result returned immediately.

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/v1/files/upload` | Upload a video/audio file |
| `GET` | `/api/v1/files/:id` | Get file metadata |
| `DELETE` | `/api/v1/files/:id` | Delete a file |
| `POST` | `/api/v1/jobs` | Submit an async job |
| `GET` | `/api/v1/jobs/:id` | Poll job status |
| `GET` | `/api/v1/jobs/:id/stream` | SSE job progress stream |
| `DELETE` | `/api/v1/jobs/:id` | Cancel a job |
| `GET` | `/api/v1/tools` | List available tools |
| `POST` | `/api/v1/tools/:name` | Direct tool invocation (async) |

All `/api/v1/*` endpoints require `Authorization: Bearer <api-key>` header (except `GET /health`).

Full endpoint docs: [API Reference →](docs/api-reference.md)

---

## FFmpeg Tools

| Tool | Description |
|------|-------------|
| `get_video_info` | Extract duration, resolution, codec, bitrate |
| `trim_video` | Cut a clip between two timestamps |
| `merge_clips` | Concatenate clips (with optional crossfade) |
| `resize_video` | Resize by dimensions or preset (720p, 1080p, 4k, square, 9:16) |
| `extract_audio` | Extract audio track as mp3/aac/wav |
| `replace_audio` | Swap or mix audio tracks |
| `add_text_overlay` | Burn text with custom font/size/color/position |
| `add_subtitles` | Burn SRT subtitles (or add as soft track) |
| `change_speed` | Speed up or slow down (0.25×–4×) |
| `export_video` | Re-encode to mp4/webm/mov/gif with quality control |

Full tool docs with schemas and examples: [Tools Reference →](docs/tools-reference.md)

---

## MCP Integration

Connect ClipChat to Claude or any MCP-compatible AI:

```bash
# Build first
npm run build -w packages/engine

# Start as MCP server
node packages/engine/dist/index.js --mcp
```

Claude Desktop config:
```json
{
  "mcpServers": {
    "clipchat": {
      "command": "node",
      "args": ["/absolute/path/to/clipchat/packages/engine/dist/index.js", "--mcp"],
      "env": { "DATABASE_URL": "...", "REDIS_URL": "..." }
    }
  }
}
```

[MCP Integration Guide →](docs/mcp-integration.md)

---

## Tech Stack

- **Runtime:** Node.js 20, TypeScript 5
- **API:** Express 4, Multer (file uploads), CORS
- **Queue:** BullMQ 5 + Redis 7
- **Database:** PostgreSQL 16 + Drizzle ORM
- **FFmpeg:** fluent-ffmpeg wrapper
- **Validation:** Zod
- **MCP:** @modelcontextprotocol/sdk
- **Storage:** Local FS or AWS S3 / S3-compatible (MinIO)
- **Testing:** Vitest 1.6 + Supertest

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Open-source backend — REST API + MCP server (this repo) |
| Phase 2 | Planned | AI/Claude intent layer — `/chat` endpoint, NL → tool calls |
| Phase 3 | Planned | SaaS UI — Next.js, Clerk auth, Stripe billing |

---

## Documentation

- [Getting Started](docs/getting-started.md) — local dev setup, running tests
- [API Reference](docs/api-reference.md) — all endpoints with schemas and examples
- [Tools Reference](docs/tools-reference.md) — all 10 FFmpeg tools documented
- [MCP Integration](docs/mcp-integration.md) — AI agent setup (Claude Desktop, Claude Code)
- [Deployment](docs/deployment.md) — Docker Compose, S3, production hardening
- [Contributing](CONTRIBUTING.md) — development workflow, adding new tools

---

## License

MIT
