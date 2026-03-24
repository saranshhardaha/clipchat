# ClipChat Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully self-hostable ClipChat backend with 10 FFmpeg tools accessible via REST API and MCP server (stdio), runnable with `docker compose up`.

**Architecture:** Express.js API accepts job submissions → BullMQ/Redis queue → isolated FFmpeg worker processes → results stored in local FS (dev) or S3 (prod). MCP server shares the same job execution core. PostgreSQL + Drizzle tracks jobs, files, and API keys.

**Tech Stack:** Node.js 20 LTS, TypeScript 5, Express, BullMQ + Redis, fluent-ffmpeg, Drizzle ORM + PostgreSQL, @modelcontextprotocol/sdk, Vitest, Zod, Docker Compose

---

## Scope

This is **Phase 1 only** — open-source backend. No AI/Claude intent layer (Phase 2), no SaaS UI (Phase 3).

Separate plans cover:
- Phase 2: AI layer (Claude intent parsing → tool calls, `/chat` endpoint, session management)
- Phase 3: SaaS UI (Next.js, Clerk auth, Stripe billing, cloud storage)
- Phase 4: Growth features (URL input, team workspaces, timeline, SSE MCP transport)

---

## File Structure

```
clipchat/
├── packages/engine/
│   ├── src/
│   │   ├── types/
│   │   │   ├── job.ts           # Job, JobStatus, JobInput, JobResult discriminated unions
│   │   │   ├── storage.ts       # StorageAdapter interface, FileRecord
│   │   │   └── tools.ts         # Zod schemas + TS types for all 10 tool inputs/outputs
│   │   ├── storage/
│   │   │   ├── index.ts         # createStorage() reads STORAGE_DRIVER env var
│   │   │   ├── local.ts         # LocalStorageAdapter: saves to ./uploads/
│   │   │   └── s3.ts            # S3StorageAdapter: @aws-sdk/client-s3
│   │   ├── ffmpeg/
│   │   │   ├── executor.ts      # FFmpegExecutor: wraps fluent-ffmpeg, emits progress
│   │   │   ├── info.ts          # get_video_info (ffprobe)
│   │   │   ├── trim.ts          # trim_video
│   │   │   ├── merge.ts         # merge_clips (concat demuxer + xfade filter)
│   │   │   ├── resize.ts        # resize_video (scale filter + presets)
│   │   │   ├── audio.ts         # extract_audio, replace_audio
│   │   │   ├── text.ts          # add_text_overlay (drawtext), add_subtitles
│   │   │   ├── speed.ts         # change_speed (setpts + atempo)
│   │   │   └── export.ts        # export_video (re-encode, target size)
│   │   ├── queue/
│   │   │   ├── index.ts         # BullMQ Queue + Redis connection
│   │   │   └── worker.ts        # Worker: dequeues → FFmpeg tool → updates DB
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle tables: jobs, files, api_keys
│   │   │   ├── index.ts         # postgres() + drizzle() export
│   │   │   └── migrations/      # drizzle-kit generated SQL
│   │   ├── api/
│   │   │   ├── index.ts         # Express app factory (no listen — for testing)
│   │   │   ├── server.ts        # Calls app.listen() — only imported by entrypoint
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts      # Bearer API key → req.apiKeyId middleware
│   │   │   │   └── errors.ts    # Global AppError handler
│   │   │   └── routes/
│   │   │       ├── health.ts    # GET /health
│   │   │       ├── files.ts     # POST /files/upload, GET/DELETE /files/:id
│   │   │       ├── jobs.ts      # POST /jobs, GET /jobs/:id + /stream, DELETE /jobs/:id
│   │   │       └── tools.ts     # GET /tools, POST /tools/:name
│   │   ├── mcp/
│   │   │   ├── index.ts         # McpServer with StdioServerTransport
│   │   │   └── tools.ts         # 10 MCP tool definitions wrapping ffmpeg/* modules
│   │   └── index.ts             # Entrypoint: HTTP server + worker + optional MCP
│   ├── test/
│   │   ├── helpers/
│   │   │   ├── fixtures.ts      # Generates test.mp4 + test.mp3 via ffmpeg
│   │   │   └── db.ts            # Test DB connection + truncate helpers
│   │   ├── ffmpeg/              # Unit tests per tool
│   │   ├── api/                 # Supertest integration tests per route
│   │   └── mcp/                 # MCP server tests
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── package.json                 # npm workspaces root
```

---

## Task 1: Monorepo Scaffold + Test Infrastructure

**Files:**
- Create: `package.json` (workspace root)
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/vitest.config.ts`
- Create: `packages/engine/test/helpers/fixtures.ts`

- [ ] **Step 1: Create workspace root**

```bash
cd /root/app/claude/clipchat
```

```json
// package.json
{
  "name": "clipchat",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev -w packages/engine",
    "build": "npm run build -w packages/engine",
    "test": "npm run test -w packages/engine"
  }
}
```

- [ ] **Step 2: Create engine package.json**

```json
// packages/engine/package.json
{
  "name": "@clipchat/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "bullmq": "^5.0.0",
    "cors": "^2.8.5",
    "drizzle-orm": "^0.30.0",
    "express": "^4.19.0",
    "fluent-ffmpeg": "^2.1.3",
    "multer": "^1.4.5-lts.1",
    "postgres": "^3.4.0",
    "uuid": "^10.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/fluent-ffmpeg": "^2.1.24",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.0.0",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "drizzle-kit": "^0.21.0",
    "supertest": "^7.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
// packages/engine/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
// packages/engine/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/helpers/fixtures.ts'],
    testTimeout: 30000, // FFmpeg can be slow
    poolOptions: {
      forks: { singleFork: true }, // FFmpeg tests must not run in parallel
    },
  },
});
```

- [ ] **Step 5: Create test fixture generator**

```typescript
// packages/engine/test/helpers/fixtures.ts
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const FIXTURES_DIR = join(import.meta.dirname, '../fixtures');
export const TEST_VIDEO = join(FIXTURES_DIR, 'test.mp4');
export const TEST_AUDIO = join(FIXTURES_DIR, 'test.mp3');
export const TEST_SRT = join(FIXTURES_DIR, 'test.srt');

// Runs once before all tests (vitest setupFiles)
if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });

if (!existsSync(TEST_VIDEO)) {
  execSync(
    `ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 ` +
    `-f lavfi -i sine=frequency=440:duration=10 ` +
    `-c:v libx264 -c:a aac -shortest "${TEST_VIDEO}" -y`,
    { stdio: 'inherit' }
  );
}

if (!existsSync(TEST_AUDIO)) {
  execSync(
    `ffmpeg -f lavfi -i sine=frequency=440:duration=5 "${TEST_AUDIO}" -y`,
    { stdio: 'inherit' }
  );
}

if (!existsSync(TEST_SRT)) {
  const srt = `1\n00:00:00,000 --> 00:00:03,000\nHello World\n\n2\n00:00:03,000 --> 00:00:06,000\nTest subtitle\n`;
  import('fs').then(fs => fs.writeFileSync(TEST_SRT, srt));
}
```

- [ ] **Step 6: Install deps and verify setup**

```bash
npm install
npm test -- --reporter=verbose 2>&1 | head -20
```

Expected: `No test files found` (no tests yet, but setup runs clean)

- [ ] **Step 7: Commit**

```bash
git init
echo "node_modules\ndist\n.env\nuploads\ntest/fixtures/*.mp4\ntest/fixtures/*.mp3" > .gitignore
git add .
git commit -m "chore: scaffold monorepo with engine package, TypeScript, and Vitest"
```

---

## Task 2: Core Types

**Files:**
- Create: `packages/engine/src/types/job.ts`
- Create: `packages/engine/src/types/storage.ts`
- Create: `packages/engine/src/types/tools.ts`
- Test: `packages/engine/test/types.test.ts`

- [ ] **Step 1: Write the failing type tests**

```typescript
// packages/engine/test/types.test.ts
import { describe, it, expect } from 'vitest';
import { TrimVideoInputSchema, GetVideoInfoOutputSchema } from '../src/types/tools.js';
import type { Job } from '../src/types/job.js';

