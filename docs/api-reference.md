# API Reference

Base URL: `http://localhost:3000`

All `/api/v1/*` routes require authentication. The `/health` route is public.

---

## Authentication

Include your API key in every request:

```
Authorization: Bearer clp_your_api_key_here
```

Generate a key with:
```bash
npm run create-api-key -w packages/engine -- "label"
```

### Error Responses

All errors return JSON:
```json
{ "error": "Human-readable error message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Validation error or missing required field |
| `401` | Missing or invalid API key |
| `404` | Resource not found |
| `409` | Conflict (e.g., job already completed) |
| `500` | Internal server error |

---

## Health

### `GET /health`

Public endpoint. Returns server status.

**Response `200`:**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

```bash
curl http://localhost:3000/health
```

---

## Files

### `POST /api/v1/files/upload`

Upload a video or audio file. Returns a file record with an ID you use in job inputs.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | The file to upload (any video/audio format) |

**Response `201`:**
```json
{
  "id": "3f7a8b2c-...",
  "original_name": "myvideo.mp4",
  "mime_type": "video/mp4",
  "size_bytes": 10485760,
  "path": "/absolute/path/on/server",
  "url": "/files/3f7a8b2c-...",
  "created_at": "2026-03-24T06:00:00.000Z"
}
```

```bash
curl -X POST http://localhost:3000/api/v1/files/upload \
  -H "Authorization: Bearer clp_..." \
  -F "file=@/path/to/video.mp4"
```

**Notes:**
- Max file size: 5 GB
- The `path` field is the server-local path you pass as `input_file` in job inputs
- With S3 storage, `path` is an `s3://` URI and `url` is a presigned download URL

---

### `GET /api/v1/files/:id`

Retrieve metadata for a previously uploaded file.

**Response `200`:** Same schema as upload response.

```bash
curl http://localhost:3000/api/v1/files/3f7a8b2c-... \
  -H "Authorization: Bearer clp_..."
```

---

### `DELETE /api/v1/files/:id`

Delete a file from storage.

**Response `204`:** No content.

```bash
curl -X DELETE http://localhost:3000/api/v1/files/3f7a8b2c-... \
  -H "Authorization: Bearer clp_..."
```

---

## Jobs

Jobs are the primary way to run FFmpeg operations. Submit a job, then poll for results or stream progress via SSE.

### Job Object

```json
{
  "id": "job_1a2b3c_4d5e",
  "status": "queued",
  "tool": "trim_video",
  "input": { "input_file": "/path/to/video.mp4", "start_time": "0", "end_time": "10" },
  "output": null,
  "progress": 0,
  "error": null,
  "created_at": "2026-03-24T06:00:00.000Z",
  "completed_at": null
}
```

**Status values:** `queued` → `processing` → `completed` | `failed`

---

### `POST /api/v1/jobs`

Submit an async FFmpeg job.

**Request body:**
```json
{
  "tool": "trim_video",
  "input": {
    "input_file": "/absolute/path/on/server",
    "start_time": "5",
    "end_time": "30"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool` | string | Yes | Tool name (see [Tools Reference](tools-reference.md)) |
| `input` | object | Yes | Tool-specific input (see [Tools Reference](tools-reference.md)) |

**Response `202`:** Job object (status: `queued`).

```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Authorization: Bearer clp_..." \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "trim_video",
    "input": {
      "input_file": "/uploads/abc123.mp4",
      "start_time": "5",
      "end_time": "30"
    }
  }'
```

---

### `GET /api/v1/jobs/:id`

Poll job status. The `output` field is populated when status is `completed`.

**Response `200`:** Job object.

```bash
curl http://localhost:3000/api/v1/jobs/job_1a2b3c_4d5e \
  -H "Authorization: Bearer clp_..."
```

**Completed example:**
```json
{
  "id": "job_1a2b3c_4d5e",
  "status": "completed",
  "tool": "trim_video",
  "input": { "input_file": "...", "start_time": "5", "end_time": "30" },
  "output": "/tmp/clipchat_xyz.mp4",
  "progress": 100,
  "error": null,
  "created_at": "2026-03-24T06:00:00.000Z",
  "completed_at": "2026-03-24T06:00:05.000Z"
}
```

---

### `GET /api/v1/jobs/:id/stream`

Stream job progress as Server-Sent Events. Closes automatically when the job completes or fails.

**Response:** `text/event-stream`

Each event is a full Job object:
```
data: {"id":"job_...","status":"processing","progress":42,...}

data: {"id":"job_...","status":"completed","progress":100,"output":"/tmp/..."}
```

```bash
curl -N http://localhost:3000/api/v1/jobs/job_1a2b3c_4d5e/stream \
  -H "Authorization: Bearer clp_..."
```

**JavaScript example:**
```js
const evtSource = new EventSource('/api/v1/jobs/job_1a2b3c_4d5e/stream');
evtSource.onmessage = (e) => {
  const job = JSON.parse(e.data);
  console.log(`${job.status} — ${job.progress}%`);
  if (job.status === 'completed') {
    console.log('Output:', job.output);
    evtSource.close();
  }
};
```

---

### `DELETE /api/v1/jobs/:id`

Cancel a pending or processing job.

**Response `204`:** Job cancelled.
**Response `409`:** Job already completed or failed (cannot cancel).

```bash
curl -X DELETE http://localhost:3000/api/v1/jobs/job_1a2b3c_4d5e \
  -H "Authorization: Bearer clp_..."
```

---

## Tools

### `GET /api/v1/tools`

List all available tools.

**Response `200`:**
```json
{
  "tools": [
    { "name": "trim_video", "description": "Trim a video between two timestamps" },
    { "name": "merge_clips", "description": "Merge multiple clips sequentially" },
    ...
  ]
}
```

```bash
curl http://localhost:3000/api/v1/tools \
  -H "Authorization: Bearer clp_..."
```

---

### `POST /api/v1/tools/:name`

Shorthand for submitting a job with a specific tool. Equivalent to `POST /jobs` with `tool` set.

**Request body:** Tool input object (see [Tools Reference](tools-reference.md))

**Response `202`:**
```json
{ "id": "job_...", "status": "queued" }
```

```bash
curl -X POST http://localhost:3000/api/v1/tools/get_video_info \
  -H "Authorization: Bearer clp_..." \
  -H "Content-Type: application/json" \
  -d '{ "input_file": "/uploads/abc123.mp4" }'
```

---

## Complete Workflow Example

```bash
API_KEY="clp_your_key"
BASE="http://localhost:3000"

# 1. Upload a file
UPLOAD=$(curl -s -X POST $BASE/api/v1/files/upload \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@./myvideo.mp4")

FILE_PATH=$(echo $UPLOAD | jq -r '.path')
echo "Uploaded to: $FILE_PATH"

# 2. Submit a trim job
JOB=$(curl -s -X POST $BASE/api/v1/jobs \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"tool\":\"trim_video\",\"input\":{\"input_file\":\"$FILE_PATH\",\"start_time\":\"5\",\"end_time\":\"30\"}}")

JOB_ID=$(echo $JOB | jq -r '.id')
echo "Job ID: $JOB_ID"

# 3. Poll until done
while true; do
  STATUS=$(curl -s $BASE/api/v1/jobs/$JOB_ID \
    -H "Authorization: Bearer $API_KEY" | jq -r '.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 1
done

# 4. Get result path
curl -s $BASE/api/v1/jobs/$JOB_ID \
  -H "Authorization: Bearer $API_KEY" | jq '.output'
```
