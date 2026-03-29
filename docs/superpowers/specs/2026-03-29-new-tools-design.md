# Design: New Video Editing Tools

**Date:** 2026-03-29
**Status:** Approved

## Overview

Add 7 new FFmpeg-backed tools to ClipChat: `compress_video`, `generate_thumbnail`, `normalize_audio`, `fade_audio`, `add_watermark`, `create_gif`, and `blur_region`. Each follows the existing pattern: Zod schema → FFmpeg implementation → registered in worker, MCP_TOOLS, jobs route, system prompt, and tool-call-card.

---

## Tools

### 1. `compress_video`

Dedicated compression with named presets. Distinct from `export_video` in that it targets file-size reduction with user-friendly preset names and handles audio compression too.

**Schema:**
```ts
CompressVideoInputSchema = z.object({
  input_file: z.string(),
  preset: z.enum(['web', 'mobile', 'whatsapp', 'telegram', 'archive']),
  target_size_mb: z.number().positive().optional(),
})
```

**Preset mapping:**

| Preset | Video codec | CRF | Scale cap | Audio |
|--------|------------|-----|-----------|-------|
| `web` | H.264 | 23 | none | AAC 128k |
| `mobile` | H.264 | 28 | 720p max | AAC 96k |
| `whatsapp` | H.264 | 30 | 720p max | AAC 128k |
| `telegram` | H.264 | 26 | none | AAC 128k |
| `archive` | H.265 | 28 | none | AAC 128k |

If `target_size_mb` is provided, override CRF with 2-pass bitrate targeting: `target_bitrate = (target_size_mb * 8192) / duration`. Clamp to minimum 100 kbps floor.

**Output:** `.mp4` string path.

---

### 2. `generate_thumbnail`

Extract a single frame as a still image.

**Schema:**
```ts
GenerateThumbnailInputSchema = z.object({
  input_file: z.string(),
  timestamp: z.string(),               // seconds or HH:MM:SS
  format: z.enum(['jpg', 'png', 'webp']).default('jpg'),
  width: z.number().int().positive().optional(),
})
```

**Implementation:** `ffmpeg -ss {timestamp} -i input -vframes 1 [-vf scale={width}:-1] output.{format}`

**Output:** Image file path (`.jpg`/`.png`/`.webp`).

**VideoPlayer impact:** The VideoPlayer currently renders `<video>`. It needs to detect image outputs by checking the `src` extension (`.jpg`, `.png`, `.webp`) and render `<img>` instead.

---

### 3. `normalize_audio`

Loudness normalization using FFmpeg's `loudnorm` filter (EBU R128).

**Schema:**
```ts
NormalizeAudioInputSchema = z.object({
  input_file: z.string(),
  target_lufs: z.number().min(-24).max(-5).default(-14),   // -14 = YouTube/Spotify
  true_peak: z.number().min(-9).max(0).default(-1),
})
```

**Implementation:** `loudnorm=I={target_lufs}:TP={true_peak}:LRA=11` filter. Single-pass (integrated measurement). Video stream copied with `-c:v copy`.

**Error case:** No audio stream → job fails with message "no audio stream found".

**Output:** `.mp4` string path.

---

### 4. `fade_audio`

Add audio fade-in and/or fade-out.

**Schema:**
```ts
FadeAudioInputSchema = z.object({
  input_file: z.string(),
  fade_in_duration: z.number().min(0).default(0),   // seconds; at least one must be > 0
  fade_out_duration: z.number().min(0).default(0),  // seconds; at least one must be > 0
})
```

**Implementation:**
- Probe duration with `ffprobe` to compute fade-out start: `fade_out_start = duration - fade_out_duration`
- Cap each fade to `duration / 2` if their sum exceeds duration
- Filter: `afade=t=in:st=0:d={in},afade=t=out:st={start}:d={out}`
- Video stream copied with `-c:v copy`

**Output:** `.mp4` string path.

---

### 5. `add_watermark`

Overlay a logo/image onto a video.

**Schema:**
```ts
AddWatermarkInputSchema = z.object({
  input_file: z.string(),
  watermark_file: z.string(),
  position: z.enum(['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center']).default('bottom_right'),
  opacity: z.number().min(0).max(1).default(1),
  scale: z.number().min(0.01).max(1).default(0.15),   // fraction of video width
  margin: z.number().int().min(0).default(10),         // pixels
})
```

**Implementation:**
```
[1:v]scale=iw*{scale}:-1,format=rgba,colorchannelmixer=aa={opacity}[wm];
[0:v][wm]overlay={x}:{y}
```

Position expressions (using FFmpeg `W`, `H`, `w`, `h` overlay vars):

| Position | x | y |
|----------|---|---|
| `top_left` | `{margin}` | `{margin}` |
| `top_right` | `W-w-{margin}` | `{margin}` |
| `bottom_left` | `{margin}` | `H-h-{margin}` |
| `bottom_right` | `W-w-{margin}` | `H-h-{margin}` |
| `center` | `(W-w)/2` | `(H-h)/2` |

