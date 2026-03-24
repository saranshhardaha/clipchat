# ClipChat Performance Improvements — Design Spec

**Date:** 2026-03-24
**Status:** Approved

## Problem

Four concrete performance issues identified through codebase audit:

1. **Memory OOM on uploads** — `multer.memoryStorage()` with 5GB limit buffers the entire video in RAM before saving. A single large upload spikes RAM by the file size; concurrent uploads will crash the server.
2. **Missing DB indexes** — `sessions.api_key_id`, `sessions.updated_at`, `chat_messages.session_id`, `chat_messages.created_at` have no indexes. All session/message queries are full table scans — O(n) as data grows.
3. **Unbounded in-memory file cache** — `fileCache = new Map()` in `files.ts` never evicts. Memory grows linearly with uploads. Also causes 404s on server restart because `GET /files/:id` only checks the cache, not the DB.
4. **Video seeking broken** — Engine declares `Accept-Ranges: bytes` but ignores incoming `Range` headers, always streaming from byte 0. The web proxy also doesn't forward the `Range` header. Result: the HTML5 `<video>` player cannot seek.

## Design

### Fix 1 — Stream-based StorageAdapter + multer diskStorage

**Decision:** Refactor `StorageAdapter.save()` to accept a `Readable` stream instead of a `Buffer`. This is the correct long-term interface — works naturally for both local disk and S3, and eliminates RAM buffering entirely.

**Interface change** (`packages/engine/src/types/storage.ts`):
```typescript
// Before:
save(buffer: Buffer, originalName: string, mimeType: string): Promise<FileRecord>
// After:
save(stream: import('stream').Readable, originalName: string, mimeType: string, sizeBytes: number): Promise<FileRecord>
```

`sizeBytes` is a required parameter because S3's `PutObjectCommand` requires `ContentLength` when the body is a stream (otherwise the SDK cannot determine when the stream ends).

**Upload flow:**
1. Switch multer from `memoryStorage()` to `diskStorage({ destination: os.tmpdir() })` — multer writes the incoming multipart body to a temp file instead of RAM
2. Upload handler creates `fs.createReadStream(req.file.path)` and passes it to `storage.save(stream, originalname, mimetype, req.file.size)`
3. `LocalStorageAdapter.save()` pipes the stream to `fs.createWriteStream(finalPath)` — never buffers the full file
4. `S3StorageAdapter.save()` passes the stream to `PutObjectCommand` with `Body: stream, ContentLength: sizeBytes` — streams to S3 without buffering. **No new dependencies needed** — `@aws-sdk/client-s3` already handles `Readable` streams with `ContentLength`.
5. Handler deletes the temp file in a `finally` block — this ensures cleanup even if `storage.save()` throws (e.g., S3 network error, disk full):
   ```typescript
   try {
     const record = await storage.save(stream, originalname, mimetype, req.file.size);
     // ... insert to DB, return record
   } finally {
     await fs.promises.unlink(req.file.path).catch(() => {});
   }
   ```
6. `size_bytes` comes from `req.file.size` (set by multer diskStorage, available before streaming starts)

**Files:** `types/storage.ts`, `storage/local.ts`, `storage/s3.ts`, `api/routes/files.ts`

---

### Fix 2 — DB indexes

Add Drizzle `index()` declarations to `packages/engine/src/db/schema.ts`:

| Index name | Table | Column | Query it serves |
|---|---|---|---|
| `idx_sessions_api_key_id` | sessions | api_key_id | `GET /sessions WHERE api_key_id = ?` |
| `idx_sessions_updated_at` | sessions | updated_at | `ORDER BY updated_at DESC` |
| `idx_chat_messages_session_id` | chat_messages | session_id | `GET /messages WHERE session_id = ?` |
| `idx_chat_messages_created_at` | chat_messages | created_at | `ORDER BY created_at ASC` |
| `idx_jobs_file_id` | jobs | file_id | future file→job queries |

Run `npm run db:generate -w packages/engine` to generate the migration.

**Files:** `db/schema.ts`, `db/migrations/` (generated)

---

### Fix 3 — Remove unbounded file cache

Delete `const fileCache = new Map<string, FileRecord>()` and all references in `api/routes/files.ts`:

- `GET /files/:id` — query DB directly (was cache-only, causing 404s on restart)
- `GET /files/:id/content` — query DB directly (cache check already had a DB fallback; simplify to DB-only)
- Upload handler — remove `fileCache.set()` call

The DB primary key (`files.id`) is already indexed. Lookups are O(log n) and survive restarts.

**Files:** `api/routes/files.ts`

---

### Fix 4 — Range header support (video seeking)

**Engine** (`api/routes/files.ts`) — parse `Range` header and return 206 Partial Content, with validation:
```typescript
const stat = await fs.promises.stat(record.path);
const fileSize = stat.size;
const range = req.headers.range;

if (range) {
  const match = range.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) {
    // Malformed or multi-range — return 416 Range Not Satisfiable
    res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
    return res.end();
  }
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  if (start > end || start >= fileSize || end >= fileSize) {
    res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
    return res.end();
  }
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1,
    'Content-Type': record.mime_type,
  });
  createReadStream(record.path, { start, end }).pipe(res);
} else {
  res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': record.mime_type, 'Accept-Ranges': 'bytes' });
  createReadStream(record.path).pipe(res);
}
```

**Web proxy** (`packages/web/app/api/files/[id]/content/route.ts`) — forward `Range` header and pass through 206:
```typescript
const range = req.headers.get('Range');
if (range) headers['Range'] = range;

const upstream = await fetch(..., { headers });

const responseHeaders = new Headers();
for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
  const v = upstream.headers.get(h);
  if (v) responseHeaders.set(h, v);
}
return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
```

**Files:** `api/routes/files.ts`, `packages/web/app/api/files/[id]/content/route.ts`

---

## Files Modified

| File | Change |
|---|---|
| `packages/engine/src/types/storage.ts` | `save()` takes `Readable` not `Buffer` |
| `packages/engine/src/storage/local.ts` | Pipe stream to final path |
| `packages/engine/src/storage/s3.ts` | Pass `Readable` + `ContentLength: sizeBytes` to `PutObjectCommand` |
| `packages/engine/src/api/routes/files.ts` | diskStorage + no cache + Range headers |
| `packages/engine/src/db/schema.ts` | Add 5 indexes |
| `packages/engine/src/db/migrations/` | Generated migration |
| `packages/web/app/api/files/[id]/content/route.ts` | Forward Range header + 206 |

## Tests

- `packages/engine/test/api/files.test.ts` — add Range header test (expect 206, `Content-Range` header)
- `packages/engine/test/storage.test.ts` — update to pass `Readable` stream instead of `Buffer`

## Verification

```bash
# Apply migration
npm run db:generate -w packages/engine
npm run db:migrate -w packages/engine

# Run tests
docker compose up -d postgres redis
npm test -w packages/engine

# Manual: verify upload doesn't spike RAM for large files
# Manual: drag video seek bar in browser → Network tab should show Range header + 206 response
```
