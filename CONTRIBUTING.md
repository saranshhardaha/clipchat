# Contributing

Thanks for your interest in ClipChat Engine. This guide covers the development workflow, project structure, and how to add new FFmpeg tools.

---

## Project Structure

```
clipchat/
├── packages/
│   └── engine/
│       ├── src/
│       │   ├── types/          # Zod schemas + TypeScript types
│       │   ├── storage/        # StorageAdapter interface + local/S3 impls
│       │   ├── ffmpeg/         # One file per tool (executor + 20 tools)
│       │   ├── queue/          # BullMQ queue setup + worker
│       │   ├── db/             # Drizzle schema + migrations
│       │   ├── api/            # Express app, routes, middleware
│       │   └── mcp/            # MCP server (stdio transport)
│       ├── test/
│       │   ├── helpers/        # fixtures.ts (auto-generated test media)
│       │   └── ffmpeg/         # FFmpeg tool tests
│       └── package.json
├── docs/                       # Documentation
├── docker-compose.yml
├── Dockerfile
└── package.json                # Monorepo root
```

---

## Development Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/clipchat.git
cd clipchat
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env if needed (defaults work for local dev)

# 3. Start Postgres and Redis
docker compose up -d postgres redis

# 4. Run migrations
npm run db:generate -w packages/engine
npm run db:migrate -w packages/engine

# 5. Start dev server (hot reload)
npm run dev -w packages/engine
```

The server starts at `http://localhost:3000`. Create an API key:
```bash
npm run create-api-key -w packages/engine -- "dev"
```

---

## Running Tests

Tests require running Postgres and Redis. Start them first:

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
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat \
REDIS_URL=redis://localhost:6379 \
npm test -w packages/engine -- test/ffmpeg/trim.test.ts
```

**Notes:**
- Tests run with `singleFork: true` — FFmpeg tests cannot run in parallel. This prevents FFmpeg subprocess conflicts.
- Test fixtures (`test.mp4`, `test.mp3`, `test.srt`) are auto-generated on first run using FFmpeg. This takes ~10 seconds once and is cached in `test/fixtures/` (gitignored).
- Pass `DATABASE_URL` and `REDIS_URL` as env vars — vitest does not load `.env` files automatically.

---

## Adding a New FFmpeg Tool

Adding a tool involves 6 files. Follow this checklist:

### 1. Define the Zod schema — `src/types/tools.ts`

Add input and output schemas:
```typescript
export const MyNewToolInputSchema = z.object({
  input_file: z.string(),
  my_option: z.string().optional().default('default'),
});

export type MyNewToolInput = z.infer<typeof MyNewToolInputSchema>;
export type MyNewToolOutput = string; // or a structured object
```

Add `'my_new_tool'` to the `ToolName` union and `ALL_TOOLS` array.

### 2. Implement the FFmpeg logic — `src/ffmpeg/my_new_tool.ts`

```typescript
import ffmpeg from 'fluent-ffmpeg';
import { MyNewToolInput } from '../types/tools.js';
import { tempOutputPath, runFfmpeg } from './executor.js';

export async function myNewTool(
  input: MyNewToolInput,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const output = tempOutputPath('mp4');
  const cmd = ffmpeg(input.input_file)
    // ... configure ffmpeg
    .output(output);

  await runFfmpeg(cmd, { onProgress });
  return output;
}
```

### 3. Register in the worker — `src/queue/worker.ts`

Import and add to `TOOL_MAP`:
```typescript
import { myNewTool } from '../ffmpeg/my_new_tool.js';

const TOOL_MAP: Record<ToolName, ...> = {
  // ... existing tools
  my_new_tool: (i, p) => myNewTool(i, p),
};
```

### 4. Add to the REST API tool list — `src/api/routes/tools.ts`

Add a description entry to the `TOOL_DESCRIPTIONS` array:
```typescript
{ name: 'my_new_tool', description: 'What my new tool does' },
```

The tool is automatically callable via `POST /api/v1/tools/my_new_tool` — no additional route needed.

### 5. Expose via MCP — `src/mcp/tools.ts`

Add an entry to the `MCP_TOOLS` array:
```typescript
{
  name: 'my_new_tool',
  description: 'What my new tool does',
  schema: MyNewToolInputSchema,
  handler: myNewTool,
},
```

### 6. Write tests — `test/ffmpeg/my_new_tool.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { myNewTool } from '../../src/ffmpeg/my_new_tool.js';
import { TEST_VIDEO } from '../helpers/fixtures.js';

describe('myNewTool', () => {
  it('produces an output file', async () => {
    const output = await myNewTool({ input_file: TEST_VIDEO });
    expect(existsSync(output)).toBe(true);
  });
});
```

---

## Database Migrations

When you change `src/db/schema.ts`, generate and apply the migration:

```bash
npm run db:generate -w packages/engine   # generates SQL migration file
npm run db:migrate -w packages/engine    # applies to local DB
```

Commit both the schema change and the generated migration file in `src/db/migrations/`.

---

## Build

Compile TypeScript:
```bash
npm run build -w packages/engine
```

Output goes to `packages/engine/dist/`. The build is required for:
- Running the MCP server (`node dist/index.js --mcp`)
- Building the Docker image

---

## PR Guidelines

- **One concern per PR** — keep changes focused
- **Tests required** — all new tools must have tests; PRs that reduce test coverage won't be merged
- **Pass CI** — all 34+ tests must pass
- **Update docs** — if you add a tool, update `docs/tools-reference.md`
- **No breaking changes** to existing tool input schemas without a major version bump

### PR title format

```
feat: add my_new_tool FFmpeg operation
fix: handle edge case in trim_video when start_time equals duration
docs: add deployment guide for AWS ECS
chore: upgrade fluent-ffmpeg to 2.2.0
```

---

## Reporting Issues

Open an issue on GitHub with:
- What you were trying to do
- The exact command or API call
- The error message or unexpected behavior
- Your environment (OS, Node.js version, FFmpeg version)