**Error case:** Non-existent `watermark_file` → FFmpeg exits with error → job marked `failed`.

**Output:** `.mp4` string path.

---

### 6. `create_gif`

Create an animated GIF from a video segment using two-pass palette generation for quality output.

**Schema:**
```ts
CreateGifInputSchema = z.object({
  input_file: z.string(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  fps: z.number().min(1).max(30).default(10),
  width: z.number().int().positive().default(480),
  optimize: z.boolean().default(true),
})
```

**Implementation (two-pass):**
1. Generate palette: `fps={fps},scale={width}:-1:flags=lanczos,palettegen` → temp `palette.png`
2. Apply palette: `fps={fps},scale={width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle` → output GIF

Both passes apply `-ss {start_time}` and `-to {end_time}` if provided.

**Output:** `.gif` string path.

---

### 7. `blur_region`

Blur a rectangular region of the video, with presets for common use cases (face blur, lower-third, full frame).

**Schema:**
```ts
BlurRegionInputSchema = z.object({
  input_file: z.string(),
  preset: z.enum(['face_top_center', 'lower_third', 'full_frame']).optional(),
  x: z.number().int().min(0).optional(),       // manual override (px)
  y: z.number().int().min(0).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  blur_strength: z.number().min(1).max(20).default(10),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
})
```

**Preset mappings** (computed from probed video dimensions `W × H`):

| Preset | x | y | w | h |
|--------|---|---|---|---|
| `face_top_center` | `W*0.25` | `0` | `W*0.5` | `H*0.4` |
| `lower_third` | `0` | `H*0.67` | `W` | `H*0.33` |
| `full_frame` | `0` | `0` | `W` | `H` |

Manual `x/y/width/height` override the preset. If neither preset nor manual coords are given, falls back to `full_frame`.

**Implementation:**
```
[0:v]crop={w}:{h}:{x}:{y},boxblur={strength}:{strength}[blurred];
[0:v][blurred]overlay={x}:{y}{enable}
```
Where `{enable}` = `` (empty) or `enable='between(t,{start},{end})'` if time range provided.

**Error case:** Manual coords out of bounds → FFmpeg `crop` errors → job fails with FFmpeg stderr message.

---

## File Structure

### New files

```
packages/engine/src/ffmpeg/
├── compress.ts     — compress_video
├── thumbnail.ts    — generate_thumbnail
├── enhance.ts      — normalize_audio, fade_audio
├── watermark.ts    — add_watermark
├── gif.ts          — create_gif
└── blur.ts         — blur_region
```

### Modified files (additive only)

| File | Change |
|------|--------|
| `engine/src/types/tools.ts` | +7 schemas + type exports |
| `engine/src/types/job.ts` | +7 names in `ToolName` union |
| `engine/src/queue/worker.ts` | +7 entries in `TOOL_MAP` |
| `engine/src/mcp/tools.ts` | +7 entries in `MCP_TOOLS` |
| `engine/src/api/routes/jobs.ts` | +7 schemas in `TOOL_SCHEMAS`; add `jpg/png/webp` to mime map |
| `engine/src/api/routes/chat.ts` | Update system prompt with new tools |
| `web/components/chat/tool-call-card.tsx` | +7 `TOOL_LABELS` + `formatInputSummary` cases |
| `web/components/chat/video-player.tsx` | Detect image `src` extension → render `<img>` instead of `<video>` |

---

## Error Handling

| Scenario | Handling |
|----------|---------|
| `compress_video` target bitrate below 100 kbps | Clamp to 100 kbps floor; job completes best-effort |
| `generate_thumbnail` timestamp beyond duration | FFmpeg seeks to last frame — acceptable, no special handling |
| `fade_audio` where in+out > duration | Cap each fade to `duration / 2` at runtime |
| `add_watermark` with missing watermark file | FFmpeg error → job `failed` with clear message |
| `create_gif` with no time range on long video | Full video → GIF; no limit enforced (user responsibility) |
| `blur_region` coords out of video bounds | FFmpeg crop error → job `failed` with FFmpeg stderr |
| `normalize_audio` on video with no audio | Check ffprobe streams; throw `AppError` before FFmpeg runs |
| Image output in VideoPlayer | `src` extension checked client-side; `<img>` rendered instead of `<video>` |

---

## System Prompt Additions

The `DEFAULT_SYSTEM` in `chat.ts` gains a new section:

```
**Compression & Export**
- compress_video — reduce file size with presets: web, mobile, whatsapp, telegram, archive. Use target_size_mb for exact size control.

**Still & Animation**
- generate_thumbnail — extract a frame as JPG/PNG/WebP at a given timestamp
- create_gif — create animated GIF from a segment (two-pass, palette-optimised)

**Audio Enhancement**
- normalize_audio — loudness normalisation to target LUFS (default -14 for streaming platforms)
- fade_audio — add fade-in and/or fade-out to audio

**Overlays & Effects**
- add_watermark — overlay a logo/image at a corner or center with opacity and scale control
- blur_region — blur a rectangle (manual coords or preset: face_top_center, lower_third, full_frame) with optional time range
```