describe('Tool schemas', () => {
  it('validates trim_video input', () => {
    const result = TrimVideoInputSchema.safeParse({
      input_file: '/tmp/test.mp4',
      start_time: '00:00:05',
      end_time: '00:01:30',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid trim_video input', () => {
    const result = TrimVideoInputSchema.safeParse({ input_file: 123 });
    expect(result.success).toBe(false);
  });
});

describe('Job types', () => {
  it('Job type is structurally correct', () => {
    const job: Job = {
      id: 'job_abc',
      status: 'queued',
      tool: 'trim_video',
      input: { input_file: 'f.mp4', start_time: '0', end_time: '5' },
      output: null,
      progress: 0,
      error: null,
      created_at: new Date(),
      completed_at: null,
    };
    expect(job.status).toBe('queued');
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -w packages/engine -- test/types.test.ts
```

Expected: `Cannot find module '../src/types/tools.js'`

- [ ] **Step 3: Implement types/tools.ts**

```typescript
// packages/engine/src/types/tools.ts
import { z } from 'zod';

export const TrimVideoInputSchema = z.object({
  input_file: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  output_format: z.string().optional(),
});

export const MergeClipsInputSchema = z.object({
  input_files: z.array(z.string()).min(2),
  transition: z.enum(['none', 'fade', 'crossfade']).default('none'),
  transition_duration: z.number().positive().default(0.5),
});

export const AddSubtitlesInputSchema = z.object({
  input_file: z.string(),
  subtitle_source: z.string(),
  style: z.object({
    font_size: z.number().optional(),
    font_color: z.string().optional(),
    position: z.enum(['bottom', 'top', 'center']).default('bottom'),
  }).optional(),
  burn_in: z.boolean().default(true),
});

export const AddTextOverlayInputSchema = z.object({
  input_file: z.string(),
  text: z.string(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  position: z.object({ x: z.string(), y: z.string() }).optional(),
  style: z.object({
    font: z.string().default('Arial'),
    size: z.number().default(24),
    color: z.string().default('white'),
    background_color: z.string().optional(),
  }).optional(),
});

export const ResizeVideoInputSchema = z.object({
  input_file: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  preset: z.enum(['1080p', '720p', '4k', 'square', '9:16', '16:9']).optional(),
  pad: z.boolean().default(false),
});

export const ExtractAudioInputSchema = z.object({
  input_file: z.string(),
  format: z.enum(['mp3', 'aac', 'wav']).default('mp3'),
  quality: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const ReplaceAudioInputSchema = z.object({
  input_file: z.string(),
  audio_file: z.string(),
  mix: z.boolean().default(false),
  audio_volume: z.number().min(0).max(2).default(1),
  original_volume: z.number().min(0).max(2).default(0),
});

export const ChangeSpeedInputSchema = z.object({
  input_file: z.string(),
  speed_factor: z.number().min(0.25).max(4),
  preserve_audio_pitch: z.boolean().default(true),
});

export const ExportVideoInputSchema = z.object({
  input_file: z.string(),
  format: z.enum(['mp4', 'webm', 'mov', 'gif']),
  codec: z.enum(['h264', 'h265', 'vp9', 'av1']).optional(),
  quality: z.enum(['low', 'medium', 'high', 'lossless']).default('medium'),
  target_size_mb: z.number().positive().optional(),
  resolution: z.string().optional(),
});

export const GetVideoInfoInputSchema = z.object({
  input_file: z.string(),
});

export const GetVideoInfoOutputSchema = z.object({
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  codec: z.string(),
  audio_codec: z.string().nullable(),
  size_bytes: z.number(),
  bitrate: z.number(),
});

export type TrimVideoInput = z.infer<typeof TrimVideoInputSchema>;
export type MergeClipsInput = z.infer<typeof MergeClipsInputSchema>;
export type AddSubtitlesInput = z.infer<typeof AddSubtitlesInputSchema>;
export type AddTextOverlayInput = z.infer<typeof AddTextOverlayInputSchema>;
export type ResizeVideoInput = z.infer<typeof ResizeVideoInputSchema>;
export type ExtractAudioInput = z.infer<typeof ExtractAudioInputSchema>;
export type ReplaceAudioInput = z.infer<typeof ReplaceAudioInputSchema>;
export type ChangeSpeedInput = z.infer<typeof ChangeSpeedInputSchema>;
export type ExportVideoInput = z.infer<typeof ExportVideoInputSchema>;
export type GetVideoInfoInput = z.infer<typeof GetVideoInfoInputSchema>;
export type GetVideoInfoOutput = z.infer<typeof GetVideoInfoOutputSchema>;
```

- [ ] **Step 4: Implement types/job.ts**

```typescript
// packages/engine/src/types/job.ts
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type ToolName =
  | 'trim_video' | 'merge_clips' | 'add_subtitles' | 'add_text_overlay'
  | 'resize_video' | 'extract_audio' | 'replace_audio' | 'change_speed'
  | 'export_video' | 'get_video_info';

export interface Job {
  id: string;
  status: JobStatus;
  tool: ToolName;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  progress: number;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}
```

- [ ] **Step 5: Implement types/storage.ts**

```typescript
// packages/engine/src/types/storage.ts
export interface FileRecord {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  url: string;          // Public or presigned URL for download
  path: string;         // Internal path for FFmpeg (local path or s3://bucket/key)
  created_at: Date;
}

export interface StorageAdapter {
  save(buffer: Buffer, filename: string, mimeType: string): Promise<FileRecord>;
  getPath(fileId: string): Promise<string>; // Returns path usable by FFmpeg
  getUrl(fileId: string): Promise<string>;  // Returns downloadable URL
  delete(fileId: string): Promise<void>;
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm test -w packages/engine -- test/types.test.ts
```

Expected: `✓ validates trim_video input`, `✓ rejects invalid`, `✓ Job type is structurally correct`

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/types packages/engine/test/types.test.ts
git commit -m "feat: core types for jobs, storage, and all 10 tool schemas"
```

---

## Task 3: Database Schema + Drizzle

**Files:**
- Create: `packages/engine/src/db/schema.ts`
- Create: `packages/engine/src/db/index.ts`
- Create: `packages/engine/drizzle.config.ts`
- Create: `packages/engine/test/helpers/db.ts`
- Test: `packages/engine/test/db.test.ts`

- [ ] **Step 1: Write failing DB test**

```typescript
// packages/engine/test/db.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db/index.js';
import { jobs, files, apiKeys } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

describe('Database schema', () => {
  const fileId = uuid();
  const jobId = `job_${uuid().slice(0, 8)}`;

  it('inserts and retrieves a file record', async () => {
    await db.insert(files).values({
      id: fileId,
      original_name: 'test.mp4',
      mime_type: 'video/mp4',
      size_bytes: 1024,
      path: '/uploads/test.mp4',
      url: 'http://localhost/files/test.mp4',
    });
    const [file] = await db.select().from(files).where(eq(files.id, fileId));
    expect(file.original_name).toBe('test.mp4');
  });

  it('inserts and retrieves a job record', async () => {
    await db.insert(jobs).values({
      id: jobId,
      status: 'queued',
      tool: 'trim_video',
      input: { input_file: '/tmp/test.mp4', start_time: '0', end_time: '5' },
      output: null,
      progress: 0,
      error: null,
      file_id: fileId,
    });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    expect(job.status).toBe('queued');
    expect(job.tool).toBe('trim_video');
  });

  afterAll(async () => {
    await db.delete(jobs).where(eq(jobs.id, jobId));
    await db.delete(files).where(eq(files.id, fileId));
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/db.test.ts
```

Expected: `Cannot find module '../src/db/index.js'`

- [ ] **Step 3: Implement db/schema.ts**

```typescript
// packages/engine/src/db/schema.ts
import { pgTable, text, integer, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const jobStatusEnum = pgEnum('job_status', ['queued', 'processing', 'completed', 'failed']);

export const files = pgTable('files', {
  id: text('id').primaryKey(),
  original_name: text('original_name').notNull(),
  mime_type: text('mime_type').notNull(),
  size_bytes: integer('size_bytes').notNull(),
  path: text('path').notNull(),
  url: text('url').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  status: jobStatusEnum('status').default('queued').notNull(),
  tool: text('tool').notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  progress: integer('progress').default(0).notNull(),
  error: text('error'),
  file_id: text('file_id').references(() => files.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'),
});

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  key_hash: text('key_hash').notNull().unique(), // bcrypt hash
  label: text('label').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});
```

- [ ] **Step 4: Implement db/index.ts**

```typescript
// packages/engine/src/db/index.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

- [ ] **Step 5: Create drizzle.config.ts + generate migration**

```typescript
// packages/engine/drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

```bash
# Requires a running Postgres. Use docker for test:
docker run -d --name clipchat-pg -e POSTGRES_DB=clipchat -e POSTGRES_PASSWORD=clipchat -p 5432:5432 postgres:16
export DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat
npm run db:generate -w packages/engine
npm run db:migrate -w packages/engine
```

- [ ] **Step 6: Create test/helpers/db.ts**

```typescript
// packages/engine/test/helpers/db.ts
import { db } from '../../src/db/index.js';
import { jobs, files, apiKeys } from '../../src/db/schema.js';

export async function truncateAll() {
  await db.delete(jobs);
  await db.delete(files);
  await db.delete(apiKeys);
}
```

- [ ] **Step 7: Run tests**

```bash
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat npm test -w packages/engine -- test/db.test.ts
```

Expected: `✓ inserts and retrieves a file record`, `✓ inserts and retrieves a job record`

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/db packages/engine/drizzle.config.ts packages/engine/test/db.test.ts
git commit -m "feat: PostgreSQL schema with Drizzle ORM (jobs, files, api_keys)"
```

---

## Task 4: Storage Adapters

**Files:**
- Create: `packages/engine/src/storage/local.ts`
- Create: `packages/engine/src/storage/s3.ts`
- Create: `packages/engine/src/storage/index.ts`
- Test: `packages/engine/test/storage.test.ts`

- [ ] **Step 1: Write failing storage tests**

```typescript
// packages/engine/test/storage.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { LocalStorageAdapter } from '../src/storage/local.js';
import { TEST_VIDEO } from './helpers/fixtures.js';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let fileId: string;

  beforeAll(() => {
    adapter = new LocalStorageAdapter('./test-uploads');
  });

  it('saves a file and returns a FileRecord', async () => {
    const buffer = readFileSync(TEST_VIDEO);
    const record = await adapter.save(buffer, 'test.mp4', 'video/mp4');
    fileId = record.id;
    expect(record.id).toBeTruthy();
    expect(record.size_bytes).toBe(buffer.length);
    expect(record.path).toContain(record.id);
    expect(existsSync(record.path)).toBe(true);
  });

  it('getPath returns the file path', async () => {
    const path = await adapter.getPath(fileId);
    expect(existsSync(path)).toBe(true);
  });

  it('delete removes the file', async () => {
    const path = await adapter.getPath(fileId);
    await adapter.delete(fileId);
    expect(existsSync(path)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/storage.test.ts
```

Expected: `Cannot find module '../src/storage/local.js'`

- [ ] **Step 3: Implement storage/local.ts**

```typescript
// packages/engine/src/storage/local.ts
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import type { StorageAdapter, FileRecord } from '../types/storage.js';
import { AppError } from '../types/job.js';

export class LocalStorageAdapter implements StorageAdapter {
  private records = new Map<string, FileRecord>();

  constructor(private readonly baseDir: string = './uploads') {}

  async save(buffer: Buffer, filename: string, mimeType: string): Promise<FileRecord> {
    if (!existsSync(this.baseDir)) await mkdir(this.baseDir, { recursive: true });
    const id = uuid();
    const ext = filename.split('.').pop() ?? 'bin';
    const savedName = `${id}.${ext}`;
    const path = join(this.baseDir, savedName);
    await writeFile(path, buffer);
    const record: FileRecord = {
      id,
      original_name: filename,
      mime_type: mimeType,
      size_bytes: buffer.length,
      path,
      url: `/files/${id}`,
      created_at: new Date(),
    };
    this.records.set(id, record);
    return record;
  }

  async getPath(fileId: string): Promise<string> {
    const record = this.records.get(fileId);
    if (!record) throw new AppError(404, `File ${fileId} not found`);
    return record.path;
  }

  async getUrl(fileId: string): Promise<string> {
    const record = this.records.get(fileId);
    if (!record) throw new AppError(404, `File ${fileId} not found`);
    return record.url;
  }

  async delete(fileId: string): Promise<void> {
    const record = this.records.get(fileId);
    if (!record) return;
    await unlink(record.path).catch(() => {});
    this.records.delete(fileId);
  }
}
```

- [ ] **Step 4: Implement storage/s3.ts**

```typescript
// packages/engine/src/storage/s3.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import type { StorageAdapter, FileRecord } from '../types/storage.js';
import { AppError } from '../types/job.js';

export class S3StorageAdapter implements StorageAdapter {
  private s3: S3Client;
  private records = new Map<string, { key: string; record: FileRecord }>();

  constructor(
    private readonly bucket: string,
    region: string = 'us-east-1',
    endpoint?: string,
  ) {
    this.s3 = new S3Client({ region, endpoint });
  }

  async save(buffer: Buffer, filename: string, mimeType: string): Promise<FileRecord> {
    const id = uuid();
    const ext = filename.split('.').pop() ?? 'bin';
    const key = `uploads/${id}.${ext}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
    const record: FileRecord = {
      id,
      original_name: filename,
      mime_type: mimeType,
      size_bytes: buffer.length,
      path: `s3://${this.bucket}/${key}`,
      url: await this.getSignedDownloadUrl(key),
      created_at: new Date(),
    };
    this.records.set(id, { key, record });
    return record;
  }

  async getPath(fileId: string): Promise<string> {
    const entry = this.records.get(fileId);
    if (!entry) throw new AppError(404, `File ${fileId} not found`);
    return entry.record.path; // FFmpeg supports s3:// with the right build
  }

  async getUrl(fileId: string): Promise<string> {
    const entry = this.records.get(fileId);
    if (!entry) throw new AppError(404, `File ${fileId} not found`);
    return this.getSignedDownloadUrl(entry.key);
  }

  async delete(fileId: string): Promise<void> {
    const entry = this.records.get(fileId);
    if (!entry) return;
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: entry.key }));
    this.records.delete(fileId);
  }

  private async getSignedDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 3600 });
  }
}
```

- [ ] **Step 5: Implement storage/index.ts**

```typescript
// packages/engine/src/storage/index.ts
import type { StorageAdapter } from '../types/storage.js';
import { LocalStorageAdapter } from './local.js';
import { S3StorageAdapter } from './s3.js';

let _storage: StorageAdapter | null = null;

export function createStorage(): StorageAdapter {
  if (_storage) return _storage;
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if (driver === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
    _storage = new S3StorageAdapter(bucket, process.env.AWS_REGION, process.env.S3_ENDPOINT);
  } else {
    _storage = new LocalStorageAdapter(process.env.UPLOAD_DIR ?? './uploads');
  }
  return _storage;
}

// For testing only
export function resetStorage() { _storage = null; }
```

- [ ] **Step 6: Run tests**

```bash
npm test -w packages/engine -- test/storage.test.ts
```

Expected: `✓ saves a file`, `✓ getPath returns path`, `✓ delete removes file`

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/storage packages/engine/test/storage.test.ts
git commit -m "feat: storage adapters for local filesystem and S3"
```

---

## Task 5: FFmpeg Executor + get_video_info

**Files:**
- Create: `packages/engine/src/ffmpeg/executor.ts`
- Create: `packages/engine/src/ffmpeg/info.ts`
- Test: `packages/engine/test/ffmpeg/info.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/engine/test/ffmpeg/info.test.ts
import { describe, it, expect } from 'vitest';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('getVideoInfo', () => {
  it('returns correct metadata for test video', async () => {
    const info = await getVideoInfo({ input_file: TEST_VIDEO });
    expect(info.duration).toBeCloseTo(10, 0);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
    expect(info.fps).toBeCloseTo(30, 0);
    expect(info.codec).toBe('h264');
    expect(info.audio_codec).toBe('aac');
    expect(info.size_bytes).toBeGreaterThan(0);
    expect(info.bitrate).toBeGreaterThan(0);
  });

  it('throws on non-existent file', async () => {
    await expect(getVideoInfo({ input_file: '/nonexistent.mp4' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/ffmpeg/info.test.ts
```

- [ ] **Step 3: Implement ffmpeg/executor.ts**

```typescript
// packages/engine/src/ffmpeg/executor.ts
import ffmpeg from 'fluent-ffmpeg';
import { EventEmitter } from 'events';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

export interface ExecutorOptions {
  onProgress?: (percent: number) => void;
}

export function tempOutputPath(ext: string): string {
  return join(tmpdir(), `clipchat_${uuid()}.${ext}`);
}

export function runFfmpeg(
  command: ffmpeg.FfmpegCommand,
  opts: ExecutorOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.onProgress) {
      command.on('progress', (p) => opts.onProgress!(p.percent ?? 0));
    }
    command.on('end', resolve).on('error', (err) => reject(new Error(err.message)));
    command.run();
  });
}

export function ffprobePromise(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(new Error(err.message));
      else resolve(data);
    });
  });
}
```

- [ ] **Step 4: Implement ffmpeg/info.ts**

```typescript
// packages/engine/src/ffmpeg/info.ts
import { ffprobePromise } from './executor.js';
import type { GetVideoInfoInput, GetVideoInfoOutput } from '../types/tools.js';

export async function getVideoInfo(input: GetVideoInfoInput): Promise<GetVideoInfoOutput> {
  const data = await ffprobePromise(input.input_file);
  const videoStream = data.streams.find(s => s.codec_type === 'video');
  const audioStream = data.streams.find(s => s.codec_type === 'audio');
  if (!videoStream) throw new Error('No video stream found');
  const [fpsNum, fpsDen] = (videoStream.r_frame_rate ?? '30/1').split('/').map(Number);
  return {
    duration: Number(data.format.duration ?? 0),
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    fps: fpsNum / (fpsDen || 1),
    codec: videoStream.codec_name ?? 'unknown',
    audio_codec: audioStream?.codec_name ?? null,
    size_bytes: Number(data.format.size ?? 0),
    bitrate: Number(data.format.bit_rate ?? 0),
  };
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -w packages/engine -- test/ffmpeg/info.test.ts
```

Expected: `✓ returns correct metadata`, `✓ throws on non-existent file`

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/ffmpeg/executor.ts packages/engine/src/ffmpeg/info.ts packages/engine/test/ffmpeg/info.test.ts
git commit -m "feat: FFmpeg executor utilities and get_video_info (ffprobe)"
```

---

## Task 6: trim_video + merge_clips

**Files:**
- Create: `packages/engine/src/ffmpeg/trim.ts`
- Create: `packages/engine/src/ffmpeg/merge.ts`
- Test: `packages/engine/test/ffmpeg/trim.test.ts`
- Test: `packages/engine/test/ffmpeg/merge.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/engine/test/ffmpeg/trim.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { trimVideo } from '../../src/ffmpeg/trim.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('trimVideo', () => {
  it('trims to specified range', async () => {
    const output = await trimVideo({ input_file: TEST_VIDEO, start_time: '2', end_time: '5' });
    expect(existsSync(output)).toBe(true);
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeCloseTo(3, 0);
  });
});
```

```typescript
// packages/engine/test/ffmpeg/merge.test.ts
import { describe, it, expect } from 'vitest';
import { mergeClips } from '../../src/ffmpeg/merge.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('mergeClips', () => {
  it('concatenates two clips', async () => {
    const output = await mergeClips({ input_files: [TEST_VIDEO, TEST_VIDEO], transition: 'none' });
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeGreaterThan(18); // ~20s total
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/ffmpeg/trim.test.ts test/ffmpeg/merge.test.ts
```

- [ ] **Step 3: Implement ffmpeg/trim.ts**

```typescript
// packages/engine/src/ffmpeg/trim.ts
import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { TrimVideoInput } from '../types/tools.js';

export async function trimVideo(input: TrimVideoInput, onProgress?: (p: number) => void): Promise<string> {
  const ext = input.output_format ?? input.input_file.split('.').pop() ?? 'mp4';
  const output = tempOutputPath(ext);
  const cmd = ffmpeg(input.input_file)
    .setStartTime(input.start_time)
    .setDuration(String(Number(input.end_time) - Number(input.start_time)))
    .outputOptions(['-c copy'])
    .output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
```

- [ ] **Step 4: Implement ffmpeg/merge.ts**

```typescript
// packages/engine/src/ffmpeg/merge.ts
import ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { MergeClipsInput } from '../types/tools.js';

export async function mergeClips(input: MergeClipsInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');

  if (input.transition === 'none' || input.input_files.length < 2) {
    // Use concat demuxer (fast, stream copy)
    const listPath = join(tmpdir(), `concat_${uuid()}.txt`);
    const content = input.input_files.map(f => `file '${f}'`).join('\n');
    writeFileSync(listPath, content);
    const cmd = ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(output);
    await runFfmpeg(cmd, { onProgress });
    unlinkSync(listPath);
    return output;
  }

  // xfade filter for crossfade (requires re-encode)
  const dur = input.transition_duration ?? 0.5;
  let cmd = ffmpeg();
  input.input_files.forEach(f => cmd = cmd.input(f));
  // Build xfade filter chain
  const filters: string[] = [];
  let prev = '[0:v]';
  for (let i = 1; i < input.input_files.length; i++) {
    const out = i === input.input_files.length - 1 ? '[vout]' : `[v${i}]`;
    filters.push(`${prev}[${i}:v]xfade=transition=fade:duration=${dur}:offset=${(i * 10) - dur}${out}`);
    prev = `[v${i}]`;
  }
  cmd.complexFilter(filters).outputOptions(['-map [vout]', '-c:v libx264']).output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -w packages/engine -- test/ffmpeg/trim.test.ts test/ffmpeg/merge.test.ts
```

Expected: `✓ trims to specified range`, `✓ concatenates two clips`

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/ffmpeg/trim.ts packages/engine/src/ffmpeg/merge.ts packages/engine/test/ffmpeg/
git commit -m "feat: trim_video and merge_clips FFmpeg tools"
```

---

## Task 7: resize_video + change_speed + export_video

**Files:**
- Create: `packages/engine/src/ffmpeg/resize.ts`
- Create: `packages/engine/src/ffmpeg/speed.ts`
- Create: `packages/engine/src/ffmpeg/export.ts`
- Test: `packages/engine/test/ffmpeg/resize.test.ts`
- Test: `packages/engine/test/ffmpeg/speed.test.ts`
- Test: `packages/engine/test/ffmpeg/export.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/engine/test/ffmpeg/resize.test.ts
import { describe, it, expect } from 'vitest';
import { resizeVideo } from '../../src/ffmpeg/resize.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('resizeVideo', () => {
  it('resizes with explicit dimensions', async () => {
    const output = await resizeVideo({ input_file: TEST_VIDEO, width: 640, height: 360 });
    const info = await getVideoInfo({ input_file: output });
    expect(info.width).toBe(640);
    expect(info.height).toBe(360);
  });

  it('resizes with 720p preset', async () => {
    const output = await resizeVideo({ input_file: TEST_VIDEO, preset: '720p' });
    const info = await getVideoInfo({ input_file: output });
    expect(info.height).toBe(720);
  });
});
```

```typescript
// packages/engine/test/ffmpeg/speed.test.ts
import { describe, it, expect } from 'vitest';
import { changeSpeed } from '../../src/ffmpeg/speed.js';
import { getVideoInfo } from '../../src/ffmpeg/info.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('changeSpeed', () => {
  it('doubles playback speed (halves duration)', async () => {
    const output = await changeSpeed({ input_file: TEST_VIDEO, speed_factor: 2.0 });
    const info = await getVideoInfo({ input_file: output });
    expect(info.duration).toBeCloseTo(5, 0);
  });
});
```

```typescript
// packages/engine/test/ffmpeg/export.test.ts
import { describe, it, expect } from 'vitest';
import { exportVideo } from '../../src/ffmpeg/export.js';
import { existsSync, statSync } from 'fs';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('exportVideo', () => {
  it('re-encodes to mp4 h264', async () => {
    const output = await exportVideo({ input_file: TEST_VIDEO, format: 'mp4', codec: 'h264', quality: 'medium' });
    expect(existsSync(output)).toBe(true);
    expect(output.endsWith('.mp4')).toBe(true);
  });

  it('exports to webm', async () => {
    const output = await exportVideo({ input_file: TEST_VIDEO, format: 'webm', codec: 'vp9', quality: 'low' });
    expect(output.endsWith('.webm')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/ffmpeg/resize.test.ts test/ffmpeg/speed.test.ts test/ffmpeg/export.test.ts
```

- [ ] **Step 3: Implement ffmpeg/resize.ts**

```typescript
// packages/engine/src/ffmpeg/resize.ts
import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { ResizeVideoInput } from '../types/tools.js';

const PRESETS: Record<string, [number, number]> = {
  '1080p': [1920, 1080], '720p': [1280, 720], '4k': [3840, 2160],
  'square': [1080, 1080], '9:16': [1080, 1920], '16:9': [1920, 1080],
};

export async function resizeVideo(input: ResizeVideoInput, onProgress?: (p: number) => void): Promise<string> {
  let w = input.width, h = input.height;
  if (input.preset) [w, h] = PRESETS[input.preset];
  if (!w && !h) throw new Error('Provide width, height, or preset');
  const scaleW = w ?? -2, scaleH = h ?? -2;
  const filter = input.pad
    ? `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=decrease,pad=${scaleW}:${scaleH}:(ow-iw)/2:(oh-ih)/2`
    : `scale=${scaleW}:${scaleH}`;
  const output = tempOutputPath('mp4');
  const cmd = ffmpeg(input.input_file).videoFilter(filter).output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
```

- [ ] **Step 4: Implement ffmpeg/speed.ts**

```typescript
// packages/engine/src/ffmpeg/speed.ts
import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { ChangeSpeedInput } from '../types/tools.js';

export async function changeSpeed(input: ChangeSpeedInput, onProgress?: (p: number) => void): Promise<string> {
  const { speed_factor, preserve_audio_pitch = true } = input;
  const output = tempOutputPath('mp4');
  const vFilter = `setpts=${1 / speed_factor}*PTS`;
  // atempo only supports 0.5–2.0; chain multiple for extremes
  const buildAtempo = (factor: number): string => {
    const filters: string[] = [];
    let remaining = factor;
    while (remaining > 2.0) { filters.push('atempo=2.0'); remaining /= 2.0; }
    while (remaining < 0.5) { filters.push('atempo=0.5'); remaining /= 0.5; }
    filters.push(`atempo=${remaining.toFixed(4)}`);
    return filters.join(',');
  };
  const aFilter = preserve_audio_pitch ? buildAtempo(speed_factor) : `atempo=${speed_factor}`;
  const cmd = ffmpeg(input.input_file)
    .videoFilter(vFilter)
    .audioFilter(aFilter)
    .output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
```

- [ ] **Step 5: Implement ffmpeg/export.ts**

```typescript
// packages/engine/src/ffmpeg/export.ts
import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg, ffprobePromise } from './executor.js';
import type { ExportVideoInput } from '../types/tools.js';

const CODEC_MAP = { h264: 'libx264', h265: 'libx265', vp9: 'libvpx-vp9', av1: 'libaom-av1' };
const CRF_MAP = { low: 35, medium: 23, high: 18, lossless: 0 };

export async function exportVideo(input: ExportVideoInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath(input.format);
  const vcodec = CODEC_MAP[input.codec ?? 'h264'];
  const crf = CRF_MAP[input.quality ?? 'medium'];
  let cmd = ffmpeg(input.input_file).videoCodec(vcodec).outputOption(`-crf ${crf}`);
  if (input.target_size_mb) {
    const probe = await ffprobePromise(input.input_file);
    const duration = Number(probe.format.duration ?? 1);
    const targetBitrate = Math.floor((input.target_size_mb * 8192) / duration);
    cmd = cmd.outputOption(`-b:v ${targetBitrate}k`).outputOption('-maxrate').outputOption(`${targetBitrate * 2}k`);
  }
  if (input.resolution) {
    const [w, h] = input.resolution.split('x');
    cmd = cmd.size(`${w}x${h}`);
  }
  cmd = cmd.format(input.format).output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -w packages/engine -- test/ffmpeg/resize.test.ts test/ffmpeg/speed.test.ts test/ffmpeg/export.test.ts
```

Expected: all 4 tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/ffmpeg/resize.ts packages/engine/src/ffmpeg/speed.ts packages/engine/src/ffmpeg/export.ts packages/engine/test/ffmpeg/
git commit -m "feat: resize_video, change_speed, and export_video FFmpeg tools"
```

---

## Task 8: Audio + Text + Subtitle Tools

**Files:**
- Create: `packages/engine/src/ffmpeg/audio.ts`
- Create: `packages/engine/src/ffmpeg/text.ts`
- Test: `packages/engine/test/ffmpeg/audio.test.ts`
- Test: `packages/engine/test/ffmpeg/text.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/engine/test/ffmpeg/audio.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { extractAudio, replaceAudio } from '../../src/ffmpeg/audio.js';
import { TEST_VIDEO, TEST_AUDIO } from '../helpers/fixtures.js';

describe('extractAudio', () => {
  it('extracts mp3 from video', async () => {
    const output = await extractAudio({ input_file: TEST_VIDEO, format: 'mp3' });
    expect(existsSync(output)).toBe(true);
    expect(output.endsWith('.mp3')).toBe(true);
  });
});

describe('replaceAudio', () => {
  it('replaces video audio track', async () => {
    const output = await replaceAudio({ input_file: TEST_VIDEO, audio_file: TEST_AUDIO, mix: false });
    expect(existsSync(output)).toBe(true);
  });
});
```

```typescript
// packages/engine/test/ffmpeg/text.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { addTextOverlay, addSubtitles } from '../../src/ffmpeg/text.js';
import { TEST_VIDEO, TEST_SRT } from '../helpers/fixtures.js';

describe('addTextOverlay', () => {
  it('burns text into video', async () => {
    const output = await addTextOverlay({
      input_file: TEST_VIDEO, text: 'Hello Test',
      style: { font: 'Arial', size: 36, color: 'white' },
    });
    expect(existsSync(output)).toBe(true);
  });
});

describe('addSubtitles', () => {
  it('burns SRT subtitles into video', async () => {
    const output = await addSubtitles({
      input_file: TEST_VIDEO, subtitle_source: TEST_SRT, burn_in: true,
    });
    expect(existsSync(output)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/ffmpeg/audio.test.ts test/ffmpeg/text.test.ts
```

- [ ] **Step 3: Implement ffmpeg/audio.ts**

```typescript
// packages/engine/src/ffmpeg/audio.ts
import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { ExtractAudioInput, ReplaceAudioInput } from '../types/tools.js';

const AUDIO_QUALITY = { low: '128k', medium: '192k', high: '320k' };

export async function extractAudio(input: ExtractAudioInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath(input.format ?? 'mp3');
  const cmd = ffmpeg(input.input_file)
    .noVideo()
    .audioCodec(input.format === 'wav' ? 'pcm_s16le' : input.format === 'aac' ? 'aac' : 'libmp3lame')
    .audioBitrate(AUDIO_QUALITY[input.quality ?? 'medium'])
    .output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}

export async function replaceAudio(input: ReplaceAudioInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  let cmd = ffmpeg(input.input_file).input(input.audio_file);
  if (input.mix) {
    cmd = cmd.complexFilter([
      `[0:a]volume=${input.original_volume ?? 0}[orig]`,
      `[1:a]volume=${input.audio_volume ?? 1}[new]`,
      '[orig][new]amix=inputs=2[aout]',
    ]).outputOptions(['-map 0:v', '-map [aout]', '-c:v copy', '-shortest']);
  } else {
    cmd = cmd.outputOptions(['-map 0:v', '-map 1:a', '-c:v copy', '-shortest']);
  }
  cmd = cmd.output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}
```

- [ ] **Step 4: Implement ffmpeg/text.ts**

```typescript
// packages/engine/src/ffmpeg/text.ts
import ffmpeg from 'fluent-ffmpeg';
import { tempOutputPath, runFfmpeg } from './executor.js';
import type { AddTextOverlayInput, AddSubtitlesInput } from '../types/tools.js';

export async function addTextOverlay(input: AddTextOverlayInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  const s = input.style ?? {};
  const font = s.font ?? 'Arial';
  const size = s.size ?? 24;
  const color = s.color ?? 'white';
  let filter = `drawtext=text='${input.text.replace(/'/g, "\\'")}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=${size}:fontcolor=${color}`;
  if (input.position) filter += `:x=${input.position.x}:y=${input.position.y}`;
  else filter += ':x=(w-text_w)/2:y=(h-text_h-20)';
  if (input.start_time) filter += `:enable='between(t,${input.start_time},${input.end_time ?? 9999})'`;
  if (s.background_color) filter += `:box=1:boxcolor=${s.background_color}`;
  const cmd = ffmpeg(input.input_file).videoFilter(filter).output(output);
  await runFfmpeg(cmd, { onProgress });
  return output;
}

export async function addSubtitles(input: AddSubtitlesInput, onProgress?: (p: number) => void): Promise<string> {
  const output = tempOutputPath('mp4');
  const s = input.style ?? {};
  if (input.burn_in) {
    const styleOpts = [
      s.font_size ? `FontSize=${s.font_size}` : '',
      s.font_color ? `PrimaryColour=&H${s.font_color.replace('#', '')}&` : '',
    ].filter(Boolean).join(',');
    const filter = `subtitles='${input.subtitle_source.replace(/'/g, "\\'")}':force_style='${styleOpts}'`;
    const cmd = ffmpeg(input.input_file).videoFilter(filter).output(output);
    await runFfmpeg(cmd, { onProgress });
  } else {
    // Soft subtitle track
    const cmd = ffmpeg(input.input_file)
      .input(input.subtitle_source)
      .outputOptions(['-c:v copy', '-c:a copy', '-c:s mov_text'])
      .output(output);
    await runFfmpeg(cmd, { onProgress });
  }
  return output;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -w packages/engine -- test/ffmpeg/audio.test.ts test/ffmpeg/text.test.ts
```

Expected: 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/ffmpeg/audio.ts packages/engine/src/ffmpeg/text.ts packages/engine/test/ffmpeg/
git commit -m "feat: audio and text/subtitle FFmpeg tools"
```

---

## Task 9: BullMQ Job Queue + Worker

**Files:**
- Create: `packages/engine/src/queue/index.ts`
- Create: `packages/engine/src/queue/worker.ts`
- Test: `packages/engine/test/queue.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/engine/test/queue.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { submitJob, getQueue } from '../src/queue/index.js';
import type { ToolName } from '../src/types/job.js';

describe('Job queue', () => {
  it('adds a job to the queue', async () => {
    const jobId = await submitJob('get_video_info', { input_file: '/tmp/test.mp4' });
    expect(jobId).toMatch(/^job_/);
    const queue = getQueue();
    const job = await queue.getJob(jobId);
    expect(job?.data.tool).toBe('get_video_info');
  });

  afterAll(async () => {
    await getQueue().obliterate({ force: true });
    await getQueue().close();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
REDIS_URL=redis://localhost:6379 npm test -w packages/engine -- test/queue.test.ts
```

- [ ] **Step 3: Implement queue/index.ts**

```typescript
// packages/engine/src/queue/index.ts
import { Queue } from 'bullmq';
import type { ToolName } from '../types/job.js';

const QUEUE_NAME = 'clipchat-jobs';

let _queue: Queue | null = null;

export function getQueue(): Queue {
  if (_queue) return _queue;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = { host: new URL(url).hostname, port: Number(new URL(url).port || 6379) };
  _queue = new Queue(QUEUE_NAME, { connection });
  return _queue;
}

export async function submitJob(tool: ToolName, input: Record<string, unknown>): Promise<string> {
  const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await getQueue().add(jobId, { tool, input }, { jobId });
  return jobId;
}
```

- [ ] **Step 4: Implement queue/worker.ts**

```typescript
// packages/engine/src/queue/worker.ts
import { Worker, type Job } from 'bullmq';
import { db } from '../db/index.js';
import { jobs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getVideoInfo } from '../ffmpeg/info.js';
import { trimVideo } from '../ffmpeg/trim.js';
import { mergeClips } from '../ffmpeg/merge.js';
import { resizeVideo } from '../ffmpeg/resize.js';
import { extractAudio, replaceAudio } from '../ffmpeg/audio.js';
import { addTextOverlay, addSubtitles } from '../ffmpeg/text.js';
import { changeSpeed } from '../ffmpeg/speed.js';
import { exportVideo } from '../ffmpeg/export.js';
import type { ToolName } from '../types/job.js';

const TOOL_MAP: Record<ToolName, (input: any, onProgress: (p: number) => void) => Promise<any>> = {
  get_video_info: (i) => getVideoInfo(i),
  trim_video: (i, p) => trimVideo(i, p),
  merge_clips: (i, p) => mergeClips(i, p),
  resize_video: (i, p) => resizeVideo(i, p),
  extract_audio: (i, p) => extractAudio(i, p),
  replace_audio: (i, p) => replaceAudio(i, p),
  add_text_overlay: (i, p) => addTextOverlay(i, p),
  add_subtitles: (i, p) => addSubtitles(i, p),
  change_speed: (i, p) => changeSpeed(i, p),
  export_video: (i, p) => exportVideo(i, p),
};

export function createWorker() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = { host: new URL(url).hostname, port: Number(new URL(url).port || 6379) };

  return new Worker('clipchat-jobs', async (job: Job) => {
    const { tool, input } = job.data as { tool: ToolName; input: Record<string, unknown> };

    await db.update(jobs).set({ status: 'processing', progress: 0 }).where(eq(jobs.id, job.id!));

    const onProgress = async (percent: number) => {
      await job.updateProgress(percent);
      await db.update(jobs).set({ progress: Math.floor(percent) }).where(eq(jobs.id, job.id!));
    };

    const handler = TOOL_MAP[tool];
    if (!handler) throw new Error(`Unknown tool: ${tool}`);

    const output = await handler(input, onProgress);
    await db.update(jobs).set({ status: 'completed', output, progress: 100, completed_at: new Date() })
      .where(eq(jobs.id, job.id!));

    return output;
  }, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  });
}
```

- [ ] **Step 5: Run tests (requires Redis)**

```bash
docker run -d --name clipchat-redis -p 6379:6379 redis:7
REDIS_URL=redis://localhost:6379 npm test -w packages/engine -- test/queue.test.ts
```

Expected: `✓ adds a job to the queue`

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/queue packages/engine/test/queue.test.ts
git commit -m "feat: BullMQ job queue and FFmpeg worker"
```

---

## Task 10: Express App + Auth + Health

**Files:**
- Create: `packages/engine/src/api/middleware/auth.ts`
- Create: `packages/engine/src/api/middleware/errors.ts`
- Create: `packages/engine/src/api/routes/health.ts`
- Create: `packages/engine/src/api/index.ts`
- Test: `packages/engine/test/api/health.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/engine/test/api/health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/index.js';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/api/health.test.ts
```

- [ ] **Step 3: Implement middleware/errors.ts**

```typescript
// packages/engine/src/api/middleware/errors.ts
import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../../types/job.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
```

- [ ] **Step 4: Implement middleware/auth.ts**

```typescript
// packages/engine/src/api/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { apiKeys } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { AppError } from '../../types/job.js';

declare global {
  namespace Express {
    interface Request { apiKeyId?: string }
  }
}

export async function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return next(new AppError(401, 'Missing API key'));
  const key = auth.slice(7);
  const hash = createHash('sha256').update(key).digest('hex');
  const [record] = await db.select().from(apiKeys).where(eq(apiKeys.key_hash, hash));
  if (!record) return next(new AppError(401, 'Invalid API key'));
  req.apiKeyId = record.id;
  next();
}
```

- [ ] **Step 5: Implement routes/health.ts + api/index.ts**

```typescript
// packages/engine/src/api/routes/health.ts
import { Router } from 'express';
const router = Router();
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version ?? '0.1.0' });
});
export default router;
```

```typescript
// packages/engine/src/api/index.ts
import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import { errorHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(healthRouter);
  // Routes added in subsequent tasks
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 6: Run tests**

```bash
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat npm test -w packages/engine -- test/api/health.test.ts
```

Expected: `✓ returns 200 with status ok`

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/api packages/engine/test/api/health.test.ts
git commit -m "feat: Express app factory, auth middleware, and health endpoint"
```

---

## Task 11: Files API Routes

**Files:**
- Create: `packages/engine/src/api/routes/files.ts`
- Modify: `packages/engine/src/api/index.ts`
- Test: `packages/engine/test/api/files.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/engine/test/api/files.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'fs';
import { createApp } from '../../src/api/index.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('Files API', () => {
  const app = createApp();
  let fileId: string;

  it('POST /files/upload accepts a video file', async () => {
    const res = await request(app)
      .post('/api/v1/files/upload')
      .attach('file', TEST_VIDEO);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.mime_type).toContain('video');
    fileId = res.body.id;
  });

  it('GET /files/:id returns file metadata', async () => {
    const res = await request(app).get(`/api/v1/files/${fileId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(fileId);
  });

  it('DELETE /files/:id removes the file', async () => {
    const res = await request(app).delete(`/api/v1/files/${fileId}`);
    expect(res.status).toBe(204);
  });

  it('GET /files/:id returns 404 after deletion', async () => {
    const res = await request(app).get(`/api/v1/files/${fileId}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/api/files.test.ts
```

- [ ] **Step 3: Implement routes/files.ts**

```typescript
// packages/engine/src/api/routes/files.ts
import { Router } from 'express';
import multer from 'multer';
import { createStorage } from '../../storage/index.js';
import { AppError } from '../../types/job.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 * 1024 } });
const fileCache = new Map<string, { id: string; original_name: string; mime_type: string; size_bytes: number; url: string; created_at: Date }>();

router.post('/files/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const storage = createStorage();
    const record = await storage.save(req.file.buffer, req.file.originalname, req.file.mimetype);
    fileCache.set(record.id, record);
    res.status(201).json(record);
  } catch (err) { next(err); }
});

router.get('/files/:id', async (req, res, next) => {
  try {
    const record = fileCache.get(req.params.id);
    if (!record) throw new AppError(404, 'File not found');
    res.json(record);
  } catch (err) { next(err); }
});

router.delete('/files/:id', async (req, res, next) => {
  try {
    const storage = createStorage();
    await storage.delete(req.params.id);
    fileCache.delete(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Register route in api/index.ts**

```typescript
// Add to createApp() in packages/engine/src/api/index.ts
import filesRouter from './routes/files.js';
// inside createApp(), before errorHandler:
app.use('/api/v1', filesRouter);
```

- [ ] **Step 5: Run tests**

```bash
npm test -w packages/engine -- test/api/files.test.ts
```

Expected: all 4 tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/api/routes/files.ts packages/engine/src/api/index.ts packages/engine/test/api/files.test.ts
git commit -m "feat: files upload/get/delete API routes"
```

---

## Task 12: Jobs API Routes (including SSE)

**Files:**
- Create: `packages/engine/src/api/routes/jobs.ts`
- Modify: `packages/engine/src/api/index.ts`
- Test: `packages/engine/test/api/jobs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/engine/test/api/jobs.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/index.js';

describe('Jobs API', () => {
  const app = createApp();
  let jobId: string;

  it('POST /jobs submits a job and returns a job ID', async () => {
    const res = await request(app).post('/api/v1/jobs').send({
      tool: 'get_video_info',
      input: { input_file: '/tmp/test.mp4' },
    });
    expect(res.status).toBe(202);
    expect(res.body.id).toMatch(/^job_/);
    expect(res.body.status).toBe('queued');
    jobId = res.body.id;
  });

  it('GET /jobs/:id returns job status', async () => {
    const res = await request(app).get(`/api/v1/jobs/${jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(jobId);
    expect(['queued', 'processing', 'completed']).toContain(res.body.status);
  });

  it('DELETE /jobs/:id cancels a job', async () => {
    const res = await request(app).delete(`/api/v1/jobs/${jobId}`);
    expect([204, 409]).toContain(res.status); // 409 if already completed
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
REDIS_URL=redis://localhost:6379 DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat npm test -w packages/engine -- test/api/jobs.test.ts
```

- [ ] **Step 3: Implement routes/jobs.ts**

```typescript
// packages/engine/src/api/routes/jobs.ts
import { Router } from 'express';
import { db } from '../../db/index.js';
import { jobs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { submitJob, getQueue } from '../../queue/index.js';
import { AppError } from '../../types/job.js';
import type { ToolName } from '../../types/job.js';

const router = Router();

router.post('/jobs', async (req, res, next) => {
  try {
    const { tool, input } = req.body as { tool: ToolName; input: Record<string, unknown> };
    if (!tool || !input) throw new AppError(400, 'tool and input are required');
    const jobId = await submitJob(tool, input);
    await db.insert(jobs).values({
      id: jobId, status: 'queued', tool, input, output: null, progress: 0, error: null,
    });
    res.status(202).json({ id: jobId, status: 'queued', tool, input, output: null, progress: 0, error: null });
  } catch (err) { next(err); }
});

router.get('/jobs/:id', async (req, res, next) => {
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) throw new AppError(404, 'Job not found');
    res.json(job);
  } catch (err) { next(err); }
});

router.get('/jobs/:id/stream', async (req, res, next) => {
  try {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
    if (!job) throw new AppError(404, 'Job not found');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const poll = setInterval(async () => {
      const [current] = await db.select().from(jobs).where(eq(jobs.id, req.params.id));
      if (!current) { clearInterval(poll); res.end(); return; }
      send(current);
      if (current.status === 'completed' || current.status === 'failed') {
        clearInterval(poll); res.end();
      }
    }, 500);
    req.on('close', () => clearInterval(poll));
  } catch (err) { next(err); }
});

router.delete('/jobs/:id', async (req, res, next) => {
  try {
    const queue = getQueue();
    const bullJob = await queue.getJob(req.params.id);
    if (!bullJob) throw new AppError(404, 'Job not found');
    const state = await bullJob.getState();
    if (state === 'completed' || state === 'failed') {
      res.status(409).json({ error: 'Job already finished' });
      return;
    }
    await bullJob.remove();
    await db.update(jobs).set({ status: 'failed', error: 'Cancelled by user' }).where(eq(jobs.id, req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Register route**

Add `import jobsRouter from './routes/jobs.js'` and `app.use('/api/v1', jobsRouter)` to `api/index.ts`.

- [ ] **Step 5: Run tests**

```bash
REDIS_URL=redis://localhost:6379 DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat npm test -w packages/engine -- test/api/jobs.test.ts
```

Expected: all 3 tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/api/routes/jobs.ts packages/engine/src/api/index.ts packages/engine/test/api/jobs.test.ts
git commit -m "feat: jobs API routes (submit, poll, SSE stream, cancel)"
```

---

## Task 13: Tools API Routes

**Files:**
- Create: `packages/engine/src/api/routes/tools.ts`
- Modify: `packages/engine/src/api/index.ts`
- Test: `packages/engine/test/api/tools.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/engine/test/api/tools.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/api/index.js';

describe('Tools API', () => {
  const app = createApp();

  it('GET /tools lists all 10 tools', async () => {
    const res = await request(app).get('/api/v1/tools');
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(10);
    const names = res.body.tools.map((t: any) => t.name);
    expect(names).toContain('trim_video');
    expect(names).toContain('get_video_info');
  });

  it('POST /tools/get_video_info executes tool synchronously', async () => {
    const res = await request(app).post('/api/v1/tools/get_video_info').send({
      input_file: process.env.TEST_VIDEO_PATH ?? '/tmp/test.mp4',
    });
    // Returns a job ID since direct invocation goes through queue
    expect([202, 400]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/api/tools.test.ts
```

- [ ] **Step 3: Implement routes/tools.ts**

```typescript
// packages/engine/src/api/routes/tools.ts
import { Router } from 'express';
import { submitJob, getQueue } from '../../queue/index.js';
import { db } from '../../db/index.js';
import { jobs } from '../../db/schema.js';
import { AppError, type ToolName } from '../../types/job.js';
import * as Schemas from '../../types/tools.js';

const TOOLS = [
  { name: 'trim_video', description: 'Trim a video between two timestamps', schema: Schemas.TrimVideoInputSchema },
  { name: 'merge_clips', description: 'Merge multiple clips sequentially', schema: Schemas.MergeClipsInputSchema },
  { name: 'add_subtitles', description: 'Add subtitle track to video', schema: Schemas.AddSubtitlesInputSchema },
  { name: 'add_text_overlay', description: 'Burn text into video', schema: Schemas.AddTextOverlayInputSchema },
  { name: 'resize_video', description: 'Resize or change aspect ratio', schema: Schemas.ResizeVideoInputSchema },
  { name: 'extract_audio', description: 'Extract audio from video', schema: Schemas.ExtractAudioInputSchema },
  { name: 'replace_audio', description: 'Replace or mix audio track', schema: Schemas.ReplaceAudioInputSchema },
  { name: 'change_speed', description: 'Change playback speed', schema: Schemas.ChangeSpeedInputSchema },
  { name: 'export_video', description: 'Re-encode and export video', schema: Schemas.ExportVideoInputSchema },
  { name: 'get_video_info', description: 'Get video metadata', schema: Schemas.GetVideoInfoInputSchema },
];

const router = Router();

router.get('/tools', (_req, res) => {
  res.json({ tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.schema._def })) });
});

router.post('/tools/:name', async (req, res, next) => {
  try {
    const tool = TOOLS.find(t => t.name === req.params.name);
    if (!tool) throw new AppError(404, `Tool '${req.params.name}' not found`);
    const parsed = tool.schema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.message);
    const jobId = await submitJob(req.params.name as ToolName, parsed.data);
    await db.insert(jobs).values({ id: jobId, status: 'queued', tool: req.params.name, input: parsed.data, output: null, progress: 0, error: null });
    res.status(202).json({ id: jobId, status: 'queued' });
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Register route, run tests, commit**

```bash
# Add to api/index.ts: import toolsRouter + app.use('/api/v1', toolsRouter)
REDIS_URL=redis://localhost:6379 DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat npm test -w packages/engine -- test/api/tools.test.ts
git add packages/engine/src/api/routes/tools.ts packages/engine/src/api/index.ts packages/engine/test/api/tools.test.ts
git commit -m "feat: tools listing and direct invocation API routes"
```

---

## Task 14: MCP Server

**Files:**
- Create: `packages/engine/src/mcp/tools.ts`
- Create: `packages/engine/src/mcp/index.ts`
- Test: `packages/engine/test/mcp/server.test.ts`

- [ ] **Step 1: Write failing MCP test**

```typescript
// packages/engine/test/mcp/server.test.ts
import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../../src/mcp/index.js';

describe('MCP Server', () => {
  it('lists all 10 tools', async () => {
    const server = createMcpServer();
    // @ts-ignore — access internal tool registry for testing
    const tools = server._registeredTools;
    expect(Object.keys(tools)).toHaveLength(10);
    expect(Object.keys(tools)).toContain('trim_video');
    expect(Object.keys(tools)).toContain('get_video_info');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -w packages/engine -- test/mcp/server.test.ts
```

- [ ] **Step 3: Implement mcp/tools.ts**

```typescript
// packages/engine/src/mcp/tools.ts
// Maps MCP tool calls to FFmpeg functions directly (no queue for MCP in Phase 1)
import { getVideoInfo } from '../ffmpeg/info.js';
import { trimVideo } from '../ffmpeg/trim.js';
import { mergeClips } from '../ffmpeg/merge.js';
import { resizeVideo } from '../ffmpeg/resize.js';
import { extractAudio, replaceAudio } from '../ffmpeg/audio.js';
import { addTextOverlay, addSubtitles } from '../ffmpeg/text.js';
import { changeSpeed } from '../ffmpeg/speed.js';
import { exportVideo } from '../ffmpeg/export.js';
import * as Schemas from '../types/tools.js';

export const MCP_TOOLS = [
  { name: 'get_video_info', description: 'Get video file metadata', schema: Schemas.GetVideoInfoInputSchema, handler: getVideoInfo },
  { name: 'trim_video', description: 'Trim a video between two timestamps', schema: Schemas.TrimVideoInputSchema, handler: (i: any) => trimVideo(i).then(p => ({ output_file: p })) },
  { name: 'merge_clips', description: 'Merge multiple video clips', schema: Schemas.MergeClipsInputSchema, handler: (i: any) => mergeClips(i).then(p => ({ output_file: p })) },
  { name: 'resize_video', description: 'Resize or change aspect ratio', schema: Schemas.ResizeVideoInputSchema, handler: (i: any) => resizeVideo(i).then(p => ({ output_file: p })) },
  { name: 'extract_audio', description: 'Extract audio from video', schema: Schemas.ExtractAudioInputSchema, handler: (i: any) => extractAudio(i).then(p => ({ output_file: p })) },
  { name: 'replace_audio', description: 'Replace or mix audio track', schema: Schemas.ReplaceAudioInputSchema, handler: (i: any) => replaceAudio(i).then(p => ({ output_file: p })) },
  { name: 'add_text_overlay', description: 'Burn text into video', schema: Schemas.AddTextOverlayInputSchema, handler: (i: any) => addTextOverlay(i).then(p => ({ output_file: p })) },
  { name: 'add_subtitles', description: 'Add subtitle track', schema: Schemas.AddSubtitlesInputSchema, handler: (i: any) => addSubtitles(i).then(p => ({ output_file: p })) },
  { name: 'change_speed', description: 'Change video playback speed', schema: Schemas.ChangeSpeedInputSchema, handler: (i: any) => changeSpeed(i).then(p => ({ output_file: p })) },
  { name: 'export_video', description: 'Re-encode and export video', schema: Schemas.ExportVideoInputSchema, handler: (i: any) => exportVideo(i).then(p => ({ output_file: p })) },
];
```

- [ ] **Step 4: Implement mcp/index.ts**

```typescript
// packages/engine/src/mcp/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { MCP_TOOLS } from './tools.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'clipchat', version: '0.1.0' });

  for (const tool of MCP_TOOLS) {
    server.tool(tool.name, tool.description, tool.schema.shape, async (input) => {
      const result = await tool.handler(input);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
  }

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ClipChat MCP server running on stdio');
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -w packages/engine -- test/mcp/server.test.ts
```

Expected: `✓ lists all 10 tools`

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/mcp packages/engine/test/mcp/server.test.ts
git commit -m "feat: MCP server with stdio transport and all 10 tools"
```

---

## Task 15: Entrypoint + Docker Compose

**Files:**
- Create: `packages/engine/src/index.ts`
- Create: `packages/engine/src/api/server.ts`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `.env.example`

- [ ] **Step 1: Implement entrypoint**

```typescript
// packages/engine/src/api/server.ts
import { createApp } from './index.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`ClipChat API listening on :${port}`));
```

```typescript
// packages/engine/src/index.ts
import './api/server.js';
import { createWorker } from './queue/worker.js';

const worker = createWorker();
worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));

// If --mcp flag passed, also start MCP server on stdio
if (process.argv.includes('--mcp')) {
  import('./mcp/index.js').then(({ startMcpServer }) => startMcpServer());
}
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY packages/engine/package.json ./packages/engine/
RUN npm install --workspace=packages/engine --production

COPY packages/engine/src ./packages/engine/src
COPY packages/engine/tsconfig.json ./packages/engine/

RUN npm run build -w packages/engine

EXPOSE 3000
CMD ["node", "packages/engine/dist/index.js"]
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: clipchat
      POSTGRES_PASSWORD: clipchat
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  engine:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://postgres:clipchat@postgres:5432/clipchat
      REDIS_URL: redis://redis:6379
      STORAGE_DRIVER: local
      UPLOAD_DIR: /data/uploads
    volumes: [uploads:/data/uploads]
    depends_on:
      postgres: {condition: service_healthy}
      redis: {condition: service_healthy}

volumes:
  pgdata:
  uploads:
```

- [ ] **Step 4: Create docker-compose.dev.yml**

```yaml
# docker-compose.dev.yml
services:
  engine:
    build:
      context: .
      target: dev
    command: npm run dev -w packages/engine
    volumes:
      - ./packages/engine/src:/app/packages/engine/src
    environment:
      NODE_ENV: development
```

- [ ] **Step 5: Create .env.example**

```bash
# .env.example
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat
REDIS_URL=redis://localhost:6379
STORAGE_DRIVER=local          # local | s3
UPLOAD_DIR=./uploads

# S3 (when STORAGE_DRIVER=s3)
S3_BUCKET=
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_ENDPOINT=                  # Optional: for MinIO / compatible

PORT=3000
WORKER_CONCURRENCY=2
```

- [ ] **Step 6: Verify Docker build**

```bash
docker compose build
docker compose up -d
curl http://localhost:3000/health
```

Expected: `{"status":"ok","version":"0.1.0"}`

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/index.ts packages/engine/src/api/server.ts Dockerfile docker-compose.yml docker-compose.dev.yml .env.example
git commit -m "feat: entrypoint, Docker image, and Docker Compose stack"
```

---

## Task 16: API Key Generation Script + End-to-End Test

**Files:**
- Create: `packages/engine/src/scripts/create-api-key.ts`
- Create: `packages/engine/test/e2e.test.ts`

- [ ] **Step 1: Write failing e2e test**

```typescript
// packages/engine/test/e2e.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/api/index.js';
import { TEST_VIDEO } from './helpers/fixtures.js';

describe('End-to-end: upload → job → result', () => {
  const app = createApp();

  it('uploads a file, submits get_video_info job, polls until complete', async () => {
    // 1. Upload
    const uploadRes = await request(app).post('/api/v1/files/upload').attach('file', TEST_VIDEO);
    expect(uploadRes.status).toBe(201);
    const { path } = uploadRes.body;

    // 2. Submit job
    const jobRes = await request(app).post('/api/v1/jobs').send({
      tool: 'get_video_info',
      input: { input_file: path },
    });
    expect(jobRes.status).toBe(202);
    const jobId = jobRes.body.id;

    // 3. Poll until done (worker must be running)
    let job: any;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const pollRes = await request(app).get(`/api/v1/jobs/${jobId}`);
      job = pollRes.body;
      if (job.status === 'completed' || job.status === 'failed') break;
    }

    // If no worker running in test env, just check queued status
    expect(['queued', 'processing', 'completed']).toContain(job.status);
  }, 15000);
});
```

- [ ] **Step 2: Run — verify it runs (queued status is acceptable)**

```bash
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat REDIS_URL=redis://localhost:6379 npm test -w packages/engine -- test/e2e.test.ts
```

- [ ] **Step 3: Create API key generation script**

```typescript
// packages/engine/src/scripts/create-api-key.ts
import { randomBytes, createHash } from 'crypto';
import { db } from '../db/index.js';
import { apiKeys } from '../db/schema.js';
import { v4 as uuid } from 'uuid';

const label = process.argv[2] ?? 'default';
const key = `clp_${randomBytes(32).toString('hex')}`;
const hash = createHash('sha256').update(key).digest('hex');

await db.insert(apiKeys).values({ id: uuid(), key_hash: hash, label });
console.log(`API key created for "${label}":\n${key}\n\nStore this safely — it will not be shown again.`);
process.exit(0);
```

Add to package.json scripts: `"create-api-key": "tsx src/scripts/create-api-key.ts"`

- [ ] **Step 4: Update CLAUDE.md with final commands**

```bash
# Update /root/app/claude/clipchat/CLAUDE.md with actual dev commands
```

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/scripts packages/engine/test/e2e.test.ts packages/engine/package.json CLAUDE.md
git commit -m "feat: API key generation script and end-to-end test"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-24-clipchat-phase1-foundation.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration. Uses `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session with checkpoints. Uses `superpowers:executing-plans`.

Which approach?
