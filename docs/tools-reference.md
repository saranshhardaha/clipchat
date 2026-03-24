# Tools Reference

ClipChat exposes 10 FFmpeg operations as tools. Each tool accepts a JSON input object and returns either structured data or the path to an output file.

**Usage:** Submit via `POST /api/v1/jobs` with `{ "tool": "<name>", "input": { ... } }`, or via `POST /api/v1/tools/<name>` with just the input object.

All file paths (`input_file`, `audio_file`) must be absolute server paths — either from the `path` field of an uploaded file or a path accessible to the server process.

---

## 1. `get_video_info`

Extract metadata from a video or audio file using ffprobe.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input_file` | string | Yes | Absolute path to the video/audio file |

**Output (job.output):**
```json
{
  "duration": 120.5,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "codec": "h264",
  "audio_codec": "aac",
  "size_bytes": 52428800,
  "bitrate": 3478000
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/tools/get_video_info \
  -H "Authorization: Bearer clp_..." \
  -H "Content-Type: application/json" \
  -d '{ "input_file": "/uploads/video.mp4" }'
```

---

## 2. `trim_video`

Cut a video between two time positions using stream copy (fast, no re-encode).

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "start_time": "10",
  "end_time": "30",
  "output_format": "mp4"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `start_time` | string | Yes | — | Start position in seconds or `HH:MM:SS` format |
| `end_time` | string | Yes | — | End position in seconds or `HH:MM:SS` format |
| `output_format` | string | No | Same as input | Output container format (mp4, mov, etc.) |

**Output (job.output):** Path to trimmed file (string).

**Example — trim seconds 10 to 30:**
```bash
curl -X POST http://localhost:3000/api/v1/tools/trim_video \
  -H "Authorization: Bearer clp_..." \
  -H "Content-Type: application/json" \
  -d '{
    "input_file": "/uploads/video.mp4",
    "start_time": "10",
    "end_time": "30"
  }'
