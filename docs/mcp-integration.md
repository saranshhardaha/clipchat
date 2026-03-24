# MCP Integration

ClipChat exposes all 10 FFmpeg tools via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), letting AI agents like Claude call video operations directly.

---

## How it works

When started with `--mcp`, ClipChat runs as an MCP server over stdio. The AI agent sends JSON-RPC tool calls; ClipChat executes FFmpeg synchronously and returns the result.

**Key difference from the REST API:**
- MCP tools call FFmpeg **directly** — no job queue, no polling
- Results are returned **immediately** in the tool response
- All 10 tools are available with the same input schemas as the REST API

---

## Prerequisites

1. **Build the engine first:**
   ```bash
   npm run build -w packages/engine
   ```
   This compiles TypeScript to `packages/engine/dist/`.

2. **Running Postgres and Redis are required** — the MCP server still uses the database for file tracking.

3. **Absolute file paths** — all `input_file` and `audio_file` paths must be absolute paths accessible to the server process. The AI agent cannot use relative paths.

---

## Start the MCP Server

```bash
DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat \
REDIS_URL=redis://localhost:6379 \
node packages/engine/dist/index.js --mcp
```

The server communicates via stdin/stdout using the MCP stdio transport. It does not bind to a network port.

---

## Claude Desktop

Add ClipChat to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "clipchat": {
      "command": "node",
      "args": ["/absolute/path/to/clipchat/packages/engine/dist/index.js", "--mcp"],
      "env": {
        "DATABASE_URL": "postgres://postgres:clipchat@localhost:5432/clipchat",
        "REDIS_URL": "redis://localhost:6379",
        "STORAGE_DRIVER": "local",
        "UPLOAD_DIR": "/absolute/path/to/clipchat/uploads"
      }
    }
  }
}
```

Replace `/absolute/path/to/clipchat` with the actual path on your system.

Restart Claude Desktop after saving. You should see "clipchat" in the tools list.

---

## Claude Code

Add ClipChat as an MCP server in your Claude Code session:

```bash
claude mcp add clipchat \
  --command node \
  --args "/absolute/path/to/clipchat/packages/engine/dist/index.js,--mcp" \
  --env DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat \
  --env REDIS_URL=redis://localhost:6379
```

Or add it globally so it's available in every project:

```bash
claude mcp add --scope global clipchat \
  --command node \
  --args "/absolute/path/to/clipchat/packages/engine/dist/index.js,--mcp" \
  --env DATABASE_URL=postgres://postgres:clipchat@localhost:5432/clipchat \
  --env REDIS_URL=redis://localhost:6379
```

Verify it's registered:
```bash
claude mcp list
```

---

## Example: Asking Claude to edit a video

Once connected, you can ask Claude natural language questions about video editing. Claude will call the appropriate ClipChat tools.

**Example prompts:**

> "Trim `/home/user/vacation.mp4` from 0:30 to 1:15 and save it."

Claude calls `trim_video`:
```json
{
  "input_file": "/home/user/vacation.mp4",
  "start_time": "30",
  "end_time": "75"
}
```
Returns: path to trimmed file.

---

> "Get the info for `/uploads/raw_footage.mp4`"

Claude calls `get_video_info`:
```json
{
  "input_file": "/uploads/raw_footage.mp4"
}
```
Returns: `{ "duration": 245.3, "width": 3840, "height": 2160, "fps": 24, ... }`

---

> "Speed up `/uploads/timelapse.mp4` to 4x and export it as a WebM."

Claude chains two calls:
1. `change_speed` with `speed_factor: 4.0`
2. `export_video` with `format: "webm"`, `codec: "vp9"`

---

## Available tools via MCP

All 10 tools from the REST API are available:

| Tool | Description |
|------|-------------|
| `get_video_info` | Extract metadata (duration, resolution, codec) |
| `trim_video` | Cut between two timestamps |
| `merge_clips` | Concatenate clips with optional crossfade |
| `resize_video` | Resize by preset or dimensions |
| `extract_audio` | Export audio track as mp3/aac/wav |
| `replace_audio` | Swap or mix audio tracks |
| `add_text_overlay` | Burn text with custom font/position/timing |
| `add_subtitles` | Burn SRT subtitles or add as soft track |
| `change_speed` | Speed up or slow down (0.25×–4×) |
| `export_video` | Re-encode with codec/quality/size control |

See [Tools Reference](tools-reference.md) for full input schemas.

---

## File path requirements

MCP tools require **absolute paths** that are accessible to the server process:

- If the server runs locally, use your local filesystem paths: `/home/user/video.mp4`
- If the server runs in Docker, paths must be inside the container: `/uploads/video.mp4`
- Upload files via the REST API first (`POST /api/v1/files/upload`) to get a server-local path, then pass that path to MCP tools

**File uploads are not supported via MCP directly.** Use the REST API to upload, then use the returned `path` field in MCP tool calls.

---

## Troubleshooting

**`spawn node ENOENT` in Claude Desktop**
Node.js is not on the PATH that Claude Desktop uses. Use the full path to node:
```json
"command": "/usr/local/bin/node"
```
Find it with: `which node`

**`Error: DATABASE_URL is required`**
The `env` block in your config is missing or has wrong values. Check that Postgres is running and the connection string is correct.

**Tools not appearing in Claude**
Rebuild first: `npm run build -w packages/engine`. Check that the `dist/index.js` file exists.

**`ECONNREFUSED` connecting to Postgres/Redis**
Start the services: `docker compose up -d postgres redis`