```

**Example — using timestamp format:**
```json
{
  "input_file": "/uploads/video.mp4",
  "start_time": "00:01:30",
  "end_time": "00:02:00"
}
```

---

## 3. `merge_clips`

Concatenate multiple video clips. With `transition: "none"` uses stream copy (fast). With `fade` or `crossfade` re-encodes with the xfade filter.

**Input:**
```json
{
  "input_files": ["/path/clip1.mp4", "/path/clip2.mp4"],
  "transition": "none",
  "transition_duration": 0.5
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_files` | string[] | Yes | — | At least 2 video paths to concatenate in order |
| `transition` | string | No | `"none"` | `"none"`, `"fade"`, or `"crossfade"` |
| `transition_duration` | number | No | `0.5` | Duration of transition in seconds (ignored for `"none"`) |

**Output (job.output):** Path to merged file (string).

**Example — fast concat:**
```json
{
  "input_files": ["/uploads/intro.mp4", "/uploads/main.mp4", "/uploads/outro.mp4"],
  "transition": "none"
}
```

**Example — with crossfade:**
```json
{
  "input_files": ["/uploads/a.mp4", "/uploads/b.mp4"],
  "transition": "crossfade",
  "transition_duration": 1.0
}
```

**Note:** When using transitions, all clips should have the same resolution and frame rate.

---

## 4. `resize_video`

Change video dimensions using a preset or explicit width/height. Uses the `scale` filter.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "preset": "720p",
  "pad": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `width` | integer | No | — | Output width in pixels |
| `height` | integer | No | — | Output height in pixels |
| `preset` | string | No | — | Preset name (see below) |
| `pad` | boolean | No | `false` | Add black bars instead of cropping |

Provide either `preset` OR `width`/`height` (at least one dimension).

**Presets:**

| Preset | Resolution |
|--------|------------|
| `720p` | 1280×720 |
| `1080p` | 1920×1080 |
| `4k` | 3840×2160 |
| `square` | 1080×1080 |
| `9:16` | 1080×1920 |
| `16:9` | 1920×1080 |

**Output (job.output):** Path to resized file (string).

**Example — resize to 720p:**
```json
{
  "input_file": "/uploads/video.mp4",
  "preset": "720p"
}
```

**Example — custom dimensions with padding:**
```json
{
  "input_file": "/uploads/video.mp4",
  "width": 1080,
  "height": 1080,
  "pad": true
}
```

---

## 5. `extract_audio`

Extract the audio track from a video file.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "format": "mp3",
  "quality": "medium"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `format` | string | No | `"mp3"` | Output format: `"mp3"`, `"aac"`, `"wav"` |
| `quality` | string | No | `"medium"` | Bitrate preset: `"low"` (128k), `"medium"` (192k), `"high"` (320k) |

**Output (job.output):** Path to audio file (string).

**Example:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "mp3",
  "quality": "high"
}
```

---

## 6. `replace_audio`

Replace or mix the audio track in a video.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "audio_file": "/path/to/music.mp3",
  "mix": false,
  "audio_volume": 1.0,
  "original_volume": 0.0
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `audio_file` | string | Yes | — | New audio file to use |
| `mix` | boolean | No | `false` | Mix both tracks together (true) or replace (false) |
| `audio_volume` | number | No | `1.0` | Volume of the new audio track (0–2) |
| `original_volume` | number | No | `0.0` | Volume of the original audio track (0–2, only used when `mix: true`) |

**Output (job.output):** Path to output video (string).

**Example — replace audio completely:**
```json
{
  "input_file": "/uploads/video.mp4",
  "audio_file": "/uploads/music.mp3",
  "mix": false
}
```

**Example — mix background music at 30%:**
```json
{
  "input_file": "/uploads/video.mp4",
  "audio_file": "/uploads/music.mp3",
  "mix": true,
  "original_volume": 1.0,
  "audio_volume": 0.3
}
```

---

## 7. `add_text_overlay`

Burn text into the video using the `drawtext` FFmpeg filter.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "text": "Hello World",
  "start_time": "2",
  "end_time": "8",
  "position": { "x": "(w-text_w)/2", "y": "h-text_h-20" },
  "style": {
    "font": "Arial",
    "size": 36,
    "color": "white",
    "background_color": "black@0.5"
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `text` | string | Yes | — | Text to display |
| `start_time` | string | No | — | When text appears (seconds) |
| `end_time` | string | No | — | When text disappears (seconds) |
| `position.x` | string | No | `"(w-text_w)/2"` | X position (FFmpeg expression) |
| `position.y` | string | No | `"h-text_h-20"` | Y position (FFmpeg expression) |
| `style.font` | string | No | `"Arial"` | Font name |
| `style.size` | number | No | `24` | Font size in pixels |
| `style.color` | string | No | `"white"` | Font color (name or hex) |
| `style.background_color` | string | No | — | Background box color (e.g., `"black@0.5"`) |

**Output (job.output):** Path to video with text (string).

**Position expressions** use FFmpeg variables: `w` (video width), `h` (video height), `text_w` (text width), `text_h` (text height).

**Example — centered subtitle-style text:**
```json
{
  "input_file": "/uploads/video.mp4",
  "text": "Chapter 1",
  "start_time": "0",
  "end_time": "5",
  "style": { "size": 48, "color": "yellow" }
}
```

---

## 8. `add_subtitles`

Add an SRT subtitle file to a video — burned in (hardcoded) or as a soft track.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "subtitle_source": "/path/to/subtitles.srt",
  "style": {
    "font_size": 24,
    "font_color": "#FFFFFF",
    "position": "bottom"
  },
  "burn_in": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `subtitle_source` | string | Yes | — | Path to `.srt` file |
| `burn_in` | boolean | No | `true` | Burn subtitles into video (`true`) or add as soft track (`false`) |
| `style.font_size` | number | No | — | Font size |
| `style.font_color` | string | No | — | Font color (hex, e.g., `"#FFFFFF"`) |
| `style.position` | string | No | `"bottom"` | `"bottom"`, `"top"`, or `"center"` |

**Output (job.output):** Path to video with subtitles (string).

**Example:**
```json
{
  "input_file": "/uploads/video.mp4",
  "subtitle_source": "/uploads/captions.srt",
  "burn_in": true,
  "style": { "font_size": 28 }
}
```

**Note:** Burned-in subtitles require FFmpeg to be compiled with `libass`. The Docker image includes this by default.

---

## 9. `change_speed`

Speed up or slow down a video. Adjusts both video and audio.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "speed_factor": 2.0,
  "preserve_audio_pitch": true
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `speed_factor` | number | Yes | — | Playback speed multiplier: `0.25`–`4.0` (2.0 = 2× speed) |
| `preserve_audio_pitch` | boolean | No | `true` | Use `atempo` to keep audio pitch correct |

**Output (job.output):** Path to speed-adjusted video (string).

**Examples:**
- `0.5` — slow motion (half speed)
- `1.5` — 1.5× speed
- `2.0` — double speed
- `4.0` — 4× timelapse

**Note:** `speed_factor` outside `0.5–2.0` chains multiple `atempo` filters automatically to stay within FFmpeg's supported range.

**Example:**
```json
{
  "input_file": "/uploads/video.mp4",
  "speed_factor": 0.5,
  "preserve_audio_pitch": true
}
```

---

## 10. `export_video`

Re-encode a video with a specific codec, quality level, or target file size.

**Input:**
```json
{
  "input_file": "/path/to/video.mp4",
  "format": "mp4",
  "codec": "h264",
  "quality": "medium",
  "target_size_mb": 10,
  "resolution": "1280x720"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input_file` | string | Yes | — | Source video |
| `format` | string | Yes | — | Output container: `"mp4"`, `"webm"`, `"mov"`, `"gif"` |
| `codec` | string | No | `"h264"` | Video codec: `"h264"`, `"h265"`, `"vp9"`, `"av1"` |
| `quality` | string | No | `"medium"` | CRF preset: `"low"` (CRF 35), `"medium"` (CRF 23), `"high"` (CRF 18), `"lossless"` (CRF 0) |
| `target_size_mb` | number | No | — | Target output file size in MB (uses bitrate targeting) |
| `resolution` | string | No | — | Resize during export, e.g., `"1280x720"` |

**Output (job.output):** Path to exported file (string).

**Codec compatibility:**
| Codec | Format |
|-------|--------|
| `h264` | mp4, mov |
| `h265` | mp4, mov |
| `vp9` | webm |
| `av1` | webm, mp4 |

**Example — compress for web:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "mp4",
  "codec": "h264",
  "quality": "high"
}
```

**Example — target 10MB file:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "mp4",
  "target_size_mb": 10
}
```

**Example — convert to WebM:**
```json
{
  "input_file": "/uploads/video.mp4",
  "format": "webm",
  "codec": "vp9",
  "quality": "medium"
}
```
